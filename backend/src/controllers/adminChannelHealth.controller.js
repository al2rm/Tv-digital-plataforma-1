import { pool } from "../database/db.js";
import { mapLimit, probeChannel } from "../services/iptvOrg.service.js";

const MAX_SELECTION = 100;
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const validIds = (value) => {
  if (value === undefined) return null;
  if (!Array.isArray(value) || !value.length) throw fail("Selecciona al menos un canal");
  const ids = [...new Set(value.map(Number))];
  if (ids.length > MAX_SELECTION) throw fail(`Puedes diagnosticar hasta ${MAX_SELECTION} canales por vez`);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw fail("La selección contiene canales inválidos");
  return ids;
};

export const checkDirectChannel = async (channel, probe = probeChannel) => {
  const sources = [
    ["principal", channel.manifest_url],
    ["alternativa", channel.fallback_manifest_url]
  ].filter(([, url]) => url);
  if (!sources.length) return { status: "failed", source: null, error: "No tiene una fuente configurada" };
  const errors = [];
  for (const [source, manifestUrl] of sources) {
    const result = await probe({ manifestUrl, headers: channel.stream_headers || {} });
    if (result.available) return { status: source === "principal" ? "ok" : "fallback", source, error: null };
    errors.push(`${source}: ${result.reason}`);
  }
  return { status: "failed", source: null, error: errors.join(" · ").slice(0, 1000) };
};

export const diagnoseChannels = async (req, res, next) => {
  try {
    const ids = validIds(req.body?.ids);
    const params = ids || [];
    const where = ids ? `WHERE c.id = ANY($1::BIGINT[])` : "WHERE c.activo";
    const result = await pool.query(`SELECT c.id,c.nombre,c.manifest_url,c.fallback_manifest_url,
      c.stream_headers,c.xtream_provider_id,p.activo AS provider_active
      FROM live_channels c LEFT JOIN xtream_providers p ON p.id=c.xtream_provider_id ${where}
      ORDER BY c.health_checked_at ASC NULLS FIRST,c.id LIMIT ${MAX_SELECTION}`, ids ? [params] : []);
    if (!result.rows.length) throw fail("No se encontraron canales para diagnosticar", 404);

    const checked = await mapLimit(result.rows, 6, async (channel) => {
      const outcome = channel.xtream_provider_id
        ? channel.provider_active
          ? { status: "provider", source: "xtream", error: null }
          : { status: "failed", source: "xtream", error: "El proveedor Xtream está inactivo" }
        : await checkDirectChannel(channel);
      const updated = await pool.query(`UPDATE live_channels SET health_status=$1::TEXT,health_source=$2,
        health_error=$3,health_checked_at=NOW(),consecutive_failures=CASE WHEN $1::TEXT='failed'
        THEN consecutive_failures+1 WHEN $1::TEXT IN ('ok','fallback') THEN 0 ELSE consecutive_failures END WHERE id=$4
        RETURNING id,nombre,health_status,health_source,health_error,health_checked_at,consecutive_failures`,
      [outcome.status, outcome.source, outcome.error, channel.id]);
      return updated.rows[0];
    });
    res.json({ ok: true, data: {
      items: checked,
      summary: {
        checked: checked.length,
        available: checked.filter((item) => ['ok','fallback'].includes(item.health_status)).length,
        unverified: checked.filter((item) => item.health_status === 'provider').length,
        failed: checked.filter((item) => item.health_status === "failed").length,
        fallback: checked.filter((item) => item.health_status === "fallback").length
      }
    }});
  } catch (error) { next(error); }
};

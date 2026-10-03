import { pool } from "../database/db.js";
import {
  encryptXtreamSecret,
  loadXtreamCategories,
  loadXtreamStreams,
  normalizePlaybackPreferences,
  normalizeXtreamBaseUrl,
  validateXtreamAccount
} from "../services/xtream.service.js";

const MAX_IMPORT_SELECTION = 50;
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const providerRow = async (id) => {
  if (!/^[1-9]\d*$/.test(String(id))) throw fail("Proveedor Xtream inválido");
  const result = await pool.query("SELECT * FROM xtream_providers WHERE id=$1 AND activo", [id]);
  if (!result.rows[0]) throw fail("Proveedor Xtream no encontrado", 404);
  return result.rows[0];
};

const publicProvider = (row) => ({
  id: row.id,
  name: row.nombre,
  baseUrl: row.base_url,
  status: row.account_status,
  expiresAt: row.expires_at,
  maxConnections: row.max_connections,
  userAgent: row.user_agent || "",
  referer: row.referer || "",
  preferredOutput: row.preferred_output || "auto",
  active: row.activo,
  createdAt: row.fecha_creacion
});

export const listXtreamProviders = async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM xtream_providers WHERE activo ORDER BY fecha_creacion DESC, id DESC");
    res.json({ ok: true, data: result.rows.map(publicProvider) });
  } catch (error) { next(error); }
};

export const createXtreamProvider = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 120);
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (!name || !username || !password || username.length > 200 || password.length > 300) {
      throw fail("Completa nombre, servidor, usuario y contraseña");
    }
    const baseUrl = normalizeXtreamBaseUrl(req.body.baseUrl);
    const playback = normalizePlaybackPreferences(req.body);
    const account = await validateXtreamAccount({ baseUrl, username, password, ...playback });
    if (!account.status.toLowerCase().includes("active")) throw fail(`La cuenta Xtream está ${account.status}`, 409);
    const result = await pool.query(`INSERT INTO xtream_providers
      (nombre,base_url,username_encrypted,password_encrypted,account_status,expires_at,max_connections,
       user_agent,referer,preferred_output,activo)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE) RETURNING *`, [
      name,
      baseUrl,
      encryptXtreamSecret(username),
      encryptXtreamSecret(password),
      account.status,
      account.expiresAt,
      account.maxConnections || null,
      playback.userAgent,
      playback.referer,
      playback.preferredOutput
    ]);
    res.status(201).json({ ok: true, data: { provider: publicProvider(result.rows[0]), account } });
  } catch (error) { next(error); }
};

export const previewXtreamStreams = async (req, res, next) => {
  try {
    const provider = await providerRow(req.params.providerId);
    const [account, categories, streams] = await Promise.all([
      validateXtreamAccount(provider),
      loadXtreamCategories(provider),
      loadXtreamStreams(provider)
    ]);
    const categoryId = String(req.query.categoryId || "");
    const search = String(req.query.search || "").trim().toLocaleLowerCase("es").slice(0, 120);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const importedResult = await pool.query(
      "SELECT xtream_stream_id FROM live_channels WHERE xtream_provider_id=$1 AND xtream_stream_id IS NOT NULL",
      [provider.id]
    );
    const imported = new Set(importedResult.rows.map((row) => Number(row.xtream_stream_id)));
    const filtered = streams.filter((stream) =>
      (!categoryId || stream.categoryId === categoryId) &&
      (!search || stream.name.toLocaleLowerCase("es").includes(search))
    );
    res.json({
      ok: true,
      data: {
        provider: publicProvider(provider),
        account,
        categories,
        items: filtered.slice(offset, offset + limit).map((stream) => ({ ...stream, imported: imported.has(stream.streamId) })),
        pagination: { total: filtered.length, offset, limit, hasMore: offset + limit < filtered.length },
        limits: { maxSelection: MAX_IMPORT_SELECTION }
      }
    });
  } catch (error) { next(error); }
};

const slugPart = (value) => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "canales";

export const importXtreamStreams = async (req, res, next) => {
  try {
    const provider = await providerRow(req.params.providerId);
    const streamIds = Array.isArray(req.body.streamIds)
      ? [...new Set(req.body.streamIds.map(Number))]
      : [];
    if (!streamIds.length || streamIds.length > MAX_IMPORT_SELECTION || streamIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throw fail(`Selecciona entre 1 y ${MAX_IMPORT_SELECTION} canales`);
    }
    const [categories, streams] = await Promise.all([
      loadXtreamCategories(provider),
      loadXtreamStreams(provider)
    ]);
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const byId = new Map(streams.map((stream) => [stream.streamId, stream]));
    const selected = streamIds.map((id) => byId.get(id));
    if (selected.some((stream) => !stream)) throw fail("El catálogo Xtream cambió; vuelve a cargar los canales");

    const client = await pool.connect();
    const imported = [];
    try {
      await client.query("BEGIN");
      for (const stream of selected) {
        const categoryName = categoryNames.get(stream.categoryId) || `${provider.nombre} · TV`;
        const slug = `xtream-${provider.id}-${stream.categoryId || slugPart(categoryName)}`.slice(0, 120);
        const categoryResult = await client.query(`INSERT INTO categories(nombre,slug,tipo,activo)
          VALUES($1,$2,'tv',TRUE)
          ON CONFLICT(slug) DO UPDATE SET nombre=EXCLUDED.nombre,activo=TRUE
          RETURNING id`, [categoryName, slug]);
        const result = await client.query(`INSERT INTO live_channels
          (category_id,nombre,logo_url,manifest_url,drm_type,activo,stream_headers,source,source_channel_id,
           xtream_provider_id,xtream_stream_id,xtream_container)
          VALUES($1,$2,$3,NULL,'none',TRUE,'{}'::jsonb,$4,$5,$6,$7,$8)
          ON CONFLICT (xtream_provider_id,xtream_stream_id)
          WHERE xtream_provider_id IS NOT NULL AND xtream_stream_id IS NOT NULL
          DO UPDATE SET nombre=EXCLUDED.nombre,logo_url=EXCLUDED.logo_url,category_id=EXCLUDED.category_id,
            xtream_container=EXCLUDED.xtream_container,activo=TRUE
          RETURNING id,nombre`, [
          categoryResult.rows[0].id,
          stream.name,
          stream.logoUrl,
          `xtream:${provider.id}`,
          String(stream.streamId),
          provider.id,
          stream.streamId,
          stream.container
        ]);
        imported.push(result.rows[0]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
    res.status(201).json({ ok: true, data: { imported } });
  } catch (error) { next(error); }
};

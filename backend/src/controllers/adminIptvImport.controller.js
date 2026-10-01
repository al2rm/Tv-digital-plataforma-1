import { pool } from "../database/db.js";
import {
  IPTV_ORG_PARAGUAY_URL,
  IPTV_ORG_SOURCE,
  loadParaguayPlaylist,
  mapLimit,
  probeChannel
} from "../services/iptvOrg.service.js";

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const existingUrls = async () => new Set((await pool.query(
  "SELECT manifest_url FROM live_channels WHERE manifest_url IS NOT NULL"
)).rows.map((row) => row.manifest_url));

const publicChannel = (channel, existing) => ({
  sourceId: channel.sourceId,
  tvgId: channel.tvgId,
  name: channel.name,
  logoUrl: channel.logoUrl,
  group: channel.group,
  manifestHost: channel.manifestUrl ? new URL(channel.manifestUrl).hostname : null,
  compatible: channel.compatible,
  incompatibilityReason: channel.incompatibilityReason,
  hasCustomHeaders: Object.keys(channel.headers).length > 0,
  existing: channel.manifestUrl ? existing.has(channel.manifestUrl) : false
});

export const previewParaguayPlaylist = async (req, res, next) => {
  try {
    const [channels, existing] = await Promise.all([loadParaguayPlaylist(), existingUrls()]);
    const items = channels.map((channel) => publicChannel(channel, existing));
    res.json({
      ok: true,
      data: {
        source: { name: "iptv-org · Paraguay", url: IPTV_ORG_PARAGUAY_URL },
        items,
        summary: {
          total: items.length,
          importable: items.filter((item) => item.compatible && !item.existing).length,
          existing: items.filter((item) => item.existing).length,
          incompatible: items.filter((item) => !item.compatible).length
        }
      }
    });
  } catch (error) { next(error); }
};

export const importParaguayPlaylist = async (req, res, next) => {
  try {
    const sourceIds = Array.isArray(req.body.sourceIds) ? [...new Set(req.body.sourceIds)] : [];
    if (!sourceIds.length) throw fail("Selecciona al menos un canal");
    if (sourceIds.length > 100 || sourceIds.some((id) => typeof id !== "string" || !/^[a-f0-9]{32}$/.test(id))) {
      throw fail("La selección de canales no es válida");
    }

    const channels = await loadParaguayPlaylist();
    const byId = new Map(channels.map((channel) => [channel.sourceId, channel]));
    const selected = sourceIds.map((id) => byId.get(id));
    if (selected.some((channel) => !channel)) throw fail("La lista cambió; vuelve a abrir la vista previa");

    const existing = await existingUrls();
    const candidates = selected.filter((channel) => channel.compatible && !existing.has(channel.manifestUrl));
    const checks = await mapLimit(candidates, 8, async (channel) => ({
      channel,
      ...await probeChannel(channel)
    }));
    const available = checks.filter((check) => check.available).map((check) => check.channel);
    const unavailable = checks.filter((check) => !check.available).map((check) => ({
      sourceId: check.channel.sourceId,
      name: check.channel.name,
      reason: check.reason
    }));

    const client = await pool.connect();
    const imported = [];
    try {
      await client.query("BEGIN");
      const category = await client.query(`INSERT INTO categories(nombre,slug,tipo,activo)
        VALUES('Paraguay','paraguay','tv',TRUE)
        ON CONFLICT (slug) DO UPDATE SET activo=TRUE
        RETURNING id`);
      const categoryId = category.rows[0].id;
      for (const channel of available) {
        const result = await client.query(`INSERT INTO live_channels
          (category_id,nombre,logo_url,manifest_url,drm_type,activo,stream_headers,source,source_channel_id)
          SELECT $1,$2,$3,$4,'none',TRUE,$5::jsonb,$6,$7
          WHERE NOT EXISTS (SELECT 1 FROM live_channels WHERE manifest_url=$4)
          ON CONFLICT (source,source_channel_id) WHERE source IS NOT NULL AND source_channel_id IS NOT NULL
          DO NOTHING RETURNING id,nombre`, [
          categoryId,
          channel.name.slice(0, 180),
          channel.logoUrl,
          channel.manifestUrl,
          JSON.stringify(channel.headers),
          IPTV_ORG_SOURCE,
          channel.sourceId
        ]);
        if (result.rows[0]) imported.push(result.rows[0]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.status(201).json({
      ok: true,
      data: {
        imported,
        unavailable,
        skipped: selected.length - candidates.length + available.length - imported.length
      }
    });
  } catch (error) { next(error); }
};

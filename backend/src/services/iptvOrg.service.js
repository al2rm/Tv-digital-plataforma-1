import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const IPTV_ORG_PARAGUAY_URL = "https://iptv-org.github.io/iptv/countries/py.m3u";
export const IPTV_ORG_SOURCE = "iptv-org-py";

const fail = (message, statusCode = 502) => Object.assign(new Error(message), { statusCode });

const parseAttributes = (line) => {
  const attributes = {};
  const expression = /([\w-]+)="([^"]*)"/g;
  let match;
  while ((match = expression.exec(line))) attributes[match[1]] = match[2];
  return attributes;
};

const httpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
};

const sourceIdFor = (channel) => createHash("sha256")
  .update(`${channel.tvgId}\n${channel.manifestUrl}`)
  .digest("hex")
  .slice(0, 32);

export const parseM3u = (text) => {
  const channels = [];
  let current = null;

  for (const rawLine of String(text || "").replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const attributes = parseAttributes(line);
      const comma = line.indexOf(",");
      current = {
        tvgId: String(attributes["tvg-id"] || "").trim(),
        name: String(comma >= 0 ? line.slice(comma + 1) : attributes["tvg-name"] || "Canal sin nombre").trim(),
        logoUrl: httpsUrl(attributes["tvg-logo"] || ""),
        group: String(attributes["group-title"] || "Paraguay").trim() || "Paraguay",
        headers: {}
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("#EXTVLCOPT:http-referrer=")) {
      const referer = httpsUrl(line.slice("#EXTVLCOPT:http-referrer=".length));
      if (referer) current.headers.Referer = referer;
      continue;
    }
    if (line.startsWith("#EXTVLCOPT:http-user-agent=")) {
      const userAgent = line.slice("#EXTVLCOPT:http-user-agent=".length).trim().slice(0, 300);
      if (userAgent) current.headers["User-Agent"] = userAgent;
      continue;
    }
    if (line.startsWith("#")) continue;

    const manifestUrl = httpsUrl(line);
    const channel = {
      ...current,
      rawUrl: line,
      manifestUrl,
      compatible: Boolean(manifestUrl),
      incompatibilityReason: manifestUrl ? null : "La fuente no usa HTTPS o la URL no es válida"
    };
    channel.sourceId = sourceIdFor(channel);
    channels.push(channel);
    current = null;
  }

  return channels;
};

const readLimitedText = async (response, maxBytes) => {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw fail("La lista de IPTV supera el tamaño permitido");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw fail("La lista de IPTV supera el tamaño permitido");
  return buffer.toString("utf8");
};

export const loadParaguayPlaylist = async ({ fetchImpl = fetch } = {}) => {
  let response;
  try {
    response = await fetchImpl(IPTV_ORG_PARAGUAY_URL, {
      headers: { Accept: "audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    throw fail("No se pudo descargar la lista de Paraguay desde iptv-org");
  }
  if (!response.ok) throw fail(`iptv-org respondió con estado ${response.status}`);
  const text = await readLimitedText(response, 2 * 1024 * 1024);
  if (!text.trimStart().startsWith("#EXTM3U")) throw fail("iptv-org devolvió una lista M3U inválida");
  return parseM3u(text);
};

const isPrivateIpv4 = (address) => {
  const [a, b] = address.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
};

const isPrivateAddress = (address) => {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version !== 6) return true;
  const value = address.toLowerCase();
  if (value.startsWith("::ffff:")) return isPrivateIpv4(value.slice(7));
  return value === "::" || value === "::1" || value.startsWith("fc") ||
    value.startsWith("fd") || /^fe[89ab]/.test(value) || value.startsWith("ff");
};

export const assertPublicChannelUrl = async (value, { lookupImpl = lookup } = {}) => {
  const manifestUrl = httpsUrl(value);
  if (!manifestUrl) throw fail("La fuente no usa una URL HTTPS válida", 400);
  const { hostname } = new URL(manifestUrl);
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local") || lower.endsWith(".internal")) {
    throw fail("La fuente apunta a una red privada", 400);
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookupImpl(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw fail("La fuente apunta a una red privada", 400);
  }
  return manifestUrl;
};

const closeBody = async (response) => {
  try { await response.body?.cancel(); } catch { /* cuerpo ya cerrado */ }
};

export const probeChannel = async (channel, { fetchImpl = fetch, lookupImpl = lookup } = {}) => {
  try {
    const url = await assertPublicChannelUrl(channel.manifestUrl, { lookupImpl });
    const headers = { ...channel.headers };
    let response = await fetchImpl(url, {
      method: "HEAD",
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(5000)
    });
    await closeBody(response);
    if ([403, 405, 501].includes(response.status)) {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { ...headers, Range: "bytes=0-0" },
        redirect: "follow",
        signal: AbortSignal.timeout(5000)
      });
      await closeBody(response);
    }
    if (!response.ok) return { available: false, reason: `La fuente respondió ${response.status}` };
    return { available: true };
  } catch (error) {
    return { available: false, reason: error.statusCode === 400 ? error.message : "La fuente no respondió a tiempo" };
  }
};

export const mapLimit = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
};

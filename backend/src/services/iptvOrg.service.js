import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env } from "../config/env.js";

export const IPTV_ORG_COUNTRIES_URL = "https://iptv-org.github.io/api/countries.json";
export const IPTV_ORG_COUNTRY_BASE_URL = "https://iptv-org.github.io/iptv/countries";
export const IPTV_ORG_PARAGUAY_URL = `${IPTV_ORG_COUNTRY_BASE_URL}/py.m3u`;

const fail = (message, statusCode = 502) => Object.assign(new Error(message), { statusCode });

export const normalizeCountryCode = (value) => {
  const code = String(value || "").trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) throw fail("El país seleccionado no es válido", 400);
  return code;
};

export const countryPlaylistUrl = (countryCode) =>
  `${IPTV_ORG_COUNTRY_BASE_URL}/${normalizeCountryCode(countryCode)}.m3u`;

export const countrySource = (countryCode) => `iptv-org-${normalizeCountryCode(countryCode)}`;
export const trialCountrySource = (countryCode) => `iptv-org-trial-${normalizeCountryCode(countryCode)}`;

const parseAttributes = (line) => {
  const attributes = {};
  const expression = /([\w-]+)="([^"]*)"/g;
  let match;
  while ((match = expression.exec(line))) attributes[match[1]] = match[2];
  return attributes;
};

const metadataSeparator = (line) => {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    else if (line[index] === "," && !quoted) return index;
  }
  return -1;
};

const safeUrl = (value, allowHttp = env.allowHttpStreams) => {
  try {
    const url = new URL(value);
    const protocolAllowed = url.protocol === "https:" || (allowHttp && url.protocol === "http:");
    return protocolAllowed && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
};

const sourceIdFor = (channel) => createHash("sha256")
  .update(`${channel.tvgId}\n${channel.manifestUrl}`)
  .digest("hex")
  .slice(0, 32);

export const parseM3u = (text, { allowHttp = env.allowHttpStreams } = {}) => {
  const channels = [];
  let current = null;

  for (const rawLine of String(text || "").replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const attributes = parseAttributes(line);
      const comma = metadataSeparator(line);
      current = {
        tvgId: String(attributes["tvg-id"] || "").trim(),
        name: String(comma >= 0 ? line.slice(comma + 1) : attributes["tvg-name"] || "Canal sin nombre").trim(),
        logoUrl: safeUrl(attributes["tvg-logo"] || "", allowHttp),
        group: String(attributes["group-title"] || "Sin categoría").trim() || "Sin categoría",
        headers: {}
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("#EXTVLCOPT:http-referrer=")) {
      const referer = safeUrl(line.slice("#EXTVLCOPT:http-referrer=".length), allowHttp);
      if (referer) current.headers.Referer = referer;
      continue;
    }
    if (line.startsWith("#EXTVLCOPT:http-user-agent=")) {
      const userAgent = line.slice("#EXTVLCOPT:http-user-agent=".length).trim().slice(0, 300);
      if (userAgent) current.headers["User-Agent"] = userAgent;
      continue;
    }
    if (line.startsWith("#")) continue;

    const manifestUrl = safeUrl(line, allowHttp);
    const channel = {
      ...current,
      rawUrl: line,
      manifestUrl,
      compatible: Boolean(manifestUrl),
      incompatibilityReason: manifestUrl ? null : `La fuente no usa ${allowHttp?'HTTP/HTTPS':'HTTPS'} o la URL no es válida`
    };
    channel.sourceId = sourceIdFor(channel);
    channels.push(channel);
    current = null;
  }

  return channels;
};

const tvgCountryCode = (tvgId) => {
  const match = String(tvgId || "").match(/\.([a-z]{2})(?:@|$)/i);
  return match ? match[1].toLowerCase() : null;
};

const PAY_TV_BRAND = /\b(?:adult\s*swim|amc|disney|espn|fox\s*sports|hbo(?:\s+max)?|paramount|star\s*channel|tigo\s*sports|warner)\b/i;

export const trialEligibilityFor = (channel, countryCode) => {
  const expectedCountry = normalizeCountryCode(countryCode);
  if (!channel.compatible || !channel.manifestUrl) {
    return { eligible: false, reason: channel.incompatibilityReason || "La fuente no es compatible" };
  }
  if (new URL(channel.manifestUrl).protocol !== "https:") {
    return { eligible: false, reason: "La prueba pública admite únicamente señales HTTPS" };
  }
  if (tvgCountryCode(channel.tvgId) !== expectedCountry) {
    return { eligible: false, reason: "La señal no pertenece al país seleccionado" };
  }
  if (/\[geo-?blocked\]/i.test(channel.name)) {
    return { eligible: false, reason: "La señal está marcada como bloqueada geográficamente" };
  }
  if (PAY_TV_BRAND.test(`${channel.name} ${channel.group}`)) {
    return { eligible: false, reason: "La señal parece pertenecer a una marca de televisión paga" };
  }
  return { eligible: true, reason: null };
};

const readLimitedText = async (response, maxBytes, oversizeMessage = "La lista de IPTV supera el tamaño permitido") => {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw fail(oversizeMessage);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw fail(oversizeMessage);
  return buffer.toString("utf8");
};

const fetchLimitedText = async (url, maxBytes, { fetchImpl = fetch, accept = "text/plain" } = {}) => {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: accept },
      redirect: "follow",
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    throw fail("No se pudo descargar la información desde iptv-org");
  }
  if (!response.ok) throw fail(`iptv-org respondió con estado ${response.status}`);
  return readLimitedText(response, maxBytes);
};

export const loadCountryCatalog = async ({ fetchImpl = fetch } = {}) => {
  const text = await fetchLimitedText(IPTV_ORG_COUNTRIES_URL, 1024 * 1024, {
    fetchImpl,
    accept: "application/json"
  });
  let data;
  try { data = JSON.parse(text); } catch { throw fail("iptv-org devolvió un catálogo de países inválido"); }
  if (!Array.isArray(data)) throw fail("iptv-org devolvió un catálogo de países inválido");
  const displayNames = new Intl.DisplayNames(["es"], { type: "region" });
  return data
    .filter((country) => country && /^[A-Z]{2}$/.test(country.code || ""))
    .map((country) => ({
      code: country.code.toLowerCase(),
      name: displayNames.of(country.code) || country.name || country.code,
      flag: typeof country.flag === "string" ? country.flag : ""
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
};

export const loadCountryPlaylist = async (countryCode, { fetchImpl = fetch } = {}) => {
  const text = await fetchLimitedText(countryPlaylistUrl(countryCode), 5 * 1024 * 1024, {
    fetchImpl,
    accept: "audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain"
  });
  if (!text.trimStart().startsWith("#EXTM3U")) throw fail("iptv-org devolvió una lista M3U inválida");
  return parseM3u(text);
};

export const loadParaguayPlaylist = (options) => loadCountryPlaylist("py", options);

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

export const assertPublicChannelUrl = async (value, { lookupImpl = lookup, allowHttp = env.allowHttpStreams } = {}) => {
  const manifestUrl = safeUrl(value, allowHttp);
  if (!manifestUrl) throw fail(`La fuente no usa una URL ${allowHttp?'HTTP/HTTPS':'HTTPS'} válida`, 400);
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

const redirectStatus = (status) => [301, 302, 303, 307, 308].includes(status);

const fetchChannelManifest = async (channel, { fetchImpl, lookupImpl, allowHttp }) => {
  let url = await assertPublicChannelUrl(channel.manifestUrl, { lookupImpl, allowHttp });
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, audio/mpegurl, text/plain;q=0.8, */*;q=0.1",
        Range: "bytes=0-131071",
        ...channel.headers
      },
      redirect: "manual",
      signal: AbortSignal.timeout(7000)
    });
    if (!redirectStatus(response.status)) return { response, url };
    const location = response.headers.get("location");
    await closeBody(response);
    if (!location) throw fail("La fuente redirigió sin indicar un destino", 400);
    if (redirects === 3) throw fail("La fuente realizó demasiadas redirecciones", 400);
    url = await assertPublicChannelUrl(new URL(location, url).href, { lookupImpl, allowHttp });
  }
  throw fail("La fuente realizó demasiadas redirecciones", 400);
};

const validateHlsManifest = (text, manifestUrl, allowHttp) => {
  const normalized = String(text || "").replace(/\r/g, "").trim();
  if (!normalized.startsWith("#EXTM3U")) return "La respuesta no es un manifiesto HLS válido";

  const references = normalized.split("\n")
    .map((line) => line.trim())
    .flatMap((line) => {
      if (!line) return [];
      if (!line.startsWith("#")) return [line];
      return [...line.matchAll(/URI="([^"]+)"/g)].map((match) => match[1]);
    });
  if (!references.length) return "El manifiesto HLS no contiene variantes ni segmentos";

  for (const reference of references) {
    try {
      const protocol = new URL(reference, manifestUrl).protocol;
      if (!(protocol === "https:" || (allowHttp && protocol === "http:"))) {
        return `El manifiesto referencia contenido fuera de ${allowHttp?'HTTP/HTTPS':'HTTPS'}`;
      }
    } catch {
      return "El manifiesto HLS contiene una referencia inválida";
    }
  }
  return null;
};

export const probeChannel = async (channel, { fetchImpl = fetch, lookupImpl = lookup, allowHttp = env.allowHttpStreams } = {}) => {
  try {
    const { response, url } = await fetchChannelManifest(channel, { fetchImpl, lookupImpl, allowHttp });
    if (!response.ok) return { available: false, reason: `La fuente respondió ${response.status}` };
    const text = await readLimitedText(response, 128 * 1024, "El manifiesto supera el tamaño permitido");
    const reason = validateHlsManifest(text, url, allowHttp);
    return reason ? { available: false, reason } : { available: true };
  } catch (error) {
    return { available: false, reason: error.statusCode ? error.message : "La fuente no respondió a tiempo" };
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

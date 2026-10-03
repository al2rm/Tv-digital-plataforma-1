import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { assertPublicChannelUrl } from "./iptvOrg.service.js";

const MAX_JSON_BYTES = 30 * 1024 * 1024;
const ALLOWED_CONTAINERS = new Set(["ts", "m3u8"]);
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const encryptionKey = () => {
  if (!env.xtreamCredentialsKey || env.xtreamCredentialsKey.length < 16) {
    throw fail("Configura XTREAM_CREDENTIALS_KEY con una clave privada de al menos 16 caracteres", 503);
  }
  return createHash("sha256").update(env.xtreamCredentialsKey).digest();
};

export const encryptXtreamSecret = (value) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(":");
};

export const decryptXtreamSecret = (value) => {
  const [version, iv, tag, encrypted] = String(value || "").split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) throw fail("Las credenciales Xtream guardadas no son válidas", 500);
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw fail("No se pudieron descifrar las credenciales Xtream", 500);
  }
};

export const normalizeXtreamBaseUrl = (value) => {
  let url;
  try { url = new URL(String(value || "").trim()); } catch { throw fail("Servidor Xtream inválido"); }
  const allowed = url.protocol === "https:" || (env.allowHttpStreams && url.protocol === "http:");
  if (!allowed || url.username || url.password || url.search || url.hash) throw fail("Servidor Xtream inválido");
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href.replace(/\/$/, "");
};

const credentialsFrom = (provider) => ({
  baseUrl: normalizeXtreamBaseUrl(provider.base_url || provider.baseUrl),
  username: provider.username || decryptXtreamSecret(provider.username_encrypted),
  password: provider.password || decryptXtreamSecret(provider.password_encrypted)
});

const readJson = async (response) => {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_JSON_BYTES) throw fail("El catálogo Xtream supera el tamaño permitido", 502);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_JSON_BYTES) throw fail("El catálogo Xtream supera el tamaño permitido", 502);
  try { return JSON.parse(buffer.toString("utf8")); }
  catch { throw fail("El proveedor Xtream devolvió una respuesta inválida", 502); }
};

export const callXtreamApi = async (provider, action = "", { fetchImpl = fetch } = {}) => {
  const credentials = credentialsFrom(provider);
  const url = new URL(`${credentials.baseUrl}/player_api.php`);
  url.searchParams.set("username", credentials.username);
  url.searchParams.set("password", credentials.password);
  if (action) url.searchParams.set("action", action);
  await assertPublicChannelUrl(url.href, { allowHttp: env.allowHttpStreams });
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(25000)
    });
  } catch {
    throw fail("No se pudo conectar con el servidor Xtream", 502);
  }
  if (!response.ok) throw fail(`El servidor Xtream respondió ${response.status}`, 502);
  return readJson(response);
};

export const validateXtreamAccount = async (provider, options) => {
  const data = await callXtreamApi(provider, "", options);
  const user = data?.user_info || {};
  if (Number(user.auth) !== 1) throw fail("El servidor rechazó el usuario o la contraseña", 401);
  return {
    status: String(user.status || "Unknown"),
    expiresAt: /^\d+$/.test(String(user.exp_date || "")) && Number(user.exp_date) > 0
      ? new Date(Number(user.exp_date) * 1000).toISOString()
      : null,
    activeConnections: Number(user.active_cons || 0),
    maxConnections: Number(user.max_connections || 0),
    allowedFormats: Array.isArray(user.allowed_output_formats) ? user.allowed_output_formats : []
  };
};

export const loadXtreamCategories = async (provider, options) => {
  const data = await callXtreamApi(provider, "get_live_categories", options);
  if (!Array.isArray(data)) throw fail("El proveedor no devolvió categorías válidas", 502);
  return data.map((item) => ({
    id: String(item.category_id || ""),
    name: String(item.category_name || "Sin categoría").trim().slice(0, 120)
  })).filter((item) => /^\d+$/.test(item.id));
};

const safeLogo = (value) => {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};

export const loadXtreamStreams = async (provider, options) => {
  const data = await callXtreamApi(provider, "get_live_streams", options);
  if (!Array.isArray(data)) throw fail("El proveedor no devolvió canales válidos", 502);
  return data.map((item) => ({
    streamId: Number(item.stream_id),
    name: String(item.name || "Canal sin nombre").trim().slice(0, 180),
    logoUrl: safeLogo(item.stream_icon),
    categoryId: String(item.category_id || ""),
    container: ALLOWED_CONTAINERS.has(String(item.container_extension || "").toLowerCase())
      ? String(item.container_extension).toLowerCase()
      : "ts"
  })).filter((item) => Number.isSafeInteger(item.streamId) && item.streamId > 0 && item.name);
};

export const buildXtreamStreamUrl = (provider, streamId, container = "ts") => {
  const credentials = credentialsFrom(provider);
  const extension = ALLOWED_CONTAINERS.has(container) ? container : "ts";
  return `${credentials.baseUrl}/live/${encodeURIComponent(credentials.username)}/${encodeURIComponent(credentials.password)}/${streamId}.${extension}`;
};

export const signXtreamPlayback = ({ channelId, userId }) => jwt.sign(
  { purpose: "xtream-playback", channelId: String(channelId), userId: String(userId) },
  env.jwtSecret,
  { expiresIn: "2m" }
);

export const verifyXtreamPlayback = (token, channelId) => {
  try {
    const payload = jwt.verify(String(token || ""), env.jwtSecret);
    if (payload.purpose !== "xtream-playback" || String(payload.channelId) !== String(channelId)) throw new Error();
    return payload;
  } catch { throw fail("El enlace temporal de reproducción venció", 401); }
};


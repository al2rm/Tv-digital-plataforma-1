import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.ALLOW_HTTP_STREAMS = "true";
process.env.JWT_SECRET = "jwt-test-secret-long-enough";
process.env.XTREAM_CREDENTIALS_KEY = "xtream-test-secret-with-more-than-16-characters";

const {
  callXtreamApi,
  decryptXtreamSecret,
  encryptXtreamSecret,
  loadXtreamStreams,
  normalizePlaybackPreferences,
  normalizeXtreamBaseUrl,
  preferredXtreamContainer,
  providerPlaybackHeaders,
  validateXtreamAccount
} = await import("../src/services/xtream.service.js");

test("cifra y descifra credenciales Xtream", () => {
  const encrypted = encryptXtreamSecret("clave-temporal");
  assert.notEqual(encrypted, "clave-temporal");
  assert.equal(decryptXtreamSecret(encrypted), "clave-temporal");
});

test("normaliza las preferencias de reproducción autorizadas", () => {
  assert.deepEqual(normalizePlaybackPreferences({
    userAgent: "TV Digital Test/1.0",
    referer: "https://portal.example/player",
    preferredOutput: "m3u8"
  }), {
    userAgent: "TV Digital Test/1.0",
    referer: "https://portal.example/player",
    preferredOutput: "m3u8"
  });
  assert.deepEqual(providerPlaybackHeaders({ user_agent: "Agent", referer: "https://portal.example/" }), {
    "User-Agent": "Agent",
    Referer: "https://portal.example/"
  });
  assert.equal(preferredXtreamContainer({ preferred_output: "m3u8" }, "ts"), "m3u8");
  assert.equal(preferredXtreamContainer({ preferred_output: "auto" }, "ts"), "ts");
  assert.throws(() => normalizePlaybackPreferences({ userAgent: "bad\nheader" }), /no es válido/);
  assert.throws(() => normalizePlaybackPreferences({ referer: "javascript:alert(1)" }), /no es una URL/);
});

test("normaliza el servidor Xtream sin credenciales en la URL", () => {
  assert.equal(normalizeXtreamBaseUrl("http://8.8.8.8:8080/"), "http://8.8.8.8:8080");
  assert.throws(() => normalizeXtreamBaseUrl("http://user:pass@8.8.8.8"));
});

test("autentica la cuenta y normaliza canales del API Xtream", async () => {
  const provider = { baseUrl: "http://8.8.8.8", username: "demo", password: "secret" };
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("username"), "demo");
    assert.equal(url.searchParams.get("password"), "secret");
    const action = url.searchParams.get("action");
    const data = action === "get_live_streams"
      ? [{ stream_id: "42", name: "Canal demo", category_id: "7", container_extension: "ts" }]
      : { user_info: { auth: 1, status: "Active", exp_date: "1791032581", active_cons: "0", max_connections: "1", allowed_output_formats: ["m3u8", "ts"] } };
    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const account = await validateXtreamAccount(provider, { fetchImpl });
  assert.equal(account.status, "Active");
  assert.deepEqual(account.allowedFormats, ["m3u8", "ts"]);
  const streams = await loadXtreamStreams(provider, { fetchImpl });
  assert.deepEqual(streams[0], {
    streamId: 42,
    name: "Canal demo",
    logoUrl: null,
    categoryId: "7",
    container: "ts"
  });
});

test("rechaza respuestas que no son JSON", async () => {
  await assert.rejects(
    callXtreamApi(
      { baseUrl: "http://8.8.8.8", username: "demo", password: "secret" },
      "",
      { fetchImpl: async () => new Response("not-json", { status: 200 }) }
    ),
    /respuesta inválida/
  );
});

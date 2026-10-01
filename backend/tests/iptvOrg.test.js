import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPublicChannelUrl,
  countryPlaylistUrl,
  loadCountryCatalog,
  normalizeCountryCode,
  parseM3u,
  probeChannel
} from "../src/services/iptvOrg.service.js";

const playlist = `#EXTM3U
#EXTINF:-1 tvg-id="NPY.py@SD" tvg-logo="https://logos.test/npy.png" group-title="News",NPY (1080p)
#EXTVLCOPT:http-referrer=https://www.npy.com.py/
#EXTVLCOPT:http-user-agent=Prueba TV
https://video.test/npy/playlist.m3u8
#EXTINF:-1 tvg-id="inseguro",Canal HTTP
http://video.test/live.m3u8`;

test("interpreta canales, metadatos y cabeceras permitidas de una lista M3U", () => {
  const channels = parseM3u(playlist);
  assert.equal(channels.length, 2);
  assert.equal(channels[0].name, "NPY (1080p)");
  assert.equal(channels[0].logoUrl, "https://logos.test/npy.png");
  assert.deepEqual(channels[0].headers, {
    Referer: "https://www.npy.com.py/",
    "User-Agent": "Prueba TV"
  });
  assert.match(channels[0].sourceId, /^[a-f0-9]{32}$/);
  assert.equal(channels[1].compatible, false);
});

test("construye únicamente rutas de países válidas", () => {
  assert.equal(normalizeCountryCode("AR"), "ar");
  assert.equal(countryPlaylistUrl("BR"), "https://iptv-org.github.io/iptv/countries/br.m3u");
  assert.throws(() => countryPlaylistUrl("../../admin"), /país seleccionado/);
});

test("carga y traduce el catálogo de países de iptv-org", async () => {
  const countries = await loadCountryCatalog({
    fetchImpl: async () => new Response(JSON.stringify([
      { name: "Paraguay", code: "PY", flag: "🇵🇾" },
      { name: "Argentina", code: "AR", flag: "🇦🇷" },
      { name: "Invalid", code: "BAD" }
    ]), { status: 200, headers: { "Content-Type": "application/json" } })
  });
  assert.deepEqual(countries.map(({ code }) => code).sort(), ["ar", "py"]);
  assert.equal(countries.find(({ code }) => code === "py").name, "Paraguay");
});

test("bloquea destinos privados y permite un host público resuelto", async () => {
  await assert.rejects(
    assertPublicChannelUrl("https://localhost/live.m3u8"),
    /red privada/
  );
  const url = await assertPublicChannelUrl("https://video.test/live.m3u8", {
    lookupImpl: async () => [{ address: "8.8.8.8", family: 4 }]
  });
  assert.equal(url, "https://video.test/live.m3u8");
});

test("comprueba que la fuente devuelva un manifiesto HLS reproducible", async () => {
  const result = await probeChannel(parseM3u(playlist)[0], {
    lookupImpl: async () => [{ address: "8.8.8.8", family: 4 }],
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "manual");
      return new Response("#EXTM3U\n#EXT-X-TARGETDURATION:6\nsegment-1.ts", {
        status: 206,
        headers: { "Content-Type": "application/vnd.apple.mpegurl" }
      });
    }
  });
  assert.equal(result.available, true);
});

test("rechaza respuestas que no son HLS y segmentos que degradan a HTTP", async () => {
  const channel = parseM3u(playlist)[0];
  const lookupImpl = async () => [{ address: "8.8.8.8", family: 4 }];
  const invalid = await probeChannel(channel, {
    lookupImpl,
    fetchImpl: async () => new Response("<html>bloqueado</html>", { status: 200 })
  });
  assert.equal(invalid.available, false);
  assert.match(invalid.reason, /manifiesto HLS/);

  const insecure = await probeChannel(channel, {
    lookupImpl,
    fetchImpl: async () => new Response("#EXTM3U\nhttp://video.test/segment.ts", { status: 200 })
  });
  assert.equal(insecure.available, false);
  assert.match(insecure.reason, /sin HTTPS/);
});

test("valida cada redirección antes de seguirla", async () => {
  const channel = parseM3u(playlist)[0];
  const requests = [];
  const result = await probeChannel(channel, {
    lookupImpl: async (hostname) => [{
      address: hostname === "privado.test" ? "127.0.0.1" : "8.8.8.8",
      family: 4
    }],
    fetchImpl: async (url) => {
      requests.push(url);
      return new Response(null, { status: 302, headers: { Location: "https://privado.test/live.m3u8" } });
    }
  });
  assert.equal(result.available, false);
  assert.match(result.reason, /red privada/);
  assert.equal(requests.length, 1);
});

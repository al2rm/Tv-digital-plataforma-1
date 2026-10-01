import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPublicChannelUrl,
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

test("comprueba disponibilidad y reintenta con GET cuando HEAD no está permitido", async () => {
  const methods = [];
  const result = await probeChannel(parseM3u(playlist)[0], {
    lookupImpl: async () => [{ address: "8.8.8.8", family: 4 }],
    fetchImpl: async (_url, options) => {
      methods.push(options.method);
      return new Response(null, { status: options.method === "HEAD" ? 405 : 206 });
    }
  });
  assert.equal(result.available, true);
  assert.deepEqual(methods, ["HEAD", "GET"]);
});

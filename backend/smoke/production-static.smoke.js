import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const adminDistPath = path.resolve(currentDir, "../../admin/dist");

process.env.SERVE_ADMIN = "true";
process.env.ADMIN_DIST_PATH = adminDistPath;
process.env.RENDER_EXTERNAL_URL = "https://tv-digital-pro-demo-al2rm.onrender.com";
process.env.JWT_SECRET = "secreto-exclusivo-para-prueba-local-de-produccion";

const { default: app } = await import("../src/app.js");

test("sirve panel, rutas internas y API desde el mismo proceso", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const rootResponse = await fetch(`${baseUrl}/`);
  const rootHtml = await rootResponse.text();
  assert.equal(rootResponse.status, 200);
  assert.match(rootResponse.headers.get("content-type"), /text\/html/);
  assert.match(rootHtml, /<title>TV Digital Pro/);

  const internalRouteResponse = await fetch(`${baseUrl}/clientes`);
  const internalRouteHtml = await internalRouteResponse.text();
  assert.equal(internalRouteResponse.status, 200);
  assert.match(internalRouteHtml, /<title>TV Digital Pro/);

  const healthResponse = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: "https://tv-digital-pro-demo-al2rm.onrender.com"
    }
  });
  const health = await healthResponse.json();
  assert.equal(healthResponse.status, 200);
  assert.equal(health.ok, true);
  assert.equal(
    healthResponse.headers.get("access-control-allow-origin"),
    "https://tv-digital-pro-demo-al2rm.onrender.com"
  );

  const missingApiResponse = await fetch(`${baseUrl}/api/no-existe`);
  const missingApi = await missingApiResponse.json();
  assert.equal(missingApiResponse.status, 404);
  assert.equal(missingApi.ok, false);

  const assets = await fs.readdir(path.join(adminDistPath, "assets"));
  const javascriptFiles = assets.filter((filename) => filename.endsWith(".js"));
  assert.ok(javascriptFiles.length > 0);

  const javascript = await Promise.all(
    javascriptFiles.map((filename) =>
      fs.readFile(path.join(adminDistPath, "assets", filename), "utf8")
    )
  );
  assert.equal(javascript.some((content) => content.includes("localhost:3000")), false);
});

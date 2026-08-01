import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["src", "scripts", "tests"];
const files = [];

const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(fullPath);
    if (entry.isFile() && entry.name.endsWith(".js")) files.push(fullPath);
  }
};

for (const root of roots) {
  if (fs.existsSync(root)) visit(root);
}

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Sintaxis válida en ${files.length} archivos JavaScript.`);

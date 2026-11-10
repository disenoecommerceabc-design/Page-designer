import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  throw new Error("Instala Node.js 22.13 o posterior.");
}
const runtime = path.join(root, ".sites-runtime");
mkdirSync(runtime, { recursive: true });
writeFileSync(path.join(runtime, "execution-profile.json"),
  JSON.stringify({ executionProfile: "portable" }, null, 2));

function run(arguments_) {
  const result = spawnSync(process.execPath, arguments_, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(["scripts/run-framework.mjs", "build"]);

const config = path.join(runtime, "local-database.json");
writeFileSync(config, JSON.stringify({
  name: "page-builder-local",
  compatibility_date: "2026-05-15",
  d1_databases: [{
    binding: "DB",
    database_name: "site-creator-d1",
    database_id: "00000000-0000-4000-8000-000000000000",
    migrations_dir: path.join(root, "drizzle"),
  }],
}, null, 2));
run([
  "--import", "./scripts/sites-env.mjs",
  "./node_modules/wrangler/bin/wrangler.js",
  "d1", "migrations", "apply", "DB", "--local",
  "--config", config, "--persist-to", path.join(root, ".wrangler/state"),
]);
console.log("\nPreparación terminada. Ejecuta npm run dev y abre la URL indicada.");

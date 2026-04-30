import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSource = resolve(repoRoot, "..", "..", "pilio", "pilio-frontend", "public", "developers", "pilio-openapi.json");
const source = process.argv[2] ? resolve(process.argv[2]) : defaultSource;
const target = resolve(repoRoot, "openapi", "pilio-openapi.json");

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log(`Synced ${source} -> ${target}`);


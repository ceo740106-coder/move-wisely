import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const forbidden = [
  /xai_api_key/i,
  /better-auth/i,
  /neon/i,
  /pglite/i,
  /nitro\/vite/i,
  /vercel/i,
];
const skip = new Set(["node_modules", ".git", "dist", ".output", ".wrangler", "screenshots"]);

async function walk(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(ent.name)) continue;
    const path = join(dir, ent.name);
    if (ent.isDirectory()) await walk(path, out);
    else out.push(path);
  }
  return out;
}

const root = process.cwd();
const files = (await walk(root)).filter((file) => !file.endsWith("brand-check.mjs") && !file.endsWith("brand-check.test.mjs"));
const hits = [];
for (const file of files) {
  let content;
  try { content = await readFile(file, "utf8"); } catch { continue; }
  for (const rule of forbidden) if (rule.test(content)) hits.push(`${file}: ${rule}`);
}
if (hits.length) {
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log("Brand/security dependency scan passed.");

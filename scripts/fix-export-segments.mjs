// Next.js 16 static export writes per-segment navigation data for nested routes as folders,
// e.g. out/sales/detail/__next.sales/detail/__PAGE__.txt, but the client router requests the
// dotted name out/sales/detail/__next.sales.detail.__PAGE__.txt. Without this copy every
// client-side navigation 404s and falls back to a full page load (on Vercel and in the APK).
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("out");
let copied = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name === "_next") continue;
    if (entry.name.startsWith("__next.")) flatten(dir, full, entry.name);
    else walk(full);
  }
}

/** Copies every file below `segmentDir` to `<parent>/<segmentDir name>.<sub.path.parts>`. */
function flatten(parent, segmentDir, prefix) {
  for (const entry of fs.readdirSync(segmentDir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const rel = path.relative(segmentDir, path.join(entry.parentPath, entry.name));
    const target = path.join(parent, `${prefix}.${rel.split(path.sep).join(".")}`);
    if (!fs.existsSync(target)) {
      fs.copyFileSync(path.join(entry.parentPath, entry.name), target);
      copied++;
    }
  }
}

if (!fs.existsSync(OUT)) {
  console.error("fix-export-segments: no out/ folder (run next build first)");
  process.exit(1);
}
walk(OUT);
console.log(`fix-export-segments: added ${copied} segment file(s)`);

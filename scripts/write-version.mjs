// Writes out/version.json after the static export, so the deploy script can see when the new
// build is live. Vercel provides VERCEL_GIT_COMMIT_SHA during the build; locally, git is asked.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

let commit = process.env.VERCEL_GIT_COMMIT_SHA || null;
if (!commit) {
  try {
    commit = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    commit = null;
  }
}
writeFileSync("out/version.json", JSON.stringify({ commit, builtAt: new Date().toISOString() }) + "\n");
console.log(`write-version: ${commit ?? "unknown commit"}`);

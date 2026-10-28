import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Some serverless loaders cannot require an ES module from CommonJS, even
// when a developer's newer local Node version allows it. Check the actual
// Admin SDK entrypoints with that compatibility feature disabled.
const result = spawnSync(process.execPath, [
  "--no-experimental-require-module",
  "--input-type=module",
  "--eval",
  "await import('firebase-admin/auth'); await import('firebase-admin/firestore');",
], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  encoding: "utf8",
  timeout: 30000,
});
if (result.error || result.status !== 0) {
  process.stderr.write(result.stderr || result.error?.message || "Firebase Admin startup check failed.\n");
  process.exit(1);
}
console.log("Firebase Admin serverless cold-start check passed.");

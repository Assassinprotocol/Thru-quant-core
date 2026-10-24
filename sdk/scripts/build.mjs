import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SDK_ROOT = path.resolve(import.meta.dirname, "..");
const DIST_DIR = path.join(SDK_ROOT, "dist");

console.log("[BUILD] Compiling TypeScript SDK with tsc...");
execSync("npx tsc -p tsconfig.json", { cwd: SDK_ROOT, stdio: "inherit" });

// Create ESM .mjs alias
console.log("[BUILD] Creating ESM compatibility wrappers...");
fs.copyFileSync(path.join(DIST_DIR, "index.js"), path.join(DIST_DIR, "index.mjs"));

// Create Standalone Single-File Bundle
console.log("[BUILD] Assembling zero-dependency standalone bundle (thru-oracle.js)...");
const bundleHeader = `/**
 * @thru-quant/core-sdk v1.0.0 (Standalone Zero-Dependency Bundle)
 * Thru Quant Data & Risk Engine
 * Built for Thru Network (Node.js, Bun, Deno, Modern Browser)
 */
`;

const filesToBundle = ["types.js", "math.js", "decoder.js", "encoder.js", "guards.js", "client.js"];
let bundleContent = bundleHeader + "\n";

// Concatenate modules stripping internal module import statements
for (const file of filesToBundle) {
  const filePath = path.join(DIST_DIR, file);
  if (!fs.existsSync(filePath)) continue;
  let code = fs.readFileSync(filePath, "utf-8");
  // Remove import lines that point to internal ./ sibling files
  code = code.replace(/import\s+.*?from\s+["']\.\/.*?["'];?\n?/g, "");
  bundleContent += `// === Module: ${file} ===\n` + code + "\n";
}

fs.writeFileSync(path.join(DIST_DIR, "thru-oracle.js"), bundleContent, "utf-8");

console.log("[BUILD] Completed successfully! Deliverables in sdk/dist/:");
console.log("  - index.js (CommonJS / Node)");
console.log("  - index.mjs (ESM)");
console.log("  - index.d.ts (TypeScript declarations)");
console.log("  - thru-oracle.js (Standalone single-file bundle)");

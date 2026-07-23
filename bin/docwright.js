#!/usr/bin/env node
// Tenký spúšťač (Article VIII - žiadna vlastná build/register abstrakcia navyše).
// MVP beží priamo z TS zdrojov cez tsx; `npm run build` + spustenie z dist/ je
// budúca voľba, ak sa ukáže, že spúšťanie cez tsx je príliš pomalé v produkcii.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(__dirname, "../src/cli/generate.ts");

const child = spawn(
  process.execPath,
  ["--import", "tsx", entry, ...process.argv.slice(2)],
  { stdio: "inherit", cwd: path.resolve(__dirname, "..") },
);

child.on("exit", (code) => process.exit(code ?? 1));

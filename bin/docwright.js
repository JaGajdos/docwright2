#!/usr/bin/env node
// Tenký spúšťač (Article VIII - žiadna vlastná build/register abstrakcia navyše).
// MVP beží priamo z TS zdrojov cez tsx; `npm run build` + spustenie z dist/ je
// budúca voľba, ak sa ukáže, že spúšťanie cez tsx je príliš pomalé v produkcii.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const entry = path.resolve(projectRoot, "src/cli/generate.ts");

// REÁLNA CHYBA nájdená pri lokálnom testovaní (23.7.2026): spúšťač predtým nikdy
// nenačítal .env, takže `node bin/docwright.js ...` spustené priamo (bez ručne
// pridaného --env-file) vždy hlásilo "Chýba Azure OpenAI konfigurácia" aj keď
// .env bol správne vyplnený - premenné jednoducho neboli v process.env dieťaťa.
// Fix: ak .env existuje v roote projektu, pridaj --env-file (Node >=20.6, čo
// zodpovedá package.json engines). Ak .env neexistuje, nechaj to na child procese,
// aby chybu nahlásil čitateľne (Article V), nie tichý pád na --env-file ENOENT.
const envFile = path.resolve(projectRoot, ".env");
const envArgs = existsSync(envFile) ? [`--env-file=${envFile}`] : [];

const child = spawn(
  process.execPath,
  [...envArgs, "--import", "tsx", entry, ...process.argv.slice(2)],
  { stdio: "inherit", cwd: projectRoot },
);

child.on("exit", (code) => process.exit(code ?? 1));

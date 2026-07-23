import type { TemplateType } from "./types.js";

// Vylepšenie 24.7.2026 (užívateľské rozhodnutie): model doteraz dostával len
// abstraktné inštrukcie sekcií, žiadny konkrétny príklad štýlu/formátovania.
// Tieto few-shot príklady sú zámerne o FIKTÍVNYCH projektoch (nie o reálnej
// existujúcej knižnici) - slúžia výlučne ako referencia štýlu/štruktúry, nie
// ako zdroj faktov. promptBuilder.ts ich vkladá do system promptu s jasným
// upozornením, že ide len o vzor formátovania, nie dáta pre spracúvaný repozitár.

export const TEMPLATE_EXAMPLES: Record<TemplateType, string> = {
  library: `# acme-toolkit

Malá knižnica na validáciu a transformáciu vstupných dát v Node.js.

[![License](https://img.shields.io/github/license/example/acme-toolkit)](https://github.com/example/acme-toolkit/blob/main/LICENSE)
![Version](https://img.shields.io/github/package-json/v/example/acme-toolkit)

## Popis

\`acme-toolkit\` rieši opakujúci sa problém validácie vstupov naprieč viacerými
projektmi - namiesto vlastnej ad-hoc validačnej logiky v každom projekte
poskytuje jednotné, testované API.

## Inštalácia

\`\`\`sh
npm install acme-toolkit
\`\`\`

## Použitie

\`\`\`js
import {validate} from 'acme-toolkit';

const result = validate({email: 'test@example.com'}, {email: 'string'});
console.log(result.valid); // => true
\`\`\`

## API referencia

- \`validate(data, schema)\` — overí \`data\` oproti \`schema\`, vráti \`{valid, errors}\`.
- \`transform(data, rules)\` — aplikuje transformačné pravidlá na \`data\`.

## Licencia

MIT
`,

  cli: `# swiftline

Rýchly CLI nástroj na hromadné premenovanie súborov podľa vzoru.

## Inštalácia

\`\`\`sh
npm install -g swiftline
\`\`\`

## Použitie

\`\`\`sh
swiftline rename <vzor> [--options]
\`\`\`

## Príkazy

| Príkaz | Popis | Príklad |
|---|---|---|
| \`rename\` | Premenuje súbory podľa vzoru | \`swiftline rename "IMG_*.jpg" --to "photo_*.jpg"\` |
| \`preview\` | Zobrazí zmeny bez ich vykonania | \`swiftline preview "*.txt"\` |

## Licencia

MIT
`,

  app: `# taskboard

Jednoduchá webová aplikácia na správu úloh v tíme.

## Vlastnosti

- Kanban board s presúvaním úloh medzi stĺpcami
- Notifikácie pri priradení úlohy
- Export úloh do CSV

## Tech stack

React (frontend), Express (backend), PostgreSQL (dáta)

## Lokálne spustenie

\`\`\`sh
git clone https://github.com/example/taskboard.git
cd taskboard
npm install
cp .env.example .env
npm run dev
\`\`\`

## Licencia

MIT
`,

  api: `# notify-service

REST API na odosielanie e-mailových a SMS notifikácií.

## Tech stack

Node.js, Fastify, Redis (fronta)

## Lokálne spustenie

\`\`\`sh
docker compose up
\`\`\`

## API referencia

| Metóda | Cesta | Popis |
|---|---|---|
| \`POST\` | \`/notifications\` | Vytvorí a zaradí novú notifikáciu do fronty |
| \`GET\` | \`/notifications/:id\` | Vráti stav konkrétnej notifikácie |

## Autentifikácia

Bearer token v hlavičke \`Authorization\`.

## Licencia

MIT
`,
};

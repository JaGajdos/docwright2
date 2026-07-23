import type { Template } from "./types.js";

// Zdroj: templates.md. 4 first-class šablóny (Modul 3). Štruktúrované sekcie,
// nie voľný markdown blob - Article III (Constitution): kontraktový test vie
// overiť, že vygenerované README obsahuje všetky `required` sekcie.

export const LIBRARY_TEMPLATE: Template = {
  name: "library",
  type: "library",
  isDefault: true,
  sections: [
    { key: "title_tagline", required: true, instruction: "Názov + jedna veta, čo knižnica rieši.", sourceHint: "názov repa, manifest description" },
    { key: "badges", required: false, instruction: "Verzia, licencia, CI status.", sourceHint: "package.json.version, .github/workflows" },
    { key: "description", required: true, instruction: "2-4 vety: problém, ktorý knižnica rieši, prečo existuje.", sourceHint: "root manifest + README ak existuje" },
    { key: "installation", required: true, instruction: "Príkaz inštalácie z detegovaného manažéra.", sourceHint: "manifest" },
    { key: "usage", required: true, instruction: "Minimálny funkčný príklad kódu.", sourceHint: "entry point / test súbory" },
    { key: "api_reference", required: false, instruction: "Stručný zoznam verejných funkcií/tried a ich signatúr.", sourceHint: "exportované symboly z entry pointu" },
    { key: "requirements", required: false, instruction: "Min. verzia runtime, peer dependencies.", sourceHint: "manifest" },
    { key: "contributing", required: false, instruction: "Odkaz na CONTRIBUTING.md ak existuje, inak jedna veta.", sourceHint: "detekcia existujúcich docs", skipIf: "žiadny CONTRIBUTING súbor a žiadny README zmienka" },
    { key: "license", required: true, instruction: "Názov licencie.", sourceHint: "LICENSE/LICENSE.md súbor", skipIf: "žiadny LICENSE súbor" },
  ],
};

export const CLI_TEMPLATE: Template = {
  name: "cli",
  type: "cli",
  isDefault: false,
  sections: [
    { key: "title_tagline", required: true, instruction: "Názov + jedna veta.", sourceHint: "manifest description" },
    { key: "installation", required: true, instruction: "Globálna inštalácia (npm install -g, pip install, brew ak Formula/ existuje).", sourceHint: "manifest" },
    { key: "usage_pattern", required: true, instruction: "Vzor volania: nastroj <prikaz> [--options].", sourceHint: "bin pole / entry point" },
    { key: "commands_table", required: true, instruction: "Tabuľka: príkaz, popis, príklad.", sourceHint: "zdrojový kód CLI parseru" },
    { key: "configuration", required: false, instruction: "Env premenné / config súbor, ak detegované.", sourceHint: ".env.example, config loader v kóde", skipIf: "žiadny config loader ani .env.example" },
    { key: "examples", required: false, instruction: "2-3 bežné workflow scenáre.", sourceHint: "README ak existuje, inak odvodené z testov" },
    { key: "license", required: true, instruction: "Názov licencie.", sourceHint: "LICENSE", skipIf: "žiadny LICENSE súbor" },
  ],
};

export const APP_TEMPLATE: Template = {
  name: "app",
  type: "app",
  isDefault: false,
  sections: [
    { key: "title_tagline", required: true, instruction: "Názov + jedna veta o účele appky.", sourceHint: "manifest/README" },
    { key: "features", required: true, instruction: "Bullet zoznam kľúčových vlastností.", sourceHint: "odvodené z hlavných route/komponentov" },
    { key: "tech_stack", required: true, instruction: "Zoznam detegovaných technológií.", sourceHint: "Modul 1 výstup" },
    { key: "local_setup", required: true, instruction: "Kroky: clone -> install -> env -> run (presne príkazy).", sourceHint: "package.json.scripts, Makefile, docker-compose.yml" },
    { key: "architecture_link", required: false, instruction: "Odkaz/embed na vygenerovaný Mermaid diagram.", sourceHint: "GenerationResult.architecture_diagram" },
    { key: "contributing", required: false, instruction: "Ako ostatné šablóny.", sourceHint: "detekcia", skipIf: "žiadny CONTRIBUTING súbor" },
    { key: "license", required: true, instruction: "Názov licencie.", sourceHint: "LICENSE", skipIf: "žiadny LICENSE súbor" },
  ],
};

export const API_TEMPLATE: Template = {
  name: "api",
  type: "api",
  isDefault: false,
  sections: [
    { key: "title_tagline", required: true, instruction: "Názov + jedna veta o účele služby.", sourceHint: "manifest/README" },
    { key: "tech_stack", required: true, instruction: "Framework + jazyk.", sourceHint: "Modul 1 výstup" },
    { key: "local_setup", required: true, instruction: "Spustenie lokálne vrátane env premenných, docker-compose ak existuje.", sourceHint: "manifest, docker-compose" },
    { key: "api_reference", required: true, instruction: "Tabuľka endpointov: metóda, cesta, stručný popis.", sourceHint: "openapi.yaml ak existuje, inak detegované route definície" },
    { key: "authentication", required: false, instruction: "Spôsob autentifikácie, ak detegovaný (API key/OAuth/JWT).", sourceHint: "route/middleware kód", skipIf: "žiadna auth logika detegovaná" },
    { key: "architecture_link", required: false, instruction: "Odkaz na diagram.", sourceHint: "GenerationResult.architecture_diagram" },
    { key: "license", required: true, instruction: "Názov licencie.", sourceHint: "LICENSE", skipIf: "žiadny LICENSE súbor" },
  ],
};

export const ALL_TEMPLATES: Template[] = [LIBRARY_TEMPLATE, CLI_TEMPLATE, APP_TEMPLATE, API_TEMPLATE];

export function getTemplateByType(type: Template["type"]): Template {
  const found = ALL_TEMPLATES.find((t) => t.type === type);
  if (!found) throw new Error(`Neznáma šablóna: ${type}`);
  return found;
}

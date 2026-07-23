import type { Template } from "../templates/types.js";
import { TEMPLATE_EXAMPLES } from "../templates/examples.js";

/** Kontext, ktorý Ingestion knižnica (T017-T019) pripraví pre jeden generation job. */
export interface GenerationContext {
  owner: string;
  repo: string;
  fileTree: string[];
  /** Cesta -> obsah, len root manifesty + heuristicky vybrané entry-pointy (research.md #3, #5). */
  keyFileContents: Record<string, string>;
  existingReadme?: string;
  detectedStack: string[];
  /**
   * Vylepšenie 24.7.2026: hotový badge markdown poskladaný programaticky z overiteľných
   * signálov (src/generation/badges.ts) - žiadne halucinované badge URL-ky (Article III).
   * Undefined = žiadny overiteľný signál -> sekcia "badges" sa v prompte úplne vynechá.
   */
  badgesMarkdown?: string;
}

/**
 * Zostaví system + user prompt presne podľa research.md (sekcia 3): repo metadata,
 * orezaný file tree, obsah manifestov, existujúci README, šablónové sekcie ako
 * záväzný kontrakt výstupu (žiadna sekcia sa nevypĺňa vymyslenou hodnotou - Article III).
 */
export function buildGenerationPrompt(context: GenerationContext, template: Template) {
  const sectionsSpec = template.sections
    .map((s) => {
      // Vylepšenie 24.7.2026: sekcia "badges" nikdy nesmie byť vyplnená hádaním modelu -
      // buď dostane presne pripravený, overený markdown, alebo sa úplne vynechá.
      if (s.key === "badges") {
        if (context.badgesMarkdown) {
          return `- badges [voliteľná]: POUŽI PRESNE tento pripravený markdown, doslovne, nič nepridávaj ani si nevymýšľaj ďalšie badge: ${context.badgesMarkdown}`;
        }
        return `- badges [voliteľná]: Žiadne overené badge dáta nie sú k dispozícii -> sekciu úplne vynechaj, aj nadpis, nehádaj hodnotu ani neponúkaj placeholder badge.`;
      }
      const skip = s.skipIf ? ` (Ak: ${s.skipIf} -> sekciu úplne vynechaj, aj nadpis, nehádaj hodnotu.)` : "";
      return `- ${s.key}${s.required ? " [POVINNÁ]" : " [voliteľná]"}: ${s.instruction} Zdroj dát: ${s.sourceHint}.${skip}`;
    })
    .join("\n");

  // Vylepšenie 24.7.2026: few-shot príklad štýlu pre daný typ šablóny (o fiktívnom
  // projekte - slúži len ako referencia formátovania/tónu, nie ako zdroj faktov
  // pre spracúvaný repozitár).
  const example = TEMPLATE_EXAMPLES[template.type];

  const system = [
    "Si súčasť DocWiright - nástroja, ktorý generuje README a architektonický diagram pre GitHub repozitáre.",
    "Musíš vrátiť presne tri polia: readme_markdown, architecture_diagram (Mermaid syntax, napr. 'flowchart TD'), summary.",
    "VŠETKY tri polia sú POVINNÉ a musia byť neprázdne reťazce v každej odpovedi - toto pravidlo sa vzťahuje na celé pole readme_markdown a na summary, nie na jednotlivé sekcie README (tie voliteľné sekcie môžeš vynechať, viď nižšie). summary je vždy 1-3 vety zhrňujúce repozitár, aj keď je README stručné - nikdy nesmie byť prázdny reťazec.",
    "README skladaj presne z týchto sekcií, v tomto poradí. Nikdy nevypĺňaj sekciu vymyslenou hodnotou - ak dáta chýbajú, danú (voliteľnú) sekciu aj s nadpisom vynechaj, ale readme_markdown ako celok nesmie byť prázdny.",
    sectionsSpec,
    `PRÍKLAD DOBRÉHO VÝSTUPU (len referencia štýlu/formátovania/tónu pre tento typ projektu - je o FIKTÍVNOM projekte, NEPOUŽÍVAJ jeho názov, popis ani žiadne fakty z neho, len napodobni formu):\n${example}`,
  ].join("\n\n");

  const user = [
    `Repozitár: ${context.owner}/${context.repo}`,
    `Detegovaný stack: ${context.detectedStack.join(", ") || "neznámy"}`,
    `File tree (orezaný):\n${context.fileTree.slice(0, 500).join("\n")}`,
    context.existingReadme
      ? `Existujúci README (zohľadni ho, neopakuj doslovne):\n${context.existingReadme.slice(0, 3000)}`
      : "Repozitár nemá existujúci README.",
    "Kľúčové súbory:",
    ...Object.entries(context.keyFileContents).map(
      ([path, content]) => `--- ${path} ---\n${content.slice(0, 2000)}`,
    ),
  ].join("\n\n");

  return { system, user };
}

/** Ak Mermaid diagram zlyhá validáciou, pošleme model chybu späť na jeden opravný pokus (research.md #4). */
export function buildMermaidFixPrompt(previousDiagram: string, errorMessage: string): string {
  return [
    "Predchádzajúci Mermaid diagram nie je syntakticky platný. Oprav ho a vráť len opravenú verziu v poli architecture_diagram.",
    `Pôvodný diagram:\n${previousDiagram}`,
    `Chyba parsera:\n${errorMessage}`,
  ].join("\n\n");
}

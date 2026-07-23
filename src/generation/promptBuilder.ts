import type { Template } from "../templates/types.js";

/** Kontext, ktorý Ingestion knižnica (T017-T019) pripraví pre jeden generation job. */
export interface GenerationContext {
  owner: string;
  repo: string;
  fileTree: string[];
  /** Cesta -> obsah, len root manifesty + heuristicky vybrané entry-pointy (research.md #3, #5). */
  keyFileContents: Record<string, string>;
  existingReadme?: string;
  detectedStack: string[];
}

/**
 * Zostaví system + user prompt presne podľa research.md (sekcia 3): repo metadata,
 * orezaný file tree, obsah manifestov, existujúci README, šablónové sekcie ako
 * záväzný kontrakt výstupu (žiadna sekcia sa nevypĺňa vymyslenou hodnotou - Article III).
 */
export function buildGenerationPrompt(context: GenerationContext, template: Template) {
  const sectionsSpec = template.sections
    .map((s) => {
      const skip = s.skipIf ? ` (Ak: ${s.skipIf} -> sekciu úplne vynechaj, aj nadpis, nehádaj hodnotu.)` : "";
      return `- ${s.key}${s.required ? " [POVINNÁ]" : " [voliteľná]"}: ${s.instruction} Zdroj dát: ${s.sourceHint}.${skip}`;
    })
    .join("\n");

  const system = [
    "Si súčasť DocWiright - nástroja, ktorý generuje README a architektonický diagram pre GitHub repozitáre.",
    "Musíš vrátiť presne tri polia: readme_markdown, architecture_diagram (Mermaid syntax, napr. 'flowchart TD'), summary.",
    "README skladaj presne z týchto sekcií, v tomto poradí. Nikdy nevypĺňaj sekciu vymyslenou hodnotou - ak dáta chýbajú, sekciu (aj s nadpisom) vynechaj.",
    sectionsSpec,
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

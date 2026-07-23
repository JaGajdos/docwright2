// Manuálny smoke test Azure OpenAI wiring bez závislosti na GitHub tokene
// (kým ten nemáme, ingestion sa nedá reálne otestovať end-to-end - toto
// aspoň overí generation vrstvu s reálnymi Azure OpenAI kredenciálmi).
//
// Spustenie: node --env-file=.env --import tsx scripts/smoke-azure.mts
import { generateDocumentation, loadAzureConfigFromEnv } from "../src/generation/openaiClient.js";
import { LIBRARY_TEMPLATE } from "../src/templates/templates.js";
import type { GenerationContext } from "../src/generation/promptBuilder.js";

const cfg = loadAzureConfigFromEnv();
if (!cfg) {
  console.error("Chyba: Azure config sa nenačítala z env (.env)");
  process.exit(1);
}
console.error("Azure config OK, deployment:", cfg.deployment, "endpoint:", cfg.endpoint);

const context: GenerationContext = {
  owner: "sindresorhus",
  repo: "is-stream",
  fileTree: ["index.js", "index.d.ts", "package.json", "readme.md", "license"],
  keyFileContents: {
    "package.json": JSON.stringify({
      name: "is-stream",
      version: "4.0.1",
      description: "Check if something is a Node.js stream",
    }),
    "index.js":
      "export function isStream(stream) { return stream !== null && typeof stream === 'object' && typeof stream.pipe === 'function'; }",
  },
  existingReadme: undefined,
  detectedStack: ["Node.js/JavaScript"],
};

try {
  const outcome = await generateDocumentation(cfg, context, LIBRARY_TEMPLATE);
  console.log("=== SUCCESS ===");
  console.log("model:", outcome.modelId, "mermaidRepaired:", outcome.mermaidRepaired);
  console.log("--- README (prvých 500 znakov) ---");
  console.log(outcome.result.readme_markdown.slice(0, 500));
  console.log("--- DIAGRAM ---");
  console.log(outcome.result.architecture_diagram);
} catch (err) {
  console.error("=== FAILED ===");
  console.error(err);
  process.exit(1);
}

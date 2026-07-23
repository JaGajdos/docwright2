#!/usr/bin/env node
import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { GithubMcpClientError } from "../ingestion/githubMcpClient.js";
import { loadAzureConfigFromEnv, GenerationError } from "../generation/openaiClient.js";
import { runGeneration } from "../core/runGeneration.js";
import type { TemplateType } from "../templates/types.js";

// T025 (tasks.md) - `docwright generate <url>` prepája ingestion -> config -> template -> generation.
// Article II (CLI mandate): web vrstva (src/server.ts, pridané pri verejnom nasadení
// 23.7.2026) je tenká obálka nad tým istým src/core/runGeneration.ts jadrom.

async function main() {
  const program = new Command();
  program
    .name("docwright")
    .description("Vygeneruje README a architecture diagram pre verejný GitHub repozitár.")
    .argument("<repo_url>", "URL alebo owner/repo verejného GitHub repozitára")
    .option("--json", "Vypíše výsledok ako JSON namiesto Markdown", false)
    .option("-o, --output <file>", "Zapíše README do súboru namiesto stdout")
    .option("--template <type>", "Vynúti šablónu (library|cli|app|api), inak auto-detekcia + .docwright.json")
    .action(async (repoUrlArg: string, opts: { json: boolean; output?: string; template?: string }) => {
      // Celé telo je v try/catch - Article III/V: každé zlyhanie musí byť čitateľné,
      // nikdy tiché ukončenie s exit 0 (bug nájdený a opravený pri smoke teste 23.7.2026).
      try {
        const azureConfig = loadAzureConfigFromEnv();
        if (!azureConfig) {
          throw new Error(
            "Chýba Azure OpenAI konfigurácia (AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT). Skopíruj .env.example do .env a vyplň ho.",
          );
        }

        console.error(`Ingestujem ${repoUrlArg}...`);
        const outcome = await runGeneration(repoUrlArg, {
          githubToken: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
          azureConfig,
          templateOverride: opts.template as TemplateType | undefined,
        });

        if (outcome.configParseWarning) {
          console.error(`Upozornenie: ${outcome.configParseWarning} - ignorujem .docwright.json, pokračujem s auto-detekciou.`);
        }
        console.error(`Šablóna: ${outcome.templateType} (${outcome.templateSource === "override" ? "vynútené --template" : outcome.templateSource === "config" ? "z .docwright.json" : "auto-detekcia"})`);
        console.error(`Generujem cez Azure OpenAI (deployment: ${outcome.modelId})...`);

        if (opts.output) {
          await writeFile(opts.output, outcome.result.readme_markdown, "utf-8");
          console.error(`README zapísané do ${opts.output}`);
        }

        if (opts.json) {
          console.log(JSON.stringify({
            repository: `${outcome.owner}/${outcome.repo}`,
            template: outcome.templateType,
            model_id: outcome.modelId,
            mermaid_repaired: outcome.mermaidRepaired,
            ...outcome.result,
          }, null, 2));
        } else if (!opts.output) {
          console.log(outcome.result.readme_markdown);
          console.log("\n```mermaid\n" + outcome.result.architecture_diagram + "\n```");
        }
      } catch (err) {
        handleFatalError(err);
      }
    });

  await program.parseAsync(process.argv);
}

function handleFatalError(err: unknown): never {
  if (err instanceof GithubMcpClientError) {
    console.error(`[${err.errorCode}] ${err.message}`);
  } else if (err instanceof GenerationError) {
    console.error(`[${err.errorCode}] ${err.message}`);
  } else {
    console.error(err instanceof Error ? err.message : String(err));
  }
  process.exitCode = 1;
  throw err;
}

main().catch(() => {
  // handleFatalError už vypísal a nastavil exitCode; tu len zabránime unhandled rejection logu.
});

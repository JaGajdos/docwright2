#!/usr/bin/env node
import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { GithubMcpClient, GithubMcpClientError } from "../ingestion/githubMcpClient.js";
import { ingestRepository } from "../ingestion/repository.js";
import { parseDocwrightConfig, resolveTemplateType, applyIgnoreList } from "../config/docwrightConfig.js";
import { selectTemplateType } from "../templates/selectTemplate.js";
import { getTemplateByType } from "../templates/templates.js";
import { generateDocumentation, GenerationError } from "../generation/openaiClient.js";

// T025 (tasks.md) - `docwright generate <url>` prepája ingestion -> config -> template -> generation.
// Article II (CLI mandate): web/API vrstva bude v budúcnosti len tenká obálka nad týmto istým kódom.

interface ParsedRepoUrl {
  owner: string;
  repo: string;
}

function parseRepoUrl(input: string): ParsedRepoUrl {
  const match = input.match(/github\.com\/([^/]+)\/([^/.]+)/) ?? input.match(/^([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new Error(`Nerozpoznateľná GitHub URL/owner/repo: "${input}". Očakávam napr. https://github.com/owner/repo alebo owner/repo.`);
  }
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

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
      let client: GithubMcpClient | undefined;
      try {
        const { owner, repo } = parseRepoUrl(repoUrlArg);

        const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) {
          throw new Error("Chýba OPENAI_API_KEY v prostredí. Skopíruj .env.example do .env a vyplň ho.");
        }

        client = new GithubMcpClient({ githubToken });
        await client.connect();

        console.error(`Ingestujem ${owner}/${repo}...`);
        const { signals, context, docwrightConfigRaw } = await ingestRepository(client, owner, repo);

        const { config, parseError } = parseDocwrightConfig(docwrightConfigRaw);
        if (parseError) {
          console.error(`Upozornenie: ${parseError} - ignorujem .docwright.json, pokračujem s auto-detekciou.`);
        }

        context.fileTree = applyIgnoreList(context.fileTree, config);

        const autoDetected = selectTemplateType(signals);
        const templateType = (opts.template as ReturnType<typeof selectTemplateType>) ?? resolveTemplateType(autoDetected, config);
        const template = getTemplateByType(templateType);

        console.error(`Šablóna: ${templateType} (${opts.template ? "vynútené --template" : config.template ? "z .docwright.json" : "auto-detekcia"})`);
        console.error("Generujem cez OpenAI...");

        const outcome = await generateDocumentation(openaiKey, context, template);

        if (opts.output) {
          await writeFile(opts.output, outcome.result.readme_markdown, "utf-8");
          console.error(`README zapísané do ${opts.output}`);
        }

        if (opts.json) {
          console.log(JSON.stringify({
            repository: `${owner}/${repo}`,
            template: templateType,
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
      } finally {
        await client?.close();
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

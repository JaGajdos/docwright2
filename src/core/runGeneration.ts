import { GithubMcpClient } from "../ingestion/githubMcpClient.js";
import { ingestRepository } from "../ingestion/repository.js";
import { parseDocwrightConfig, resolveTemplateType, applyIgnoreList } from "../config/docwrightConfig.js";
import { selectTemplateType } from "../templates/selectTemplate.js";
import { getTemplateByType } from "../templates/templates.js";
import { generateDocumentation, type AzureOpenAiConfig } from "../generation/openaiClient.js";
import { DEFAULT_OUTPUT_LANGUAGE, type OutputLanguage } from "../generation/promptBuilder.js";
import type { GenerationResultShape } from "../generation/schema.js";
import type { TemplateType } from "../templates/types.js";

// T-web-01: zdieľané jadro medzi CLI (src/cli/generate.ts) a HTTP serverom
// (src/server.ts) - Article II/VIII: web vrstva je len tenká obálka nad tým
// istým kódom, nie duplicitná reimplementácia. Extrahované 23.7.2026 pri
// príprave verejného nasadenia.

export interface ParsedRepoUrl {
  owner: string;
  repo: string;
}

export function parseRepoUrl(input: string): ParsedRepoUrl {
  const match = input.match(/github\.com\/([^/]+)\/([^/.]+)/) ?? input.match(/^([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new Error(
      `Nerozpoznateľná GitHub URL/owner/repo: "${input}". Očakávam napr. https://github.com/owner/repo alebo owner/repo.`,
    );
  }
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export interface RunGenerationOptions {
  githubToken?: string;
  azureConfig: AzureOpenAiConfig;
  templateOverride?: TemplateType;
  /** Vylepšenie 24.7.2026 (užívateľské rozhodnutie): jazyk vygenerovaného README/summary/diagramu. */
  outputLanguage?: OutputLanguage;
}

export interface RunGenerationResult {
  owner: string;
  repo: string;
  templateType: TemplateType;
  templateSource: "override" | "config" | "auto";
  modelId: string;
  mermaidRepaired: boolean;
  configParseWarning?: string;
  result: GenerationResultShape;
}

/**
 * Ingestion -> config -> template -> generation, presne v tomto poradí (Article IX -
 * deterministický priebeh, nie voľný agentický tool-calling). Volajúci (CLI alebo
 * HTTP handler) zodpovedá za vytvorenie/uzavretie GithubMcpClient session a za
 * mapovanie vyhodených chýb (GithubMcpClientError/GenerationError) na svoj vlastný
 * výstupný formát (exit code vs. HTTP status).
 */
export async function runGeneration(repoInput: string, opts: RunGenerationOptions): Promise<RunGenerationResult> {
  const { owner, repo } = parseRepoUrl(repoInput);

  const client = new GithubMcpClient({ githubToken: opts.githubToken });
  try {
    await client.connect();

    const { signals, context, docwrightConfigRaw } = await ingestRepository(client, owner, repo);

    const { config, parseError } = parseDocwrightConfig(docwrightConfigRaw);

    context.fileTree = applyIgnoreList(context.fileTree, config);

    const autoDetected = selectTemplateType(signals);
    const templateType = opts.templateOverride ?? resolveTemplateType(autoDetected, config);
    const template = getTemplateByType(templateType);

    const outcome = await generateDocumentation(
      opts.azureConfig,
      context,
      template,
      opts.outputLanguage ?? DEFAULT_OUTPUT_LANGUAGE,
    );

    return {
      owner,
      repo,
      templateType,
      templateSource: opts.templateOverride ? "override" : config.template ? "config" : "auto",
      modelId: outcome.modelId,
      mermaidRepaired: outcome.mermaidRepaired,
      configParseWarning: parseError,
      result: outcome.result,
    };
  } finally {
    await client.close();
  }
}

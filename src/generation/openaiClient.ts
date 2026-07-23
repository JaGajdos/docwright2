import { AzureOpenAI } from "openai";
import type { Template } from "../templates/types.js";
import { GenerationResultSchema, GENERATION_RESULT_JSON_SCHEMA, type GenerationResultShape } from "./schema.js";
import { buildGenerationPrompt, buildMermaidFixPrompt, type GenerationContext } from "./promptBuilder.js";
import { validateMermaidDiagram } from "./mermaidValidate.js";

// research.md sekcia 2 (revidované 23.7.2026 - Azure OpenAI, nie priame OpenAI API):
// Aston HCT má vlastný Azure OpenAI resource s nasadeným GPT-5.6 Terra ("T1-gpt-5.6-terra"
// deployment). AzureOpenAI klient smeruje na endpoint/deployment namiesto api.openai.com,
// volanie ide cez Responses API (nie Chat Completions - endpoint končí na /openai/responses).
export interface AzureOpenAiConfig {
  apiKey: string;
  endpoint: string;
  apiVersion: string;
  deployment: string;
}

export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly errorCode: "invalid_output_schema" | "mermaid_invalid_after_retry" | "openai_error",
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

export interface GenerationOutcome {
  result: GenerationResultShape;
  modelId: string;
  templateVersion: string;
  mermaidRepaired: boolean;
}

/** Číta Azure OpenAI konfiguráciu z env premenných (.env) - viď .env.example. */
export function loadAzureConfigFromEnv(): AzureOpenAiConfig | undefined {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview";
  if (!apiKey || !endpoint || !deployment) return undefined;
  return { apiKey, endpoint, deployment, apiVersion };
}

/**
 * Volá Azure OpenAI (Responses API) so štruktúrovaným výstupom (research.md #3), overí
 * JSON schémou (zod) a Mermaid diagram reálnym parserom (research.md #4) - jeden opravný
 * pokus, potom GenerationError(mermaid_invalid_after_retry) - CLI to zachytáva a vráti
 * README bez diagramu namiesto tvrdého pádu.
 */
export async function generateDocumentation(
  azureConfig: AzureOpenAiConfig,
  context: GenerationContext,
  template: Template,
): Promise<GenerationOutcome> {
  const client = new AzureOpenAI({
    apiKey: azureConfig.apiKey,
    endpoint: azureConfig.endpoint,
    apiVersion: azureConfig.apiVersion,
    deployment: azureConfig.deployment,
  });
  const { system, user } = buildGenerationPrompt(context, template);

  // GPT-5.6 (reasoning model) občas vráti štruktúrovane platný JSON, ale s prázdnym
  // readme_markdown/summary (pozorované naživo pri opakovaných volaniach s identickým
  // promptom - reasoning-model nedeterminizmus, nie chyba v promptu). Article III
  // vyžaduje, aby zlyhanie bolo viditeľné, nie tiché - preto skúsime max. 3x s reálnym
  // volaním (žiadny fake/cache fallback) a až potom nahlásime GenerationError.
  const parsed = await callStructuredWithRetry(client, system, user);

  const firstValidation = await validateMermaidDiagram(parsed.architecture_diagram);
  if (firstValidation.valid) {
    return { result: parsed, modelId: azureConfig.deployment, templateVersion: template.name, mermaidRepaired: false };
  }

  // Jeden opravný pokus (research.md #4) - pošleme chybu späť modelu.
  const fixUser = buildMermaidFixPrompt(parsed.architecture_diagram, firstValidation.error ?? "unknown parse error");
  const fixed = await callStructured(client, system, fixUser);
  const secondValidation = await validateMermaidDiagram(fixed.architecture_diagram);

  if (secondValidation.valid) {
    return {
      result: { ...parsed, architecture_diagram: fixed.architecture_diagram },
      modelId: azureConfig.deployment,
      templateVersion: template.name,
      mermaidRepaired: true,
    };
  }

  throw new GenerationError(
    `Mermaid diagram zostal nevalidný aj po opravnom pokuse: ${secondValidation.error}`,
    "mermaid_invalid_after_retry",
  );
}

const MAX_SCHEMA_RETRIES = 3;

/**
 * callStructured() s retry na invalid_output_schema (research.md #6 - MCP/LLM error
 * handling taxonomia rozšírená o tento reálne pozorovaný prípad). Mermaid-retry (jeden
 * pokus, riešený v generateDocumentation) ostáva samostatný, pretože tam ide o opravu
 * konkrétnej syntaktickej chyby, nie o zopakovanie identického promptu.
 */
async function callStructuredWithRetry(
  client: AzureOpenAI,
  system: string,
  user: string,
): Promise<GenerationResultShape> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_SCHEMA_RETRIES; attempt++) {
    try {
      return await callStructured(client, system, user);
    } catch (err) {
      lastError = err;
      const isSchemaError = err instanceof GenerationError && err.errorCode === "invalid_output_schema";
      if (!isSchemaError || attempt === MAX_SCHEMA_RETRIES) {
        throw err;
      }
      // eslint-disable-next-line no-console
      console.error(
        `[docwright] Azure OpenAI vrátil neplatnú štruktúru (pokus ${attempt}/${MAX_SCHEMA_RETRIES}), skúšam znova...`,
      );
    }
  }
  throw lastError;
}

async function callStructured(client: AzureOpenAI, system: string, user: string): Promise<GenerationResultShape> {
  let response;
  try {
    response = await client.responses.create({
      model: client.deploymentName ?? "",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: {
        format: {
          type: "json_schema",
          name: GENERATION_RESULT_JSON_SCHEMA.name,
          schema: GENERATION_RESULT_JSON_SCHEMA.schema,
          strict: GENERATION_RESULT_JSON_SCHEMA.strict,
        },
      },
    });
  } catch (err) {
    throw new GenerationError(
      `Azure OpenAI volanie zlyhalo: ${err instanceof Error ? err.message : String(err)}`,
      "openai_error",
    );
  }

  const raw = response.output_text;
  if (!raw) {
    throw new GenerationError("Azure OpenAI vrátil prázdnu odpoveď.", "invalid_output_schema");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new GenerationError("Azure OpenAI odpoveď nie je platný JSON.", "invalid_output_schema");
  }

  const result = GenerationResultSchema.safeParse(json);
  if (!result.success) {
    throw new GenerationError(
      `Azure OpenAI odpoveď nesedí so schémou: ${result.error.message}`,
      "invalid_output_schema",
    );
  }

  return result.data;
}

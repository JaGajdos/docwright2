import OpenAI from "openai";
import type { Template } from "../templates/types.js";
import { GenerationResultSchema, GENERATION_RESULT_JSON_SCHEMA, type GenerationResultShape } from "./schema.js";
import { buildGenerationPrompt, buildMermaidFixPrompt, type GenerationContext } from "./promptBuilder.js";
import { validateMermaidDiagram } from "./mermaidValidate.js";

// research.md sekcia 2: GPT-5.6 Terra - stredný tier (nie Sol/flagship, nie Luna/najlacnejší).
export const DEFAULT_MODEL = "gpt-5.6-terra";

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

/**
 * Volá OpenAI so štruktúrovaným výstupom (research.md #3), overí JSON schémou (zod)
 * a Mermaid diagram reálnym parserom (research.md #4) - jeden opravný pokus, potom
 * completed_partial (viď GenerationError.errorCode=mermaid_invalid_after_retry, CLI to
 * zachytáva a stále vráti README bez diagramu namiesto tvrdého pádu).
 */
export async function generateDocumentation(
  apiKey: string,
  context: GenerationContext,
  template: Template,
  model: string = DEFAULT_MODEL,
): Promise<GenerationOutcome> {
  const client = new OpenAI({ apiKey });
  const { system, user } = buildGenerationPrompt(context, template);

  let parsed = await callStructured(client, model, system, user);

  const firstValidation = await validateMermaidDiagram(parsed.architecture_diagram);
  if (firstValidation.valid) {
    return { result: parsed, modelId: model, templateVersion: template.name, mermaidRepaired: false };
  }

  // Jeden opravný pokus (research.md #4) - pošleme chybu späť modelu.
  const fixUser = buildMermaidFixPrompt(parsed.architecture_diagram, firstValidation.error ?? "unknown parse error");
  const fixed = await callStructured(client, model, system, fixUser);
  const secondValidation = await validateMermaidDiagram(fixed.architecture_diagram);

  if (secondValidation.valid) {
    return {
      result: { ...parsed, architecture_diagram: fixed.architecture_diagram },
      modelId: model,
      templateVersion: template.name,
      mermaidRepaired: true,
    };
  }

  throw new GenerationError(
    `Mermaid diagram zostal nevalidný aj po opravnom pokuse: ${secondValidation.error}`,
    "mermaid_invalid_after_retry",
  );
}

async function callStructured(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
): Promise<GenerationResultShape> {
  let response;
  try {
    response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: GENERATION_RESULT_JSON_SCHEMA },
    });
  } catch (err) {
    throw new GenerationError(
      `OpenAI volanie zlyhalo: ${err instanceof Error ? err.message : String(err)}`,
      "openai_error",
    );
  }

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new GenerationError("OpenAI vrátil prázdnu odpoveď.", "invalid_output_schema");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new GenerationError("OpenAI odpoveď nie je platný JSON.", "invalid_output_schema");
  }

  const result = GenerationResultSchema.safeParse(json);
  if (!result.success) {
    throw new GenerationError(
      `OpenAI odpoveď nesedí so schémou: ${result.error.message}`,
      "invalid_output_schema",
    );
  }

  return result.data;
}

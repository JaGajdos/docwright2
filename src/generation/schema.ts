import { z } from "zod";

// research.md sekcia 3: Generation Engine vynucuje štruktúrovaný output
// (JSON), nie voľný text na parsovanie - Article III (kontraktový test).
export const GenerationResultSchema = z.object({
  readme_markdown: z.string().min(1),
  architecture_diagram: z.string().min(1),
  summary: z.string().min(1),
});

export type GenerationResultShape = z.infer<typeof GenerationResultSchema>;

// JSON schema pre OpenAI Structured Outputs (response_format: json_schema).
export const GENERATION_RESULT_JSON_SCHEMA = {
  name: "docwright_generation_result",
  strict: true,
  schema: {
    type: "object",
    properties: {
      readme_markdown: { type: "string", description: "Kompletné README v Markdown, podľa poskytnutých šablónových sekcií." },
      architecture_diagram: { type: "string", description: "Mermaid diagram (napr. flowchart TD) architektúry repozitára." },
      summary: { type: "string", description: "1-3 vetové zhrnutie účelu projektu." },
    },
    required: ["readme_markdown", "architecture_diagram", "summary"],
    additionalProperties: false,
  },
} as const;

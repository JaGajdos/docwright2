import { z } from "zod";
import type { TemplateType } from "../templates/types.js";

// UC3 (zadanie): maintainer pridá do repa .docwright.json a usmerní generovanie
// namiesto plnej automatiky. Toto je jediný spôsob, ako prebiť auto-detekciu
// šablóny (templates.ts / selectTemplate.ts) a vynechať priečinky z analýzy.

const DocwrightConfigSchema = z.object({
  template: z.enum(["library", "cli", "app", "api"]).optional(),
  ignore: z.array(z.string()).default([]),
});

export type DocwrightConfig = z.infer<typeof DocwrightConfigSchema>;

export interface ConfigParseResult {
  config: DocwrightConfig;
  /** Ak parsovanie zlyhalo (nevalidný JSON/schéma), config sa nepoužije, len sa zaloguje - Article III: žiadne tiché hádanie. */
  parseError?: string;
}

const EMPTY_CONFIG: DocwrightConfig = { ignore: [] };

/**
 * Parsuje surový obsah .docwright.json (ak repo súbor má). Chýbajúci súbor
 * nie je chyba - vracia sa prázdny config a auto-detekcia beží bez obmedzení.
 */
export function parseDocwrightConfig(rawFileContent: string | undefined): ConfigParseResult {
  if (rawFileContent === undefined) {
    return { config: EMPTY_CONFIG };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawFileContent);
  } catch (err) {
    return {
      config: EMPTY_CONFIG,
      parseError: `.docwright.json nie je platný JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const result = DocwrightConfigSchema.safeParse(json);
  if (!result.success) {
    return {
      config: EMPTY_CONFIG,
      parseError: `.docwright.json nesedí so schémou: ${result.error.message}`,
    };
  }

  return { config: result.data };
}

/**
 * Zloží finálny typ šablóny: config override (ak je platný) vyhráva nad auto-detekciou.
 */
export function resolveTemplateType(autoDetected: TemplateType, config: DocwrightConfig): TemplateType {
  return config.template ?? autoDetected;
}

/** Filter file paths podľa `ignore` prefixov z configu (jednoduchý startsWith match). */
export function applyIgnoreList(filePaths: string[], config: DocwrightConfig): string[] {
  if (config.ignore.length === 0) return filePaths;
  return filePaths.filter((p) => !config.ignore.some((prefix) => p.startsWith(prefix)));
}

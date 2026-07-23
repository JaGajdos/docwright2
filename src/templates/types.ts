export interface TemplateSection {
  key: string;
  required: boolean;
  instruction: string;
  sourceHint: string;
  skipIf?: string;
}

export type TemplateType = "library" | "cli" | "app" | "api";

export interface Template {
  name: string;
  type: TemplateType;
  sections: TemplateSection[];
  isDefault: boolean;
}

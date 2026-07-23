import { JSDOM } from "jsdom";

// research.md sekcia 4: diagram sa validuje reálnym Mermaid parserom, nie regexom.
// Mermaid (jadro balíka) potrebuje DOM globals aj len na syntaktické parsovanie
// (flowchart/classDiagram/sequenceDiagram grámatiky ešte nie sú v ľahkom
// @mermaid-js/parser balíku) - jsdom shim je dostatočný, netreba puppeteer/Chromium.

let mermaidInitialized = false;

async function getMermaid() {
  if (!mermaidInitialized) {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost/" });
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
    mermaidInitialized = true;
  }
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({ startOnLoad: false });
  return mermaid;
}

export interface MermaidValidationResult {
  valid: boolean;
  diagramType?: string;
  error?: string;
}

export async function validateMermaidDiagram(diagramText: string): Promise<MermaidValidationResult> {
  const mermaid = await getMermaid();
  try {
    const parsed = await mermaid.parse(diagramText, { suppressErrors: false });
    return { valid: true, diagramType: (parsed as { diagramType?: string })?.diagramType };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message.split("\n")[0] };
  }
}

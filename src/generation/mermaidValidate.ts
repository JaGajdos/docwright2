import { JSDOM } from "jsdom";

// research.md sekcia 4: diagram sa validuje reálnym Mermaid parserom, nie regexom.
// Mermaid (jadro balíka) potrebuje DOM globals aj len na syntaktické parsovanie
// (flowchart/classDiagram/sequenceDiagram grámatiky ešte nie sú v ľahkom
// @mermaid-js/parser balíku) - jsdom shim je dostatočný, netreba puppeteer/Chromium.
//
// REÁLNA CHYBA nájdená v produkcii (Railway, 23.7.2026): pôvodná verzia nastavovala
// globalThis.window/document/navigator RAZ a nechávala ich tam navždy. V CLI (proces
// na jedno spustenie) to nikdy neprekážalo, ale na persistentnom HTTP serveri (viac
// requestov v tom istom Node procese) to znamenalo, že po prvej mermaid validácii
// OpenAI SDK pri KAŽDOM ďalšom `new AzureOpenAI(...)` vyhodnotilo `typeof window`
// ako "browser-like environment" a odmietlo sa vytvoriť ("dangerouslyAllowBrowser"
// chyba) - teda zlyhávalo generovanie, nie samotná mermaid validácia. Fix: jsdom
// globals sa nastavia len na čas jedného volania a v `finally` sa vždy vrátia späť
// (typicky na `undefined`), nikdy nezostanú "presiaknuté" mimo tejto funkcie.

export interface MermaidValidationResult {
  valid: boolean;
  diagramType?: string;
  error?: string;
}

export async function validateMermaidDiagram(diagramText: string): Promise<MermaidValidationResult> {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost/" });

  const previousWindow = (globalThis as any).window;
  const previousDocument = (globalThis as any).document;
  const previousNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });

  try {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({ startOnLoad: false });
    const parsed = await mermaid.parse(diagramText, { suppressErrors: false });
    return { valid: true, diagramType: (parsed as { diagramType?: string })?.diagramType };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message.split("\n")[0] };
  } finally {
    if (previousWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = previousWindow;

    if (previousDocument === undefined) delete (globalThis as any).document;
    else (globalThis as any).document = previousDocument;

    if (previousNavigatorDescriptor) {
      Object.defineProperty(globalThis, "navigator", previousNavigatorDescriptor);
    } else {
      delete (globalThis as any).navigator;
    }
  }
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMermaidDiagram } from "../src/generation/mermaidValidate.js";

// Reálny Mermaid parser (cez jsdom shim, žiadny mock) - research.md sekcia 4.

test("platný flowchart diagram sa validuje ako valid", async () => {
  const result = await validateMermaidDiagram("flowchart TD\n  A[Client] --> B[API Gateway]\n  B --> C[Worker]");
  assert.equal(result.valid, true);
  assert.equal(result.diagramType, "flowchart-v2");
});

test("nevalidný diagram sa zamietne s error správou (nie tichý pád)", async () => {
  const result = await validateMermaidDiagram("flowchart TD\n  A -->> broken {{{ ][");
  assert.equal(result.valid, false);
  assert.ok(result.error && result.error.length > 0, "očakával neprázdnu error správu");
});

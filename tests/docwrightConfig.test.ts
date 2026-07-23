import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDocwrightConfig,
  resolveTemplateType,
  applyIgnoreList,
} from "../src/config/docwrightConfig.js";

test("chýbajúci .docwright.json -> prázdny config, žiadna chyba", () => {
  const result = parseDocwrightConfig(undefined);
  assert.deepEqual(result.config, { ignore: [] });
  assert.equal(result.parseError, undefined);
});

test("nevalidný JSON -> parseError, nie výnimka, config zostáva prázdny (Article III - žiadne hádanie)", () => {
  const result = parseDocwrightConfig("{ toto nie je json");
  assert.ok(result.parseError?.includes("nie je platný JSON"));
  assert.deepEqual(result.config, { ignore: [] });
});

test("neznámy typ šablóny v configu -> parseError, nepoužije sa", () => {
  const result = parseDocwrightConfig(JSON.stringify({ template: "wordpress-plugin" }));
  assert.ok(result.parseError?.includes("nesedí so schémou"));
});

test("platný config s template override", () => {
  const result = parseDocwrightConfig(JSON.stringify({ template: "cli", ignore: ["internal/"] }));
  assert.equal(result.parseError, undefined);
  assert.equal(result.config.template, "cli");
  assert.deepEqual(result.config.ignore, ["internal/"]);
});

test("resolveTemplateType: config override vyhráva nad auto-detekciou (UC3)", () => {
  const type = resolveTemplateType("library", { template: "cli", ignore: [] });
  assert.equal(type, "cli");
});

test("resolveTemplateType: bez override sa použije auto-detekcia", () => {
  const type = resolveTemplateType("app", { ignore: [] });
  assert.equal(type, "app");
});

test("applyIgnoreList: vynechá súbory pod ignorovaným prefixom", () => {
  const filtered = applyIgnoreList(
    ["src/index.ts", "internal/secrets.ts", "internal/db.ts", "README.md"],
    { ignore: ["internal/"] },
  );
  assert.deepEqual(filtered, ["src/index.ts", "README.md"]);
});

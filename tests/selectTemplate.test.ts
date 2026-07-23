import { test } from "node:test";
import assert from "node:assert/strict";
import { selectTemplateType } from "../src/templates/selectTemplate.js";

test("package.json s bin poľom -> cli", () => {
  const type = selectTemplateType({
    filePaths: ["package.json", "bin/cli.js", "src/index.js"],
    packageJson: { bin: { docwright: "bin/cli.js" } },
  });
  assert.equal(type, "cli");
});

test("Express bez frontend priečinka -> api", () => {
  const type = selectTemplateType({
    filePaths: ["package.json", "src/server.js", "src/routes/users.js"],
    packageJson: { dependencies: { express: "^4.18.0" } },
  });
  assert.equal(type, "api");
});

test("Express + public/index.html -> app (frontend build vyhráva nad backend markerom)", () => {
  const type = selectTemplateType({
    filePaths: ["package.json", "public/index.html", "src/server.js"],
    packageJson: { dependencies: { express: "^4.18.0" } },
  });
  assert.equal(type, "app");
});

test("React dependency -> app", () => {
  const type = selectTemplateType({
    filePaths: ["package.json", "src/App.jsx"],
    packageJson: { dependencies: { react: "^18.3.0" } },
  });
  assert.equal(type, "app");
});

test("openapi.yaml prítomný -> api", () => {
  const type = selectTemplateType({
    filePaths: ["openapi.yaml", "src/main.py"],
  });
  assert.equal(type, "api");
});

test("nič z vyššie uvedeného -> library (default)", () => {
  const type = selectTemplateType({
    filePaths: ["index.js", "package.json", "test.js"],
    packageJson: { dependencies: {} },
  });
  assert.equal(type, "library");
});

test("cmd/*/main.go vzor -> cli", () => {
  const type = selectTemplateType({
    filePaths: ["cmd/docwright/main.go", "go.mod"],
  });
  assert.equal(type, "cli");
});

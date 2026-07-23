import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBadgesMarkdown } from "../src/generation/badges.js";

test("žiadny signál -> undefined (nič sa nehádže)", () => {
  const result = buildBadgesMarkdown({ owner: "acme", repo: "lib", filePaths: [], hasLicenseFile: false });
  assert.equal(result, undefined);
});

test("len LICENSE súbor -> len license badge, odkazujúci na GitHub API", () => {
  const result = buildBadgesMarkdown({ owner: "acme", repo: "lib", filePaths: ["LICENSE"], hasLicenseFile: true });
  assert.ok(result?.includes("img.shields.io/github/license/acme/lib"));
  assert.ok(!result?.includes("Version"));
  assert.ok(!result?.includes("CI"));
});

test("len package.json -> len version badge z reálneho package.json obsahu", () => {
  const result = buildBadgesMarkdown({
    owner: "acme",
    repo: "lib",
    filePaths: ["package.json"],
    packageJson: { dependencies: {} },
    hasLicenseFile: false,
  });
  assert.ok(result?.includes("img.shields.io/github/package-json/v/acme/lib"));
  assert.ok(!result?.includes("license"));
});

test("CI workflow súbory -> CI badge s reálnym názvom súboru, max 2", () => {
  const result = buildBadgesMarkdown({
    owner: "acme",
    repo: "lib",
    filePaths: [
      ".github/workflows/test.yml",
      ".github/workflows/release.yaml",
      ".github/workflows/lint.yml",
    ],
    hasLicenseFile: false,
  });
  assert.ok(result?.includes("actions/workflows/test.yml/badge.svg"));
  assert.ok(result?.includes("actions/workflows/release.yaml/badge.svg"));
  assert.ok(!result?.includes("lint.yml"), "max 2 CI badge, tretí sa už nepridáva");
});

test("všetky signály naraz -> license + version + CI badge spolu", () => {
  const result = buildBadgesMarkdown({
    owner: "acme",
    repo: "lib",
    filePaths: ["LICENSE", "package.json", ".github/workflows/ci.yml"],
    packageJson: { dependencies: {} },
    hasLicenseFile: true,
  });
  assert.ok(result?.includes("license/acme/lib"));
  assert.ok(result?.includes("package-json/v/acme/lib"));
  assert.ok(result?.includes("actions/workflows/ci.yml/badge.svg"));
});

test("workflow súbor mimo .github/workflows/ sa neráta ako CI signál", () => {
  const result = buildBadgesMarkdown({
    owner: "acme",
    repo: "lib",
    filePaths: ["scripts/ci.yml", ".github/workflows/nested/ci.yml"],
    hasLicenseFile: false,
  });
  assert.equal(result, undefined);
});

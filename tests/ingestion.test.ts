import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { GithubMcpClient, GithubMcpClientError } from "../src/ingestion/githubMcpClient.js";

// T010 (tasks.md) - fixture repozitáre: research.md sekcia 10.
// Toto NIE JE mock - github-mcp-server je skutočná binárka, volania idú na skutočné GitHub API.
//
// Zisté reálnym behom (23.7.2026): bez GITHUB_PERSONAL_ACCESS_TOKEN server vyžaduje
// OAuth device-flow na KAŽDÝ tool-call (nie len nižší rate limit, ako pôvodne predpokladal
// research.md). Testy, ktoré potrebujú reálne dáta z GitHubu, sa preto bez tokenu preskočia
// (skip), nie fingujú úspech naprázdno - a jeden test overuje, že chýbajúci token končí
// ako čitateľný GithubMcpClientError(auth_required), nie tichý "úspech" s nezmyselným obsahom.

const HAS_TOKEN = Boolean(process.env.GITHUB_PERSONAL_ACCESS_TOKEN);

let client: GithubMcpClient;

before(async () => {
  client = new GithubMcpClient({ githubToken: process.env.GITHUB_PERSONAL_ACCESS_TOKEN });
  await client.connect();
});

after(async () => {
  await client.close();
});

test("MCP server exposes presne tie tooly, ktoré Ingestion knižnica potrebuje", async () => {
  const tools = await client.listTools();
  assert.ok(tools.includes("get_repository_tree"), `chýba get_repository_tree, mám: ${tools}`);
  assert.ok(tools.includes("get_file_contents"), `chýba get_file_contents, mám: ${tools}`);
  assert.ok(tools.includes("search_code"), `chýba search_code, mám: ${tools}`);
});

test("bez tokenu: tool-call zlyhá čitateľne ako auth_required, nie tichý falošný úspech", { skip: HAS_TOKEN }, async () => {
  await assert.rejects(
    () => client.getRepositoryTree("sindresorhus", "is-stream"),
    (err: unknown) => {
      assert.ok(err instanceof GithubMcpClientError, `očakával GithubMcpClientError, dostal: ${err}`);
      assert.equal((err as GithubMcpClientError).errorCode, "auth_required");
      return true;
    },
  );
});

test(
  "happy path: sindresorhus/is-stream - reálny file tree z GitHubu",
  { skip: !HAS_TOKEN && "vyžaduje GITHUB_PERSONAL_ACCESS_TOKEN - pozri research.md #1" },
  async () => {
    const result = await client.getRepositoryTree("sindresorhus", "is-stream");
    const text = JSON.stringify(result);
    assert.ok(text.includes("index.js"), `strom neobsahuje index.js: ${text.slice(0, 500)}`);
    assert.ok(text.includes("package.json"), `strom neobsahuje package.json: ${text.slice(0, 500)}`);
  },
);

test(
  "neexistujúci repozitár vráti error_code=repo_not_found, nie nezachytenú výnimku",
  { skip: !HAS_TOKEN && "vyžaduje GITHUB_PERSONAL_ACCESS_TOKEN - pozri research.md #1" },
  async () => {
    await assert.rejects(
      () => client.getRepositoryTree("docwright-test-nonexistent", "this-repo-does-not-exist-404"),
      (err: unknown) => {
        assert.ok(err instanceof GithubMcpClientError, `očakával GithubMcpClientError, dostal: ${err}`);
        assert.equal((err as GithubMcpClientError).errorCode, "repo_not_found");
        return true;
      },
    );
  },
);

test(
  "prázdny/takmer prázdny repozitár: octocat/Hello-World",
  { skip: !HAS_TOKEN && "vyžaduje GITHUB_PERSONAL_ACCESS_TOKEN - pozri research.md #1" },
  async () => {
    const result = await client.getFileContents("octocat", "Hello-World", "README");
    const text = JSON.stringify(result);
    assert.ok(text.toLowerCase().includes("hello world"), `obsah nesedí: ${text.slice(0, 300)}`);
  },
);

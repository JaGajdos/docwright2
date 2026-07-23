import { GithubMcpClient } from "./githubMcpClient.js";
import type { RepoSignals } from "../templates/selectTemplate.js";
import type { GenerationContext } from "../generation/promptBuilder.js";

const KEY_MANIFEST_NAMES = [
  "package.json",
  "pyproject.toml",
  "setup.py",
  "go.mod",
  "Gemfile",
  "Cargo.toml",
  "openapi.yaml",
  "openapi.yml",
  "swagger.json",
];
const README_NAMES = ["README.md", "readme.md", "README", "Readme.md"];
const LICENSE_NAMES = ["LICENSE", "LICENSE.md", "license"];
const MAX_ENTRY_POINT_FILES = 3;
const ENTRY_POINT_PATTERNS = [/^(src\/)?index\.(js|ts|py)$/, /^(src\/)?main\.(js|ts|py|go)$/, /^app\.(js|ts|py)$/];

export interface RepositoryIngestionResult {
  signals: RepoSignals;
  context: GenerationContext;
  /** Surový obsah .docwright.json, ak existuje (config knižnica ho ďalej parsuje - UC3). */
  docwrightConfigRaw?: string;
}

/**
 * Orchestruje ingestion jedného repozitára (Modul 1, T017-T019): stiahne file tree,
 * vyberie manifesty + README + LICENSE + heuristické entry-pointy, poskladá RepoSignals
 * (pre auto-detekciu šablóny) a GenerationContext (pre AI Generation knižnicu).
 * Volania na MCP idú v pevnej postupnosti - Article IX (deterministické, testovateľné).
 */
export async function ingestRepository(
  client: GithubMcpClient,
  owner: string,
  repo: string,
): Promise<RepositoryIngestionResult> {
  const treeResult = await client.getRepositoryTree(owner, repo);
  const filePaths = extractFilePaths(treeResult);

  const keyFileContents: Record<string, string> = {};
  let packageJson: RepoSignals["packageJson"];
  let existingReadme: string | undefined;
  let docwrightConfigRaw: string | undefined;

  const manifestPaths = filePaths.filter((p) => KEY_MANIFEST_NAMES.includes(p) || KEY_MANIFEST_NAMES.includes(basename(p)));
  const readmePath = filePaths.find((p) => README_NAMES.includes(p));
  const licensePath = filePaths.find((p) => LICENSE_NAMES.includes(p));
  const configPath = filePaths.find((p) => p === ".docwright.json");
  const entryPointPaths = filePaths
    .filter((p) => ENTRY_POINT_PATTERNS.some((pattern) => pattern.test(p)))
    .slice(0, MAX_ENTRY_POINT_FILES);

  for (const path of manifestPaths) {
    const content = await fetchTextContent(client, owner, repo, path);
    if (content !== undefined) {
      keyFileContents[path] = content;
      if (basename(path) === "package.json") {
        try {
          packageJson = JSON.parse(content);
        } catch {
          // nevalidný package.json - ignorujeme pre RepoSignals, obsah ostáva v keyFileContents
        }
      }
    }
  }

  if (readmePath) {
    existingReadme = await fetchTextContent(client, owner, repo, readmePath);
  }
  if (licensePath) {
    keyFileContents[licensePath] = (await fetchTextContent(client, owner, repo, licensePath)) ?? "";
  }
  if (configPath) {
    docwrightConfigRaw = await fetchTextContent(client, owner, repo, configPath);
  }
  for (const path of entryPointPaths) {
    const content = await fetchTextContent(client, owner, repo, path);
    if (content !== undefined) keyFileContents[path] = content;
  }

  const signals: RepoSignals = { filePaths, packageJson };

  const context: GenerationContext = {
    owner,
    repo,
    fileTree: filePaths,
    keyFileContents,
    existingReadme,
    detectedStack: detectStackFromManifests(manifestPaths, packageJson),
  };

  return { signals, context, docwrightConfigRaw };
}

async function fetchTextContent(
  client: GithubMcpClient,
  owner: string,
  repo: string,
  path: string,
): Promise<string | undefined> {
  const result = await client.getFileContents(owner, repo, path);
  return extractTextFromToolResult(result);
}

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function detectStackFromManifests(manifestPaths: string[], packageJson: RepoSignals["packageJson"]): string[] {
  const stack: string[] = [];
  if (manifestPaths.some((p) => basename(p) === "package.json")) stack.push("Node.js/JavaScript");
  if (manifestPaths.some((p) => basename(p) === "pyproject.toml" || basename(p) === "setup.py")) stack.push("Python");
  if (manifestPaths.some((p) => basename(p) === "go.mod")) stack.push("Go");
  if (manifestPaths.some((p) => basename(p) === "Gemfile")) stack.push("Ruby");
  if (manifestPaths.some((p) => basename(p) === "Cargo.toml")) stack.push("Rust");
  const deps = Object.keys({ ...packageJson?.dependencies, ...packageJson?.devDependencies });
  if (deps.some((d) => d.toLowerCase() === "react")) stack.push("React");
  if (deps.some((d) => d.toLowerCase() === "express")) stack.push("Express");
  return stack;
}

/**
 * MCP nástroje vracajú výsledok ako { content: [{ type: "text", text: "..." }] }.
 * Táto funkcia je zámerne tolerantná k mierne odlišným tvarom (rôzne verzie SDK/servera).
 */
function extractTextFromToolResult(result: unknown): string | undefined {
  const content = (result as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(content)) return undefined;
  const textPart = content.find((c) => c.type === "text" && typeof c.text === "string");
  return textPart?.text;
}

function extractFilePaths(treeResult: unknown): string[] {
  const text = extractTextFromToolResult(treeResult);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    const entries: unknown[] = Array.isArray(parsed) ? parsed : (parsed?.tree ?? parsed?.entries ?? []);
    return entries
      .map((entry) => (entry as { path?: string })?.path)
      .filter((p): p is string => typeof p === "string");
  } catch {
    return [];
  }
}

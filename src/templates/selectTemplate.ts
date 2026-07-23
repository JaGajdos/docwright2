import type { TemplateType } from "./types.js";

/**
 * Signály, ktoré Ingestion knižnica (Modul 1 / T018) musí vedieť poskytnúť
 * z file tree + obsahu manifestov. Toto je zámerne oddelené od GithubMcpClient,
 * aby sa auto-detekcia dala jednotkovo testovať bez reálneho GitHub volania.
 */
export interface RepoSignals {
  filePaths: string[];
  packageJson?: { bin?: unknown; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  hasPyprojectConsoleScripts?: boolean;
  hasSetupPyEntryPoints?: boolean;
}

const FRONTEND_DEPENDENCY_MARKERS = ["react", "vue", "next", "astro", "svelte", "@angular/core"];
const BACKEND_FRAMEWORK_MARKERS = ["flask", "fastapi", "express", "fastify", "rails", "django"];

/**
 * Auto-detekcia typu šablóny (templates.md, sekcia "Auto-detekcia typu šablóny").
 * Prvý zhodný signál vyhráva, presne v tomto poradí: CLI > API > App > Library (default).
 * Užívateľ vie toto prebiť cez .docwright.json (UC3) - viď config/docwrightConfig.ts.
 */
export function selectTemplateType(signals: RepoSignals): TemplateType {
  if (isCli(signals)) return "cli";
  if (isApi(signals)) return "api";
  if (isApp(signals)) return "app";
  return "library";
}

function isCli(signals: RepoSignals): boolean {
  if (signals.packageJson?.bin) return true;
  if (signals.hasPyprojectConsoleScripts || signals.hasSetupPyEntryPoints) return true;
  if (signals.filePaths.some((p) => /^cmd\/[^/]+\/main\.go$/.test(p))) return true;
  return false;
}

function isApi(signals: RepoSignals): boolean {
  const hasOpenApiSpec = signals.filePaths.some((p) => /(^|\/)(openapi\.ya?ml|swagger\.json)$/i.test(p));
  if (hasOpenApiSpec) return true;

  const deps = { ...signals.packageJson?.dependencies, ...signals.packageJson?.devDependencies };
  const depNames = Object.keys(deps ?? {}).map((d) => d.toLowerCase());
  const hasBackendFramework = BACKEND_FRAMEWORK_MARKERS.some((marker) => depNames.includes(marker));
  const hasFrontendBuild = signals.filePaths.some((p) => /^(public\/index\.html|client\/|frontend\/)/.test(p));

  return hasBackendFramework && !hasFrontendBuild;
}

function isApp(signals: RepoSignals): boolean {
  const deps = { ...signals.packageJson?.dependencies, ...signals.packageJson?.devDependencies };
  const depNames = Object.keys(deps ?? {}).map((d) => d.toLowerCase());
  const hasFrontendFramework = FRONTEND_DEPENDENCY_MARKERS.some((marker) => depNames.includes(marker));
  const hasFrontendEntry = signals.filePaths.some((p) => p === "public/index.html");
  const isMobile = signals.filePaths.some((p) => p === "pubspec.yaml" || p.endsWith(".xcodeproj"));

  return hasFrontendFramework || hasFrontendEntry || isMobile;
}

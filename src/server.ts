import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { runGeneration } from "./core/runGeneration.js";
import { loadAzureConfigFromEnv, GenerationError } from "./generation/openaiClient.js";
import { GithubMcpClientError } from "./ingestion/githubMcpClient.js";
import type { TemplateType } from "./templates/types.js";

// T-web-02: minimálny verejný HTTP wrapper nad src/core/runGeneration.ts (Article II -
// web vrstva je tenká obálka, nie duplicitná logika). Zámerne bez databázy/fronty
// (užívateľské rozhodnutie 23.7.2026 pri príprave verejného nasadenia na Railway) -
// synchrónne request/response, jeden request = jedno spustenie github-mcp-server
// subprocesu (nie perzistentná session zdieľaná medzi requestami, aby sa vyhli
// konkurenčným MCP tool-callom v jednej stdio session pri paralelných requestoch).

const PORT = Number(process.env.PORT ?? 8080);
const HOST = "0.0.0.0";

// Jednoduchý in-memory rate limit per IP - žiadna databáza, len ochrana pred
// neúmyselným/zlomyseľným zahltením reálneho (plateného) Azure OpenAI resource
// na verejne dostupnom endpointe bez API kľúčov (Article IV/V - "lacno a rýchlo",
// research.md #9). Reštart servera reset limitu - akceptované, je to len mäkká ochrana.
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hodina
const rateLimitState = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = rateLimitState.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimitState.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true };
}

function setCorsHeaders(res: ServerResponse) {
  // Verejný demo endpoint bez API kľúčov (užívateľské rozhodnutie - žiadna databáza/auth
  // vrstva v tejto fáze) - CORS zámerne otvorený pre všetky origins, aby ho vedel volať
  // statický frontend z GitHub Pages. Nevracia žiadne súkromné dáta - len verejné GitHub
  // repo signály + vygenerovaný text.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
    if (Buffer.concat(chunks).length > 1_000_000) {
      throw new Error("Telo requestu je príliš veľké.");
    }
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

/** Article III/V - chyba musí byť čitateľná aj cez HTTP, nikdy len generic 500 bez kontextu. */
function errorToHttpResponse(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof GithubMcpClientError) {
    const statusByCode: Record<string, number> = {
      repo_not_found: 404,
      repo_not_accessible: 403,
      rate_limited: 429,
      timeout: 504,
      auth_required: 502,
      server_unavailable: 502,
    };
    return {
      status: statusByCode[err.errorCode] ?? 502,
      body: { error_code: err.errorCode, message: err.message },
    };
  }
  if (err instanceof GenerationError) {
    return { status: 502, body: { error_code: err.errorCode, message: err.message } };
  }
  return {
    status: 400,
    body: { error_code: "bad_request", message: err instanceof Error ? err.message : String(err) },
  };
}

const azureConfig = loadAzureConfigFromEnv();
if (!azureConfig) {
  console.error(
    "[docwright-server] FATAL: chýba Azure OpenAI konfigurácia (AZURE_OPENAI_API_KEY/ENDPOINT/DEPLOYMENT) v env. Server sa nespustí.",
  );
  process.exit(1);
}

const server = createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "POST" && req.url === "/api/generate") {
    const ip = clientIp(req);
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      sendJson(res, 429, {
        error_code: "rate_limited",
        message: `Príliš veľa požiadaviek z tejto IP adresy. Skús to znova o ${rl.retryAfterSec}s.`,
      });
      return;
    }

    try {
      const body = (await readJsonBody(req)) as { repo?: string; template?: string };
      if (!body.repo || typeof body.repo !== "string") {
        sendJson(res, 400, { error_code: "bad_request", message: "Telo požiadavky musí obsahovať pole 'repo' (napr. owner/repo alebo GitHub URL)." });
        return;
      }

      const validTemplates: TemplateType[] = ["library", "cli", "app", "api"];
      const templateOverride = validTemplates.includes(body.template as TemplateType)
        ? (body.template as TemplateType)
        : undefined;

      const outcome = await runGeneration(body.repo, {
        githubToken: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
        azureConfig,
        templateOverride,
      });

      sendJson(res, 200, {
        repository: `${outcome.owner}/${outcome.repo}`,
        template: outcome.templateType,
        template_source: outcome.templateSource,
        model_id: outcome.modelId,
        mermaid_repaired: outcome.mermaidRepaired,
        config_parse_warning: outcome.configParseWarning ?? null,
        ...outcome.result,
      });
    } catch (err) {
      const { status, body: errBody } = errorToHttpResponse(err);
      console.error(`[docwright-server] request failed: ${JSON.stringify(errBody)}`);
      sendJson(res, status, errBody);
    }
    return;
  }

  sendJson(res, 404, { error_code: "not_found", message: "Neznámy endpoint. Použi POST /api/generate alebo GET /health." });
});

server.listen(PORT, HOST, () => {
  console.log(`[docwright-server] beží na http://${HOST}:${PORT} (deployment: ${azureConfig.deployment})`);
});

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// research.md sekcia 1: github-mcp-server beží ako subprocess (stdio), read-only,
// s explicitným zoznamom nástrojov. Perzistentné pripojenie na worker (nie per job) -
// v CLI kontexte je to jeden proces na jedno spustenie `docwright generate`.
const VENDOR_BINARY = path.resolve(
  __dirname,
  "../../vendor/github-mcp-server" + (process.platform === "win32" ? ".exe" : ""),
);
const ALLOWED_TOOLS = ["get_repository_tree", "get_file_contents", "search_code"] as const;

export interface GithubMcpClientOptions {
  /**
   * Service-level PAT (research.md #1). POVINNÝ pre reálnu prevádzku - bez neho
   * github-mcp-server pri prvom tool-calle vyžaduje OAuth device-flow (opravené
   * po reálnom teste 23.7.2026, pôvodne sme si mysleli, že stačí nižší rate limit).
   */
  githubToken?: string;
  logFile?: string;
}

export class GithubMcpClientError extends Error {
  constructor(
    message: string,
    public readonly errorCode:
      | "repo_not_found"
      | "repo_not_accessible"
      | "rate_limited"
      | "timeout"
      | "auth_required"
      | "server_unavailable",
  ) {
    super(message);
    this.name = "GithubMcpClientError";
  }
}

/**
 * Tenký wrapper nad @modelcontextprotocol/sdk, ktorý spúšťa github-mcp-server
 * ako subprocess (stdio transport) a volá jeho nástroje deterministicky
 * (Article IX Constitution - nie voľný agentický tool-calling loop).
 */
export class GithubMcpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  constructor(private readonly options: GithubMcpClientOptions = {}) {}

  async connect(): Promise<void> {
    const env: Record<string, string> = {
      // PATH je nutný, inak niektoré systémové volania vnútri binárky zlyhajú
      PATH: process.env.PATH ?? "",
    };
    if (this.options.githubToken) {
      env.GITHUB_PERSONAL_ACCESS_TOKEN = this.options.githubToken;
    }

    this.transport = new StdioClientTransport({
      command: VENDOR_BINARY,
      args: [
        "stdio",
        "--read-only",
        `--tools=${ALLOWED_TOOLS.join(",")}`,
        ...(this.options.logFile ? ["--log-file", this.options.logFile] : []),
      ],
      env,
    });

    this.client = new Client(
      { name: "docwright-ingestion", version: "0.1.0" },
      { capabilities: {} },
    );

    await this.client.connect(this.transport);
  }

  async listTools(): Promise<string[]> {
    if (!this.client) throw new Error("GithubMcpClient not connected - call connect() first");
    const result = await this.client.listTools();
    return result.tools.map((t) => t.name);
  }

  /**
   * Stiahne celý strom súborov repozitára (Modul 1).
   * Používa get_repository_tree s recursive:true - nahrádza potrebu
   * vlastného GitHub REST tree-fetch (research.md #1).
   */
  async getRepositoryTree(owner: string, repo: string): Promise<unknown> {
    return this.callTool("get_repository_tree", { owner, repo, recursive: true });
  }

  async getFileContents(owner: string, repo: string, filePath: string): Promise<unknown> {
    return this.callTool("get_file_contents", { owner, repo, path: filePath });
  }

  async searchCode(query: string): Promise<unknown> {
    return this.callTool("search_code", { query });
  }

  private async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) throw new Error("GithubMcpClient not connected - call connect() first");
    try {
      const result = await this.client.callTool({ name, arguments: args });
      // Zisté reálnym testom (23.7.2026): github-mcp-server pri chýbajúcom/nedostatočnom
      // tokene nevracia result.isError=true, len text s výzvou na OAuth device-flow.
      // Bez tejto kontroly by sa to tíško vrátilo ako "úspech" s nezmyselným obsahom.
      const text = JSON.stringify(result.content ?? "").toLowerCase();
      if (text.includes("login/device") || text.includes("authorize the github mcp server")) {
        throw new GithubMcpClientError(
          "GitHub MCP server vyžaduje autorizáciu (GITHUB_PERSONAL_ACCESS_TOKEN chýba alebo je neplatný).",
          "auth_required",
        );
      }
      if (result.isError) {
        throw mapToolErrorToDomainError(result as { content?: unknown });
      }
      return result;
    } catch (err) {
      if (err instanceof GithubMcpClientError) throw err;
      throw mapTransportErrorToDomainError(err);
    }
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = null;
    this.transport = null;
  }
}

// research.md sekcia 6: taxonómia chýb - trvalé vs. dočasné/systémové.
function mapToolErrorToDomainError(result: { content?: unknown }): GithubMcpClientError {
  const text = JSON.stringify(result.content ?? "").toLowerCase();
  if (text.includes("404") || text.includes("not found")) {
    return new GithubMcpClientError("Repozitár neexistuje alebo bol premenovaný.", "repo_not_found");
  }
  if (text.includes("403") || text.includes("rate limit")) {
    return new GithubMcpClientError("GitHub rate limit prekročený.", "rate_limited");
  }
  if (text.includes("401")) {
    return new GithubMcpClientError(
      "Repozitár nie je verejne prístupný, alebo je token neplatný.",
      "repo_not_accessible",
    );
  }
  return new GithubMcpClientError(`MCP tool vrátil chybu: ${text}`, "server_unavailable");
}

function mapTransportErrorToDomainError(err: unknown): GithubMcpClientError {
  const message = err instanceof Error ? err.message : String(err);
  if (message.toLowerCase().includes("timeout")) {
    return new GithubMcpClientError(message, "timeout");
  }
  return new GithubMcpClientError(message, "server_unavailable");
}

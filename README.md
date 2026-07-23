# DocWiright

Vygeneruje README a one-screen architecture mapu pre verejný GitHub repozitár. MVP jadro podľa `tasks.md` (Phase 1-5, CLI-first).

## Stav

Implementované a naostro odskúšané (bez credentials, kde to bolo možné):

- `src/ingestion/` - reálny MCP klient nad `github-mcp-server` (stdio subprocess) + orchestrácia (file tree, manifesty, README, entry pointy)
- `src/templates/` - 4 first-class šablóny (library/cli/app/api) + auto-detekcia typu
- `src/config/` - `.docwright.json` parser (UC3)
- `src/generation/` - Azure OpenAI (GPT-5.6 Terra, Responses API) structured output + reálna Mermaid validácia (jsdom, žiadny Chromium)
- `src/cli/generate.ts`, `bin/docwright.js` - `docwright generate <repo_url>`

Návrhové dokumenty: `zadanie` (mimo tohto repa), `constitution.md`, `research.md`, `templates.md`, `tasks.md` - pozri projektovú dokumentáciu.

## Setup

```bash
npm install
cp .env.example .env
# vyplň v .env:
#   AZURE_OPENAI_API_KEY=...
#   AZURE_OPENAI_ENDPOINT=...          (napr. https://<resource>.openai.azure.com/)
#   AZURE_OPENAI_API_VERSION=...       (napr. 2025-04-01-preview)
#   AZURE_OPENAI_DEPLOYMENT=...        (názov nasadenia modelu, napr. T1-gpt-5.6-terra)
#   GITHUB_PERSONAL_ACCESS_TOKEN=...   (read-only PAT, inak MCP server vyžaduje OAuth device-flow)
```

## Použitie

```bash
node bin/docwright.js sindresorhus/is-stream
node bin/docwright.js https://github.com/pallets/flask --json
node bin/docwright.js owner/repo --template cli -o README.generated.md
```

## Testy

```bash
npm test
```

Testy, ktoré potrebujú `GITHUB_PERSONAL_ACCESS_TOKEN`, sa bez neho čestne preskočia (skip), nie fingujú úspech.

## vendor/github-mcp-server binárka (nutná, nie je v git repe)

Stiahni verziu podľa svojho OS z [github/github-mcp-server releases](https://github.com/github/github-mcp-server/releases) (aktuálne v1.6.0) do priečinka `vendor/`.

**Windows (PowerShell):**
```powershell
mkdir vendor -Force
Invoke-WebRequest -Uri "https://github.com/github/github-mcp-server/releases/download/v1.6.0/github-mcp-server_Windows_x86_64.zip" -OutFile "$env:TEMP\gms.zip"
Expand-Archive -Path "$env:TEMP\gms.zip" -DestinationPath vendor -Force
```

**macOS (Apple Silicon):**
```bash
curl -sL -o /tmp/gms.tar.gz https://github.com/github/github-mcp-server/releases/download/v1.6.0/github-mcp-server_Darwin_arm64.tar.gz
mkdir -p vendor && tar -xzf /tmp/gms.tar.gz -C vendor github-mcp-server
chmod +x vendor/github-mcp-server
```

**Linux (x86_64) / WSL:**
```bash
curl -sL -o /tmp/gms.tar.gz https://github.com/github/github-mcp-server/releases/download/v1.6.0/github-mcp-server_Linux_x86_64.tar.gz
mkdir -p vendor && tar -xzf /tmp/gms.tar.gz -C vendor github-mcp-server
chmod +x vendor/github-mcp-server
```

Výsledok: `vendor/github-mcp-server` (Linux/Mac) alebo `vendor/github-mcp-server.exe` (Windows). Kód (`src/ingestion/githubMcpClient.ts`) si príponu podľa OS vyberie sám.

## Ako získať kľúče do .env

- `AZURE_OPENAI_API_KEY` / `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_DEPLOYMENT` — z vášho Azure OpenAI resource (Azure Portal → daný resource → Keys and Endpoint; deployment name z "Deployments" v Azure AI Foundry).
- `GITHUB_PERSONAL_ACCESS_TOKEN` — [github.com/settings/tokens](https://github.com/settings/tokens) → "Generate new token (classic)" → stačí bez zaškrtnutých scopes (len verejné repo čítanie) alebo scope `public_repo`. Bez tokenu server pri prvom volaní vypíše OAuth device-flow výzvu namiesto výsledku.

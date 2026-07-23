# DocWright

Vygeneruje README a one-screen architecture mapu pre verejný GitHub repozitár. MVP jadro podľa `tasks.md` (Phase 1-5, CLI-first).

## Stav

Implementované a naostro odskúšané (bez credentials, kde to bolo možné):

- `src/ingestion/` - reálny MCP klient nad `github-mcp-server` (stdio subprocess) + orchestrácia (file tree, manifesty, README, entry pointy)
- `src/templates/` - 4 first-class šablóny (library/cli/app/api) + auto-detekcia typu
- `src/config/` - `.docwright.json` parser (UC3)
- `src/generation/` - Azure OpenAI (GPT-5.6 Terra, Responses API) structured output + reálna Mermaid validácia (jsdom, žiadny Chromium)
- `src/cli/generate.ts`, `bin/docwright.js` - `docwright generate <repo_url>`
- `src/server.ts` - minimálny verejný HTTP wrapper (`POST /api/generate`, `GET /health`), bez databázy/fronty
- `docs/index.html` - statický frontend (formulár), určený na GitHub Pages

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

## Verejné nasadenie (Railway + GitHub Pages)

Rozhodnutie 23.7.2026: bez databázy/fronty (Article VII) - `src/server.ts` je synchrónny
request/response wrapper nad tým istým jadrom ako CLI (`src/core/runGeneration.ts`).
Backend beží na Railway (Dockerfile v roote), frontend je statický `docs/index.html`
na GitHub Pages.

### Backend na Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → vyber `docwright2`. Railway rozpozná `Dockerfile` v roote automaticky.
2. V Service → Variables nastav (rovnaké mená ako v `.env`):
   - `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT`
   - `GITHUB_PERSONAL_ACCESS_TOKEN`
   - (Railway nastavuje `PORT` sám - `src/server.ts` ho číta automaticky, netreba ho pridávať ručne.)
3. Service → Settings → Networking → Public Networking → "Generate Domain" - dostaneš verejnú URL (napr. `https://docwright2-production.up.railway.app`).
4. Over: `curl https://<tvoja-railway-url>/health` → `{"status":"ok"}`.

**Poznámka k cene:** Railway nemá trvalý free tier (len jednorazový $5 kredit na 30 dní, potom Hobby plan $5/mesiac) - vedomé rozhodnutie, keďže už máš účet.

### Frontend na GitHub Pages

1. V `docs/index.html` nahraď `API_BASE_URL` skutočnou Railway URL z kroku 3 vyššie.
2. Commitni a pushni zmenu.
3. Na GitHube: repo → Settings → Pages → Source: "Deploy from a branch" → Branch: `master`, priečinok `/docs` → Save.
   - **Ak je `docwright2` súkromný repozitár:** GitHub Pages pre private repo vyžaduje GitHub Pro/Team/Enterprise plán. Ak ho nemáš, buď repo dočasne zverejni, alebo frontend nasaď z osobitného verejného repozitára (obsahuje len statický HTML, žiadnu logiku ani kľúče).
4. Po pár minútach beží na `https://<tvoj-github-username>.github.io/docwright2/`.

### Ochrana pred zneužitím

Endpoint je verejný a bez API kľúčov (vedomé zjednodušenie - žiadna databáza v tejto fáze),
preto má `src/server.ts` jednoduchý in-memory rate limit: max 5 requestov/hodinu na IP adresu.
Reštart backendu limit vynuluje - je to len mäkká ochrana proti neúmyselnému zahlteniu
reálneho (plateného) Azure OpenAI resource, nie plnohodnotná auth vrstva.

# DocWiright

Vygeneruje README a one-screen architecture mapu pre verejný GitHub repozitár. MVP jadro podľa `tasks.md` (Phase 1-5, CLI-first).

## Stav

Implementované a naostro odskúšané (bez credentials, kde to bolo možné):

- `src/ingestion/` - reálny MCP klient nad `github-mcp-server` (stdio subprocess) + orchestrácia (file tree, manifesty, README, entry pointy)
- `src/templates/` - 4 first-class šablóny (library/cli/app/api) + auto-detekcia typu
- `src/config/` - `.docwright.json` parser (UC3)
- `src/generation/` - OpenAI (GPT-5.6 Terra) structured output + reálna Mermaid validácia (jsdom, žiadny Chromium)
- `src/cli/generate.ts`, `bin/docwright.js` - `docwright generate <repo_url>`

Návrhové dokumenty: `zadanie` (mimo tohto repa), `constitution.md`, `research.md`, `templates.md`, `tasks.md` - pozri projektovú dokumentáciu.

## Setup

```bash
npm install
cp .env.example .env
# vyplň v .env:
#   OPENAI_API_KEY=...
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

## Poznámka k inštalácii v CI/produkcii

Vyžaduje `vendor/github-mcp-server` binárku (Linux x86_64, stiahnutá z [github/github-mcp-server releases](https://github.com/github/github-mcp-server/releases), aktuálne v1.6.0) - nie je v git repe (binárka), stiahni pred prvým spustením:

```bash
curl -sL -o /tmp/gms.tar.gz https://github.com/github/github-mcp-server/releases/download/v1.6.0/github-mcp-server_Linux_x86_64.tar.gz
mkdir -p vendor && tar -xzf /tmp/gms.tar.gz -C vendor github-mcp-server
chmod +x vendor/github-mcp-server
```

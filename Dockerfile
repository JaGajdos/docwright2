# T-web-03: Dockerfile pre verejné nasadenie na Railway (užívateľské rozhodnutie 23.7.2026).
# Article VII (Simplicity Gate): jeden obraz, žiadny multi-stage build - spúšťame priamo
# cez tsx (rovnako ako lokálne), žiadny extra "npm run build" krok, aby sa neduplikovala
# komplexita len kvôli mierne menšiemu image-u.
FROM node:20-bookworm-slim

WORKDIR /app

# curl/tar/ca-certificates - na stiahnutie github-mcp-server binárky pri builde.
RUN apt-get update && apt-get install -y --no-install-recommends curl tar ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# github-mcp-server v1.6.0, Linux x86_64 (research.md #1) - stiahnuté pri build-e,
# nie commitnuté do git repa (rovnaká binárka ako v lokálnom vendor/ na Linuxe/WSL).
RUN mkdir -p vendor \
  && curl -sL -o /tmp/gms.tar.gz https://github.com/github/github-mcp-server/releases/download/v1.6.0/github-mcp-server_Linux_x86_64.tar.gz \
  && tar -xzf /tmp/gms.tar.gz -C vendor github-mcp-server \
  && chmod +x vendor/github-mcp-server \
  && rm /tmp/gms.tar.gz

COPY . .

# Railway nastaví PORT sám (server.ts ho číta z process.env.PORT) - EXPOSE je len
# dokumentačné, Railway ho nevyžaduje na fungovanie.
EXPOSE 8080

CMD ["npm", "start"]

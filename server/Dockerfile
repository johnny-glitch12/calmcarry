# CalmCarry API — multi-stage: full node:22 to build (better-sqlite3 toolchain),
# slim runtime image. Node 22 is LTS to April 2027 (node:20 hit EOL April 2026).
FROM node:22 AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
# Apple Root CA certs for StoreKit 2 receipt verification (APPLE_ROOT_CERTS_DIR)
COPY --from=build /app/certs ./certs

# NODE_ENV is provided at runtime by fly.toml [env] (development for the demo,
# production for the real launch) — not baked into the image.
EXPOSE 4000
CMD ["node", "dist/main.js"]

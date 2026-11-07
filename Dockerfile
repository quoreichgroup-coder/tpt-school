FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --workspaces=false

FROM deps AS source
COPY . .
RUN npx prisma generate

FROM source AS dev
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM source AS migrate
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM source AS builder
ENV DOCKER_BUILD=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]

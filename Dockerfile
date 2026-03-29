FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY . .

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl wget \
  && rm -rf /var/lib/apt/lists/*

RUN npm --version \
  && npm ci --no-audit

ENV CCO_ASSUME_BUILD_CONTEXT_TRACKED=1

RUN npm run build -w @contentco-op/home

# Copy static assets into the standalone output (Next.js standalone
# mode does NOT bundle _next/static or public — they must be copied).
RUN cp -r apps/home/.next/static apps/home/.next/standalone/apps/home/.next/static \
  && cp -r apps/home/public apps/home/.next/standalone/apps/home/public

# --- Production image ---
FROM node:20-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl wget \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/apps/home/.next/standalone ./
COPY --from=builder /app/apps/home/.next/static ./apps/home/.next/static
COPY --from=builder /app/apps/home/public ./apps/home/public

ENV NODE_ENV=production
ENV PORT=4100
ENV HOSTNAME=0.0.0.0
EXPOSE 4100

CMD ["node", "apps/home/server.js"]

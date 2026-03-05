FROM node:20-bookworm-slim

WORKDIR /app

COPY . .

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare npm@11.9.0 --activate \
  && npm ci \
  && npm run build -w @contentco-op/home

ENV NODE_ENV=production
EXPOSE 4100

CMD ["npm","run","start","-w","@contentco-op/home"]

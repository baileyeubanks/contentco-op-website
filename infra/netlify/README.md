# Netlify Multi-Site Setup

Use one repository with three Netlify sites.

## Site mapping

1. `contentco-op-home` -> `contentco-op.com` and `www.contentco-op.com`
2. `contentco-op-coedit` -> `coedit.contentco-op.com`
3. `contentco-op-coscript` -> `coscript.contentco-op.com`

## Config files

1. `infra/netlify/home.netlify.toml`
2. `infra/netlify/coedit.netlify.toml`
3. `infra/netlify/coscript.netlify.toml`

## Create/link each site

```bash
# run from repository root
npx netlify link --name contentco-op-home
npx netlify deploy --prod --dir=. --functions=. --config=infra/netlify/home.netlify.toml
```

Repeat with each site name and config.

## Required environment variables

1. `CCO_INVITE_CODE`
2. `NEXT_PUBLIC_SUPABASE_URL`
3. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. `SUPABASE_SERVICE_KEY`
5. `OPENAI_API_KEY`
6. `YOUTUBE_API_KEY`
7. `APIFY_TOKEN`
8. `APIFY_TIKTOK_ACTOR_ID`


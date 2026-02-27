# Domain Policy

Canonical model:

1. `contentco-op.com` -> flagship home
2. `coedit.contentco-op.com` -> Co-Edit product
3. `coscript.contentco-op.com` -> Co-Script product

Redirect policy:

1. `www.contentco-op.com` -> `https://contentco-op.com` (301)
2. `content-co-op.com` -> `https://contentco-op.com` (301)

Guardrails:

1. Home cannot deploy Co-Edit or Co-Script app shells.
2. Product sites cannot serve marketing homepage fallback routes.
3. Each site has independent Netlify config and env scopes.


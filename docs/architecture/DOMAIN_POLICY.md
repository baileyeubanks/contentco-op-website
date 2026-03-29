# Domain Policy

Canonical model:

1. `contentco-op.com` -> flagship home
2. `co-cut.contentco-op.com` -> Co-Cut product
3. `co-script.contentco-op.com` -> Co-Script product
4. `co-deliver.contentco-op.com` -> Co-Deliver product

Redirect policy:

1. `www.contentco-op.com` -> `https://contentco-op.com` (301)
2. `content-co-op.com` -> `https://contentco-op.com` (301)

Guardrails:

1. Home cannot deploy Co-Cut, Co-Script, or Co-Deliver app shells.
2. Product sites cannot serve marketing homepage fallback routes.
3. Each product has its own repo/runtime boundary and env scope.

# System Surfaces

## 1. Home (`contentco-op.com`)

Purpose: narrative trust and action routing.

Above-the-fold:

1. Full viewport hero video with text-safe compositing.
2. Left-aligned message with one primary value proposition.
3. Exactly three approved support frames: `context`, `trust`, `process`.
4. CTAs: Open Co-Edit, Open Co-Script, Start Energy Brief.

## 2. Co-Edit (`coedit.contentco-op.com`)

Purpose: timecoded review and accountability.

Primary routes:

1. `/` queue
2. `/asset/:id` review stage
3. `/asset/:id/compare` version compare
4. `/approvals`
5. `/projects`

## 3. Co-Script (`coscript.contentco-op.com`)

Purpose: signal-first script generation.

Primary routes:

1. `/` studio
2. `/watchlists`
3. `/outliers`
4. `/vault`
5. `/script/:id`

## Access model

1. Public landing on Home only.
2. Invite-only login for Co-Edit and Co-Script.
3. All review/approval/script routes behind middleware session checks.


# Host cutover — CCO OS vs Co-VideoPro

## Target

| Host | Runtime |
|---|---|
| `contentco-op.com` | Home public (`apps/home`) — marketing only |
| `admin.contentco-op.com` | Same home runtime, land on **`/os`** (CCO OS commercial) |
| `co-videopro.com` | Co-VideoPro (`cco-videopro-definitive-20260715`) port **4103** |
| `client.contentco-op.com` | Co-VideoPro client role |

## Forbidden

- Mission Control `:4300` tunnel (`cco-mission-control`)
- `root.contentco-op.com` / `:4101` “CCO Root”
- Serving marketing homepage as the only admin surface without `/os`
- Co-VideoPro claiming `admin.contentco-op.com` as staff (proxy 308 → CCO OS)

## Cloudflare / tunnel actions (M4)

1. Point `admin.contentco-op.com` at the home runtime that serves `/os` (same pool as apex, or dedicated CCO OS service on home).
2. Disable/delete tunnel hostname bindings named `cco-mission-control` or routing to `:4300`.
3. Remove `root.contentco-op.com` public hostname if still live.
4. Keep `co-videopro.com` on Co-VideoPro `:4103` (`next start`, never `next dev` in prod).

## Proof

```bash
curl -sI https://admin.contentco-op.com/os | head -5
curl -sI https://admin.contentco-op.com/root | head -5   # expect 308 → /os
curl -sI https://co-videopro.com/ | head -5
# Hitting CVP code with Host: admin.contentco-op.com must 308 to CCO OS /os
```

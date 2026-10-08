# CCO client-link deployment handoff — S2 (M2 source packet)

Source and synthetic tests are complete; this document authorizes no runtime operation. Builder owns the SF5 rebase, matching-install/CI checks and release order: #17 → SF5 → aperture mark → Bailey-approved batch publish → token packet.

## Key path and provisioning

D10 proposed path: `~/.config/blaze-secrets/cco-website/client-link.key`, under the publishing runtime user's home (M4 publishing-host proposal in the packet; verify the actual CCO host/user before provisioning). Expand it to an absolute path in the runtime wrapper's `CCO_CLIENT_LINK_KEY_FILE`; Node does not expand `~` or `$HOME` in this value. The environment contains the path only.

Provisioning is an operator step in the approved deployment window, including any CCO failover host. The keyring must be a regular non-symlink file owned by the runtime UID, mode 0600 or stricter. Each line is a short key ID, one space and a 32-byte hex key. First line signs; all listed lines verify. No key material is included here and no production key has been created by S2.

Restart after changing the file: keyrings are process-cached. Rotate yearly or on suspected leak as policy only; actual rotation needs Bailey's approval. Retain the prior verification key until its issued capabilities expire (at most 30 days). Remove the retired environment signing secret in the same approved window. Never log, screenshot, commit or pass key values in argv.

## SF5 and operator checks

Replace S2's local Cloudflare header-key implementation with SF5 getRateLimitClientKey. Re-verify X2 invoice pay's hotfix404 and its deferred limiter test. Keep D1 /client/portal closed and /api/client/portal absent.

Fresh quote/invoice URLs come from explicit operator share-link POST actions (30 days); reminders issue 30-day invoice URLs only when the operator-triggered reminder lane runs. Portal row and Stripe cancel URLs last seven days. Public renderers forward the supplied capability and never mint from a bare ID. CC-only reads reject missing/null/non-CC units.

After deployment, Bailey can request and manually resend fresh links for open items. Old bare IDs and weak portal tokens receive the same no-data grace page with service@contentco-op.com as the only company contact. S2 sent no email and made no Stripe, production DB or live-site request. No migration is needed.

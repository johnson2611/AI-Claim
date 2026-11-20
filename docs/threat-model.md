# Threat model (hackathon scope)

| Threat | Mitigation | Status |
| --- | --- | --- |
| Customer reads another customer's claim or photos | Ownership check on every route; 403 otherwise; photos served only through authenticated API calls | Implemented, needs test run |
| Client claims to be an officer | Role read from DB per request; `set-role` script only | Implemented |
| Abuse of the AI endpoint / quota | App Check enforced for AI Logic; rate limits on API | Enable in console |
| Malicious upload (wrong type, huge, disguised) | Type and size schema; server verifies size, magic bytes and SHA-256 before saving; rejects mismatches | Implemented; malware scan stubbed |
| Prompt injection via narrative | Narrative labelled untrusted in the prompt; strict JSON schema; output validated; no tool access; AI cannot change status | Implemented; test with adversarial narratives |
| AI states unsupported facts | "Use only supplied facts" instruction; uncertainties field; human review; test set | Needs manual evaluation |
| Sensitive data in logs | Error handler never logs bodies; telemetry schema has no content fields | Implemented |
| Secrets in repo | `.gitignore`, `.env.example`, key path outside repo | Check git history before publishing |
| Debug App Check token shipped | Debug flag is gated on `import.meta.env.DEV` | Implemented |
| Unsent report mistaken for submitted | Drafts local until `submit`; offline message; receipt only after server confirms | Implemented |

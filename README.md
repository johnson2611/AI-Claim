# AI Insurance Claims Assistant

A local-first, human-in-the-loop **motor-insurance first-notice-of-loss (FNOL)** workspace built for BuildHybridAI 2026 (Web / Chrome track).

A customer reports an incident, attaches photos and gets help spotting what is missing. AI drafts a neutral summary using **Firebase AI Logic hybrid inference**: on-device in Chrome when available, cloud fallback otherwise. A claims officer then reviews the case with the original statement, evidence, AI draft and audit trail side by side.

> **AI assists; people decide.** The app never approves, rejects, prices or settles a claim, and never infers fault, fraud or coverage.

**Demo data only.** Use fictional policyholders, vehicles and synthetic photos.

## How Firebase AI Logic is used

| Where | What |
| --- | --- |
| `apps/web/src/lib/firebase/ai.ts` | Creates the hybrid model with `getGenerativeModel(ai, { mode: InferenceMode.… })`, reads `response.inferenceSource` to report the *actual* route, checks Chrome Prompt API availability, and computes the fallback reason. |
| `apps/web/src/features/ai-assistant/caseSummary.ts` | Case-summary task. With cloud consent it uses `PREFER_ON_DEVICE`; without it, `ONLY_ON_DEVICE`. Output is parsed as JSON and validated against a Zod schema before display. |
| `apps/web/src/features/ai-assistant/HybridLab.tsx` | `/lab` page: pick any of the four inference modes and see the real route, latency and fallback reason. Use it to record the judging evidence. |
| `apps/api` `POST /api/claims/:id/ai-analyses` | Stores route / task / latency / fallback reason only. Never prompts, narratives or images. |

App Check protects the AI calls (`apps/web/src/lib/firebase/app.ts`). The Node API can verify App Check tokens too (`APPCHECK_ENFORCE=true`).

## Prerequisites

- Node.js 20+ and npm 10+
- Docker (for local PostgreSQL), or any PostgreSQL 14+ instance
- A Firebase project with: **Authentication** (Email/Password), **AI Logic** (Gemini Developer API), **App Check** (reCAPTCHA v3). No Blaze plan or Cloud Storage is needed: photos are stored on local disk.
- **Desktop Chrome 139+** to see the on-device route. Firebase AI Logic JS SDK 12.5.0+ is required for on-device inference. Check the [Chrome built-in AI docs](https://developer.chrome.com/docs/ai/built-in) for hardware and flag requirements.

## Quick start

```bash
npm install

# 1. Database
npm run db:up
cp apps/api/.env.example apps/api/.env      # then fill in the Firebase values
npm run db:migrate                          # creates the first migration

# 2. Web config
cp apps/web/.env.example apps/web/.env      # then fill in the Firebase web config

# 3. Run
npm run dev:api     # http://localhost:4000
npm run dev:web     # http://localhost:5173
```

### Firebase setup checklist

1. **AI Logic**: Firebase console → AI Services → AI Logic → Get started → choose *Gemini Developer API*. The guided setup enforces App Check for AI Logic.
2. **App Check**: register the web app with reCAPTCHA v3; put the site key in `VITE_RECAPTCHA_SITE_KEY`.
   For local development, run the web app with `VITE_APPCHECK_DEBUG=true`, copy the debug token printed in the browser console, and register it under App Check → Apps → Manage debug tokens. Debug mode is compiled out of production builds.
3. **Authentication**: enable Email/Password and create demo users (one customer, one officer).
4. **Service account (API only)**: download a key to a path **outside this repo** and point `GOOGLE_APPLICATION_CREDENTIALS` at it. On Cloud Run, attach a service account instead.

### Make an officer account

Roles live in the database and are changed only server-side:

```bash
# sign in once as that user, copy their Firebase uid from the console, then:
npm run set-role -w @claims/api -- <firebase-uid> OFFICER
npm run db:seed -- <customer-firebase-uid>    # optional: synthetic claims for the queue
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev:web` / `dev:api` | Start the web app / API |
| `npm run typecheck` | Type-check all workspaces |
| `npm test` | Unit tests (status machine, completeness, AI schema) |
| `npm run build` | Production build of the web app |

## Project layout

```
apps/web        React + TypeScript + Vite customer wizard, officer console, AI route lab
apps/api        Node.js + Express + Prisma: cases, evidence (local disk), review, audit, authorisation
packages/shared Zod schemas, status machine and completeness rules shared by both
docs/           architecture, threat model, test plan, demo script
```

## Security notes

- Role checks are enforced by the API from the database. The browser never decides who is an officer.
- Photos are saved to a private folder on the API host (`EVIDENCE_DIR`, default `apps/api/data/evidence`). The browser can fetch a photo only through an authenticated API call, and each upload is verified (size, file signature and SHA-256 checksum) before it counts.
- No claim text or image bytes in logs or AI telemetry. Audit events store field names, routes and counts.
- Rate limits on claim creation, uploads and AI telemetry. Request bodies are capped at 100 KB.
- See `SECURITY.md` and `docs/threat-model.md`.

## Status of this scaffold

Verified when generated: shared tests pass, web app type-checks and builds, API type-checks against the generated Prisma client. **Not yet verified**, because they need your Firebase project and database: the API running end to end, signed uploads, App Check enforcement, and the on-device route on your Chrome.

Known gaps to close (see `docs/test-plan.md`):

- Photos are stored on the API host's disk, which suits local use and a recorded demo. A public deployment needs object storage (Firebase Storage on the Blaze plan, or an S3-compatible store such as Cloudflare R2). All storage code is in `apps/api/src/storage/local.ts` and `modules/evidence/evidence.router.ts`.
- `prepareOnDeviceModel` in `ai.ts` uses Chrome's Prompt API directly. Compare it with step 6 of the [Firebase hybrid guide](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started) and use the SDK's own initialisation helper if it provides one.
- Image analysis is not implemented (cloud-only, consent-gated stretch feature). Photos are never sent to a model today.
- Offline: drafts persist locally and nothing is marked submitted while offline, but uploads are not queued for later.
- Malware scanning is a stub (`scanStatus` is set to `SKIPPED`).
- The Node API needs its own HTTPS host (for example Cloud Run). `firebase.json` hosts the web app only.
- No ESLint config yet; Prettier is included (`npm run format`).

## Licence

MIT. See `LICENSE`.

# Architecture

```
Browser (React + TS)
  ├─ Firebase Auth ──────────────► ID token
  ├─ Firebase AI Logic (hybrid) ─► on-device (Chrome Prompt API)  or  cloud Gemini
  │     protected by App Check
  └─ Node API (Express) ─────────► PostgreSQL (Prisma)
        verifies ID token (+ optional App Check)
        owns roles, state machine, audit, consent
        stores photos ───────────► local disk (private folder)
```

## Responsibilities
- **Web**: wizard, evidence UI, route-aware AI assistant, officer console.
- **AI access**: Firebase AI Logic only. There is no direct Gemini REST call.
- **API**: authorisation, validation (Zod), the claim state machine (`packages/shared/src/status.ts`), audit events, upload authorisation.
- **Shared**: schemas, status transitions and completeness rules used by both sides, so the UI and the API agree.

## Claim states
`DRAFT → SUBMITTED → UNDER_REVIEW → (MORE_INFO_REQUIRED → SUBMITTED) | REVIEWED`
Every transition writes a `ClaimEvent` with actor and timestamp.

## AI data flow
1. User starts an AI action and sees what will be processed.
2. App checks Chrome's on-device availability.
3. Without cloud consent: `ONLY_ON_DEVICE`. With consent: `PREFER_ON_DEVICE`.
4. `inferenceSource` on the response tells us the real route. The UI shows it.
5. Output is JSON-parsed and Zod-validated. Failures are rejected, not displayed.
6. Telemetry (task, route, status, latency, fallback reason, prompt version) goes to the API. Never content.
7. The result is a draft. The customer edits and confirms; an officer reviews.

## Separation of data
Original customer statements (`ClaimCase.narrative`) are never modified by AI. AI output is stored in `aiDraft`. The officer's reviewed text is `officerSummary`.

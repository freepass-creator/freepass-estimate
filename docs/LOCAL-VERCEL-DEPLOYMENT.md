# Local Windows → Vercel deployment

This repository is prepared for one codebase to run in two places:

```text
Windows local clone
  └─ apps/new
      ├─ Vite UI
      └─ local Vite middleware -> same api/*.js handlers

Vercel
  └─ Root Directory: apps/new
      ├─ Vite static build -> dist
      └─ api/*.js -> Vercel Functions
```

The local development server does **not** maintain a second pricing or persistence implementation. It invokes the same API handler modules that Vercel deploys.

## 1. Windows prerequisites

Use **Node.js 24.x**. The version is pinned in `apps/new/package.json`.

PowerShell:

```powershell
git clone https://github.com/freepass-creator/freepass-estimate.git
cd freepass-estimate\apps\new
node --version
npm ci
```

The expected Node major is `v24`.

## 2. Local environment

Create a local environment file from the template:

```powershell
Copy-Item .env.example .env.local
```

Fill in real values locally. Never commit `.env.local`.

Required for a deployed environment:

- `FREEPASS_DATA_CONSUMER_BASE_URL` — HTTPS FreePass Data consumer gateway.
- `FREEPASS_DATA_ESTIMATE_TOKEN` — server-only service token. Never use a `VITE_` prefix.
- `FREEPASS_FIREBASE_PROJECT_ID` — Firebase project used to verify caller ID tokens.
- At least one write selector: `FREEPASS_ESTIMATE_REQUIRED_WRITE_ROLES` or `FREEPASS_ESTIMATE_ALLOWED_WRITE_UIDS`.
- `FREEPASS_ESTIMATE_ALLOW_ANONYMOUS_WRITES=false`.
- `VITE_FREEPASS_QUOTE_WRITE_MODE=CANONICAL_ONLY`.
- `VITE_AGENT_PIN` — browser-visible UI gate value only. This is **not** a security credential.

Optional explicit Quote/Share command/read URLs may be provided; otherwise the APIs derive them from `FREEPASS_DATA_CONSUMER_BASE_URL`.

## 3. Local verification

```powershell
npm run check:deploy-env
npm run verify
npm run dev
```

`npm run dev` serves the UI on Vite and maps the top-level `/api/*` endpoints to the same handler modules under `apps/new/api`.

Important smoke checks:

- `/api/version` returns JSON.
- `/api/freepass-data-master` can read the active FreePass Data master.
- `/api/standard-quote` calculates one canonical quote.
- `/api/standard-quote-batch` calculates home/guide preview batches.
- Quote/Share write APIs reject callers that do not satisfy Firebase ID-token + role/UID policy.

## 4. Create the Vercel project

At the time this guide was added, the connected Vercel team had no project yet.

Create/import one from:

`freepass-creator/freepass-estimate`

Set:

- **Root Directory:** `apps/new`
- **Framework:** Vite

Do not set the repository root as the Vercel project root. The Vercel Functions live under `apps/new/api`.

The repository's `apps/new/vercel.json` fixes:

- install: `npm ci`
- build: `npm run build:vercel`
- output: `dist`
- framework: `vite`

## 5. Configure Vercel environment variables

Add the required variables from `.env.example` to both **Preview** and **Production** as appropriate.

`npm run build:vercel` runs the strict environment guard first. A Vercel build fails instead of silently deploying when:

- FreePass Data URL/token is missing,
- the Data URL is not HTTPS,
- Firebase project ID is missing,
- no write role/UID selector is configured,
- anonymous canonical writes are enabled,
- legacy RTDB Quote writes are not set to `CANONICAL_ONLY`,
- the UI gate value is left implicit.

## 6. CLI link and preview deployment

After the Vercel project exists:

```powershell
cd freepass-estimate\apps\new
vercel login
vercel link
vercel pull --yes --environment=preview
vercel build
vercel deploy --prebuilt
```

Verify the preview URL before production.

## 7. Production deployment

```powershell
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

The build artifact tested by `vercel build --prod` is the artifact deployed with `--prebuilt --prod`.

## 8. Deployment boundary

A successful Git/Vercel build does not grant FreePass Data access by itself.

Production is healthy only when:

1. FreePass Data has an ACTIVE canonical vehicle/master release.
2. Estimate Functions can authenticate to the Data consumer boundary.
3. pricing-engine and price-basis evidence is verified.
4. canonical Quote/Share writes return durable receipts.
5. Firebase caller authorization is enforced server-side.
6. no new legacy RTDB Quote write path is enabled.

Legacy RTDB compatibility readers/chat code must not be interpreted as permission to reactivate RTDB as a new source of truth.

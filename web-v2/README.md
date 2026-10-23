# Origo web (v2)

A ground-up redesign of the web experience, built **only from `docs/spec/PRODUCT_SPEC_WEB.md`** (and the backend's response schemas). It shares no UI code with `web/frontend`.

Next.js 16 · React 19 · Tailwind 4 · TypeScript · axios.

## Run

```bash
cd web-v2
cp .env.example .env.local     # NEXT_PUBLIC_API_URL → web/backend (8001), NEXT_PUBLIC_FIELD_API_URL → api (8000)
npm install
npm run dev                    # http://localhost:3000
```

## What's here

| Area | Routes |
|---|---|
| Public | `/` landing + batch-code lookup · `/batch/[code]` consumer batch history |
| Auth | `/signin` · `/signup` (exporter / farmer) · Google via `/api/auth/callback/google` |
| Account | `/account` (farmer / collector / admin overview) |
| Exporter | `/exporter` overview · `profile` · `standards` (+ version editor) · `ads` (+ applicants, performance) · `farmers` · `planting-notices` (+ responses, reminders) · `stage-proofs` |
| Admin | `/admin` · `exporters` (verification) · `ads` (moderation, reports) · `users` |

## Where the design differs from the spec's "current build"

These come straight from the spec's gap list (§9):

- Field-level validation errors are shown on the field (gap 4).
- The standard editor authors `dos`/`don'ts` and **required proof** (photo count, descriptions, quick fields) and can **start from a template** (gaps 6, §5.3.5).
- The company profile edits `crops_bought` and `logo_url` (gap 7).
- Ad dates are Sri Lanka calendar days; expiry and collection end run to 23:59:59 local (gap 11).
- Admin report review / dismiss controls exist (gap 14).
- The farmer-link "Past" view merges declined / removed / cancelled instead of filtering a single page client-side (gap 9).
- A wrong-role visit is redirected; an expired session returns to sign-in with an explanation.
- The ad form uses the term fields the backend actually accepts: payment timing, rejection handling, other.

## Not covered (no web API surface in the spec)

Buyer commitments and audit tools (gaps 16–17) are backend-only today. Password reset, profile editing and deactivation enforcement need backend work.

# Origo — Web Product Specification

Audience: a designer who has never seen the current product.
Scope: everything the web experience must let people do, what data is involved, which calls move that data, the rules that constrain it, and the edge cases.
Deliberately **not** covered: layout, components, colors, typography, navigation structure, screen arrangement. Those are yours to decide. Where the current build does something structural (for example "a status filter with four values"), only the *information model* behind it is recorded.

The companion document `PRODUCT_SPEC_MOBILE.md` covers the Android field app. The two share one account system and one set of business objects.

---

## 1. Product context

Origo is a traceability and sourcing platform for Sri Lankan export crops (currently **tea** and **cinnamon**; some supplier-side data also mentions pepper, coffee and cardamom). It connects four kinds of people:

| Actor | Where they mainly work | Purpose |
|---|---|---|
| **Farmer** | Mobile app | Registers land, records planting and harvest, proves compliance, applies to buyer orders |
| **Collector** | Mobile app | Buys leaf from several farmers and combines it into one outgoing batch |
| **Exporter** | **Web** | Defines quality standards, advertises purchase requests, manages their farmer network, announces planting seasons, reviews proof |
| **Admin** | **Web** | Verifies exporters, manages accounts, moderates ads |
| **Consumer / anyone** | Public web page, no account | Scans a batch QR and reads where the product came from |

The web experience therefore has three authenticated workspaces (exporter, admin, and a very thin farmer account overview) and one public, unauthenticated page.

### 1.1 Two back-ends (matters for error shapes)

- **Account & marketplace service** (`web/backend`): accounts, exporter profile, standards, ads, applicants, farmer links, planting notices, reminders, stage proofs, admin tools. Errors look like `{ "detail": "<human message>" }`; validation failures may return `detail` as a **list** of `{msg, loc, type}` objects.
- **Field-data service** (`api`): plots, batches, events, photos, protocols, commitments, the public provenance page. Errors look like `{ "error": { "code", "message", "details" } }`.

The web app talks almost entirely to the first. It touches the second only through the public provenance page.

### 1.2 Content languages

Exporter-authored content (ad titles/descriptions, standard stage instructions, notice titles/messages) is stored in **English, Sinhala and Tamil**. English is mandatory everywhere it appears; Sinhala and Tamil are optional. The authoring tool itself is English only. Farmers see content in their device language with English fallback (see mobile spec).

### 1.3 Shared vocabularies

- **Crops** for ads, standards and notices: `tea`, `cinnamon` only. The farmer-network filter additionally offers `Pepper`, `Coffee`, `Cardamom` (they come from farmers' own recorded crops, which are free text on mobile).
- **Districts** (25): Ampara, Anuradhapura, Badulla, Batticaloa, Colombo, Galle, Gampaha, Hambantota, Jaffna, Kalutara, Kandy, Kegalle, Kilinochchi, Kurunegala, Mannar, Matale, Matara, Monaragala, Mullaitivu, Nuwara Eliya, Polonnaruwa, Puttalam, Ratnapura, Trincomalee, Vavuniya. Anywhere an exporter picks districts, **an empty selection means "all districts"**.
- **Currency**: LKR. **Quantities**: kilograms. **Land**: hectares.
- **Certifications** an exporter can declare: Organic, Rainforest Alliance, Fairtrade, Other.

---

## 2. Cross-cutting rules

### 2.1 Authentication and session
- Email + password sign-in; Google sign-in as an alternative.
- Success returns `{ access_token, token_type: "bearer", role }`. Tokens are JWTs that **last 30 days**. There is **no refresh token and no server-side logout**; "log out" simply discards the token locally.
- The role decides which workspace a person enters after sign-in: exporters go to the exporter workspace; everyone else lands on the shared account overview (admins see entry points to the admin tools from there).
- Every workspace re-checks the role on entry. A wrong-role visitor is redirected to their own workspace; a missing/invalid token clears the session and returns to sign-in. Session-expiry is therefore felt as "I was sent back to sign-in", with no explanation in some workspaces and a short message ("Session expired or invalid. Please sign in again.") in the account overview.
- **Deactivated accounts are not blocked.** An admin can flip an account to inactive, and that flag is stored and displayed, but sign-in and token validation do not check it. See §9.

### 2.2 Verification gating (exporters)
New exporters start `pending`. A **verified** status is granted by an admin. Unverified exporters can *prepare* things but cannot *commit* them. Enforced **server-side** (403 "Your exporter account is not yet verified.") for:

| Gated (verified only) | Not gated (allowed while pending) |
|---|---|
| Publish a standard version | Create/edit standards, drafts, duplicate, archive |
| Publish an ad version; close an ad | Create/edit ad drafts, duplicate, view stats |
| Approve / decline an ad applicant | View applicants |
| Approve / decline / remove a farmer link | View farmer links and details |
| Publish / cancel a planting notice | Create/edit/duplicate notice drafts, view responses |
| Retry failed reminder deliveries | View reminder status |
| Approve / reject / reopen a stage-proof submission | View submissions |

The interface should make this state legible everywhere it bites (the current build repeats a "verification required" explanation next to each gated action and disables the control).

### 2.3 Collections
All list endpoints share one convention: query `page` (1-based), `page_size`; response `{ items, total, page, page_size, total_pages }`, often plus counters (`pending_count`, `counts`). Filters reset the page to 1.

### 2.4 Immutability and versioning (important product principle)
Published things never change; to alter them you create a new version.
- **Standards** and **ads** have numbered versions: `draft` → `published`. Only **one draft** may exist at a time. A new draft copies the latest published version.
- **Planting notices** are editable only while `draft`; once published they are immutable.
- Farmers' acceptances of an ad are bound to a specific ad **version** plus a hash of its terms; a stale version is rejected with 409 "Ad was updated, reload."
- Field **events** (the audit trail behind provenance) are **append-only** at the database level: no update, no delete.

### 2.5 Dates
Date inputs on ads are date-only; the build converts them to an ISO timestamp at **00:00 UTC** of the chosen day. Practical consequence: "expires on 31 Dec" means the ad ends at the *start* of 31 Dec UTC (early morning 5:30 in Sri Lanka). Notices use a **month** (`YYYY-MM`, stored as the 1st of the month).

### 2.6 Error handling expectations
- Service errors surface the server's `detail` text verbatim; keep messages short and actionable.
- If `detail` is not a plain string (validation lists), the sign-in/sign-up flows fall back to a generic message ("Login failed" / "Registration failed…") — the specific field problem is lost. A redesign should render field-level errors.
- Lists have explicit loading, empty (with different copy for "nothing exists" vs "nothing matches your filter"), error-with-retry states.

### 2.7 Feature flags (can be turned off per deployment)
`ENABLE_EXPORTER_ADS`, `ENABLE_EXPORTER_FARMERS`, `ENABLE_PLANTING_NOTICES`, `ENABLE_STAGE_PROOFS`, `ENABLE_AD_STATS`, `ENABLE_AD_ACCEPTANCE` (applicants), `ENABLE_NOTICE_REMINDERS`, `ENABLE_AD_MODERATION`. Default is **on**. When off, the capability is hidden (admin moderation renders nothing; backend answers 404 "module disabled").

---

## 3. Unauthenticated capabilities

### 3.1 Sign in
- **Inputs**: email (valid email format), password. Both required.
- **Call**: `POST /auth/login {email, password}` → `{access_token, role}`.
- **Failures**: 401 "Invalid email or password" (same message whether the email exists or not); 422 on malformed email (shown generically).
- **Rules**: no lockout, no rate limit, no password-reset flow, no "remember me", no email verification anywhere in the product.

### 3.2 Google sign-in / registration
- **Calls**: `GET /auth/google` → `{url}` (redirect to Google); Google returns to the web app, which exchanges the code via `GET /auth/google/callback?code=…` → `{access_token, role}`.
- **Account matching**: first by Google id; else by email (the Google id is then attached to the existing account); else a **new farmer** account is created with only email and name (no phone, NIC, district, farm data).
- **Edge cases**: a new Google user is always a farmer — there is no way to become an exporter via Google. After a successful Google sign-in the web app always routes to the account overview (exporters are then bounced to their own workspace). If Google rejects the code or the user denies consent, the person returns to sign-in with an error message. A Google-created farmer has an incomplete profile that the mobile app cannot complete (it has no profile editor).

### 3.3 Register as a farmer
- **Inputs (all required)**: full name, email, password, phone, NIC, district, DSD, GN division, farm address, farm size (hectares).
- **Client validation**: every field required; farm size ≥ 0.1, step 0.1; non-numeric farm size silently becomes 0.
- **Call**: `POST /auth/signup/farmer` with the above (`nic` plus `farm_size_ha` as number) → signs the user in.
- **Server rules**: email must be unique (400 "Email already registered") and valid; NIC is **hashed with a salt and never readable again**; passwords are hashed. **No** password-strength rule, **no** phone or NIC format check, **no** limit on farm size.
- **Edge cases**: district is free text here (not the 25-district list), so a farmer can type something that never matches an exporter's eligible-district list (matching is by case-insensitive text for ads, **case-sensitive exact text** for planting notices) — they will then silently never see those opportunities.

### 3.3a Register as an exporter
- **Inputs (all required)**: representative name, work email, password, contact phone, business/company name, business registration number, business address, export licence number.
- **Call**: `POST /auth/signup/exporter`.
- **Result**: account created (role `exporter`) and signed in. An **exporter profile** (status `pending`) is created on first load of the workspace, seeded from these answers.
- **Rules**: duplicate email → 400. Registration number must be unique across exporter *profiles* (enforced when the profile is created/edited, not at sign-up — so a duplicate can surface later as a generic save failure).
- **Note**: signup calls the licence `export_license_no`; the profile calls it `export_licence_no`. Business address is captured at sign-up but is not part of the editable profile.

### 3.4 Public batch history (consumer) — see §7.

---

## 4. Farmer account overview (web)

Farmers have almost no web functionality; everything operational is on mobile.

- **Shows**: user id, email, role, and (if present) phone, district, business name. Non-exporters see a generic "farmer portal" welcome.
- **Call**: `GET /auth/me` → user record (password hash, NIC hash/salt removed).
- **Rules**: exporters are redirected away; an invalid session clears the token, shows the expiry message, and returns to sign-in after ~1.5 s.
- Admins also land here first and are offered entry points to user management and exporter verification.
- **Gaps for the designer**: no profile editing, no password change, no farm/plot/batch view on web. If farmers should use the web, this is a blank slate.

---

## 5. Exporter workspace

Every exporter capability starts from the exporter's own **profile** (status drives gating — see §2.2). The workspace also needs to display, persistently, the company name and the verification state: `pending` ("Pending verification"), `verified`, `rejected` ("Account rejected", with reason).

### 5.1 Overview
- **Shows**: verification state with explanatory text (pending: "usually 1–2 business days"; rejected: the admin's reason plus advice to update the profile and contact the administrator); counts of crops bought, districts served, certifications; entry points to every capability.
- **Call**: `GET /api/exporter/me` (creates the profile on first call).
- Note: copy says exporters can "browse and connect with farmers", but connection is **farmer-initiated** only — exporters can only accept/decline.

### 5.2 Company profile
- **Data**: company name\*, business registration no\*, export licence no, contact person, phone, business email, description, districts served (multi-select of 25), certifications (multi-select), plus read-only status and rejection reason. `crops_bought` and `logo_url` exist on the record but have **no editing control** in the current build (crops default to tea + cinnamon; no logo upload).
- **Calls**: `GET /api/exporter/me`; `PUT /api/exporter/me` with any subset of the editable fields. Status and rejection reason are never writable by the exporter.
- **Validation**: company name and registration number must be non-blank (client). Server: registration number unique.
- **Edge cases**: a rejected exporter can still edit the profile (there is no resubmission action — the admin must "reopen" the application, see §6.2). Saving shows a transient success message. Empty districts → helper text "Select the districts you source from."

### 5.3 Quality standards
A **standard** is a crop-specific specification an exporter defines once and then references from ads and notices. A standard has a crop, an archived flag, and numbered **versions**; each version has a name, a free-form **grade specification**, and an ordered list of **stages**.

#### 5.3.1 Browse standards
- **Data per standard**: id, crop, archived flag, versions (number, name, status draft/published, published_at). Derived summary: "vN Published", "Draft vM", or both.
- **Filters**: crop (all/tea/cinnamon); archived vs active (archived shown only on request).
- **Call**: `GET /api/exporter/standards?crop&is_archived&page&page_size`.

#### 5.3.2 Create a standard
- **Inputs**: crop (tea | cinnamon), name (required, trimmed).
- **Call**: `POST /api/exporter/standards {crop, name, grade_spec: {}, stages: []}` → creates the standard and **version 1 as a draft**; the user continues straight into editing it.
- **Edge**: a standard with no stages can exist as a draft but cannot be published.

#### 5.3.3 Version history of one standard
- **Data**: all versions with name, status, published timestamp.
- **Actions**: open a version; **create new draft** (copies latest published; disabled while a draft exists or if nothing is published yet); **duplicate** the whole standard (creates a new standard and navigates to it); **archive / unarchive**.
- **Calls**: `GET /api/exporter/standards/{id}`; `POST …/versions`; `POST …/duplicate`; `POST …/archive`; `POST …/unarchive`.
- **Errors**: 404 → "not found or access denied" (standards belonging to other exporters read as not found); server 400 "A draft version already exists for this standard. Only one draft is allowed at a time."

#### 5.3.4 Edit a draft version / read a published version
- **Editable only while `draft`.** Published versions are read-only and say so.
- **Version fields**
  - Name (required).
  - **Grade specification**: a set of key→value text pairs. For tea and cinnamon, the server supplies *named fields* with label, hint and input type so the editor can offer them directly (tea examples: plucking standard, leaf quality notes, maximum moisture %; cinnamon examples: stem maturity, quill grade, moisture). Any other key lives in an "other parameters" group with add/remove. Empty named fields are dropped on save. If the template service fails the editor degrades to free-form rows only.
  - **Stages** (ordered; position is renumbered automatically when reordered/removed):
    - Name (required)
    - Timing: **one-time** or **recurring**
    - Start offset in days from planting (integer; default 0)
    - If recurring: repeat interval in days (> 0; defaults to 7 when switching to recurring) and optional end offset (≥ start offset)
    - Instructions in EN (required) / SI / TA
    - Allowed inputs (comma-separated text → list)
    - Banned inputs: list of {name, minimum days before harvest (default 30)}
  - Also present in the data model but **not editable in the current UI**: `dos` / `donts` (per-language bullet lists) and `required_proof` {photo_count, photo_descriptions, quick_fields}. The mobile app *does* consume them (farmers are asked for that many photos and those quick-field answers when submitting stage proof). Today they are only populated by server-side sample templates, so an exporter cannot configure proof requirements through the web. This is a significant functional gap.
- **Preview**: the editor shows exporters how the standard will appear to farmers — stages sorted by start offset, with timing text ("Day 30" or "Every 14d from Day 90 to 180") and allowed inputs.
- **Calls**: `GET /api/exporter/standards/{id}/versions/{n}` (plus `GET /api/exporter/standards/{id}` and `GET /api/exporter/standards/templates?crop=` and the profile); `PUT …/versions/{n}` with `{name, grade_spec, stages}`; `POST …/versions/{n}/publish`.
- **Validation (client, before save and publish)**: version name required; each stage needs a name and EN instructions; recurring stages need interval > 0; if end offset is set it must be ≥ start offset. Publishing additionally requires ≥ 1 stage and a verified exporter.
- **Server**: "Cannot publish a version without any stages"; "Version is already published"; publish is verified-only.
- **Edge cases**: unsaved-changes state is tracked; publishing silently saves first when dirty; leaving with unsaved changes is not intercepted. Publishing is irreversible (confirmation required) — the only way to change is a new draft.

#### 5.3.5 Templates
- `GET /api/exporter/standards/templates[?crop]` returns sample standards (stage sets with example proof requirements) and the per-crop grade-spec field definitions. The current UI uses **only the field definitions**; starting a standard from a template is not offered (an obvious opportunity).

### 5.4 Advertisements ("buy requests")
An **ad** is a public purchase request: crop, quantity, price, collection window, eligible districts, commercial terms, bound to one published standard version.

**Ad lifecycle**: `draft` → (publish a version) → `published`/**live** → ends when it **expires**, is **closed** by the exporter, is **filled** (approved supply ≥ target; auto-closed with reason "filled"), or is **taken down** by an admin (closed with reason prefixed "taken_down:"). Derived display state: `draft | live | expired | closed`.

#### 5.4.1 Browse ads
- **Data per ad**: id, crop, derived status, title (latest), quantity, price (fixed amount or range), collection window, expiry, standard name, latest/current version number, closure reason.
- **Filters**: crop; derived status (all/live/draft/expired/closed); free-text search (title, location, crop).
- **Calls**: `GET /api/exporter/ads?crop&status&search&page&page_size` (and the profile, to show the verification notice).
- **Actions per ad**: open; **duplicate as draft** (new ad, version 1); **close** (confirmation + free-text reason, default "Sourcing quota fulfilled"; hidden once closed).

#### 5.4.2 Create an ad (draft)
- **Inputs**
  1. Crop (tea/cinnamon) and a **published** standard version of that crop that belongs to this exporter and is not archived (the first available is preselected; if none: prompt to publish one).
  2. Title and description (EN required; SI/TA optional).
  3. Target quantity (kg > 0); grade/tier (free text, e.g. BOPF); price type **fixed** (one LKR/kg amount > 0) or **range** (min > 0, max > 0, min ≤ max).
  4. Collection window start/end; ad expiry date. Defaults: expiry +5 days, window +7 to +21 days.
  5. Pickup location (free text); eligible districts (multi-select with select-all/clear; empty = all).
  6. Terms: payment timing, rejection handling, packaging (optional), transport responsibility (optional) — free text. (A fifth free-text term `other` exists in the model.)
- **Call**: `POST /api/exporter/ads` → returns the ad with version 1 as draft.
- **Client validation order & messages**: select a published standard; EN title required; EN description required; quantity > 0; valid price(s); all three dates present.
- **Server validation**: districts must be valid; collection end ≥ start; standard must exist, belong to the exporter, match the crop, not be archived.

#### 5.4.3 Edit / publish an ad version
- **View**: version selector across all versions (draft/published); status of the ad; performance block for non-draft ads (see 5.4.5).
- **Draft versions** are editable (all fields above except crop). **Published versions are immutable** ("to ensure integrity for contracted farmers"). A closed ad is read-only entirely.
- **Actions**
  - Save draft: `PUT /api/exporter/ads/{id}/versions/{n}` (partial update; unparsable numbers become undefined, not errors).
  - **Publish**: saves first, then `POST …/versions/{n}/publish`. Rules: exporter verified; ad not closed; version not already published; EN title and description present; quantity > 0; **expiry in the future and on/before the collection window end**; linked standard version published/not archived/same crop.
  - New draft version (copies latest published; refused if a draft exists or nothing is published): `POST /api/exporter/ads/{id}/versions`.
  - Duplicate ad: `POST …/duplicate`. Close ad: `POST …/close {reason}` (default reason "Closed by exporter"; verified-only; only a published ad can be closed).
- **Edge cases**: an ad taken down by an admin is closed with a "taken_down:" reason and **cannot be closed, republished or versioned by the exporter**; the exporter is told to contact support. Publishing a new version while farmers have applied to the old one: existing acceptances stay bound to the old version.

#### 5.4.4 Applicants
- **Data header**: ad crop and title, target quantity, approved quantity, pending quantity, remaining quantity, `is_filled`.
- **Data per applicant**: farmer name, district, DSD, GN division, farm size, plots (name, area, crops), supply quantity offered, accepted-at, withdrawn-at, ad version they accepted, terms hash, derived status `pending | approved | declined | removed | withdrawn`. **Phone is hidden until approved.**
- **Filters**: status (all/pending/approved/declined/withdrawn), search; paginated.
- **Calls**: `GET /api/exporter/ads/{id}/applicants?status&search&page&page_size`; `POST …/applicants/{acceptanceId}/approve`; `POST …/applicants/{acceptanceId}/decline {reason?}` (both verified-only).
- **Approve rules**: applicant must be pending (not withdrawn, link must still be "requested"); approving would be refused if it **over-allocates** ("Over-allocation: … Remaining capacity is X kg"); approval creates/approves the farmer link (409 if the farmer already has an active link with another exporter) and **discloses the farmer's phone**; if the ad becomes full it is closed automatically ("filled").
- The approval confirmation shows the new remaining capacity. Unverified exporters see applicants read-only.

#### 5.4.5 Ad performance
- `GET /api/exporter/ads/{id}/stats[?days]` → total views, unique viewers, accepts {total, pending, approved, declined, withdrawn}, view-to-accept rate, target/approved/pending quantities, filled %, pending count, optional views-per-day series. Only requested for non-draft ads; failure is non-fatal.

### 5.5 Farmer network (links)
A **link** is the long-term relationship between one farmer and one exporter. **A farmer can have only one active (requested or approved) link at a time.** Links are created by the farmer (explicitly, or implicitly by applying to an ad); the exporter decides.

- **Link status**: `requested → approved | declined`; `approved → removed` (by exporter); `requested → cancelled` (by farmer).
- **Data per link**: id, status, requested-at, decided-at, decision reason; embedded farmer summary: name, district, DSD, GN division, farm address, farm size, **phone (only when approved)**, crops grown, number of plots, total plot area.
- **Detail** adds the farmer's plots: name, area, district, DSD, GN, plot type, boundary source (measured vs estimated).
- **Views/filters**: *requests* (status requested; with a pending-count indicator), *my farmers* (approved), *past* (declined, removed, cancelled); filters by district (25 + "All"), crop (All, Tea, Cinnamon, Pepper, Coffee, Cardamom), free-text search; paginated (the "past" view is filtered client-side after fetching everything, so its totals and paging are not reliable).
- **Calls**: `GET /api/exporter/farmers?status&district&crop&search&page&page_size` (`status=all` allowed); `GET /api/exporter/farmers/{linkId}`; `POST …/approve`; `POST …/decline {reason?}`; `POST …/remove {reason?}`. All three actions verified-only.
- **Rules**: approve/decline only on `requested`; remove only on `approved`; approving fails with 409 if the farmer got another active link in the meantime. Confirming copy promises that approval unlocks the farmer's phone number and supply tracing, and that removal notifies the farmer.
- **Edge cases**: unverified exporters can read but not act (and are told why); an already-decided link shows "This link is archived (status)".

### 5.6 Planting notices
A **planting notice** announces to an exporter's *approved* farmers that the exporter will need a volume of a crop for a **target month**, linked to a published standard. Farmers reply *Ready* (committing a plot and expected volume) or *Can't*.

- **Lifecycle**: `draft → published → cancelled`. Derived display state: `draft | upcoming | past | cancelled` (published notices become `past` once the target month has started).
- **Fields**: crop (tea/cinnamon), published standard version (owned by exporter, crop-matched, not archived), target month, total volume needed (kg > 0), eligible districts (empty = all districts), title and message (EN required; SI/TA optional).
- **Create**: `POST /api/exporter/planting-notices`. **Client validation messages**: "English title is required.", "English message is required.", "Please select a published quality standard version.", "Target volume must be greater than 0 kg.", "Target planting month is required." **Server**: target month must be at least next month; valid districts; standard rules; crop must be valid.
- **Browse**: `GET /api/exporter/planting-notices?crop&state&page&page_size`. Per notice: crop, derived state, target month, standard name/version, volume needed, **total expected volume** and **% of target committed**, counts {ready, cannot, no_reply, eligible_total}, title, timestamps.
- **Detail**: `GET /api/exporter/planting-notices/{id}`.
- **Edit draft**: `PUT …/{id}` (same fields, any subset; only while draft — 400 otherwise).
- **Publish**: `POST …/{id}/publish` — verified-only; re-validates month, standard, EN title+message; after this the notice is immutable and immediately visible to eligible approved farmers.
- **Cancel** (published only; optional reason; verified-only): `POST …/{id}/cancel`. Cancelling **releases all active plot bindings** farmers made for this notice.
- **Duplicate** (as a new draft): `POST …/{id}/duplicate`.
- **Responses**: `GET …/{id}/responses?response&search&page&page_size` → summary {volume needed, total expected, percentage, counts} and a per-farmer list {name, district, phone, response `ready|cannot|no_reply`, expected volume, plot name/area, responded-at}. Eligible farmers = farmers with an approved link to this exporter and (if districts are set) a matching district. Farmers who haven't replied show as `no_reply` ("Pending").
- **Farmer replies lock when the target month starts**; a Ready reply binds a plot to this notice for the crop+season (a plot can be bound to only one notice per crop per season).

#### 5.6.1 Reminder tracking for a notice
For published notices the system **automatically reminds non-responding eligible farmers 30, 14 and 7 days before the target month**.
- **Data**: per slot — scheduled date and counts (sent, failed, skipped, pending) with skip-reason breakdown; delivery outbox — farmer name, slot, channel, status (`pending | sending | sent | failed | skipped | read`), skip reason or last error, sent-at, attempts; delivery `provider` (currently a **mock/simulated** provider — flag this to users).
- **Skip reasons**: already replied; link no longer approved; district not eligible; district unknown; earlier slot missed; notice cancelled; target month started.
- **Filters**: slot (30/14/7), status (sent/pending/failed/skipped); paginated.
- **Calls**: `GET /api/exporter/planting-notices/{id}/reminders?slot&status&page&page_size`; `POST …/reminders/retry-failed` → `{retried_count, message}` (verified-only).
- **Edge cases**: drafts show "Reminders start after the notice is published"; unverified exporters see a note that retry is unavailable.

### 5.7 Stage-proof review
Once a farmer is approved by an exporter, the farmer submits **photo evidence per stage** of that exporter's standard. The exporter reviews each submission.

- **Submission status**: `pending → approved | rejected`; `rejected → (reopened) → resubmittable`.
- **List item**: id, farmer name, stage name, plot name (or "No plot linked"), photo count, status, submitted-at, `needs_attention` (= rejected and not yet reopened). Counter `pending_count`. Filter: pending / approved / rejected / all. `GET /api/exporter/stage-proofs?status&page&page_size` (note: "all" is sent as an empty status).
- **Detail**: stage name, plot, stage instructions (EN), **photo evidence** (one or more full-size photos), **quick-field answers** (key→text), farmer's note, status, review notes, reviewed-at, reopened-at. `GET /api/exporter/stage-proofs/{id}`.
- **Actions** (all verified-only):
  - Approve — optional notes. `POST …/{id}/approve {notes?}`. Only pending.
  - Reject — **reason required** (client blocks empty; server 422 "A reason is required when rejecting a submission."); the reason is shown to the farmer. `POST …/{id}/reject {notes}`. Only pending.
  - Reopen for resubmission — clears the "needs attention" block. `POST …/{id}/reopen`. Only rejected. Until reopened the farmer cannot submit again for that stage (403).
- **Edge cases**: an already-approved submission is final; a rejected-and-reopened submission shows "waiting for the farmer to resubmit". Each farmer sees only stages of the standard belonging to their approved exporter.

---

## 6. Admin workspace

Admin accounts are not self-service; they are created out of band. All admin APIs require role `admin` (401/403 otherwise).

### 6.1 User registry
- **Data per user**: id, name, email, role (`farmer | exporter | admin`; note `collector` accounts also exist but are not in the role filter), phone, district, status active/inactive, registered-at. Farmers additionally: DSD, GN division, farm address, farm size. Exporters additionally: business name, registration no, business address, export licence no. Admin: description only. **Sensitive hashes are never exposed.**
- **Search**: free text over name, phone **and email** (server searches all three even though help text mentions only name/phone). **Filter**: role. Paginated (default 10, max 100). `GET /actors?search&role&page&page_size`; `GET /actors/{id}`.
- **Action**: activate/deactivate an account — `PATCH /actors/{id} {is_active}`; the UI confirms with "Actor status successfully set to Active/Inactive".
- **Edge case / gap**: the flag has **no effect on sign-in or API access** today (see §9). A designer proposing "deactivate = lock out" needs the back-end change.

### 6.2 Exporter verification
- **Lifecycle**: `pending → verified | rejected`; `verified → rejected` ("revoke"); `rejected → verified` ("re-approve"); `verified|rejected → pending` ("reopen"). Every decision is logged.
- **List**: filter by status (pending, verified, rejected, all) with per-status counters, plus search over company, email, registration no; paginated (10). `GET /api/admin/exporters?status&search&page&page_size` → `{items, total, …, counts:{pending,verified,rejected}}`.
- **Detail** (`GET /api/admin/exporters/{id}`): company, registration no, licence no, contact person, phone, email, description, crops bought, districts served, certifications, applicant user record (name/email/phone), current status, rejection reason, and a **history log** (action, previous→new status, reason, admin email, timestamp; "System / CLI" when no admin).
- **Actions**: `POST …/{id}/approve` (400 if already verified); `POST …/{id}/reject {reason}` (reason required — 400 "Rejection reason cannot be empty"; 400 if already rejected; reason is shown to the exporter); `POST …/{id}/reopen` (400 if already pending). Each action needs an explicit confirmation; rejection needs a typed reason.
- **Effects**: approval immediately unlocks all gated actions in §2.2 for that exporter; rejection/reopen removes them. The exporter learns of the outcome only by looking at their own workspace (no email is sent).
- Feature module can be disabled (404).

### 6.3 Ad moderation
- **Admin ad states**: `live | draft | expired | closed | taken_down | filled`.
- **List**: filter by state, "has open reports", crop, free-text search (exporter company or ad title); paginated (20). Per ad: id, crop, status, admin state, title, version number, expiry, exporter company, open report count, total views, total accepts. `GET /api/admin/ads?state&has_open_reports&crop&search&page&page_size`.
- **Detail** (`GET /api/admin/ads/{id}`): live version, all versions, exporter, stats {total views, unique viewers, total accepts, active accepts}, **reports** (reason, details, status `open|reviewed|dismissed`, reporting farmer's name/district, created-at), **moderation log** (takedown/restore, reason, admin, time).
- **Take down**: only `published` ads; reason required (client disables the action when blank; server 400 "Takedown reason cannot be empty."); closes the ad with reason "taken_down: …" and marks all open reports as reviewed. `POST /api/admin/ads/{id}/takedown {reason}`.
- **Restore**: only ads closed by an admin takedown (not by the exporter): `POST …/{id}/restore`. Refused if there is no takedown record, no published version, or the published version has expired ("The published version has expired. The ad cannot be restored.").
- **Reports**: `GET /api/admin/ads/reports?status&ad_id&page`; `POST …/reports/{id}/review`; `POST …/reports/{id}/dismiss`. The review/dismiss endpoints exist but the current UI has no control for them (reports are only displayed and auto-reviewed by takedown).
- Admin can open the exporter-side ad view for any ad.

---

## 7. Public batch history (consumer)

A server-rendered, **no-JavaScript**, no-login page designed to open from a generic phone camera on a weak connection. It is what a **QR code on a product** resolves to: `GET /p/{batch_code}` (JSON equivalent: `GET /api/v1/provenance/{batch_code}`).

- **Lookup**: the code is trimmed and uppercased. Unknown code → a distinct "Batch not found" result (HTTP 404) explaining that the label could not be verified (mistyped, damaged, or not genuine) and advising the buyer to contact the seller. Optional `lat`/`lon` query parameters (decimal degrees) feed abuse detection.
- **Shows**
  - Batch code, crop, registration date.
  - **Scan warning** (only when triggered): "This code has been scanned from two very different locations…" (any earlier scan > 100 km away) or "…scanned an unusually high number of times recently" (> 30 scans within an hour). Both end "buy with caution." They describe *likelihood of copying*, not proof.
  - **Quality-standard verdict**, if the batch claims one: *Verified* (every required step has a matching recorded event), *In progress* (n of m verified), or *Not yet verified* (0 of m) — each with the standard's name.
  - **Origin**: district, DS division, GN division, plot size (ha), planting date. Never coordinates.
  - **Standard detail**: each stage with status (Done / Overdue / Upcoming / Pending / Standing rule), instructions, and the standard's cited source.
  - **Timeline**: chronological events — planting, plot/planting/progress photos, and for the batch and any ancestor batches: collect, weigh, process, grade, pack, collector attestation, batch photos. Each shows type, time, remaining payload fields (raw key: value pairs, e.g. weight_kg: 42.5), caption, photo (opens full size), and — if a photo was taken > 500 m from the plot — "Taken Nm from the plot".
  - **Merged from**: parent batches (code, crop, date) when the batch is a combination of several farmers' batches.
- **Privacy rules**: lat, lon and accuracy are stripped from every event; scans are logged with a hashed IP and coarse (≈1 km) location only; scanner identity is never shown.
- **Side effects**: every view is recorded as a scan for abuse monitoring (best-effort; never blocks the page).
- **Edge cases**: a batch with no events says "No events recorded yet."; a batch with no standard shows no verdict; photo links can break (images fail silently); the older test batch codes (e.g. a renamed "-OLD" code) still resolve; the page is public by design — anyone who guesses a code can read it.

---

## 8. Data dictionary (web-facing)

**User** `{id, email, role, name, phone, district, dsd, gn_division, farm_address, farm_size_ha, business_name, business_reg_no, business_address, export_license_no, is_active, created_at}`; NIC kept only as salted hash.

**ExporterProfile** `{id, user_id, company_name, business_reg_no (unique), export_licence_no, contact_person, phone, email, description, logo_url, districts_served[], crops_bought[], certifications[], status pending|verified|rejected, rejection_reason, created_at, updated_at}`.

**Standard** `{id, exporter_profile_id, crop, is_archived, versions[]}` · **Version** `{id, standard_id, version_number, name, status draft|published, grade_spec{}, published_at, stages[]}` · **Stage** `{position, name, timing_type one_time|recurring, start_offset_days, repeat_interval_days?, end_offset_days?, instructions{en,si,ta}, dos{en[],si[],ta[]}, donts{…}, allowed_inputs[], banned_inputs[{name, min_days_before_harvest}], required_proof{photo_count, photo_descriptions[], quick_fields[]}}`.

**Ad** `{id, crop, status, closed_reason, closed_at, versions[]}` · **AdVersion** `{version_number, status draft|published, standard_version_id, title{}, description{}, grade_tier, quantity_kg, price_type fixed|range, price_fixed|price_min|price_max, collection_window_start/end, pickup_location, eligible_districts[], terms{payment_timing, rejection_handling, packaging, transport_responsibility, other}, expires_at, published_at}`.

**Acceptance (applicant)** `{id, ad_id, ad_version_id, farmer_id, link_id, supply_quantity_kg, terms_hash, accepted_at, withdrawn_at}`; derived status from acceptance + link.

**FarmerLink** `{id, farmer_id, exporter_profile_id, status requested|approved|declined|removed|cancelled, requested_at, decided_at, decision_reason}`.

**PlantingNotice** `{id, crop, status draft|published|cancelled, standard_version_id, target_month, volume_needed_kg, eligible_districts[], title{}, message{}, published_at, cancelled_at, cancelled_reason}` · **Response** `{notice_id, farmer_id, response ready|cannot, expected_volume_kg, plot_id, responded_at}` · **Binding** `{notice_id, farmer_id, plot_id, crop, season, status active|released}`.

**StageProofSubmission** `{id, link_id, farmer_id, stage_id, plot_id, photo_urls[] (≥1), quick_field_answers{}, note, status, submitted_at, reviewed_at, review_notes, reopened_at}`.

**AdReport** `{reason, details, status open|reviewed|dismissed, farmer}` · **ModerationLogEntry** `{action takedown|restore, reason, admin, time}` · **VerificationLogEntry** `{action, previous_status, new_status, reason, admin, time}`.

---

## 9. Known gaps and inconsistencies a designer should know about

1. **No password policy, reset, change, or email verification.** No account recovery of any kind.
2. **`is_active` is cosmetic.** Deactivating a user changes a flag but they can still sign in and call APIs.
3. **Session expiry is abrupt.** 30-day tokens, no refresh, inconsistent messaging; the exporter workspace silently dumps you at sign-in.
4. **Field-level errors are lost** in sign-in/sign-up when the server returns a validation list.
5. **Free-text district at farmer sign-up** conflicts with the 25-district list used for targeting; case-sensitive matching for notices makes this a hidden failure.
6. **Stage proof requirements (`required_proof`, `dos`, `donts`) cannot be authored on the web**, although farmers are asked for them. Templates that carry them are unused by the UI.
7. **Exporter `crops_bought` and `logo_url` have no editing control**; business address is collected at sign-up but never shown again.
8. **Verification feedback is passive.** Admin decisions don't notify the exporter; the exporter has no "resubmit" action after rejection (the admin must reopen).
9. **Farmer link "past" filtering is client-side**, so counts/pagination are wrong once there are many.
10. **Reminders use a simulated provider** today; the delivery log is real but no real SMS/push goes out.
11. **Date-only ad inputs map to 00:00 UTC**, so end-of-day semantics are surprising.
12. **Ad crop vocabulary is tea/cinnamon**, farmer-network crop filter offers five crops, mobile crop entry is free text — three different crop vocabularies.
13. **Wording drift**: "licence" vs "license"; copy suggesting exporters can browse and invite farmers; "Platform features" copy claiming farmers can manage listings.
14. **Reports can be reviewed/dismissed by API only**; the admin UI shows them but cannot act on them individually.
15. **Public provenance pages are enumerable-by-guess** and contain per-event raw key/value payloads; there is no consumer-friendly formatting of those values.
16. **Buyer commitments have no web interface.** The field-data service lets exporters/admins create buyer commitments (crop, volume, window, indicative price), list their own, see a **reconciliation** of deliveries against a commitment, download a **CSV export**, and get an **allocation proposal** (which farmers' plots could fill it, based on expected yield) — `POST|GET /api/v1/commitments`, `GET /api/v1/commitments/me`, `…/{id}/reconciliation`, `…/{id}/export.csv`, `…/{id}/allocation-proposal`. Farmers' batches auto-match to these on registration (see the mobile spec). None of it is reachable from the web today, and it runs alongside the ads marketplace as a second, unexplained buyer mechanism.
17. **Audit tools have no interface.** `GET /api/v1/audit/queue` (actors ranked by how much of their recorded activity doesn't add up) and `GET /api/v1/audit/batches/{code}` exist for admins and exporters but nothing in the web app calls them.
18. **Farmer-side declines are invisible to farmers.** When an exporter declines or removes a farmer link, the reason is stored but the mobile app never shows it (the link simply stops being "current"); the exporter-side copy promising that "the farmer will be notified" is not backed by any notification.

---

## 10. Endpoint index (web)

| Area | Calls |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/signup/farmer` · `POST /auth/signup/exporter` · `GET /auth/google` · `GET /auth/google/callback` · `GET /auth/me` |
| Admin users | `GET /actors` · `GET /actors/{id}` · `PATCH /actors/{id}` |
| Admin exporters | `GET /api/admin/exporters` · `GET …/{id}` · `POST …/{id}/approve|reject|reopen` |
| Admin ads | `GET /api/admin/ads` · `GET …/{id}` · `POST …/{id}/takedown|restore` · `GET /api/admin/ads/reports` · `POST …/reports/{id}/review|dismiss` |
| Exporter profile | `GET|PUT /api/exporter/me` |
| Standards | `GET|POST /api/exporter/standards` · `GET …/{id}` · `GET|PUT …/{id}/versions/{n}` · `POST …/{id}/versions` · `POST …/{id}/versions/{n}/publish` · `POST …/{id}/duplicate|archive|unarchive` · `GET …/templates` |
| Ads | `GET|POST /api/exporter/ads` · `GET …/{id}` · `GET|PUT …/{id}/versions/{n}` · `POST …/{id}/versions` · `POST …/{id}/versions/{n}/publish` · `POST …/{id}/close|duplicate` · `GET …/{id}/applicants` · `POST …/{id}/applicants/{acceptanceId}/approve|decline` · `GET …/{id}/stats` |
| Farmer network | `GET /api/exporter/farmers` · `GET …/{linkId}` · `POST …/{linkId}/approve|decline|remove` |
| Planting notices | `GET|POST /api/exporter/planting-notices` · `GET|PUT …/{id}` · `POST …/{id}/publish|cancel|duplicate` · `GET …/{id}/responses` · `GET …/{id}/reminders` · `POST …/{id}/reminders/retry-failed` |
| Stage proofs | `GET /api/exporter/stage-proofs` · `GET …/{id}` · `POST …/{id}/approve|reject|reopen` |
| Public | `GET /p/{code}` (HTML) · `GET /api/v1/provenance/{code}` (JSON) |

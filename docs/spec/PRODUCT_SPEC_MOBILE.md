# Origo — Mobile Product Specification (Android field app)

Audience: a designer who has never seen the current product.
Scope: what people must be able to do in the field app, the data involved, the calls that move it, the rules that constrain it, and the edge cases.
Deliberately **not** covered: layout, components, colors, typography, navigation structure, screen arrangement. Only the *information model and behavior* behind each task are recorded.

Companion document: `PRODUCT_SPEC_WEB.md` (exporters, admins, public QR page). The two share accounts and business objects.

---

## 1. Product context

The app is used **in fields, sheds and collection points**, often with weak or no signal, in bright sunlight, by smallholder farmers and leaf collectors. Its job is to produce **trustworthy, timestamped, geotagged evidence** of what happened to a crop from planting to a labelled batch, and to connect farmers to buyers.

- Platform: **Android** (one codebase; no iOS build exists). Product name in-app: "Agri Field"; brand: "origo".
- **Offline-first for recording, network-first for everything else.** Field events are saved on the device immediately and synced later (§3.5). Everything that issues an identifier or needs a server decision (accounts, plots, batches, photos, applications, replies) needs a connection.
- **Two back-ends** are used (error shapes differ):
  - **Field-data service** (`api`): plots, batches, events, photos, protocols, buyer commitments, user profile, the public QR page. Errors: `{"error":{"code","message","details"}}`; the app shows `message`.
  - **Account & marketplace service** (`web/backend`): sign-in/sign-up, buyer ads, exporter links, stage proofs, planting notices, notifications. Errors: `{"detail": "..."}` or, for validation, a list of `{msg}`.
  Both accept the same JWT.
- Roles: **Farmer** and **Collector** have tailored experiences. *Admin* and *exporter* accounts can sign in on mobile but receive the farmer experience and most calls will fail (see §9).

### 1.1 Who the users are
| User | Typical situation | Needs |
|---|---|---|
| **Farmer** | Owns 0.1–few ha, low-end phone, intermittent signal, limited literacy in English | Register land, log planting, take photos, register harvest batches, get a QR label, find buyers, follow a buyer's standard, answer planting notices |
| **Collector** | Buys leaf from many farmers at a collection point | Scan farmers' batch QR codes, weigh, record a condition check, combine into one outgoing batch |

### 1.2 Shared vocabularies
- **Crops offered when recording planting/harvest**: Tea, Cinnamon, Pepper, plus **Other** (free text). Only crops with a seeded quality standard (currently those three) offer standards; "Other" never does.
- **Plot types**: open field, greenhouse, shade house, hydroponic.
- **Boundary sources**: *walked* (GPS pins at corners), *traced* (corners tapped on satellite imagery), *estimated square* (legacy: one pin + approximate size — no longer creatable in the app).
- **Pipeline stages recordable on a batch**: collect, weigh, process, grade, pack.
- **Collector condition grades**: good, fair, poor.
- **Photo kinds**: registration (`plot_photo`), planting (`planting_photo`), progress (`progress_photo`), batch (`batch_photo`).

---

## 2. Actors and what each can do

| Capability | Farmer | Collector |
|---|---|---|
| Create an account and sign in; PIN unlock | ✔ | ✔ |
| Register plots; record planting; progress photos | ✔ | — |
| Register harvest batches; get a QR label | ✔ | — |
| View own batches, timelines, quality-standard progress | ✔ | — |
| Record a stage (collect/weigh/process/grade/pack) on a batch | ✔ (own batches) | — (uses collection round instead) |
| Scan a QR to record a stage | ✔ | — |
| Collection round (scan, weigh, condition-check, combine) | — | ✔ |
| Browse and apply to buyer orders; follow an exporter; submit stage proof; reply to planting notices; in-app notifications | ✔ | — |
| See own profile, manage PIN, view sync status, log out | ✔ | ✔ |

---

## 3. Cross-cutting behavior

### 3.1 Accounts and session
- Credentials live in the device's secure storage: access token, user id, role, and the PIN hash + salt.
- Sign-in `POST /auth/login {email, password}` → `{access_token, role}`. The user id is read from the token's `sub` claim.
- Tokens last **30 days**; there is no refresh. A token the server no longer honors yields 401 on every call.
- **Policy on 401**: the app does **not** force a re-login. A farmer must still be able to open the app and keep recording after weeks without signal (see PIN, below). Instead, data views show a message such as *"Your session needs refreshing — reconnect and log in again to sync new plots. Anything already recorded is safe."* The person has to discover that they should log out and back in.
- **Switching between environments/servers makes stored tokens invalid** (different signing secrets) — same symptom as expiry.
- Logging out discards token, user id, role **and the PIN**. It does **not** clear the offline event queue (see §9).

### 3.2 PIN lock (offline unlock)
Purpose: prove it is still the same person on the same device, without a network.
- **Set**: shown once after every successful network sign-in/sign-up. Input: 4 digits + confirmation. Messages: "Enter a 4-digit PIN." / "PINs do not match." May be **skipped** ("Skip for now"), in which case the app opens without a PIN for that launch and asks again next launch.
- **Unlock**: every cold start with a stored session requires the PIN (no network). Wrong PIN: "Incorrect PIN." and the field clears. **There is no attempt limit, no lockout, no delay.** "Forgot PIN? Log in with email instead" logs out (token and PIN wiped).
- **Change**: from settings, reuses the set flow; PIN is stored as SHA-256 of `salt:pin` with a per-device random salt.
- **Edge cases**: the PIN protects only the app gate, not the data on disk; a PIN-unlocked app with an expired token can record offline but cannot sync (events fail with 401 and retry forever).

### 3.3 Sign-up
Both roles: name, email, password, phone, NIC, district, DSD, GN division — all **required** (client check only says "Required"). Farmers also need farm address and farm size (ha). Email format, password strength, phone format and NIC format are **not validated client-side**, and the server validates only email syntax and uniqueness (400 "Email already registered"). Farm size that doesn't parse becomes 0.
- District, DSD and GN division are **prefilled** with Nuwara Eliya / Nuwara Eliya DSD / Kandapola, and farm size with 0.5 — easy to submit wrongly without noticing.
- Calls: `POST /auth/signup/farmer`, `POST /auth/signup/collector`; success signs the user in and then runs PIN setup.
- NIC is stored only as a salted hash.
- **Wrong district text** silently hides buyer orders and planting notices that target other districts (§6.4, §6.7).

### 3.4 Location and photos (evidence rules)
- **Photos are camera-only** (never the gallery), compressed to max width 1600 px, quality 85. JPEG/PNG/WebP, ≤ 10 MB server-side.
- **Location** is used to geotag photos and plantings and to record boundaries.
  - Requirements: device location **service on** and **permission granted**. Boundary tasks are **blocked entirely** until both are true, with an explanation, and re-check automatically if location is switched off mid-task or the user returns from settings; "denied forever" routes to app settings.
  - Quality rules: a fix older than 15 s is not reused; if no fix arrives within ~12 s the app reports "Could not get a GPS fix. Move somewhere with a clearer view of the sky and try again." Accuracy worse than **±50 m** produces a warning but never blocks recording.
  - For **non-boundary** tasks (planting, photos, batch photos) GPS is **best-effort**: the record is saved without coordinates if no fix is available.
- **Location flag**: a photo whose reported location is **> 500 m from the plot's centre** is accepted but flagged (shown as "Taken Nm from this plot" to the farmer and publicly on the batch history). GPS is never required to take a photo.
- Photos cannot be queued offline; capturing/uploading needs a connection.

### 3.5 Offline queue and sync (the heart of offline behavior)
- **Recorded offline and synced later**: `planted`, `collect`, `weigh`, `process`, `grade`, `pack`, `collector_attestation`. Each gets a **client-generated UUID** at capture time and a captured-at time (the planting date can be backdated); the server inserts idempotently (re-sending a known id is a no-op returning 200; first insert returns 201).
- **Needs a connection right now** (no queue): sign-up/sign-in, registering a plot, uploading any photo, registering a batch (the code is issued by the server), merging batches, looking up a batch by code, loading any list or detail, applying/withdrawing, requesting/cancelling an exporter link, submitting stage proof, replying to a notice, notification read-marks.
- **Sync engine**: runs at app start, every 20 s, and whenever connectivity returns. Failed items back off by `min(attempts,6)² × 2` seconds (2, 8, 18, 32, 50, 72 s, then 72 s forever). "Sync now" clears all waits and retries immediately. There is **no maximum retry count**: a permanently invalid event (for example one the server rejects as forbidden) retries indefinitely and stays marked failed with the server's text.
- **Queue states**: pending, failed (with last error), synced. Synced items are **never removed** from the local list in the current build.
- The user can always see: number pending, a manual "sync now", and each event's type, time, state and last error.
- **Authorship**: the server ignores the user id the app sends and attributes every synced event to **whoever the current token belongs to**. Events queued by one person but synced after another signs in are attributed to the second person (and may be rejected).
- **Server authorization on sync** (what can fail after the app already said "queued for sync"): `planted` needs a plot id and plot ownership; `collector_attestation` needs a collector/admin; `weigh` needs `weight_kg`; `planted` needs `crop` (and `area_ha`, if present, must be a positive number); any `lat`/`lon` must be valid coordinates; collect/weigh/process/grade/pack on a batch require being the batch's plot owner **or** a collector/admin/exporter; unknown batch → 404; unknown plot → 404.

### 3.6 Language
The app UI is English only. Content authored by exporters (notice titles/messages) is shown in the **device language with English fallback, then first available**. Notifications carry their own language field.

### 3.7 Error and empty-state conventions
- Network failures: "Can't reach the server. Check your connection and try again." Timeouts (10 s for reads/writes, 30 s for photo upload, 5 s for the unread count): "This is taking longer than expected…". Server errors (5xx): "Something went wrong on our end. Please try again shortly."
- Where the server supplies a human message it is shown verbatim.
- A **load failure must not look like "you have nothing"**: when plots fail to load the app avoids the first-time call-to-action and shows the error instead.
- Collections have loading, empty (with explanation of how to get data), and error-with-retry states; most can be refreshed manually.

### 3.8 What does *not* exist
No push notifications (notifications are fetched when the app is opened), no gallery photo import, no profile editing, no password change/reset, no data export, no multi-language UI, no iOS.

---

## 4. Farmer tasks

### 4.1 Create account / sign in / unlock
See §3.1–3.3. Entry decision on every launch: not signed in → sign-in; signed in without PIN and not yet unlocked this launch → PIN setup; signed in with PIN → unlock; otherwise the app proper (collectors get their own home).

### 4.2 Register a plot
**Goal**: create evidence that a plot exists where the farmer says it does.

**Step 1 — describe the plot.**
Inputs: plot name (optional, ≤ 60 chars, e.g. "Lower field"); **growing environment** (open field default / greenhouse / shade house / hydroponic); district, DSD, GN division (prefilled; **district is required by the server**, the others optional; the client does not block blanks).

**Step 2 — capture the boundary** (location must be on, §3.4). Two methods, mutually exclusive (switching methods discards the other's corners):
- **Walk it**: stand at each corner and drop a pin (each uses a fresh GPS fix with its accuracy recorded locally). Undo removes the last pin. **At least 3 pins.** A live area estimate is shown from the pins; if the corners are nearly identical the estimate is replaced by guidance "walk to each corner before dropping its pin."
- **Trace it on satellite imagery** (for plots too small for GPS or impractical to walk): tap each corner on map imagery (third-party tiles; needs network; credit line "Imagery © Esri, Maxar, Earthstar Geographics"). Map opens near the user's fix (fallback: Nuwara Eliya). Controls to zoom (1–21; imagery native to 19) and recenter. At least 3 corners; undo; hint text guides count and "tap the real corners."
- **Minimum area** (client mirrors server): walked **0.005 ha (50 m²)**; traced **0.0005 ha (5 m²)**. Below this the submit action is disabled with an explanatory hint.
- Area is computed on the device for preview and again, identically, by the server (the server's value is canonical).

**Step 3 — submit** `POST /api/v1/plots` with `{name, boundary_source: "walked"|"traced", boundary_points: [{lat, lon}…], plot_type, district, dsd, gn_division}` → plot with id, centre point, area (ha), etc. Server rules: ≥ 3 points; lat/lon in range; district present; name ≤ 60; area ≥ minimum per source else 422 `boundary_too_small` ("The walked boundary is too small to be a plot…"). The boundary can **never be edited later**.

**Step 4 — mandatory plot photo.** After the plot is saved, the person **cannot leave** until a registration photo is uploaded: a "Photo required" prompt loops (retry on cancel, retry on upload failure). The photo is geotagged if possible and may be flagged if far from the plot (message states the distance).
- `POST /api/v1/photos` multipart: `file`, `plot_id`, `event_type=plot_photo`, `event_id` (UUID), optional `lat`/`lon`.

**Edge cases**
- The plot is created *before* the photo. If the app is closed, crashes or loses signal between step 3 and 4, a plot exists **without a registration photo**; the farm overview flags it ("No registration photo on file") and there is no dedicated way to add that photo afterwards other than the general photo action.
- Location off mid-flow re-blocks the task.
- Creating a plot offline is impossible; the walk can be completed but submitting fails with a connection error.

### 4.3 Review my plots
- **Data per plot**: display name (own name, else something derived from area and date added), location text (GN, DSD, district), area (shown in m² below 0.01 ha), growing environment (only highlighted when not open field), boundary quality (*measured* walked/traced vs *estimated*), crops currently planted (one entry per crop → intercropping supported), and the **most urgent photo-evidence status**.
- **Photo-evidence status precedence**: no registration photo on file → progress photo overdue since <date> → next progress photo due <date> → none.
- **Calls**: `GET /api/v1/plots/me` (plots incl. latest planting per crop: crop, planted-at, area, standard id/name), then per plot `GET /api/v1/photos/schedule?plot_id=` (best-effort; failure only hides that plot's status).
- **States**: first-time (no plots → prominent invitation to register); has plots (invitation becomes secondary); error (never shown as "no plots").

### 4.4 Work with one plot
**Information**: area, environment, location, centre coordinates (5 dp), boundary quality, each planting ("Tea (0.4 ha) — committed to <standard>" or "no specific standard"; tapping opens planting details, §4.5), **photo-evidence schedule** (registration photo present?; progress checks each marked done / overdue since / due), **all photos** of the plot (type label, date, caption, "taken far from this plot" flag; full-size view shows type, exact time, note), and **batches registered from this plot**.

**Calls**: `GET /api/v1/photos/schedule?plot_id`, `GET /api/v1/photos?plot_id`, `GET /api/v1/batches/me` (filtered to the plot on the device).

**Actions**
- **Rename**: `PATCH /api/v1/plots/{id} {name}` — only the label is editable; max 60; empty clears it.
- **Record planting** (§4.5), **Register harvest batch** (§4.7), **Add progress photo** (§4.6) — all always reachable from a plot.

**Progress-photo schedule rule**: after a planting is recorded, one progress photo is expected **every 30 days**; a photo taken within a 30-day window satisfies that window. Statuses: `done`, `overdue`, `upcoming`. With **no planting recorded there is no schedule** (empty). The 30-day cadence is a platform quality practice, not a claim by any standard.

Each section fails independently with its own message; 401 reads "Your session needs refreshing — log out and log back in to see this."

### 4.5 Record a planting
**Inputs**
- Crop (Tea / Cinnamon / Pepper / Other + free text).
- Planted date: default today; allowed 1 Jan 2020 → today (**backdating allowed, future not**).
- **Area planted with this crop (ha)**: prefilled with the plot's area; lower it when intercropping. Optional; blank/non-positive/unparsable → "whole plot". **No check against the plot's area.**
- Optional **quality standard** the farmer intends to grow to (fetched per crop: `GET /api/v1/protocols?crop=`). If one is chosen, the full requirement list loads (`GET /api/v1/protocols/{id}`) and the farmer must **tick every requirement ("confirm you'll follow every requirement")** before saving is allowed. This is a self-declaration used later in batch verification.
- GPS is requested in the background while the form is filled; the fix (lat, lon, accuracy) is attached if available.

**Outcome**: an offline-queued `planted` event `{crop, area_ha?, lat?, lon?, accuracy_m?, protocol_id?, protocol_name?, confirmed_stages[]?}` at `occurred_at` = chosen date, tied to the plot. Then the camera is offered for an **optional** planting photo (`event_type=planting_photo`, with `crop` so intercropped plots show the right photo). Skipping the photo or a failed upload **never** looks like the planting failed; failures say "Photo could not be uploaded: …".

**Feedback text variants**: "Planting recorded — queued for sync.", "…(no GPS fix)…", "…GPS accuracy was low (±Nm).", plus " Photo attached." when applicable.

**Look back**: tapping a planting shows date, area ("whole plot" if absent), GPS and accuracy (or "no fix recorded"), the chosen standard and which of its requirements were confirmed. `GET /api/v1/events?plot_id=` (latest `planted` event per crop).

**Edge cases**
- Recording planting twice for the same crop replaces the "current" planting (most recent wins) but keeps history.
- The planting date must be on or before **today**; the batch's quality-standard timeline anchors on the planting that precedes the batch's creation.
- Without a standard the batch can still be registered; with one, a later mismatch is warned (§4.7).

### 4.6 Add a progress photo
Take a photo (camera only) → optional note → upload (`event_type=progress_photo`, caption, GPS if available) → success message, or "Progress photo uploaded — but it was taken Nm from this plot." / "Could not upload photo: …". Updates the schedule and gallery. Needs connectivity.

### 4.7 Register a harvest batch ("Harvest")
**Goal**: turn today's harvest from a plot into a labelled, traceable batch. In the current product, registering the batch **is** the harvest — a farmer selling directly needs no collector.

**Inputs**
- Crop (same picker; defaults to Tea), harvested weight in kg (optional; digits and one decimal point), grade if known (optional free text, e.g. BOPF).
- Optional quality standard for the crop. The standard the farmer **confirmed at planting for this crop** is preselected. If the farmer picks a different one (or none), a **mismatch warning** explains "This crop's planting was confirmed against X, not Y" / "…this batch won't claim that standard." A link allows reading the planting instructions of the chosen standard.
- **A photo of the batch is required.** It is taken *before* the batch is created; cancelling the camera shows "Photo required" with *Take photo* or *Cancel registration* (cancelling leaves nothing behind). GPS is requested in parallel.

**Sequence and calls**
1. Photo captured.
2. `POST /api/v1/batches {plot_id, crop, protocol_id?}` → batch with unique **code**, id, protocol name, matched commitment, status. The server: verifies plot ownership; verifies the protocol exists and matches the crop (else 422 "protocol_id does not match crop."); auto-matches an **open buyer commitment** for the same crop (§5.2).
3. Upload the photo as `batch_photo` tied to the batch and plot (the result is **not checked** — a failed upload leaves a batch with no photo and no message).
4. Queue offline events: `collect` (always), `weigh {weight_kg}` if a weight parses, `grade {grade}` if entered.
5. Show the **QR label** (§4.9) with crop, standard and any matched buyer order.

**Edge cases**
- Offline: step 2 fails ("Failed: …") and the already-captured photo is lost; the person must retake it.
- A weight that doesn't parse (e.g. "1.2.3") is silently dropped; no weight event is recorded.
- Batch code is random, from an unambiguous alphabet (no 0/O/1/I/L), signed with a server secret; lookups normalize case/whitespace.
- A farmer can register many batches from one plot; nothing prevents duplicates of "the same harvest".

### 4.8 Follow my batches
**Overview** (`GET /api/v1/batches/me` + plots): batches grouped by *where they are in the journey* — Registered, Collected (collect or collector attestation), Processing (weigh, process, grade), Packed, Scanned, Other — ordered newest activity first. Per batch: code, crop, standard name, plot name ("Plot no longer available" if missing), age ("Registered today / 1 day ago / N days ago"), latest stage label. A batch with a standard offers a shortcut to its progress.

**Detail** (`GET /api/v1/events?batch_id=`): crop, standard, plot, latest status; **matched buyer order** if any; link to quality-standard progress; **timeline** starting with "Registered" and then every event in time order (type, local date-time, remaining payload fields as "Key: value" except coordinates/photo/caption internals, caption, photo thumbnail). Actions: view/share QR; **record a stage** (§4.10).

**Quality-standard progress** (`GET /api/v1/batches/{id}/schedule`): verdict — "✓ Verified — meets <standard>" or "n/m required steps done" — and each stage with status **Done / Overdue / Upcoming / Pending / Standing rule**, due date (planting date + stage day-offset), instructions, and the standard's cited source. A batch with no standard returns 404 "This batch wasn't registered against a quality standard." A step counts as *done* only if an **event of a required type exists on the batch** (or, for planting, a planting exists). It is the same computation consumers see publicly.

**Edge cases**: "latest status" is derived from the newest *occurred-at*, so a backdated event can make a batch appear to go "backwards"; 401 shows the session-refresh message.

### 4.9 Show / print the batch QR
- Displays the batch code, subtitle (crop · standard), any matched buyer order, a QR image, and copy-code.
- **The QR encodes a full web address `<API base>/p/<code>`**, not the bare code, so any phone camera can open the public history (see web spec §7). The app's own scanner extracts the last path segment from such an address (or accepts a bare code).
- Instruction shown: "Print this on the batch label. Scanned in this app it records the next stage; scanned with any camera it opens this batch's public history."
- **Edge case with serious consequence**: the address is built from the app's configured server at build time. A build that points at a development/emulator address prints QR codes that **only resolve on that network**; labels printed from such a build are useless to consumers.
- The QR is rendered once as a static image (performance workaround).

### 4.10 Record the next stage on a batch
Reached from the batch detail or by scanning.
- Choose a stage: **Collect, Weigh, Process, Grade, Pack**. Fields: Weigh → weight (kg, numeric); Grade → grade (free text); Pack → number of packages (numeric); Collect/Process → none ("Record this stage now?").
- Blank fields are simply omitted from the payload; numeric text that doesn't parse is sent as text.
- Result: an offline-queued event on the batch, "<Stage> recorded for <code> — queued for sync."
- **Edge cases**: there is no ordering enforcement (a batch can be graded before it is weighed); no duplicate prevention; a farmer recording a stage on someone else's batch gets a success message but the event later fails authorization at sync (visible only in the queue, as failed).

### 4.11 Scan a batch QR (farmer)
Camera scanner, QR only; repeated detections of the same code within 3 s are ignored; haptic feedback on a read; while a result is being handled further detections are ignored. Flow: extract code → `GET /api/v1/batches/by-code/{code}` (any signed-in user may look up any batch) → stage chooser (§4.10). Errors: `Could not look up "<code>": <message>` (e.g. "No batch found with that code."). A session list counts "N scanned this session" with the codes.

### 4.12 Browse buyer orders ("Market") and apply
**Source**: exporters' published ads (see web spec §5.4). Only ads that are **live** (not draft/closed/expired/taken down), **not filled**, and whose eligible districts include **any district of the farmer** (their registered district *or* the district of any of their plots; an empty eligibility list means everyone) are returned.
- `GET /api/farmer/ads?page_size=50[&crop=]`.

**Per order**: crop and grade, title, exporter company (and description, logo, certifications), price line (fixed LKR/kg or range), quantity wanted *remaining* vs total, collection window, pickup location, eligible districts, offer expiry.

**Order detail** (`GET /api/farmer/ads/{id}`; also records a view for the exporter's statistics): adds description, payment timing, rejection handling, the exporter's **quality standard** (name, stages with position, name, timing, instructions, dos ✓ / don'ts ✕, allowed inputs, **required proof photo count**). If the order is no longer live, application is replaced by "This order is no longer open."

**Apply**: input supply quantity (kg, > 0). `POST /api/farmer/ads/{id}/accept {ad_version_id, supply_quantity_kg}` → message. Server rules:
- order not closed/expired/filled; the **version the farmer saw must still be the latest published** (else 409 "Ad was updated, reload.");
- quantity > 0 and **≤ the ad's total target** (it is *not* limited to the remaining amount — approval can still fail later on capacity);
- farmer's district eligible (400 "Your registered district is not eligible…");
- **one application per farmer per order** (409 "You have already submitted…");
- if the farmer has an active link with a *different* exporter → 409 "Conflict: You already have an active link with another exporter."; with the same exporter the link is reused; with none, a **link request is created automatically**.

**Track applications**: `GET /api/farmer/ads/my-acceptances` — per application: crop, grade, exporter, quantity, price, collection window, accepted-at, withdrawn-at, derived status `pending | approved | declined | withdrawn | removed`.

**Withdraw**: `POST /api/farmer/ads/{id}/withdraw`, only while **pending** (once approved: "Your supply has already been approved… contact the exporter to request removal"). Confirmation required.

**Edge cases**: an exporter approving requires the farmer's phone to be revealed — this is not shown to the farmer in the app; withdrawn applications appear to count as "already submitted", so re-applying to the same order is likely blocked; ad-level reporting exists on the server but has **no mobile entry point**.

### 4.13 Follow an exporter's standard ("My exporter")
A farmer may have **one** active relationship (requested or approved) with an exporter at a time.
- **Browse verified exporters** (only when no active link): `GET /api/farmer/exporter-link/exporters` → company, description, logo, districts served, crops bought, certifications. Action: *Request to follow their standard* → confirmation ("You can only follow one exporter at a time…") → `POST /api/farmer/exporter-link/request {exporter_profile_id}`. Server: exporter must be verified (400 otherwise); no other active link (400/409).
- **Current relationship**: `GET /api/farmer/exporter-link/current` → `{has_active_link, link}`. The server returns **only `requested` or `approved` links** as "current". The app has wording for every state: *approved* — "You're following this exporter's quality standard. Keep your plot's planting and progress records up to date — this is who sees them." with entry to stage proof; *requested* — shows the exporter and request date and can be **cancelled** (`POST /api/farmer/exporter-link/cancel`, only while pending); *declined* — would show "Reason: …".
- **Edge cases**: because the server never returns declined, removed or cancelled links as current, the **declined/removed wording is unreachable**. A farmer whose request is declined, or whose approved link is removed by the exporter, simply finds the exporter directory back where their relationship used to be — **with no explanation and no way to see the exporter's reason** — and may immediately re-request. Only the exporter can end an approved relationship. Server conflicts when requesting: 409 "You already have an active link or pending request with an exporter."; 400 if the exporter isn't verified.

### 4.14 Submit stage proof
**Precondition**: approved link. `GET /api/farmer/stage-proofs/standards` → `{has_approved_exporter, exporter_company_name, standards[]}`; each standard (latest published version of each of the exporter's standards) lists stages with: id, position, name, timing, start offset, instructions, dos/don'ts, allowed inputs, **required proof** (photo count, per-photo descriptions, quick-field names) and the farmer's **submission status** for the stage: *never submitted | pending | approved | rejected*, `can_resubmit`.
- States: no approved exporter → explanation; approved but nothing published → "hasn't published a quality standard yet".

**Submit** (per stage): choose the **plot** (auto-selected if the farmer has only one; required), capture the required number of photos (**at least 1 even if the stage says 0** because the server rejects empty lists), each uploaded immediately as it is taken (per-photo retry/retake; a failed upload never discards other photos), fill the **quick fields** (free text per named field, trimmed), add an optional note. Submission is enabled only when a plot is chosen, every photo slot has an uploaded URL, and nothing is in flight.
- Photo upload: `POST /api/v1/photos` with `event_type=progress_photo` for the chosen plot.
- Submit: `POST /api/farmer/stage-proofs/{stageId}/submit {photo_urls[], quick_field_answers{}, note?, plot_id?}`.
- Server rules: approved link required (403); stage must belong to the exporter's standard (403); **only one pending submission per stage** (409); a rejected stage cannot be resubmitted until the exporter **reopens** it (403 "This stage was rejected. Ask your exporter to reopen it before submitting again."); ≥ 1 photo URL (422).
- After a rejection the farmer sees the exporter's reason; if not yet reopened: "Waiting for your exporter to reopen this stage before you can resubmit."; once reopened: *Resubmit proof*.

**History**: `GET /api/farmer/stage-proofs/my-submissions` → stage, status, submitted-at, reviewed-at, review notes (prominent when rejected), note, photo count.

**Side effect to design around**: proof photos are stored as **progress photos on the plot**. They therefore appear in the plot's gallery, count toward the 30-day progress schedule, and appear on the **public** batch history timeline — even though they were taken to satisfy an exporter, not as routine progress.

### 4.15 Planting notices (season requests)
- **List**: `GET /api/farmer/planting-notices?page&page_size` → only notices that are **published**, from an exporter the farmer is **approved** with, whose **target month is still in the future**, and whose eligible districts include the farmer's registered district (**exact text match**; empty list = everyone). Per item: crop, target month ("November 2026"), title, exporter, volume needed, the farmer's response (`ready | cannot | none → "No response yet"`), expected volume, plot.
- **Detail**: `GET /api/farmer/planting-notices/{id}` → exporter's public profile (no contact details), title, message, target month, total volume needed, **the farmer's current response** (with committed kg), the **linked quality standard** (name, version, stages with order, name, description, rule count). 404 if not visible to this farmer.
- **Reply Ready**: first `GET /api/farmer/planting-notices/{id}/plots` (the farmer's plots with id, name, area, location). With none: "You do not have any registered plots yet. Please register a plot…". Inputs: **plot** (preselects the previously bound plot, else the first) and **expected volume** (kg, > 0, prefilled from the previous reply). Client messages: "Please enter a valid volume greater than 0 kg." / "Please select a plot." `POST …/{id}/respond {response:"ready", expected_volume_kg, plot_id}`. Success: "Response recorded. Your plot has been bound for this season."
- **Reply Can't**: confirmation ("Any plot previously bound for this notice will be released.") → `POST …/respond {response:"cannot"}`.
- **Rules**: replies are **locked once the target month starts** (409 "Replies are locked because the target planting month has already started."; the app mirrors this by disabling both actions with an explanation); a farmer may **change** their reply any time before that; a **plot can be bound to only one notice per crop per season** (409 "This plot is already committed to another planting notice for this crop and season."); the selected plot must belong to the farmer (403).
- **Edge cases**: notices drop out of the list once the month starts, so the lock explanation is reachable only through a notification or an already-open notice; an exporter cancelling a notice releases the binding without telling the farmer in-app; a farmer whose district text doesn't exactly match never sees notices.

### 4.16 Notifications
- Today these are **reminders for planting notices** (sent automatically 30, 14 and 7 days before the target month to farmers who haven't replied).
- `GET /api/farmer/notifications?page&page_size` (newest first; the app asks for 50) → items `{id, notice_id, reminder_slot, title, body, language, channel, status, sent_at, read_at, created_at}` plus `unread_count`, totals.
- **Unread count**: fetched quietly when the farm overview opens (`page_size=1`); any failure shows 0 (the indicator disappears rather than erroring).
- **Opening an item** marks it read optimistically and `POST /api/farmer/notifications/{id}/read` (idempotent, best-effort); if it references a notice, the notice opens, and the list reloads on return.
- Empty copy: "You'll receive reminders here when upcoming planting seasons approach."
- **Edge cases**: no push — items only appear when the app is open and refreshes; 404 on read if the notification belongs to someone else/doesn't exist.

### 4.17 Account, sync, logout
- **Profile** (read-only): `GET /api/v1/users/me` → id, email, name, phone, role, district, dsd, gn_division, business_name. Shown: initial/avatar, name (or email), role label, email, phone, "location" (GN, DSD, district). There is **no edit** (so wrong district from sign-up is permanent, and Google-created accounts stay incomplete).
- **PIN**: "Set up a PIN" / "Change PIN" (§3.2). Note: the "PIN updated." confirmation appears even if the person backs out without saving.
- **Sync**: "All synced" or "N pending sync", opens the queue (§3.5).
- **Account type** is shown with "Set at signup — contact support to change roles."
- **Log out**: confirmation: "Anything already recorded stays saved on this device and on the server. You'll need your email and password to sign back in." — then token and PIN are wiped and the app returns to sign-in.
- Shows app version/build.

---

## 5. Server-side behaviors the app depends on

### 5.1 Photos (`POST /api/v1/photos`, multipart)
Fields: `file` (jpeg/png/webp, ≤ 10 MB), `plot_id` (must be the caller's plot), `event_type` ∈ {plot_photo, planting_photo, progress_photo, batch_photo}, `event_id` (idempotency key; a repeat returns the existing record **without re-uploading**), optional `caption`, `occurred_at`, `lat`/`lon` (distance from plot centre computed; flagged if > 500 m, stored as `distance_from_plot_m`, `location_flagged`), `batch_id` (required in practice for batch photos; must belong to the plot), `crop` (planting photos). Returns an event whose payload includes `photo_url`. Listing: `GET /api/v1/photos?plot_id=` (owner only), schedule: `GET /api/v1/photos/schedule?plot_id=`.

### 5.2 Buyer commitments (older, simpler buyer mechanism)
Exporters/admins can register **commitments** (crop, optional standard, volume kg, remaining kg, delivery window, indicative price LKR/kg). When a farmer registers a batch (or a collector merges), the server auto-matches **one** open commitment with the same crop and remaining volume > 0 — preferring one that names the batch's exact standard, otherwise one that names no standard. The farmer sees a **"Matched to an open buyer order"** summary: kg wanted, price, deliver-by date. A **weigh** event on a matched batch recomputes the commitment's remaining volume from each batch's latest weight (re-weighing does not double count). `GET /api/v1/commitments[?crop]` lists open commitments (public). This is separate from the ads marketplace in §4.12 and has **no exporter UI** today.

### 5.3 Batch identity
Codes are random with a checksum from a server secret; unique; looked up case-insensitively after trimming. A batch has optional parents (lineage) and, for collection batches, no plot.

---

## 6. Collector tasks

### 6.1 Sign up / sign in
Same as farmers (§3.1–3.3) with `POST /auth/signup/collector`. Collectors then run the same PIN flow. Their home is the collection round; the only other destination is settings (§4.17 subset: profile, PIN, sync, logout).

### 6.2 Run a collection round
**Goal**: combine leaf bought from several farmers into one outgoing batch while independently checking what was received.

**Per farmer batch** (repeat):
1. **Scan** the farmer's QR (QR only; duplicate reads within 3 s ignored; one batch cannot be added twice in a round: "<code> is already in this round."). `GET /api/v1/batches/by-code/{code}`; failures: `Could not look up "<code>": …`.
2. **Verify the farmer's claim** (only if the batch claims a quality standard): `GET /api/v1/batches/{id}/schedule`. If the standard is not fully verified — or the check **fails** (offline/error) — the collector sees *"Not yet verified: <code> claims <standard>, but only n/m required steps have a matching recorded event. Add it to this round anyway?"* (or the check-failed variant) and must explicitly choose **Add anyway** or cancel. A batch with no claimed standard is not flagged.
3. **Record what was taken**: weight in kg (required numeric; digits and a decimal point) and the collector's **own condition check** — *good / fair / poor* (default good) — with optional note. **If the weight is blank/invalid the confirmation silently does nothing** (no message).
4. On confirm, two events are **queued offline** against the batch under the collector's identity: `weigh {weight_kg}` and `collector_attestation {condition, note?}`. The attestation is a separate, independently sourced data point (not the farmer's self-report), shown as its own line in the public timeline. The farmer's batch then joins the round with weight, condition, and a "Not verified" marker when applicable.

**Round summary**: count of batches, total kg, each batch (code, crop, condition (poor is flagged as needing attention), weight, "Not verified" marker, standard verdict at the time of adding).

**Combine**: allowed with **≥ 2** batches (client: "Add at least two farmer batches before combining."). `POST /api/v1/batches/merge {parent_batch_ids[], crop, protocol_id?}` — caller must be a collector/admin; ≥ 2 **distinct** existing parents; the new batch has no plot, records parent ids, gets a new code and auto-matches a commitment (§5.2). On success the basket empties and the new batch's QR is shown for labelling.

**Edge cases**
- The basket lives **only in memory**: closing the app loses it, while the `weigh`/`attestation` events already queued remain recorded on the farmer batches (no merged batch exists for them).
- Merge takes the **crop of the first batch only**; mixed-crop baskets are not prevented. No standard is attached to the combined batch.
- The **total weight is not recorded on the new batch** — only on the parents.
- Merging requires a connection; weighing/attestation do not. The unverified-check also needs a connection (failure is treated as "unverified").
- The confirmation text under the new QR reads "combined from <new code>'s round" (it names the *new* code — a wording defect).
- A collector can attest/weigh any batch they can scan, including batches they never physically handled.

---

## 7. Data dictionary (mobile-facing)

**Plot** `{id, owner_user_id, center_lat, center_lon, area_ha, boundary_source walked|traced|estimated_square, plot_type, name?, district, dsd, gn_division, plantings[{crop, planted_at, area_ha?, protocol_id?, protocol_name?}], created_at}`.
**Batch** `{id, code, crop, plot_id?, parent_batch_ids?, protocol_id?, protocol_name?, commitment_id?, commitment{id, crop, volume_kg, remaining_kg, delivery_window_start/end, indicative_price_lkr_per_kg}?, created_at, latest_status, latest_occurred_at}`.
**Event** `{id (client UUID), event_type, user_id, batch_id?, plot_id?, payload{}, occurred_at, recorded_at}`; append-only.
**PlotPhoto** `{id, event_type, photo_url, caption?, occurred_at, location_flagged}`.
**PlotPhotoSchedule** `{plot_id, has_registration_photo, planted_at?, interval_days (30), checkpoints[{sequence, due_date, satisfied, status done|overdue|upcoming}]}`.
**Protocol (quality standard, built-in)** `{id, crop, tier, name, source, stages[{sequence, day_offset?, title, instructions, required_event_types?}]}`. A day-offset of null means a standing rule. Currently seeded for tea, cinnamon, pepper with cited sources.
**ProtocolEvaluation** `{protocol_id, protocol_name, protocol_tier, protocol_source, stages[{…, due_date, satisfied, status}], required_total, required_satisfied, tier_achieved}`.
**Ad (farmer view)** `{id, crop, grade_tier, quantity_kg, remaining_kg, price_type, price_fixed|min|max, collection_window_start/end, pickup_location, eligible_districts[], expires_at, title, exporter{company_name, description, logo_url, certifications[]}}`; detail adds `{ad_version_id, version_number, computed_status, description, payment_timing, rejection_handling, standard_name, standard_stages[]}`.
**Application (MyAdAcceptance)** `{acceptance_id, ad_id, ad_title, crop, grade_tier, exporter_name, supply_quantity_kg, price…, collection_window, accepted_at, withdrawn_at?, derived_status}`.
**Exporter link** `{id, exporter_profile_id, exporter_company_name, status, requested_at, decided_at?, decision_reason?}`; **VerifiedExporter** `{id, company_name, description, logo_url, districts_served[], crops_bought[], certifications[]}`.
**Stage with status** `{stage_id, position, name, timing_type, start_offset_days, instructions, dos[], donts[], allowed_inputs[], required_proof{photo_count, photo_descriptions[], quick_fields[]}, submission_status?, submission_id?, can_resubmit}`; **Submission** `{id, link_id, stage_id, stage_name, photo_urls[], quick_field_answers{}, note?, status, submitted_at, reviewed_at?, review_notes?}`.
**Planting notice** — summary `{id, crop, target_month, volume_needed_kg, title, exporter_name, exporter_logo_url?, farmer_response?, expected_volume_kg?, plot_id?, published_at}`; detail adds `{message, exporter_company_name, current_response, current_expected_volume_kg, current_plot_id, standard_version_id, standard_name, standard_version_number, stages[{id, stage_order, name, description, rules_count}]}`.
**Notification** `{id, notice_id?, reminder_slot (30|14|7), title, body, language, channel, status, sent_at, read_at, created_at}`.
**Queued event (device-local)** `{id, eventType, payload, userId, plotId, batchId, occurredAt, status pending|failed|synced, createdAt, attempts, lastError, nextRetryAt}`.

---

## 8. Endpoint index (mobile)

| Service | Calls |
|---|---|
| Account & marketplace | `POST /auth/login` · `POST /auth/signup/farmer|collector` · `GET /api/farmer/ads` · `GET /api/farmer/ads/{id}` · `POST /api/farmer/ads/{id}/accept|withdraw` · `GET /api/farmer/ads/my-acceptances` · `GET /api/farmer/exporter-link/exporters|current` · `POST /api/farmer/exporter-link/request|cancel` · `GET /api/farmer/stage-proofs/standards|my-submissions` · `POST /api/farmer/stage-proofs/{stageId}/submit` · `GET /api/farmer/planting-notices` · `GET …/{id}` · `GET …/{id}/plots` · `POST …/{id}/respond` · `GET /api/farmer/notifications` · `POST …/{id}/read` |
| Field data | `GET /api/v1/plots/me` · `POST /api/v1/plots` · `PATCH /api/v1/plots/{id}` · `POST /api/v1/photos` · `GET /api/v1/photos?plot_id=` · `GET /api/v1/photos/schedule?plot_id=` · `POST /api/v1/events` (sync) · `GET /api/v1/events?plot_id=|batch_id=` · `POST /api/v1/batches` · `GET /api/v1/batches/me` · `GET /api/v1/batches/by-code/{code}` · `GET /api/v1/batches/{id}/schedule` · `POST /api/v1/batches/merge` · `GET /api/v1/protocols?crop=` · `GET /api/v1/protocols/{id}` · `GET /api/v1/commitments` · `GET /api/v1/users/me` |
| Public (QR target) | `GET /p/{code}` |

---

## 9. Edge cases, gaps and risks to design for

1. **Wrong-role sign-in**: exporter/admin accounts that sign in on mobile are shown the farmer experience; most calls then return 403/empty. Either block them with a clear message or provide appropriate experiences.
2. **Session expiry is quiet**: only some views explain "session needs refreshing". Queued events keep retrying with 401. A first-class "sign in again to sync" state is missing.
3. **Queue is not cleared on logout**, and authorship follows the *current* token: shared devices can misattribute or reject events. The queue also grows forever (synced rows are never pruned) and permanently failing events retry indefinitely.
4. **PIN has no brute-force protection.** Forgotten PIN = full logout.
5. **Prefilled regional defaults** (Nuwara Eliya) at sign-up and plot registration will mislabel users elsewhere; no profile editing exists to fix it; matching for notices is exact-text.
6. **Required evidence is enforced only at capture time**: the registration photo and batch photo can be missing in the data if the app dies or an upload fails after the record is created.
7. **Weight/number inputs fail silently** (collector weight, optional batch weight, notice volume gives a message but ads quantity just ignores invalid input).
8. **No ordering rules** between pipeline stages; stage events can be recorded on batches a user doesn't own (fails at sync).
9. **Stage-proof photos pollute progress-photo evidence** and the public timeline (§4.14).
10. **QR addresses depend on the build's server address** (§4.9). Printing a QR from a non-production build produces unscannable labels.
11. **Collector basket is volatile**; combined batch lacks total weight, standard, and mixed-crop protection (§6.2).
12. **Withdrawing an ad application probably forecloses re-applying** to that same order; the app does not warn.
13. **No reporting of bad ads from mobile**, although the server supports it; no way to see why an application or exporter request was declined (decline reasons are stored but never reach the farmer — see §4.13).
14. **No notifications beyond planting reminders**: no alerts for link approval, application approval, stage-proof review, or notice cancellation.
15. **Two buyer mechanisms** (ads and commitments) coexist; farmers see both without explanation.
16. **No push, no iOS, no gallery, no language UI, no data export/import.**
17. **Location-off recovery** is handled for boundary tasks but other tasks silently proceed without coordinates, so evidence quality varies; there is no per-record indicator of "no GPS" except in the planting detail and a message at save time.

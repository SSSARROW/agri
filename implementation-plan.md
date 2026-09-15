# Implementation plan

Task-by-task build plan for the web app, the mobile field client, the farmer messaging channel, and the services behind them.

**Task ID prefixes:** `B` backend · `W` web app · `M` mobile · `P` public pages · `D` data/forecast · `OPS` infrastructure

**Effort sizes:** S = 1–2 days · M = 3–5 days · L = 1–2 weeks, for one developer.

**`[MVP]`** marks the minimum set that produces a working end-to-end demo. Everything else can slip without breaking the story.

---

## Assumptions

- Two developers. The natural split is one on backend + mobile capture, one on web + data/forecast. Milestone 5 has almost no dependency on milestones 1–4, so it can run fully in parallel from day one.
- Android only for mobile. No iOS build.
- One crop, one district, one buyer for the first working loop.
- Sinhala is a first-class language, not an afterthought. Build i18n in from task W-01, because retrofitting it is miserable.

## The four surfaces

| Surface | Users | Built as |
|---|---|---|
| Web back office | Exporter/processor staff, admins, agronomists | React SPA |
| Mobile field capture | Collectors, field officers | React PWA, Capacitor-wrapped to APK |
| Farmer channel | Farmers | SMS and WhatsApp. **No app.** |
| Public provenance | Foreign buyers, consumers | Server-rendered page, no login |

---

## Milestone 0 — Foundations

*Goal: both developers can run the stack locally and deploy. Nothing user-visible.*

| ID | Task | Size |
|---|---|---|
| OPS-01 | **Repo and local environment.** Monorepo: `/api`, `/web`, `/mobile`, `/data`, `/infra`. Docker Compose with Postgres + PostGIS. `.env.example` committed, real `.env` never. **Done when:** a fresh clone runs with one command. | S |
| OPS-02 | **Deploy target.** Single VPS, Docker, nginx, TLS via Let's Encrypt, one staging environment. GitHub Actions on merge to main. **Done when:** a push deploys automatically and you can hit the health endpoint over HTTPS. | M |
| B-01 | **FastAPI skeleton.** Settings via pydantic-settings, structured logging, consistent error envelope, `/health`, OpenAPI docs on. **Done when:** `/health` returns 200 and docs render. | S |
| B-02 | **Schema v1 + Alembic.** Tables: `actor`, `plot`, `batch`, `event`, `scan`. PostGIS enabled, spatial index on `plot.geometry`. Append-only enforced with a trigger blocking UPDATE and DELETE on `event`. **Done when:** migrations run clean up and down, and a manual UPDATE on `event` is rejected. | M |
| B-03 | **Auth.** Phone + OTP to register, 4-digit PIN for daily login, JWT access token plus long-lived refresh, role claims. Rate-limit OTP requests. **Done when:** a user registers by phone, logs in with PIN, and a role-gated endpoint correctly rejects the wrong role. | M |
| B-04 | **Seed script.** One district, 20 plots with real-looking polygons, 15 actors across roles, crop reference data, 30 batches with plausible event chains. **Done when:** `make seed` produces a database you can demo from. | S |
| W-01 | **Web shell.** React + router, layout, auth guard, typed API client generated from OpenAPI, i18n scaffolding (en/si), toast and error handling. **Done when:** login works and a protected route redirects when logged out. | M |

---

## Milestone 1 — The ledger and registration (web) `[MVP]`

*Goal: company staff can register actors, plots and batches, and print QR labels.*

| ID | Task | Size |
|---|---|---|
| B-10 | **Actor API.** CRUD for farmer, collector, processor, exporter, auditor. NIC stored hashed, never in plaintext. **Done when:** roles round-trip and NIC never appears in any API response. | S |
| B-11 | **Plot API.** Create/update with GeoJSON polygon, server-side area calculation, reverse lookup of district/DSD/GN from an admin boundary table. **Done when:** posting a polygon returns correct hectares and the right GN division. | M |
| B-12 | **Batch creation + code generation.** Short human-typeable codes (avoid ambiguous characters), HMAC-signed so codes can't be guessed or enumerated. **Done when:** codes are unique, unguessable, and readable aloud over a phone. | M |
| B-13 | **Event append API.** Single generic endpoint taking `event_type` + jsonb payload. **Client-supplied UUID for idempotency** — this is what makes offline sync safe later, so don't skip it. Per-type payload validation. **Done when:** posting the same event twice with one UUID creates exactly one row. | M |
| B-14 | **Lineage.** `parent_batch_ids` array, split and merge endpoints, recursive CTE to walk the DAG in both directions. **Done when:** a batch merged from three parents and then split into five children resolves its full ancestry in one query. | M |
| W-10 | **Actor registry screens.** List with search and role filter, create form, detail view. | S |
| W-11 | **Plot registration with map.** Leaflet plus a draw plugin. Draw or drop a pin, area shown live, satellite basemap so farmers can recognise their land. **Done when:** a plot drawn on the map saves and reloads in the right place. | M |
| W-12 | **Batch registration + label printing.** Form, QR generation, printable label layout sized for your thermal printer. **Done when:** a printed label scans correctly on a phone. | M |
| W-13 | **Batch detail view.** Event timeline, lineage tree, map of origin plot. | M |

---

## Milestone 2 — Mobile field capture `[MVP]`

*Goal: a collector in a field with no signal can scan, record and sync later.*

| ID | Task | Size |
|---|---|---|
| M-01 | **PWA shell.** React, manifest, service worker with app-shell caching, install prompt. Large tap targets, high-contrast — this is used outdoors in sunlight. **Done when:** it installs to an Android home screen and opens with no network. | M |
| M-02 | **QR scanner.** Native `BarcodeDetector` where available, `html5-qrcode` as fallback. Continuous scan mode, audible confirmation. **Done when:** ten consecutive labels scan without reloading the page. | M |
| M-03 | **Offline write queue.** IndexedDB (use Dexie). Every event gets a client UUID at creation. Queue shows pending count. **Done when:** with the device in airplane mode, five events are captured and survive an app restart. | M |
| M-04 | **Sync engine.** Retry with backoff, sync on reconnect, per-item status (pending/synced/failed), manual retry for failures. **Done when:** airplane mode off results in all queued events landing exactly once, verified server-side. | M |
| M-05 | **Capture flows.** Config-driven forms per event type — collect, weigh, process, grade, pack. One renderer, not five screens. **Done when:** adding a new event type needs a config change only, no new component. | L |
| M-06 | **GPS capture.** Coordinates plus accuracy at capture time. Warn above a threshold. Store device time as `occurred_at`; server sets `recorded_at` on sync. **Done when:** an event captured offline retains its true capture time after syncing hours later. | S |
| M-07 | **PIN login, offline-capable.** OTP registration needs network; daily PIN unlock must not. Session survives weeks without connectivity. **Done when:** a user unlocks and captures with no network for three consecutive days. | M |
| M-08 | **Capacitor wrap.** Android build, camera and location permissions, signed APK, sideload instructions. **Done when:** the APK installs on a real device and camera + GPS work. | M |

---

## Milestone 3 — Provenance and verification `[MVP: P-01 and B-22 only]`

| ID | Task | Size |
|---|---|---|
| B-20 | **Public provenance endpoint.** No auth, aggressively cached, returns the full resolved lineage and timeline for a batch code. **Done when:** it responds in under 200ms warm. | S |
| B-21 | **Scan logging.** Record every read: timestamp, hashed IP, coarse geolocation, user agent. **Done when:** scans are logged without storing anything personally identifying. | S |
| B-22 | **Duplicate scan detection.** Flag when the same code is scanned from distant locations or an implausible number of times. Provenance response carries a warning state. **Done when:** the second scan from a different location returns the alert. | M |
| B-23 | **Verification rules engine.** Mass balance per facility per period; yield ceiling per crop/district; cycle timing; recording lag; peer z-score within GN division. Each rule returns a score and a human-readable explanation. **Done when:** a deliberately falsified seed batch trips the expected rules with readable reasons. | L |
| B-24 | **Trust scores + audit queue.** Nightly job aggregating rule outcomes per actor. Ranked queue endpoint. **Done when:** the queue orders actors by risk and each entry explains why. | M |
| P-01 | **Public provenance page.** Server-rendered, mobile-first, works with JavaScript disabled, Sinhala/English toggle, prominent counterfeit warning state. **Done when:** it renders correctly on a mid-range Android over a throttled 3G connection. | M |
| W-20 | **Audit queue screen.** Flagged actors and batches with rule explanations, mark-reviewed action. | M |

---

## Milestone 4 — Protocol engine and farmer messaging

*Goal: the contract-farming loop. A farmer enrolled in a protocol gets the right instruction at the right growth stage, and his batch is graded into a tier by what he actually did.*

| ID | Task | Size |
|---|---|---|
| B-30 | **Protocol schema.** `protocol` (crop + tier) → ordered `stage` rows with day offsets from planting, instruction text, and the event types required to satisfy the stage. Versioned — editing a live protocol must not retroactively change past evaluations. **Done when:** two tiers of one crop are defined and versioned independently. | M |
| B-31 | **Enrollment.** Bind plot + season + protocol version to a farmer. **Done when:** a farmer is enrolled and his stage schedule is visible. | S |
| B-32 | **Stage scheduler.** On the `planted` event, compute every stage due date and queue outbound messages. Re-plan if planting is corrected. **Done when:** a backdated planting event produces a correctly shifted future schedule. | M |
| B-33 | **Tier evaluation.** For a completed batch, check protocol satisfaction and assign the achieved tier, with a per-stage pass/fail breakdown. **Done when:** a batch missing one required stage is correctly downgraded and explains why. | M |
| B-34 | **SMS gateway adapter.** Provider interface with a local gateway implementation plus a mock for development. Sinhala and Tamil templates, delivery-status logging, per-farmer send throttle. **Done when:** a real Sinhala message arrives on a real phone with correct rendering. | M |
| B-35 | **Inbound keyword handling.** Simple replies — `OK`, `HELP`, crop code to request a forecast. | M |
| W-30 | **Protocol builder.** Admin UI to define stages, offsets, instructions, required events. Preview the farmer's message sequence. | L |
| W-31 | **Enrollment and progress.** Per-farmer stage progress, overdue flags, message delivery history. | M |

---

## Milestone 5 — Forecast

*Independent of milestones 1–4. Start it on day one in parallel.*

| ID | Task | Size |
|---|---|---|
| D-01 | **Price ingest.** Loaders for World Bank Real Time Prices and the WFP dataset on HDX into `price_observation`. Idempotent re-runs. **Done when:** a re-run creates no duplicates and the row count matches the source. | M |
| D-02 | **Crop and market normalisation.** Mapping table reconciling names across sources. This is tedious and it is the task people underestimate. **Done when:** one crop resolves consistently across all three sources. | M |
| D-03 | **Evaluation harness.** Walk-forward validation, never a random split. Seasonal-naive baseline. MAE/MAPE by horizon. **Done when:** the baseline's score is recorded and every later model is reported against it. | M |
| D-04 | **Classical models.** SARIMA and/or Prophet per crop-market series, with fallback when a series is too short. **Done when:** it beats seasonal naive on the majority of series, or you've documented that it doesn't. | M |
| D-05 | **Gradient-boosted model.** LightGBM on lag features, rolling stats, month, Yala/Maha season. **Done when:** benchmarked against D-03 and D-04. | L |
| D-06 | **Backtest visualisation data.** Prediction versus actual for a chosen historical window, served as an API. **Done when:** one real historical price crash is shown correctly predicted, or honestly shown missed. | S |
| B-40 | **Planted extent aggregation.** Query rolling up `planted` events by crop, week and GN/DSD. Feeds D-05 as a feature once there's real volume. **Done when:** seeded events produce correct weekly extent by area. | M |
| D-07 | **Recommendation allocator.** Convert forecasts into per-farmer planting recommendations that **spread across crops instead of giving everyone the same answer**, capped by buyer commitments. Feed issued recommendations back as expected extent. **Done when:** 100 simulated farmers receive a distribution, not one crop. | L |
| W-40 | **Forecast dashboard.** Price history charts, backtest view, national map with planted extent by district, per-crop drill-down. | L |

---

## Milestone 6 — Buyers and commitments

| ID | Task | Size |
|---|---|---|
| B-50 | **Buyer and commitment entities.** Crop, tier, volume, delivery window, indicative price. **Done when:** a commitment is created and shows remaining unallocated volume. | S |
| B-51 | **Allocation.** Match commitments to enrolled farmers by district, tier and expected volume. **Done when:** a 200-tonne commitment allocates across farmers without over-allocating. | M |
| B-52 | **Delivery reconciliation.** Delivered batches against commitment, shortfall and surplus reporting. | M |
| W-50 | **Buyer portal.** Commitments, incoming batches with tier and provenance, compliance export as PDF/CSV. **Done when:** a buyer downloads an audit-ready document for a shipment. | L |

---

## Milestone 7 — Hardening

| ID | Task | Size |
|---|---|---|
| OPS-10 | Automated nightly Postgres backups with a **tested restore**. An untested backup is not a backup. | S |
| OPS-11 | Error monitoring (Sentry or equivalent) across api, web and mobile. | S |
| OPS-12 | Rate limiting on public and auth endpoints. | S |
| B-60 | Load-test the provenance endpoint — it's the one strangers hit. | S |
| M-10 | Offline demo mode: a flag that runs the mobile client entirely from local fixtures. | S |
| W-60 | Full Sinhala translation pass with a native reader, not machine translation. | M |
| B-61 | Data retention and privacy review: hashed NIC, coarse geo only, farmer consent text for messaging. | M |

---

## Critical path

The shortest route to a working end-to-end demo:

```
OPS-01 → B-01 → B-02 → B-03
           ├──► B-12 → B-13 → W-12 ──┐
           │                          ├──► P-01 → B-22   [demo ready]
           └──► M-01 → M-02 → M-03 → M-04 → M-05 ──┘
```

Everything in Milestone 5 runs beside this with no dependency until B-40.

**If two of you:** one takes the B + M column, the other takes W + D. Agree the API contract early (B-13's event shape especially) and generate the web client from OpenAPI so it can't drift.

## Sequencing advice

**Build M-03 and M-04 before M-05.** Offline sync is architectural. Bolting it onto finished capture forms means rewriting them.

**Do D-03 before any modelling.** Without the evaluation harness you have no way to know if a model is good, and you will waste a week on one that isn't.

**Do B-13's idempotency properly on the first attempt.** Every offline guarantee in the mobile client rests on it.

**Treat B-30's versioning as non-negotiable.** If editing a protocol silently changes how past batches were graded, your audit trail is worthless and the whole premise collapses.

## Cut list

If time runs short, cut in this order and lose the least:

1. B-35 inbound SMS
2. W-30 protocol builder — seed protocols directly in the database instead
3. D-05 gradient-boosted model — classical models are enough to demonstrate
4. B-23 and B-24 full verification — keep only mass balance, which is a `SUM()` and gives the best demo moment
5. M-08 Capacitor wrap — the PWA demos fine from a URL
6. Milestone 6 entirely — hand-broker the buyer relationship and show it as a roadmap

Do not cut: B-13, M-03, M-04, P-01, B-22.

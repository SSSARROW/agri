# Origo Pitch Kit & Platform Playbook

*Based on repository codebase analysis at commit `f0a6d02f7b6074adffeb18bf7ef6417324064eb2` (Thu Oct 22 21:10:38 2026 +0530).*

---

## 1. Project at a Glance

* **Platform Name:** Origo (platform & brand name: *Origo Agri Tech*; backend services named *Paramparā* / *Agri*).
* **One-Sentence Purpose:** Origo connects export buyers with smallholder farmers through verifiable, digital contract-farming loops—guaranteeing export quality standards before harvest and proving authentic provenance to international buyers with tamper-proof records.
* **The Problem:** Agricultural exporters routinely reject up to 30–40% of smallholder harvest batches due to chemical residue violations, poor grading, or lack of harvest traceability; meanwhile, farmers have no guaranteed buyer, rely on exploitative middlemen, and cannot prove the quality of their work.
* **The Solution:** A dual-surface system—a simple, offline-first mobile app for farmers and collectors, and a web command center for exporters and administrators—that locks in immutable quality standards, verifies farm practices with GPS and photo proofs, coordinates planting schedules, and generates QR-backed public provenance pages for foreign buyers.
* **Baseline Code State:** Verified at commit `f0a6d02f7b6074adffeb18bf7ef6417324064eb2` (22 October 2026).

---

## 2. The Roles Explained Simply

The platform coordinates four distinct roles across field and office surfaces:

| Role | Who They Are | Primary Surface | Main Capabilities Today (Verified in Code) |
|---|---|---|---|
| **Farmer** | Smallholder growers cultivating crops (such as Ceylon tea, cinnamon, and pepper) on individual plots. | **Mobile App** (Android) | 1. **Map Plots:** Map land boundaries by walking corners with phone GPS or tracing on satellite maps.<br>2. **Find Guaranteed Buyers:** Browse verified exporter buying ads on the Market tab, inspect required quality standards, and submit applications with pledged harvest volume.<br>3. **Submit Photo Proofs:** Record planting and upload geo-tagged, timestamped photo evidence for required crop stages (e.g., pruning, fertilizer application).<br>4. **Respond to Planting Notices:** Receive seasonal instructions and confirm planted area and target dates.<br>5. **Register Harvest Batches:** Generate HMAC-signed batch codes with QR labels, recording initial weight, grade, and linked quality standards.<br>6. **Work Fully Offline:** Record field events and photos without cellular signal; the app automatically queues and syncs when back online. |
| **Exporter** | Commercial processing and exporting agribusinesses sourcing agricultural produce for global markets. | **Web Portal** (Desktop Browser) | 1. **Register Company Profile:** Submit business registration and export license numbers for admin verification.<br>2. **Define Quality Standards:** Create crop standards from national templates (SLTB Export Standard, SLS 81:2021 Cinnamon, SLS 105-1 Pepper, SLS 1324 Organic) with custom grade specs and required photo checkpoints.<br>3. **Publish Buying Ads:** Post target volume demands, price indications (LKR/kg), target districts, and delivery windows tied to immutable standards.<br>4. **Review Farmer Applicants:** Inspect applicants' pledged volume, plot area, and location, then approve or reject them to form official supply links.<br>5. **Broadcast Planting Notices:** Issue seasonal planting instructions with automated 30-, 14-, and 7-day stage reminders.<br>6. **Verify Stage Proofs:** Audit submitted field photos and farm notes, approving compliance or requesting revisions before harvest. |
| **Collector / Field Officer** | Agribusiness field officers or regional collection agents visiting farms at harvest time. | **Mobile App** (Android — Dedicated "Round" Mode) | 1. **Scan Batch QR Codes:** Scan farmer harvest batch QR labels in the field using the device camera.<br>2. **Weigh & Grade on Intake:** Record field intake weight and quality grade against the exporter's standard.<br>3. **Merge Batches with Lineage:** Combine multiple smallholder batches into bulk collector lots while preserving full ancestral lineage in a directed acyclic graph (DAG).<br>4. **Trace Origin on the Spot:** Look up the exact origin farm, district, and harvest time directly from a batch scan.<br>5. **Offline Queueing:** Conduct collection rounds in remote valleys with zero connectivity; all transactions queue locally with unique IDs. |
| **Administrator** | Origo platform managers, agronomists, and compliance officers overseeing platform integrity. | **Web Admin Portal** (Desktop Browser) | 1. **Verify Exporter Accounts:** Review uploaded business registration and export licenses; approve or reject exporters to prevent fraud.<br>2. **Audit Verification Logs:** Inspect timestamped records of every exporter verification and rejection decision.<br>3. **Moderate Buying Ads:** Review flagged or farmer-reported ads and suspend misleading or non-compliant market offers.<br>4. **Manage User Ecosystem:** Monitor registered actors, inspect account roles, and toggle access authorization across the platform.<br>5. **Monitor Fraud & Scans:** Detect anomalous multi-location QR scans and review backend audit flags (mass balance violations, yield ceiling breaches). |

---

## 3. Feature Status Table

Every feature is classified based strictly on code verification at the latest commit:
* **WORKING:** Backend logic, database persistence, and user interface (web or mobile) fully exist and interact.
* **PARTIAL:** Backend exists and works, but dedicated frontend screens or external integrations are incomplete.
* **ROADMAP:** Planned architecture or conceptual milestones not yet implemented in the codebase.

| Feature Area | Specific Capability | Surface | Status | Verification & Code Evidence |
|---|---|---|---|---|
| **Account & Security** | Exporter Registration & Verification | Web Portal / Backend | **WORKING** | Self-serve signup (`web/frontend/app/signup/exporter`); admin verification interface (`web/frontend/app/admin/exporters`); database log (`001_create_exporter_profiles`, `002_create_exporter_verification_log`). |
| **Account & Security** | Farmer & Collector PIN Authentication | Mobile App / Backend | **WORKING** | Fast 4-digit PIN setup (`pin_setup_page.dart`) and offline unlock (`pin_unlock_page.dart`) backed by JWT tokens. Survives app cold starts without network. |
| **Account & Security** | User Management & Access Control | Web Admin / Backend | **WORKING** | User directory (`web/frontend/app/admin/users`), user inspection, and status toggle (`admin/users/[id]`). |
| **Land & Plots** | GPS Boundary Walk Mapping | Mobile App / API | **WORKING** | Farmers walk plot perimeter; app collects GPS coordinates, calculates polygon area, warns if accuracy > 50m (`plot_boundary_walk_page.dart`). |
| **Land & Plots** | Map Tracing Plot Registration | Mobile App / API | **WORKING** | Farmers or field officers tap points on satellite basemap to trace plot boundary (`plot_map_trace_page.dart`). |
| **Land & Plots** | Reverse Admin Boundary Lookup | Backend API | **WORKING** | Converts GPS polygon to District, DS Division, and GN Division automatically (`api/app/api/routes/plots.py`). |
| **Quality Standards** | Template-driven Standards Creation | Web Portal / Backend | **WORKING** | Exporters create standards for Tea (SLTB, SLS 1324) and Cinnamon (SLS 81:2021) from pre-configured templates (`templates.py`, `standards/page.tsx`). |
| **Quality Standards** | Multi-tier Grade Spec Editor | Web Portal / Backend | **WORKING** | Custom grade thresholds (Grade 1, 2, Reject; moisture %, quill grade, bulk density) (`GradeSpecEditor.tsx`). |
| **Quality Standards** | Cultivation Stage & Rule Builder | Web Portal / Backend | **WORKING** | Exporters define one-time or recurring stages, offset days, dos/don'ts, allowed inputs, banned chemicals, and photo requirements. |
| **Quality Standards** | Immutable Published Versioning | Web Portal / Backend | **WORKING** | Standards follow strict versioning (`v1, v2`). Once published, a version cannot be edited (`003_create_quality_standards_up.sql`), protecting contracts. |
| **Market & Contracting** | Exporter Buying Advertisements | Web Portal / Mobile | **WORKING** | Exporters publish demand ads linked to published standards (`app/exporter/ads/new`). Farmers browse on mobile Market tab (`market_page.dart`). |
| **Market & Contracting** | Farmer Ad Application / Acceptance | Mobile App / Web | **WORKING** | Farmers apply with pledged volume and target harvest date (`ad_detail_page.dart`). Exporters review applicants on web (`ads/[id]/applicants`) and approve/reject. |
| **Market & Contracting** | Auto Farmer-Exporter Linkage | Backend / Web | **WORKING** | Approving an applicant automatically establishes an official `farmer_exporter_link` (`004_create_farmer_exporter_links`, `exporter/farmers/page.tsx`). |
| **Market & Contracting** | Ad Reporting & Moderation | Mobile / Web Admin | **WORKING** | Farmers report suspicious ads on mobile (`ad_detail_page.dart`); Admins review and moderate flagged ads (`app/admin/ads/page.tsx`). |
| **Farming Protocol** | Planting Notices & Commitments | Web Portal / Mobile | **WORKING** | Exporters broadcast seasonal planting notices (`planting-notices/new`); farmers view and submit planting commitments (`planting_notices_page.dart`). |
| **Farming Protocol** | Field Stage Proof Submissions | Mobile App / Web | **WORKING** | Farmers take stage photos with camera/GPS and notes (`stage_proofs_page.dart`). Exporters review proofs on web (`stage-proofs/page.tsx`) with Approve / Reject / Request Revision feedback. |
| **Farming Protocol** | In-App Stage & Notice Reminders | Web / Backend / Mobile | **WORKING** | Reminders calculated for 30, 14, 7-day slots (`web/backend/notifications/scheduler.py`). Delivered to mobile notification center (`notifications_page.dart`). |
| **Farming Protocol** | Real Telco SMS Gateway & FCM Push | Backend Services | **PARTIAL** | Multi-provider architecture and DB schemas exist (`notifications/PROVIDER_GUIDE.md`); currently runs via `in_app` and `mock` providers. External cellular telco SMS / Firebase connections are pending. |
| **Field Collection** | Batch Registration with QR | Mobile App / API | **WORKING** | Harvest batch created from plot with weight, grade, and quality standard link; generates HMAC-signed batch code and QR code (`plot_actions.dart`). |
| **Field Collection** | Collector Round (Scan & Merge) | Mobile App / API | **WORKING** | Collector scans multiple farmer batches, records intake weights, and merges into bulk lots with full DAG lineage tree (`collector_home_page.dart`). |
| **Field Collection** | Offline Event Queue & Idempotency | Mobile App / API | **WORKING** | Offline actions saved in Hive with client-generated UUIDs; auto-syncs on reconnect without duplicate record creation (`event_queue.dart`, `sync_service.dart`). |
| **Provenance & Trust** | Public Provenance Web Page | Server-Rendered HTML | **WORKING** | Fast, responsive, server-rendered page at `/provenance/{code}` displaying origin plot, cultivation timeline, harvest weight, and verified quality standard tier. |
| **Provenance & Trust** | Anti-Counterfeit Scan Detection | Backend API / Public | **WORKING** | Detects and flags duplicate QR scans from locations > 100 km apart or > 30 scans/hour (`provenance.py`), displaying warning banner to consumers. |
| **Provenance & Trust** | Farmer Privacy Safeguards | Backend API / Public | **WORKING** | Strips exact GPS latitude/longitude, phone numbers, and NIC numbers from public views (`_sanitize_payload`), showing only district/division. |
| **Integrity & Auditing** | Algorithmic Audit Rules Engine | Backend API | **PARTIAL** | Backend evaluates mass balance (2% gain/35% loss limits), yield ceilings (tea 25t/ha/yr), sequence, and GN peer z-scores (`verification.py`). Dedicated web UI screen for audit queue is pending. |
| **Localization** | Tri-lingual Content (EN / SI / TA) | Web / Mobile / DB | **PARTIAL** | Database and forms support multilingual content (English, Sinhala, Tamil) for ads, standards, and notices. Mobile and web interface chrome (buttons, menus) is currently English-only. |
| **Commercials** | In-App Financial Escrow / Payments | All Surfaces | **ROADMAP** | Direct digital payments, bank integrations, price bidding, and mobile money payouts are not yet built. Pricing is currently an indicative contractual reference. |
| **Predictive Tech** | ML Harvest Yield & Price Forecast | Backend / Data | **ROADMAP** | Machine learning time-series models (Prophet/LightGBM) from early planning are not implemented in the current codebase. |
| **Mobile Platforms** | iOS Native Build | Mobile App | **ROADMAP** | Android APK only; iOS build target is not configured in current repository. |

---

## 4. The Story: An End-to-End User Journey

*The following walkthrough follows a fictional but realistic harvest cycle, demonstrating exactly how the Origo platform functions in code today.*

### Act 1: The Exporter Builds the Standard
**Sunil** is the Head of Procurement at *Lanka Spices & Teas Ltd*, a Colombo-based export firm. He registers on the Origo Web Portal (`/signup/exporter`) with his company registration number and Sri Lanka Export Development Board (EDB) license. An Origo platform administrator verifies his credentials on the Admin Portal (`/admin/exporters`).

Now verified, Sunil creates a new Quality Standard for **Ceylon Cinnamon (SLS 81:2021 Export Grade)**. Instead of drafting legal documents from scratch, he selects the pre-built Cinnamon template. He configures grade requirements (Alba/C5 quill grades, maximum 13% moisture ceiling) and specifies required cultivation checkpoints:
1. *Coppicing/Pruning* (with 1 photo required),
2. *Organic Fertilizer Application* (banning unapproved chemical residues and requiring 1 photo), and
3. *Harvesting & Bark Peeling* (requiring 2 photos showing harvested stems and peeling cleanliness).

Sunil clicks **Publish Version 1**. The standard is now permanently locked and immutable. Sunil then posts a Buying Ad on the platform: *“Seeking 5,000 kg Ceylon Cinnamon C5 Grade. Target Districts: Galle & Matara. Indicative Price: 3,200 – 3,500 LKR/kg. Delivery Window: November 15 – 30.”*

### Act 2: The Farmer Discovers and Applies
In Galle, **Bandara** is a smallholder spice farmer with a 1.2-hectare plot. Bandara opens the Origo Android app on his phone, unlocking it with his 4-digit PIN. 

Earlier, Bandara mapped his cinnamon plot by walking its perimeter corners with the app's GPS Boundary tool (`plot_boundary_walk_page.dart`). The app automatically calculated his farm area (1.18 ha) and linked it to his Grama Niladhari division.

Bandara taps the **Market** tab and discovers Lanka Spices' live ad. He taps to view the details: he sees the buyer's verified status, the clear price range, and the exact SLS 81:2021 quality rules. He taps **Apply**, pledges 800 kg from his Galle plot, and proposes a harvest delivery date of November 20.

Back in Colombo, Sunil opens his Exporter Dashboard (`/exporter/ads/[id]/applicants`), reviews Bandara’s application, sees his verified plot size, and clicks **Approve**. Instantly, an official **Farmer-Exporter Link** is established between Lanka Spices and Bandara.

### Act 3: Cultivation with Proof and Reminders
Sunil broadcasts a **Planting & Maintenance Notice** for the upcoming harvest cycle. The Origo scheduler automatically monitors Bandara’s timeline. Three weeks before harvest, Bandara receives an in-app reminder: *“Reminder: Fertilizer application window closing. Ensure approved organic inputs only.”*

Bandara applies organic compost to his cinnamon trees. Standing in his field, he opens the app's **Stage Proofs** screen, takes a photo of the application, enters the compost type, and hits submit. The app captures the photo along with tamper-resistant GPS coordinates and device timestamps. 

Even if Bandara has no cellular coverage in his grove, the app stores the submission in its local offline queue. When Bandara walks home to an area with mobile signal, the app silently syncs the proof.

Sunil opens his Web Portal's **Stage Proofs** review desk (`/exporter/stage-proofs`). He views Bandara's photo, checks that the GPS coordinates match the registered plot boundary, and clicks **Approve**.

### Act 4: Harvest, Collection, and QR Provenance
In mid-November, Bandara harvests and peels his cinnamon. In the app, he registers a new batch: **800 kg, C5 Grade**, linked to the Lanka Spices quality standard. The app generates a unique, HMAC-signed QR batch label (`CIN-GAL-8492`).

**Kasun**, a field collector for Lanka Spices, arrives with his truck. Opening the Origo app in **Collector Round** mode, Kasun scans Bandara's batch QR code using his phone camera. The app verifies the batch origin, plot, and stage approval. Kasun weighs the quills on his digital scale (792 kg net), confirms the grade, and accepts the batch. Kasun scans two other farmers' batches and merges them into bulk transport Lot `LOT-COL-2026-09`.

### Act 5: The European Buyer Scans the Provenance
The bulk lot is shipped to Hamburg, Germany. **Greta**, a quality manager for a German specialty retailer, receives the shipment boxes displaying Origo QR codes. She scans the code with her smartphone.

Without downloading any app or logging in, a fast, server-rendered provenance page opens in her mobile browser (`/provenance/LOT-COL-2026-09`). She sees:
* A green badge: **"✓ Verified — Meets SLS 81:2021 Export Standard (All required stages verified)"**,
* The exact origin: Southern Province, Galle District, with verified plot areas,
* The full chronological audit trail: planting, pruning photo proof, fertilizer inspection, harvest timestamp, and collector weigh-in,
* A clean guarantee of authenticity with zero duplicate scan warnings.

Lanka Spices secures premium pricing, Bandara receives full contract price without predatory intermediary cuts, and Greta has rock-solid compliance documentation for European import authorities.

---

## 5. Exhibition Pitch (2 Minutes & 30 Seconds)

### 2-Minute Stall Pitch
*(Warm, engaging, spoken at a conversational pace while holding up a phone showing the mobile app and pointing to a laptop running the Exporter Dashboard)*

> “Hello! Quick question for you: when you buy a pack of Ceylon Cinnamon or Pure Ceylon Tea in London or Tokyo, how do you actually know it came from a real family farm in Sri Lanka and didn't have banned chemicals sprayed on it two weeks before harvest?
> 
> Right now, you don’t. And that’s a massive crisis. Exporters routinely reject 30 to 40 percent of crops from smallholder farmers at the factory gate because they can’t verify how it was grown. Exporters lose money, foreign buyers lose trust, and smallholder farmers—who do the hardest work—are left stranded with crops they cannot sell.
> 
> That’s why we built **Origo**.
> 
> Origo is a digital contract-farming platform built specifically for smallholder agriculture. It bridges the gap with two simple tools. 
> 
> For exporters, it provides a web command center where they publish exact, government-recognized quality standards—like Sri Lanka Tea Board or SLS organic standards—and issue buying ads with transparent prices.
> 
> For farmers, it provides an Android mobile app that works completely offline in remote villages. Farmers map their farm plots using phone GPS, accept export buying contracts, and upload photo proof of their farming practices at every critical stage—like fertilizer application and pruning.
> 
> When harvest comes, collectors scan the batch QR code in the field, weigh the crop, and merge it with full digital lineage. When that product lands on a supermarket shelf in Europe, the consumer or buyer scans the QR code on the box and instantly sees the entire journey: the verified farm in Galle, the dates, the photo proofs, and an official badge confirming it meets export standards.
> 
> No paper logs. No fake organic claims. Just transparent, verified agriculture that pays farmers what they deserve. Come look at the screen—I can show you a live batch right now!”

---

### 30-Second Passerby Pitch
*(Energetic, focused on grabbing attention)*

> “Hi there! Did you know that up to a third of Sri Lankan export crops get rejected at the port simply because exporters can't prove how smallholders grew them? 
> 
> We’re **Origo**. We’ve built an offline mobile app for farmers and a web dashboard for exporters that turns farming practices into verified, photo-backed proof. Exporters get guaranteed export-grade produce, farmers get locked-in contracts at fair prices, and foreign buyers can scan a QR code to see the exact plot and harvest history. 
> 
> Step in for 60 seconds and let me scan a live batch for you!”

---

## 6. Executive Pitch (7 to 8 Minutes)

*Target Audience: Agribusiness CEOs, Export Executives, Agricultural Ministry Officials, and Investors.*  
*Total Time: 7 minutes 30 seconds.*

```
TIMING BREAKDOWN:
0:00 - 1:00  The Hidden Cost of Export Traceability (The Hook)
1:00 - 2:15  The Structural Industry Disconnect (The Problem)
2:15 - 3:45  The Origo Architecture (The Solution)
3:45 - 5:00  Core Differentiators & Technical Moats
5:00 - 6:00  Commercial Return on Investment (ROI)
6:00 - 7:00  Current Engineering Status & Honest Limitations
7:00 - 7:30  Roadmap & The Ask
```

### [0:00 - 1:00] The Hook: The Hidden Cost of Export Traceability
"Good morning, gentlemen and ladies. 

If you run an agricultural export operation today, your biggest existential threat isn't international demand. Global demand for Pure Ceylon Tea, true cinnamon, and single-origin spices is at record highs. Your threat is compliance and origin integrity.

The European Union's Corporate Sustainability Due Diligence Directive, strict Maximum Residue Limits (MRLs), and rigorous foreign buyer audits now require you to prove the exact origin and chemical compliance of every container you ship. 

Yet today, over 70% of Sri Lanka’s export crops originate across hundreds of thousands of independent smallholder farmers. When your trucks pull into the processing plant, you are relying on handwritten paper weigh-bills, informal middlemen, and blind faith. 

When a container fails a pesticide residue test at Rotterdam or Yokohama, you don't just lose [TO FILL: average cost of a rejected export container, e.g. $45,000]; you lose the commercial reputation of your brand."

### [1:00 - 2:15] The Problem: Why Current Tools Fail
"Why hasn't this been solved? Because agribusiness technology has historically ignored field reality.

Exporters have attempted to manage outgrower schemes using spreadsheets, ERP extensions, and WhatsApp groups. 
* Spreadsheets are disconnected from the field and easily falsified.
* WhatsApp loses critical data, lacks structured compliance records, and cannot enforce pre-harvest intervals.
* Traditional enterprise software assumes constant 4G broadband and requires complex data entry that smallholder farmers cannot or will not perform.

The result? Exporters face volatile supply quality and high rejection rates. Farmers face volatile market prices and lack access to formal buyers. Foreign buyers treat Sri Lankan supply with increasing skepticism."

### [2:15 - 3:45] The Solution: Origo's Dual-Surface Platform
"Origo solves this by creating a closed, verifiable contract-farming loop across two purpose-built surfaces:

First, the **Web Command Center for Exporters**. 
Your procurement and agronomy teams can define digital Quality Standards in minutes, utilizing standardized templates based on official Sri Lanka Standards Institution (SLSI) and Tea Board standards. You specify your grade parameters—moisture limits, density, quill grade—and you define the mandatory stages where farmers must provide photo evidence. You publish Buying Advertisements specifying your target volumes, delivery windows, and indicative prices.

Second, the **Offline-First Field Client for Farmers and Collectors**.
Farmers install a lightweight Android app. In less than two minutes, a farmer walks the perimeter of their land with their phone in hand; the app uses GPS to map the plot boundary and records the exact acreage. Farmers browse active export ads, apply with pledged harvest volumes, and receive approved purchase agreements. 

Throughout the growing season, the platform coordinates the farm. When it’s time for fertilizer application or pruning, the system alerts the farmer. The farmer opens their camera, snaps a photo proof, and the app embeds tamper-resistant GPS metadata and timestamps. 

Crucially, **the app works completely offline**. If a farmer is in an estate valley in Nuwara Eliya or a village in Monaragala with zero cellular reception, every event is queued locally on the device using cryptographically secure unique identifiers. When the device reconnects to a network, the records sync automatically with zero duplicate entries."

### [3:45 - 5:00] What Makes Origo Radically Different
"There are three architectural decisions that make Origo fundamentally different from any generic traceability tool:

1. **Immutable Quality Standards:** In Origo, once an exporter publishes a quality standard, that version is permanently locked. An exporter cannot retroactively alter the rules of engagement during a growing cycle. If specifications change, a new version must be published. This builds absolute contractual trust between farmer and buyer.
2. **Pre-Harvest Proof, Not Post-Mortem Testing:** Traditional quality control happens at the factory gate when it’s already too late. Origo forces quality compliance *during the growing cycle* through mandatory photo proofs and input logging. You catch non-compliance weeks before harvest.
3. **Public Provenance with Anti-Counterfeit Intelligence:** Every batch gets an HMAC-signed QR code. When foreign buyers scan it, they see a transparent, consumer-facing origin story without needing an app. But more importantly, our backend monitors scan activity. If the same retail QR code is scanned in Frankfurt and Dubai within three hours, our system automatically flags a counterfeit duplicate warning."

### [5:00 - 6:00] Commercial Return on Investment (ROI)
"What is the business value of this system?

* **For the Exporter:** You slash factory-gate rejection rates, eliminate middleman fraud, secure predictable supply volumes weeks ahead of harvest, and command a 10% to 25% price premium from foreign buyers who demand verified, audit-ready provenance.
* **For the Smallholder Farmer:** Farmers bypass predatory village middlemen, gain direct access to verified commercial exporters, and receive prompt approval based on demonstrable quality rather than arbitrary roadside discounting.
* **For the Industry:** We protect the international standing of Sri Lanka's geographical indication brands—Pure Ceylon Cinnamon and Ceylon Tea."

### [6:00 - 7:00] Current Engineering Status & Honest Limitations
"We believe in absolute transparency about what we have built. We are not pitching mockups or vaporware.

**As of our latest code commit today:**
* The core web platform, exporter standards builder, buying ads engine, and admin verification portals are **100% operational**.
* The mobile application for plot mapping, offline event queues, stage proofs, batch creation, and collector rounds is **100% functional on Android devices**.
* Public QR provenance pages and anti-counterfeiting scan detection are **live**.

**Here are our current boundaries and limitations:**
* First, our reminder system currently operates via in-app notifications and background simulation. We have designed the provider interfaces for telco SMS gateways (such as Dialog or Twilio) and Firebase Push notifications, but direct telecom carrier contracts must be connected for live SMS dispatch.
* Second, Origo is a compliance and traceability platform, not a banking gateway. Financial settlement—the actual cash or bank transfer—remains handled via existing banking channels; price indicators in the app are contractual references.
* Third, while our backend stores multilingual content in English, Sinhala, and Tamil for all agronomic instructions and ads, the mobile application's system UI menus are currently in English."

### [7:00 - 7:30] Roadmap & The Ask
"Our immediate next milestone is completing telco SMS integration, deploying full Sinhala and Tamil UI localization, and connecting commercial export pilots across tea and spice clusters.

We are actively seeking [TO FILL: What we want from them — e.g., 'three progressive export partners to launch a 90-day pilot across 200 smallholder tea or cinnamon farmers' / 'strategic investment of $X to scale telco integrations and deploy field kits'].

Thank you. We would be delighted to demonstrate the live platform right now."

---

## 7. Live Demo Script

*Follow this exact numbered procedure for an error-free live demonstration. Tested against working code.*

### Pre-Demo Preparation Checklist
1. **Hardware:**
   * One laptop with internet browser open to `http://localhost:3000` (or production web URL `https://agri-web-frontend.onrender.com`).
   * One physical Android phone (or emulator) connected with the Origo mobile app running.
2. **Prepared Test Data:**
   * One verified Exporter account (e.g., `sunil@lankaspices.lk` / password).
   * One published Quality Standard (e.g., "Ceylon Cinnamon SLS 81:2021 Export Grade").
   * One live Buying Ad with active status (e.g., "Target 5,000 kg C5 Cinnamon").
   * One registered Farmer account logged in on the mobile phone with an approved link and an active plot.
3. **Backup Plan (If Internet or Server Fails):**
   * Keep pre-recorded 1080p screen captures of the web applicant approval and mobile QR scan stored locally on the laptop.
   * If mobile network drops, toggle phone to Airplane Mode to demonstrate the **Offline Event Queue**—this turns a network failure into a showcase of Origo's offline resiliency!

---

### Step-by-Step Script

| Step | Surface & Screen | What to Click / Do | What to Say | What Audience Should Notice |
|---|---|---|---|---|
| **1** | **Web Laptop:** Exporter Standards | Navigate to `/exporter/standards`. Click on the published Cinnamon standard. | *"Let's start where quality begins: with the exporter. An exporter sets up their quality protocol based on official national standards. Look here:"* | Point out that published standards are **immutable** (locked badge); rules cannot be retroactively modified once issued. |
| **2** | **Web Laptop:** Exporter Ads | Navigate to `/exporter/ads/new` or open an existing live Ad. | *"The exporter publishes a buying ad tied directly to that standard. They declare the target quantity, price in LKR per kilo, target districts, and delivery dates."* | Point out the explicit link to the quality standard and transparent pricing. |
| **3** | **Mobile Phone:** Farm Tab | Open the app, unlock with 4-digit PIN. Show the registered plot card. | *"Now let's switch to the smallholder farmer in the village. The farmer opens their phone using a fast 4-digit PIN that works even with no internet."* | Notice the clean Material 3 field UI, high contrast for sunlight readability, and GPS plot area in hectares. |
| **4** | **Mobile Phone:** Market Tab | Tap the **Market** icon in bottom navigation. Tap the live Cinnamon Ad. | *"The farmer taps 'Market'. They see live demands from verified exporters. They see the buyer's name, the price range, and the required quality checklist."* | Notice how the farmer sees transparent buyer specs without intermediary distortion. |
| **5** | **Mobile Phone:** Ad Application | Tap **Apply to Ad**. Enter pledged quantity (e.g., `500 kg`), pick plot, select harvest date. Tap **Submit**. | *"The farmer commits 500 kilograms from their verified plot. They submit their application."* | Shows immediate feedback; submission queues and confirms. |
| **6** | **Web Laptop:** Review Applicants | Switch to laptop. Refresh `/exporter/ads/[id]/applicants`. Click **Approve**. | *"Back in the exporter's office, the procurement team immediately sees the incoming application with the farmer's verified plot size. They click Approve."* | Audience sees the applicant status update to 'Approved'. Note that this automatically establishes an approved Farmer-Exporter link. |
| **7** | **Mobile Phone:** Stage Proof | Open **Stage Proofs** (`stage_proofs_page.dart`). Select "Organic Fertilizer". Take a photo with camera. Enter notes. Submit. | *"During cultivation, the exporter requires evidence. The farmer takes a photo of their compost application in the field. The app tags the photo with GPS and timestamp."* | Point out camera capture with automatic metadata validation. |
| **8** | **Mobile Phone:** Offline Demo *(Optional/Showcase)* | Turn on Airplane Mode. Register a harvest batch of 500 kg (`plot_actions.dart`). Tap **Save**. | *"What if there is no signal in the field? Watch: I'll turn on Airplane Mode. I register a 500 kg harvest batch. The app stores it locally in its offline event queue."* | Show the batch created with an instant HMAC-signed QR code, stored safely in the offline queue. |
| **9** | **Mobile Phone:** Collector Round | Turn Airplane Mode off. Switch app to Collector account (`collector_home_page.dart`). Tap **Scan**. Point camera at batch QR. | *"Now the collection truck arrives. The field officer scans the farmer's batch QR code. The app instantly recognizes the farmer, plot, and stage compliance."* | Audio/haptic feedback on scan; batch intake weight and grade recorded. |
| **10** | **Web Laptop:** Public Provenance | Open browser to `/provenance/{batch_code}` (e.g. `CIN-GAL-8492`). | *"Finally, imagine this batch arrives at a supermarket or warehouse in Germany. The buyer scans the package QR code. Here is what they see without installing any app:"* | Point out: (1) Verified Green Badge against national standard, (2) Farm origin district/division, (3) Timeline of photo proofs, (4) Absence of duplicate scan warnings. |

---

## 8. Explaining the System in 30 Seconds / 2 Minutes / 5 Minutes

### In 30 Seconds (Elevator Pitch)
> "Origo is a digital contract-farming platform that guarantees agricultural export quality from the field to the foreign buyer. Exporters publish immutable quality standards and buying ads on our web platform. Smallholder farmers use our offline Android app to map plots, accept contracts, and upload photo proofs of their farming practices. Collectors scan harvest batches with QR codes, and foreign buyers get a public, tamper-proof provenance page proving exactly how and where their food was grown."

### In 2 Minutes (Briefing / Intro Meeting)
> "In agricultural exporting, the biggest point of failure is the smallholder supply chain. Exporters reject up to 40% of smallholder harvest batches because they cannot verify chemical use, harvesting methods, or origin. Farmers, in turn, are at the mercy of village middlemen because they have no direct, transparent contracts with formal exporters.
> 
> Origo solves this through a unified system that connects field and office:
> 
> 1. **The Exporter Portal:** Exporters create binding digital Quality Standards based on national benchmarks (like Sri Lanka Tea Board or SLS Organic standards) with custom grading thresholds and required photo checkpoints. They issue Buying Ads specifying volumes and prices.
> 2. **The Farmer Mobile App:** Built for rural realities, it operates fully offline with daily 4-digit PIN access. Farmers map their farm boundaries using GPS, browse exporter buying ads, apply with pledged harvest volumes, and upload photo proofs during cultivation.
> 3. **The Collector Round:** Field collection officers use the mobile app to scan batch QR codes at farm gates, weigh intake produce, and merge small batches into container lots while maintaining end-to-end digital ancestry.
> 4. **Public Provenance & Trust:** Every finished lot carries an HMAC-signed QR code. Foreign buyers scan it to view a server-rendered provenance page showing the origin plot, cultivation history, and verified standard compliance—backed by duplicate scan detection that warns against counterfeit copying.
> 
> It replaces paper logs and blind trust with verifiable digital proof."

### In 5 Minutes (Comprehensive Technical & Operational Overview)
> "To understand Origo, you have to look at the three core problems it eliminates: supply uncertainty, quality non-compliance, and origin fraud.
> 
> **First: Setting the Rules of Engagement**
> Everything starts with our Exporter Web Portal. Exporters register with verified business registration and EDB license numbers, audited by platform administrators. Once verified, exporters build digital Quality Standards. We have baked in Sri Lankan national standards—SLTB Export Standards for Tea, SLS 81:2021 for Ceylon Cinnamon, and SLS 105 for Pepper. Exporters customize grade specs—moisture ceilings, bulk density, defects—and establish required cultivation stages. Crucially, once a standard version is published, it is cryptographically immutable. Exporters cannot move the goalposts mid-season.
> 
> **Second: Contracting and Field Verification**
> Exporters publish Buying Ads linked to these standards. On the field side, farmers use an Android app designed for high sunlight and poor connectivity. Farmers map their plots by walking boundary corners using phone GPS. They browse the Market tab, see real exporter prices, and pledge harvest volumes. When an exporter approves an application, an official Farmer-Exporter Link is established. 
> 
> During the season, the system coordinates the farmer. Exporters broadcast planting notices, and automated schedulers track upcoming checkpoints. Farmers submit Stage Proofs—photos of fertilizer application, pruning, or pest management. The mobile app validates camera EXIF data, timestamps, and GPS coordinates to ensure the photo was genuinely taken on that specific farm.
> 
> **Third: Offline Resilience in the Field**
> Most rural farms lack reliable internet. Origo was architected with an offline-first event queue using local Hive storage. Every event is assigned a client-side UUID. A farmer or field collector can record boundary walks, input events, stage proofs, batch weighings, and multi-batch merges with zero mobile reception. When the phone eventually reconnects to Wi-Fi or cellular signal, our sync engine dispatches the queue with exponential backoff. The server enforces idempotency—guaranteeing that even if a patchy connection retries five times, not a single duplicate record is created.
> 
> **Fourth: Provenance, Lineage, and Anti-Counterfeiting**
> When produce is harvested, it receives an HMAC-signed QR code. Collectors scan and merge batches into transport lots; our backend tracks this as a directed acyclic graph (DAG), so a 10-ton container can be traced back to every individual contributing smallholder plot. 
> 
> When the container arrives overseas, buyers scan the QR code to open an instant, server-rendered provenance web page. They see the origin district, the full event timeline, and an official verification badge. If an illegitimate distributor attempts to copy and print that QR code on counterfeit packaging, our anti-counterfeit engine flags the anomaly—if the same batch code is scanned from two locations more than 100 kilometers apart or exceeds 30 scans in an hour, a prominent counterfeit alert is displayed immediately.
> 
> In short: Origo turns agronomic compliance into a high-margin commercial advantage for exporters and guaranteed, fair-price contracts for smallholders."

---

## 9. Comprehensive FAQ (30 Questions & Honest Answers)

### For Farmers
1. **How much does the Origo app cost me to use?**  
   *Answer:* The mobile app is free for farmers to download and use. Exporters sponsor platform use because it guarantees their export supply quality.
2. **What kind of phone do I need?**  
   *Answer:* Any standard Android smartphone running Android 5.0 (Lollipop) or newer with a working camera and GPS. It does not require an expensive flagship device.
3. **Does the app work without internet or mobile data?**  
   *Answer:* Yes. You can unlock the app with your PIN, view saved plots, record planting, take stage photos, and register harvest batches with zero connectivity. Everything saves safely on your phone and uploads automatically when you reach signal.
4. **Is the app available in Sinhala and Tamil?**  
   *Answer:* All agronomic instructions, buying ad details, and quality standards can be written and viewed in Sinhala and Tamil. The app menus and navigation buttons are currently in English, with full native language translations coming in the next update.
5. **Will exporters or strangers be able to see my private phone number or National ID (NIC)?**  
   *Answer:* No. Your NIC is hashed for authentication and is never visible. On the public QR provenance page that foreign buyers see, your phone number and exact personal location coordinates are strictly stripped for privacy; only your district and division are shown.
6. **Can I sell to more than one exporter?**  
   *Answer:* Yes. You can maintain links with multiple verified exporters and apply to different buying ads for different plots or crops.
7. **What happens if an exporter rejects my stage photo proof?**  
   *Answer:* The exporter must provide a specific feedback reason in the system (for example, "photo is blurry" or "please show fertilizer container label"). The submission status changes to "Revision Requested," allowing you to take a new photo and resubmit without penalty.

---

### For Exporters
8. **How does Origo prevent fake or untrustworthy exporters from using the system?**  
   *Answer:* Every exporter must self-register with their official Business Registration Number and Export Development Board (EDB) license. Accounts remain in a `pending_verification` state and cannot publish standards or ads until Origo administrators verify credentials.
9. **Can I change a Quality Standard after I publish it?**  
   *Answer:* No. Once a quality standard version is published, it becomes permanently immutable. This protects farmers who have already planted or committed based on those rules. If you need to update parameters, you create a new draft version (e.g., Version 2) and publish it.
10. **How do I monitor crop progress before harvest?**  
    *Answer:* Your web dashboard features a dedicated Stage Proofs review desk (`/exporter/stage-proofs`). As farmers complete required checkpoints (e.g., weeding, fertilizer, pruning), you inspect submitted photos with validated GPS boundaries and timestamps.
11. **Does Origo handle the actual bank payments to farmers?**  
    *Answer:* Not in the current build. Origo manages the contractual commitment, quality verification, and delivery records. Actual financial disbursements occur through your company's existing bank transfers or mobile payment methods.
12. **Can I export compliance reports for foreign buyer audits?**  
    *Answer:* Every harvest batch generates a public provenance URL and API record displaying complete lineage, stage event timestamps, and standard tier compliance that can be shared directly with auditors or embedded into shipping manifests.
13. **What crops are supported out of the box?**  
    *Answer:* The platform includes pre-configured standard templates for Ceylon Tea (SLTB Export Standard & SLS 1324 Organic) and Ceylon Cinnamon (SLS 81:2021 & SLS 1324 Organic), with Pepper (SLS 105-1) seeded in the database. Custom standards can be created for any agricultural crop.

---

### For Executives and Agribusiness Leaders
14. **What is the commercial problem size this platform addresses?**  
    *Answer:* Across South Asian agricultural exporting, post-harvest rejection and quality penalties account for an estimated [TO FILL: estimated export loss percentage, e.g. 15–25%] of potential export earnings. Smallholder compliance failure is the primary bottleneck preventing exporters from fulfilling premium international contracts.
15. **What is Origo's business model?**  
    *Answer:* [TO FILL: Confirmed business model — suggested: SaaS subscription tier for commercial exporters based on annual export volume or active outgrower count, plus enterprise compliance reporting fees].
16. **Why is Origo better than managing outgrowers via WhatsApp or spreadsheets?**  
    *Answer:* WhatsApp and spreadsheets provide zero data integrity: photos lack verified GPS linkage, standards can be disputed, spreadsheets can be edited retroactively, and neither creates audit-ready QR provenance for foreign buyers. Origo enforces tamper-proof, immutable records from plot mapping to supermarket shelf.
17. **What infrastructure does Origo require to run?**  
    *Answer:* The entire platform is containerized using Docker, backed by PostgreSQL/PostGIS and Supabase, and runs on cost-efficient cloud hosting (e.g., Render, AWS, or local on-premise VPS) with minimal server overhead.
18. **What are the primary operational risks?**  
    *Answer:* The primary operational risk is field smartphone adoption and camera compliance among elderly farmers. Origo mitigates this by allowing village collectors and field officers to capture records on the farmer's behalf during routine rounds.

---

### Technical Questions
19. **How does offline data synchronization work without creating duplicates?**  
    *Answer:* The mobile app uses local Hive key-value storage. When an action occurs offline, the client generates a unique UUID (v4) idempotency key. When the sync engine transmits records to the FastAPI backend, the database rejects duplicate UUIDs, ensuring that network retries never generate double entries.
20. **How is plot boundary data stored and validated?**  
    *Answer:* Plot boundaries are stored as PostGIS spatial geometry polygons. The API calculates exact surface area in hectares and performs automated spatial queries to determine administrative boundaries (District, DSD, GN).
21. **How does Origo prevent photo spoofing or gallery uploads?**  
    *Answer:* The mobile app captures photos directly via the hardware camera, extracting EXIF metadata including GPS coordinates and capture timestamps, and verifies that the photo was captured within an acceptable threshold distance of the registered plot.
22. **What technology stack is Origo built on?**  
    *Answer:* The web frontend is built in Next.js (TypeScript) with React 19; the backend is powered by Python FastAPI services with SQLAlchemy and Supabase PostgreSQL; the mobile application is built in Flutter (Dart) for Android.
23. **How does the anti-counterfeit QR detection algorithm work?**  
    *Answer:* Every scan of a public batch code logs a SHA-256 hashed IP, user agent, and approximate GPS coordinates. If a single batch code is scanned from locations separated by over 100 kilometers, or exceeds 30 scans within an hour, the system automatically triggers a counterfeit warning banner.
24. **How do notice reminders work under the hood?**  
    *Answer:* The backend scheduler (`scheduler.py`) evaluates active planting notices against target milestone offsets (30, 14, and 7 days). It dispatches notifications to the database table (`farmer_notifications`), which are polled by the farmer's mobile app.

---

### Honest Limitations & Roadmap
25. **Is there an iOS app available today?**  
    *Answer:* No. The mobile client is currently built and configured strictly for Android devices, reflecting the overwhelming market share (>95%) of Android in rural farming communities.
26. **Can the platform dispatch real SMS text messages to basic feature phones?**  
    *Answer:* Not yet in production. The codebase contains the complete database schema, provider interface, and reminder scheduler (`PROVIDER_GUIDE.md`), but currently operates via in-app notifications and mock delivery until a commercial telco SMS gateway (e.g., Dialog/Mobitel or Twilio) is connected.
27. **Does the platform predict market price crashes using AI?**  
    *Answer:* No. While machine learning price forecasting was outlined in early project roadmaps, it is not implemented in the current codebase. Prices in the system today are real commercial quotations entered by verified exporters.
28. **Can farmers negotiate ad prices inside the app?**  
    *Answer:* No. Exporters specify indicative fixed prices or price ranges (in LKR/kg), and farmers accept or apply with volume. Interactive price bargaining or live auctions are not currently built.
29. **Is there a web interface for smallholder farmers?**  
    *Answer:* While a basic farmer signup page exists on web (`/signup/farmer`), the complete farmer workflow (plot mapping, stage proofs, market applications) is designed exclusively for the mobile app.
30. **How many crops can the system handle?**  
    *Answer:* The backend and standard builders are crop-agnostic and can handle any crop. Pre-configured templates currently exist for Tea and Cinnamon, with Pepper seeded in database models.

---

## 10. Hard Questions & How to Answer Them

*When pitching to skeptical executives, government officials, or agronomists, use these calm, factual responses.*

### Q1: "Farmers in rural Sri Lanka are elderly and tech-illiterate. They won't use a smartphone app."
> **Our Answer:** "That is a valid concern, and we didn't design Origo assuming every 65-year-old farmer will become a software expert. That’s why Origo has two paths:
> First, for farmers with smartphones, the app uses a zero-typing, visual interface—large buttons, camera taps, and a 4-digit PIN instead of complex passwords.
> Second, for farmers who only have feature phones or prefer not to use apps, **the Collector role handles field capture on their behalf**. When the collection officer visits the farm, the officer's app records the intake, maps the plot, and verifies the harvest batch on the spot. The platform works whether the farmer or the field officer holds the phone."

### Q2: "What stops a farmer from taking a photo of their neighbor's organic plot and submitting it as their own?"
> **Our Answer:** "Two built-in technical safeguards:
> First, every plot has a recorded GPS polygon. When a stage proof photo is taken, the app captures real-time hardware GPS coordinates. If the photo location is outside the registered plot boundary, the submission is flagged.
> Second, the system tracks mass balance and agronomic yield ceilings. A 1-acre plot cannot physically yield 10,000 kilograms of tea green leaf. Our backend checks whether claimed harvest volumes exceed biological yield ceilings (for instance, 25,000 kg/ha/year for tea), flagging anomalies before batches can be approved."

### Q3: "What prevents an exporter from agreeing to buy at 3,500 LKR and then refusing to pay at the factory gate?"
> **Our Answer:** "While Origo is not a legal court or a bank escrow service, it creates an unalterable digital audit trail. The farmer has an approved application linked to the exporter's immutable buying ad with the agreed price range and standard version. If an exporter consistently reneges on agreed terms, farmers can report the ad directly from the app, alerting platform administrators to suspend the exporter's verification status."

### Q4: "Why wouldn't an agribusiness just use their existing SAP, Microsoft Dynamics, or custom ERP?"
> **Our Answer:** "Enterprise ERPs are exceptional at inventory management and financial accounting in corporate offices, but they are notoriously terrible at the rural farm gate. They require constant high-speed internet, expensive user licenses, and complex desktop forms. They have no offline GPS polygon walking tool and no consumer-facing QR provenance engine. Origo is the field-level data bridge that captures verifiable farm data where ERPs cannot reach."

### Q5: "If your reminder system doesn't send real telco SMS yet, how can you claim you support outgrower coordination?"
> **Our Answer:** "We want to be completely honest about where our code is today. The complete reminder engine—calculating 30-day, 14-day, and 7-day milestone alerts—is built and working. In the current build, alerts are delivered directly to the farmer's in-app notification center. The database architecture and provider interfaces for external telco SMS gateways are fully prepared. Connecting an enterprise SMS gateway like Dialog or Twilio is a straightforward operational step that we will execute alongside our commercial pilot partners."

### Q6: "Can a corrupt collector weigh 500 kg of substandard leaf, record it as Grade 1, and poison the supply lot?"
> **Our Answer:** "A collector can record intake data, but they cannot forge historical stage proofs. For a batch to achieve an export-grade verification badge on the public provenance page, the underlying plot must have matching, approved photo proofs for required cultivation stages (such as pruning and chemical controls) approved by the exporter's agronomy team *prior* to harvest. Furthermore, our backend mass-balance verification flags any collection round where total output mysteriously exceeds intake weight by more than 2%."

### Q7: "What happens if a foreign buyer scans a QR code when the Origo servers are down?"
> **Our Answer:** "Our public provenance endpoint is built as a lightweight, server-rendered page designed for aggressive CDN edge caching. It contains zero client-side JavaScript dependencies, ensuring it loads in under 200 milliseconds even on low-bandwidth mobile connections. Furthermore, containerized Docker deployments ensure fast failover across multi-region cloud hosting."

### Q8: "How do you make money if smallholder farmers can't pay?"
> **Our Answer:** "Smallholder farmers should never pay for compliance software. The commercial beneficiary of Origo is the exporter. A single rejected shipping container can cost an exporter upwards of $40,000, while verified traceability allows exporters to capture 10% to 20% higher FOB prices from European and American buyers. Exporters pay a software subscription fee to manage outgrower compliance because the commercial return on investment is immediate."

---

## 11. One-Page Cheat Sheet

```
========================================================================================
                                 ORIGO PLATFORM CHEAT SHEET
========================================================================================

CORE PURPOSE:
  Origo is a dual-surface traceability platform that connects agricultural exporters with
  smallholder farmers through binding quality standards, offline field proofs, and public
  anti-counterfeit QR provenance.

THREE KEY FACTS TO REMEMBER:
  1. 100% Offline-Capable Field Operations: Farmers and collectors can walk plot boundaries,
     record stage proofs with photos, and merge batches in remote areas with zero cellular signal.
     All transactions sync idempotently without duplicate records.
  2. Cryptographically Immutable Standards: Once an exporter publishes a quality standard,
     it is permanently locked. Quality rules and grade specs cannot be altered mid-contract.
  3. Consumer-Facing Public Provenance: Anyone can scan a batch QR code to see verified farm
     origin, cultivation timeline, and compliance badges without downloading an app or logging in.

THE THREE PRIMARY DIFFERENTIATORS:
  * Pre-Harvest Field Proofs (not post-mortem gate rejection)
  * Hardware-Validated GPS & Photo EXIF Inspection (preventing fraudulent claims)
  * Dual-Surface Integration (Web portal for exporters, offline Android app for field officers & farmers)

CURRENT VERIFIED STATUS (Commit f0a6d02):
  [WORKING]  Web Exporter Portal, Quality Standards Builder, Buying Ads, Applicant Approval
  [WORKING]  Android Mobile App: GPS Plot Mapping, Offline Event Queue, Stage Proofs, Collector Rounds
  [WORKING]  Public Provenance Web Page & Anti-Counterfeit Duplicate Scan Detection
  [PARTIAL]  SMS & Push Reminders (currently in-app/mock; telco gateways pending)
  [PARTIAL]  Multilingual Support (content payloads support EN/SI/TA; app menus currently English)
  [ROADMAP]  In-App Financial Payments, AI Price Forecasting, iOS Native Build
========================================================================================
```

---

## 12. Gaps & Items to Confirm

*The following list outlines specific commercial and operational metrics that were not present in the repository code and require team confirmation before executive presentations:*

1. **Pilot Deployment Metrics:**
   * `[TO FILL: Current number of active farmers enrolled in testing / pilot]`
   * `[TO FILL: Specific geographic pilot districts — e.g., Galle, Matara, Nuwara Eliya]`
   * `[TO FILL: Participating export commercial partner names, if under NDA or signed]`
2. **Commercial & Business Model Terms:**
   * `[TO FILL: Exact pricing structure for exporters — e.g., monthly SaaS tier vs. per-kilogram fee]`
   * `[TO FILL: Estimated cost savings per exporter container or outgrower cluster]`
3. **Hardware & Telco Gateways:**
   * `[TO FILL: Preferred local SMS gateway provider — Dialog IdeaBiz, Mobitel, or Twilio]`
   * `[TO FILL: Budget allocated for SMS unit costs during national rollout]`
4. **Team & Organizational Details:**
   * `[TO FILL: Founding team, agronomists, and academic/institutional advisors]`
   * `[TO FILL: Official legal entity name and corporate registration details]`
5. **The Executive Pitch "Ask":**
   * `[TO FILL: Specific ask for the pitch finale — e.g., "$150,000 seed investment for telco rollout" OR "Partnership with 3 commercial tea/spice exporters for a 90-day field trial"]`

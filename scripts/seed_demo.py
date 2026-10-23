"""Seeds a realistic, fully interconnected demo: exporters with standards, ads and
planting notices; farmers who follow them, plant, photograph, submit stage proof and
harvest; collectors who weigh and combine batches.

Everything goes through the public APIs (never raw table inserts for business data),
so rules, hashing and ids are exactly what the apps produce. The one exception is
marking the two demo exporters *verified*, which normally needs an administrator.

Additive only: it creates new accounts (or logs into them if they already exist).

    python scripts/seed_demo.py            # needs both backends running
    SEED_PASSWORD=...  to change the shared demo password

Run with a Python that has `httpx` and `Pillow` (see scripts/README-seed.md).
"""
from __future__ import annotations

import io
import math
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFilter

ACCOUNT = os.getenv("ACCOUNT_API", "http://localhost:8001")
FIELD = os.getenv("FIELD_API", "http://localhost:8000")
PASSWORD = os.getenv("SEED_PASSWORD", "Origo@2026")
NOW = datetime.now(timezone.utc)
random.seed(7)


def ago(days: float, hour: int = 8) -> datetime:
    d = NOW - timedelta(days=days)
    return d.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59), microsecond=0)


def iso(d: datetime) -> str:
    return d.isoformat()


# ── tiny HTTP client ─────────────────────────────────────────────────────────

class Api:
    def __init__(self, base: str, token: str | None = None):
        self.base, self.token = base, token
        self.http = httpx.Client(timeout=60)

    def _h(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def call(self, method: str, path: str, ok_missing=False, **kw):
        r = self.http.request(method, self.base + path, headers=self._h(), **kw)
        if r.status_code >= 400:
            if ok_missing:
                return None
            try:
                msg = r.json()
            except Exception:
                msg = r.text[:200]
            raise RuntimeError(f"{method} {path} -> {r.status_code}: {msg}")
        return r.json() if r.content else None

    def get(self, p, **kw): return self.call("GET", p, **kw)
    def post(self, p, body=None, **kw): return self.call("POST", p, json=body, **kw)
    def put(self, p, body=None, **kw): return self.call("PUT", p, json=body, **kw)


def login(base: str, email: str) -> Api | None:
    r = httpx.post(f"{ACCOUNT}/auth/login", json={"email": email, "password": PASSWORD}, timeout=30)
    if r.status_code != 200:
        return None
    return Api(base, r.json()["access_token"])


def account_user(email: str, role: str, payload: dict) -> tuple[Api, Api]:
    """Returns (account-service client, field-service client) for a user, creating it if needed."""
    existing = httpx.post(f"{ACCOUNT}/auth/login", json={"email": email, "password": PASSWORD}, timeout=30)
    if existing.status_code == 200:
        tok = existing.json()["access_token"]
    else:
        r = httpx.post(f"{ACCOUNT}/auth/signup/{role}", json={"email": email, "password": PASSWORD, **payload}, timeout=30)
        if r.status_code >= 400:
            raise RuntimeError(f"signup {email}: {r.status_code} {r.text[:200]}")
        tok = r.json()["access_token"]
    return Api(ACCOUNT, tok), Api(FIELD, tok)


# ── procedural photos (so every record has a believable image) ───────────────

def _sky(d: ImageDraw.ImageDraw, w: int, h: int, horizon: int, top=(120, 170, 215), bottom=(214, 232, 240)):
    for y in range(horizon):
        t = y / max(1, horizon)
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))


def photo(kind: str, seed: int, growth: float = 0.5) -> bytes:
    """kind: plot | planting | progress | batch | leaf | sacks | quill. growth 0..1 for progress."""
    rnd = random.Random(seed)
    w, h = 960, 720
    img = Image.new("RGB", (w, h), (90, 140, 70))
    d = ImageDraw.Draw(img)
    if kind in ("plot", "progress", "planting"):
        horizon = int(h * 0.38)
        _sky(d, w, h, horizon)
        # distant hills
        for i, c in enumerate([(98, 140, 108), (74, 120, 88)]):
            pts = [(0, horizon)]
            for x in range(0, w + 40, 40):
                pts.append((x, horizon - 40 - i * 18 - rnd.randint(0, 36) - 30 * math.sin(x / 150 + i)))
            pts += [(w, horizon + 30), (0, horizon + 30)]
            d.polygon(pts, fill=c)
        d.rectangle([0, horizon, w, h], fill=(70, 115, 55))
        # terraced rows with perspective
        rows = 11
        for r in range(rows):
            t = (r + 1) / rows
            y = horizon + 10 + int((h - horizon - 10) * t ** 1.4)
            band = int(10 + 38 * t)
            d.rectangle([0, y, w, y + band], fill=(52 + int(20 * t), 98 + int(30 * t), 44 + int(10 * t)))
            size = max(5, int(growth * (8 + 46 * t))) if kind != "planting" else max(3, int(4 + 10 * t))
            x = rnd.randint(0, 20)
            while x < w:
                col = (30 + rnd.randint(0, 25), 105 + rnd.randint(0, 50), 40 + rnd.randint(0, 25))
                if kind == "planting":
                    d.line([(x, y + band), (x, y + band - size)], fill=(40, 120, 50), width=2)
                    d.ellipse([x - size // 2, y + band - size - 4, x + size // 2, y + band - size + 4], fill=col)
                else:
                    d.ellipse([x - size, y + band - size, x + size, y + band + size // 2], fill=col)
                x += int(size * 1.9) + 6
        if kind == "plot":
            # shade trees
            for _ in range(5):
                tx, ty = rnd.randint(40, w - 40), horizon + rnd.randint(30, 160)
                d.line([(tx, ty), (tx, ty + 60)], fill=(80, 55, 30), width=6)
                d.ellipse([tx - 36, ty - 40, tx + 36, ty + 16], fill=(34, 90, 44))
    elif kind in ("leaf", "batch"):
        d.rectangle([0, 0, w, h], fill=(84, 64, 44))
        for _ in range(520):
            x, y = rnd.randint(0, w), rnd.randint(0, h)
            a = rnd.uniform(0, math.pi)
            ln = rnd.randint(30, 78)
            col = (rnd.randint(46, 96), rnd.randint(125, 190), rnd.randint(36, 70))
            d.ellipse([x - ln // 3, y - ln // 6, x + ln // 3, y + ln // 6], fill=col)
            d.line([(x - ln // 2 * math.cos(a), y - ln // 2 * math.sin(a)), (x + ln // 2 * math.cos(a), y + ln // 2 * math.sin(a))], fill=(30, 85, 36), width=2)
        d = ImageDraw.Draw(img)
    elif kind == "sacks":
        d.rectangle([0, 0, w, h], fill=(176, 160, 138))
        d.rectangle([0, int(h * 0.72), w, h], fill=(120, 104, 84))
        for i in range(6):
            x = 60 + (i % 3) * 300 + (i // 3) * 40
            y = 230 + (i // 3) * 190
            d.rounded_rectangle([x, y, x + 250, y + 200], 28, fill=(222, 204, 160), outline=(150, 128, 84), width=4)
            d.rectangle([x + 20, y + 20, x + 230, y + 40], fill=(31, 94, 59))
            d.text((x + 60, y + 90), "ORIGO", fill=(31, 94, 59))
    elif kind == "quill":
        d.rectangle([0, 0, w, h], fill=(206, 190, 160))
        for i in range(34):
            y = 40 + i * 20
            d.rounded_rectangle([40 + rnd.randint(0, 20), y, w - 40 - rnd.randint(0, 40), y + 14], 7, fill=(150 + rnd.randint(0, 18), 100 + rnd.randint(0, 16), 54), outline=(112, 74, 38))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82)
    return buf.getvalue()


# ── field helpers ────────────────────────────────────────────────────────────

def square(lat: float, lon: float, ha: float, jitter=0.15):
    side = math.sqrt(ha * 10_000)  # metres
    dlat = side / 111_320 / 2
    dlon = side / (111_320 * math.cos(math.radians(lat))) / 2
    j = lambda: 1 + random.uniform(-jitter, jitter)
    return [
        {"lat": lat - dlat * j(), "lon": lon - dlon * j()},
        {"lat": lat - dlat * j(), "lon": lon + dlon * j()},
        {"lat": lat + dlat * j(), "lon": lon + dlon * j()},
        {"lat": lat + dlat * j(), "lon": lon - dlon * j()},
    ]


def upload(field: Api, plot_id: str, event_type: str, img: bytes, when: datetime, lat: float, lon: float, batch_id=None, crop=None, caption=None) -> str:
    data = {"plot_id": plot_id, "event_type": event_type, "event_id": str(uuid.uuid4()), "occurred_at": iso(when),
            "lat": str(lat + random.uniform(-0.00004, 0.00004)), "lon": str(lon + random.uniform(-0.00004, 0.00004))}
    if batch_id: data["batch_id"] = batch_id
    if crop: data["crop"] = crop
    if caption: data["caption"] = caption
    r = field.http.post(FIELD + "/api/v1/photos", headers=field._h(), data=data, files={"file": ("p.jpg", img, "image/jpeg")})
    if r.status_code >= 400:
        raise RuntimeError(f"photo upload -> {r.status_code} {r.text[:200]}")
    return r.json()["payload"]["photo_url"]


def event(field: Api, etype: str, when: datetime, payload: dict, plot_id=None, batch_id=None):
    field.post("/api/v1/events", {"id": str(uuid.uuid4()), "event_type": etype, "plot_id": plot_id, "batch_id": batch_id, "payload": payload, "occurred_at": iso(when)})


# ── exporters ────────────────────────────────────────────────────────────────

def stage(pos, name, timing, start, instr, *, every=None, until=None, dos=(), donts=(), allowed=(), banned=(), photos=0, descs=(), quick=()):
    return {
        "position": pos, "name": name, "timing_type": timing, "start_offset_days": start,
        "repeat_interval_days": every, "end_offset_days": until,
        "instructions": {"en": instr, "si": "", "ta": ""},
        "dos": {"en": list(dos), "si": [], "ta": []}, "donts": {"en": list(donts), "si": [], "ta": []},
        "allowed_inputs": list(allowed),
        "banned_inputs": [{"name": n, "min_days_before_harvest": d} for n, d in banned],
        "required_proof": {"photo_count": photos, "photo_descriptions": list(descs), "quick_fields": list(quick)},
    }


TEA_STAGES = [
    stage(1, "Land preparation and shade", "one_time", 0,
          "Clear the plot, prepare contour drains and confirm there is shade-tree cover before the first planting.",
          dos=["Test soil pH before planting", "Keep shade trees at about 25% canopy"], donts=["Do not burn crop residue on site"],
          photos=1, descs=["Prepared rows showing drains and shade trees"], quick=["soil_ph"]),
    stage(2, "Planting and mulching", "one_time", 14,
          "Plant certified clonal cuttings and mulch each plant to hold moisture through the dry spell.",
          dos=["Use VP clonal cuttings from a registered nursery", "Mulch 5 cm deep"], allowed=["Compost", "Dolomite"],
          photos=2, descs=["Newly planted row", "Mulch around a plant"], quick=["plants_planted"]),
    stage(3, "Fertiliser round", "recurring", 45,
          "Apply the recommended fertiliser mix in split doses and record what was used.",
          every=45, until=180, dos=["Apply when the soil is moist", "Keep the fertiliser bag labels"], allowed=["Tea mixture T200", "Compost", "Urea"],
          photos=1, descs=["Fertiliser bag and the applied row"], quick=["fertiliser_type", "quantity_kg"]),
    stage(4, "Pest and weed control", "recurring", 30,
          "Control weeds by hand or slashing, and use only approved products for pests.",
          every=30, until=180, dos=["Slash or hand-weed between rows"], donts=["No glyphosate within 60 days of plucking"],
          allowed=["Neem oil", "Approved miticide"], banned=[("Carbofuran", 90), ("Glyphosate", 60)],
          photos=1, descs=["Clean inter-row after weeding"], quick=["method_used"]),
    stage(5, "Plucking standard", "recurring", 90,
          "Pluck two leaves and a bud on a regular round. Quality of the leaf sets the quality of the cup.",
          every=14, until=180, dos=["Pluck two leaves and a bud", "Keep leaf in open baskets"], donts=["No coarse leaf", "No pressing leaf in sacks"],
          photos=2, descs=["Plucked shoots held in the hand", "Leaf in the plucking basket"], quick=["leaf_kg_plucked"]),
    stage(6, "Delivery preparation", "one_time", 170,
          "Weigh, bag in clean hessian and label the lot with its Origo batch code before collection.",
          dos=["Use clean hessian sacks", "Attach the Origo QR label"], photos=2, descs=["Sacks ready for collection", "Weighing scale reading"], quick=["total_kg"]),
]

CINNAMON_STAGES = [
    stage(1, "Stem selection", "one_time", 0,
          "Select healthy, 2-3 year old stems with the right thickness for peeling.",
          dos=["Cut stems at least 1 cm thick", "Pick stems with smooth bark"], photos=1, descs=["Selected stems laid out"], quick=["stems_selected"]),
    stage(2, "Fertiliser round", "recurring", 60,
          "Apply organic fertiliser at the start of the rains.", every=60, until=180, allowed=["Compost", "Cow dung", "Dolomite"],
          banned=[("Urea", 60)], photos=1, descs=["Compost around the bushes"], quick=["fertiliser_type"]),
    stage(3, "Cutting", "one_time", 150, "Cut mature stems in the early morning during the rains.", photos=1, descs=["Cut stems bundled for peeling"], quick=["stems_cut"]),
    stage(4, "Peeling and rubbing", "one_time", 154,
          "Scrape the outer bark and peel the inner bark in long strips the same day.", dos=["Peel within 24 hours of cutting"],
          photos=2, descs=["Peeling in progress", "Peeled strips"], quick=["peelers"]),
    stage(5, "Drying", "one_time", 158, "Dry the quills in shade, never in direct sun, until they are brittle.",
          donts=["Do not dry in direct sunlight"], photos=1, descs=["Quills drying in shade"], quick=["drying_days"]),
    stage(6, "Quill grading and moisture", "one_time", 164,
          "Grade quills by length and thickness and check moisture before packing.", photos=2, descs=["Graded quills", "Moisture meter reading"], quick=["grade", "moisture_pct"]),
]

EXPORTERS = [
    {
        "key": "lakpura", "email": "procurement@lakpuratea.lk", "name": "Dilhan Wickramasinghe",
        "signup": {"phone": "0112456780", "business_name": "Lakpura Tea Exporters (Pvt) Ltd", "business_reg_no": "PV 104587",
                   "business_address": "No. 88, Chatham Street, Colombo 01", "export_license_no": "EDB/TEA/2019/0457"},
        "profile": {"description": "Colombo-based exporter of high-grown Ceylon black tea. We buy green leaf and made tea directly from Uva, Nuwara Eliya and Kandy smallholders and pay within a week of delivery.",
                    "districts_served": ["Nuwara Eliya", "Badulla", "Kandy"], "crops_bought": ["tea"], "certifications": ["Rainforest Alliance", "Organic"],
                    "contact_person": "Dilhan Wickramasinghe", "phone": "0112456780", "email": "procurement@lakpuratea.lk", "business_reg_no": "PV 104587"},
        "crop": "tea", "std_name": "Lakpura Assured High-Grown Tea 2026", "stages": TEA_STAGES, "status": "verified",
    },
    {
        "key": "cinnamon", "email": "sourcing@cinnamonhouse.lk", "name": "Thilini Abeysekera",
        "signup": {"phone": "0912234561", "business_name": "Cinnamon House Lanka (Pvt) Ltd", "business_reg_no": "PV 98213",
                   "business_address": "42, Matara Road, Galle", "export_license_no": "EDB/SPC/2017/0188"},
        "profile": {"description": "Family-run cinnamon processor and exporter in Galle. We specialise in Alba and C5 quills, bought from southern growers who peel and dry to our standard.",
                    "districts_served": ["Galle", "Matara", "Kalutara"], "crops_bought": ["cinnamon"], "certifications": ["Fairtrade", "Organic"],
                    "contact_person": "Thilini Abeysekera", "phone": "0912234561", "email": "sourcing@cinnamonhouse.lk", "business_reg_no": "PV 98213"},
        "crop": "cinnamon", "std_name": "Cinnamon House Alba and C5 Quill Standard", "stages": CINNAMON_STAGES, "status": "verified",
    },
    {
        "key": "mahaweli", "email": "info@mahaweliSpices.lk".lower(), "name": "Ranjith Samarakoon",
        "signup": {"phone": "0812203344", "business_name": "Mahaweli Spice Traders (Pvt) Ltd", "business_reg_no": "PV 117640",
                   "business_address": "17, Peradeniya Road, Kandy", "export_license_no": "EDB/SPC/2024/0702"},
        "profile": {"description": "New spice trader in Kandy awaiting verification.", "districts_served": ["Kandy", "Matale"], "crops_bought": ["cinnamon", "tea"],
                    "certifications": [], "contact_person": "Ranjith Samarakoon", "phone": "0812203344", "email": "info@mahawelispices.lk", "business_reg_no": "PV 117640"},
        "crop": None, "status": "pending",
    },
]

# farmer: (key, name, email, phone, nic, district, dsd, gn, address, farm_ha, exporter, crop, lat, lon, plot_ha, plant_days, plan)
FARMERS = [
    ("nimal", "Nimal Rathnayake", "nimal.rathnayake@gmail.com", "0771234501", "197845612345", "Nuwara Eliya", "Kotmale", "Kandapola North", "Jayasiri, Kandapola", 1.2, "lakpura", "Tea", 6.9486, 80.7358, 0.9, 176, "harvested"),
    ("chandani", "Chandani Wijesinghe", "chandani.w@gmail.com", "0772345602", "198256781234", "Nuwara Eliya", "Walapane", "Ragala", "Ragala Estate Rd, Walapane", 0.8, "lakpura", "Tea", 7.0205, 80.7512, 0.6, 148, "harvested_issue"),
    ("rajendran", "Rajendran Selvam", "rajendran.selvam@gmail.com", "0713456703", "197167895432", "Badulla", "Haputale", "Haputale Town", "Adisham Rd, Haputale", 1.5, "lakpura", "Tea", 6.7686, 80.9584, 1.1, 124, "harvested"),
    ("kumari", "Kumari Dissanayake", "kumari.dissanayake@gmail.com", "0754567804", "198567893214", "Kandy", "Pussellawa", "Ambagamuwa", "Rambukpitiya, Pussellawa", 0.7, "lakpura", "Tea", 7.0661, 80.6598, 0.5, 84, "growing"),
    ("anura", "Anura Bandara", "anura.bandara@gmail.com", "0765678905", "198834567890", "Badulla", "Bandarawela", "Poonagala", "Poonagala, Bandarawela", 0.6, "lakpura", "Tea", 6.8352, 80.9969, 0.45, 46, "early"),
    ("sivakumar", "Sivakumar Thevar", "sivakumar.thevar@gmail.com", "0746789006", "197956789012", "Nuwara Eliya", "Hanguranketha", "Hanguranketha", "Walapane Rd", 0.9, "lakpura", "Tea", 7.0928, 80.8097, 0.7, 20, "requested"),
    ("wasantha", "Wasantha Kodikara", "wasantha.kodikara@gmail.com", "0778901201", "197623456789", "Galle", "Elpitiya", "Pitigala", "Pitigala, Elpitiya", 1.0, "cinnamon", "Cinnamon", 6.2929, 80.1627, 0.8, 190, "harvested"),
    ("sumith", "Sumith Gunawardena", "sumith.gunawardena@gmail.com", "0719012302", "198012345098", "Matara", "Akuressa", "Kamburupitiya", "Kamburupitiya, Matara", 1.3, "cinnamon", "Cinnamon", 6.0996, 80.4711, 1.0, 168, "harvested_partial"),
    ("lalitha", "Lalitha Jayakody", "lalitha.jayakody@gmail.com", "0750123403", "198689012345", "Galle", "Baddegama", "Gonapinuwala", "Gonapinuwala, Baddegama", 0.5, "cinnamon", "Cinnamon", 6.1733, 80.1810, 0.4, 96, "growing"),
    ("prasanna", "Prasanna Herath", "prasanna.herath@gmail.com", "0762345604", "199023456781", "Kalutara", "Agalawatta", "Agalawatta", "Agalawatta Town", 0.7, "cinnamon", "Cinnamon", 6.5410, 80.1704, 0.5, 30, "requested"),
]

COLLECTORS = [
    ("sunil", "Sunil Fernando", "sunil.fernando.collect@gmail.com", "0777654301", "198134567890", "Nuwara Eliya", "Nuwara Eliya", "Kandapola"),
    ("roshan", "Roshan de Silva", "roshan.desilva.collect@gmail.com", "0717654302", "198345678901", "Galle", "Elpitiya", "Pitigala"),
]


def main():
    out: dict[str, dict] = {"exporters": {}, "farmers": {}, "collectors": {}}
    sup_url, sup_key = None, None
    for line in Path(__file__).resolve().parents[1].joinpath("web/backend/.env").read_text().splitlines():
        if line.startswith("SUPABASE_URL="): sup_url = line.split("=", 1)[1].strip()
        if line.startswith("SUPABASE_SERVICE_KEY="): sup_key = line.split("=", 1)[1].strip()
    rest = lambda: {"apikey": sup_key, "Authorization": f"Bearer {sup_key}", "Content-Type": "application/json", "Prefer": "return=representation"}

    # 1 ── exporters: account, profile, verification, standard
    ex: dict[str, dict] = {}
    for e in EXPORTERS:
        acc, _ = account_user(e["email"], "exporter", {"name": e["name"], **e["signup"]})
        me = acc.get("/api/exporter/me")
        prof = acc.put("/api/exporter/me", {"company_name": e["signup"]["business_name"], **e["profile"], "export_licence_no": e["signup"]["export_license_no"]})
        pid = prof["id"]
        if e["status"] == "verified" and prof["status"] != "verified":
            httpx.patch(f"{sup_url}/rest/v1/exporter_profiles?id=eq.{pid}", headers=rest(), json={"status": "verified", "rejection_reason": None}, timeout=30).raise_for_status()
            httpx.post(f"{sup_url}/rest/v1/exporter_verification_log", headers=rest(), json={"exporter_profile_id": pid, "action": "approved", "previous_status": "pending", "new_status": "verified"}, timeout=30)
        ex[e["key"]] = {"acc": acc, "pid": pid, "cfg": e}
        print(f"exporter {e['signup']['business_name']} ({e['status']})")

        if e["crop"]:
            stds = acc.get("/api/exporter/standards", params={"crop": e["crop"], "page_size": 50})["items"]
            mine = [s for s in stds if any(v["name"] == e["std_name"] for v in s["versions"])]
            if mine:
                s = mine[0]
                v = next(v for v in s["versions"] if v["name"] == e["std_name"])
            else:
                s = acc.post("/api/exporter/standards", {"crop": e["crop"], "name": e["std_name"], "grade_spec": {}, "stages": []})
                v = s["versions"][0]
                grade = ({"plucking_standard": "Two leaves and a bud", "leaf_quality_notes": "Fresh, undamaged leaf; no coarse leaf", "moisture_max_pct": "75"}
                         if e["crop"] == "tea" else {"stem_maturity": "Minimum 2-year-old stems", "quill_grade": "Alba or C5 or better", "moisture_max_pct": "13"})
                acc.put(f"/api/exporter/standards/{s['id']}/versions/{v['version_number']}", {"name": e["std_name"], "grade_spec": grade, "stages": e["stages"]})
                acc.post(f"/api/exporter/standards/{s['id']}/versions/{v['version_number']}/publish")
            vd = acc.get(f"/api/exporter/standards/{s['id']}/versions/{v['version_number']}")
            ex[e["key"]]["std_version_id"] = vd["id"]
            ex[e["key"]]["stages"] = {st["position"]: st for st in vd["stages"]}

    # 2 ── buy requests and planting notices
    def mk_ad(k, title, desc, qty, price, grade, window, expires, districts, pickup, terms, publish=True):
        acc, sv = ex[k]["acc"], ex[k]["std_version_id"]
        have = acc.get("/api/exporter/ads", params={"page_size": 100})["items"]
        if any((a["latest_title"] or a["title"]).get("en") == title for a in have):
            return next(a["id"] for a in have if (a["latest_title"] or a["title"]).get("en") == title)
        body = {"crop": ex[k]["cfg"]["crop"], "standard_version_id": sv, "title": {"en": title, "si": "", "ta": ""}, "description": {"en": desc, "si": "", "ta": ""},
                "grade_tier": grade, "quantity_kg": qty, **price, "collection_window_start": iso(NOW + timedelta(days=window[0])),
                "collection_window_end": iso(NOW + timedelta(days=window[1])), "pickup_location": pickup, "eligible_districts": districts,
                "terms": terms, "expires_at": iso(NOW + timedelta(days=expires))}
        ad = acc.post("/api/exporter/ads", body)
        if publish:
            acc.post(f"/api/exporter/ads/{ad['id']}/versions/1/publish")
        return ad["id"]

    ads = {}
    ads["leaf"] = mk_ad("lakpura", "Fresh green leaf, Nuwara Eliya and Uva", "Weekly green-leaf collection from smallholders following the Lakpura Assured standard. Two leaves and a bud, delivered the same day to our collection centre.",
                        8000, {"price_type": "fixed", "price_fixed": 138.0}, "Green leaf", (3, 40), 25, ["Nuwara Eliya", "Badulla", "Kandy"], "Lakpura collection centre, Nanu Oya",
                        {"payment_timing": "Bank transfer within 7 days of delivery", "rejection_handling": "Rejected leaf is returned at our cost with a written reason", "other": "Collector weighs and condition-checks on arrival"})
    ads["bopf"] = mk_ad("lakpura", "BOPF made tea, high-grown", "Made tea (BOPF) from registered factories supplied by our farmers. Prices depend on the Colombo auction mean.",
                        2500, {"price_type": "range", "price_min": 1150.0, "price_max": 1320.0}, "BOPF", (10, 60), 40, ["Nuwara Eliya", "Badulla"], "Hatton factory gate",
                        {"payment_timing": "Within 14 days of delivery", "rejection_handling": "Re-grading at a joint inspection", "other": ""})
    ads["draft_tea"] = mk_ad("lakpura", "Organic leaf, pilot for January", "Pilot buy request for organic-certified leaf. Draft until organic audit dates are fixed.",
                             3000, {"price_type": "fixed", "price_fixed": 165.0}, "Organic green leaf", (60, 90), 50, ["Kandy"], "TBC",
                             {"payment_timing": "Within 7 days", "rejection_handling": "", "other": ""}, publish=False)
    ads["quill"] = mk_ad("cinnamon", "C5 and Alba quills, southern growers", "Peeled and dried quills from southern growers following the Cinnamon House standard. We pay a premium for Alba.",
                         1500, {"price_type": "range", "price_min": 3100.0, "price_max": 3800.0}, "Alba / C5", (5, 45), 30, ["Galle", "Matara", "Kalutara"], "Cinnamon House, Galle",
                         {"payment_timing": "Cash on collection or bank transfer within 3 days", "rejection_handling": "Rejected lots returned with grading notes", "other": "Moisture must be 13% or less"})
    ads["chips"] = mk_ad("cinnamon", "Cinnamon featherings and chips", "Featherings and chips for oil and powder. Lower grade welcome.",
                         900, {"price_type": "fixed", "price_fixed": 780.0}, "Featherings", (5, 45), 28, [], "Cinnamon House, Galle",
                         {"payment_timing": "On collection", "rejection_handling": "", "other": ""})
    print("ads", ads)

    for k, month, vol, title, msg in [
        ("lakpura", "2026-12", 12000, "New flush planting, December", "We will need an extra 12,000 kg of green leaf from the new flush in December. Tell us which plot you can commit and how much leaf you expect."),
        ("cinnamon", "2027-01", 800, "January cutting season", "Peak cutting season starts in January. Please confirm the plot and expected quill weight so we can schedule collection."),
    ]:
        acc = ex[k]["acc"]
        have = acc.get("/api/exporter/planting-notices", params={"page_size": 50})["items"]
        if not any((n["title"] or {}).get("en") == title for n in have):
            n = acc.post("/api/exporter/planting-notices", {"crop": ex[k]["cfg"]["crop"], "standard_version_id": ex[k]["std_version_id"], "target_month": month, "volume_needed_kg": vol,
                                                            "eligible_districts": ex[k]["cfg"]["profile"]["districts_served"], "title": {"en": title, "si": "", "ta": ""}, "message": {"en": msg, "si": "", "ta": ""}})
            acc.post(f"/api/exporter/planting-notices/{n['id']}/publish")

    # 3 ── farmers: account, link, plot, planting, photos
    protocols = {p["crop"]: p for p in httpx.get(f"{FIELD}/api/v1/protocols", timeout=30).json() if p["tier"] == "export_standard"}
    farm: dict[str, dict] = {}
    for (key, name, email, phone, nic, dist, dsd, gn, addr, ha, ek, crop, lat, lon, plot_ha, pdays, plan) in FARMERS:
        acc, fld = account_user(email, "farmer", {"name": name, "phone": phone, "nic": nic, "district": dist, "dsd": dsd, "gn_division": gn, "farm_address": addr, "farm_size_ha": ha})
        farm[key] = {"acc": acc, "fld": fld, "plan": plan, "ek": ek, "crop": crop, "lat": lat, "lon": lon, "pdays": pdays, "name": name, "dist": dist}
        link = acc.get("/api/farmer/exporter-link/current")
        if not link["has_active_link"]:
            exp_pid = ex[ek]["pid"]
            acc.post("/api/farmer/exporter-link/request", {"exporter_profile_id": exp_pid})
        print("farmer", name, plan)

    # exporters decide on link requests
    for k in ("lakpura", "cinnamon"):
        acc = ex[k]["acc"]
        reqs = acc.get("/api/exporter/farmers", params={"status": "requested", "page_size": 100})["items"]
        for l in reqs:
            fkey = next((fk for fk, f in farm.items() if f["name"] == l["farmer"]["name"]), None)
            if fkey and farm[fkey]["plan"] != "requested":
                acc.post(f"/api/exporter/farmers/{l['id']}/approve")

    # plots, plantings, progress photos, proof, harvests
    for key, f in farm.items():
        fld, acc, crop = f["fld"], f["acc"], f["crop"]
        plan = f["plan"]
        if plan == "requested":
            continue
        plots = fld.get("/api/v1/plots/me")
        if plots:
            plot = plots[0]
        else:
            row = next(r for r in FARMERS if r[0] == key)
            plot = fld.post("/api/v1/plots", {"name": "Home plot" if key != "nimal" else "Upper terrace", "boundary_source": "walked", "boundary_points": square(f["lat"], f["lon"], row[14]),
                                              "plot_type": "open_field", "district": row[5], "dsd": row[6], "gn_division": row[7]})
            upload(fld, plot["id"], "plot_photo", photo("plot", hash(key) % 1000, 0.6), ago(f["pdays"] + 5), f["lat"], f["lon"], caption="Plot after registration")
        pid = plot["id"]
        f["plot_id"] = pid
        if not plot.get("plantings"):
            proto = protocols[crop]
            planted = ago(f["pdays"])
            event(fld, "planted", planted, {"crop": crop, "area_ha": round(float(plot["area_ha"] or 0.5) * 0.95, 3), "lat": f["lat"], "lon": f["lon"], "accuracy_m": 8.0,
                                            "protocol_id": proto["id"], "protocol_name": proto["name"],
                                            "confirmed_stages": ["Planting", "Pesticide use (standing restriction)" if crop == "Tea" else "Inputs (standing restriction)", "Plucking and handling" if crop == "Tea" else "Harvesting and peeling"]}, plot_id=pid)
            upload(fld, pid, "planting_photo", photo("planting", hash(key) % 997), planted + timedelta(hours=2), f["lat"], f["lon"], crop=crop, caption=f"{crop} planted")
            n = int(f["pdays"] // 30)
            for i in range(1, n + 1):
                when = planted + timedelta(days=30 * i, hours=1)
                if when < NOW:
                    upload(fld, pid, "progress_photo", photo("progress", hash(key) % 991 + i, min(1, i / 6 + 0.15)), when, f["lat"], f["lon"], caption=f"Progress check {i}")

    # 4 ── stage proof (farmers submit, exporter reviews)
    for key, f in farm.items():
        if f["plan"] == "requested":
            continue
        acc, fld = f["acc"], f["fld"]
        std = acc.get("/api/farmer/stage-proofs/standards")
        if not std["has_approved_exporter"] or not std["standards"]:
            continue
        stages = std["standards"][0]["stages"]
        days = f["pdays"]
        for st in sorted(stages, key=lambda s: s["position"]):
            if st["submission_status"] in ("pending", "approved", "rejected"):
                continue
            if st["start_offset_days"] > days:
                continue
            need = max(1, st["required_proof"]["photo_count"])
            urls = [upload(fld, f["plot_id"], "progress_photo", photo("leaf" if "pluck" in st["name"].lower() else "progress", hash(st["name"]) % 900 + i, 0.7),
                           ago(max(0, days - st["start_offset_days"] - 1)), f["lat"], f["lon"], caption=st["name"]) for i in range(need)]
            answers = {q: {"soil_ph": "5.4", "plants_planted": "1800", "fertiliser_type": "Tea mixture T200", "quantity_kg": "120", "method_used": "Hand weeding",
                           "leaf_kg_plucked": "85", "total_kg": "310", "stems_selected": "420", "stems_cut": "380", "peelers": "3", "drying_days": "4",
                           "grade": "C5", "moisture_pct": "12.4"}.get(q, "done") for q in st["required_proof"]["quick_fields"]}
            try:
                acc.post(f"/api/farmer/stage-proofs/{st['stage_id']}/submit", {"photo_urls": urls, "quick_field_answers": answers, "note": None, "plot_id": f["plot_id"]})
            except RuntimeError as err:
                print("  proof skipped:", str(err)[:90])

    for k in ("lakpura", "cinnamon"):
        acc = ex[k]["acc"]
        pend = acc.get("/api/exporter/stage-proofs", params={"status": "pending", "page_size": 100})["items"]
        by_farmer: dict[str, list] = {}
        for s in pend:
            by_farmer.setdefault(s["farmer_name"], []).append(s)
        for fname, subs in by_farmer.items():
            plan = next((f["plan"] for f in farm.values() if f["name"] == fname), "growing")
            subs.sort(key=lambda s: s["submitted_at"])
            for i, s in enumerate(subs):
                last = i == len(subs) - 1
                if plan == "harvested_issue" and s["stage_name"].startswith("Pest"):
                    acc.post(f"/api/exporter/stage-proofs/{s['id']}/reject", {"notes": "The photo is too dark to see the inter-row. Please retake it in daylight and show the whole row."})
                elif last and plan in ("harvested", "harvested_partial", "growing") and i > 0:
                    continue  # leave the newest one waiting for review
                else:
                    acc.post(f"/api/exporter/stage-proofs/{s['id']}/approve", {"notes": "Looks good, thank you." if i % 3 == 0 else None})

    # 5 ── buy-request applications and approvals
    apps = [("nimal", "leaf", 1800), ("chandani", "leaf", 1200), ("rajendran", "leaf", 1500), ("kumari", "leaf", 600), ("anura", "leaf", 300),
            ("wasantha", "quill", 260), ("sumith", "quill", 320), ("lalitha", "quill", 140), ("rajendran", "bopf", 400)]
    for fk, ak, kg in apps:
        f = farm[fk]
        ad = ex["lakpura" if ak in ("leaf", "bopf") else "cinnamon"]["acc"].get(f"/api/exporter/ads/{ads[ak]}")
        detail = f["acc"].get(f"/api/farmer/ads/{ads[ak]}", ok_missing=True)
        if not detail:
            continue
        try:
            f["acc"].post(f"/api/farmer/ads/{ads[ak]}/accept", {"ad_version_id": detail["ad_version_id"], "supply_quantity_kg": kg})
        except RuntimeError as err:
            print("  apply skipped:", fk, str(err)[:80])
    for k, ak_list in (("lakpura", ["leaf", "bopf"]), ("cinnamon", ["quill"])):
        acc = ex[k]["acc"]
        for ak in ak_list:
            res = acc.get(f"/api/exporter/ads/{ads[ak]}/applicants", params={"status": "pending", "page_size": 50})
            for i, ap in enumerate(res["items"]):
                try:
                    if ap["farmer_name"] in ("Anura Bandara",):
                        acc.post(f"/api/exporter/ads/{ads[ak]}/applicants/{ap['acceptance_id']}/decline", {"reason": "Volume already covered for this window"})
                    elif ap["farmer_name"] not in ("Kumari Dissanayake",):
                        acc.post(f"/api/exporter/ads/{ads[ak]}/applicants/{ap['acceptance_id']}/approve")
                except RuntimeError as err:
                    print("  decision skipped:", str(err)[:90])

    # 6 ── harvest: batches, stage events, collectors, combined batches
    cols = {}
    for (key, name, email, phone, nic, dist, dsd, gn) in COLLECTORS:
        acc, fld = account_user(email, "collector", {"name": name, "phone": phone, "nic": nic, "district": dist, "dsd": dsd, "gn_division": gn})
        cols[key] = {"fld": fld, "name": name}
    batches: dict[str, list] = {}
    for key, f in farm.items():
        plan = f["plan"]
        if not plan.startswith("harvested"):
            continue
        fld, pid = f["fld"], f["plot_id"]
        existing = [b for b in fld.get("/api/v1/batches/me") if b["plot_id"] == pid]
        if existing:
            for b in existing:
                evs = fld.get("/api/v1/events", params={"batch_id": b["id"]})
                b["_kg"] = next((e["payload"]["weight_kg"] for e in evs if e["event_type"] == "weigh"), None) or 0
            batches[key] = existing[::-1]  # oldest first, as created
            continue
        crop, proto = f["crop"], protocols[f["crop"]]
        n_batches = 2 if key in ("nimal", "wasantha") else 1
        kgs = {"nimal": [212.5, 186.0], "chandani": [148.0], "rajendran": [264.0], "wasantha": [64.5, 52.0], "sumith": [78.0]}[key]
        grade = "BOPF" if crop == "Tea" else ("Alba" if key == "wasantha" else "C5")
        batches[key] = []
        for bi in range(n_batches):
            harvest_day = max(2, 6 - bi * 4)
            when = ago(harvest_day)
            b = fld.post("/api/v1/batches", {"plot_id": pid, "crop": crop, "protocol_id": proto["id"]})
            upload(fld, pid, "batch_photo", photo("leaf" if crop == "Tea" else "quill", hash(b["code"]) % 1000), when + timedelta(minutes=5), f["lat"], f["lon"], batch_id=b["id"], caption=f"{crop} harvest")
            event(fld, "collect", when + timedelta(minutes=10), {}, plot_id=pid, batch_id=b["id"])
            event(fld, "weigh", when + timedelta(hours=1), {"weight_kg": kgs[bi]}, plot_id=pid, batch_id=b["id"])
            if plan != "harvested_partial" or crop == "Tea":
                event(fld, "process", when + timedelta(hours=26), {"method": "withering and rolling" if crop == "Tea" else "peeled and shade-dried"}, plot_id=pid, batch_id=b["id"])
            if plan in ("harvested",):
                event(fld, "grade", when + timedelta(hours=40), {"grade": grade}, plot_id=pid, batch_id=b["id"])
            if plan == "harvested" and bi == 0:
                event(fld, "pack", when + timedelta(hours=44), {"packages": 6 if crop == "Tea" else 4}, plot_id=pid, batch_id=b["id"])
            b["_kg"] = kgs[bi]
            batches[key].append(b)
        print("batches", key, [b["code"] for b in batches[key]])

    def collect_round(col: dict, keys: list, crop: str):
        c = col["fld"]
        if c.get("/api/v1/batches/me"):
            print("collector already has a combined batch, skipping")
            return
        parents, total = [], 0.0
        for k in keys:
            for b in batches.get(k, [])[:1]:
                if "_kg" not in b:
                    continue
                full = c.get(f"/api/v1/batches/by-code/{b['code']}")
                received = round(b["_kg"] * random.uniform(0.985, 0.998), 1)
                event(c, "weigh", ago(1.2), {"weight_kg": received}, batch_id=full["id"])
                event(c, "collector_attestation", ago(1.15), {"condition": "good" if k != "chandani" else "fair", "note": "Fresh, well handled" if k != "chandani" else "Slightly wilted, acceptable"}, batch_id=full["id"])
                parents.append(full["id"]); total += received
        if len(parents) >= 2:
            merged = c.post("/api/v1/batches/merge", {"parent_batch_ids": parents, "crop": crop})
            event(c, "weigh", ago(1.0), {"weight_kg": round(total, 1)}, batch_id=merged["id"])
            event(c, "pack", ago(0.9), {"packages": 12}, batch_id=merged["id"])
            print("merged", merged["code"], round(total, 1), "kg")

    try:
        collect_round(cols["sunil"], ["nimal", "chandani", "rajendran"], "Tea")
        collect_round(cols["roshan"], ["wasantha", "sumith"], "Cinnamon")
    except RuntimeError as err:
        print("collector round:", err)

    # 7 ── planting-notice replies
    for k in ("lakpura", "cinnamon"):
        mine = [f for f in farm.values() if f["ek"] == k and f["plan"] not in ("requested",)]
        for f in mine[:4]:
            try:
                notes = f["acc"].get("/api/farmer/planting-notices")["items"]
                if not notes:
                    continue
                nid = notes[0]["id"]
                if notes[0]["farmer_response"]:
                    continue
                plots = f["acc"].get(f"/api/farmer/planting-notices/{nid}/plots")
                if f["name"] == "Anura Bandara":
                    f["acc"].post(f"/api/farmer/planting-notices/{nid}/respond", {"response": "cannot"})
                elif plots:
                    f["acc"].post(f"/api/farmer/planting-notices/{nid}/respond", {"response": "ready", "expected_volume_kg": random.choice([1500, 2200, 3000, 900]), "plot_id": plots[0]["id"]})
            except RuntimeError as err:
                print("  notice reply skipped:", str(err)[:90])

    print("\nDone. Shared password for every demo account:", PASSWORD)
    for e in EXPORTERS: print("  exporter ", e["email"])
    for r in FARMERS: print("  farmer   ", r[2])
    for c in COLLECTORS: print("  collector", c[2])


if __name__ == "__main__":
    main()

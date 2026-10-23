"""Second demo seed: populates the existing exporter logins (exporter@gmail.com, exporter1@gmail.com) with
proper companies and their OWN farmers, standards, buy requests, notices, plots, photos, proof and harvests.

A farmer can follow only one exporter, so these exporters get new farmers rather than sharing the first seed's.
Passwords of the exporter logins are given on the command line:

    EXP_PASSWORDS="exporter@gmail.com=exporter,exporter1@gmail.com=exporter" python scripts/seed_demo2.py

Needs both backends running and `httpx` + `Pillow` (see scripts/seed_demo.py). Idempotent: re-running skips
what already exists. Reuses the helpers and standard templates from seed_demo.py.
"""
from __future__ import annotations

import os
import random
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import httpx  # noqa: E402
import seed_demo as sd  # noqa: E402

NOW, ago, iso, Api = sd.NOW, sd.ago, sd.iso, sd.Api
random.seed(11)

EXPORTERS = [
    {
        "email": "exporter@gmail.com", "key": "uva", "crop": "tea", "stages": sd.TEA_STAGES,
        "company": "Uva Highlands Tea Company (Pvt) Ltd", "reg": "PV 120331", "licence": "EDB/TEA/2020/0612",
        "contact": "Mahesh Gunaratne", "phone": "0112884410",
        "desc": "Exporter of Uva and Nuwara Eliya black tea since 2008. We work directly with smallholders in the hill country, provide a fixed weekly leaf price, and verify quality with photo proof at each growing stage.",
        "districts": ["Badulla", "Nuwara Eliya", "Kandy", "Ratnapura"], "certs": ["Rainforest Alliance", "Fairtrade"],
        "std": "Uva Highlands Assured Tea Standard 2026",
        "ads": [
            ("Premium green leaf, Uva region", "Daily green-leaf collection from Uva and Nuwara Eliya growers. Two leaves and a bud, delivered fresh to our Welimada collection centre.", 6000, {"price_type": "fixed", "price_fixed": 142.0}, "Green leaf", (2, 45), 30, ["Badulla", "Nuwara Eliya"], "Welimada collection centre", True),
            ("Orthodox OP made tea", "Orthodox-rolled OP1 made tea from our partner factories. Price follows the Colombo auction mean for the grade.", 1800, {"price_type": "range", "price_min": 1350.0, "price_max": 1520.0}, "OP1", (10, 70), 40, ["Badulla", "Nuwara Eliya"], "Bandarawela factory gate", True),
            ("Organic leaf pilot, Ratnapura", "Pilot buy request for organic-certified leaf from Ratnapura and Kandy growers, with a price premium for certified plots.", 2500, {"price_type": "fixed", "price_fixed": 168.0}, "Organic green leaf", (5, 50), 35, ["Ratnapura", "Kandy"], "Balangoda collection point", True),
            ("Winter flush booking", "Early booking for next season's winter flush. Draft until volumes are confirmed with the factories.", 4000, {"price_type": "fixed", "price_fixed": 150.0}, "Green leaf", (70, 110), 60, [], "TBC", False),
        ],
        "notices": [("Pre-monsoon replanting, January", "2027-01", 9000, "We will replant and expand supply for the January flush. Tell us which plot you will commit and the volume you expect, so we can plan factory capacity.", True),
                    ("March flush planning (draft)", "2027-03", 5000, "Early planning for the March flush. Volumes to be confirmed.", False)],
        "farmers": [
            ("dayananda", "Dayananda Ekanayake", "dayananda.ekanayake@gmail.com", "0772200101", "197334562118", "Badulla", "Passara", "Passara North", "Kandaketiya Rd, Passara", 1.4, "Tea", 6.9966, 81.1469, 1.1, 182, "harvested"),
            ("sarojini", "Sarojini Mahendran", "sarojini.mahendran@gmail.com", "0772200102", "198145670923", "Nuwara Eliya", "Nuwara Eliya", "Pedro", "Pedro Estate Rd, Nuwara Eliya", 0.9, "Tea", 6.9769, 80.7826, 0.7, 150, "harvested_issue"),
            ("upali", "Upali Senanayake", "upali.senanayake@gmail.com", "0772200103", "197612348871", "Badulla", "Welimada", "Boralanda", "Boralanda, Welimada", 1.2, "Tea", 6.9017, 80.9172, 0.9, 104, "growing"),
            ("nirmala", "Nirmala Ranasinghe", "nirmala.ranasinghe@gmail.com", "0772200104", "198567234109", "Ratnapura", "Balangoda", "Balangoda East", "Pallebedda Rd, Balangoda", 0.8, "Tea", 6.6485, 80.6992, 0.6, 96, "growing"),
            ("chaminda", "Chaminda Abeywickrama", "chaminda.abeywickrama@gmail.com", "0772200105", "198823450986", "Kandy", "Udapalatha", "Gampola South", "Gampola Rd, Udapalatha", 0.6, "Tea", 7.1606, 80.5700, 0.45, 42, "early"),
            ("tharindu", "Tharindu Mendis", "tharindu.mendis@gmail.com", "0772200106", "199145670321", "Badulla", "Ella", "Ella Town", "Ella-Wellawaya Rd", 0.7, "Tea", 6.8667, 81.0466, 0.5, 55, "pending"),
            ("kavitha", "Kavitha Selvarajah", "kavitha.selvarajah@gmail.com", "0772200107", "198934561273", "Nuwara Eliya", "Kotmale", "Kotmale West", "Kotmale Rd", 0.9, "Tea", 7.0100, 80.5900, 0.7, 20, "requested"),
        ],
        "collector": "sunil.fernando.collect@gmail.com",
    },
    {
        "email": "exporter1@gmail.com", "key": "south", "crop": "cinnamon", "stages": sd.CINNAMON_STAGES,
        "company": "Southern Cinnamon Growers Export (Pvt) Ltd", "reg": "PV 120845", "licence": "EDB/SPC/2021/0344",
        "contact": "Anoma Wijetunga", "phone": "0912247732",
        "desc": "Cinnamon exporter based in Galle, buying Alba, C4 and C5 quills from growers along the southern coast. We grade on delivery, pay promptly and support Organic and Fairtrade growers.",
        "districts": ["Galle", "Matara", "Kalutara", "Hambantota"], "certs": ["Organic", "Fairtrade"],
        "std": "Southern Cinnamon Quill Quality Standard 2026",
        "ads": [
            ("Alba grade quills", "Top-grade Alba quills, hand-rolled and shade-dried. We pay a clear premium over C5 for quills that pass our moisture and length check.", 900, {"price_type": "range", "price_min": 3600.0, "price_max": 4200.0}, "Alba", (4, 40), 25, ["Galle", "Matara"], "Galle collection yard", True),
            ("C5 and C4 quills", "Regular quill purchase for blending. Good-quality C5 and C4 lots are welcome in any quantity above 20 kg.", 1600, {"price_type": "range", "price_min": 3100.0, "price_max": 3500.0}, "C5 / C4", (4, 50), 30, ["Galle", "Matara", "Kalutara", "Hambantota"], "Matara collection yard", True),
            ("Quillings and featherings", "Quillings and featherings for oil and powder. Dry, clean material only.", 1100, {"price_type": "fixed", "price_fixed": 820.0}, "Featherings", (4, 55), 35, [], "Galle collection yard", True),
            ("Organic bark, oil grade (draft)", "Pilot for organic-certified bark. Draft until the organic audit is complete.", 600, {"price_type": "fixed", "price_fixed": 1100.0}, "Organic bark", (60, 100), 55, ["Galle"], "TBC", False),
        ],
        "notices": [("Cutting season, February", "2027-02", 650, "Cutting begins in February. Please confirm the plot and the weight of quills you expect so we can book collection.", True),
                    ("Replanting support (draft)", "2027-04", 300, "We are planning a replanting support programme. Details to follow.", False)],
        "farmers": [
            ("gamini", "Gamini Wijewardena", "gamini.wijewardena@gmail.com", "0712300101", "197245671830", "Galle", "Habaraduwa", "Habaraduwa North", "Dodanduwa Rd, Habaraduwa", 1.1, "Cinnamon", 6.0442, 80.2764, 0.9, 196, "harvested"),
            ("shanika", "Shanika Liyanage", "shanika.liyanage@gmail.com", "0712300102", "198534561072", "Matara", "Weligama", "Weligama East", "Kapparatota Rd, Weligama", 0.9, "Cinnamon", 5.9751, 80.4296, 0.7, 172, "harvested_partial"),
            ("ruwan", "Ruwan Pathirana", "ruwan.pathirana@gmail.com", "0712300103", "198012349865", "Kalutara", "Beruwala", "Beruwala South", "Aluthgama Rd, Beruwala", 0.8, "Cinnamon", 6.4788, 79.9828, 0.6, 108, "growing"),
            ("dinusha", "Dinusha Herath", "dinusha.herath@gmail.com", "0712300104", "199045671239", "Hambantota", "Tangalle", "Tangalle West", "Netolpitiya Rd, Tangalle", 0.7, "Cinnamon", 6.0240, 80.7970, 0.5, 98, "growing"),
            ("piyal", "Piyal Ratnayake", "piyal.ratnayake@gmail.com", "0712300105", "198256789012", "Galle", "Hikkaduwa", "Hikkaduwa North", "Thelwatta Rd, Hikkaduwa", 0.5, "Cinnamon", 6.1395, 80.1020, 0.4, 44, "early"),
            ("madhavi", "Madhavi Fonseka", "madhavi.fonseka@gmail.com", "0712300106", "199267894561", "Matara", "Dikwella", "Dikwella Town", "Beliatta Rd, Dikwella", 0.6, "Cinnamon", 5.9738, 80.6858, 0.45, 50, "pending"),
            ("asanka", "Asanka Perera", "asanka.perera@gmail.com", "0712300107", "199378901234", "Kalutara", "Horana", "Horana South", "Panadura Rd, Horana", 0.6, "Cinnamon", 6.7159, 80.0627, 0.5, 15, "requested"),
        ],
        "collector": "roshan.desilva.collect@gmail.com",
    },
]


def sup_creds():
    url = key = None
    for line in Path(sd.__file__).resolve().parents[1].joinpath("web/backend/.env").read_text().splitlines():
        if line.startswith("SUPABASE_URL="): url = line.split("=", 1)[1].strip()
        if line.startswith("SUPABASE_SERVICE_KEY="): key = line.split("=", 1)[1].strip()
    return url, key


def main():
    pws = dict(p.split("=", 1) for p in os.environ.get("EXP_PASSWORDS", "").split(",") if "=" in p)
    sup_url, sup_key = sup_creds()
    rest = {"apikey": sup_key, "Authorization": f"Bearer {sup_key}", "Content-Type": "application/json", "Prefer": "return=representation"}
    protocols = {p["crop"]: p for p in httpx.get(f"{sd.FIELD}/api/v1/protocols", timeout=30).json() if p["tier"] == "export_standard"}

    for cfg in EXPORTERS:
        email = cfg["email"]
        r = httpx.post(f"{sd.ACCOUNT}/auth/login", json={"email": email, "password": pws.get(email, "")}, timeout=30)
        if r.status_code != 200:
            print(f"SKIP {email}: could not sign in"); continue
        acc = Api(sd.ACCOUNT, r.json()["access_token"])
        print(f"\n== {cfg['company']} ({email})")

        # profile, verification
        prof = acc.get("/api/exporter/me")
        prof = acc.put("/api/exporter/me", {
            "company_name": cfg["company"], "business_reg_no": cfg["reg"], "export_licence_no": cfg["licence"], "contact_person": cfg["contact"],
            "phone": cfg["phone"], "email": email, "description": cfg["desc"], "districts_served": cfg["districts"], "crops_bought": [cfg["crop"]], "certifications": cfg["certs"]})
        pid = prof["id"]
        if prof["status"] != "verified":
            httpx.patch(f"{sup_url}/rest/v1/exporter_profiles?id=eq.{pid}", headers=rest, json={"status": "verified", "rejection_reason": None}, timeout=30).raise_for_status()
            httpx.post(f"{sup_url}/rest/v1/exporter_verification_log", headers=rest, json={"exporter_profile_id": pid, "action": "approved", "previous_status": "pending", "new_status": "verified"}, timeout=30)

        # standard (published v1 + a newer draft)
        stds = acc.get("/api/exporter/standards", params={"crop": cfg["crop"], "page_size": 50})["items"]
        mine = [s for s in stds if any(v["name"] == cfg["std"] for v in s["versions"])]
        if mine:
            s = mine[0]; v = next(v for v in s["versions"] if v["name"] == cfg["std"])
        else:
            s = acc.post("/api/exporter/standards", {"crop": cfg["crop"], "name": cfg["std"], "grade_spec": {}, "stages": []})
            v = s["versions"][0]
            grade = ({"plucking_standard": "Two leaves and a bud", "leaf_quality_notes": "Fresh, undamaged leaf; no coarse leaf", "moisture_max_pct": "75"}
                     if cfg["crop"] == "tea" else {"stem_maturity": "Minimum 2-year-old stems", "quill_grade": "Alba, C4 or C5", "moisture_max_pct": "13"})
            acc.put(f"/api/exporter/standards/{s['id']}/versions/{v['version_number']}", {"name": cfg["std"], "grade_spec": grade, "stages": cfg["stages"]})
            acc.post(f"/api/exporter/standards/{s['id']}/versions/{v['version_number']}/publish")
            try:
                acc.post(f"/api/exporter/standards/{s['id']}/versions")  # next-season draft
            except RuntimeError:
                pass
        vd = acc.get(f"/api/exporter/standards/{s['id']}/versions/{v['version_number']}")
        std_version_id = vd["id"]

        # buy requests
        have = {(a["latest_title"] or a["title"]).get("en"): a["id"] for a in acc.get("/api/exporter/ads", params={"page_size": 100})["items"]}
        ads = []
        for (title, desc, qty, price, grade, window, expires, districts, pickup, publish) in cfg["ads"]:
            if title in have:
                ads.append(have[title]); continue
            body = {"crop": cfg["crop"], "standard_version_id": std_version_id, "title": {"en": title, "si": "", "ta": ""}, "description": {"en": desc, "si": "", "ta": ""},
                    "grade_tier": grade, "quantity_kg": qty, **price, "collection_window_start": iso(NOW + timedelta(days=window[0])),
                    "collection_window_end": iso(NOW + timedelta(days=window[1])), "pickup_location": pickup, "eligible_districts": districts,
                    "terms": {"payment_timing": "Bank transfer within 7 days of delivery", "rejection_handling": "Rejected lots are returned with a written reason", "other": "Weighed and graded on delivery"},
                    "expires_at": iso(NOW + timedelta(days=expires))}
            ad = acc.post("/api/exporter/ads", body)
            if publish:
                acc.post(f"/api/exporter/ads/{ad['id']}/versions/1/publish")
            ads.append(ad["id"])
        live_ads = [ads[i] for i, a in enumerate(cfg["ads"]) if a[-1]]
        print("  ads:", len(ads))

        # notices
        have_n = {(n["title"] or {}).get("en") for n in acc.get("/api/exporter/planting-notices", params={"page_size": 50})["items"]}
        for (title, month, vol, msg, publish) in cfg["notices"]:
            if title in have_n: continue
            n = acc.post("/api/exporter/planting-notices", {"crop": cfg["crop"], "standard_version_id": std_version_id, "target_month": month, "volume_needed_kg": vol,
                                                            "eligible_districts": cfg["districts"], "title": {"en": title, "si": "", "ta": ""}, "message": {"en": msg, "si": "", "ta": ""}})
            if publish:
                acc.post(f"/api/exporter/planting-notices/{n['id']}/publish")

        # farmers
        farm = {}
        for (key, name, femail, phone, nic, dist, dsd, gn, addr, ha, crop, lat, lon, plot_ha, pdays, plan) in cfg["farmers"]:
            facc, ffld = sd.account_user(femail, "farmer", {"name": name, "phone": phone, "nic": nic, "district": dist, "dsd": dsd, "gn_division": gn, "farm_address": addr, "farm_size_ha": ha})
            f = {"acc": facc, "fld": ffld, "plan": plan, "crop": crop, "lat": lat, "lon": lon, "pdays": pdays, "name": name, "plot_ha": plot_ha, "dist": dist, "dsd": dsd, "gn": gn}
            farm[key] = f
            link = facc.get("/api/farmer/exporter-link/current")
            if not link["has_active_link"] and plan != "pending":
                facc.post("/api/farmer/exporter-link/request", {"exporter_profile_id": pid})
            if plan == "pending":
                # applying with no link creates a pending applicant AND a pending link request
                try:
                    d = facc.get(f"/api/farmer/ads/{live_ads[0]}", ok_missing=True)
                    if d:
                        facc.post(f"/api/farmer/ads/{live_ads[0]}/accept", {"ad_version_id": d["ad_version_id"], "supply_quantity_kg": 350})
                except RuntimeError as e:
                    print("   pending apply skipped:", str(e)[:80])
        for l in acc.get("/api/exporter/farmers", params={"status": "requested", "page_size": 100})["items"]:
            k = next((k for k, f in farm.items() if f["name"] == l["farmer"]["name"]), None)
            if k and farm[k]["plan"] not in ("requested", "pending"):
                acc.post(f"/api/exporter/farmers/{l['id']}/approve")

        # plots, plantings, photos
        for key, f in farm.items():
            if f["plan"] in ("requested", "pending"):
                continue
            fld, crop = f["fld"], f["crop"]
            plots = fld.get("/api/v1/plots/me")
            if plots:
                plot = plots[0]
            else:
                plot = fld.post("/api/v1/plots", {"name": "Home plot", "boundary_source": "walked", "boundary_points": sd.square(f["lat"], f["lon"], f["plot_ha"]), "plot_type": "open_field",
                                                  "district": f["dist"], "dsd": f["dsd"], "gn_division": f["gn"]})
                sd.upload(fld, plot["id"], "plot_photo", sd.photo("plot", hash(key) % 1000, 0.6), ago(f["pdays"] + 5), f["lat"], f["lon"], caption="Plot after registration")
            f["plot_id"] = plot["id"]
            if not plot.get("plantings"):
                proto = protocols[crop]
                planted = ago(f["pdays"])
                sd.event(fld, "planted", planted, {"crop": crop, "area_ha": round(float(plot["area_ha"] or 0.5) * 0.95, 3), "lat": f["lat"], "lon": f["lon"], "accuracy_m": 9.0,
                                                   "protocol_id": proto["id"], "protocol_name": proto["name"],
                                                   "confirmed_stages": ["Planting", "Inputs (standing restriction)" if crop == "Cinnamon" else "Pesticide use (standing restriction)", "Harvesting and peeling" if crop == "Cinnamon" else "Plucking and handling"]}, plot_id=plot["id"])
                sd.upload(fld, plot["id"], "planting_photo", sd.photo("planting", hash(key) % 997), planted + timedelta(hours=2), f["lat"], f["lon"], crop=crop, caption=f"{crop} planted")
                for i in range(1, int(f["pdays"] // 30) + 1):
                    when = planted + timedelta(days=30 * i, hours=1)
                    if when < NOW:
                        sd.upload(fld, plot["id"], "progress_photo", sd.photo("progress", hash(key) % 991 + i, min(1, i / 6 + 0.15)), when, f["lat"], f["lon"], caption=f"Progress check {i}")

        # stage proof
        for key, f in farm.items():
            if f["plan"] in ("requested", "pending"):
                continue
            std = f["acc"].get("/api/farmer/stage-proofs/standards")
            if not std["has_approved_exporter"] or not std["standards"]:
                continue
            for st in sorted(std["standards"][0]["stages"], key=lambda x: x["position"]):
                if st["submission_status"] in ("pending", "approved", "rejected") or st["start_offset_days"] > f["pdays"]:
                    continue
                need = max(1, st["required_proof"]["photo_count"])
                urls = [sd.upload(f["fld"], f["plot_id"], "progress_photo", sd.photo("quill" if "grad" in st["name"].lower() else "progress", hash(st["name"]) % 900 + i, 0.7),
                                  ago(max(0, f["pdays"] - st["start_offset_days"] - 1)), f["lat"], f["lon"], caption=st["name"]) for i in range(need)]
                ans = {q: {"soil_ph": "5.6", "plants_planted": "1500", "fertiliser_type": "Compost", "quantity_kg": "90", "method_used": "Hand weeding", "leaf_kg_plucked": "70",
                           "total_kg": "260", "stems_selected": "380", "stems_cut": "340", "peelers": "4", "drying_days": "4", "grade": "C5", "moisture_pct": "12.1"}.get(q, "done") for q in st["required_proof"]["quick_fields"]}
                try:
                    f["acc"].post(f"/api/farmer/stage-proofs/{st['stage_id']}/submit", {"photo_urls": urls, "quick_field_answers": ans, "note": None, "plot_id": f["plot_id"]})
                except RuntimeError as err:
                    print("   proof skipped:", str(err)[:80])
        pend = acc.get("/api/exporter/stage-proofs", params={"status": "pending", "page_size": 100})["items"]
        by = {}
        for sub in pend: by.setdefault(sub["farmer_name"], []).append(sub)
        reject_stage = "Pest" if cfg["crop"] == "tea" else "Drying"
        for fname, subs in by.items():
            plan = next((f["plan"] for f in farm.values() if f["name"] == fname), None)
            if plan is None: continue
            subs.sort(key=lambda x: x["submitted_at"])
            for i, sub in enumerate(subs):
                last = i == len(subs) - 1
                if plan == "harvested_issue" and sub["stage_name"].startswith(reject_stage):
                    acc.post(f"/api/exporter/stage-proofs/{sub['id']}/reject", {"notes": "The photo is too dark to judge the work. Please retake it in daylight and show the whole area."})
                elif last and plan in ("growing", "early") and len(subs) > 1:
                    continue  # leave the newest waiting for review
                else:
                    acc.post(f"/api/exporter/stage-proofs/{sub['id']}/approve", {"notes": "Looks good, thank you." if i % 3 == 0 else None})

        # applications to buy requests (approved farmers are auto-accepted)
        for key, f in farm.items():
            if f["plan"] in ("requested", "pending"):
                continue
            for ai, kg in ((0, random.choice([400, 650, 900])), (1, random.choice([150, 250, 300]))):
                if ai >= len(live_ads): break
                d = f["acc"].get(f"/api/farmer/ads/{live_ads[ai]}", ok_missing=True)
                if not d: continue
                try:
                    f["acc"].post(f"/api/farmer/ads/{live_ads[ai]}/accept", {"ad_version_id": d["ad_version_id"], "supply_quantity_kg": kg})
                except RuntimeError:
                    pass

        # harvest batches
        batches = {}
        for key, f in farm.items():
            if not f["plan"].startswith("harvested"): continue
            fld, pidp, crop = f["fld"], f["plot_id"], f["crop"]
            existing = [b for b in fld.get("/api/v1/batches/me") if b["plot_id"] == pidp]
            if existing:
                for b in existing:
                    evs = fld.get("/api/v1/events", params={"batch_id": b["id"]})
                    b["_kg"] = next((e["payload"]["weight_kg"] for e in evs if e["event_type"] == "weigh"), None) or 0
                batches[key] = existing[::-1]; continue
            proto = protocols[crop]
            nb = 2 if f["plan"] == "harvested" else 1
            grade = "OP1" if crop == "Tea" else ("Alba" if key == "gamini" else "C5")
            batches[key] = []
            for bi in range(nb):
                kg = round(random.uniform(120, 260) if crop == "Tea" else random.uniform(40, 95), 1)
                when = ago(max(2, 7 - bi * 4))
                b = fld.post("/api/v1/batches", {"plot_id": pidp, "crop": crop, "protocol_id": proto["id"]})
                sd.upload(fld, pidp, "batch_photo", sd.photo("leaf" if crop == "Tea" else "quill", hash(b["code"]) % 1000), when + timedelta(minutes=5), f["lat"], f["lon"], batch_id=b["id"], caption=f"{crop} harvest")
                sd.event(fld, "collect", when + timedelta(minutes=10), {}, plot_id=pidp, batch_id=b["id"])
                sd.event(fld, "weigh", when + timedelta(hours=1), {"weight_kg": kg}, plot_id=pidp, batch_id=b["id"])
                if f["plan"] != "harvested_partial" or crop == "Tea":
                    sd.event(fld, "process", when + timedelta(hours=26), {"method": "withering and rolling" if crop == "Tea" else "peeled and shade-dried"}, plot_id=pidp, batch_id=b["id"])
                if f["plan"] == "harvested":
                    sd.event(fld, "grade", when + timedelta(hours=40), {"grade": grade}, plot_id=pidp, batch_id=b["id"])
                    if bi == 0:
                        sd.event(fld, "pack", when + timedelta(hours=44), {"packages": 5 if crop == "Tea" else 4}, plot_id=pidp, batch_id=b["id"])
                b["_kg"] = kg
                batches[key].append(b)
            print("  batches", f["name"], [b["code"] for b in batches[key]])

        # a collector round combining the first two harvesters' batches
        col = sd.login(sd.FIELD, cfg["collector"]) if False else None
        cr = httpx.post(f"{sd.ACCOUNT}/auth/login", json={"email": cfg["collector"], "password": sd.PASSWORD}, timeout=30)
        if cr.status_code == 200:
            c = Api(sd.FIELD, cr.json()["access_token"])
            keys = [k for k in batches if batches[k] and "_kg" in batches[k][0]][:2]
            parents, total = [], 0.0
            for k in keys:
                b = batches[k][0]
                if not b["_kg"]: continue
                try:
                    full = c.get(f"/api/v1/batches/by-code/{b['code']}")
                    got = round(b["_kg"] * random.uniform(0.985, 0.998), 1)
                    sd.event(c, "weigh", ago(1.1), {"weight_kg": got}, batch_id=full["id"])
                    sd.event(c, "collector_attestation", ago(1.05), {"condition": "good", "note": "Well handled, dry and clean"}, batch_id=full["id"])
                    parents.append(full["id"]); total += got
                except RuntimeError as err:
                    print("   collector step skipped:", str(err)[:80])
            if len(parents) >= 2:
                m = c.post("/api/v1/batches/merge", {"parent_batch_ids": parents, "crop": cfg["crop"].title()})
                sd.event(c, "weigh", ago(0.9), {"weight_kg": round(total, 1)}, batch_id=m["id"])
                sd.event(c, "pack", ago(0.8), {"packages": 10}, batch_id=m["id"])
                print("  combined batch", m["code"], round(total, 1), "kg")

        # notice replies
        try:
            nid = next(n["id"] for n in acc.get("/api/exporter/planting-notices", params={"page_size": 20})["items"] if n["status"] == "published")
            for k, f in list(farm.items()):
                if f["plan"] in ("requested", "pending"): continue
                fn = f["acc"].get("/api/farmer/planting-notices")["items"]
                if not fn or fn[0]["farmer_response"]: continue
                plots = f["acc"].get(f"/api/farmer/planting-notices/{fn[0]['id']}/plots")
                if f["plan"] == "early" and cfg["key"] == "uva":
                    f["acc"].post(f"/api/farmer/planting-notices/{fn[0]['id']}/respond", {"response": "cannot"})
                elif plots:
                    f["acc"].post(f"/api/farmer/planting-notices/{fn[0]['id']}/respond", {"response": "ready", "expected_volume_kg": random.choice([600, 900, 1500, 2200]) if cfg["crop"] == "tea" else random.choice([40, 60, 90]), "plot_id": plots[0]["id"]})
        except (StopIteration, RuntimeError) as err:
            print("   notice replies skipped:", str(err)[:80])

    print("\nDone. Farmer accounts use password:", sd.PASSWORD)


if __name__ == "__main__":
    main()

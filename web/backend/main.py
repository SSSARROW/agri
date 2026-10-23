import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from auth.router import router as auth_router
from actors.router import router as actors_router
from plots.router import router as plots_router
from batches.router import router as batches_router
from events.router import router as events_router
from exporter.router import router as exporter_router
from exporter.standards.router import router as standards_router

app = FastAPI(title="Paramparā API")


# localhost:3000 always allowed (local dev); CORS_ORIGINS adds any deployed
# frontend origin(s) on top, comma-separated - e.g. the production web
# frontend's URL, unknown at code-time since the host assigns it.
_extra_origins = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", *_extra_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global handler: ensures CORS headers are present even on unhandled 500s.
# Without this, a Supabase/DB exception produces a bare 500 that the browser
# mis-reports as a CORS error, hiding the real problem.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "http://localhost:3000",
            "Access-Control-Allow-Credentials": "true",
        },
    )


from admin.exporter_verification import router as admin_exporter_router
from exporter.farmers.progress import router as exporter_farmers_progress_router
from exporter.farmers.router import router as exporter_farmers_router
from farmer.router import router as farmer_exporter_link_router
from exporter.ads.router import router as exporter_ads_router
from farmer.ads.router import router as farmer_ads_router
from exporter.ads.applicants.router import router as exporter_applicants_router
from farmer.ads.reports.router import router as farmer_ads_reports_router
from exporter.ads.stats.router import router as exporter_ads_stats_router
from admin.ads import router as admin_ads_router
from exporter.planting_notices.router import router as exporter_planting_notices_router
from farmer.planting_notices.router import router as farmer_planting_notices_router
from exporter.stage_proofs.router import router as exporter_stage_proofs_router
from farmer.stage_proofs.router import router as farmer_stage_proofs_router

app.include_router(auth_router)
app.include_router(actors_router)
app.include_router(plots_router)
app.include_router(batches_router)
app.include_router(events_router)
app.include_router(exporter_router)
app.include_router(standards_router)

ENABLE_ADMIN_EXPORTER_VERIFICATION = os.getenv("ENABLE_ADMIN_EXPORTER_VERIFICATION", "true").lower() == "true"
if ENABLE_ADMIN_EXPORTER_VERIFICATION:
    app.include_router(admin_exporter_router)

ENABLE_EXPORTER_FARMERS = os.getenv("ENABLE_EXPORTER_FARMERS", "true").lower() == "true"
if ENABLE_EXPORTER_FARMERS:
    app.include_router(exporter_farmers_progress_router)  # before /{link_id}
    app.include_router(exporter_farmers_router)
    app.include_router(farmer_exporter_link_router)

ENABLE_EXPORTER_ADS = os.getenv("ENABLE_EXPORTER_ADS", "true").lower() == "true"
if ENABLE_EXPORTER_ADS:
    app.include_router(exporter_ads_router)

ENABLE_AD_ACCEPTANCE = os.getenv("ENABLE_AD_ACCEPTANCE", "true").lower() == "true"
if ENABLE_AD_ACCEPTANCE:
    app.include_router(farmer_ads_router)
    app.include_router(exporter_applicants_router)

ENABLE_AD_STATS = os.getenv("ENABLE_AD_STATS", "true").lower() == "true"
if ENABLE_AD_STATS:
    app.include_router(exporter_ads_stats_router)
    app.include_router(farmer_ads_reports_router)

ENABLE_AD_MODERATION = os.getenv("ENABLE_AD_MODERATION", "true").lower() == "true"
if ENABLE_AD_MODERATION:
    app.include_router(admin_ads_router)

ENABLE_PLANTING_NOTICES = os.getenv("ENABLE_PLANTING_NOTICES", "true").lower() == "true"
if ENABLE_PLANTING_NOTICES:
    app.include_router(exporter_planting_notices_router)
    app.include_router(farmer_planting_notices_router)

ENABLE_STAGE_PROOFS = os.getenv("ENABLE_STAGE_PROOFS", "true").lower() == "true"
if ENABLE_STAGE_PROOFS:
    app.include_router(exporter_stage_proofs_router)
    app.include_router(farmer_stage_proofs_router)

ENABLE_NOTICE_REMINDERS = os.getenv("ENABLE_NOTICE_REMINDERS", "true").lower() == "true"
if ENABLE_NOTICE_REMINDERS:
    from exporter.planting_notices.reminders.router import router as exporter_notice_reminders_router
    from farmer.notifications.router import router as farmer_notifications_router
    app.include_router(exporter_notice_reminders_router)
    app.include_router(farmer_notifications_router)

ENABLE_NOTICE_SCHEDULER = os.getenv("ENABLE_NOTICE_SCHEDULER", "false").lower() == "true"
if ENABLE_NOTICE_SCHEDULER:
    from notifications.scheduler import start_scheduler, stop_scheduler

    @app.on_event("startup")
    async def _on_startup_scheduler():
        start_scheduler()

    @app.on_event("shutdown")
    async def _on_shutdown_scheduler():
        stop_scheduler()

@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"status": "ok"}



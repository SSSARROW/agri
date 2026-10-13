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


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


import os
from admin.exporter_verification import router as admin_exporter_router
from exporter.farmers.router import router as exporter_farmers_router
from farmer.router import router as farmer_exporter_link_router
from exporter.ads.router import router as exporter_ads_router

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
    app.include_router(exporter_farmers_router)
    app.include_router(farmer_exporter_link_router)

ENABLE_EXPORTER_ADS = os.getenv("ENABLE_EXPORTER_ADS", "true").lower() == "true"
if ENABLE_EXPORTER_ADS:
    app.include_router(exporter_ads_router)

@app.get("/")
def root():
    return {"status": "ok"}


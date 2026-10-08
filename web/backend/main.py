from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from auth.router import router as auth_router
from actors.router import router as actors_router
from plots.router import router as plots_router
from batches.router import router as batches_router
from events.router import router as events_router
from exporter.router import router as exporter_router

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

app.include_router(auth_router)
app.include_router(actors_router)
app.include_router(plots_router)
app.include_router(batches_router)
app.include_router(events_router)
app.include_router(exporter_router)

ENABLE_ADMIN_EXPORTER_VERIFICATION = os.getenv("ENABLE_ADMIN_EXPORTER_VERIFICATION", "true").lower() == "true"
if ENABLE_ADMIN_EXPORTER_VERIFICATION:
    app.include_router(admin_exporter_router)

@app.get("/")
def root():
    return {"status": "ok"}


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import batches, commitments, events, health, plots, protocols, provenance, users
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger

settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger(__name__)

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(health.router)
app.include_router(events.router, prefix=settings.api_prefix)
app.include_router(plots.router, prefix=settings.api_prefix)
app.include_router(batches.router, prefix=settings.api_prefix)
app.include_router(provenance.router, prefix=settings.api_prefix)
app.include_router(users.router, prefix=settings.api_prefix)
app.include_router(protocols.router, prefix=settings.api_prefix)
app.include_router(commitments.router, prefix=settings.api_prefix)


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("app_startup", environment=settings.environment)

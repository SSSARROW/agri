from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth.router import router as auth_router
from actors.router import router as actors_router
from plots.router import router as plots_router

app = FastAPI(title="Paramparā API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(actors_router)
app.include_router(plots_router)

@app.get("/")
def root():
    return {"status": "ok"}
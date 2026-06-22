from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(
    title="AI Hiring Decision Agent",
    description="Agentic AI system for resume evaluation and hiring decisions",
    version="0.1.0"
)

app.include_router(router)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "AI Hiring Agent backend running"}

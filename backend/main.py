from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
from typing import List, Optional
from dotenv import load_dotenv
from routers import auth  # add this import


from routers import upload, search, admin
from database import init_db

load_dotenv()

app = FastAPI(
    title="FacEvent - AI Face Recognition Photo System",
    description="Event photo system with AI-powered face recognition",
    version="1.0.0"
)
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])  # add this line

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://hackbuzz-photos.vercel.app"
    ],  # In production: set to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await init_db()
    print("✅ Database initialized")

app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

@app.get("/")
async def root():
    return {"message": "FacEvent API is running", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

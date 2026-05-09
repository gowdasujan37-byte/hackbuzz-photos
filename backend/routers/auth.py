from fastapi import APIRouter, HTTPException, Response, Cookie
from pydantic import BaseModel
import hashlib, os, secrets

router = APIRouter()

# Set these in your .env file
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")  # see below

sessions = set()  # In-memory; use Redis for production

class LoginRequest(BaseModel):
    username: str
    password: str

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

@router.post("/login")
def login(data: LoginRequest, response: Response):
    if data.username != ADMIN_USERNAME:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if hash_password(data.password) != ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = secrets.token_hex(32)
    sessions.add(token)
    response.set_cookie("admin_token", token, httponly=True, samesite="lax", max_age=86400)
    return {"message": "Logged in"}

@router.post("/logout")
def logout(response: Response, admin_token: str = Cookie(None)):
    sessions.discard(admin_token)
    response.delete_cookie("admin_token")
    return {"message": "Logged out"}

@router.get("/me")
def me(admin_token: str = Cookie(None)):
    if not admin_token or admin_token not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"username": ADMIN_USERNAME}
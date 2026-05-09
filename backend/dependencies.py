from fastapi import Cookie, HTTPException
from routers.auth import sessions

def require_admin(admin_token: str = Cookie(None)):
    if not admin_token or admin_token not in sessions:
        raise HTTPException(status_code=401, detail="Admin login required")
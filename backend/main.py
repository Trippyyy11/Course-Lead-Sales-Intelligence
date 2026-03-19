import io
import asyncio
import uuid
import json
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import os
import platform
import time
from datetime import datetime, timedelta, timezone
import random
import jwt
import bcrypt
from email.message import EmailMessage
import aiosmtplib
import asyncpg
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Environment Configuration ────────────────────────────────────────
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv()

# ─── Supabase PostgreSQL ────────────────────────────────────────────
SUPABASE_DB_URL = os.getenv("DATABASE_URL")

if SUPABASE_DB_URL is None:
    raise ValueError("DATABASE_URL environment variable is not set. Please ensure you have created a .env file.")

pg_pool: Optional[asyncpg.Pool] = None

# ─── Auth Configuration ─────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "dataforge_super_secret_key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False

# ─── SMTP Configuration ─────────────────────────────────────────────
SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = int(os.getenv("SMTP_PORT") or "587")
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

if not SMTP_SERVER:
    logger.warning("SMTP_SERVER not set in .env. Email features may fail.")

# ─── Metrics Configuration ──────────────────────────────────────────
JOIN_EXPLOSION_THRESHOLD = int(os.getenv("JOIN_EXPLOSION_THRESHOLD", "2000"))
PREVIEW_LIMIT = int(os.getenv("PREVIEW_LIMIT", "50"))

# ─── Storage Configuration (outside code directory) ─────────────────
def _get_default_data_dir():
    """Get OS-appropriate data directory for persistent storage."""
    if platform.system() == "Windows":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
        return os.path.join(base, "DataForge")
    else:
        return os.path.join(os.path.expanduser("~"), ".dataforge")

_DATA_DIR = _get_default_data_dir()
UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(_DATA_DIR, "uploads"))
RESULT_DIR = os.getenv("RESULT_DIR", os.path.join(_DATA_DIR, "results"))

logger.info(f"Upload directory: {UPLOAD_DIR}")
logger.info(f"Result directory: {RESULT_DIR}")

STORAGE_CLEANUP_HOURS = int(os.getenv("STORAGE_CLEANUP_HOURS", "24"))
STORAGE_CLEANUP_INTERVAL = int(os.getenv("STORAGE_CLEANUP_INTERVAL_SECONDS", "3600"))

# ─── Pydantic Models ────────────────────────────────────────────────
class AuthSignupRequest(BaseModel):
    email: str
    password: str
    confirm_password: str
    full_name: str

class AuthVerifySignup(BaseModel):
    email: str
    otp: str
    password: str
    full_name: str

class AuthLoginRequest(BaseModel):
    email: str
    password: str

class CollectionSchema(BaseModel):
    name: str
    config: Dict[str, Any]
    result_id: Optional[str] = None

class JoinTransformations(BaseModel):
    drop: Optional[List[str]] = None
    rename: Optional[Dict[str, str]] = None
    cast: Optional[Dict[str, str]] = None

# ─── JWT Helper ──────────────────────────────────────────────────────
def get_current_user(authorization: Optional[str] = Header(None), token: Optional[str] = Query(None)) -> str:
    """Extract and validate the user email from the Authorization header or token query param."""
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.replace("Bearer ", "")
    elif token:
        auth_token = token
    
    if not auth_token:
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in.")
    
    try:
        payload = jwt.decode(auth_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

# ─── Scoped Storage Keys ────────────────────────────────────────────
def _scoped_key(owner: str, file_id: str) -> str:
    """Create a user-scoped key for in-memory stores."""
    return f"{owner}:{file_id}"

# ─── Email Helper ────────────────────────────────────────────────────
async def send_otp_email(to_email: str, otp: str):
    logger.info(f"Generating OTP email for {to_email}")
    message = EmailMessage()
    message["Subject"] = "DataForge - Your Activation Code"
    message["From"] = SMTP_USERNAME
    message["To"] = to_email

    # Define a more robust and premium HTML template for email clients
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                background-color: #020617;
                color: #f8fafc;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 0;
            }}
            .wrapper {{
                background-color: #020617;
                padding: 60px 20px;
                text-align: center;
            }}
            .container {{
                max-width: 480px;
                margin: 0 auto;
                background-color: #1e293b;
                border: 1px solid #334155;
                border-radius: 24px;
                padding: 48px 32px;
                text-align: center;
            }}
            .title {{
                font-size: 28px;
                font-weight: 800;
                color: #ffffff;
                margin: 0 0 12px 0;
                letter-spacing: -0.02em;
            }}
            .subtitle {{
                color: #94a3b8 !important;
                font-size: 15px;
                line-height: 1.6;
                margin: 0 0 32px 0;
            }}
            .otp-box {{
                background-color: #0f172a;
                border: 2px solid #3b82f6;
                border-radius: 16px;
                padding: 24px;
                margin: 0 auto 32px;
                width: fit-content;
                min-width: 200px;
            }}
            .otp-label {{
                font-size: 10px;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 0.2em;
                color: #3b82f6;
                margin-bottom: 8px;
            }}
            .otp-code {{
                font-family: 'Monaco', 'Consolas', monospace;
                font-size: 42px;
                font-weight: 900;
                letter-spacing: 0.3em;
                color: #ffffff;
                margin: 0;
            }}
            .expiry {{
                color: #64748b;
                font-size: 13px;
                font-weight: 500;
                margin: 0;
            }}
            .footer {{
                color: #475569;
                font-size: 11px;
                margin-top: 48px;
                padding-top: 24px;
                border-top: 1px solid #334155;
                line-height: 1.5;
            }}
        </style>
    </head>
    <body style="background-color: #020617; margin: 0; padding: 0;">
        <div class="wrapper" style="background-color: #020617; padding: 60px 20px;">
            <div class="container" style="background-color: #1e293b; border-radius: 24px; padding: 48px 32px; max-width: 480px; margin: 0 auto;">
                <h1 class="title" style="color: #ffffff; font-size: 28px; font-weight: 800; margin: 0 0 12px 0;">Verify Your Email</h1>
                <p class="subtitle" style="color: #94a3b8; font-size: 15px; margin: 0 0 32px 0;">Welcome to <strong>DataForge</strong>. Please use the following activation code to complete your registration.</p>
                
                <div class="otp-box" style="background-color: #0f172a; border: 2px solid #3b82f6; border-radius: 16px; padding: 24px; margin: 0 auto 32px;">
                    <div class="otp-label" style="color: #3b82f6; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 8px;">Security Code</div>
                    <div class="otp-code" style="color: #ffffff; font-size: 42px; font-weight: 900; letter-spacing: 0.3em;">{otp}</div>
                </div>
                
                <p class="expiry" style="color: #64748b; font-size: 13px;">This code expires in <strong>5 minutes</strong>.</p>
                
                <div class="footer" style="color: #475569; font-size: 11px; margin-top: 48px; padding-top: 24px; border-top: 1px solid #334155;">
                    <strong>ForgeJoin</strong> • Unified Pipeline Logic v3.1<br>
                    Next-Gen Synthesis Engine • All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
    """

    message.set_content(f"Your DataForge verification code is: {otp}")
    message.add_alternative(html_content, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname=SMTP_SERVER,
            port=SMTP_PORT,
            start_tls=True,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
            timeout=10,
        )
        logger.info(f"OTP email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {type(e).__name__}: {e}")

# ═══════════════════════════════════════════════════════════════════════
#  FastAPI App
# ═══════════════════════════════════════════════════════════════════════
app = FastAPI()

# Configure CORS origins from environment
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:8000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-Memory Stores (user-scoped via "owner:file_id" keys) ────────
# file_store: {"owner:file_id": {"id", "name", "columns", "owner"}}
file_store: Dict[str, dict] = {}
# storage: {"owner:file_id": DataFrame}   (also holds join result DataFrames)
storage: Dict[str, pd.DataFrame] = {}

# task_store: {task_id: {"status": str, "progress": int, "result": any, "error": str}}
task_store: Dict[str, dict] = {}

# ─── Storage Cleanup Logic ──────────────────────────────────────────
async def storage_cleanup_loop():
    """Background task to periodically clean up old files and data."""
    logger.info(f"Storage cleanup task started (Interval: {STORAGE_CLEANUP_INTERVAL}s, Threshold: {STORAGE_CLEANUP_HOURS}h)")
    
    while True:
        try:
            await asyncio.sleep(STORAGE_CLEANUP_INTERVAL)
            threshold_time = time.time() - (STORAGE_CLEANUP_HOURS * 3600)
            deleted_files = 0
            
            # Scan UPLOAD_DIR
            if os.path.exists(UPLOAD_DIR):
                for owner_dir in os.listdir(UPLOAD_DIR):
                    owner_path = os.path.join(UPLOAD_DIR, owner_dir)
                    if not os.path.isdir(owner_path):
                        continue
                        
                    for filename in os.listdir(owner_path):
                        if filename == "_metadata.json":
                            continue
                        file_path = os.path.join(owner_path, filename)
                        if os.path.isfile(file_path) and os.path.getmtime(file_path) < threshold_time:
                            file_id = filename.replace(".csv", "")
                            skey = f"{owner_dir}:{file_id}"
                            
                            # 1. Delete from memory stores
                            storage.pop(skey, None)
                            file_store.pop(skey, None)
                            
                            # 2. Delete from disk
                            os.remove(file_path)
                            deleted_files += 1
                            
                            # 3. Delete from database
                            if pg_pool:
                                async with pg_pool.acquire() as conn:
                                    await conn.execute("DELETE FROM files WHERE id = $1 AND owner_email = $2", file_id, owner_dir)
                    
                    # Update metadata file for user
                    _save_file_metadata(owner_dir)

            if deleted_files > 0:
                logger.info(f"Cleanup cycle completed: deleted {deleted_files} old upload file(s).")
                
        except Exception as e:
            logger.error(f"Error in storage cleanup loop: {e}")

# ─── Startup / Shutdown ─────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global pg_pool
    # Create storage directories outside code directory
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(RESULT_DIR, exist_ok=True)
    
    pg_pool = await asyncpg.create_pool(
        SUPABASE_DB_URL,
        min_size=2,
        max_size=10,
        statement_cache_size=0
    )
    logger.info("Connected to Supabase PostgreSQL")

    # Start background cleanup task
    asyncio.create_task(storage_cleanup_loop())

    async with pg_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS otps (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                otp TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS collections (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                owner_email TEXT NOT NULL DEFAULT '',
                config JSONB NOT NULL DEFAULT '{}',
                result_csv TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(name, owner_email)
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                type TEXT NOT NULL,
                owner_email TEXT NOT NULL DEFAULT '',
                columns JSONB DEFAULT '[]',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS shared_files (
                id SERIAL PRIMARY KEY,
                file_id TEXT NOT NULL,
                owner_email TEXT NOT NULL,
                shared_with_email TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(file_id, shared_with_email)
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS shared_collections (
                id SERIAL PRIMARY KEY,
                collection_name TEXT NOT NULL,
                owner_email TEXT NOT NULL,
                shared_with_email TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(collection_name, shared_with_email)
            );
        """)


        # Migration: add owner_email column if it doesn't exist (for existing DBs)
        try:
            await conn.execute("ALTER TABLE files ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT ''")
        except Exception:
            pass
        try:
            await conn.execute("ALTER TABLE collections ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT ''")
        except Exception:
            pass

        # Drop old unique constraint on collections.name if it exists, add new composite one
        try:
            await conn.execute("ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_name_key")
        except Exception:
            pass
        try:
            await conn.execute("""
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'collections_name_owner_key'
                    ) THEN
                        ALTER TABLE collections ADD CONSTRAINT collections_name_owner_key UNIQUE (name, owner_email);
                    END IF;
                END $$;
            """)
        except Exception:
            pass

    logger.info("Database tables ready")
    
    # ─── Reload persisted files from disk into memory ────────────────
    await _reload_persisted_files()

async def _reload_persisted_files():
    """Scan UPLOAD_DIR and reload each user's files into memory."""
    if not os.path.exists(UPLOAD_DIR):
        return
    
    loaded_count = 0
    for owner_dir in os.listdir(UPLOAD_DIR):
        owner_path = os.path.join(UPLOAD_DIR, owner_dir)
        if not os.path.isdir(owner_path):
            continue
        
        owner_email = owner_dir  # directory name is the owner email
        
        # Load metadata file if it exists
        meta_path = os.path.join(owner_path, "_metadata.json")
        metadata = {}
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r") as f:
                    metadata = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load metadata for {owner_email}: {e}")
                continue
        
        for file_id, file_meta in metadata.items():
            file_path = os.path.join(owner_path, f"{file_id}.csv")
            if not os.path.exists(file_path):
                continue
            
            try:
                df = pd.read_csv(file_path, low_memory=False)
                skey = _scoped_key(owner_email, file_id)
                storage[skey] = df
                file_store[skey] = {
                    "id": file_id,
                    "name": file_meta.get("name", f"{file_id}.csv"),
                    "columns": df.columns.tolist(),
                    "rows": len(df),
                    "cols": len(df.columns),
                    "owner": owner_email,
                }
                loaded_count += 1
            except Exception as e:
                logger.warning(f"Failed to reload file {file_id} for {owner_email}: {e}")
    
    if loaded_count > 0:
        logger.info(f"Reloaded {loaded_count} persisted file(s) from disk")

def _save_file_metadata(owner_email: str):
    """Persist file metadata for a user to disk."""
    owner_path = os.path.join(UPLOAD_DIR, owner_email)
    os.makedirs(owner_path, exist_ok=True)
    
    meta_path = os.path.join(owner_path, "_metadata.json")
    metadata = {}
    
    # Gather all files for this owner
    for skey, info in file_store.items():
        if info.get("owner") == owner_email:
            metadata[info["id"]] = {
                "name": info["name"],
            }
    
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

@app.on_event("shutdown")
async def shutdown():
    global pg_pool
    if pg_pool:
        await pg_pool.close()
        logger.info("PostgreSQL pool closed")

# ═══════════════════════════════════════════════════════════════════════
#  Authentication Routes (Supabase / asyncpg)
# ═══════════════════════════════════════════════════════════════════════

@app.post("/auth/request-otp")
async def request_otp(data: AuthSignupRequest, background_tasks: BackgroundTasks):
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    async with pg_pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1", data.email.lower()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Email is already registered")

        otp = str(random.randint(100000, 999999))
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

        await conn.execute(
            """
            INSERT INTO otps (email, otp, expires_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (email) DO UPDATE
                SET otp = EXCLUDED.otp, expires_at = EXCLUDED.expires_at
            """,
            data.email.lower(), otp, expires_at,
        )

    background_tasks.add_task(send_otp_email, data.email.lower(), otp)
    print(f"--- DEV OTP FOR {data.email.lower()} IS: {otp} ---")
    return {"message": "OTP sent to your email"}

@app.post("/auth/verify-signup")
async def verify_signup(data: AuthVerifySignup):
    email_lower = data.email.lower()

    async with pg_pool.acquire() as conn:
        otp_record = await conn.fetchrow(
            "SELECT otp, expires_at FROM otps WHERE email = $1", email_lower
        )
        if not otp_record:
            raise HTTPException(status_code=400, detail="No OTP requested for this email")
        if otp_record["otp"] != data.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP")
        if datetime.now(timezone.utc) > otp_record["expires_at"].replace(tzinfo=timezone.utc):
            raise HTTPException(status_code=400, detail="OTP has expired")

        hashed_pass = hash_password(data.password)
        await conn.execute(
            "INSERT INTO users (email, full_name, hashed_password) VALUES ($1, $2, $3)",
            email_lower, data.full_name, hashed_pass,
        )
        await conn.execute("DELETE FROM otps WHERE email = $1", email_lower)

    return {"message": "Account created successfully!"}

@app.post("/auth/login")
async def login(data: AuthLoginRequest):
    async with pg_pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT email, full_name, hashed_password FROM users WHERE email = $1",
            data.email.lower(),
        )

    if not user:
        raise HTTPException(status_code=401, detail="No account found with this email address.")
    
    if not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    payload = {
        "sub": user["email"],
        "name": user["full_name"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"email": user["email"], "name": user["full_name"]},
    }

# ═══════════════════════════════════════════════════════════════════════
#  File Upload / Management  (user-scoped, persisted to disk)
# ═══════════════════════════════════════════════════════════════════════

def load_dataframe(owner: str, file_id: str) -> pd.DataFrame:
    """Look up a DataFrame from the user-scoped in-memory store."""
    skey = _scoped_key(owner, file_id)
    if skey in storage:
        return storage[skey]
    raise ValueError(f"File {file_id} not found")

@app.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    authorization: Optional[str] = Header(None),
):
    owner = get_current_user(authorization)
    uploaded_info = []
    
    # Ensure user upload directory exists
    user_upload_dir = os.path.join(UPLOAD_DIR, owner)
    os.makedirs(user_upload_dir, exist_ok=True)
    
    for file in files:
        file_id = str(uuid.uuid4())

        try:
            content = await file.read()
            logger.info(f"Received file: {file.filename}, size: {len(content)} bytes, owner: {owner}")

            if file.filename.endswith(".csv"):
                try:
                    df = pd.read_csv(io.BytesIO(content), low_memory=False)
                except UnicodeDecodeError:
                    logger.info(f"UTF-8 decode failed for {file.filename}, falling back to latin-1")
                    df = pd.read_csv(io.BytesIO(content), low_memory=False, encoding='latin-1')
            elif file.filename.endswith((".xls", ".xlsx")):
                df = pd.read_excel(io.BytesIO(content))
            else:
                logger.warning(f"Unsupported file format: {file.filename}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file format: {file.filename}",
                )

            if df.empty:
                logger.warning(f"File {file.filename} is empty")
                raise HTTPException(
                    status_code=400,
                    detail=f"File {file.filename} is empty.",
                )

            # Store in user-scoped memory
            skey = _scoped_key(owner, file_id)
            storage[skey] = df
            logger.info(f"Processed {file.filename}: {len(df)} rows, {len(df.columns)} columns")
            info = {
                "id": file_id,
                "name": file.filename,
                "columns": df.columns.tolist(),
                "rows": len(df),
                "cols": len(df.columns),
                "owner": owner,
            }
            file_store[skey] = info
            uploaded_info.append({k: v for k, v in info.items() if k != "owner"})

            # Persist to disk for refresh recovery
            persist_path = os.path.join(user_upload_dir, f"{file_id}.csv")
            df.to_csv(persist_path, index=False)
            
            # Also persist to DB for record-keeping
            async with pg_pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO files (id, name, path, type, owner_email, columns)
                       VALUES ($1, $2, $3, $4, $5, $6)
                       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, path=EXCLUDED.path""",
                    file_id, file.filename, persist_path, "upload", owner,
                    json.dumps(df.columns.tolist()),
                )

        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Error processing {file.filename}")
            raise HTTPException(
                status_code=400,
                detail=f"Error processing {file.filename}: {str(e)}",
            )

    # Save metadata to disk
    _save_file_metadata(owner)

    return {"message": "Files uploaded successfully", "files": uploaded_info}

@app.get("/files/download/{file_id}")
async def download_file(
    file_id: str,
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    owner = get_current_user(authorization, token)
    
    async with pg_pool.acquire() as conn:
        file_record = await conn.fetchrow(
            """
            SELECT name, owner_email 
            FROM files 
            WHERE id = $1 AND (owner_email = $2 OR id IN (SELECT file_id FROM shared_files WHERE shared_with_email = $2))
            """,
            file_id, owner
        )
        
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found or not authorized")
        
        # Determine path (uploaded files are in owner's subdir)
        filename = file_record['name']
        file_owner = file_record['owner_email']
        file_path = os.path.join(UPLOAD_DIR, file_owner, filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Physical file missing")
            
        return FileResponse(file_path, filename=filename)

@app.get("/files")
async def get_files(authorization: Optional[str] = Header(None), token: Optional[str] = Query(None)):
    owner = get_current_user(authorization, token)
    # 1. Get owned files from memory
    user_files = [
        {**info, "is_owner": True, "shared_with": []}
        for info in file_store.values()
        if info.get("owner") == owner
    ]
    
    # 2. Get shared files from DB
    async with pg_pool.acquire() as conn:
        shared_records = await conn.fetch(
            """SELECT f.* FROM files f 
               JOIN shared_files s ON f.id = s.file_id 
               WHERE s.shared_with_email = $1""", 
            owner
        )
        for row in shared_records:
            user_files.append({
                "id": row["id"],
                "name": row["name"],
                "columns": json.loads(row["columns"]) if isinstance(row["columns"], str) else row["columns"],
                "is_owner": False,
                "owner": row["owner_email"],
            })
            
    return {"files": user_files}

class ShareFileRequest(BaseModel):
    file_id: str
    target_email: str

@app.post("/files/share")
async def share_file(req: ShareFileRequest, authorization: Optional[str] = Header(None)):
    owner = get_current_user(authorization)
    
    # Verify ownership
    skey = _scoped_key(owner, req.file_id)
    if skey not in file_store:
        raise HTTPException(status_code=403, detail="You do not own this file or it does not exist")
    
    async with pg_pool.acquire() as conn:
        # Check if target exists
        target = await conn.fetchrow("SELECT email FROM users WHERE email = $1", req.target_email.lower())
        if not target:
            raise HTTPException(status_code=404, detail="Target user not found")
        
        await conn.execute(
            """INSERT INTO shared_files (file_id, owner_email, shared_with_email) 
               VALUES ($1, $2, $3) ON CONFLICT DO NOTHING""",
            req.file_id, owner, req.target_email.lower()
        )
    return {"message": f"File shared with {req.target_email}"}

@app.get("/columns/{file_id}")
async def get_columns(file_id: str, authorization: Optional[str] = Header(None)):
    owner = get_current_user(authorization)
    skey = _scoped_key(owner, file_id)
    if skey in file_store:
        return {"columns": file_store[skey]["columns"]}
    if skey in storage:
        return {"columns": storage[skey].columns.tolist()}
    raise HTTPException(status_code=404, detail="File not found")

@app.delete("/file/{file_id}")
async def delete_file(file_id: str, authorization: Optional[str] = Header(None)):
    owner = get_current_user(authorization)
    skey = _scoped_key(owner, file_id)
    storage.pop(skey, None)
    file_store.pop(skey, None)
    
    # Remove from disk
    persist_path = os.path.join(UPLOAD_DIR, owner, f"{file_id}.csv")
    if os.path.exists(persist_path):
        os.remove(persist_path)
    _save_file_metadata(owner)
    
    # Remove from DB and Shares
    async with pg_pool.acquire() as conn:
        await conn.execute("DELETE FROM shared_files WHERE file_id = $1", file_id)
        await conn.execute("DELETE FROM files WHERE id = $1 AND owner_email = $2", file_id, owner)
    
    return {"message": "File deleted successfully"}

@app.delete("/files/clear")
async def clear_all_files(authorization: Optional[str] = Header(None)):
    owner = get_current_user(authorization)
    
    # Clear only this user's files from memory
    keys_to_remove = [k for k, v in file_store.items() if v.get("owner") == owner]
    for k in keys_to_remove:
        storage.pop(k, None)
        file_store.pop(k, None)
    
    # Clear from disk
    user_upload_dir = os.path.join(UPLOAD_DIR, owner)
    if os.path.exists(user_upload_dir):
        import shutil
        shutil.rmtree(user_upload_dir, ignore_errors=True)
    
    # Clear from DB
    async with pg_pool.acquire() as conn:
        await conn.execute("DELETE FROM files WHERE owner_email = $1", owner)
    
    return {"message": "All files cleared successfully"}

# ═══════════════════════════════════════════════════════════════════════
#  Collections  (persisted to Supabase, user-scoped)
# ═══════════════════════════════════════════════════════════════════════

async def _perform_background_save(task_id: str, collection_name: str, config: dict, df: pd.DataFrame, owner: str):
    try:
        _check_task_cancelled(task_id)
        task_store[task_id] = {"status": "processing", "progress": 5, "message": "Initiating save sequence..."}
        _check_task_cancelled(task_id)
        task_store[task_id].update({"progress": 15, "message": "Compressing and writing CSV data..."})
        result_filename = f"result_{uuid.uuid4().hex}.zip"
        
        # Save to user-scoped result directory
        user_result_dir = os.path.join(RESULT_DIR, owner)
        os.makedirs(user_result_dir, exist_ok=True)
        file_path = os.path.join(user_result_dir, result_filename)
        
        _check_task_cancelled(task_id)
        # Offload ZIP-compressed CSV writing to a thread
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: df.to_csv(
            file_path, 
            index=False, 
            compression={'method': 'zip', 'archive_name': 'data.csv'}
        ))
        
        _check_task_cancelled(task_id)
        task_store[task_id].update({"progress": 70, "message": "Updating database..."})
        
        async with pg_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO collections (name, owner_email, config, result_csv)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT ON CONSTRAINT collections_name_owner_key DO UPDATE
                    SET config = EXCLUDED.config,
                        result_csv = EXCLUDED.result_csv
                """,
                collection_name,
                owner,
                json.dumps(config),
                result_filename,
            )
        
        _check_task_cancelled(task_id)
        task_store[task_id] = {"status": "completed", "progress": 100, "message": "Collection saved successfully!"}
        logger.info(f"Background: Collection '{collection_name}' persisted for {owner}")
    except Exception as e:
        if task_store.get(task_id, {}).get("status") == "cancelled":
            logger.info(f"Background operation {task_id} successfully halted.")
            return
        logger.error(f"Background Save Failed for {collection_name}: {e}")
        task_store[task_id] = {"status": "failed", "error": str(e)}

@app.post("/collections")
async def save_collection(
    collection: CollectionSchema,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
):
    owner = get_current_user(authorization)
    task_id = str(uuid.uuid4())
    if collection.result_id:
        skey = _scoped_key(owner, collection.result_id)
        if skey in storage:
            df = storage[skey]
            task_store[task_id] = {"status": "queued", "progress": 0, "message": "Queuing save operation..."}
            background_tasks.add_task(_perform_background_save, task_id, collection.name, collection.config, df, owner)
            return {"task_id": task_id}
    
    # If no result id, just save metadata (fast)
    async with pg_pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO collections (name, owner_email, config) VALUES ($1, $2, $3) 
               ON CONFLICT ON CONSTRAINT collections_name_owner_key DO UPDATE SET config = EXCLUDED.config""",
            collection.name, owner, json.dumps(collection.config)
        )
    return {"message": "Metadata saved successfully"}

@app.get("/collections")
async def get_collections(authorization: Optional[str] = Header(None)):
    owner = get_current_user(authorization)
    async with pg_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT name, config, (result_csv IS NOT NULL) AS has_result FROM collections WHERE owner_email = $1",
            owner,
        )
    cols = []
    for r in rows:
        cols.append({
            "name": r["name"],
            "config": json.loads(r["config"]) if isinstance(r["config"], str) else r["config"],
            "has_result": r["has_result"],
        })
    return {"collections": cols}


@app.delete("/collections/{name}")
async def delete_collection(name: str, authorization: Optional[str] = Header(None)):
    owner = get_current_user(authorization)
    async with pg_pool.acquire() as conn:
        # Also delete the result file from disk
        row = await conn.fetchrow(
            "SELECT result_csv FROM collections WHERE name = $1 AND owner_email = $2", name, owner
        )
        if row and row["result_csv"]:
            result_path = os.path.join(RESULT_DIR, owner, row["result_csv"])
            if os.path.exists(result_path):
                os.remove(result_path)
        
        result = await conn.execute(
            "DELETE FROM collections WHERE name = $1 AND owner_email = $2", name, owner
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"message": f"Collection '{name}' deleted successfully"}

@app.delete("/tasks/{task_id}")
async def cancel_task(task_id: str):
    if task_id not in task_store:
        raise HTTPException(status_code=404, detail="Task not found")
    
    current_status = task_store[task_id].get("status")
    if current_status in ["completed", "failed"]:
        return {"message": f"Task already {current_status}"}
    
    task_store[task_id]["status"] = "cancelled"
    task_store[task_id]["message"] = "Task cancelled by user"
    return {"message": "Task cancellation requested"}

@app.get("/collections/download/{name}")
async def download_collection_result(
    name: str, 
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    owner = get_current_user(authorization, token)
    async with pg_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT result_csv FROM collections WHERE name = $1 AND owner_email = $2", name, owner
        )
    if not row or not row["result_csv"]:
        raise HTTPException(status_code=404, detail="Result not found or not yet generated")

    file_path = os.path.join(RESULT_DIR, owner, row["result_csv"])
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Result file missing on server")

    def iter_file():
        with open(file_path, "rb") as f:
            yield from f

    return StreamingResponse(
        iter_file(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{name}_result.csv.zip"'},
    )

# ═══════════════════════════════════════════════════════════════════════
#  Join Engine  (FIXED: no more cartesian products)
# ═══════════════════════════════════════════════════════════════════════

@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    if task_id not in task_store:
        raise HTTPException(status_code=404, detail="Task not found")
    return task_store[task_id]

def _check_task_cancelled(task_id: str):
    if task_store.get(task_id, {}).get("status") == "cancelled":
        raise Exception("Task cancelled by user")

# Non-async version so it runs in a thread pool and doesn't block the event loop
def _perform_background_join(task_id: str, owner: str, file_a_id: str, file_b_id: str, keys_a: List[str], keys_b: List[str], join_type: str, transforms: Optional[JoinTransformations]):
    try:
        _check_task_cancelled(task_id)
        task_store[task_id] = {"status": "processing", "progress": 5, "message": "Preparing work area..."}
        _check_task_cancelled(task_id)
        task_store[task_id].update({"progress": 15, "message": "Accessing source datasets..."})
        _check_task_cancelled(task_id)
        df_a = load_dataframe(owner, file_a_id)
        df_b = load_dataframe(owner, file_b_id)
        
        _check_task_cancelled(task_id)
        task_store[task_id].update({"progress": 30, "message": "Performing join logic..."})
        
        df_a = df_a.copy()
        df_b = df_b.copy()

        # ─── FIXED: Safe normalization (trim + lowercase only) ───────
        # The old normalize_val() stripped all non-digits and took last 10,
        # which caused cartesian products on non-phone columns.
        def normalize_val(val):
            """Safe normalization: strip whitespace and lowercase for consistent matching."""
            if pd.isna(val):
                return val
            return str(val).strip().lower()

        # Cast join keys to normalized strings to prevent type mismatch
        if keys_a:
            for col in keys_a:
                if col in df_a.columns:
                    df_a[col] = df_a[col].apply(normalize_val)
        if keys_b:
            for col in keys_b:
                if col in df_b.columns:
                    df_b[col] = df_b[col].apply(normalize_val)

        # ─── CRITICAL: Deduplicate on join keys BEFORE merging ───────
        # Without this, if key "ECO CYBER" appears 3× in A and 4× in B,
        # pd.merge produces 3×4=12 rows (cartesian product per key).
        # Deduplicating keeps only the first occurrence of each key value,
        # so each key matches at most once → no row explosion.
        if join_type != "append":
            if keys_a:
                valid_keys_a = [k for k in keys_a if k in df_a.columns]
                if valid_keys_a:
                    logger.info(f"Pre-merge dedup: A had {len(df_a)} rows, deduplicating on {valid_keys_a}")
                    df_a = df_a.drop_duplicates(subset=valid_keys_a, keep='first')
                    logger.info(f"Pre-merge dedup: A now has {len(df_a)} rows")
            if keys_b:
                valid_keys_b = [k for k in keys_b if k in df_b.columns]
                if valid_keys_b:
                    logger.info(f"Pre-merge dedup: B had {len(df_b)} rows, deduplicating on {valid_keys_b}")
                    df_b = df_b.drop_duplicates(subset=valid_keys_b, keep='first')
                    logger.info(f"Pre-merge dedup: B now has {len(df_b)} rows")

        if join_type == "append":
            common_columns = list(set(df_a.columns) & set(df_b.columns))
            merged_df = pd.concat([df_a[common_columns], df_b[common_columns]], ignore_index=True)
        elif join_type == "left_anti":
            merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how="left", indicator=True, suffixes=("_fileA", "_fileB"))
            merged_df = merged_df[merged_df["_merge"] == "left_only"].drop(columns=["_merge"])
            # For anti-joins, keep only columns from the source side
            cols_to_keep = [c for c in merged_df.columns if not c.endswith("_fileB")]
            merged_df = merged_df[cols_to_keep]
            # Clean up suffixed column names from the kept side
            merged_df.columns = [c.replace("_fileA", "") if c.endswith("_fileA") else c for c in merged_df.columns]
        elif join_type == "right_anti":
            merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how="right", indicator=True, suffixes=("_fileA", "_fileB"))
            merged_df = merged_df[merged_df["_merge"] == "right_only"].drop(columns=["_merge"])
            # For anti-joins, keep only columns from the source side
            cols_to_keep = [c for c in merged_df.columns if not c.endswith("_fileA")]
            merged_df = merged_df[cols_to_keep]
            # Clean up suffixed column names from the kept side
            merged_df.columns = [c.replace("_fileB", "") if c.endswith("_fileB") else c for c in merged_df.columns]
        elif join_type == "full_anti":
            merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how="outer", indicator=True, suffixes=("_fileA", "_fileB"))
            merged_df = merged_df[merged_df["_merge"] != "both"].drop(columns=["_merge"])
        else:
            merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how=join_type, suffixes=("_fileA", "_fileB"))

        # Safety net: drop any remaining fully-identical duplicate rows
        merged_df = merged_df.drop_duplicates()

        _check_task_cancelled(task_id)
        task_store[task_id].update({"progress": 60, "message": "Applying transformations..."})
        
        if transforms:
            if transforms.cast:
                for col, dtype in transforms.cast.items():
                    if col in merged_df.columns:
                        try:
                            if "datetime" in dtype:
                                merged_df[col] = pd.to_datetime(merged_df[col], errors="coerce")
                            else:
                                merged_df[col] = merged_df[col].astype(dtype)
                        except Exception: pass
            if transforms.rename:
                merged_df = merged_df.rename(columns={o: n for o, n in transforms.rename.items() if o in merged_df.columns})
            if transforms.drop:
                to_drop = [c for c in transforms.drop if c in merged_df.columns]
                if to_drop: merged_df = merged_df.drop(columns=to_drop)

        _check_task_cancelled(task_id)
        task_store[task_id].update({"progress": 80, "message": "Calculating metrics..."})
        
        if len(merged_df) > JOIN_EXPLOSION_THRESHOLD:
            logger.warning(f"JOIN EXPLOSION: {len(merged_df)} rows generated.")

        # Calculate metrics against original (pre-normalization) row counts
        orig_a_len = len(df_a)
        orig_b_len = len(df_b)
        metrics = {
            "match_rate_a": round(len(merged_df) / orig_a_len * 100, 2) if orig_a_len > 0 else 0,
            "match_rate_b": round(len(merged_df) / orig_b_len * 100, 2) if orig_b_len > 0 else 0,
            "null_count": int(merged_df.isnull().sum().sum()),
            "duplicate_count": int(merged_df.duplicated().sum()),
        }

        result_id = str(uuid.uuid4())
        skey = _scoped_key(owner, result_id)
        storage[skey] = merged_df
        
        task_store[task_id] = {
            "status": "completed",
            "progress": 100,
            "result": {
                "result_id": result_id,
                "row_count": len(merged_df),
                "col_count": len(merged_df.columns),
                "columns": merged_df.columns.tolist(),
                "metrics": metrics,
            }
        }
    except Exception as e:
        if task_store.get(task_id, {}).get("status") == "cancelled":
            logger.info(f"Background join {task_id} successfully halted.")
            return
        logger.exception(f"Background Join Failed: {e}")
        task_store[task_id] = {"status": "failed", "error": str(e)}

@app.post("/join")
async def join_data(
    background_tasks: BackgroundTasks,
    file_a_id: str = Query(...),
    file_b_id: str = Query(...),
    keys_a: Optional[List[str]] = Query(None),
    keys_b: Optional[List[str]] = Query(None),
    join_type: str = Query("inner"),
    transforms: Optional[JoinTransformations] = None,
    authorization: Optional[str] = Header(None),
):
    owner = get_current_user(authorization)
    
    # Verify both files belong to this user
    skey_a = _scoped_key(owner, file_a_id)
    skey_b = _scoped_key(owner, file_b_id)
    if skey_a not in storage and skey_a not in file_store:
        raise HTTPException(status_code=404, detail="Source file A not found or not owned by you")
    if skey_b not in storage and skey_b not in file_store:
        raise HTTPException(status_code=404, detail="Source file B not found or not owned by you")
    
    task_id = str(uuid.uuid4())
    task_store[task_id] = {"status": "queued", "progress": 0, "message": "Waiting for worker..."}
    background_tasks.add_task(
        _perform_background_join,
        task_id, owner, file_a_id, file_b_id, keys_a, keys_b, join_type, transforms
    )
    return {"task_id": task_id}


# ═══════════════════════════════════════════════════════════════════════
#  Preview / Download (user-scoped)
# ═══════════════════════════════════════════════════════════════════════

@app.get("/preview/{result_id}")
async def get_preview(
    result_id: str, 
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    owner = get_current_user(authorization, token)
    try:
        df = load_dataframe(owner, result_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Result not found")

    preview_df = df.head(PREVIEW_LIMIT).fillna("")
    return {
        "data": preview_df.to_dict(orient="records"),
        "columns": preview_df.columns.tolist(),
        "metrics": {
            "row_count": len(df),
            "col_count": len(df.columns),
            "null_count": int(df.isnull().sum().sum()),
            "duplicate_count": int(df.duplicated().sum()),
        }
    }

class ColumnDropRequest(BaseModel):
    columns: List[str]

@app.delete("/result/{result_id}/columns")
async def drop_result_columns(
    result_id: str, 
    req: ColumnDropRequest,
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    owner = get_current_user(authorization, token)
    try:
        df = load_dataframe(owner, result_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Result not found or expired")

    # Drop columns
    cols_to_drop = [c for c in req.columns if c in df.columns]
    if cols_to_drop:
        df = df.drop(columns=cols_to_drop)
        skey = _scoped_key(owner, result_id)
        storage[skey] = df  # Update in-memory store

    # Return updated preview and metrics
    preview_df = df.head(PREVIEW_LIMIT).fillna("")
    return {
        "message": f"Successfully dropped {len(cols_to_drop)} columns",
        "data": preview_df.to_dict(orient="records"),
        "columns": preview_df.columns.tolist(),
        "metrics": {
            "row_count": len(df),
            "col_count": len(df.columns),
            "null_count": int(df.isnull().sum().sum()),
            "duplicate_count": int(df.duplicated().sum()),
        }
    }

@app.get("/download/{result_id}")
async def download_result(
    result_id: str,
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
    filename: Optional[str] = Query(None),
):
    owner = get_current_user(authorization, token)
    try:
        df = load_dataframe(owner, result_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Result not found")

    # Use custom filename if provided, otherwise default
    base_name = filename if filename else f"joined_data_{result_id}"
    # Remove any existing extensions user might have passed
    base_name = base_name.split('.')[0]
    display_name = base_name
    
    # Generate a ZIP compressed CSV on the fly
    buf = io.BytesIO()
    df.to_csv(
        buf, 
        index=False, 
        compression={'method': 'zip', 'archive_name': 'data.csv'}
    )
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{display_name}.zip"'},
    )

# ═══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

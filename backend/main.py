import io
import asyncio
import uuid
import json
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import os
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
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

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

# ─── Email Helper ────────────────────────────────────────────────────
async def send_otp_email(to_email: str, otp: str):
    message = EmailMessage()
    message.set_content(
        f"Welcome to DataForge! Your verification code is: {otp}\n"
        f"This code expires in 5 minutes."
    )
    message["Subject"] = "DataForge - Your Activation Code"
    message["From"] = SMTP_USERNAME
    message["To"] = to_email

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

# ─── In-Memory Stores ───────────────────────────────────────────────
# file_store: {file_id: {"id", "name", "columns"}}
file_store: Dict[str, dict] = {}
# storage: {file_id: DataFrame}   (also holds join result DataFrames)
storage: Dict[str, pd.DataFrame] = {}

# task_store: {task_id: {"status": str, "progress": int, "result": any, "error": str}}
task_store: Dict[str, dict] = {}

# ─── Startup / Shutdown ─────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global pg_pool
    # Create storage directories
    os.makedirs("results", exist_ok=True)
    os.makedirs("uploads", exist_ok=True)
    
    pg_pool = await asyncpg.create_pool(
        SUPABASE_DB_URL,
        min_size=2,
        max_size=10,
        statement_cache_size=0
    )
    logger.info("Connected to Supabase PostgreSQL")

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
                name TEXT UNIQUE NOT NULL,
                config JSONB NOT NULL DEFAULT '{}',
                result_csv TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                type TEXT NOT NULL, -- 'upload' or 'result'
                columns JSONB DEFAULT '[]',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
    logger.info("Database tables ready")

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
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

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
#  File Upload / Management  (100 % in-memory — blazing fast)
# ═══════════════════════════════════════════════════════════════════════

def load_dataframe(file_id: str) -> pd.DataFrame:
    """Look up a DataFrame from the in-memory store."""
    if file_id in storage:
        return storage[file_id]
    raise ValueError(f"File {file_id} not found in memory")

@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    uploaded_info = []
    for file in files:
        file_id = str(uuid.uuid4())

        try:
            content = await file.read()

            if file.filename.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(content), low_memory=False)
            elif file.filename.endswith((".xls", ".xlsx")):
                df = pd.read_excel(io.BytesIO(content))
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file format: {file.filename}",
                )

            if df.empty:
                raise HTTPException(
                    status_code=400,
                    detail=f"File {file.filename} is empty.",
                )

            # Store in memory
            storage[file_id] = df
            info = {
                "id": file_id,
                "name": file.filename,
                "columns": df.columns.tolist(),
            }
            file_store[file_id] = info
            uploaded_info.append(info)

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error processing {file.filename}: {str(e)}",
            )

    return {"message": "Files uploaded successfully", "files": uploaded_info}

@app.get("/files")
async def get_files():
    return {"files": list(file_store.values())}

@app.get("/columns/{file_id}")
async def get_columns(file_id: str):
    if file_id in file_store:
        return {"columns": file_store[file_id]["columns"]}
    if file_id in storage:
        return {"columns": storage[file_id].columns.tolist()}
    raise HTTPException(status_code=404, detail="File not found")

@app.delete("/file/{file_id}")
async def delete_file(file_id: str):
    storage.pop(file_id, None)
    file_store.pop(file_id, None)
    return {"message": "File deleted successfully"}

@app.delete("/files/clear")
async def clear_all_files():
    storage.clear()
    file_store.clear()
    return {"message": "All files cleared successfully"}

# ═══════════════════════════════════════════════════════════════════════
#  Collections  (persisted to Supabase)
# ═══════════════════════════════════════════════════════════════════════

async def _perform_background_save(task_id: str, collection_name: str, config: dict, df: pd.DataFrame):
    try:
        _check_task_cancelled(task_id)
        task_store[task_id] = {"status": "processing", "progress": 5, "message": "Initiating save sequence..."}
        _check_task_cancelled(task_id)
        task_store[task_id].update({"progress": 15, "message": "Compressing and writing CSV data..."})
        result_filename = f"result_{uuid.uuid4().hex}.zip"
        file_path = os.path.join("results", result_filename)
        
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
                INSERT INTO collections (name, config, result_csv)
                VALUES ($1, $2, $3)
                ON CONFLICT (name) DO UPDATE
                    SET config = EXCLUDED.config,
                        result_csv = EXCLUDED.result_csv
                """,
                collection_name,
                json.dumps(config),
                result_filename,
            )
        
        _check_task_cancelled(task_id)
        task_store[task_id] = {"status": "completed", "progress": 100, "message": "Collection saved successfully!"}
        logger.info(f"Background: Collection '{collection_name}' persisted to database")
    except Exception as e:
        if task_store.get(task_id, {}).get("status") == "cancelled":
            logger.info(f"Background operation {task_id} successfully halted.")
            return
        logger.error(f"Background Save Failed for {collection_name}: {e}")
        task_store[task_id] = {"status": "failed", "error": str(e)}

@app.post("/collections")
async def save_collection(collection: CollectionSchema, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    if collection.result_id and collection.result_id in storage:
        df = storage[collection.result_id]
        task_store[task_id] = {"status": "queued", "progress": 0, "message": "Queuing save operation..."}
        background_tasks.add_task(_perform_background_save, task_id, collection.name, collection.config, df)
        return {"task_id": task_id}
    
    # If no result id, just save metadata (fast)
    async with pg_pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO collections (name, config) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET config = EXCLUDED.config",
            collection.name, json.dumps(collection.config)
        )
    return {"message": "Metadata saved successfully"}

@app.get("/collections")
async def get_collections():
    async with pg_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT name, config, (result_csv IS NOT NULL) AS has_result FROM collections"
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
async def delete_collection(name: str):
    async with pg_pool.acquire() as conn:
        result = await conn.execute("DELETE FROM collections WHERE name = $1", name)
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
async def download_collection_result(name: str):
    async with pg_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT result_csv FROM collections WHERE name = $1", name
        )
    if not row or not row["result_csv"]:
        raise HTTPException(status_code=404, detail="Result not found or not yet generated")

    file_path = os.path.join("results", row["result_csv"])
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
#  Join Engine
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
def _perform_background_join(task_id: str, file_a_id: str, file_b_id: str, keys_a: List[str], keys_b: List[str], join_type: str, transforms: Optional[JoinTransformations]):
    try:
        _check_task_cancelled(task_id)
        task_store[task_id] = {"status": "processing", "progress": 5, "message": "Preparing work area..."}
        _check_task_cancelled(task_id)
        task_store[task_id].update({"progress": 15, "message": "Accessing source datasets..."})
        _check_task_cancelled(task_id)
        df_a = load_dataframe(file_a_id)
        df_b = load_dataframe(file_b_id)
        
        _check_task_cancelled(task_id)
        task_store[task_id].update({"progress": 30, "message": "Performing join logic..."})
        
        df_a = df_a.copy()
        df_b = df_b.copy()

        if join_type == "append":
            common_columns = list(set(df_a.columns) & set(df_b.columns))
            merged_df = pd.concat([df_a[common_columns], df_b[common_columns]], ignore_index=True)
        elif join_type == "left_anti":
            merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how="left", indicator=True, suffixes=("_fileA", "_fileB"))
            merged_df = merged_df[merged_df["_merge"] == "left_only"].drop(columns=["_merge"])
        elif join_type == "right_anti":
            merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how="right", indicator=True, suffixes=("_fileA", "_fileB"))
            merged_df = merged_df[merged_df["_merge"] == "right_only"].drop(columns=["_merge"])
        else:
            merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how=join_type, suffixes=("_fileA", "_fileB"))

        _check_task_cancelled(task_id)
        task_store[task_id].update({"progress": 60, "message": "Applying transformations..."})
        # ... (Transformation logic simplified here, reusing existing code logic)
        # Note: I will keep the actual transformation code from the existing function
        
        # (Re-inserting the actual logic from join_data below in multi_replace)
        
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
        
        if len(merged_df) > max(len(df_a), len(df_b)) * 2 and len(merged_df) > 1000:
            logger.warning(f"JOIN EXPLOSION: {len(merged_df)} rows generated.")

        metrics = {
            "match_rate_a": round(len(merged_df) / len(df_a) * 100, 2) if len(df_a) > 0 else 0,
            "match_rate_b": round(len(merged_df) / len(df_b) * 100, 2) if len(df_b) > 0 else 0,
            "null_count": int(merged_df.isnull().sum().sum()),
            "duplicate_count": int(merged_df.duplicated().sum()),
        }

        result_id = str(uuid.uuid4())
        storage[result_id] = merged_df
        
        task_store[task_id] = {
            "status": "completed",
            "progress": 100,
            "result": {
                "result_id": result_id,
                "row_count": len(merged_df),
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
):
    task_id = str(uuid.uuid4())
    task_store[task_id] = {"status": "queued", "progress": 0, "message": "Waiting for worker..."}
    background_tasks.add_task(
        _perform_background_join,
        task_id, file_a_id, file_b_id, keys_a, keys_b, join_type, transforms
    )
    return {"task_id": task_id}


# ═══════════════════════════════════════════════════════════════════════
#  Preview / Download
# ═══════════════════════════════════════════════════════════════════════

@app.get("/preview/{result_id}")
async def get_preview(result_id: str):
    try:
        df = load_dataframe(result_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Result not found")

    preview_df = df.head(50).fillna("")
    return {
        "data": preview_df.to_dict(orient="records"),
        "columns": preview_df.columns.tolist(),
    }

@app.get("/download/{result_id}")
async def download_result(result_id: str, filename: Optional[str] = Query(None)):
    try:
        df = load_dataframe(result_id)
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

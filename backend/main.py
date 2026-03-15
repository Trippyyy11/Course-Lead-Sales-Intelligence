import io
import uuid
import json
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import os
from datetime import datetime, timedelta
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

# ─── Supabase PostgreSQL ────────────────────────────────────────────
SUPABASE_DB_URL = (
    "postgresql://postgres:kk8381059274"
    "@db.bwxybtdvusdibktcxcww.supabase.co:5432/postgres"
)
pg_pool: Optional[asyncpg.Pool] = None

# ─── Auth Configuration ─────────────────────────────────────────────
SECRET_KEY = "dataforge_super_secret_key"
ALGORITHM = "HS256"
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
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "triippyyy11@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "dimh qcmz gxnt iegg")

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
        print(f"--- DEVELOPMENT MODE OTP for {to_email} : {otp} ---")

# ═══════════════════════════════════════════════════════════════════════
#  FastAPI App
# ═══════════════════════════════════════════════════════════════════════
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-Memory Stores ───────────────────────────────────────────────
# file_store: {file_id: {"id", "name", "columns"}}
file_store: Dict[str, dict] = {}
# storage: {file_id: DataFrame}   (also holds join result DataFrames)
storage: Dict[str, pd.DataFrame] = {}

# ─── Startup / Shutdown ─────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global pg_pool
    pg_pool = await asyncpg.create_pool(SUPABASE_DB_URL, min_size=2, max_size=10)
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
        expires_at = datetime.utcnow() + timedelta(minutes=5)

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
        if datetime.utcnow() > otp_record["expires_at"].replace(tzinfo=None):
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
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
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

@app.post("/collections")
async def save_collection(collection: CollectionSchema):
    result_csv: Optional[str] = None

    if collection.result_id and collection.result_id in storage:
        df = storage[collection.result_id]
        buf = io.StringIO()
        df.to_csv(buf, index=False)
        result_csv = buf.getvalue()

    async with pg_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO collections (name, config, result_csv)
            VALUES ($1, $2, $3)
            ON CONFLICT (name) DO UPDATE
                SET config = EXCLUDED.config,
                    result_csv = EXCLUDED.result_csv
            """,
            collection.name,
            json.dumps(collection.config),
            result_csv,
        )
    return {"message": f"Collection '{collection.name}' saved successfully"}

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

@app.get("/collections/download/{name}")
async def download_collection_result(name: str):
    async with pg_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT result_csv FROM collections WHERE name = $1", name
        )
    if not row or not row["result_csv"]:
        raise HTTPException(status_code=404, detail="Result file not found for this collection")

    return StreamingResponse(
        iter([row["result_csv"]]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{name}_result.csv"'},
    )

# ═══════════════════════════════════════════════════════════════════════
#  Join Engine
# ═══════════════════════════════════════════════════════════════════════

@app.post("/join")
async def join_data(
    file_a_id: str = Query(...),
    file_b_id: str = Query(...),
    keys_a: Optional[List[str]] = Query(None),
    keys_b: Optional[List[str]] = Query(None),
    join_type: str = Query("inner"),
    transforms: Optional[JoinTransformations] = None,
):
    try:
        df_a = load_dataframe(file_a_id)
        df_b = load_dataframe(file_b_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    if join_type != "append" and (not keys_a or not keys_b or len(keys_a) != len(keys_b)):
        raise HTTPException(
            status_code=400,
            detail="Keys missing or count mismatch between File A and File B",
        )

    df_a = df_a.copy()
    df_b = df_b.copy()

    if join_type != "append":
        for ka in keys_a:
            if ka not in df_a.columns:
                raise HTTPException(status_code=400, detail=f"Key {ka} not found in File A")
        for kb in keys_b:
            if kb not in df_b.columns:
                raise HTTPException(status_code=400, detail=f"Key {kb} not found in File B")
        for ka in keys_a:
            df_a[ka] = df_a[ka].astype(str)
        for kb in keys_b:
            df_b[kb] = df_b[kb].astype(str)

    try:
        if join_type == "append":
            common_columns = [col for col in df_a.columns if col in df_b.columns]
            if not common_columns:
                raise HTTPException(
                    status_code=400,
                    detail="No common columns found to append on.",
                )
            merged_df = pd.concat(
                [
                    df_a[common_columns].reset_index(drop=True),
                    df_b[common_columns].reset_index(drop=True),
                ],
                ignore_index=True,
            )
        elif join_type == "left_anti":
            merged_df = pd.merge(
                df_a, df_b,
                left_on=keys_a, right_on=keys_b,
                how="left", indicator=True,
                suffixes=("_fileA", "_fileB"),
            )
            merged_df = merged_df[merged_df["_merge"] == "left_only"].drop(columns=["_merge"])
        elif join_type == "right_anti":
            merged_df = pd.merge(
                df_a, df_b,
                left_on=keys_a, right_on=keys_b,
                how="right", indicator=True,
                suffixes=("_fileA", "_fileB"),
            )
            merged_df = merged_df[merged_df["_merge"] == "right_only"].drop(columns=["_merge"])
        else:
            merged_df = pd.merge(
                df_a, df_b,
                left_on=keys_a, right_on=keys_b,
                how=join_type,
                suffixes=("_fileA", "_fileB"),
            )

        # ── Transformations ──────────────────────────────────────────
        if transforms:
            if transforms.cast:
                for col, dtype in transforms.cast.items():
                    if col in merged_df.columns:
                        try:
                            if "datetime" in dtype:
                                merged_df[col] = pd.to_datetime(merged_df[col], errors="coerce")
                            else:
                                merged_df[col] = merged_df[col].astype(dtype)
                        except Exception as cast_err:
                            logger.warning(f"Cast {col}→{dtype}: {cast_err}")

            if transforms.rename:
                valid = {o: n for o, n in transforms.rename.items() if o in merged_df.columns}
                if valid:
                    merged_df = merged_df.rename(columns=valid)

            if transforms.drop:
                to_drop = []
                for col in transforms.drop:
                    if col in merged_df.columns:
                        to_drop.append(col)
                    for sfx in ("_fileA", "_fileB"):
                        sc = f"{col}{sfx}"
                        if sc in merged_df.columns:
                            to_drop.append(sc)
                if to_drop:
                    merged_df = merged_df.drop(columns=list(set(to_drop)))

        metrics = {
            "match_rate_a": round(len(merged_df) / len(df_a) * 100, 2) if len(df_a) > 0 else 0,
            "match_rate_b": round(len(merged_df) / len(df_b) * 100, 2) if len(df_b) > 0 else 0,
            "null_count": int(merged_df.isnull().sum().sum()),
            "duplicate_count": int(merged_df.duplicated().sum()),
        }

        result_id = str(uuid.uuid4())
        storage[result_id] = merged_df

        return {
            "result_id": result_id,
            "row_count": len(merged_df),
            "columns": merged_df.columns.tolist(),
            "metrics": metrics,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Join failed: {str(e)}")

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
async def download_result(result_id: str):
    try:
        df = load_dataframe(result_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Result not found")

    stream = io.StringIO()
    df.to_csv(stream, index=False)

    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=joined_data_{result_id}.csv"},
    )

# ═══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

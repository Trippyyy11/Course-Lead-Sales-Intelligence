import io
import uuid
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import motor.motor_asyncio
import os
from datetime import datetime, timedelta
import random
import jwt
import bcrypt
from email.message import EmailMessage
import aiosmtplib
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from bson import ObjectId

# Auth Configuration
SECRET_KEY = "dataforge_super_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

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

# SMTP Configuration (configure via Env or defaults)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "triippyyy11@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "dimh qcmz gxnt iegg")

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

async def send_otp_email(to_email: str, otp: str):
    print(f"DEBUG: Starting send_otp_email for {to_email}")
    message = EmailMessage()
    message.set_content(f"Welcome to DataForge! Your verification code is: {otp}\nThis code expires in 5 minutes.")
    message["Subject"] = "DataForge - Your Activation Code"
    message["From"] = SMTP_USERNAME
    message["To"] = to_email

    try:
        print(f"DEBUG: Connecting to {SMTP_SERVER}:{SMTP_PORT}...")
        await aiosmtplib.send(
            message,
            hostname=SMTP_SERVER,
            port=SMTP_PORT,
            start_tls=True,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
            timeout=10
        )
        print(f"SUCCESS: OTP email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {type(e).__name__}: {e}")
        # In DEV: we silently fail email printing it to console instead so the user can still test the flow
        print(f"--- DEVELOPMENT MODE OTP for {to_email} : {otp} ---")

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = "mongodb+srv://truptiudawant11_db_user:daBrnE8USaXAlsLa@cluster0.yvzlvyw.mongodb.net/"
client = None
db = None
fs = None

@app.middleware("http")
async def init_db_middleware(request, call_next):
    global client, db, fs
    if client is None:
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
        db = client.pipeline_db
        fs = motor.motor_asyncio.AsyncIOMotorGridFSBucket(db)
    response = await call_next(request)
    return response

storage: Dict[str, pd.DataFrame] = {}


# --- Authentication Routes ---

@app.post("/auth/request-otp")
async def request_otp(data: AuthSignupRequest, background_tasks: BackgroundTasks):
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
        
    existing_user = await db.users.find_one({"email": data.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered")

    otp = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=5)
    
    await db.otps.update_one(
        {"email": data.email.lower()},
        {"$set": {"otp": otp, "expires_at": expires_at}},
        upsert=True
    )
    
    # Send email in background using FastAPI's BackgroundTasks
    background_tasks.add_task(send_otp_email, data.email.lower(), otp)
    
    # In case SMTP is not configured properly, print to console to ensure testability
    print(f"--- DEV OTP FOR {data.email.lower()} IS: {otp} ---")
    
    return {"message": "OTP sent to your email"}

@app.post("/auth/verify-signup")
async def verify_signup(data: AuthVerifySignup):
    email_lower = data.email.lower()
    otp_record = await db.otps.find_one({"email": email_lower})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP requested for this email")
        
    if otp_record["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    if datetime.utcnow() > otp_record["expires_at"]:
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    hashed_pass = hash_password(data.password)
    
    user_doc = {
        "email": email_lower,
        "full_name": data.full_name,
        "hashed_password": hashed_pass,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    await db.otps.delete_many({"email": email_lower})
    
    return {"message": "Account created successfully!"}

@app.post("/auth/login")
async def login(data: AuthLoginRequest):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    payload = {
        "sub": user["email"],
        "name": user["full_name"],
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"email": user["email"], "name": user["full_name"]}
    }

# --- Core API Routes ---

class CollectionSchema(BaseModel):
    name: str
    config: Dict[str, Any]
    result_id: Optional[str] = None

class JoinTransformations(BaseModel):
    drop: Optional[List[str]] = None
    rename: Optional[Dict[str, str]] = None
    cast: Optional[Dict[str, str]] = None

async def load_dataframe(file_id: str) -> pd.DataFrame:
    if file_id in storage:
        return storage[file_id]
    
    try:
        doc = await db.metadata.find_one({"id": file_id})
        if not doc:
            raise ValueError(f"File {file_id} not found locally or in MongoDB")
        
        grid_out = await fs.open_download_stream(doc["grid_id"])
        content = await grid_out.read()
        
        if doc["name"].endswith(".csv"):
            return pd.read_csv(io.BytesIO(content))
        elif doc["name"].endswith((".xls", ".xlsx")):
            return pd.read_excel(io.BytesIO(content))
        else:
            return pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise ValueError(f"Failed to load file {file_id}: {str(e)}")

@app.get("/files")
async def get_files():
    files = []
    async for f in db.metadata.find({}, {"_id": 0, "grid_id": 0}):
        if "_id" in f:
            f["_id"] = str(f["_id"])
        if "grid_id" in f:
            f["grid_id"] = str(f["grid_id"])
        files.append(f)
    return {"files": files}

@app.post("/collections")
async def save_collection(collection: CollectionSchema):
    doc = {
        "name": collection.name,
        "config": collection.config
    }
    
    existing = await db.collections.find_one({"name": collection.name})
    if existing and "grid_id" in existing:
        try:
             await fs.delete(existing["grid_id"])
        except Exception:
             pass
             
    if collection.result_id and collection.result_id in storage:
        df = storage[collection.result_id]
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        content_bytes = stream.getvalue().encode('utf-8')
        
        grid_id = await fs.upload_from_stream(
            f"{collection.name}_result.csv",
            content_bytes,
            metadata={"collection": collection.name}
        )
        doc["grid_id"] = grid_id
        
    await db.collections.update_one(
        {"name": collection.name},
        {"$set": doc},
        upsert=True
    )
    return {"message": f"Collection '{collection.name}' saved successfully"}

@app.get("/collections")
async def get_collections():
    cols = []
    async for c in db.collections.find({}, {"_id": 0}):
        if "grid_id" in c:
            c["has_result"] = True
            c["grid_id"] = str(c["grid_id"])
        cols.append(c)
    return {"collections": cols}

@app.delete("/collections/{name}")
async def delete_collection(name: str):
    doc = await db.collections.find_one({"name": name})
    if not doc:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    if "grid_id" in doc:
        try:
             await fs.delete(doc["grid_id"])
        except Exception:
             pass
             
    await db.collections.delete_one({"name": name})
    return {"message": f"Collection '{name}' deleted successfully"}

@app.get("/collections/download/{name}")
async def download_collection_result(name: str):
    doc = await db.collections.find_one({"name": name})
    if not doc or "grid_id" not in doc:
        raise HTTPException(status_code=404, detail="Result file not found for this collection")
        
    try:
        grid_out = await fs.open_download_stream(doc["grid_id"])
        content = await grid_out.read()
        return StreamingResponse(
            iter([content]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=\"{name}_result.csv\""}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch file: {str(e)}")

@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    uploaded_info = []
    for file in files:
        file_id = str(uuid.uuid4())
        content = await file.read()
        
        try:
            if file.filename.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(content))
            elif file.filename.endswith((".xls", ".xlsx")):
                df = pd.read_excel(io.BytesIO(content))
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported file format: {file.filename}")
            
            if df.empty:
                raise HTTPException(status_code=400, detail=f"File {file.filename} is empty.")
            
            grid_id = await fs.upload_from_stream(
                file.filename,
                content,
                metadata={"file_id": file_id}
            )
            
            file_info = {
                "id": file_id,
                "name": file.filename,
                "columns": df.columns.tolist(),
                "grid_id": grid_id
            }
            await db.metadata.insert_one(file_info.copy())
            
            # For frontend response, replace ObjectIds with strings or delete them
            if "grid_id" in file_info:
                file_info["grid_id"] = str(file_info["grid_id"])
            if "_id" in file_info:
                file_info["_id"] = str(file_info["_id"])
                
            uploaded_info.append(file_info)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing {file.filename}: {str(e)}")
            
    return {"message": "Files uploaded successfully", "files": uploaded_info}

@app.get("/columns/{file_id}")
async def get_columns(file_id: str):
    doc = await db.metadata.find_one({"id": file_id})
    if doc:
        return {"columns": doc["columns"]}
    if file_id in storage:
        return {"columns": storage[file_id].columns.tolist()}
    raise HTTPException(status_code=404, detail="File not found")

@app.delete("/file/{file_id}")
async def delete_file(file_id: str):
    if file_id in storage:
        del storage[file_id]
        
    doc = await db.metadata.find_one({"id": file_id})
    if doc:
        try:
             await fs.delete(doc["grid_id"])
        except Exception:
             pass
        await db.metadata.delete_one({"id": file_id})
        
    return {"message": "File deleted successfully"}

@app.post("/join")
async def join_data(
    file_a_id: str = Query(...),
    file_b_id: str = Query(...),
    keys_a: Optional[List[str]] = Query(None),
    keys_b: Optional[List[str]] = Query(None),
    join_type: str = Query("inner"),
    transforms: Optional[JoinTransformations] = None
):
    try:
        df_a = await load_dataframe(file_a_id)
        df_b = await load_dataframe(file_b_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    if join_type != "append" and (not keys_a or not keys_b or len(keys_a) != len(keys_b)):
        raise HTTPException(status_code=400, detail="Keys missing or count mismatch between File A and File B")
    
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
                    detail="No common columns found to append on. Please ensure files share at least one column name."
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
                df_a, 
                df_b, 
                left_on=keys_a, 
                right_on=keys_b, 
                how='left',
                indicator=True,
                suffixes=('_fileA', '_fileB')
            )
            merged_df = merged_df[merged_df['_merge'] == 'left_only'].drop(columns=['_merge'])
        elif join_type == "right_anti":
            merged_df = pd.merge(
                df_a, 
                df_b, 
                left_on=keys_a, 
                right_on=keys_b, 
                how='right',
                indicator=True,
                suffixes=('_fileA', '_fileB')
            )
            merged_df = merged_df[merged_df['_merge'] == 'right_only'].drop(columns=['_merge'])
        else:
            merged_df = pd.merge(
                df_a, 
                df_b, 
                left_on=keys_a, 
                right_on=keys_b, 
                how=join_type,
                suffixes=('_fileA', '_fileB')
            )
        
        if transforms:
            if transforms.cast:
                for col, dtype in transforms.cast.items():
                    if col in merged_df.columns:
                        try:
                            if "datetime" in dtype:
                                merged_df[col] = pd.to_datetime(merged_df[col], errors='coerce')
                            else:
                                merged_df[col] = merged_df[col].astype(dtype)
                        except Exception as cast_err:
                            print(f"Casting error for column {col} to {dtype}: {str(cast_err)}")
            
            if transforms.rename:
                valid_renames = {old: new for old, new in transforms.rename.items() if old in merged_df.columns}
                if valid_renames:
                    merged_df = merged_df.rename(columns=valid_renames)
            
            if transforms.drop:
                columns_to_drop = []
                for col in transforms.drop:
                    if col in merged_df.columns:
                        columns_to_drop.append(col)
                    
                    for suffix in ['_fileA', '_fileB']:
                        suffixed_col = f"{col}{suffix}"
                        if suffixed_col in merged_df.columns:
                            columns_to_drop.append(suffixed_col)
                
                if columns_to_drop:
                    merged_df = merged_df.drop(columns=list(set(columns_to_drop)))
        
        metrics = {
            "match_rate_a": round(len(merged_df) / len(df_a) * 100, 2) if len(df_a) > 0 else 0,
            "match_rate_b": round(len(merged_df) / len(df_b) * 100, 2) if len(df_b) > 0 else 0,
            "null_count": int(merged_df.isnull().sum().sum()),
            "duplicate_count": int(merged_df.duplicated().sum())
        }

        result_id = str(uuid.uuid4())
        storage[result_id] = merged_df
        
        return {
            "result_id": result_id,
            "row_count": len(merged_df),
            "columns": merged_df.columns.tolist(),
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Join failed: {str(e)}")

@app.get("/preview/{result_id}")
async def get_preview(result_id: str):
    try:
        df = await load_dataframe(result_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail="Result not found")
    
    preview_df = df.head(50).fillna("") 
    return {
        "data": preview_df.to_dict(orient="records"),
        "columns": preview_df.columns.tolist()
    }

@app.get("/download/{result_id}")
async def download_result(result_id: str):
    try:
        df = await load_dataframe(result_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail="Result not found")
    
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=joined_data_{result_id}.csv"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


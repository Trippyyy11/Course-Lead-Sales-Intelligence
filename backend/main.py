import io
import uuid
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for DataFrames
# In a production app, use a proper session/cache store like Redis
storage: Dict[str, pd.DataFrame] = {}
metadata: Dict[str, Dict[str, Any]] = {}

@app.get("/files")
async def get_files():
    return {"files": list(metadata.values())}

collections: Dict[str, Dict[str, Any]] = {}

class CollectionSchema(BaseModel):
    name: str
    config: Dict[str, Any]

class JoinTransformations(BaseModel):
    drop: Optional[List[str]] = None
    rename: Optional[Dict[str, str]] = None
    cast: Optional[Dict[str, str]] = None

@app.get("/collections")
async def get_collections():
    return {"collections": list(collections.values())}

@app.post("/collections")
async def save_collection(collection: CollectionSchema):
    collections[collection.name] = collection.dict()
    return {"message": f"Collection '{collection.name}' saved successfully"}

@app.delete("/collections/{name}")
async def delete_collection(name: str):
    if name not in collections:
        raise HTTPException(status_code=404, detail="Collection not found")
    del collections[name]
    return {"message": f"Collection '{name}' deleted successfully"}

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
            
            storage[file_id] = df
            file_info = {
                "id": file_id,
                "name": file.filename,
                "columns": df.columns.tolist()
            }
            metadata[file_id] = file_info
            uploaded_info.append(file_info)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing {file.filename}: {str(e)}")
            
    return {"message": "Files uploaded successfully", "files": uploaded_info}

@app.get("/columns/{file_id}")
async def get_columns(file_id: str):
    if file_id not in storage:
        raise HTTPException(status_code=404, detail="File not found")
    return {"columns": storage[file_id].columns.tolist()}

@app.delete("/file/{file_id}")
async def delete_file(file_id: str):
    if file_id not in storage:
        raise HTTPException(status_code=404, detail="File not found")
    del storage[file_id]
    if file_id in metadata:
        del metadata[file_id]
    return {"message": "File deleted successfully"}




# Join logic continues...

@app.post("/join")
async def join_data(
    file_a_id: str = Query(...),
    file_b_id: str = Query(...),
    keys_a: Optional[List[str]] = Query(None),
    keys_b: Optional[List[str]] = Query(None),
    join_type: str = Query("inner"),
    transforms: Optional[JoinTransformations] = None
):
    if file_a_id not in storage or file_b_id not in storage:
        raise HTTPException(status_code=404, detail="One or more files not found")
    
    if join_type != "append" and (not keys_a or not keys_b or len(keys_a) != len(keys_b)):
        raise HTTPException(status_code=400, detail="Keys missing or count mismatch between File A and File B")
    
    df_a = storage[file_a_id].copy()
    df_b = storage[file_b_id].copy()
    
    # Check all keys exist if not append
    if join_type != "append":
        for ka in keys_a:
            if ka not in df_a.columns:
                raise HTTPException(status_code=400, detail=f"Key {ka} not found in File A")
        for kb in keys_b:
            if kb not in df_b.columns:
                raise HTTPException(status_code=400, detail=f"Key {kb} not found in File B")
        
        # Cast join keys to string
        for ka in keys_a:
            df_a[ka] = df_a[ka].astype(str)
        for kb in keys_b:
            df_b[kb] = df_b[kb].astype(str)
    
    try:
        if join_type == "append":
            # Append rows from both files using only the shared columns
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
        else:
            merged_df = pd.merge(
                df_a, 
                df_b, 
                left_on=keys_a, 
                right_on=keys_b, 
                how=join_type,
                suffixes=('_fileA', '_fileB')
            )
        
        # Apply Transformations
        if transforms:
            if transforms.cast:
                for col, dtype in transforms.cast.items():
                    if col in merged_df.columns:
                        try:
                            # Handle datetime strings specifically if needed
                            if "datetime" in dtype:
                                merged_df[col] = pd.to_datetime(merged_df[col], errors='coerce')
                            else:
                                merged_df[col] = merged_df[col].astype(dtype)
                        except Exception as cast_err:
                            print(f"Casting error for column {col} to {dtype}: {str(cast_err)}")
                            # Optional: raise error if casting is critical
            
            if transforms.rename:
                # Filter to only existing columns to prevent pandas errors
                valid_renames = {old: new for old, new in transforms.rename.items() if old in merged_df.columns}
                if valid_renames:
                    merged_df = merged_df.rename(columns=valid_renames)
            
            if transforms.drop:
                # Handle dropping columns, including those that might have suffixes after join
                columns_to_drop = []
                for col in transforms.drop:
                    if col in merged_df.columns:
                        columns_to_drop.append(col)
                    
                    # Also check for suffixed versions created by pandas join
                    for suffix in ['_fileA', '_fileB']:
                        suffixed_col = f"{col}{suffix}"
                        if suffixed_col in merged_df.columns:
                            columns_to_drop.append(suffixed_col)
                
                if columns_to_drop:
                    # Use set to avoid double-dropping if names overlap
                    merged_df = merged_df.drop(columns=list(set(columns_to_drop)))
        
        # Calculate Health Metrics
        metrics = {
            "match_rate_a": round(len(merged_df) / len(df_a) * 100, 2) if len(df_a) > 0 else 0,
            "match_rate_b": round(len(merged_df) / len(df_b) * 100, 2) if len(df_b) > 0 else 0,
            "null_count": int(merged_df.isnull().sum().sum()),
            "duplicate_count": int(merged_df.duplicated().sum())
        }

        # Store the result for preview and download
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
    if result_id not in storage:
        raise HTTPException(status_code=404, detail="Result not found")
    
    df = storage[result_id]
    preview_df = df.head(50).fillna("") # Handle NaN values
    return {
        "data": preview_df.to_dict(orient="records"),
        "columns": preview_df.columns.tolist()
    }

@app.get("/download/{result_id}")
async def download_result(result_id: str):
    if result_id not in storage:
        raise HTTPException(status_code=404, detail="Result not found")
    
    df = storage[result_id]
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

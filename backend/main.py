import io
import uuid
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional

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
            uploaded_info.append({
                "id": file_id,
                "name": file.filename,
                "columns": df.columns.tolist()
            })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing {file.filename}: {str(e)}")
            
    return {"message": "Files uploaded successfully", "files": uploaded_info}

@app.get("/columns/{file_id}")
async def get_columns(file_id: str):
    if file_id not in storage:
        raise HTTPException(status_code=404, detail="File not found")
    return {"columns": storage[file_id].columns.tolist()}

@app.post("/join")
async def join_data(
    file_a_id: str,
    file_b_id: str,
    key_a: str,
    key_b: str,
    join_type: str = "inner"
):
    if file_a_id not in storage or file_b_id not in storage:
        raise HTTPException(status_code=404, detail="One or more files not found")
    
    df_a = storage[file_a_id].copy()
    df_b = storage[file_b_id].copy()
    
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
            if key_a not in df_a.columns or key_b not in df_b.columns:
                raise HTTPException(status_code=400, detail="Join keys not found in respective files")
            
            # Cast join keys to string to prevent type mismatch failures
            df_a[key_a] = df_a[key_a].astype(str)
            df_b[key_b] = df_b[key_b].astype(str)
            merged_df = pd.merge(
                df_a, 
                df_b, 
                left_on=key_a, 
                right_on=key_b, 
                how=join_type,
                suffixes=('_fileA', '_fileB')
            )
        
        # Store the result for preview and download
        result_id = str(uuid.uuid4())
        storage[result_id] = merged_df
        
        return {
            "result_id": result_id,
            "row_count": len(merged_df),
            "columns": merged_df.columns.tolist()
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

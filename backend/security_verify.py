import requests

BASE_URL = "http://127.0.0.1:8000"

def test_unauthorized(endpoint, method="GET"):
    url = f"{BASE_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            response = requests.get(url)
        elif method.upper() == "POST":
            response = requests.post(url)
        elif method.upper() == "DELETE":
            response = requests.delete(url)
        
        # FastAPI HTTPBearer returns 403 Forbidden if Header is missing
        if response.status_code in [401, 403]:
            print(f"[PASS] {method} {endpoint} -> {response.status_code} (Blocked)")
        else:
            print(f"[FAIL] {method} {endpoint} -> {response.status_code} (Bypassed!)")
    except Exception as e:
        print(f"[ERROR] {method} {endpoint} -> {e}")

if __name__ == "__main__":
    endpoints = [
        ("/files", "GET"),
        ("/upload", "POST"),
        ("/columns/test", "GET"),
        ("/file/test", "DELETE"),
        ("/files/clear", "DELETE"),
        ("/collections", "GET"),
        ("/collections", "POST"),
        ("/collections/test", "DELETE"),
        ("/tasks/test", "DELETE"),
        ("/collections/download/test", "GET"),
        ("/tasks/test", "GET"),
        ("/join", "POST"),
        ("/preview/test", "GET"),
        ("/download/test", "GET"),
    ]
    
    print("Security Verification Run:")
    for endpoint, method in endpoints:
        test_unauthorized(endpoint, method)

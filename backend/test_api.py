import requests

def test_backend():
    try:
        resp = requests.get("http://localhost:8000/docs")
        if resp.status_code == 200:
            print("Backend is UP and serving docs.")
        else:
            print(f"Backend returned status code: {resp.status_code}")
    except Exception as e:
        print(f"Backend unreachable: {e}")

if __name__ == "__main__":
    test_backend()

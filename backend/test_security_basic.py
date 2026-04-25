import urllib.request
import urllib.error

def test_protected_route():
    try:
        req = urllib.request.Request("http://127.0.0.1:8000/auth/me")
        res = urllib.request.urlopen(req)
        print("FAIL: Expected 401 Unauthorized for /auth/me")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print("PASS: /auth/me successfully blocked unauthenticated request")
        else:
            print(f"FAIL: Unexpected error {e.code}")

if __name__ == "__main__":
    test_protected_route()

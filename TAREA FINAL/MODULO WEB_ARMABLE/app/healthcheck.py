import os
import urllib.request

if __name__=='__main__':
    port=int(os.getenv('PORT','8000'))
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/health',timeout=3) as response:
        if response.status!=200:
            raise SystemExit(1)

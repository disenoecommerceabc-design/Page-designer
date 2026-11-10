"""Portable PID-1 entrypoint for Docker, Heroku and Cloud Run."""
import os
import sys

def command():
    try:
        port=int(os.getenv('PORT','8000'))
        if not 1<=port<=65535:
            raise ValueError
    except ValueError:
        raise SystemExit('PORT debe ser un entero entre 1 y 65535.')
    return [sys.executable,'-m','uvicorn','app.main:app','--host','0.0.0.0','--port',str(port),
            '--workers','1','--limit-concurrency','16','--timeout-keep-alive','5',
            '--proxy-headers','--forwarded-allow-ips',os.getenv('FORWARDED_ALLOW_IPS','127.0.0.1')]

if __name__=='__main__':
    args=command()
    os.execvp(args[0],args)

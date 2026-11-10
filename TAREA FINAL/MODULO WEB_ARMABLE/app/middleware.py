from starlette.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

def is_health_probe(scope):
    return scope['type']=='http' and scope['path']=='/health' and scope['method']=='GET'

class HostMiddleware(TrustedHostMiddleware):
    """Platform health probes may use a local host; application routes stay checked."""
    async def __call__(self, scope, receive, send):
        if is_health_probe(scope):
            return await self.app(scope,receive,send)
        return await super().__call__(scope,receive,send)

class ProductionHTTPSMiddleware(HTTPSRedirectMiddleware):
    async def __call__(self, scope, receive, send):
        if is_health_probe(scope):
            return await self.app(scope,receive,send)
        return await super().__call__(scope,receive,send)

class BodyLimitMiddleware:
    """Bound request bodies, including chunked uploads without Content-Length."""
    def __init__(self, app, limit=9 * 1024 * 1024):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['method'] not in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return await self.app(scope, receive, send)
        chunks = []
        total = 0
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            chunk = message.get('body', b'')
            total += len(chunk)
            if total > self.limit:
                response = JSONResponse({'detail': 'La solicitud supera el límite de 9 MB.'}, status_code=413)
                return await response(scope, receive, send)
            chunks.append(message)
            if not message.get('more_body', False):
                break
        iterator = iter(chunks)
        async def replay():
            return next(iterator, {'type': 'http.request', 'body': b'', 'more_body': False})
        await self.app(scope, replay, send)

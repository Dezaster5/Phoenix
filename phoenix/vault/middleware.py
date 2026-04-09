from django.conf import settings


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        content_security_policy = getattr(settings, "CONTENT_SECURITY_POLICY", "").strip()
        if content_security_policy:
            response.setdefault("Content-Security-Policy", content_security_policy)

        permissions_policy = getattr(settings, "PERMISSIONS_POLICY", "").strip()
        if permissions_policy:
            response.setdefault("Permissions-Policy", permissions_policy)

        return response

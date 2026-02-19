from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginBurstThrottle(AnonRateThrottle):
    scope = "login_burst"


class LoginSustainedThrottle(AnonRateThrottle):
    scope = "login_sustained"


class AccessRequestCreateThrottle(UserRateThrottle):
    scope = "access_request_create"

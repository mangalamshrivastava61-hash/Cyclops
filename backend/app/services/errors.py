"""Domain errors. Routers translate them into HTTP responses (see app.main)."""


class NotFound(Exception):
    """A record does not exist (404)."""


class Conflict(Exception):
    """The request is valid but the record's current state does not allow it (409)."""

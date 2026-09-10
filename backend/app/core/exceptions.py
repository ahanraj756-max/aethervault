from fastapi import HTTPException, status

class AetherVaultException(Exception):
    def __init__(self, status_code: int, message: str, error_code: str):
        self.status_code = status_code
        self.message = message
        self.error_code = error_code
        super().__init__(message)

class AuthException(AetherVaultException):
    def __init__(self, message: str = "Invalid credentials", status_code: int = status.HTTP_401_UNAUTHORIZED):
        super().__init__(
            status_code=status_code,
            message=message,
            error_code="AUTH_ERROR"
        )

class ForbiddenException(AetherVaultException):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            message=message,
            error_code="FORBIDDEN"
        )

class NotFoundException(AetherVaultException):
    def __init__(self, message: str = "Resource not found", error_code: str = "NOT_FOUND"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            message=message,
            error_code=error_code
        )

class QuotaExceededException(AetherVaultException):
    def __init__(self, message: str = "Storage quota exceeded"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            message=message,
            error_code="QUOTA_EXCEEDED"
        )

class DuplicateException(AetherVaultException):
    def __init__(self, message: str = "File already exists in this folder"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            message=message,
            error_code="DUPLICATE_FILE"
        )

class PathTraversalException(AetherVaultException):
    def __init__(self, message: str = "Path traversal detected"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            message=message,
            error_code="PATH_TRAVERSAL"
        )

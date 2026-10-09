from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        # Detailed exception logging belongs in the application logger.
        # Do not expose internal exception details to API clients.
        logger = request.app.state.logger
        logger.exception(
            "unhandled_exception",
            extra={"request_id": request.state.request_id},
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred.",
                    "request_id": request.state.request_id,
                }
            },
        )

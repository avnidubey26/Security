import logging
import sys


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True


def configure_logging() -> logging.Logger:
    logger = logging.getLogger("security")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.propagate = False

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s "
            "request_id=%(request_id)s %(message)s"
        )
    )
    handler.addFilter(RequestIdFilter())
    logger.addHandler(handler)

    return logger

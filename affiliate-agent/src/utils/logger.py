"""
Structured JSON logging for the AI Affiliate Agent.
Uses structlog for consistent, parseable log output.
"""

import logging
import sys
import structlog


def setup_logging(level: str = "INFO") -> None:
    """Configure structlog with JSON output and standard log levels."""
    log_level = getattr(logging, level.upper(), logging.INFO)

    # Standard library logging setup
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    # structlog processors chain
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    """Return a named structlog logger instance.

    Args:
        name: Module or component name (e.g. 'researcher', 'content_gen').

    Returns:
        Configured BoundLogger with 'module' context key.
    """
    return structlog.get_logger(module=name)


# Initialise with sensible defaults when module is imported
setup_logging()

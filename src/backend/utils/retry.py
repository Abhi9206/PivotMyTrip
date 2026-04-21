"""
NomadAI Retry Utilities - Exponential backoff helpers for async operations
"""
import asyncio
import logging
from typing import Callable, TypeVar, Optional, Any

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def retry_async(
    func: Callable,
    *args,
    retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exceptions: tuple = (Exception,),
    **kwargs,
) -> Any:
    """
    Retry an async function with exponential backoff.

    Args:
        func: Async callable to retry
        *args: Positional arguments for func
        retries: Maximum number of retry attempts (default 3)
        base_delay: Initial delay in seconds (default 1.0)
        max_delay: Maximum delay cap in seconds (default 30.0)
        exceptions: Tuple of exception types to catch (default all)
        **kwargs: Keyword arguments for func

    Returns:
        Result of func on success

    Raises:
        Last exception if all retries exhausted
    """
    last_exc: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            return await func(*args, **kwargs)
        except exceptions as e:
            last_exc = e
            if attempt >= retries:
                break
            delay = min(base_delay * (2 ** attempt), max_delay)
            logger.warning(
                "Attempt %d/%d failed for %s: %s. Retrying in %.1fs...",
                attempt + 1, retries + 1, getattr(func, "__name__", str(func)), e, delay
            )
            await asyncio.sleep(delay)
    raise last_exc

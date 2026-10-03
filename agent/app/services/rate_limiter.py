import time

from redis.exceptions import RedisError

from config import redis_client, settings


class RateLimitExceeded(Exception):
    pass

class RateLimiter:
    def __init__(
        self,
        redis_client,
        window: int,
    ) -> None:
        self.redis = redis_client
        self.window = window

    def check(
        self,
        key: str,
        limit: int,
    ) -> None:
        current_time = int(time.time())
        window_key = (
            f"inquira:rate:{key}:{current_time // self.window}"
        )

        try:
            with self.redis.pipeline() as pipe:
                pipe.incr(window_key)
                pipe.expire(
                    window_key,
                    self.window,
                )

                result = pipe.execute()

        except RedisError as err:
            raise RuntimeError(
                "Rate limiting service is unavailable."
            ) from err

        request_count = int(result[0])

        if request_count > limit:
            raise RateLimitExceeded(
                f"Rate limit exceeded. "
                f"Maximum {limit} requests are allowed "
                f"per {self.window} seconds."
            )

rate_limiter: RateLimiter = RateLimiter(
    redis_client=redis_client,
    window=settings.RATE_LIMIT_WINDOW,
)
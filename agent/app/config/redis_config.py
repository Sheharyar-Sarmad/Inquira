from redis import Redis
from .settings import settings

redis_client: Redis = Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    username=settings.REDIS_USERNAME,
    password=settings.REDIS_PASSWORD,
    db=settings.REDIS_DB,
    decode_responses=True,
)

if __name__ == "__main__":
    try:
        redis_client.ping()
        print("Redis connection successful!")

        redis_client.set(
            "inquira:test",
            "Redis is working!",
        )

        value = redis_client.get("inquira:test")

        print(f"Redis test value: {value}")

        redis_client.delete("inquira:test")

        print("Redis read/write test successful!")

    except Exception as err:
        print(f"Redis connection failed: {err}")
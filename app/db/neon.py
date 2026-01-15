import psycopg2
from app.config import DATABASE_URL

def get_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not set")

    return psycopg2.connect(
        DATABASE_URL,
        sslmode="require"
    )

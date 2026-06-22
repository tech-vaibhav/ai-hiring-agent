import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from app.config import DATABASE_URL

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL not set")
        # Initialize pool with min 1 and max 15 connections
        _pool = ThreadedConnectionPool(
            1, 15,
            DATABASE_URL,
            sslmode="require"
        )
    return _pool

class ConnectionProxy:
    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
    
    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)
        
    def commit(self):
        self._conn.commit()
        
    def rollback(self):
        self._conn.rollback()

    def close(self):
        if self._conn and self._pool:
            try:
                self._pool.putconn(self._conn)
            except Exception as e:
                print(f"[ERROR] Failed to return connection to pool: {e}")
            finally:
                self._conn = None
                self._pool = None

def get_connection():
    pool = get_pool()
    conn = pool.getconn()
    # Check connection health and reconnect if closed
    if conn.closed != 0:
        pool.putconn(conn, close=True)
        conn = pool.getconn()
    return ConnectionProxy(conn, pool)


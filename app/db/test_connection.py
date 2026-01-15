from app.db.neon import get_connection

def test_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT 1;")
    print("DB connection successful")
    conn.close()

if __name__ == "__main__":
    test_db()

from psycopg2.extras import Json
from datetime import datetime
from app.db.neon import get_connection


def insert_job_role(
    role_id: str,
    role_title: str,
    must_have_skills: list,
    nice_to_have_skills: list,
    experience_level: str,
    role_type: str,
    created_at: datetime,
) -> None:
    query = """
    INSERT INTO job_roles (
        role_id,
        role_title,
        must_have_skills,
        nice_to_have_skills,
        experience_level,
        role_type,
        created_at
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                query,
                (
                    role_id,
                    role_title,
                    Json(must_have_skills),
                    Json(nice_to_have_skills),
                    experience_level,
                    role_type,
                    created_at,
                ),
            )
            conn.commit()
    finally:
        conn.close()

#CANDIDATE INSERT

def insert_candidate_profile(
    candidate_id: str,
    role_id: str,
    skills: list,
    experience_summary: str,
    projects: list,
    experience_level: str,
    red_flags: list,
    created_at: datetime,
) -> None:
    query = """
    INSERT INTO candidates (
        candidate_id,
        role_id,
        skills,
        experience_summary,
        projects,
        experience_level,
        red_flags,
        created_at
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                query,
                (
                    candidate_id,
                    role_id,
                    Json(skills),
                    experience_summary,
                    Json(projects),
                    experience_level,
                    Json(red_flags),
                    created_at,
                ),
            )
            conn.commit()
    finally:
        conn.close()
        
#Evaluation INSERT

def insert_evaluation(
    candidate_id: str,
    role_id: str,
    fit_score: float,
    decision: str,
    strengths: list,
    gaps: list,
    red_flags: list,
    evaluated_at,
) -> None:
    query = """
    INSERT INTO evaluations (
        candidate_id,
        role_id,
        fit_score,
        decision,
        strengths,
        gaps,
        red_flags,
        evaluated_at
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                query,
                (
                    candidate_id,
                    role_id,
                    fit_score,
                    decision,
                    Json(strengths),
                    Json(gaps),
                    Json(red_flags),
                    evaluated_at,
                ),
            )
            conn.commit()
    finally:
        conn.close()
        
def fetch_job_role(role_id: str) -> dict:
    query = """
    SELECT role_title, must_have_skills, nice_to_have_skills,
           experience_level, role_type
    FROM job_roles
    WHERE role_id = %s
    """

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (role_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError("Job role not found")

            return {
                "role_title": row[0],
                "must_have_skills": row[1],
                "nice_to_have_skills": row[2],
                "experience_level": row[3],
                "role_type": row[4],
            }
    finally:
        conn.close()

def fetch_candidate_profile(candidate_id: str) -> dict:
    query = """
    SELECT skills, experience_summary, projects,
           experience_level, red_flags
    FROM candidates
    WHERE candidate_id = %s
    """

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (candidate_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError("Candidate not found")

            return {
                "skills": row[0],
                "experience_summary": row[1],
                "projects": row[2],
                "experience_level": row[3],
                "red_flags": row[4],
            }
    finally:
        conn.close()

def list_job_roles() -> list:
    query = """
    SELECT role_id, role_title, must_have_skills, nice_to_have_skills, experience_level, role_type, created_at
    FROM job_roles
    ORDER BY created_at DESC
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            return [
                {
                    "role_id": r[0],
                    "role_title": r[1],
                    "must_have_skills": r[2],
                    "nice_to_have_skills": r[3],
                    "experience_level": r[4],
                    "role_type": r[5],
                    "created_at": r[6],
                }
                for r in rows
            ]
    finally:
        conn.close()

def list_candidates() -> list:
    query = """
    SELECT candidate_id, skills, experience_summary, projects, experience_level, red_flags, created_at
    FROM candidates
    ORDER BY created_at DESC
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            return [
                {
                    "candidate_id": r[0],
                    "skills": r[1],
                    "experience_summary": r[2],
                    "projects": r[3],
                    "experience_level": r[4],
                    "red_flags": r[5],
                    "created_at": r[6],
                }
                for r in rows
            ]
    finally:
        conn.close()

def fetch_evaluation(candidate_id: str, role_id: str) -> dict:
    query = """
    SELECT fit_score, decision, strengths, gaps, red_flags, evaluated_at
    FROM evaluations
    WHERE candidate_id = %s AND role_id = %s
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (candidate_id, role_id))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "candidate_id": candidate_id,
                "role_id": role_id,
                "fit_score": row[0],
                "decision": row[1],
                "strengths": row[2],
                "gaps": row[3],
                "red_flags": row[4],
                "evaluated_at": row[5],
            }
    finally:
        conn.close()

def list_evaluations(role_id: str = None, candidate_id: str = None) -> list:
    query = """
    SELECT candidate_id, role_id, fit_score, decision, strengths, gaps, red_flags, evaluated_at
    FROM evaluations
    """
    params = []
    conditions = []
    if role_id:
        conditions.append("role_id = %s")
        params.append(role_id)
    if candidate_id:
        conditions.append("candidate_id = %s")
        params.append(candidate_id)
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += " ORDER BY evaluated_at DESC"
    
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            return [
                {
                    "candidate_id": r[0],
                    "role_id": r[1],
                    "fit_score": r[2],
                    "decision": r[3],
                    "strengths": r[4],
                    "gaps": r[5],
                    "red_flags": r[6],
                    "evaluated_at": r[7],
                }
                for r in rows
            ]
    finally:
        conn.close()

def delete_job_role(role_id: str) -> None:
    query_evals = "DELETE FROM evaluations WHERE role_id = %s"
    query_role = "DELETE FROM job_roles WHERE role_id = %s"
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query_evals, (role_id,))
            cur.execute(query_role, (role_id,))
            conn.commit()
    finally:
        conn.close()

def delete_candidate_profile(candidate_id: str) -> None:
    query_evals = "DELETE FROM evaluations WHERE candidate_id = %s"
    query_cand = "DELETE FROM candidates WHERE candidate_id = %s"
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query_evals, (candidate_id,))
            cur.execute(query_cand, (candidate_id,))
            conn.commit()
    finally:
        conn.close()

def delete_evaluation(candidate_id: str, role_id: str) -> None:
    query = "DELETE FROM evaluations WHERE candidate_id = %s AND role_id = %s"
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (candidate_id, role_id))
            conn.commit()
    finally:
        conn.close()

def create_task(task_id: str, task_type: str, metadata: dict = None) -> None:
    query = """
    INSERT INTO tasks (task_id, task_type, status, metadata, created_at, updated_at)
    VALUES (%s, %s, 'pending', %s, NOW(), NOW())
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (task_id, task_type, Json(metadata) if metadata is not None else None))
            conn.commit()
    finally:
        conn.close()

def update_task(task_id: str, status: str, result: dict = None, error: str = None) -> None:
    query = """
    UPDATE tasks
    SET status = %s, result = %s, error = %s, updated_at = NOW()
    WHERE task_id = %s
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (status, Json(result) if result is not None else None, error, task_id))
            conn.commit()
    finally:
        conn.close()

def fetch_task(task_id: str) -> dict:
    query = """
    SELECT task_id, task_type, status, result, error, created_at, updated_at
    FROM tasks
    WHERE task_id = %s
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (task_id,))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "task_id": row[0],
                "task_type": row[1],
                "status": row[2],
                "result": row[3],
                "error": row[4],
                "created_at": row[5],
                "updated_at": row[6],
            }
    finally:
        conn.close()

def fetch_unevaluated_candidates(role_id: str) -> list:
    query = """
    SELECT candidate_id
    FROM candidates
    WHERE candidate_id NOT IN (
        SELECT candidate_id
        FROM evaluations
        WHERE role_id = %s
    )
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (role_id,))
            rows = cur.fetchall()
            return [r[0] for r in rows]
    finally:
        conn.close()

def fetch_role_candidates_evaluations(role_id: str) -> list:
    query = """
    SELECT c.candidate_id, c.skills, c.experience_summary, c.projects, c.experience_level, c.red_flags, c.created_at,
           e.fit_score, e.decision, e.strengths, e.gaps, e.red_flags, e.evaluated_at
    FROM candidates c
    LEFT JOIN evaluations e ON c.candidate_id = e.candidate_id AND e.role_id = c.role_id
    WHERE c.role_id = %s
    ORDER BY c.created_at DESC
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (role_id,))
            rows = cur.fetchall()
            return [
                {
                    "candidate_id": r[0],
                    "skills": r[1],
                    "experience_summary": r[2],
                    "projects": r[3],
                    "experience_level": r[4],
                    "red_flags": r[5],
                    "created_at": r[6],
                    "evaluation": {
                        "fit_score": r[7],
                        "decision": r[8],
                        "strengths": r[9],
                        "gaps": r[10],
                        "red_flags": r[11],
                        "evaluated_at": r[12]
                    } if r[8] is not None else None
                }
                for r in rows
            ]
    finally:
        conn.close()

def find_active_task_by_metadata(task_type: str, metadata: dict) -> dict:
    query = """
    SELECT task_id, task_type, status, result, error, metadata, created_at, updated_at
    FROM tasks
    WHERE task_type = %s AND status IN ('pending', 'processing')
    """
    params = [task_type]
    conditions = []
    for k, v in metadata.items():
        conditions.append("metadata->>%s = %s")
        params.extend([k, str(v)])
        
    if conditions:
        query += " AND " + " AND ".join(conditions)
        
    query += " ORDER BY created_at DESC LIMIT 1"
    
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "task_id": row[0],
                "task_type": row[1],
                "status": row[2],
                "result": row[3],
                "error": row[4],
                "metadata": row[5],
                "created_at": row[6],
                "updated_at": row[7],
            }
    finally:
        conn.close()

def find_latest_task_by_metadata(task_type: str, metadata: dict) -> dict:
    query = """
    SELECT task_id, task_type, status, result, error, metadata, created_at, updated_at
    FROM tasks
    WHERE task_type = %s
    """
    params = [task_type]
    conditions = []
    for k, v in metadata.items():
        conditions.append("metadata->>%s = %s")
        params.extend([k, str(v)])
        
    if conditions:
        query += " AND " + " AND ".join(conditions)
        
    query += " ORDER BY created_at DESC LIMIT 1"
    
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "task_id": row[0],
                "task_type": row[1],
                "status": row[2],
                "result": row[3],
                "error": row[4],
                "metadata": row[5],
                "created_at": row[6],
                "updated_at": row[7],
            }
    finally:
        conn.close()

def create_user(
    user_id: str,
    first_name: str,
    last_name: str,
    email_id: str,
    password_hash: str,
    gender: str,
    country: str,
    phone_number: str,
    city: str,
    current_company: str,
    designation: str,
    google_id: str = None,
    is_verified: bool = False,
) -> None:
    query = """
    INSERT INTO users (
        user_id, first_name, last_name, email_id, password_hash,
        gender, country, phone_number, city, current_company,
        designation, google_id, is_verified, created_at, updated_at
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
    ON CONFLICT (email_id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        password_hash = EXCLUDED.password_hash,
        gender = EXCLUDED.gender,
        country = EXCLUDED.country,
        phone_number = EXCLUDED.phone_number,
        city = EXCLUDED.city,
        current_company = EXCLUDED.current_company,
        designation = EXCLUDED.designation,
        google_id = EXCLUDED.google_id,
        is_verified = EXCLUDED.is_verified,
        updated_at = NOW()
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                query,
                (
                    user_id, first_name, last_name, email_id, password_hash,
                    gender, country, phone_number, city, current_company,
                    designation, google_id, is_verified
                )
            )
            conn.commit()
    finally:
        conn.close()

def get_user_by_email(email_id: str) -> dict:
    query = """
    SELECT user_id, first_name, last_name, email_id, password_hash,
           gender, country, phone_number, city, current_company,
           designation, google_id, is_verified, created_at, updated_at
    FROM users
    WHERE email_id = %s
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (email_id,))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "user_id": row[0],
                "first_name": row[1],
                "last_name": row[2],
                "email_id": row[3],
                "password_hash": row[4],
                "gender": row[5],
                "country": row[6],
                "phone_number": row[7],
                "city": row[8],
                "current_company": row[9],
                "designation": row[10],
                "google_id": row[11],
                "is_verified": row[12],
                "created_at": row[13],
                "updated_at": row[14]
            }
    finally:
        conn.close()

def get_user_by_google_id(google_id: str) -> dict:
    query = """
    SELECT user_id, first_name, last_name, email_id, password_hash,
           gender, country, phone_number, city, current_company,
           designation, google_id, is_verified, created_at, updated_at
    FROM users
    WHERE google_id = %s
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (google_id,))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "user_id": row[0],
                "first_name": row[1],
                "last_name": row[2],
                "email_id": row[3],
                "password_hash": row[4],
                "gender": row[5],
                "country": row[6],
                "phone_number": row[7],
                "city": row[8],
                "current_company": row[9],
                "designation": row[10],
                "google_id": row[11],
                "is_verified": row[12],
                "created_at": row[13],
                "updated_at": row[14]
            }
    finally:
        conn.close()

def verify_user(email_id: str) -> None:
    query = """
    UPDATE users
    SET is_verified = TRUE, updated_at = NOW()
    WHERE email_id = %s
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (email_id,))
            conn.commit()
    finally:
        conn.close()

def store_otp(user_id: str, email_id: str, otp_code: str, expires_at: datetime) -> None:
    delete_otps_by_user(user_id)
    query = """
    INSERT INTO user_otps (user_id, email_id, otp_code, expires_at)
    VALUES (%s, %s, %s, %s)
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (user_id, email_id, otp_code, expires_at))
            conn.commit()
    finally:
        conn.close()

def fetch_otp_by_user(user_id: str) -> dict:
    query = """
    SELECT user_id, email_id, otp_code, expires_at
    FROM user_otps
    WHERE user_id = %s
    ORDER BY created_at DESC LIMIT 1
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (user_id,))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "user_id": row[0],
                "email_id": row[1],
                "otp_code": row[2],
                "expires_at": row[3]
            }
    finally:
        conn.close()

def delete_otps_by_user(user_id: str) -> None:
    query = "DELETE FROM user_otps WHERE user_id = %s"
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (user_id,))
            conn.commit()
    finally:
        conn.close()


# ==========================================
# DRIVE DB QUERIES
# ==========================================

def insert_drive(drive_id: str, user_id: str, role_id: str) -> None:
    query = """
    INSERT INTO drives (drive_id, user_id, role_id, created_at, updated_at)
    VALUES (%s, %s, %s, NOW(), NOW())
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (drive_id, user_id, role_id))
            conn.commit()
    finally:
        conn.close()


def list_drives_by_user(user_id: str) -> list:
    query = """
    SELECT d.drive_id, d.user_id, d.role_id, d.created_at,
           r.role_title, r.experience_level, r.role_type,
           (SELECT COUNT(*) FROM evaluations e WHERE e.role_id = d.role_id) as candidate_count
    FROM drives d
    JOIN job_roles r ON d.role_id = r.role_id
    WHERE d.user_id = %s
    ORDER BY d.created_at DESC
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (user_id,))
            rows = cur.fetchall()
            return [
                {
                    "drive_id": r[0],
                    "user_id": r[1],
                    "role_id": r[2],
                    "created_at": r[3],
                    "role_title": r[4],
                    "experience_level": r[5],
                    "role_type": r[6],
                    "candidate_count": r[7]
                }
                for r in rows
            ]
    finally:
        conn.close()


def delete_drive(drive_id: str) -> None:
    query = "DELETE FROM drives WHERE drive_id = %s"
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (drive_id,))
            conn.commit()
    finally:
        conn.close()







from app.db.queries import fetch_job_role, fetch_candidate_profile
from app.pipeline.evaluator import evaluate_jd_and_resume

if __name__ == "__main__":
    ROLE_ID = "role_da2026"      # 👈 actual JD role_id
    CANDIDATE_ID = "cand_001"     # 👈 actual resume candidate_id

    # 1️ Fetch structured data from DB
    job_description = fetch_job_role(ROLE_ID)
    candidate_profile = fetch_candidate_profile(CANDIDATE_ID)

    # 2️ Run AI evaluation + store result
    result = evaluate_jd_and_resume(
        role_id=ROLE_ID,
        candidate_id=CANDIDATE_ID,
        job_description=job_description,
        candidate_profile=candidate_profile,
    )

    print("Evaluation Result:")
    print(result)

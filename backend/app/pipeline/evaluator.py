from app.agents.fit_agent import evaluate_candidate
from app.db.queries import insert_evaluation


def evaluate_jd_and_resume(
    role_id: str,
    candidate_id: str,
    job_description: dict,
    candidate_profile: dict
) -> dict:
    """
    Run JD ↔ Resume evaluation and store result in DB.
    """

    evaluation = evaluate_candidate(
        role_id=role_id,
        candidate_id=candidate_id,
        job_description=job_description,
        candidate_profile=candidate_profile
    )

    insert_evaluation(
        candidate_id=evaluation.candidate_id,
        role_id=evaluation.role_id,
        fit_score=evaluation.fit_score,
        decision=evaluation.decision,
        strengths=evaluation.strengths,
        gaps=evaluation.gaps,
        red_flags=evaluation.red_flags,
        evaluated_at=evaluation.evaluated_at,
    )

    return evaluation.model_dump()

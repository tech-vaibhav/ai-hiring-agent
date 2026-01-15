from pydantic import BaseModel
from typing import List
from datetime import datetime

class EvaluationResult(BaseModel):
    candidate_id: str
    role_id: str
    fit_score: float            # 0.0 → 1.0
    decision: str               # "Strong Hire" | "Hire with Training" | "Reject"
    strengths: List[str]
    gaps: List[str]
    red_flags: List[str]

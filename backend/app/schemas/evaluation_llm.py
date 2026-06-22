from pydantic import BaseModel
from typing import List


class EvaluationLLMResult(BaseModel):
    fit_score: float
    decision: str               # "Strong Hire" | "Hire with Training" | "Reject"
    strengths: List[str]
    gaps: List[str]
    red_flags: List[str]

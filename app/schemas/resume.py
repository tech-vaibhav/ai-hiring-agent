from pydantic import BaseModel
from typing import List

class CandidateProfile(BaseModel):
    candidate_id: str
    skills: List[str]
    experience_summary: str
    projects: List[str]
    experience_level: str
    red_flags: List[str]

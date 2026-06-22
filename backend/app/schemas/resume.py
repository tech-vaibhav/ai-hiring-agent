from pydantic import BaseModel
from typing import List, Optional

class CandidateProfile(BaseModel):
    candidate_id: Optional[str] = None 
    skills: List[str]
    experience_summary: str
    projects: List[str]
    experience_level: str
    red_flags: List[str]

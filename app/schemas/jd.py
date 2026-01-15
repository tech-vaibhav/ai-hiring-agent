from pydantic import BaseModel
from typing import List

class JobDescription(BaseModel):
    role_title: str
    must_have_skills: List[str]
    nice_to_have_skills: List[str]
    experience_level: str   # e.g. "fresher", "0-2 years"
    role_type: str          # e.g. "intern", "full-time"

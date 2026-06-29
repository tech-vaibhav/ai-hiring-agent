from datetime import datetime
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app.schemas.resume import CandidateProfile
from app.prompts.resume_prompt import RESUME_SYSTEM_PROMPT
from app.config import GEMINI_API_KEY


llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=GEMINI_API_KEY,
    temperature=0.2
)

structured_llm = llm.with_structured_output(CandidateProfile)

def extract_resume_structured(
    resume_text: str,
    candidate_name: str = None,
    experience_level: str = None
) -> CandidateProfile:
    """
    Extract structured candidate profile from resume text.
    """
    system_prompt = RESUME_SYSTEM_PROMPT
    if candidate_name:
        system_prompt += f"\n- Candidate Name is already verified as: '{candidate_name}'. Use this exact name in the candidate_name output field."
    if experience_level:
        system_prompt += f"\n- Candidate Experience is already verified as: '{experience_level}'. Use this exact string in the experience_level output field."

    dynamic_prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{resume_text}")
    ])

    chain = dynamic_prompt | structured_llm
    profile = chain.invoke({
        "resume_text": resume_text,
        "current_date": datetime.now().strftime("%B %d, %Y")
    })

    return profile

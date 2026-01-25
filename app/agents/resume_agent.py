from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from app.schemas.resume import CandidateProfile
from app.prompts.resume_prompt import RESUME_SYSTEM_PROMPT
from app.config import GEMINI_API_KEY


llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=GEMINI_API_KEY,
    temperature=0.2
)

parser = PydanticOutputParser(pydantic_object=CandidateProfile)

prompt = ChatPromptTemplate.from_messages([
    ("system", RESUME_SYSTEM_PROMPT),
    ("human", "{resume_text}")
])


def extract_resume_structured(
    resume_text: str) -> CandidateProfile:
    """
    Extract structured candidate profile from resume text.
    """

    chain = prompt | llm | parser
    profile = chain.invoke({"resume_text": resume_text})

    return profile

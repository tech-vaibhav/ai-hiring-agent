from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from app.schemas.jd import JobDescription
from app.prompts.jd_prompt import JD_SYSTEM_PROMPT
from app.config import GEMINI_API_KEY


llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=GEMINI_API_KEY,
    temperature=0.2
)

parser = PydanticOutputParser(pydantic_object=JobDescription)

prompt = ChatPromptTemplate.from_messages([
    ("system", JD_SYSTEM_PROMPT),
    ("human", "{jd_text}")
])


def extract_jd_structured(jd_text: str) -> JobDescription:
    """
    Extract structured Job Description from raw JD text using Gemini.
    """
    chain = prompt | llm | parser
    jd = chain.invoke({"jd_text": jd_text})
    return jd

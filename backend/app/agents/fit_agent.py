from datetime import datetime
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app.schemas.evaluation_llm import EvaluationLLMResult
from app.schemas.evaluation import EvaluationResult
from app.prompts.fit_prompt import FIT_SYSTEM_PROMPT
from app.config import GEMINI_API_KEY


llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=GEMINI_API_KEY,
    temperature=0.2
)

structured_llm = llm.with_structured_output(EvaluationLLMResult)

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", FIT_SYSTEM_PROMPT),
        (
            "human",
            """
Job Description:
{job_description}

Candidate Resume:
{candidate_profile}
""",
        ),
    ]
)

def evaluate_candidate(
    role_id: str,
    candidate_id: str,
    job_description: dict,
    candidate_profile: dict
) -> EvaluationResult:
    """
    Use Gemini to evaluate candidate fit for a role.
    """

    chain = prompt | structured_llm

    llm_eval = chain.invoke({
        "job_description": job_description,
        "candidate_profile": candidate_profile,
        "current_date": datetime.now().strftime("%B %d, %Y")
    })

    # 🔑 System constructs the full evaluation
    evaluation = EvaluationResult(
        candidate_id=candidate_id,
        role_id=role_id,
        fit_score=llm_eval.fit_score,
        decision=llm_eval.decision,
        strengths=llm_eval.strengths,
        gaps=llm_eval.gaps,
        red_flags=llm_eval.red_flags,
        evaluated_at=datetime.utcnow(),
    )

    return evaluation

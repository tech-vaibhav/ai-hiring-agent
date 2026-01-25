import tempfile
import os
from datetime import datetime

from app.pipeline.preprocess import extract_text_from_pdf
from app.storage.supabase import download_object, delete_object
from app.agents.resume_agent import extract_resume_structured
from app.db.queries import insert_candidate_profile


def parse_and_store_resume(
    candidate_id: str,
    object_path: str
) -> dict:
    """
    Parse resume PDF from Supabase Storage and store structured resume in DB.
    """

    # 1️⃣ Download resume PDF bytes
    pdf_bytes = download_object(object_path)

    # 2️⃣ Write to temporary file
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        # 3️⃣ Extract text from PDF
        resume_text = extract_text_from_pdf(tmp_path)
        if not resume_text:
            raise ValueError("Failed to extract text from resume PDF")

        # 4️⃣ AI Resume Agent
        profile = extract_resume_structured(resume_text)

        # Inject candidate_id explicitly (NOT from LLM) 
        profile.candidate_id = candidate_id
        
        # 5️⃣ Store in DB
        insert_candidate_profile(
            candidate_id=profile.candidate_id,
            skills=profile.skills,
            experience_summary=profile.experience_summary,
            projects=profile.projects,
            experience_level=profile.experience_level,
            red_flags=profile.red_flags,
            created_at=datetime.utcnow(),
        )

        return {
            "candidate_id": candidate_id,
            "profile": profile.model_dump(),
        }

    finally:
        # 6️⃣ Cleanup temp file + storage object
        os.remove(tmp_path)
        delete_object(object_path)

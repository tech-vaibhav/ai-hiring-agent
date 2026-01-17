import tempfile
import os
from datetime import datetime

from app.pipeline.preprocess import extract_text_from_pdf
from app.schemas.jd import JobDescription
from app.storage.supabase import download_object, delete_object
from app.db.queries import insert_job_role


def parse_and_store_jd(role_id: str, object_path: str) -> dict:
    """
    Parse JD PDF from Supabase Storage and store structured JD in DB.
    """

    # 1️⃣ Download PDF bytes from Supabase
    pdf_bytes = download_object(object_path)

    # 2️⃣ Write to temp file (ephemeral)
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        # 3️⃣ Extract text
        jd_text = extract_text_from_pdf(tmp_path)
        if not jd_text:
            raise ValueError("Failed to extract text from JD PDF")

        # 4️⃣ TEMP: Stub JD parsing (LLM agent comes later)
        jd = JobDescription(
            role_title="Software Engineer Intern",
            must_have_skills=["Python", "SQL"],
            nice_to_have_skills=["FastAPI", "Cloud"],
            experience_level="0-2 years",
            role_type="intern",
        )

        # 5️⃣ Store in DB
        insert_job_role(
            role_id=role_id,
            role_title=jd.role_title,
            must_have_skills=jd.must_have_skills,
            nice_to_have_skills=jd.nice_to_have_skills,
            experience_level=jd.experience_level,
            role_type=jd.role_type,
            created_at=datetime.utcnow(),
        )

        return {
            "role_id": role_id,
            "job_description": jd.model_dump(),
        }

    finally:
        # 6️⃣ Cleanup temp file + storage object
        os.remove(tmp_path)
        delete_object(object_path)

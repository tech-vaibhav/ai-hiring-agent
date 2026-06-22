from uuid import uuid4
from typing import List, Dict
from fastapi import UploadFile
from app.storage.supabase import upload_pdf_bytes


def save_job_description(file: UploadFile) -> Dict:
    """
    Upload JD PDF to Supabase Storage and generate role_id.
    """
    role_id = f"role_{uuid4().hex[:8]}"

    pdf_bytes = file.file.read()

    object_path = upload_pdf_bytes(
        pdf_bytes=pdf_bytes,
        object_prefix="jd",
        filename=f"{role_id}.pdf"
    )

    return {
        "role_id": role_id,
        "object_path": object_path  # Supabase private object path
    }
    
def save_resumes(files: List[UploadFile]) -> List[Dict]:
    """
    Upload resume PDFs to Supabase Storage and generate candidate_ids.
    """
    saved_resumes = []

    for file in files:
        candidate_id = f"cand_{uuid4().hex[:8]}"
        pdf_bytes = file.file.read()

        object_path = upload_pdf_bytes(
            pdf_bytes=pdf_bytes,
            object_prefix="resumes",
            filename=f"{candidate_id}.pdf"
        )

        saved_resumes.append({
            "candidate_id": candidate_id,
            "object_path": object_path  # Supabase private object path
        })

    return saved_resumes
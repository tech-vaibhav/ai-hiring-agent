import os
import uuid
from typing import List, Dict
from fastapi import UploadFile

UPLOAD_DIR = "data/uploads"

def ensure_upload_dir():
    """Ensure upload directory exists."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    

def save_job_description(file: UploadFile) -> Dict:
    """
    Save JD PDF and generate role_id.
    """
    ensure_upload_dir()

    role_id = f"role_{uuid.uuid4().hex[:8]}"
    filename = f"{role_id}.pdf"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    return {
        "role_id": role_id,
        "file_path": file_path
    }
    
def save_resumes(files: List[UploadFile]) -> List[Dict]:
    """
    Save resume PDFs and generate candidate_ids.
    """
    ensure_upload_dir()

    saved_resumes = []

    for file in files:
        candidate_id = f"cand_{uuid.uuid4().hex[:8]}"
        filename = f"{candidate_id}.pdf"
        file_path = os.path.join(UPLOAD_DIR, filename)

        with open(file_path, "wb") as f:
            f.write(file.file.read())

        saved_resumes.append({
            "candidate_id": candidate_id,
            "file_path": file_path
        })

    return saved_resumes
import time
from typing import List, Dict

from app.pipeline.resume_parser import parse_and_store_resume


BATCH_SIZE = 4
SLEEP_SECONDS = 10


def process_resumes_in_batches(resumes: List[Dict]) -> None:
    """
    Process resumes safely in throttled batches to avoid LLM rate limits.

    resumes = [
        {"candidate_id": "...", "object_path": "..."},
        ...
    ]
    """

    for i in range(0, len(resumes), BATCH_SIZE):
        batch = resumes[i : i + BATCH_SIZE]

        for resume in batch:
            parse_and_store_resume(
                candidate_id=resume["candidate_id"],
                object_path=resume["object_path"]
            )

        # Sleep between batches (if not last batch)
        if i + BATCH_SIZE < len(resumes):
            time.sleep(SLEEP_SECONDS)

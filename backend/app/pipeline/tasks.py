import time
import os
from typing import List, Dict

from app.db.queries import (
    update_task,
    fetch_job_role,
    fetch_candidate_profile,
    insert_drive
)
from app.pipeline.jd_parser import parse_and_store_jd
from app.pipeline.resume_parser import parse_and_store_resume
from app.pipeline.evaluator import evaluate_jd_and_resume


def bg_parse_jd(role_id: str, object_path: str, task_id: str, drive_id: str, user_id: str) -> None:
    """
    Background worker task to parse a Job Description PDF.
    """
    update_task(task_id, "processing")
    try:
        parse_and_store_jd(role_id, object_path)
        insert_drive(drive_id, user_id, role_id)
        update_task(
            task_id,
            "completed",
            result={"role_id": role_id}
        )
    except Exception as e:
        print(f"[ERROR] Failed to parse JD in background: {e}")
        update_task(task_id, "failed", error=str(e))


def bg_parse_resume(candidate_id: str, object_path: str, task_id: str, role_id: str) -> None:
    """
    Background worker task to parse a single candidate resume PDF.
    """
    update_task(task_id, "processing")
    try:
        parse_and_store_resume(candidate_id, object_path, role_id)
        update_task(
            task_id,
            "completed",
            result={"candidate_id": candidate_id}
        )
    except Exception as e:
        print(f"[ERROR] Failed to parse Resume in background: {e}")
        update_task(task_id, "failed", error=str(e))


def bg_parse_resumes_batch(resumes_list: List[Dict[str, str]], task_id: str, role_id: str) -> None:
    """
    Background worker task to parse multiple resumes in throttled batches.
    """
    update_task(task_id, "processing")
    BATCH_SIZE = 4
    SLEEP_SECONDS = 10
    
    successful = []
    failed = []

    try:
        for i in range(0, len(resumes_list), BATCH_SIZE):
            batch = resumes_list[i : i + BATCH_SIZE]
            
            for resume in batch:
                cid = resume["candidate_id"]
                opath = resume["object_path"]
                try:
                    parse_and_store_resume(cid, opath, role_id)
                    successful.append(cid)
                except Exception as e:
                    print(f"[ERROR] Batch resume parsing failed for {cid}: {e}")
                    failed.append({"candidate_id": cid, "error": str(e)})

            # Sleep between batches if there are more
            if i + BATCH_SIZE < len(resumes_list):
                time.sleep(SLEEP_SECONDS)

        update_task(
            task_id,
            "completed",
            result={
                "successful_candidates": successful,
                "failed_candidates": failed
            }
        )
    except Exception as e:
        print(f"[ERROR] Batch resume task failed completely: {e}")
        update_task(task_id, "failed", error=str(e))


def bg_evaluate_single(role_id: str, candidate_id: str, task_id: str) -> None:
    """
    Background worker task to run single JD <-> Resume evaluation.
    """
    update_task(task_id, "processing")
    try:
        job_description = fetch_job_role(role_id)
        candidate_profile = fetch_candidate_profile(candidate_id)
        
        evaluate_jd_and_resume(
            role_id=role_id,
            candidate_id=candidate_id,
            job_description=job_description,
            candidate_profile=candidate_profile
        )
        
        update_task(
            task_id,
            "completed",
            result={
                "role_id": role_id,
                "candidate_id": candidate_id
            }
        )
    except Exception as e:
        print(f"[ERROR] Background evaluation failed: {e}")
        update_task(task_id, "failed", error=str(e))


def bg_evaluate_batch(role_id: str, candidate_ids: List[str], task_id: str) -> None:
    """
    Background worker task to run batch evaluation for a specific job role,
    throttled 2 at a time to prevent LLM rate limits.
    """
    update_task(task_id, "processing")
    BATCH_SIZE = 2
    SLEEP_SECONDS = 5
    
    successful = []
    failed = []

    try:
        job_description = fetch_job_role(role_id)
        
        for i in range(0, len(candidate_ids), BATCH_SIZE):
            batch = candidate_ids[i : i + BATCH_SIZE]
            
            for cid in batch:
                try:
                    candidate_profile = fetch_candidate_profile(cid)
                    evaluate_jd_and_resume(
                        role_id=role_id,
                        candidate_id=cid,
                        job_description=job_description,
                        candidate_profile=candidate_profile
                    )
                    successful.append(cid)
                except Exception as e:
                    print(f"[ERROR] Evaluation failed for candidate {cid}: {e}")
                    failed.append({"candidate_id": cid, "error": str(e)})
            
            # Sleep between batches if there are more
            if i + BATCH_SIZE < len(candidate_ids):
                time.sleep(SLEEP_SECONDS)

        update_task(
            task_id,
            "completed",
            result={
                "evaluated_candidates": successful,
                "failed_evaluations": failed
            }
        )
    except Exception as e:
        print(f"[ERROR] Batch evaluation task failed completely: {e}")
        update_task(task_id, "failed", error=str(e))

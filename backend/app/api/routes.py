from uuid import uuid4
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, UploadFile, BackgroundTasks, HTTPException, Query, status, Depends, Form
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr

from app.pipeline.ingest import save_job_description, save_resumes
from app.db.queries import (
    create_task,
    fetch_task,
    list_job_roles,
    fetch_job_role,
    delete_job_role,
    list_candidates,
    fetch_candidate_profile,
    delete_candidate_profile,
    list_evaluations,
    fetch_evaluation,
    delete_evaluation,
    fetch_unevaluated_candidates,
    fetch_role_candidates_evaluations,
    find_active_task_by_metadata,
    find_latest_task_by_metadata,
    create_user,
    get_user_by_email,
    get_user_by_google_id,
    verify_user,
    store_otp,
    fetch_otp_by_user,
    delete_otps_by_user,
    insert_drive,
    list_drives_by_user,
    delete_drive
)
from app.pipeline.tasks import (
    bg_parse_jd,
    bg_parse_resume,
    bg_parse_resumes_batch,
    bg_evaluate_single,
    bg_evaluate_batch
)
from app.pipeline.evaluator import evaluate_jd_and_resume
from app.auth.helpers import (
    hash_password,
    verify_password,
    create_access_token,
    verify_access_token,
    verify_google_token,
    generate_otp,
    send_otp_email
)

router = APIRouter()
security = HTTPBearer()


class SingleEvaluationRequest(BaseModel):
    role_id: str
    candidate_id: str


class BatchEvaluationRequest(BaseModel):
    role_id: str
    candidate_ids: Optional[List[str]] = None


class SignUpRequest(BaseModel):
    first_name: str
    last_name: str
    email_id: str
    password: str
    gender: str
    country: str
    phone_number: str
    city: str
    current_company: str
    designation: str


class VerifyOtpRequest(BaseModel):
    email_id: str
    otp_code: str


class SignInRequest(BaseModel):
    email_id: str
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email = payload.get("email_id")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


@router.get("/ping")
def ping():
    return {"message": "pong"}


# ==========================================
# JOB DESCRIPTION ENDPOINTS
# ==========================================

@router.post("/job-roles", status_code=status.HTTP_202_ACCEPTED)
def upload_job_description(
    file: UploadFile, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a single Job Description PDF. Parsing is offloaded to a background task, and a Drive is created.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    try:
        # Ingest file to Supabase (returns role_id and object_path)
        ingest_res = save_job_description(file)
        role_id = ingest_res["role_id"]
        object_path = ingest_res["object_path"]
        
        # Create drive linked to the user
        drive_id = f"drive_{uuid4().hex[:8]}"
        
        # Create persistent task in database
        task_id = f"task_jd_{uuid4().hex[:8]}"
        create_task(task_id, "parse_jd")
        
        # Trigger background processing (includes inserting drive after parsing succeeds)
        background_tasks.add_task(
            bg_parse_jd,
            role_id,
            object_path,
            task_id,
            drive_id,
            current_user["user_id"]
        )
        
        return {
            "task_id": task_id,
            "role_id": role_id,
            "drive_id": drive_id,
            "status": "pending",
            "message": "Job description upload accepted. Drive created. Parsing is running in the background."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")


# ==========================================
# DRIVE ENDPOINTS
# ==========================================

@router.get("/drives")
def get_drives(current_user: dict = Depends(get_current_user)):
    """
    Get all drives owned by the logged-in recruiter.
    """
    try:
        return list_drives_by_user(current_user["user_id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/drives/{drive_id}")
def remove_drive(drive_id: str, current_user: dict = Depends(get_current_user)):
    """
    Delete a drive. This also cascades to delete the associated job role, tasks, and evaluations.
    """
    try:
        # Verify the drive belongs to the user or find the role_id
        drives = list_drives_by_user(current_user["user_id"])
        target_drive = next((d for d in drives if d["drive_id"] == drive_id), None)
        
        if not target_drive:
            raise HTTPException(status_code=404, detail="Drive not found or not owned by you.")
            
        role_id = target_drive["role_id"]
        
        # Delete the job role which automatically cascades to evaluations and the drive itself
        delete_job_role(role_id)
        
        return {"status": "success", "message": f"Drive {drive_id} and related job role/evaluations deleted."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/job-roles")
def get_job_roles():
    """
    Get all structured job roles in the database.
    """
    try:
        return list_job_roles()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/job-roles/{role_id}")
def get_job_role(role_id: str):
    """
    Get a specific job role details by its ID.
    """
    try:
        role = fetch_job_role(role_id)
        return role
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/job-roles/{role_id}/candidates")
def get_job_role_candidates(role_id: str):
    """
    Get all candidates left-joined with their evaluation result for this specific job role.
    """
    try:
        # Check if job role exists
        fetch_job_role(role_id)
        return fetch_role_candidates_evaluations(role_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/job-roles/{role_id}")
def remove_job_role(role_id: str):
    """
    Delete a job role and all its evaluations cascadingly.
    """
    try:
        # Check if exists
        fetch_job_role(role_id)
        delete_job_role(role_id)
        return {"status": "success", "message": f"Job description {role_id} and related evaluations deleted."}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# CANDIDATE RESUME ENDPOINTS
# ==========================================

@router.post("/candidates", status_code=status.HTTP_202_ACCEPTED)
def upload_candidate_resume(
    file: UploadFile, 
    background_tasks: BackgroundTasks,
    role_id: str = Query(...)
):
    """
    Upload a single Resume PDF. Parsing is offloaded to a background task.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    try:
        # Ingest file to Supabase (returns list of dicts)
        ingest_res = save_resumes([file])[0]
        candidate_id = ingest_res["candidate_id"]
        object_path = ingest_res["object_path"]
        
        # Create persistent task in database
        task_id = f"task_res_{uuid4().hex[:8]}"
        create_task(task_id, "parse_resume")
        
        # Trigger background processing
        background_tasks.add_task(bg_parse_resume, candidate_id, object_path, task_id, role_id)
        
        return {
            "task_id": task_id,
            "candidate_id": candidate_id,
            "status": "pending",
            "message": "Resume upload accepted. Parsing is running in the background."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")


@router.post("/candidates/batch", status_code=status.HTTP_202_ACCEPTED)
def upload_resumes_batch(
    files: List[UploadFile], 
    background_tasks: BackgroundTasks,
    role_id: str = Query(...)
):
    """
    Upload multiple resume PDFs. Parsing is offloaded to a background task in throttled batches.
    """
    for file in files:
        if not file.filename.endswith(".pdf"):
            raise HTTPException(status_code=400, detail="All uploaded files must be PDFs.")
            
    try:
        # Save all resumes to Supabase Storage
        saved_resumes = save_resumes(files)
        
        # Create persistent batch task in DB
        task_id = f"task_res_batch_{uuid4().hex[:8]}"
        create_task(task_id, "parse_resume_batch")
        
        # Trigger background processing
        background_tasks.add_task(bg_parse_resumes_batch, saved_resumes, task_id, role_id)
        
        return {
            "task_id": task_id,
            "candidate_ids": [r["candidate_id"] for r in saved_resumes],
            "status": "pending",
            "message": f"Successfully uploaded {len(files)} resumes. Parsing started in the background."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch ingestion failed: {e}")


@router.get("/candidates")
def get_candidates():
    """
    Get all structured candidate profiles.
    """
    try:
        return list_candidates()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/candidates/{candidate_id}")
def get_candidate(candidate_id: str):
    """
    Get details of a specific candidate profile.
    """
    try:
        profile = fetch_candidate_profile(candidate_id)
        # Add candidate_id to response for clarity
        profile["candidate_id"] = candidate_id
        return profile
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/candidates/{candidate_id}")
def remove_candidate(candidate_id: str):
    """
    Delete a candidate profile and all their evaluations cascadingly.
    """
    try:
        # Check if exists
        fetch_candidate_profile(candidate_id)
        delete_candidate_profile(candidate_id)
        return {"status": "success", "message": f"Candidate profile {candidate_id} and related evaluations deleted."}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# EVALUATION ENDPOINTS
# ==========================================

@router.post("/evaluations", status_code=status.HTTP_202_ACCEPTED)
def trigger_evaluation(req: SingleEvaluationRequest, background_tasks: BackgroundTasks):
    """
    Trigger a single evaluation for a specific candidate and role.
    """
    try:
        # Verify both JD and Candidate exist first
        fetch_job_role(req.role_id)
        fetch_candidate_profile(req.candidate_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    
    # Create persistent task
    task_id = f"task_eval_{uuid4().hex[:8]}"
    create_task(task_id, "evaluate_single")
    
    # Trigger background evaluation
    background_tasks.add_task(bg_evaluate_single, req.role_id, req.candidate_id, task_id)
    
    return {
        "task_id": task_id,
        "status": "pending",
        "message": "Evaluation task submitted successfully."
    }


@router.post("/evaluations/batch", status_code=status.HTTP_202_ACCEPTED)
def trigger_batch_evaluation(req: BatchEvaluationRequest, background_tasks: BackgroundTasks):
    """
    Trigger batch evaluations. If candidate_ids are not supplied, it evaluates all unevaluated candidates for the role,
    throttled 2 at a time to prevent LLM rate limits.
    """
    try:
        # Verify job description exists
        fetch_job_role(req.role_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    
    candidate_ids = req.candidate_ids
    if not candidate_ids:
        # Get only unevaluated candidates
        candidate_ids = fetch_unevaluated_candidates(req.role_id)
        if not candidate_ids:
            return {
                "task_id": None,
                "status": "completed",
                "message": "All candidates in database have already been evaluated for this role. No action needed."
            }
    else:
        # Verify supplied candidate IDs exist
        for cid in candidate_ids:
            try:
                fetch_candidate_profile(cid)
            except ValueError:
                raise HTTPException(status_code=404, detail=f"Candidate {cid} not found.")

    # Create persistent task
    task_id = f"task_eval_batch_{uuid4().hex[:8]}"
    create_task(task_id, "evaluate_batch")
    
    # Trigger background processing
    background_tasks.add_task(bg_evaluate_batch, req.role_id, candidate_ids, task_id)
    
    return {
        "task_id": task_id,
        "candidate_ids": candidate_ids,
        "status": "pending",
        "message": f"Evaluation task submitted for {len(candidate_ids)} candidates. Running in batches of 2."
    }


@router.get("/evaluations")
def get_evaluations(
    role_id: Optional[str] = Query(None, description="Filter evaluations by role ID"),
    candidate_id: Optional[str] = Query(None, description="Filter evaluations by candidate ID")
):
    """
    Get all evaluations, optionally filtering by role ID or candidate ID.
    """
    try:
        return list_evaluations(role_id=role_id, candidate_id=candidate_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/evaluations/{role_id}/{candidate_id}")
def get_evaluation(role_id: str, candidate_id: str):
    """
    Get evaluation details. If not evaluated yet, runs it synchronously and returns the completed evaluation.
    """
    try:
        # 1. Check if evaluation already exists in DB
        eval_res = fetch_evaluation(candidate_id=candidate_id, role_id=role_id)
        if eval_res:
            return eval_res

        # 2. Verify candidate and role exist
        job_description = fetch_job_role(role_id)
        candidate_profile = fetch_candidate_profile(candidate_id)

        # 3. Compute evaluation synchronously
        result = evaluate_jd_and_resume(
            role_id=role_id,
            candidate_id=candidate_id,
            job_description=job_description,
            candidate_profile=candidate_profile
        )
        return result
    except Exception as e:
        if isinstance(e, ValueError):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=f"Evaluation computation failed: {e}")


@router.delete("/evaluations/{role_id}/{candidate_id}")
def remove_evaluation(role_id: str, candidate_id: str):
    """
    Delete a specific evaluation.
    """
    try:
        eval_res = fetch_evaluation(candidate_id=candidate_id, role_id=role_id)
        if not eval_res:
            raise HTTPException(status_code=404, detail="Evaluation result not found.")
        delete_evaluation(candidate_id=candidate_id, role_id=role_id)
        return {"status": "success", "message": f"Evaluation for candidate {candidate_id} and role {role_id} deleted."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# TASK STATUS ENDPOINTS
# ==========================================

@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    """
    Query the status and results of a background task.
    """
    task = fetch_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


# ==========================================
# AUTHENTICATION ENDPOINTS
# ==========================================

@router.post("/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(req: SignUpRequest):
    """
    Registers a new user, hashes password, saves profile as is_verified=False,
    generates a 4-digit OTP, and triggers email verification.
    """
    existing_user = get_user_by_email(req.email_id)
    if existing_user:
        if existing_user["is_verified"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered. Please sign in."
            )
        user_id = existing_user["user_id"]
    else:
        user_id = f"user_{uuid4().hex[:8]}"

    password_hash = hash_password(req.password)
    try:
        create_user(
            user_id=user_id,
            first_name=req.first_name,
            last_name=req.last_name,
            email_id=req.email_id,
            password_hash=password_hash,
            gender=req.gender,
            country=req.country,
            phone_number=req.phone_number,
            city=req.city,
            current_company=req.current_company,
            designation=req.designation,
            google_id=None,
            is_verified=False
        )
        
        otp_code = generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=5)
        store_otp(user_id, req.email_id, otp_code, expires_at)
        
        send_otp_email(req.email_id, otp_code)
        
        return {
            "status": "pending_verification",
            "email_id": req.email_id,
            "user_id": user_id,
            "message": "User registered. Verification 4-digit OTP sent to email."
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {e}"
        )


@router.post("/auth/verify-otp")
def verify_otp(req: VerifyOtpRequest):
    """
    Verifies 4-digit OTP. If matched and valid, activates user account and yields JWT token.
    """
    user = get_user_by_email(req.email_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found."
        )
        
    otp_record = fetch_otp_by_user(user["user_id"])
    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification code was sent for this account."
        )
        
    if datetime.utcnow() > otp_record["expires_at"]:
        delete_otps_by_user(user["user_id"])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired."
        )
        
    if otp_record["otp_code"] != req.otp_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code."
        )
        
    try:
        verify_user(req.email_id)
        delete_otps_by_user(user["user_id"])
        
        access_token = create_access_token({
            "user_id": user["user_id"],
            "email_id": user["email_id"]
        })
        
        return {
            "status": "success",
            "access_token": access_token,
            "token_type": "bearer",
            "message": "Email verified successfully. Account activated."
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification process failed: {e}"
        )


@router.post("/auth/signin")
def signin(req: SignInRequest):
    """
    Authenticates a user via email and password.
    Returns access JWT if verified, or prompts OTP verification if account is pending.
    """
    user = get_user_by_email(req.email_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
        
    if not user["password_hash"] or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
        
    if not user["is_verified"]:
        otp_code = generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=5)
        store_otp(user["user_id"], user["email_id"], otp_code, expires_at)
        send_otp_email(user["email_id"], otp_code)
        
        return {
            "status": "pending_verification",
            "email_id": user["email_id"],
            "message": "Your account is unverified. Verification OTP sent to email."
        }
        
    access_token = create_access_token({
        "user_id": user["user_id"],
        "email_id": user["email_id"]
    })
    
    return {
        "status": "success",
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.post("/auth/google")
def signin_with_google(req: GoogleAuthRequest):
    """
    Authenticates user via Google ID Token. Registers user (auto-verified) if profile doesn't exist.
    """
    google_profile = verify_google_token(req.id_token)
    if not google_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google ID Token."
        )
        
    email_id = google_profile["email_id"]
    google_id = google_profile["google_id"]
    
    user = get_user_by_google_id(google_id)
    if not user:
        user = get_user_by_email(email_id)
        
    if user:
        if not user["google_id"]:
            try:
                create_user(
                    user_id=user["user_id"],
                    first_name=user["first_name"],
                    last_name=user["last_name"],
                    email_id=user["email_id"],
                    password_hash=user["password_hash"],
                    gender=user["gender"],
                    country=user["country"],
                    phone_number=user["phone_number"],
                    city=user["city"],
                    current_company=user["current_company"],
                    designation=user["designation"],
                    google_id=google_id,
                    is_verified=True
                )
            except Exception as e:
                print(f"[ERROR] Failed to update user with Google link: {e}")
    else:
        user_id = f"user_{uuid4().hex[:8]}"
        try:
            create_user(
                user_id=user_id,
                first_name=google_profile["first_name"],
                last_name=google_profile["last_name"],
                email_id=email_id,
                password_hash=None,
                gender="",
                country="",
                phone_number="",
                city="",
                current_company="",
                designation="",
                google_id=google_id,
                is_verified=True
            )
            user = get_user_by_email(email_id)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Google registration failed: {e}"
            )
            
    access_token = create_access_token({
        "user_id": user["user_id"],
        "email_id": user["email_id"]
    })
    
    return {
        "status": "success",
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.get("/users/me")
def get_user_profile(user: dict = Depends(get_current_user)):
    """
    Gets authenticated user's profile details.
    """
    profile = user.copy()
    profile.pop("password_hash", None)
    return profile


# ==========================================
# PUBLIC CANDIDATE PORTAL ENDPOINTS
# ==========================================

@router.get("/public/job-roles/{role_id}")
def public_get_job_role(role_id: str):
    """
    Get job role details publicly (for candidates applying).
    """
    try:
        return fetch_job_role(role_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/public/apply/{role_id}", status_code=status.HTTP_202_ACCEPTED)
def public_apply_to_job(
    role_id: str,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    candidate_name: str = Form(...),
    experience_years: str = Form(...)
):
    """
    Public candidate application: upload resume PDF and parse it in the background linked to the role_id.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    try:
        # Verify the role_id exists
        fetch_job_role(role_id)
        
        # Save resume to Supabase Storage
        ingest_res = save_resumes([file])[0]
        candidate_id = ingest_res["candidate_id"]
        object_path = ingest_res["object_path"]
        
        # Create persistent task in database
        task_id = f"task_res_{uuid4().hex[:8]}"
        create_task(task_id, "parse_resume")
        
        # Trigger background processing (passes role_id so candidate is linked)
        background_tasks.add_task(
            bg_parse_resume,
            candidate_id,
            object_path,
            task_id,
            role_id,
            candidate_name,
            f"{experience_years} years"
        )
        
        return {
            "task_id": task_id,
            "candidate_id": candidate_id,
            "status": "pending",
            "message": "Resume uploaded successfully. Parsing in progress."
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Application submission failed: {e}")


@router.get("/candidates/{candidate_id}/resume")
def get_candidate_resume_file(
    candidate_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Securely download/stream a candidate's resume PDF from Supabase Storage.
    Only authenticated recruiters can access this.
    """
    from fastapi import Response
    from app.storage.supabase import download_object

    try:
        # Check if candidate exists (raises ValueError if not found)
        fetch_candidate_profile(candidate_id)

        # Download from private storage bucket
        object_path = f"resumes/{candidate_id}.pdf"
        pdf_bytes = download_object(object_path)

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename={candidate_id}.pdf"
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch resume: {e}")


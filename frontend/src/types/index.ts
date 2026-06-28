// ============================================================
// AUTH TYPES
// ============================================================

export interface SignUpPayload {
  first_name: string;
  last_name: string;
  email_id: string;
  password: string;
  gender: string;
  country: string;
  phone_number: string;
  city: string;
  current_company: string;
  designation: string;
}

export interface SignInPayload {
  email_id: string;
  password: string;
}

export interface VerifyOtpPayload {
  email_id: string;
  otp_code: string;
}

export interface GoogleAuthPayload {
  id_token: string;
}

export interface AuthResponse {
  status: string;
  access_token: string;
  token_type: string;
}

export interface User {
  user_id: string;
  first_name: string;
  last_name: string;
  email_id: string;
  gender: string;
  country: string;
  phone_number: string;
  city: string;
  current_company: string;
  designation: string;
  google_id: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// JOB ROLE TYPES
// ============================================================

export interface JobRole {
  role_id: string;
  role_title: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  experience_level: string;
  role_type: string;
  created_at: string;
}

// ============================================================
// DRIVE TYPES
// ============================================================

export interface Drive {
  drive_id: string;
  user_id: string;
  role_id: string;
  created_at: string;
  role_title: string;
  experience_level: string;
  role_type: string;
  candidate_count: number;
}


// ============================================================
// CANDIDATE TYPES
// ============================================================

export interface Candidate {
  candidate_id: string;
  skills: string[];
  experience_summary: string;
  projects: string[];
  experience_level: string;
  red_flags: string[];
  created_at: string;
}

export interface CandidateWithEvaluation extends Candidate {
  evaluation: {
    fit_score: number;
    decision: 'Strong Hire' | 'Hire with Training' | 'Reject';
    strengths: string[];
    gaps: string[];
    red_flags: string[];
    evaluated_at: string;
  } | null;
}

// ============================================================
// EVALUATION TYPES
// ============================================================

export interface Evaluation {
  candidate_id: string;
  role_id: string;
  fit_score: number;
  decision: 'Strong Hire' | 'Hire with Training' | 'Reject';
  strengths: string[];
  gaps: string[];
  red_flags: string[];
  evaluated_at: string;
}

// ============================================================
// TASK TYPES
// ============================================================

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Task {
  task_id: string;
  task_type: string;
  status: TaskStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

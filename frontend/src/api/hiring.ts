import api from './client';
import type { JobRole, Candidate, CandidateWithEvaluation, Evaluation, Task, Drive } from '../types';

// ---- Job Roles ----
export const jobRolesApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ task_id: string; role_id: string; drive_id: string }>('/job-roles', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: () => api.get<JobRole[]>('/job-roles'),
  get: (roleId: string) => api.get<JobRole>(`/job-roles/${roleId}`),
  getCandidates: (roleId: string) =>
    api.get<CandidateWithEvaluation[]>(`/job-roles/${roleId}/candidates`),
  delete: (roleId: string) => api.delete(`/job-roles/${roleId}`),
};

// ---- Drives ----
export const drivesApi = {
  list: () => api.get<Drive[]>('/drives'),
  delete: (driveId: string) => api.delete(`/drives/${driveId}`),
};


// ---- Candidates ----
export const candidatesApi = {
  upload: (file: File, roleId: string) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ task_id: string; candidate_id: string }>(`/candidates?role_id=${roleId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadBatch: (files: File[], roleId: string) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return api.post<{ task_id: string; candidate_ids: string[] }>(`/candidates/batch?role_id=${roleId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: () => api.get<Candidate[]>('/candidates'),
  get: (candidateId: string) => api.get<Candidate>(`/candidates/${candidateId}`),
  delete: (candidateId: string) => api.delete(`/candidates/${candidateId}`),
  viewResume: (candidateId: string) =>
    api.get<Blob>(`/candidates/${candidateId}/resume`, { responseType: 'blob' }),
};

// ---- Evaluations ----
export const evaluationsApi = {
  get: (roleId: string, candidateId: string) =>
    api.get<Evaluation>(`/evaluations/${roleId}/${candidateId}`),
  list: (params?: { role_id?: string; candidate_id?: string }) =>
    api.get<Evaluation[]>('/evaluations', { params }),
  trigger: (role_id: string, candidate_id: string) =>
    api.post('/evaluations', { role_id, candidate_id }),
  triggerBatch: (role_id: string, candidate_ids?: string[]) =>
    api.post('/evaluations/batch', { role_id, candidate_ids }),
  delete: (roleId: string, candidateId: string) =>
    api.delete(`/evaluations/${roleId}/${candidateId}`),
};

// ---- Tasks ----
export const tasksApi = {
  get: (taskId: string) => api.get<Task>(`/tasks/${taskId}`),
};

// ---- Public Portal ----
export const publicApi = {
  getJobRole: (roleId: string) => api.get<JobRole>(`/public/job-roles/${roleId}`),
  apply: (roleId: string, file: File, candidateName: string, experienceYears: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('candidate_name', candidateName);
    form.append('experience_years', experienceYears);
    return api.post<{ task_id: string; candidate_id: string }>(`/public/apply/${roleId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

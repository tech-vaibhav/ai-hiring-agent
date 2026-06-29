import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi, tasksApi } from '../api/hiring';
import type { JobRole } from '../types';
import './CandidateApplyPage.css';

// ---- Inline Icons ----
const FilePdfIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="9" y1="15" x2="15" y2="15"></line>
    <line x1="9" y1="11" x2="11" y2="11"></line>
  </svg>
);

const UploadCloudIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.2 15c.7-1.2 1-2.5.7-3.9-.3-2-1.5-3.8-3.3-4.5-1.2-2.9-4.1-4.7-7.3-4.2-3.1.5-5.6 2.9-6.1 6-2 .7-3.2 2.6-3 4.7.3 2 1.9 3.6 4 3.9H17v.3"></path>
    <polyline points="16 16 12 12 8 16"></polyline>
    <line x1="12" y1="12" x2="12" y2="21"></line>
  </svg>
);

export default function CandidateApplyPage() {
  const { roleId } = useParams<{ roleId: string }>();

  const [role, setRole] = useState<JobRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Resume Upload State
  const [candidateName, setCandidateName] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    if (roleId) {
      fetchJobDetails();
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [roleId]);

  const fetchJobDetails = async () => {
    if (!roleId) return;
    try {
      setLoading(true);
      const res = await publicApi.getJobRole(roleId);
      setRole(res.data);
    } catch (err: any) {
      console.error('Error fetching job description:', err);
      setError(err.response?.data?.detail || 'Job posting not found or expired.');
    } finally {
      setLoading(false);
    }
  };

  // Poll parse task status
  const startPollingTask = (taskId: string) => {
    setProcessingStatus('parsing');
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await tasksApi.get(taskId);
        const task = res.data;
        if (task.status === 'completed') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setProcessingStatus('success');
          setSelectedFile(null);
        } else if (task.status === 'failed') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setProcessingStatus('error');
          setUploadError(task.error || 'Parsing resume failed.');
        }
      } catch (err) {
        console.error('Error polling task status:', err);
      }
    }, 2000);
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        alert('Only PDF resumes are supported.');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Trigger submission
  const handleSubmitApplication = async () => {
    if (!selectedFile || !roleId || !candidateName.trim() || !experienceYears.trim()) return;
    setUploadError('');
    setProcessingStatus('uploading');

    try {
      const res = await publicApi.apply(
        roleId,
        selectedFile,
        candidateName.trim(),
        experienceYears.trim()
      );
      const { task_id } = res.data;
      startPollingTask(task_id);
    } catch (err: any) {
      setProcessingStatus('error');
      setUploadError(err.response?.data?.detail || 'Failed to submit application. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="apply-container">
        <header className="apply-header">
          <div className="logo-container"><span className="logo-dot"></span>Hirely</div>
        </header>
        <div className="apply-loading">
          <div className="spinner"></div>
          <p>Loading Job Posting...</p>
        </div>
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="apply-container">
        <header className="apply-header">
          <div className="logo-container"><span className="logo-dot"></span>Hirely</div>
        </header>
        <div className="apply-error">
          <div className="error-icon-container">✕</div>
          <h3>Job Posting Unavailable</h3>
          <p>{error || 'This job application link is inactive or incorrect.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="apply-container">
      {/* HEADER */}
      <header className="apply-header">
        <div className="logo-container">
          <span className="logo-dot"></span>
          Hirely
        </div>
      </header>

      {/* BODY */}
      <main className="apply-body">
        {processingStatus !== 'success' ? (
          <div className="apply-grid">
            
            {/* LEFT COLUMN: Job Specification */}
            <section className="apply-job-card">
              <div className="apply-job-header">
                <span className="apply-role-badge">{role.role_type || 'Full-Time'}</span>
                <h1 className="apply-job-title">{role.role_title}</h1>
                <p className="apply-job-exp">Experience Required: <strong>{role.experience_level}</strong></p>
              </div>

              <div className="apply-skills-section">
                <h4 className="apply-skills-title">Must-Have Skills</h4>
                <div className="apply-skills-list">
                  {role.must_have_skills && role.must_have_skills.length > 0 ? (
                    role.must_have_skills.map((skill, idx) => (
                      <span key={idx} className="apply-skill-pill apply-must-have">{skill}</span>
                    ))
                  ) : (
                    <span className="apply-no-skills">None specified</span>
                  )}
                </div>
              </div>

              <div className="apply-skills-section">
                <h4 className="apply-skills-title">Nice-to-Have Skills</h4>
                <div className="apply-skills-list">
                  {role.nice_to_have_skills && role.nice_to_have_skills.length > 0 ? (
                    role.nice_to_have_skills.map((skill, idx) => (
                      <span key={idx} className="apply-skill-pill apply-nice-to-have">{skill}</span>
                    ))
                  ) : (
                    <span className="apply-no-skills">None specified</span>
                  )}
                </div>
              </div>
            </section>

            {/* RIGHT COLUMN: Application form / uploader */}
            <section className="apply-form-card">
              <h2 className="form-card-title">Apply for this Position</h2>
              <p className="form-card-subtitle">Submit your resume in PDF format. Our AI screening system will extract your skills and experience details immediately.</p>

              {uploadError && (
                <div className="apply-error-banner">
                  {uploadError}
                </div>
              )}

              {processingStatus === 'idle' && (
                <>
                  <div className="apply-input-group">
                    <label className="apply-input-label">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Jane Doe" 
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      className="apply-input"
                      required
                    />
                  </div>

                  <div className="apply-input-group">
                    <label className="apply-input-label">Total Experience (Years)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="1"
                      placeholder="e.g. 5" 
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      className="apply-input"
                      required
                    />
                  </div>

                  <div className="apply-input-group">
                    <label className="apply-input-label">Upload Resume PDF</label>
                    <div 
                      className="apply-dropzone"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="application/pdf"
                        style={{ display: 'none' }}
                      />
                      <div className="apply-dropzone-icon">
                        <UploadCloudIcon />
                      </div>
                      <div className="apply-dropzone-text">
                        {selectedFile ? 'Change Resume PDF' : 'Select PDF'}
                      </div>
                      <div className="apply-dropzone-subtext">
                        Drag and drop or click to browse. Max 10MB. PDF only.
                      </div>
                    </div>
                  </div>

                  {selectedFile && (
                    <div className="apply-selected-file-container">
                      <div className="apply-file-info">
                        <div className="apply-file-icon">
                          <FilePdfIcon />
                        </div>
                        <div>
                          <div className="apply-file-name">{selectedFile.name}</div>
                          <div className="apply-file-size">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      <button className="apply-btn-remove-file" onClick={() => setSelectedFile(null)}>✕</button>
                    </div>
                  )}

                  <div className="apply-actions">
                    <button 
                      className="apply-btn-submit" 
                      onClick={handleSubmitApplication}
                      disabled={!selectedFile || !candidateName.trim() || !experienceYears.trim()}
                      style={{ opacity: (selectedFile && candidateName.trim() && experienceYears.trim()) ? 1 : 0.6 }}
                    >
                      Submit Application
                    </button>
                  </div>
                </>
              )}

              {(processingStatus === 'uploading' || processingStatus === 'parsing') && (
                <div className="apply-processing-container">
                  <div className="apply-spinner"></div>
                  <h4 className="apply-processing-title">
                    {processingStatus === 'uploading' && 'Uploading Resume...'}
                    {processingStatus === 'parsing' && 'AI Parsing Resume & Extracting details...'}
                  </h4>
                  <p className="apply-processing-desc">
                    {processingStatus === 'uploading' && 'Saving document to secure storage.'}
                    {processingStatus === 'parsing' && 'Matching your skills and experience against job description requirements.'}
                  </p>
                </div>
              )}

              {processingStatus === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
                  <div className="error-icon-container">✕</div>
                  <h4 className="apply-processing-title" style={{ color: 'var(--error)' }}>Application Failed</h4>
                  <button className="apply-btn-retry" onClick={() => setProcessingStatus('idle')}>
                    Try Again
                  </button>
                </div>
              )}
            </section>

          </div>
        ) : (
          /* SUCCESS SCREEN */
          <section className="apply-success-card">
            <div className="success-icon-container">✓</div>
            <h1 className="success-title">Application Submitted!</h1>
            <p className="success-desc">
              Thank you for applying to the <strong>{role.role_title}</strong> role. 
              Our recruiting team has received your profile and will review it shortly.
            </p>
            <div className="success-footer">
              <span className="logo-container"><span className="logo-dot"></span>Hirely</span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

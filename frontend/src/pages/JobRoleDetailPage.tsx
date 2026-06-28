import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { jobRolesApi, candidatesApi, evaluationsApi, tasksApi } from '../api/hiring';
import type { JobRole, CandidateWithEvaluation, Evaluation } from '../types';
import './JobRoleDetailPage.css';

// ---- Inline Icons ----
const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const BriefcaseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const FilePdfIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="9" y1="15" x2="15" y2="15"></line>
    <line x1="9" y1="11" x2="11" y2="11"></line>
  </svg>
);

const UploadCloudIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.2 15c.7-1.2 1-2.5.7-3.9-.3-2-1.5-3.8-3.3-4.5-1.2-2.9-4.1-4.7-7.3-4.2-3.1.5-5.6 2.9-6.1 6-2 .7-3.2 2.6-3 4.7.3 2 1.9 3.6 4 3.9H17v.3"></path>
    <polyline points="16 16 12 12 8 16"></polyline>
    <line x1="12" y1="12" x2="12" y2="21"></line>
  </svg>
);

const AwardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="7"></circle>
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
  </svg>
);

const ShieldAlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

export default function JobRoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<JobRole | null>(null);
  const [candidates, setCandidates] = useState<CandidateWithEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals & Overlay states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [uploadTaskId, setUploadTaskId] = useState('');

  // Batch Evaluation states
  const [batchEvaluating, setBatchEvaluating] = useState(false);
  const [batchTaskId, setBatchTaskId] = useState('');
  const [batchMessage, setBatchMessage] = useState('');

  // Single Evaluation states
  const [evaluatingCandidates, setEvaluatingCandidates] = useState<Record<string, boolean>>({});
  
  // Share Link state
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!roleId) return;
    const url = `${window.location.origin}/apply/${roleId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Scorecard modal state
  const [activeScorecard, setActiveScorecard] = useState<{
    candidate: CandidateWithEvaluation;
    evaluation: Evaluation;
  } | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPollRef = useRef<NodeJS.Timeout | null>(null);
  const batchPollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (roleId) {
      fetchRoleDetails();
      fetchCandidatesList();
    }
    return () => {
      if (uploadPollRef.current) clearInterval(uploadPollRef.current);
      if (batchPollRef.current) clearInterval(batchPollRef.current);
    };
  }, [roleId]);

  const fetchRoleDetails = async () => {
    if (!roleId) return;
    try {
      const res = await jobRolesApi.get(roleId);
      setRole(res.data);
    } catch (err: any) {
      console.error('Error fetching role details:', err);
      setError(err.response?.data?.detail || 'Failed to load job role info.');
    }
  };

  const fetchCandidatesList = async () => {
    if (!roleId) return;
    try {
      const res = await jobRolesApi.getCandidates(roleId);
      setCandidates(res.data || []);
    } catch (err) {
      console.error('Error fetching candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll batch resume parsing task
  const startPollingUpload = (taskId: string) => {
    setUploadProgress('parsing');
    if (uploadPollRef.current) clearInterval(uploadPollRef.current);

    uploadPollRef.current = setInterval(async () => {
      try {
        const res = await tasksApi.get(taskId);
        const task = res.data;
        if (task.status === 'completed') {
          if (uploadPollRef.current) clearInterval(uploadPollRef.current);
          setUploadProgress('success');
          setSelectedFiles([]);
          setTimeout(() => {
            setShowUploadModal(false);
            setUploadProgress('idle');
            fetchCandidatesList();
          }, 1500);
        } else if (task.status === 'failed') {
          if (uploadPollRef.current) clearInterval(uploadPollRef.current);
          setUploadProgress('error');
          setUploadError(task.error || 'Parsing task failed.');
        }
      } catch (err) {
        console.error('Error polling upload task:', err);
      }
    }, 2000);
  };

  // Poll batch evaluation task
  const startPollingBatchEval = (taskId: string) => {
    setBatchEvaluating(true);
    if (batchPollRef.current) clearInterval(batchPollRef.current);

    batchPollRef.current = setInterval(async () => {
      try {
        const res = await tasksApi.get(taskId);
        const task = res.data;
        if (task.status === 'completed') {
          if (batchPollRef.current) clearInterval(batchPollRef.current);
          setBatchEvaluating(false);
          setBatchMessage('');
          fetchCandidatesList();
        } else if (task.status === 'failed') {
          if (batchPollRef.current) clearInterval(batchPollRef.current);
          setBatchEvaluating(false);
          setBatchMessage('Batch evaluation failed.');
          alert(`Batch evaluation failed: ${task.error}`);
        }
      } catch (err) {
        console.error('Error polling batch evaluation task:', err);
      }
    }, 2000);
  };

  // Handle uploading resumes
  const handleUploadResumes = async () => {
    if (selectedFiles.length === 0 || !roleId) return;
    setUploading(true);
    setUploadProgress('uploading');
    setUploadError('');

    try {
      let res;
      if (selectedFiles.length === 1) {
        res = await candidatesApi.upload(selectedFiles[0], roleId);
      } else {
        res = await candidatesApi.uploadBatch(selectedFiles, roleId);
      }
      const { task_id } = res.data;
      setUploadTaskId(task_id);
      startPollingUpload(task_id);
    } catch (err: any) {
      setUploadProgress('error');
      setUploadError(err.response?.data?.detail || 'Failed to upload candidate resumes.');
    } finally {
      setUploading(false);
    }
  };

  // Handle single candidate evaluation (Run synchronously)
  const handleEvaluateSingle = async (candidateId: string) => {
    if (!roleId) return;
    setEvaluatingCandidates(prev => ({ ...prev, [candidateId]: true }));
    try {
      const res = await evaluationsApi.get(roleId, candidateId);
      // Backend evaluated synchronously and returned scorecard directly
      fetchCandidatesList();
    } catch (err: any) {
      console.error('Error evaluating candidate:', err);
      alert(`Evaluation failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setEvaluatingCandidates(prev => ({ ...prev, [candidateId]: false }));
    }
  };

  // Handle batch evaluation trigger
  const handleTriggerBatchEvaluation = async () => {
    if (!roleId) return;
    const unevaluated = candidates.filter(c => !c.evaluation).map(c => c.candidate_id);
    if (unevaluated.length === 0) {
      alert('All candidates have already been evaluated.');
      return;
    }

    try {
      setBatchEvaluating(true);
      const res = await evaluationsApi.triggerBatch(roleId, unevaluated);
      const { task_id, message } = res.data;
      if (task_id) {
        setBatchTaskId(task_id);
        setBatchMessage(message || 'AI is evaluating candidates in the background...');
        startPollingBatchEval(task_id);
      } else {
        setBatchEvaluating(false);
        fetchCandidatesList();
      }
    } catch (err: any) {
      setBatchEvaluating(false);
      alert(`Failed to trigger batch evaluation: ${err.response?.data?.detail || err.message}`);
    }
  };

  // Handle open scorecard modal
  const handleOpenScorecard = async (candidate: CandidateWithEvaluation) => {
    if (!roleId) return;
    if (candidate.evaluation) {
      setActiveScorecard({
        candidate,
        evaluation: candidate.evaluation as unknown as Evaluation
      });
    } else {
      // If unevaluated, run synchronously to compute it
      setScorecardLoading(true);
      try {
        const res = await evaluationsApi.get(roleId, candidate.candidate_id);
        const evaluation = res.data;
        setActiveScorecard({
          candidate,
          evaluation
        });
        fetchCandidatesList();
      } catch (err: any) {
        alert(`Failed to compute evaluation: ${err.response?.data?.detail || err.message}`);
      } finally {
        setScorecardLoading(false);
      }
    }
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      const pdfs = filesArr.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (pdfs.length !== filesArr.length) {
        alert('Some selected files were ignored. Only PDF resumes are supported.');
      }
      setSelectedFiles(prev => [...prev, ...pdfs]);
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || 'R'}${lastName?.[0] || ''}`.toUpperCase();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getFitScoreClass = (score: number) => {
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    return 'score-poor';
  };

  const getDecisionClass = (decision: string) => {
    const dec = decision.toLowerCase();
    if (dec.includes('strong')) return 'decision-strong';
    if (dec.includes('training') || dec.includes('hire')) return 'decision-hire';
    return 'decision-reject';
  };

  if (loading) {
    return (
      <div className="detail-container">
        <header className="dashboard-header">
          <div className="header-left">
            <div className="logo-container"><span className="logo-dot"></span>Antigravity Hire</div>
          </div>
        </header>
        <div className="detail-loading">
          <div className="spinner"></div>
          <p>Loading Drive Details...</p>
        </div>
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="detail-container">
        <header className="dashboard-header">
          <div className="header-left">
            <div className="logo-container"><span className="logo-dot"></span>Antigravity Hire</div>
          </div>
        </header>
        <div className="detail-error">
          <h3>Oops! Something went wrong</h3>
          <p>{error || 'Drive details not found.'}</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-container">
      {/* HEADER */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-container">
            <span className="logo-dot"></span>
            Antigravity Hire
          </div>
          <nav className="nav-links">
            <Link to="/dashboard" className="nav-item">Drives</Link>
            <Link to="/candidates" className="nav-item">Candidates</Link>
            <Link to="/evaluations" className="nav-item">Evaluations</Link>
          </nav>
        </div>
        <div className="header-right">
          <div className="user-profile-widget">
            <div className="avatar-circle">
              {getInitials(user?.first_name, user?.last_name)}
            </div>
            <div className="user-widget-info">
              <span className="user-widget-name">{user?.first_name} {user?.last_name}</span>
              <span className="user-widget-company">{user?.current_company || 'Recruiter'}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>Sign Out</button>
        </div>
      </header>

      {/* BODY */}
      <main className="detail-body">
        {/* Navigation link back & Quick Actions */}
        <section className="detail-top-bar">
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            <ChevronLeftIcon /> Back to Drives
          </button>
          
          <div className="action-buttons-group">
            <button 
              className="btn-secondary" 
              onClick={() => setShowUploadModal(true)}
            >
              Upload Resumes
            </button>
            <button 
              className="btn-primary" 
              onClick={handleTriggerBatchEvaluation}
              disabled={batchEvaluating || candidates.filter(c => !c.evaluation).length === 0}
            >
              {batchEvaluating ? 'AI Evaluating...' : 'Evaluate All Candidates'}
            </button>
          </div>
        </section>

        {/* Batch message alert */}
        {batchEvaluating && (
          <div className="batch-status-banner">
            <div className="spinner spinner-sm"></div>
            <span>{batchMessage || 'Running batch evaluations in background... Please wait.'}</span>
          </div>
        )}

        {/* Layout Grid */}
        <div className="detail-grid">
          
          {/* LEFT PANEL: Job Description info */}
          <aside className="job-info-card">
            <div className="job-info-header">
              <span className="role-badge">{role.role_type || 'Full-Time'}</span>
              <h2 className="job-info-title">{role.role_title}</h2>
              <p className="job-info-exp">Experience level: <strong>{role.experience_level}</strong></p>
            </div>
            
            <div className="skills-section">
              <h4 className="skills-title">Must-Have Skills</h4>
              <div className="skills-list">
                {role.must_have_skills && role.must_have_skills.length > 0 ? (
                  role.must_have_skills.map((skill, idx) => (
                    <span key={idx} className="skill-pill must-have">{skill}</span>
                  ))
                ) : (
                  <span className="no-skills">None specified</span>
                )}
              </div>
            </div>

            <div className="skills-section">
              <h4 className="skills-title">Nice-to-Have Skills</h4>
              <div className="skills-list">
                {role.nice_to_have_skills && role.nice_to_have_skills.length > 0 ? (
                  role.nice_to_have_skills.map((skill, idx) => (
                    <span key={idx} className="skill-pill nice-to-have">{skill}</span>
                  ))
                ) : (
                  <span className="no-skills">None specified</span>
                )}
              </div>
            </div>

            <div className="share-link-section">
              <h4 className="skills-title">Share Application Link</h4>
              <p className="share-link-desc">Candidates can use this link to apply directly. Resumes will be automatically parsed and linked here.</p>
              <div className="share-link-box">
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}/apply/${roleId}`} 
                  className="share-link-input"
                />
                <button 
                  className={`btn-copy-link ${copied ? 'copied' : ''}`}
                  onClick={handleCopyLink}
                >
                  {copied ? 'Copied! ✓' : 'Copy Link'}
                </button>
              </div>
            </div>
          </aside>

          {/* RIGHT PANEL: Candidates List */}
          <section className="candidates-panel">
            <div className="panel-header">
              <h3 className="panel-title">Hiring Pipeline ({candidates.length} Resumes)</h3>
            </div>

            {candidates.length > 0 ? (
              <div className="candidates-list">
                {candidates.map(candidate => {
                  const evalInfo = candidate.evaluation;
                  const isEvaluating = evaluatingCandidates[candidate.candidate_id] || false;

                  return (
                    <div key={candidate.candidate_id} className="candidate-card">
                      <div className="cand-main-info">
                        <div className="cand-avatar">
                          {candidate.candidate_id.substring(5, 7).toUpperCase()}
                        </div>
                        <div className="cand-meta">
                          <h4 className="cand-name">Candidate: {candidate.candidate_id}</h4>
                          <p className="cand-exp">Experience: {candidate.experience_level || 'Not parsed'}</p>
                          <div className="cand-skills">
                            {candidate.skills && candidate.skills.slice(0, 5).map((skill, idx) => (
                              <span key={idx} className="cand-skill-pill">{skill}</span>
                            ))}
                            {candidate.skills && candidate.skills.length > 5 && (
                              <span className="cand-skill-pill-more">+{candidate.skills.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="cand-status-section">
                        {isEvaluating ? (
                          <div className="eval-status-loading">
                            <div className="spinner spinner-sm"></div>
                            <span>Analyzing...</span>
                          </div>
                        ) : evalInfo ? (
                          <div className="eval-scorecard-summary">
                            <div className={`score-badge ${getFitScoreClass(evalInfo.fit_score)}`}>
                              {evalInfo.fit_score}% Fit
                            </div>
                            <span className={`decision-badge ${getDecisionClass(evalInfo.decision)}`}>
                              {evalInfo.decision}
                            </span>
                            <button 
                              className="btn-view-scorecard"
                              onClick={() => handleOpenScorecard(candidate)}
                            >
                              View Details
                            </button>
                          </div>
                        ) : (
                          <div className="eval-trigger-section">
                            <span className="unevaluated-badge">Unevaluated</span>
                            <button 
                              className="btn-trigger-eval"
                              onClick={() => handleEvaluateSingle(candidate.candidate_id)}
                              disabled={batchEvaluating}
                            >
                              Run AI Evaluation
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="candidates-empty-state">
                <div className="empty-icon-container"><UsersIcon /></div>
                <h4>No candidate resumes uploaded yet</h4>
                <p>Upload PDFs to analyze candidates matching this job role.</p>
                <button className="btn-secondary" onClick={() => setShowUploadModal(true)}>
                  Upload Resumes Now
                </button>
              </div>
            )}
          </section>

        </div>
      </main>

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Upload Resumes</h3>
              <button 
                className="btn-close" 
                onClick={() => { if (!uploading) setShowUploadModal(false); }}
                disabled={uploading}
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="error-banner">
                {uploadError}
              </div>
            )}

            {uploadProgress === 'idle' && (
              <>
                <div 
                  className="dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/pdf"
                    multiple
                    style={{ display: 'none' }}
                  />
                  <div className="dropzone-icon">
                    <UploadCloudIcon />
                  </div>
                  <div className="dropzone-text">
                    Select Candidate Resume PDFs
                  </div>
                  <div className="dropzone-subtext">
                    Drag and drop or click to browse. Multiple PDFs supported.
                  </div>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="selected-files-list">
                    <div className="list-title">Selected Resumes ({selectedFiles.length})</div>
                    <div className="list-scroll">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="selected-file-container">
                          <div className="file-info">
                            <div className="file-icon"><FilePdfIcon /></div>
                            <div>
                              <div className="file-name">{file.name}</div>
                              <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
                            </div>
                          </div>
                          <button 
                            className="btn-remove-file"
                            onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowUploadModal(false)}>
                    Cancel
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={handleUploadResumes}
                    disabled={selectedFiles.length === 0}
                    style={{ opacity: selectedFiles.length > 0 ? 1 : 0.6 }}
                  >
                    Upload & Parse Resumes
                  </button>
                </div>
              </>
            )}

            {(uploadProgress === 'uploading' || uploadProgress === 'parsing' || uploadProgress === 'success') && (
              <div className="processing-container">
                {uploadProgress !== 'success' ? (
                  <div className="spinner"></div>
                ) : (
                  <div style={{ color: 'var(--success)', fontSize: '2.5rem' }}>✓</div>
                )}
                <h4 className="processing-title">
                  {uploadProgress === 'uploading' && 'Uploading PDFs...'}
                  {uploadProgress === 'parsing' && 'AI Parsing Resumes...'}
                  {uploadProgress === 'success' && 'Resumes Uploaded & Parsed Successfully!'}
                </h4>
                <p className="processing-desc">
                  {uploadProgress === 'uploading' && 'Transferring documents to cloud storage.'}
                  {uploadProgress === 'parsing' && 'Extracting candidate skills, experience level, red flags, and details.'}
                  {uploadProgress === 'success' && 'Updating hiring pipeline.'}
                </p>
              </div>
            )}

            {uploadProgress === 'error' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
                <div style={{ color: 'var(--error)', fontSize: '2.5rem' }}>✕</div>
                <h4 className="processing-title" style={{ color: 'var(--error)' }}>Upload Failed</h4>
                <button className="btn-primary" onClick={() => setUploadProgress('idle')}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCORECARD DETAIL MODAL */}
      {activeScorecard && (
        <div className="modal-overlay" onClick={() => setActiveScorecard(null)}>
          <div className="scorecard-modal" onClick={e => e.stopPropagation()}>
            <div className="scorecard-header">
              <div>
                <span className={`decision-badge ${getDecisionClass(activeScorecard.evaluation.decision)}`}>
                  {activeScorecard.evaluation.decision}
                </span>
                <h2 className="scorecard-title">AI Evaluation: {activeScorecard.candidate.candidate_id}</h2>
              </div>
              <button className="btn-close-scorecard" onClick={() => setActiveScorecard(null)}>✕</button>
            </div>

            <div className="scorecard-content">
              {/* Top summary cards */}
              <div className="scorecard-grid-top">
                <div className={`scorecard-stat-card fit-score-card ${getFitScoreClass(activeScorecard.evaluation.fit_score)}`}>
                  <div className="score-percent">{activeScorecard.evaluation.fit_score}%</div>
                  <div className="score-label">Overall Fit Score</div>
                </div>
                <div className="scorecard-stat-card detail-profile-info">
                  <div className="profile-info-item">
                    <span>Experience Level</span>
                    <strong>{activeScorecard.candidate.experience_level || 'Not parsed'}</strong>
                  </div>
                  <div className="profile-info-item">
                    <span>Evaluated On</span>
                    <strong>{formatDate(activeScorecard.evaluation.evaluated_at)}</strong>
                  </div>
                </div>
              </div>

              {/* Strengths & Gaps */}
              <div className="analysis-split">
                <div className="analysis-card strengths-card">
                  <h3 className="card-subtitle"><AwardIcon /> Strengths</h3>
                  <ul className="analysis-list">
                    {activeScorecard.evaluation.strengths && activeScorecard.evaluation.strengths.length > 0 ? (
                      activeScorecard.evaluation.strengths.map((str, i) => <li key={i}>{str}</li>)
                    ) : (
                      <li>No outstanding strengths identified.</li>
                    )}
                  </ul>
                </div>
                
                <div className="analysis-card gaps-card">
                  <h3 className="card-subtitle"><BriefcaseIcon /> Skills Gaps</h3>
                  <ul className="analysis-list">
                    {activeScorecard.evaluation.gaps && activeScorecard.evaluation.gaps.length > 0 ? (
                      activeScorecard.evaluation.gaps.map((gap, i) => <li key={i}>{gap}</li>)
                    ) : (
                      <li>No significant gaps identified.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Red flags */}
              <div className={`analysis-card red-flags-card ${activeScorecard.evaluation.red_flags && activeScorecard.evaluation.red_flags.length > 0 ? 'has-red-flags' : ''}`}>
                <h3 className="card-subtitle"><ShieldAlertIcon /> Red Flags</h3>
                <ul className="analysis-list">
                  {activeScorecard.evaluation.red_flags && activeScorecard.evaluation.red_flags.length > 0 ? (
                    activeScorecard.evaluation.red_flags.map((flag, i) => <li key={i} className="red-flag-item">{flag}</li>)
                  ) : (
                    <li>No red flags detected.</li>
                  )}
                </ul>
              </div>

              {/* Candidate Resume Details */}
              <div className="resume-extracted-section">
                <h3 className="section-title">Resume Summary (Extracted by AI)</h3>
                
                <div className="resume-section-item">
                  <h4>Experience Summary</h4>
                  <p>{activeScorecard.candidate.experience_summary || 'Not provided'}</p>
                </div>

                <div className="resume-section-item">
                  <h4>Extracted Skills</h4>
                  <div className="skills-list">
                    {activeScorecard.candidate.skills && activeScorecard.candidate.skills.length > 0 ? (
                      activeScorecard.candidate.skills.map((skill, idx) => (
                        <span key={idx} className="skill-pill plain">{skill}</span>
                      ))
                    ) : (
                      <span className="no-skills">None specified</span>
                    )}
                  </div>
                </div>

                <div className="resume-section-item">
                  <h4>Projects</h4>
                  <ul className="analysis-list plain">
                    {activeScorecard.candidate.projects && activeScorecard.candidate.projects.length > 0 ? (
                      activeScorecard.candidate.projects.map((proj, idx) => <li key={idx}>{proj}</li>)
                    ) : (
                      <li>No projects listed.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div className="scorecard-footer">
              <button className="btn-secondary" onClick={() => setActiveScorecard(null)}>
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SYNC SCORECARD LOADER OVERLAY */}
      {scorecardLoading && (
        <div className="modal-overlay">
          <div className="detail-loading">
            <div className="spinner"></div>
            <p>AI is evaluating Candidate Resumes synchronously against this Role...</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>This might take 10-15 seconds for LLM analysis.</p>
          </div>
        </div>
      )}
    </div>
  );
}

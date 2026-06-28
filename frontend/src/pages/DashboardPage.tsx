import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDrives } from '../context/DrivesContext';
import { drivesApi, jobRolesApi, tasksApi } from '../api/hiring';
import type { Drive } from '../types';
import './DashboardPage.css';

// ---- Inline Icons for Modern Aesthetics ----
const BriefcaseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
  </svg>
);

const UsersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const UploadCloudIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.2 15c.7-1.2 1-2.5.7-3.9-.3-2-1.5-3.8-3.3-4.5-1.2-2.9-4.1-4.7-7.3-4.2-3.1.5-5.6 2.9-6.1 6-2 .7-3.2 2.6-3 4.7.3 2 1.9 3.6 4 3.9H17v.3"></path>
    <polyline points="16 16 12 12 8 16"></polyline>
    <line x1="12" y1="12" x2="12" y2="21"></line>
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

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { drives, setDrives, loading, fetchDrives } = useDrives();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');
  const [currentTaskId, setCurrentTaskId] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // If drives are already loaded, fetch silently in the background (SWR pattern)
    fetchDrives(drives.length > 0);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Poll Task Status
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
          // Wait a bit to show success state, then refresh and close modal
          setTimeout(() => {
            setShowCreateModal(false);
            setProcessingStatus('idle');
            fetchDrives();
          }, 1500);
        } else if (task.status === 'failed') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setProcessingStatus('error');
          setUploadError(task.error || 'Parsing job description failed.');
        }
      } catch (err) {
        console.error('Error polling task status:', err);
      }
    }, 2000);
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setUploadError('Only PDF files are supported.');
        return;
      }
      setSelectedFile(file);
      setUploadError('');
    }
  };

  // Trigger file upload
  const handleUploadDrive = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');
    setProcessingStatus('uploading');

    try {
      const res = await jobRolesApi.upload(selectedFile);
      const { task_id } = res.data;
      setCurrentTaskId(task_id);
      startPollingTask(task_id);
    } catch (err: any) {
      setProcessingStatus('error');
      setUploadError(err.response?.data?.detail || 'Failed to upload job description.');
      setUploading(false);
    }
  };

  // Handle delete drive
  const handleDeleteDrive = async (driveId: string, title: string) => {
    if (confirm(`Are you sure you want to delete the hiring drive for "${title}"? This will permanently delete all candidate profiles and evaluations related to this drive.`)) {
      try {
        await drivesApi.delete(driveId);
        setDrives(prev => prev.filter(d => d.drive_id !== driveId));
      } catch (err) {
        console.error('Error deleting drive:', err);
        alert('Failed to delete drive. Please try again.');
      }
    }
  };

  const filteredDrives = drives.filter(d => 
    d.role_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Statistics calculation
  const totalDrives = drives.length;
  const totalCandidates = drives.reduce((sum, d) => sum + (d.candidate_count || 0), 0);
  const activeRoles = drives.filter(d => d.role_type?.toLowerCase() !== 'internship').length;

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || 'R'}${lastName?.[0] || ''}`.toUpperCase();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-container">
            <span className="logo-dot"></span>
            Antigravity Hire
          </div>
          <nav className="nav-links">
            <Link to="/dashboard" className="nav-item active">Drives</Link>
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
      <main className="dashboard-body">
        {/* Welcome Section */}
        <section className="welcome-section">
          <h1 className="welcome-title">Welcome back, {user?.first_name || 'Recruiter'} 👋</h1>
          <p className="welcome-subtitle">Here is the status of your current active hiring drives.</p>
        </section>

        {/* Stats Section */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper">
              <BriefcaseIcon />
            </div>
            <div className="stat-info">
              <span className="stat-value">{totalDrives}</span>
              <span className="stat-label">Total Drives</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper">
              <UsersIcon />
            </div>
            <div className="stat-info">
              <span className="stat-value">{totalCandidates}</span>
              <span className="stat-label">Candidates Screened</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper">
              <BriefcaseIcon />
            </div>
            <div className="stat-info">
              <span className="stat-value">{activeRoles}</span>
              <span className="stat-label">Full-Time Drives</span>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="drives-section">
          <div className="content-header">
            <h2 className="section-title">Active Hiring Drives</h2>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Search drives..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-1)',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem'
                }}
              />
              <button className="btn-primary" onClick={() => {
                setShowCreateModal(true);
                setProcessingStatus('idle');
                setSelectedFile(null);
                setUploadError('');
              }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>+</span> Create Drive
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div className="spinner"></div>
            </div>
          ) : filteredDrives.length > 0 ? (
            <div className="drives-grid">
              {filteredDrives.map(drive => (
                <div 
                  key={drive.drive_id} 
                  className="drive-card clickable"
                  onClick={(e) => {
                    // Prevent navigation when clicking the delete/trash action button
                    if ((e.target as HTMLElement).closest('.btn-card-delete')) return;
                    navigate(`/job-roles/${drive.role_id}`);
                  }}
                >
                  <div className="drive-card-top">
                    <div className="drive-meta">
                      <span className="drive-date">{formatDate(drive.created_at)}</span>
                      <span className="drive-badge">{drive.role_type || 'Full-Time'}</span>
                    </div>
                    <h3 className="drive-title" title={drive.role_title}>{drive.role_title}</h3>
                  </div>

                  <div className="drive-card-middle">
                    <div className="drive-stat">
                      <UsersIcon />
                      <span>Candidates: <strong className="drive-stat-val">{drive.candidate_count || 0}</strong></span>
                    </div>
                  </div>

                  <div className="drive-card-actions">
                    <button 
                      className="btn-card-view" 
                      onClick={() => navigate(`/job-roles/${drive.role_id}`)}
                    >
                      Manage Candidates
                    </button>
                    <button 
                      className="btn-card-delete" 
                      onClick={() => handleDeleteDrive(drive.drive_id, drive.role_title)}
                      title="Delete Drive"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon-container">
                <BriefcaseIcon />
              </div>
              <h3 className="empty-title">No hiring drives found</h3>
              <p className="empty-description">
                {searchQuery ? 'No drives match your search query.' : 'Get started by creating your first drive. Simply upload a Job Description PDF to start screening candidates.'}
              </p>
              {!searchQuery && (
                <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                  Create Your First Drive
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      {/* CREATE DRIVE MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Create Hiring Drive</h3>
              <button className="btn-close" onClick={() => {
                if (!uploading) setShowCreateModal(false);
              }}>✕</button>
            </div>

            {uploadError && (
              <div className="error-banner">
                {uploadError}
              </div>
            )}

            {processingStatus === 'idle' && (
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
                    style={{ display: 'none' }}
                  />
                  <div className="dropzone-icon">
                    <UploadCloudIcon />
                  </div>
                  <div className="dropzone-text">
                    {selectedFile ? 'Change Job Description PDF' : 'Upload Job Description PDF'}
                  </div>
                  <div className="dropzone-subtext">
                    Drag and drop or click to browse. Only PDF supported.
                  </div>
                </div>

                {selectedFile && (
                  <div className="selected-file-container" style={{ marginTop: '20px' }}>
                    <div className="file-info">
                      <div className="file-icon">
                        <FilePdfIcon />
                      </div>
                      <div>
                        <div className="file-name">{selectedFile.name}</div>
                        <div className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                    </div>
                    <button className="btn-remove-file" onClick={() => setSelectedFile(null)}>✕</button>
                  </div>
                )}

                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={handleUploadDrive}
                    disabled={!selectedFile}
                    style={{ opacity: selectedFile ? 1 : 0.6 }}
                  >
                    Upload & Parse JD
                  </button>
                </div>
              </>
            )}

            {(processingStatus === 'uploading' || processingStatus === 'parsing' || processingStatus === 'success') && (
              <div className="processing-container">
                {processingStatus !== 'success' ? (
                  <div className="spinner"></div>
                ) : (
                  <div style={{ color: 'var(--success)', fontSize: '2.5rem' }}>✓</div>
                )}
                <h4 className="processing-title">
                  {processingStatus === 'uploading' && 'Uploading PDF...'}
                  {processingStatus === 'parsing' && 'AI Parsing Job Description...'}
                  {processingStatus === 'success' && 'Drive Created Successfully!'}
                </h4>
                <p className="processing-desc">
                  {processingStatus === 'uploading' && 'Transferring document to cloud storage.'}
                  {processingStatus === 'parsing' && 'Extracting role title, must-have skills, nice-to-have skills, experience levels.'}
                  {processingStatus === 'success' && 'Redirecting to your dashboard.'}
                </p>
              </div>
            )}

            {processingStatus === 'error' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ color: 'var(--error)', fontSize: '2.5rem' }}>✕</div>
                <h4 className="processing-title" style={{ color: 'var(--error)' }}>Creation Failed</h4>
                <button className="btn-primary" onClick={() => setProcessingStatus('idle')}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FolderClosed, FileText, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';

interface Proposal {
  file_id: number;
  original_filename: string;
  current_folder_id: number | null;
  current_folder_name: string;
  suggested_folder_name: string;
  suggested_folder_id: number | null;
}

interface AIOrganizeProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AIOrganize: React.FC<AIOrganizeProps> = ({ showToast }) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const navigate = useNavigate();

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const data = await api.proposeOrganization();
      setProposals(data);
      // Auto select all by default
      setSelectedIds(data.map(p => p.file_id));
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch proposals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleToggleSelect = (fileId: number) => {
    if (selectedIds.includes(fileId)) {
      setSelectedIds(selectedIds.filter(id => id !== fileId));
    } else {
      setSelectedIds([...selectedIds, fileId]);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === proposals.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(proposals.map(p => p.file_id));
    }
  };

  const handleApproveSelected = async () => {
    if (selectedIds.length === 0) {
      showToast('No suggestions selected', 'info');
      return;
    }

    setExecuting(true);
    try {
      const actions = proposals
        .filter(p => selectedIds.includes(p.file_id))
        .map(p => ({
          file_id: p.file_id,
          suggested_folder_name: p.suggested_folder_name,
          suggested_folder_id: p.suggested_folder_id
        }));

      await api.executeOrganization(actions);
      showToast('Files organized successfully!', 'success');
      navigate('/files');
    } catch (err: any) {
      showToast(err.message || 'Failed to organize files', 'error');
    } finally {
      setExecuting(false);
    }
  };

  const handleApproveAll = async () => {
    setExecuting(true);
    try {
      const actions = proposals.map(p => ({
        file_id: p.file_id,
        suggested_folder_name: p.suggested_folder_name,
        suggested_folder_id: p.suggested_folder_id
      }));

      await api.executeOrganization(actions);
      showToast('All files organized successfully!', 'success');
      navigate('/files');
    } catch (err: any) {
      showToast(err.message || 'Failed to organize files', 'error');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Scanning root directory for suggestions...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1>AI File Organizer</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            AetherVault AI reviews files in your root space and proposes structured folder distributions.
          </p>
        </div>
        {proposals.length > 0 && (
          <button className="btn btn-secondary" onClick={fetchProposals} disabled={executing}>
            <RefreshCw size={16} /> Rescan
          </button>
        )}
      </div>

      {proposals.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6rem 0',
          border: '2px dashed var(--border-color)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <CheckCircle2 size={48} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
          <h3>Storage is perfectly structured!</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            No unstructured files were detected in your root directory.
          </p>
          <button className="btn btn-secondary" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      ) : (
        <div>
          {/* Header controls bar */}
          <div className="card glass" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                checked={selectedIds.length === proposals.length}
                onChange={handleToggleSelectAll}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                disabled={executing}
              />
              <span style={{ fontSize: '0.9375rem', fontWeight: '500' }}>
                Select All ({selectedIds.length} of {proposals.length})
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} disabled={executing}>
                <XCircle size={16} /> Cancel
              </button>
              <button className="btn btn-secondary" onClick={handleApproveSelected} disabled={executing || selectedIds.length === 0}>
                Approve Selected ({selectedIds.length})
              </button>
              <button className="btn btn-primary" onClick={handleApproveAll} disabled={executing}>
                Approve All ({proposals.length})
              </button>
            </div>
          </div>

          {/* Proposals List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {proposals.map(prop => (
              <div 
                key={prop.file_id} 
                className="card glass"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1.25rem',
                  gap: '1.5rem',
                  borderColor: selectedIds.includes(prop.file_id) ? 'var(--primary)' : 'var(--border-color)'
                }}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.includes(prop.file_id)}
                  onChange={() => handleToggleSelect(prop.file_id)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)', flexShrink: 0 }}
                  disabled={executing}
                />

                {/* Proposal content details */}
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden', minWidth: '220px', flex: 1 }}>
                    <FileText size={22} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    <span style={{ fontWeight: '500', fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {prop.original_filename}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                    {/* Origin */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem' }}>
                      <FolderClosed size={16} />
                      <span>{prop.current_folder_name}</span>
                    </div>

                    <ArrowRight size={16} style={{ color: 'var(--primary)' }} />

                    {/* Destination */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      fontSize: '0.875rem',
                      color: 'var(--text-main)',
                      fontWeight: '600',
                      padding: '0.375rem 0.75rem',
                      backgroundColor: 'var(--primary-light)',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      <FolderClosed size={16} style={{ color: 'var(--primary)' }} />
                      <span>
                        {prop.suggested_folder_name}
                        {prop.suggested_folder_id === null && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontStyle: 'italic', marginLeft: '0.375rem' }}>(New)</span>}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

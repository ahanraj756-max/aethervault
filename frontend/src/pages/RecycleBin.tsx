import React, { useEffect, useState } from 'react';
import { 
  Trash2, RotateCcw, Folder, File, AlertTriangle, RefreshCw, 
  Search, ShieldAlert, CheckCircle2, Clock, FileText, Image, Video, Music, Archive
} from 'lucide-react';
import { api } from '../utils/api';
import { formatBytes } from './Dashboard';

interface RecycleBinProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const RecycleBin: React.FC<RecycleBinProps> = ({ showToast }) => {
  const [loading, setLoading] = useState(true);
  const [trashedFiles, setTrashedFiles] = useState<any[]>([]);
  const [trashedFolders, setTrashedFolders] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'files' | 'folders'>('all');
  
  // Modals / Confirmation Dialogs
  const [confirmEmptyModal, setConfirmEmptyModal] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{ type: 'file' | 'folder'; item: any } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTrash = async () => {
    try {
      setLoading(true);
      const res = await api.getTrash();
      setTrashedFiles(res.files || []);
      setTrashedFolders(res.folders || []);
      setTotalItems(res.total_items || 0);
      setTotalSize(res.total_size || 0);
    } catch (err: any) {
      showToast(err.message || 'Failed to load Recycle Bin', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const handleRestoreFile = async (file: any) => {
    try {
      setActionLoading(true);
      await api.restoreFile(file.id);
      showToast(`Restored "${file.original_filename}" to My Files`, 'success');
      await fetchTrash();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore file', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDeleteFile = async (file: any) => {
    try {
      setActionLoading(true);
      await api.permanentDeleteFile(file.id);
      showToast(`Permanently deleted "${file.original_filename}"`, 'success');
      setConfirmDeleteModal(null);
      await fetchTrash();
    } catch (err: any) {
      showToast(err.message || 'Failed to permanently delete file', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreFolder = async (folder: any) => {
    try {
      setActionLoading(true);
      await api.restoreFolder(folder.id);
      showToast(`Restored folder "${folder.name}" and its contents`, 'success');
      await fetchTrash();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore folder', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDeleteFolder = async (folder: any) => {
    try {
      setActionLoading(true);
      await api.permanentDeleteFolder(folder.id);
      showToast(`Permanently deleted folder "${folder.name}"`, 'success');
      setConfirmDeleteModal(null);
      await fetchTrash();
    } catch (err: any) {
      showToast(err.message || 'Failed to permanently delete folder', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreAll = async () => {
    if (totalItems === 0) return;
    try {
      setActionLoading(true);
      const res = await api.restoreAllTrash();
      showToast(res.message || 'All items restored successfully', 'success');
      await fetchTrash();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore all items', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (totalItems === 0) return;
    try {
      setActionLoading(true);
      const res = await api.emptyTrash();
      showToast(res.message || 'Recycle Bin emptied successfully', 'success');
      setConfirmEmptyModal(false);
      await fetchTrash();
    } catch (err: any) {
      showToast(err.message || 'Failed to empty Recycle Bin', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { 
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      });
    } catch {
      return dateStr;
    }
  };

  const getFileIcon = (mimeType?: string, ext?: string) => {
    const mime = mimeType || '';
    const extension = (ext || '').toLowerCase();
    
    if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(extension)) {
      return <Image size={22} style={{ color: '#38bdf8' }} />;
    }
    if (mime.startsWith('video/') || ['.mp4', '.mkv', '.avi', '.mov', '.webm'].includes(extension)) {
      return <Video size={22} style={{ color: '#f43f5e' }} />;
    }
    if (mime.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(extension)) {
      return <Music size={22} style={{ color: '#a855f7' }} />;
    }
    if (['.zip', '.rar', '.tar', '.gz', '.7z'].includes(extension)) {
      return <Archive size={22} style={{ color: '#eab308' }} />;
    }
    if (['.pdf', '.doc', '.docx', '.txt', '.md', '.json', '.js', '.py'].includes(extension)) {
      return <FileText size={22} style={{ color: '#10b981' }} />;
    }
    return <File size={22} style={{ color: 'var(--text-muted)' }} />;
  };

  // Filtered lists
  const filteredFolders = trashedFolders.filter(f => 
    (filterType === 'all' || filterType === 'folders') &&
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = trashedFiles.filter(f => 
    (filterType === 'all' || filterType === 'files') &&
    f.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isTrashEmpty = trashedFiles.length === 0 && trashedFolders.length === 0;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Overview Card */}
      <div className="card glass" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.75rem 2rem',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1.5rem',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(30, 41, 59, 0.4) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--error)'
          }}>
            <Trash2 size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              Recycle Bin
              <span style={{
                fontSize: '0.8125rem',
                padding: '0.2rem 0.6rem',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: 'var(--error)',
                borderRadius: '999px',
                fontWeight: '600'
              }}>
                {totalItems} item{totalItems === 1 ? '' : 's'}
              </span>
            </h2>
            <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Items in the Recycle Bin take up storage space ({formatBytes(totalSize)}) until permanently deleted.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary"
            onClick={fetchTrash}
            disabled={loading || actionLoading}
            title="Refresh Recycle Bin"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button 
            className="btn btn-secondary"
            onClick={handleRestoreAll}
            disabled={isTrashEmpty || actionLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RotateCcw size={16} />
            <span>Restore All</span>
          </button>

          <button 
            className="btn btn-danger"
            onClick={() => setConfirmEmptyModal(true)}
            disabled={isTrashEmpty || actionLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--error)',
              color: '#fff',
              border: 'none'
            }}
          >
            <Trash2 size={16} />
            <span>Empty Recycle Bin</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search deleted items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-input)',
          padding: '0.25rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)'
        }}>
          {(['all', 'folders', 'files'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              style={{
                padding: '0.4rem 1rem',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: filterType === tab ? 'var(--primary)' : 'transparent',
                color: filterType === tab ? '#fff' : 'var(--text-muted)',
                fontWeight: '500',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s ease'
              }}
            >
              {tab === 'all' ? `All (${trashedFolders.length + trashedFiles.length})` : 
               tab === 'folders' ? `Folders (${trashedFolders.length})` : 
               `Files (${trashedFiles.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Items Display */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0' }}>
          <RefreshCw size={36} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading Recycle Bin contents...</p>
        </div>
      ) : isTrashEmpty ? (
        /* Empty State */
        <div className="card glass" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5rem 2rem',
          textAlign: 'center',
          border: '2px dashed var(--border-color)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--success)',
            marginBottom: '1.5rem'
          }}>
            <CheckCircle2 size={36} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Your Recycle Bin is empty</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
            When you delete files or folders from your vault, they will be kept here safely so you can restore them whenever you need.
          </p>
        </div>
      ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <p>No deleted items match "{searchQuery}"</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Folders Section */}
          {filteredFolders.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Deleted Folders ({filteredFolders.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {filteredFolders.map(folder => (
                  <div key={folder.id} className="card glass" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                      <div style={{
                        padding: '0.625rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--error)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Folder size={24} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '0.9375rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }} title={folder.name}>
                          {folder.name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <Clock size={12} />
                          <span>Deleted {formatDate(folder.trashed_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.5rem',
                      marginTop: '1.25rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-color)'
                    }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleRestoreFolder(folder)}
                        disabled={actionLoading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.75rem',
                          padding: '0.35rem 0.75rem'
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>Restore</span>
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setConfirmDeleteModal({ type: 'folder', item: folder })}
                        disabled={actionLoading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.75rem',
                          padding: '0.35rem 0.75rem',
                          color: 'var(--error)',
                          borderColor: 'rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete Forever</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files Section */}
          {filteredFiles.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Deleted Files ({filteredFiles.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {filteredFiles.map(file => (
                  <div key={file.id} className="card glass" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                      <div style={{
                        padding: '0.625rem',
                        backgroundColor: 'var(--bg-input)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {getFileIcon(file.mime_type, file.extension)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '0.9375rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }} title={file.original_filename}>
                          {file.original_filename}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span style={{ fontWeight: '500' }}>{formatBytes(file.file_size)}</span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={12} />
                            {formatDate(file.trashed_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.5rem',
                      marginTop: '1.25rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-color)'
                    }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleRestoreFile(file)}
                        disabled={actionLoading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.75rem',
                          padding: '0.35rem 0.75rem'
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>Restore</span>
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setConfirmDeleteModal({ type: 'file', item: file })}
                        disabled={actionLoading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.75rem',
                          padding: '0.35rem 0.75rem',
                          color: 'var(--error)',
                          borderColor: 'rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete Forever</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty Recycle Bin Confirmation Modal */}
      {confirmEmptyModal && (
        <div className="modal-overlay" onClick={() => setConfirmEmptyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--error)' }}>
              <ShieldAlert size={24} />
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Empty Recycle Bin?</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.5', margin: '0 0 1.5rem 0' }}>
              Are you sure you want to permanently delete all <strong>{totalItems}</strong> item(s) totaling <strong>{formatBytes(totalSize)}</strong>? 
              <br /><br />
              <span style={{ color: 'var(--error)', fontWeight: '600' }}>This action cannot be undone.</span>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setConfirmEmptyModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleEmptyTrash}
                disabled={actionLoading}
                style={{ backgroundColor: 'var(--error)', color: '#fff', border: 'none' }}
              >
                {actionLoading ? 'Deleting...' : 'Empty Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Item Permanent Delete Confirmation Modal */}
      {confirmDeleteModal && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--error)' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Delete Permanently?</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.5', margin: '0 0 1.5rem 0' }}>
              Are you sure you want to permanently delete{' '}
              <strong>
                "{confirmDeleteModal.type === 'file' 
                  ? confirmDeleteModal.item.original_filename 
                  : confirmDeleteModal.item.name}"
              </strong>?
              {confirmDeleteModal.type === 'file' && (
                <> ({formatBytes(confirmDeleteModal.item.file_size)})</>
              )}
              <br /><br />
              This item will be wiped from disk and cannot be recovered.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setConfirmDeleteModal(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => {
                  if (confirmDeleteModal.type === 'file') {
                    handlePermanentDeleteFile(confirmDeleteModal.item);
                  } else {
                    handlePermanentDeleteFolder(confirmDeleteModal.item);
                  }
                }}
                disabled={actionLoading}
                style={{ backgroundColor: 'var(--error)', color: '#fff', border: 'none' }}
              >
                {actionLoading ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

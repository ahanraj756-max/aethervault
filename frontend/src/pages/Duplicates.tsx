import React, { useEffect, useState } from 'react';
import { Copy, Trash2, FolderClosed, FileWarning, CheckCircle } from 'lucide-react';
import { api } from '../utils/api';
import { formatBytes } from './Dashboard';

interface DuplicateFile {
  id: number;
  original_filename: string;
  folder_id: number | null;
  file_size: number;
  created_at: string;
}

interface DuplicateGroup {
  file_hash: string;
  file_size: number;
  locations: DuplicateFile[];
  num_duplicates: number;
}

interface DuplicatesProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const Duplicates: React.FC<DuplicatesProps> = ({ showToast }) => {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [foldersMap, setFoldersMap] = useState<Record<number, string>>({});

  const fetchDuplicates = async () => {
    try {
      setLoading(true);
      const [dupData, foldersData] = await Promise.all([
        api.scanDuplicates(),
        api.listFolders(null)
      ]);
      setGroups(dupData);
      
      // Map folder IDs to folder names for display
      const map: Record<number, string> = {};
      const list: any[] = foldersData.folders || [];
      list.forEach(f => {
        map[f.id] = f.name;
      });
      setFoldersMap(map);
    } catch (err: any) {
      showToast(err.message || 'Error scanning duplicate files', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const handleDeleteCopy = async (file: DuplicateFile) => {
    if (!window.confirm(`Are you sure you want to delete this specific duplicate copy "${file.original_filename}"? This will free up ${formatBytes(file.file_size)} of storage space.`)) return;

    try {
      await api.deleteFile(file.id);
      showToast('Duplicate copy deleted', 'success');
      // Refresh
      fetchDuplicates();
    } catch (err: any) {
      showToast(err.message || 'Delete copy failed', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Scanning file hashes for duplicates...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Duplicate Files Scanner</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Identify duplicate files based on cryptographic SHA-256 signatures and clean them up to reclaim storage.
        </p>
      </div>

      {groups.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6rem 0',
          border: '2px dashed var(--border-color)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
          <h3>No duplicates found!</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            All files in your AetherVault storage represent unique hash footprints.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {groups.map((group, idx) => (
            <div key={idx} className="card glass" style={{ borderLeft: '4px solid var(--warning)' }}>
              {/* Group Header Info */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '0.75rem',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileWarning size={20} style={{ color: 'var(--warning)' }} />
                  <div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Hash: {group.file_hash.substring(0, 24)}...
                    </span>
                    <h4 style={{ margin: 0 }}>{group.locations[0].original_filename}</h4>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'block' }}>Duplicate count: {group.num_duplicates}</span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: '600' }}>Size: {formatBytes(group.file_size)}</span>
                </div>
              </div>

              {/* Group list details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {group.locations.map((loc, lIdx) => (
                  <div key={lIdx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
                      <Copy size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden' }}>
                        <span style={{
                          fontWeight: '500', fontSize: '0.875rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {loc.original_filename}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <FolderClosed size={12} />
                          <span>{loc.folder_id ? foldersMap[loc.folder_id] || `Folder #${loc.folder_id}` : '/ (Root)'}</span>
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Uploaded: {new Date(loc.created_at).toLocaleDateString()}
                      </span>
                      
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => handleDeleteCopy(loc)}
                      >
                        <Trash2 size={12} /> Remove copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

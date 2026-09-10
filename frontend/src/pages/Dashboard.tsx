import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardDrive, Files, FolderOpen, AlertCircle, FileText, Image, Video, Music, Archive, LayoutGrid } from 'lucide-react';
import { api } from '../utils/api';

// Size humanizer helper
export const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [largest, setLargest] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [proposalsCount, setProposalsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // 1. Fetch core stats fast (instant DB queries)
        const [statsData, largestData, recentData] = await Promise.all([
          api.getStorageStats(),
          api.getLargestFiles(),
          api.getRecentFiles(),
        ]);
        setStats(statsData);
        setLargest(largestData);
        setRecent(recentData);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setLoading(false);
      }

      // 2. Fetch AI organization proposals asynchronously in background (won't block UI)
      try {
        const proposalsData = await api.proposeOrganization();
        setProposalsCount(proposalsData?.length || 0);
      } catch (err) {
        console.error('Error fetching proposals:', err);
      }
    };
    fetchDashboardData();
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'document': return <FileText size={20} style={{ color: '#3b82f6' }} />;
      case 'image': return <Image size={20} style={{ color: '#10b981' }} />;
      case 'video': return <Video size={20} style={{ color: '#ec4899' }} />;
      case 'audio': return <Music size={20} style={{ color: '#eab308' }} />;
      case 'archive': return <Archive size={20} style={{ color: '#a855f7' }} />;
      default: return <LayoutGrid size={20} style={{ color: '#64748b' }} />;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading storage statistics...</p>
      </div>
    );
  }

  const quota = stats?.total_quota || 0;
  const used = stats?.used_storage || 0;
  const available = stats?.available_storage || 0;
  const percent = stats?.usage_percentage || 0;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Storage Dashboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>Monitor your private storage allocation and folder health status.</p>
      </div>

      {/* AI Suggestion Banner */}
      {proposalsCount > 0 && (
        <div className="card glass" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 2rem',
          borderLeft: '4px solid var(--primary)',
          marginBottom: '2rem',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ color: 'var(--primary)' }}><AlertCircle size={28} /></div>
            <div>
              <h4 style={{ margin: 0 }}>Intelligent File Organizer suggestions</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                AetherVault AI has detected {proposalsCount} files in the root folder that could be classified into custom folders.
              </p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/organize')}>
            Review suggestions
          </button>
        </div>
      )}

      {/* Statistics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem',
        marginBottom: '2.5rem'
      }}>
        {/* Core Quota Card */}
        <div className="card glass" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Used Space</span>
              <h2 style={{ fontSize: '2rem', margin: '0.25rem 0' }}>{formatBytes(used)}</h2>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
              <HardDrive size={24} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Quota Usage</span>
              <span style={{ fontWeight: '600' }}>{percent}%</span>
            </div>
            <div style={{ height: '8px', backgroundColor: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${percent}%`,
                backgroundColor: percent > 90 ? 'var(--error)' : percent > 75 ? 'var(--warning)' : 'var(--primary)',
                borderRadius: '4px',
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <span>Available: {formatBytes(available)}</span>
            <span>Total: {formatBytes(quota)}</span>
          </div>
        </div>

        {/* Quantities Card */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card glass" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ padding: '0.75rem', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', marginBottom: '0.75rem' }}>
              <Files size={24} />
            </div>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Files</span>
            <h2 style={{ fontSize: '1.75rem', marginTop: '0.25rem' }}>{stats?.num_files || 0}</h2>
          </div>

          <div className="card glass" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ padding: '0.75rem', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', marginBottom: '0.75rem' }}>
              <FolderOpen size={24} />
            </div>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Folders</span>
            <h2 style={{ fontSize: '1.75rem', marginTop: '0.25rem' }}>{stats?.num_folders || 0}</h2>
          </div>
        </div>
      </div>

      {/* File Category Breakdown */}
      <div className="card glass" style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Storage Breakdown</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1.5rem'
        }}>
          {stats?.storage_by_type && Object.entries(stats.storage_by_type).map(([category, size]) => (
            <div key={category} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)'
            }}>
              {getCategoryIcon(category)}
              <div>
                <span style={{ textTransform: 'capitalize', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                  {category}
                </span>
                <span style={{ fontWeight: '600', fontSize: '0.9375rem' }}>{formatBytes(size as number)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lists of Recent & Largest files */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '2.5rem'
      }}>
        {/* Recent Uploads */}
        <div className="card glass">
          <h3 style={{ marginBottom: '1.25rem' }}>Recent Uploads</h3>
          {recent.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No files uploaded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {recent.map(file => (
                <div key={file.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <div style={{ overflow: 'hidden', marginRight: '1rem' }}>
                    <span style={{
                      fontWeight: '500',
                      fontSize: '0.9375rem',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.original_filename}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatBytes(file.file_size)}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(file.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Largest Files */}
        <div className="card glass">
          <h3 style={{ marginBottom: '1.25rem' }}>Largest Files</h3>
          {largest.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No files stored yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {largest.map(file => (
                <div key={file.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <div style={{ overflow: 'hidden', marginRight: '1rem' }}>
                    <span style={{
                      fontWeight: '500',
                      fontSize: '0.9375rem',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.original_filename}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{file.mime_type}</span>
                  </div>
                  <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    {formatBytes(file.file_size)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

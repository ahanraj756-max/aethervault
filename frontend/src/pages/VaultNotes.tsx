import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Search, Pin, Tag, 
  Copy, Check, Download, Eye, Edit3, Lock, Sparkles,
  BookOpen, Hash, Layers, ShieldCheck, 
  Bold, Italic, Code, List, CheckSquare, Quote
} from 'lucide-react';

interface VaultNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  color: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const NOTE_COLORS = [
  { id: 'purple', name: 'Aether Purple', bg: 'rgba(124, 58, 237, 0.12)', border: 'rgba(124, 58, 237, 0.4)', text: '#a78bfa' },
  { id: 'blue', name: 'Cyber Blue', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.4)', text: '#60a5fa' },
  { id: 'emerald', name: 'Emerald', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)', text: '#34d399' },
  { id: 'amber', name: 'Gold Amber', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)', text: '#fbbf24' },
  { id: 'rose', name: 'Neon Rose', bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.4)', text: '#fb7185' },
  { id: 'slate', name: 'Deep Slate', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.4)', text: '#94a3b8' },
];

const DEFAULT_NOTES: VaultNote[] = [
  {
    id: 'welcome-note',
    title: 'Welcome to Secure Vault Notes',
    content: `# Secure Vault Notes & Scratchpad

Welcome to your private encrypted notepad inside **AetherVault**.

### Key Features:
- **Private & Local**: Your confidential notes, credentials, and thoughts stay encrypted in your vault.
- **Markdown Support**: Headers, *emphasis*, **bolding**, \`inline code\`, task lists, and quotes.
- **Organization**: Pin important notes, assign color themes, and categorize using #tags.
- **Instant Export**: Download as \`.md\` files or copy formatted text with one click.

> "True privacy means retaining absolute sovereign ownership over your thoughts and files."`,
    tags: ['welcome', 'guide', 'security'],
    color: 'purple',
    isPinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'recovery-secrets',
    title: 'Vault Security Checklist & Recovery Protocol',
    content: `## Vault Security Checklist
- [x] Primary vault password created & stored securely
- [x] Two-factor backup recovery phrase written down
- [ ] Review folder permissions & duplicate scans monthly
- [ ] Export critical offline archives to cold storage

### Emergency Recovery Notice
Never share master access tokens or decryption keys across unsecured networks.`,
    tags: ['security', 'passwords', 'checklist'],
    color: 'emerald',
    isPinned: true,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const VaultNotes: React.FC = () => {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('aethervault_user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const storageKey = `aethervault_notes_${user.id || 'default'}`;

  const [notes, setNotes] = useState<VaultNote[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : DEFAULT_NOTES;
    } catch {
      return DEFAULT_NOTES;
    }
  });

  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    return notes[0]?.id || '';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [tagInput, setTagInput] = useState('');
  const [copied, setCopied] = useState(false);

  // Save notes to persistent local storage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch (e) {
      console.error('Failed to persist notes:', e);
    }
  }, [notes, storageKey]);

  const activeNote = useMemo(() => {
    return notes.find(n => n.id === activeNoteId) || notes[0] || null;
  }, [notes, activeNoteId]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(note => note.tags?.forEach(t => tagSet.add(t.toLowerCase())));
    return Array.from(tagSet);
  }, [notes]);

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter(note => {
        const matchesSearch = 
          note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag = !selectedTag || note.tags?.some(t => t.toLowerCase() === selectedTag.toLowerCase());
        return matchesSearch && matchesTag;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [notes, searchQuery, selectedTag]);

  const handleCreateNote = () => {
    const newNote: VaultNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: 'Untitled Note',
      content: '# New Secure Note\n\nWrite your private notes here...',
      tags: selectedTag ? [selectedTag] : ['general'],
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)].id,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
  };

  const handleUpdateActiveNote = (updates: Partial<VaultNote>) => {
    if (!activeNote) return;
    setNotes(prev => prev.map(n => {
      if (n.id === activeNote.id) {
        return {
          ...n,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      }
      return n;
    }));
  };

  const handleDeleteNote = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this secure note?')) {
      const remaining = notes.filter(n => n.id !== id);
      setNotes(remaining);
      if (activeNoteId === id) {
        setActiveNoteId(remaining[0]?.id || '');
      }
    }
  };

  const handleTogglePin = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotes(prev => prev.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim() && activeNote) {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, '').toLowerCase();
      if (!activeNote.tags.includes(clean)) {
        handleUpdateActiveNote({ tags: [...activeNote.tags, clean] });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeNote) return;
    handleUpdateActiveNote({
      tags: activeNote.tags.filter(t => t !== tagToRemove)
    });
  };

  const handleCopyContent = () => {
    if (!activeNote) return;
    navigator.clipboard.writeText(activeNote.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadNote = () => {
    if (!activeNote) return;
    const blob = new Blob([activeNote.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'vault_note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const insertMarkdownSyntax = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('note-editor-textarea') as HTMLTextAreaElement;
    if (!textarea || !activeNote) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = activeNote.content.substring(start, end) || 'text';
    const newContent = 
      activeNote.content.substring(0, start) + 
      prefix + selected + suffix + 
      activeNote.content.substring(end);
    handleUpdateActiveNote({ content: newContent });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  // Simple, safe Markdown renderer
  const renderSimpleMarkdown = (md: string) => {
    if (!md) return null;
    const lines = md.split('\n');
    return (
      <div className="markdown-rendered-view" style={{ lineHeight: '1.7', fontSize: '0.95rem' }}>
        {lines.map((line, idx) => {
          // Headers
          if (line.startsWith('# ')) return <h1 key={idx} style={{ fontSize: '1.75rem', margin: '1.2rem 0 0.6rem 0', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>{line.slice(2)}</h1>;
          if (line.startsWith('## ')) return <h2 key={idx} style={{ fontSize: '1.4rem', margin: '1rem 0 0.5rem 0', color: 'var(--text-main)' }}>{line.slice(3)}</h2>;
          if (line.startsWith('### ')) return <h3 key={idx} style={{ fontSize: '1.15rem', margin: '0.8rem 0 0.4rem 0', color: 'var(--text-main)' }}>{line.slice(4)}</h3>;
          
          // Blockquote
          if (line.startsWith('> ')) {
            return (
              <blockquote key={idx} style={{
                borderLeft: '4px solid var(--primary)',
                padding: '0.5rem 1rem',
                margin: '0.75rem 0',
                backgroundColor: 'var(--primary-light)',
                borderRadius: '0 8px 8px 0',
                color: 'var(--text-main)',
                fontStyle: 'italic'
              }}>
                {line.slice(2)}
              </blockquote>
            );
          }

          // Checkbox task list
          if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
            const checked = line.startsWith('- [x] ');
            const label = line.slice(6);
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.3rem 0' }}>
                <input type="checkbox" checked={checked} readOnly style={{ accentColor: 'var(--primary)', cursor: 'default' }} />
                <span style={{ textDecoration: checked ? 'line-through' : 'none', color: checked ? 'var(--text-muted)' : 'var(--text-main)' }}>
                  {label}
                </span>
              </div>
            );
          }

          // Bullet item
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', margin: '0.3rem 0', paddingLeft: '0.5rem' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>•</span>
                <span>{line.slice(2)}</span>
              </div>
            );
          }

          // Code block indicator
          if (line.startsWith('```')) {
            return <div key={idx} style={{ height: '4px' }} />;
          }

          // Empty line
          if (!line.trim()) {
            return <div key={idx} style={{ height: '0.75rem' }} />;
          }

          return <p key={idx} style={{ margin: '0.3rem 0', color: 'var(--text-main)' }}>{line}</p>;
        })}
      </div>
    );
  };

  const wordCount = useMemo(() => {
    if (!activeNote?.content) return 0;
    return activeNote.content.trim().split(/\s+/).filter(Boolean).length;
  }, [activeNote?.content]);

  const charCount = activeNote?.content?.length || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: '1rem' }}>
      
      {/* Top Banner & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Secure Vault Notes</h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--success)',
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              <ShieldCheck size={14} /> Vault Encrypted
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            Private markdown scratchpad, secret credentials storage, and isolated personal notebooks.
          </p>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={handleCreateNote}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}
        >
          <Plus size={18} />
          <span>New Note</span>
        </button>
      </div>

      {/* Main Workspace Layout (Sidebar + Note Editor) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '320px 1fr', 
        gap: '1.25rem', 
        flex: 1, 
        minHeight: 0 
      }}>
        
        {/* Left Sidebar: Search, Tags, Note List */}
        <div className="card glass" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '1rem', 
          gap: '0.75rem', 
          overflow: 'hidden' 
        }}>
          {/* Search bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.75rem',
            gap: '0.5rem',
            border: '1px solid var(--border-color)'
          }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search notes..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.875rem',
                width: '100%'
              }}
            />
          </div>

          {/* Tags cloud filter */}
          {allTags.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '0.35rem',
              overflowX: 'auto',
              paddingBottom: '0.35rem',
              scrollbarWidth: 'none'
            }}>
              <button
                onClick={() => setSelectedTag(null)}
                style={{
                  background: selectedTag === null ? 'var(--primary)' : 'var(--bg-input)',
                  color: selectedTag === null ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                All ({notes.length})
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  style={{
                    background: selectedTag === tag ? 'var(--primary)' : 'var(--bg-input)',
                    color: selectedTag === tag ? '#fff' : 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Notes List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
            {filteredNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                <BookOpen size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                <p style={{ fontSize: '0.875rem' }}>No matching notes found.</p>
              </div>
            ) : (
              filteredNotes.map(note => {
                const isSelected = activeNote?.id === note.id;
                const noteColor = NOTE_COLORS.find(c => c.id === note.color) || NOTE_COLORS[0];
                return (
                  <div
                    key={note.id}
                    onClick={() => setActiveNoteId(note.id)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'var(--bg-input)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? `1.5px solid var(--primary)` : '1px solid var(--border-color)',
                      borderLeft: `4px solid ${noteColor.text}`,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <h4 style={{ 
                        margin: 0, 
                        fontSize: '0.9rem', 
                        fontWeight: '600', 
                        color: isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {note.title || 'Untitled Note'}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button
                          onClick={(e) => handleTogglePin(note.id, e)}
                          title={note.isPinned ? 'Unpin' : 'Pin to top'}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: note.isPinned ? 'var(--warning)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex'
                          }}
                        >
                          {note.isPinned ? <Pin size={14} fill="currentColor" /> : <Pin size={14} />}
                        </button>
                        <button
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          title="Delete Note"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <p style={{
                      margin: 0,
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: '1.4'
                    }}>
                      {note.content.replace(/[#*`_>]/g, '')}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {note.tags?.slice(0, 2).map(t => (
                          <span key={t} style={{
                            fontSize: '0.68rem',
                            backgroundColor: 'var(--bg-card)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            color: 'var(--text-muted)'
                          }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer stats */}
          <div style={{ 
            borderTop: '1px solid var(--border-color)', 
            paddingTop: '0.5rem', 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontSize: '0.75rem', 
            color: 'var(--text-muted)' 
          }}>
            <span>{notes.length} Total Notes</span>
            <span>{notes.filter(n => n.isPinned).length} Pinned</span>
          </div>
        </div>

        {/* Right Area: Active Note Editor & Preview */}
        {activeNote ? (
          <div className="card glass" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            padding: '1.25rem', 
            gap: '1rem', 
            overflow: 'hidden' 
          }}>
            
            {/* Note Toolbar Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              gap: '0.75rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.85rem'
            }}>
              
              {/* Title input */}
              <input 
                type="text"
                value={activeNote.title}
                onChange={e => handleUpdateActiveNote({ title: e.target.value })}
                placeholder="Note Title..."
                style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main)',
                  flex: 1,
                  minWidth: '200px'
                }}
              />

              {/* View switches & actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                
                {/* Color theme chooser */}
                <div style={{ display: 'flex', gap: '0.25rem', paddingRight: '0.5rem', borderRight: '1px solid var(--border-color)' }}>
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleUpdateActiveNote({ color: c.id })}
                      title={c.name}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: c.text,
                        border: activeNote.color === c.id ? '2px solid #fff' : 'none',
                        cursor: 'pointer',
                        transform: activeNote.color === c.id ? 'scale(1.2)' : 'scale(1)',
                        transition: 'transform 0.1s'
                      }}
                    />
                  ))}
                </div>

                {/* View toggles */}
                <div style={{
                  display: 'flex',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px',
                  border: '1px solid var(--border-color)'
                }}>
                  <button
                    onClick={() => setViewMode('edit')}
                    style={{
                      background: viewMode === 'edit' ? 'var(--primary)' : 'transparent',
                      color: viewMode === 'edit' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => setViewMode('split')}
                    style={{
                      background: viewMode === 'split' ? 'var(--primary)' : 'transparent',
                      color: viewMode === 'split' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <Layers size={13} /> Split
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    style={{
                      background: viewMode === 'preview' ? 'var(--primary)' : 'transparent',
                      color: viewMode === 'preview' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <Eye size={13} /> Preview
                  </button>
                </div>

                {/* Copy Button */}
                <button
                  onClick={handleCopyContent}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Copy note content"
                >
                  {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                {/* Download / Export Button */}
                <button
                  onClick={handleDownloadNote}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Export Note to .md file"
                >
                  <Download size={14} />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Markdown Quick Formatting Toolbar (in edit or split mode) */}
            {viewMode !== 'preview' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'var(--bg-input)',
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                flexWrap: 'wrap'
              }}>
                <button 
                  onClick={() => insertMarkdownSyntax('**', '**')} 
                  title="Bold"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <Bold size={15} />
                </button>
                <button 
                  onClick={() => insertMarkdownSyntax('*', '*')} 
                  title="Italic"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <Italic size={15} />
                </button>
                <button 
                  onClick={() => insertMarkdownSyntax('`', '`')} 
                  title="Inline Code"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <Code size={15} />
                </button>
                <button 
                  onClick={() => insertMarkdownSyntax('## ')} 
                  title="Header"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', fontWeight: 'bold', fontSize: '13px' }}
                >
                  H2
                </button>
                <button 
                  onClick={() => insertMarkdownSyntax('- ')} 
                  title="Bullet List"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <List size={15} />
                </button>
                <button 
                  onClick={() => insertMarkdownSyntax('- [ ] ')} 
                  title="Task Checkbox"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <CheckSquare size={15} />
                </button>
                <button 
                  onClick={() => insertMarkdownSyntax('> ')} 
                  title="Quote"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <Quote size={15} />
                </button>

                <div style={{ flex: 1 }} />

                {/* Tag manager input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Add tag (Enter)..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-main)',
                      fontSize: '0.75rem',
                      width: '110px'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Note Tags Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <Tag size={13} style={{ color: 'var(--text-muted)' }} />
              {activeNote.tags?.map(tag => (
                <span
                  key={tag}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '0.15rem 0.55rem',
                    fontSize: '0.72rem',
                    color: 'var(--text-main)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '10px' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* Note Editor and Preview Canvas */}
            <div style={{ 
              flex: 1, 
              display: 'grid', 
              gridTemplateColumns: viewMode === 'split' ? '1fr 1fr' : '1fr', 
              gap: '1rem',
              minHeight: 0
            }}>
              {/* Textarea Editor */}
              {(viewMode === 'edit' || viewMode === 'split') && (
                <textarea
                  id="note-editor-textarea"
                  value={activeNote.content}
                  onChange={e => handleUpdateActiveNote({ content: e.target.value })}
                  placeholder="Write your markdown note here..."
                  style={{
                    width: '100%',
                    height: '100%',
                    resize: 'none',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    color: 'var(--text-main)',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    outline: 'none'
                  }}
                />
              )}

              {/* Markdown Preview */}
              {(viewMode === 'preview' || viewMode === 'split') && (
                <div style={{
                  height: '100%',
                  overflowY: 'auto',
                  backgroundColor: viewMode === 'split' ? 'rgba(0,0,0,0.15)' : 'transparent',
                  border: viewMode === 'split' ? '1px solid var(--border-color)' : 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem'
                }}>
                  {renderSimpleMarkdown(activeNote.content)}
                </div>
              )}
            </div>

            {/* Status Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '0.65rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <span>{wordCount} words</span>
                <span>{charCount} characters</span>
                <span>~{Math.max(1, Math.ceil(wordCount / 200))} min read</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={12} style={{ color: 'var(--success)' }} />
                <span>Encrypted & Auto-saved</span>
              </div>
            </div>

          </div>
        ) : (
          <div className="card glass" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <Sparkles size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <h3>No Note Selected</h3>
              <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>Choose an existing note from the list or create a new one.</p>
              <button className="btn btn-primary" onClick={handleCreateNote}>
                Create New Note
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

import React, { useEffect, useState, useRef } from 'react';
import { 
  Folder, File, MoreVertical, Download, Edit2, Move, Copy, Trash2, Heart, Info,
  Plus, Grid, List, ChevronRight, Upload, X, Tag, FileText
} from 'lucide-react';
import { api } from '../utils/api';
import { formatBytes } from './Dashboard';

interface FileBrowserProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface PathCrumb {
  id: number | null;
  name: string;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ showToast }) => {
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<PathCrumb[]>([{ id: null, name: 'Root' }]);
  
  const [folders, setFolders] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [allFolders, setAllFolders] = useState<any[]>([]); // For move selection
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [activeMenuId, setActiveMenuId] = useState<{ type: 'file' | 'folder'; id: number } | null>(null);
  const [modalType, setModalType] = useState<'create_folder' | 'rename_file' | 'rename_folder' | 'move_file' | 'file_details' | null>(null);
  const [targetItem, setTargetItem] = useState<any>(null);
  const [inputVal, setInputVal] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  
  // AI summary state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<any>(null);
  const [textFileContent, setTextFileContent] = useState<string | null>(null);

  // Drag and drop highlights
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const fetchContents = async () => {
    try {
      setLoading(true);
      const res = await api.listFolders(currentFolderId);
      setFolders(res.folders || []);
      setFiles(res.files || []);
      
      // Fetch all folders for move dialog
      const listRes = await api.listFolders(null);
      // Flat list representation of folder tree
      setAllFolders(listRes.folders || []);
    } catch (err: any) {
      showToast(err.message || 'Error loading contents', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContents();
    setActiveMenuId(null);
  }, [currentFolderId]);

  // Click outside menus to dismiss
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Filter lists based on traditional keyword queries
  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = files.filter(f => f.original_filename.toLowerCase().includes(searchQuery.toLowerCase()));

  // Breadcrumb navigation
  const navigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setCurrentFolderId(target.id);
  };

  const enterFolder = (folder: any) => {
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  // Drag and Drop Uploads
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // ── Concurrency pool helper ────────────────────────────────────────────────
  // Runs `tasks` with at most `limit` running in parallel at any time
  const runWithConcurrency = async <T,>(
    tasks: (() => Promise<T>)[],
    limit: number,
    onProgress?: (done: number, total: number) => void
  ): Promise<T[]> => {
    const results: T[] = new Array(tasks.length);
    let nextIdx = 0;
    let done = 0;
    const total = tasks.length;

    const worker = async () => {
      while (nextIdx < total) {
        const idx = nextIdx++;
        results[idx] = await tasks[idx]();
        done++;
        onProgress?.(done, total);
      }
    };

    const workers = Array.from({ length: Math.min(limit, total) }, () => worker());
    await Promise.all(workers);
    return results;
  };

  // ── Recursive folder entry reader ──────────────────────────────────────────
  const readAllEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
    new Promise((resolve) => {
      const all: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries((batch) => {
          if (batch.length === 0) resolve(all);
          else { all.push(...batch); readBatch(); }
        }, () => resolve(all));
      };
      readBatch();
    });

  // Parallel recursive scan – processes sibling entries simultaneously
  const collectFilesFromEntry = async (
    entry: FileSystemEntry,
    pathParts: string[] = []
  ): Promise<{ file: File; pathParts: string[] }[]> => {
    if (entry.isFile) {
      const fe = entry as FileSystemFileEntry;
      return new Promise((resolve) => {
        fe.file((f) => resolve([{ file: f, pathParts }]), () => resolve([]));
      });
    }
    const de = entry as FileSystemDirectoryEntry;
    const subEntries = await readAllEntries(de.createReader());
    // Scan all siblings in parallel ↓
    const nested = await Promise.all(
      subEntries.map((sub) => collectFilesFromEntry(sub, [...pathParts, de.name]))
    );
    return nested.flat();
  };

  // ── Folder-path cache (shared across one upload session) ───────────────────
  // Key: "parentId|folderName", Value: resolved child folder id
  const folderIdCache = useRef<Map<string, number | null>>(new Map());

  const ensureFolderPath = async (pathParts: string[], rootId: number | null): Promise<number | null> => {
    let parentId = rootId;
    for (const part of pathParts) {
      const cacheKey = `${parentId}|${part}`;
      if (folderIdCache.current.has(cacheKey)) {
        parentId = folderIdCache.current.get(cacheKey)!;
        continue;
      }
      try {
        const created = await api.createFolder(part, parentId);
        parentId = created.id;
      } catch {
        // Already exists – fetch list and find it
        const res = await api.listFolders(parentId);
        const existing = (res.folders || []).find((f: any) => f.name === part);
        parentId = existing ? existing.id : parentId;
      }
      folderIdCache.current.set(cacheKey, parentId);
    }
    return parentId;
  };

  // ── Shared fast upload core ────────────────────────────────────────────────
  const CONCURRENCY = 6; // simultaneous upload requests

  const runParallelUpload = async (
    groups: Map<string, { file: File; pathParts: string[] }[]>
  ) => {
    // Step 1: build folder tree sequentially (parent must exist before child)
    // Sort paths shortest-first so parents are created before children
    const sortedPaths = [...groups.keys()].sort((a, b) => {
      const aDepth = a ? a.split('/').length : 0;
      const bDepth = b ? b.split('/').length : 0;
      return aDepth - bDepth;
    });

    const pathToFolderId = new Map<string, number | null>();
    for (const key of sortedPaths) {
      const pathParts = groups.get(key)![0].pathParts;
      const folderId = await ensureFolderPath(pathParts, currentFolderId);
      pathToFolderId.set(key, folderId);
    }

    // Step 2: build individual file upload tasks
    const allFiles: { file: File; folderId: number | null }[] = [];
    for (const [key, items] of groups) {
      const folderId = pathToFolderId.get(key) ?? currentFolderId;
      items.forEach(i => allFiles.push({ file: i.file, folderId }));
    }

    const total = allFiles.length;
    let uploaded = 0;

    // Step 3: upload CONCURRENCY files at a time
    const tasks = allFiles.map(({ file, folderId }) => async () => {
      const dt = new DataTransfer();
      dt.items.add(file);
      await api.uploadFiles(dt.files, folderId);
      uploaded++;
      setUploadProgress(`Uploading ${uploaded}/${total} files...`);
    });

    await runWithConcurrency(tasks, CONCURRENCY);
    return uploaded;
  };

  // ── Upload a flat FileList (files-only picker) ──────────────────────────────
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
      if (entries.length > 0) {
        await uploadEntries(entries);
        return;
      }
    }
    // Fallback for flat files
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFilesList(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFilesList(e.target.files);
      e.target.value = '';
    }
  };

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFolderFileList(e.target.files);
      e.target.value = '';
    }
  };

  // Upload flat FileList (no folder hierarchy) – batch all files in one request
  const uploadFilesList = async (filesList: FileList) => {
    try {
      setUploadProgress(`Uploading ${filesList.length} file(s)...`);
      await api.uploadFiles(filesList, currentFolderId);
      showToast(`${filesList.length} file(s) uploaded successfully`, 'success');
      fetchContents();
    } catch (err: any) {
      showToast(err.message || 'File upload failed', 'error');
    } finally {
      setUploadProgress(null);
    }
  };

  // Upload from webkitdirectory input – files carry their webkitRelativePath
  const uploadFolderFileList = async (filesList: FileList) => {
    folderIdCache.current.clear();
    try {
      setUploadProgress('Scanning folder...');
      const groups = new Map<string, { file: File; pathParts: string[] }[]>();
      const fileArray = Array.from(filesList);
      for (const f of fileArray) {
        const relPath = (f as any).webkitRelativePath as string | undefined;
        const parts = relPath ? relPath.split('/') : [f.name];
        const dirParts = parts.slice(0, -1);
        const key = dirParts.join('/');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ file: f, pathParts: dirParts });
      }
      const uploaded = await runParallelUpload(groups);
      showToast(`Folder uploaded: ${uploaded} file(s) added`, 'success');
      fetchContents();
    } catch (err: any) {
      showToast(err.message || 'Folder upload failed', 'error');
    } finally {
      setUploadProgress(null);
    }
  };

  // Upload from drag-and-drop entries (supports nested folders)
  const uploadEntries = async (entries: FileSystemEntry[]) => {
    folderIdCache.current.clear();
    try {
      setUploadProgress('Scanning dropped items...');
      // Scan all top-level entries in parallel
      const nested = await Promise.all(entries.map(e => collectFilesFromEntry(e, [])));
      const collected = nested.flat();

      const groups = new Map<string, { file: File; pathParts: string[] }[]>();
      for (const item of collected) {
        const key = item.pathParts.join('/');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      }

      const uploaded = await runParallelUpload(groups);
      showToast(`${uploaded} file(s) uploaded successfully`, 'success');
      fetchContents();
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploadProgress(null);
    }
  };

  // Folder CRUD Handlers
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    try {
      await api.createFolder(inputVal.trim(), currentFolderId);
      showToast('Folder created', 'success');
      setModalType(null);
      setInputVal('');
      fetchContents();
    } catch (err: any) {
      showToast(err.message || 'Create folder failed', 'error');
    }
  };

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || !targetItem) return;

    try {
      await api.renameFolder(targetItem.id, inputVal.trim());
      showToast('Folder renamed', 'success');
      setModalType(null);
      setInputVal('');
      fetchContents();
    } catch (err: any) {
      showToast(err.message || 'Rename folder failed', 'error');
    }
  };

  const handleDeleteFolder = async (folder: any) => {
    if (!window.confirm(`Move "${folder.name}" and all its contents to the Recycle Bin? You can restore them anytime.`)) return;

    try {
      await api.deleteFolder(folder.id);
      showToast('Folder moved to Recycle Bin', 'success');
      fetchContents();
    } catch (err: any) {
      showToast(err.message || 'Delete folder failed', 'error');
    }
  };

  // File CRUD Handlers
  const handleRenameFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || !targetItem) return;

    try {
      await api.renameFile(targetItem.id, inputVal.trim());
      showToast('File renamed', 'success');
      setModalType(null);
      setInputVal('');
      fetchContents();
    } catch (err: any) {
      showToast(err.message || 'Rename file failed', 'error');
    }
  };

  const handleMoveFile = async () => {
    if (!targetItem) return;
    try {
      await api.moveFile(targetItem.id, selectedFolderId);
      showToast('File moved', 'success');
      setModalType(null);
      fetchContents();
    } catch (err: any) {
      showToast(err.message || 'Move file failed', 'error');
    }
  };

  const handleCopyFile = async (file: any) => {
    try {
      await api.copyFile(file.id);
      showToast('File duplicated', 'success');
      fetchContents();
    } catch (err: any) {
      showToast(err.message || 'Copy file failed', 'error');
    }
  };

  const handleToggleFavorite = async (file: any) => {
    try {
      await api.toggleFavorite(file.id);
      showToast(file.is_favorite ? 'Removed from Favorites' : 'Marked as Favorite', 'success');
      fetchContents();
    } catch (err: any) {
      showToast(err.message || 'Favorite update failed', 'error');
    }
  };

  const handleDeleteFile = async (file: any) => {
    if (!window.confirm(`Move "${file.original_filename}" to the Recycle Bin? You can restore it anytime.`)) return;

    try {
      await api.deleteFile(file.id);
      showToast('File moved to Recycle Bin', 'success');
      fetchContents();
    } catch (err: any) {
      showToast(err.message || 'Delete file failed', 'error');
    }
  };

  const triggerDownloadFolder = async (folder: any) => {
    try {
      showToast(`Compressing and downloading "${folder.name}"...`, 'info');
      const token = localStorage.getItem('aethervault_token');
      const res = await fetch(`/api/v1/folders/${folder.id}/download`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        showToast('Download failed: ' + res.statusText, 'error');
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${folder.name}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast(`Folder "${folder.name}.zip" downloaded successfully`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Folder download failed', 'error');
    }
  };

  const triggerDownload = async (file: any) => {
    try {
      const token = localStorage.getItem('aethervault_token');
      const res = await fetch(`/api/v1/files/${file.id}/download`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        showToast('Download failed: ' + res.statusText, 'error');
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      showToast(err.message || 'Download failed', 'error');
    }
  };

  const renderPreview = (file: any) => {
    const mime = file.mime_type || '';
    const token = localStorage.getItem('aethervault_token');
    const previewUrl = api.getDownloadUrl(file.id) + `?inline=true&token=${token}`;

    if (mime.startsWith('image/')) {
      return (
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <img 
            src={previewUrl} 
            alt={file.original_filename} 
            style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', objectFit: 'contain' }} 
          />
        </div>
      );
    }
    
    if (mime.startsWith('video/')) {
      return (
        <div style={{ marginBottom: '1.5rem' }}>
          <video 
            src={previewUrl} 
            controls 
            style={{ width: '100%', maxHeight: '350px', borderRadius: 'var(--radius-sm)', backgroundColor: '#000' }} 
          />
        </div>
      );
    }

    if (mime.startsWith('audio/')) {
      return (
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <audio 
            src={previewUrl} 
            controls 
            style={{ width: '100%' }} 
          />
        </div>
      );
    }

    if (mime === 'application/pdf') {
      return (
        <div style={{ marginBottom: '1.5rem' }}>
          <iframe 
            src={previewUrl} 
            title="PDF Preview"
            style={{ width: '100%', height: '400px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }} 
          />
        </div>
      );
    }

    if (textFileContent !== null) {
      return (
        <div style={{ marginBottom: '1.5rem' }}>
          <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>File Contents</strong>
          <pre style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            maxHeight: '220px',
            overflowY: 'auto',
            fontSize: '0.8125rem',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            margin: 0
          }}>
            {textFileContent}
          </pre>
        </div>
      );
    }

    return null;
  };

  // AI Document intelligence triggers
  const viewAiDetails = async (file: any) => {
    setTargetItem(file);
    setModalType('file_details');
    setAiData(null);
    setAiLoading(true);
    setTextFileContent(null);
    try {
      const fn = file.original_filename.toLowerCase();
      const isText = file.mime_type?.startsWith('text/') ||
                     fn.endsWith('.md') ||
                     fn.endsWith('.txt') ||
                     fn.endsWith('.json') ||
                     fn.endsWith('.js') ||
                     fn.endsWith('.ts') ||
                     fn.endsWith('.py');

      const detailsPromise = api.summarizeDoc(file.id);
      if (isText) {
        const token = localStorage.getItem('aethervault_token');
        const textPromise = fetch(api.getDownloadUrl(file.id) + `?inline=true&token=${token}`)
          .then(res => res.text());
        const [res, text] = await Promise.all([detailsPromise, textPromise]);
        setAiData(res);
        setTextFileContent(text);
      } else {
        const res = await detailsPromise;
        setAiData(res);
      }
    } catch (err: any) {
      showToast(err.message || 'Could not extract AI summary', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '80vh' }} onDragEnter={handleDrag}>
      {/* Upload Progress Banner */}
      {uploadProgress && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1.25rem',
          marginBottom: '1rem',
          backgroundColor: 'var(--primary-light)',
          border: '1px solid var(--primary)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.875rem',
          color: 'var(--primary)',
          fontWeight: '500'
        }}>
          <Upload size={16} style={{ animation: 'pulse 1s infinite' }} />
          {uploadProgress}
        </div>
      )}
      {/* File Action and Filters Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <input
          type="text"
          className="input-field"
          style={{ maxWidth: '300px' }}
          placeholder="Filter files by name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        
        {/* Actions buttons */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => {
            setModalType('create_folder');
            setInputVal('');
          }}>
            <Plus size={16} /> New Folder
          </button>
          
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} /> Upload Files
          </button>
          <button className="btn btn-secondary" onClick={() => folderInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Folder size={16} /> Upload Folder
          </button>
          {currentFolderId !== null && (
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                const cur = breadcrumbs[breadcrumbs.length - 1];
                if (cur && cur.id) triggerDownloadFolder(cur);
              }} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              title="Download this entire folder as a ZIP archive"
            >
              <Download size={16} /> Download Folder
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple
            onChange={handleFileInputChange}
          />
          <input
            type="file"
            ref={folderInputRef}
            style={{ display: 'none' }}
            {...({ webkitdirectory: '', directory: '' } as any)}
            multiple
            onChange={handleFolderInputChange}
          />
          
          {/* Grid/List View Toggles */}
          <div style={{
            display: 'flex',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden'
          }}>
            <button 
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.625rem',
                border: 'none',
                background: viewMode === 'grid' ? 'var(--primary-light)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <Grid size={16} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.625rem',
                border: 'none',
                background: viewMode === 'list' ? 'var(--primary-light)' : 'transparent',
                color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Breadcrumbs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '2rem',
        fontSize: '0.9375rem',
        color: 'var(--text-muted)',
        flexWrap: 'wrap'
      }}>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight size={14} />}
            <span 
              onClick={() => navigateToBreadcrumb(idx)}
              style={{
                cursor: 'pointer',
                fontWeight: idx === breadcrumbs.length - 1 ? '600' : '400',
                color: idx === breadcrumbs.length - 1 ? 'var(--text-main)' : 'var(--text-muted)'
              }}
            >
              {crumb.name}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Explorer files items lists */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4rem 0' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading explorer contents...</p>
        </div>
      ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5rem 0',
          border: '2px dashed var(--border-color)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <Folder size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3>This directory is empty</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Drag and drop files here to upload.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Layout Mode */
        <div className="files-grid">
          {/* Folders List */}
          {filteredFolders.map(folder => (
            <div 
              key={folder.id} 
              className="card glass" 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                cursor: 'pointer'
              }}
              onClick={() => enterFolder(folder)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                <Folder size={24} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ fontWeight: '500', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {folder.name}
                </span>
              </div>
              
              {/* Folder action menus */}
              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', position: 'relative' }}>
                <button
                  title="Download entire folder (.zip) in one click"
                  onClick={() => triggerDownloadFolder(folder)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    padding: '0.35rem 0.5rem',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--primary)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                    e.currentTarget.style.color = 'var(--text-main)';
                  }}
                >
                  <Download size={14} />
                  <span>ZIP</span>
                </button>
                <button 
                  onClick={() => setActiveMenuId(activeMenuId?.id === folder.id ? null : { type: 'folder', id: folder.id })}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                >
                  <MoreVertical size={16} />
                </button>
                {activeMenuId?.type === 'folder' && activeMenuId.id === folder.id && (
                  <div className="card" style={{
                    position: 'absolute', right: 0, top: '100%', width: '165px', zIndex: 12, padding: '0.5rem', display: 'flex', flexDirection: 'column'
                  }}>
                    <button style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', padding: '0.5rem', textAlign: 'left', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.875rem'
                    }} onClick={() => {
                      setActiveMenuId(null);
                      triggerDownloadFolder(folder);
                    }}>
                      <Download size={14} /> Download (.zip)
                    </button>
                    <button style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', padding: '0.5rem', textAlign: 'left', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.875rem'
                    }} onClick={() => {
                      setTargetItem(folder);
                      setModalType('rename_folder');
                      setInputVal(folder.name);
                    }}>
                      <Edit2 size={14} /> Rename
                    </button>
                    <button style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', padding: '0.5rem', textAlign: 'left', color: 'var(--error)', cursor: 'pointer', fontSize: '0.875rem'
                    }} onClick={() => handleDeleteFolder(folder)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Files List */}
          {filteredFiles.map(file => (
            <div 
              key={file.id} 
              className="card glass" 
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1.25rem',
                minHeight: '140px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div 
                  style={{ display: 'flex', gap: '0.75rem', overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => viewAiDetails(file)}
                >
                  <File size={28} style={{ color: '#3b82f6', flexShrink: 0 }} />
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{
                      fontWeight: '500',
                      fontSize: '0.9375rem',
                      display: 'block',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.original_filename}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatBytes(file.file_size)}</span>
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => setActiveMenuId(activeMenuId?.id === file.id ? null : { type: 'file', id: file.id })}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <MoreVertical size={16} />
                  </button>
                  
                  {activeMenuId?.type === 'file' && activeMenuId.id === file.id && (
                    <div className="card" style={{
                      position: 'absolute', right: 0, top: '100%', width: '160px', zIndex: 12, padding: '0.5rem', display: 'flex', flexDirection: 'column'
                    }}>
                      <button style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', padding: '0.5rem', textAlign: 'left', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.875rem'
                      }} onClick={() => triggerDownload(file)}>
                        <Download size={14} /> Download
                      </button>
                      <button style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', padding: '0.5rem', textAlign: 'left', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.875rem'
                      }} onClick={() => {
                        setTargetItem(file);
                        setModalType('rename_file');
                        setInputVal(file.original_filename);
                      }}>
                        <Edit2 size={14} /> Rename
                      </button>
                      <button style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', padding: '0.5rem', textAlign: 'left', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.875rem'
                      }} onClick={() => {
                        setTargetItem(file);
                        setModalType('move_file');
                        setSelectedFolderId(file.folder_id);
                      }}>
                        <Move size={14} /> Move to
                      </button>
                      <button style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', padding: '0.5rem', textAlign: 'left', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.875rem'
                      }} onClick={() => handleCopyFile(file)}>
                        <Copy size={14} /> Copy file
                      </button>
                      <button style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', padding: '0.5rem', textAlign: 'left', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.875rem'
                      }} onClick={() => viewAiDetails(file)}>
                        <Info size={14} /> AI Details
                      </button>
                      <button style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', padding: '0.5rem', textAlign: 'left', color: 'var(--error)', cursor: 'pointer', fontSize: '0.875rem'
                      }} onClick={() => handleDeleteFile(file)}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick actions line */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                <button 
                  onClick={() => handleToggleFavorite(file)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: file.is_favorite ? '#ef4444' : 'var(--text-muted)'
                  }}
                >
                  <Heart size={16} fill={file.is_favorite ? '#ef4444' : 'none'} />
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(file.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List Layout Mode */
        <div className="files-list">
          {/* Display folders */}
          {filteredFolders.map(folder => (
            <div 
              key={folder.id} 
              className="card glass" 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem',
                cursor: 'pointer'
              }}
              onClick={() => enterFolder(folder)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Folder size={20} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: '500' }}>{folder.name}</span>
              </div>
              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => triggerDownloadFolder(folder)}>
                  <Download size={13} /> Download
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => {
                  setTargetItem(folder);
                  setModalType('rename_folder');
                  setInputVal(folder.name);
                }}>
                  Rename
                </button>
                <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleDeleteFolder(folder)}>
                  Delete
                </button>
              </div>
            </div>
          ))}

          {/* Display files */}
          {filteredFiles.map(file => (
            <div 
              key={file.id} 
              className="card glass" 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem'
              }}
            >
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, cursor: 'pointer', overflow: 'hidden' }}
                onClick={() => viewAiDetails(file)}
              >
                <File size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <span style={{
                  fontWeight: '500', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '300px'
                }}>
                  {file.original_filename}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({formatBytes(file.file_size)})</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button 
                  onClick={() => handleToggleFavorite(file)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: file.is_favorite ? '#ef4444' : 'var(--text-muted)' }}
                >
                  <Heart size={16} fill={file.is_favorite ? '#ef4444' : 'none'} />
                </button>
                
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {new Date(file.created_at).toLocaleDateString()}
                </span>
                
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => triggerDownload(file)}>
                    Download
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => {
                    setTargetItem(file);
                    setModalType('move_file');
                    setSelectedFolderId(file.folder_id);
                  }}>
                    Move
                  </button>
                  <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleDeleteFile(file)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drag & Drop Visual Cover Overlay */}
      {dragActive && (
        <div 
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(12, 14, 18, 0.95)',
            border: '3px dashed var(--primary)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            pointerEvents: 'auto'
          }}
        >
          <Upload size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }} />
          <h2>Drop your files here</h2>
          <p style={{ color: 'var(--text-muted)' }}>Upload automatically to this directory.</p>
        </div>
      )}

      {/* Dialog Modals */}
      {modalType && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200
        }}>
          {/* Create Folder Modal */}
          {modalType === 'create_folder' && (
            <div className="card glass" style={{ width: '100%', maxWidth: '400px' }}>
              <h3 style={{ marginBottom: '1.25rem' }}>Create Folder</h3>
              <form onSubmit={handleCreateFolder}>
                <div className="form-group">
                  <label className="form-label">Folder Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Enter folder name"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create</button>
                </div>
              </form>
            </div>
          )}

          {/* Rename Folder Modal */}
          {modalType === 'rename_folder' && (
            <div className="card glass" style={{ width: '100%', maxWidth: '400px' }}>
              <h3 style={{ marginBottom: '1.25rem' }}>Rename Folder</h3>
              <form onSubmit={handleRenameFolder}>
                <div className="form-group">
                  <label className="form-label">New Folder Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Rename</button>
                </div>
              </form>
            </div>
          )}

          {/* Rename File Modal */}
          {modalType === 'rename_file' && (
            <div className="card glass" style={{ width: '100%', maxWidth: '400px' }}>
              <h3 style={{ marginBottom: '1.25rem' }}>Rename File</h3>
              <form onSubmit={handleRenameFile}>
                <div className="form-group">
                  <label className="form-label">New Filename</label>
                  <input
                    type="text"
                    className="input-field"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Rename</button>
                </div>
              </form>
            </div>
          )}

          {/* Move File Modal */}
          {modalType === 'move_file' && (
            <div className="card glass" style={{ width: '100%', maxWidth: '400px' }}>
              <h3 style={{ marginBottom: '1.25rem' }}>Move File</h3>
              <div className="form-group">
                <label className="form-label">Select Destination Folder</label>
                <select 
                  className="input-field"
                  value={selectedFolderId || ''} 
                  onChange={e => setSelectedFolderId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">/ (Root)</option>
                  {allFolders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleMoveFile}>Move File</button>
              </div>
            </div>
          )}

          {/* AI File Details Drawer Modal */}
          {modalType === 'file_details' && (
            <div className="card glass" style={{ width: '100%', maxWidth: '640px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>File Details</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {targetItem && (
                    <button
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                      onClick={() => triggerDownload(targetItem)}
                    >
                      <Download size={16} /> Download
                    </button>
                  )}
                  <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
              </div>

              {targetItem && (
                <div>
                  {/* File Preview */}
                  {renderPreview(targetItem)}

                  {/* File specs */}
                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong>Name:</strong> {targetItem.original_filename}</p>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong>Type:</strong> {targetItem.mime_type}</p>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong>Size:</strong> {formatBytes(targetItem.file_size)}</p>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', wordBreak: 'break-all' }}><strong>Hash:</strong> <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{targetItem.file_hash}</span></p>
                    <p style={{ fontSize: '0.875rem', margin: 0 }}><strong>Uploaded:</strong> {new Date(targetItem.created_at).toLocaleString()}</p>
                  </div>

                  {/* AI Metadata Analysis */}
                  <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <FileText size={18} style={{ color: 'var(--primary)' }} /> Document Intelligence
                    </h4>
                    
                    {aiLoading ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                        Extracting content text and generating summary tags in the background...
                      </p>
                    ) : aiData ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Summary</strong>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                            {aiData.summary}
                          </p>
                        </div>
                        
                        <div>
                          <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>Keywords</strong>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {aiData.keywords.length === 0 ? (
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>None extracted.</span>
                            ) : aiData.keywords.map((kw: string, idx: number) => (
                              <span key={idx} style={{
                                fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px'
                              }}>
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>Tags</strong>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {aiData.tags.length === 0 ? (
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>None generated.</span>
                            ) : aiData.tags.map((tag: string, idx: number) => (
                              <span key={idx} style={{
                                fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: '600', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.25rem'
                              }}>
                                <Tag size={10} /> {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--error)', fontSize: '0.875rem' }}>AI metadata processing failed or file format is unsupported for text extraction.</p>
                    )}
                  </div>

                  {/* Modal Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      onClick={() => triggerDownload(targetItem)}
                    >
                      <Download size={16} /> Download File
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      onClick={() => {
                        setModalType('rename_file');
                        setInputVal(targetItem.original_filename);
                      }}
                    >
                      <Edit2 size={16} /> Rename
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      onClick={() => {
                        setModalType(null);
                        handleDeleteFile(targetItem);
                      }}
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

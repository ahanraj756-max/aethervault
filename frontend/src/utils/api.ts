const BASE_URL = '/api/v1';

// Get active JWT token
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('aethervault_token');
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Global response handler
async function handleResponse<T>(response: Response): Promise<T> {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    // If auth error, clear session
    if (response.status === 401) {
      localStorage.removeItem('aethervault_token');
      localStorage.removeItem('aethervault_user');
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login';
      }
    }
    const message = data?.message || response.statusText || 'An error occurred';
    throw new Error(message);
  }

  // Handle success envelope
  if (data && data.success !== undefined) {
    if (!data.success) {
      throw new Error(data.message || 'Operation failed');
    }
    return data.data as T;
  }

  return data as T;
}

export const api = {
  // ==========================================
  // AUTH
  // ==========================================
  async register(username: string, email: string, password: string, confirmPassword: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, confirm_password: confirmPassword }),
    });
    return handleResponse(res);
  },

  async login(usernameOrEmail: string, password: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username_or_email: usernameOrEmail, password }),
    });
    const data = await handleResponse<any>(res);
    // Save token and user details
    localStorage.setItem('aethervault_token', data.token.access_token);
    localStorage.setItem('aethervault_user', JSON.stringify(data.user));
    return data;
  },

  logout(): void {
    localStorage.removeItem('aethervault_token');
    localStorage.removeItem('aethervault_user');
    window.location.href = '/login';
  },

  async getMe(): Promise<any> {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ==========================================
  // FILES
  // ==========================================
  async listFiles(folderId?: number | null, favorite?: boolean): Promise<any[]> {
    let url = `${BASE_URL}/files`;
    const params = new URLSearchParams();
    if (folderId !== undefined && folderId !== null) params.append('folder_id', folderId.toString());
    if (favorite !== undefined) params.append('favorite', favorite.toString());
    
    const queryStr = params.toString();
    if (queryStr) url += `?${queryStr}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(res);
  },

  async uploadFiles(files: FileList | File[], folderId?: number | null): Promise<any> {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    if (folderId !== undefined && folderId !== null) {
      formData.append('folder_id', folderId.toString());
    }

    const headers = getAuthHeaders() as Record<string, string>;
    // Let browser set boundary automatically for multipart
    const res = await fetch(`${BASE_URL}/files/upload`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });
    return handleResponse(res);
  },

  async renameFile(id: number, newName: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/files/${id}/rename`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ name: newName }),
    });
    return handleResponse(res);
  },

  async moveFile(id: number, folderId: number | null): Promise<any> {
    const res = await fetch(`${BASE_URL}/files/${id}/move`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ folder_id: folderId }),
    });
    return handleResponse(res);
  },

  async copyFile(id: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/files/${id}/copy`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async toggleFavorite(id: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/files/${id}/favorite`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async deleteFile(id: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/files/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  getDownloadUrl(id: number): string {
    const token = localStorage.getItem('aethervault_token');
    return `${BASE_URL}/files/${id}/download?token=${token}`;
  },

  // ==========================================
  // FOLDERS
  // ==========================================
  async listFolders(parentId?: number | null): Promise<any> {
    let url = `${BASE_URL}/folders`;
    if (parentId !== undefined && parentId !== null) {
      url += `?parent_id=${parentId}`;
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async createFolder(name: string, parentId?: number | null): Promise<any> {
    const res = await fetch(`${BASE_URL}/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ name, parent_id: parentId }),
    });
    return handleResponse(res);
  },

  async renameFolder(id: number, newName: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/folders/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ name: newName }),
    });
    return handleResponse(res);
  },

  async deleteFolder(id: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/folders/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  getFolderDownloadUrl(id: number): string {
    const token = localStorage.getItem('aethervault_token');
    return `${BASE_URL}/folders/${id}/download?token=${token}`;
  },


  // ==========================================
  // STORAGE & SEARCH
  // ==========================================
  async getStorageStats(): Promise<any> {
    const res = await fetch(`${BASE_URL}/storage/stats`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getLargestFiles(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/storage/largest-files`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(res);
  },

  async getRecentFiles(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/storage/recent`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(res);
  },

  async searchFiles(params: any): Promise<any[]> {
    const query = new URLSearchParams();
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        query.append(k, params[k].toString());
      }
    });
    const res = await fetch(`${BASE_URL}/search?${query.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(res);
  },

  // ==========================================
  // AI CAPABILITIES
  // ==========================================
  async smartSearch(query: string): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/ai/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ query }),
    });
    return handleResponse<any[]>(res);
  },

  async summarizeDoc(fileId: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/ai/summarize/${fileId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async chatWithFiles(query: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ query }),
    });
    return handleResponse(res);
  },

  async proposeOrganization(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/ai/organize/propose`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(res);
  },

  async executeOrganization(actions: any[]): Promise<any> {
    const res = await fetch(`${BASE_URL}/ai/organize/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ actions }),
    });
    return handleResponse(res);
  },

  async scanDuplicates(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/ai/duplicates`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(res);
  },

  // ── Recycle Bin (Trash) APIs ────────────────────────────────────────────────
  async getTrash(): Promise<{ files: any[]; folders: any[]; total_items: number; total_size: number }> {
    const res = await fetch(`${BASE_URL}/trash`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async restoreFile(id: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/trash/files/${id}/restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async permanentDeleteFile(id: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/trash/files/${id}/permanent`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async restoreFolder(id: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/trash/folders/${id}/restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async permanentDeleteFolder(id: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/trash/folders/${id}/permanent`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async restoreAllTrash(): Promise<any> {
    const res = await fetch(`${BASE_URL}/trash/restore-all`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async emptyTrash(): Promise<any> {
    const res = await fetch(`${BASE_URL}/trash/empty`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },
};

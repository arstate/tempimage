
export interface Gallery {
  id: string;
  name: string;
  timestamp: number;
}

export interface StoredImage {
  id: string;
  galleryId: string;
  name: string;
  type: string;
  size: number;
  data: string;
  timestamp: number;
}

export interface StoredNote {
  id: string;
  galleryId: string;
  title: string;
  content: string; // HTML content or URL to content
  snippet?: string; // Short preview text from backend
  timestamp: number;
}

// New Generic Item for File Manager
export interface Item {
  id: string;
  name: string;
  type: 'folder' | 'image' | 'note';
  url?: string;
  thumbnail?: string;
  snippet?: string;
  lastUpdated: number;
  content?: string; // Cache content for notes locally
  status?: 'idle' | 'deleting' | 'restoring' | 'uploading'; // UI State
}

export interface DownloadItem {
  id: string; // Item ID
  name: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number; // 0 - 100
  error?: string;
}

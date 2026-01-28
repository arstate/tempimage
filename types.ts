
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
  content: string; 
  snippet?: string; 
  timestamp: number;
}

export interface Item {
  id: string;
  name: string;
  type: 'folder' | 'image' | 'note';
  url?: string;
  thumbnail?: string;
  snippet?: string;
  lastUpdated: number;
  content?: string; 
  status?: 'idle' | 'deleting' | 'restoring' | 'uploading' | 'moving' | 'creating'; 
}

export interface DownloadItem {
  id: string;
  name: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export interface FolderNode {
  id: string;
  name: string;
  parentId: string;
}

export interface FolderMap {
  [id: string]: FolderNode;
}

export interface Comment {
  id: string;
  itemId: string;
  author: string;
  text: string;
  timestamp: number;
  parentId?: string; 
}

export interface CommentDB {
  [itemId: string]: Comment[];
}

export interface SystemDB {
  fileId: string | null;
  map: FolderMap;
  lastSync: number;
}

// --- CLOUD OS TYPES ---

export interface AppDefinition {
  id: string;
  name: string;
  icon: string; // lucide icon name or image url
  type: 'system' | 'webapp';
  url?: string; // For webapps
}

export interface SystemConfig {
  wallpaper: string;
  theme: 'dark' | 'light';
  installedApps: AppDefinition[];
}

export interface WindowState {
  instanceId: string;
  appId: string;
  title: string;
  appData: AppDefinition;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { w: number; h: number };
  zIndex: number;
}

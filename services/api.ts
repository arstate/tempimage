
import { Item, FolderMap, CommentDB } from '../types';

// Updated GAS Endpoint
const API_URL = "https://script.google.com/macros/s/AKfycbxppo1lC_7BdI7ToceKqNHRrcr3HljGHNphudbseZSsQbq01XASQ7RtRUEpkDh3RPtPUg/exec";

const DB_FILENAME_KEYWORD = "system_zombio_db.json"; 
const COMMENT_DB_FILENAME = "COMENTDATABASE.json";
const CONFIG_FILENAME = "system_config.json";
const SYSTEM_FOLDER_NAME = "System";
const APPS_ICON_FOLDER_NAME = "Apps Icon";

export interface AppDefinition {
  id: string;
  name: string;
  icon: string; // can be icon name or URL
  type: 'system' | 'webapp';
  url?: string;
}

export interface SystemConfig {
  wallpaper: string;
  theme: 'dark' | 'light';
  installedApps: AppDefinition[];
  youtubeApiKeys?: string[]; // Custom user keys
}

interface ApiResponse {
  status: 'success' | 'error';
  data?: any;
  message?: string;
  currentFolderId?: string;
  currentFolderName?: string;
  parentFolderId?: string;
}

export const callGoogleScript = async (payload: any): Promise<ApiResponse> => {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const textResult = await response.text();
    try {
      return JSON.parse(textResult);
    } catch (e) {
      console.error("Non-JSON Response received:", textResult);
      throw new Error("Server response format error.");
    }
  } catch (error) {
    console.error("Fetch Error:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to connect to cloud server.");
  }
};

export const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// --- SYSTEM OS CONFIG ---

export const getSystemConfig = async (): Promise<SystemConfig> => {
  const res = await callGoogleScript({ action: "getSystemConfig" });
  if (res.status === "success") return res.data;
  throw new Error("Failed to load OS config");
};

export const saveSystemConfig = async (config: SystemConfig): Promise<void> => {
  const res = await callGoogleScript({ action: "saveSystemConfig", config });
  if (res.status !== "success") throw new Error("Failed to save OS config");
};

// --- FILE MANAGER API ACTIONS ---

export const getFolderContents = async (folderId: string = ""): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "getFolderContents",
    folderId: folderId
  });
};

export const createFolder = async (parentId: string, name: string): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "createFolder",
    parentId: parentId,
    name: name
  });
};

export const renameItem = async (itemId: string, newName: string): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "renameItem",
    itemId: itemId,
    newName: newName
  });
};

export const deleteItems = async (itemIds: string[]): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "deleteItems",
    itemIds: itemIds
  });
};

export const moveItems = async (itemIds: string[], targetFolderId: string): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "moveItems",
    itemIds: itemIds,
    targetFolderId: targetFolderId
  });
};

export const duplicateItems = async (itemIds: string[]): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "duplicateItems",
    itemIds: itemIds
  });
};

export const getFileContent = async (fileId: string): Promise<string> => {
  const result = await callGoogleScript({
    action: "getFileContent",
    fileId: fileId
  });

  if (result.status === 'success') {
    return typeof result.data?.content === 'string' ? result.data.content : "";
  } else {
    throw new Error(result.message || "Failed to fetch content.");
  }
};

export const uploadToDrive = async (file: File, folderId: string): Promise<any> => {
  const base64 = await fileToBase64(file);
  const result = await callGoogleScript({
    action: "uploadImage",
    folderId: folderId, 
    fileName: file.name,
    mimeType: file.type || "image/jpeg",
    base64: base64
  });
  if (result.status === 'error') throw new Error(result.message || "Upload failed.");
  return result.data;
};

export const saveNoteToDrive = async (title: string, content: string, folderId: string, fileId?: string): Promise<any> => {
  const result = await callGoogleScript({
    action: "saveNote", 
    folderId: folderId,
    title: title,
    content: content,
    fileId: fileId || null 
  });
  if (result.status === 'error') throw new Error(result.message);
  return result.data;
};

// --- SYSTEM DATABASE ---

export const locateSystemDB = async (): Promise<{ fileId: string | null, commentFileId: string | null, systemFolderId: string | null }> => {
  try {
    const rootRes = await getFolderContents("");
    if (rootRes.status !== 'success' || !Array.isArray(rootRes.data)) return { fileId: null, commentFileId: null, systemFolderId: null };
    
    const systemFolder = rootRes.data.find((i: any) => i.name === SYSTEM_FOLDER_NAME && i.type === 'folder');
    if (!systemFolder) return { fileId: null, commentFileId: null, systemFolderId: null };

    const sysRes = await getFolderContents(systemFolder.id);
    if (sysRes.status !== 'success' || !Array.isArray(sysRes.data)) return { fileId: null, commentFileId: null, systemFolderId: systemFolder.id };

    const dbFile = sysRes.data.find((i: any) => i.name.includes(DB_FILENAME_KEYWORD) && i.type === 'note');
    const commentFile = sysRes.data.find((i: any) => i.name.includes(COMMENT_DB_FILENAME) && i.type === 'note');

    return { 
      fileId: dbFile ? dbFile.id : null, 
      commentFileId: commentFile ? commentFile.id : null,
      systemFolderId: systemFolder.id 
    };
  } catch (e) {
    console.error("Error locating system DB:", e);
    return { fileId: null, commentFileId: null, systemFolderId: null };
  }
};

export const createSystemFolder = async (): Promise<string> => {
    const res = await createFolder("", SYSTEM_FOLDER_NAME);
    if (res.status === 'success' && res.data) return res.data.id;
    throw new Error("Failed to create System folder");
};

export const createSystemDBFile = async (initialMap: FolderMap, folderId: string): Promise<string> => {
  const content = JSON.stringify(initialMap);
  const res = await saveNoteToDrive(DB_FILENAME_KEYWORD, content, folderId); 
  if (res && res.id) return res.id;
  throw new Error("Failed to create system DB file");
};

export const createCommentDBFile = async (initialComments: CommentDB, folderId: string): Promise<string> => {
  const content = JSON.stringify(initialComments);
  const res = await saveNoteToDrive(COMMENT_DB_FILENAME, content, folderId); 
  if (res && res.id) return res.id;
  throw new Error("Failed to create comment DB file");
};

export const updateSystemDBFile = async (fileId: string, map: FolderMap): Promise<void> => {
  const content = JSON.stringify(map);
  await saveNoteToDrive(DB_FILENAME_KEYWORD, content, "", fileId); 
};

export const updateCommentDBFile = async (fileId: string, comments: CommentDB): Promise<void> => {
  const content = JSON.stringify(comments);
  await saveNoteToDrive(COMMENT_DB_FILENAME, content, "", fileId); 
};

// --- ICON MANAGEMENT ---
export const ensureAppIconFolder = async (systemFolderId: string): Promise<string> => {
    const sysRes = await getFolderContents(systemFolderId);
    if (sysRes.status !== 'success' || !Array.isArray(sysRes.data)) throw new Error("Cannot access System folder");
    
    const iconFolder = sysRes.data.find((i: any) => i.name === APPS_ICON_FOLDER_NAME && i.type === 'folder');
    if (iconFolder) return iconFolder.id;
    
    const createRes = await createFolder(systemFolderId, APPS_ICON_FOLDER_NAME);
    if (createRes.status === 'success' && createRes.data) return createRes.data.id;
    throw new Error("Failed to create Apps Icon folder");
};

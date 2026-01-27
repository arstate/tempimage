
import { Item, FolderMap } from '../types';

// URL Final Baru (File Manager Backend)
const API_URL = "https://script.google.com/macros/s/AKfycbw-khPTpmPiuUhTzo-vqtkHZTqJ3MLqZtP-btpHLbnBVyJ13Z6k5glBBpMWomP8p6BIog/exec";

const DB_FILENAME = "system_zombio_db.json";
const SYSTEM_FOLDER_NAME = "System";

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
      throw new Error("Server merespon dengan format yang salah.");
    }

  } catch (error) {
    console.error("Fetch Error:", error);
    throw new Error(error instanceof Error ? error.message : "Gagal menghubungi server Google.");
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

// --- FILE MANAGER API ACTIONS ---

// 1. Get Folder Contents
export const getFolderContents = async (folderId: string = ""): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "getFolderContents",
    folderId: folderId
  });
};

// 2. Create Folder
export const createFolder = async (parentId: string, name: string): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "createFolder",
    parentId: parentId,
    name: name
  });
};

// 3. Rename Item
export const renameItem = async (itemId: string, newName: string): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "renameItem",
    itemId: itemId,
    newName: newName
  });
};

// 4. Delete Items
export const deleteItems = async (itemIds: string[]): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "deleteItems",
    itemIds: itemIds
  });
};

// 5. Move Items
export const moveItems = async (itemIds: string[], targetFolderId: string): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "moveItems",
    itemIds: itemIds,
    targetFolderId: targetFolderId
  });
};

// 6. Duplicate Items
export const duplicateItems = async (itemIds: string[]): Promise<ApiResponse> => {
  return callGoogleScript({
    action: "duplicateItems",
    itemIds: itemIds
  });
};

// 7. Get File Content
export const getFileContent = async (fileId: string): Promise<string> => {
  const result = await callGoogleScript({
    action: "getFileContent",
    fileId: fileId
  });

  if (result.status === 'success') {
    return typeof result.data?.content === 'string' ? result.data.content : "";
  } else {
    throw new Error(result.message || "Gagal mengambil konten.");
  }
};

// 8. Upload Image
export const uploadToDrive = async (file: File, folderId: string): Promise<any> => {
  const base64 = await fileToBase64(file);
  
  const result = await callGoogleScript({
    action: "uploadImage",
    folderId: folderId, 
    fileName: file.name,
    mimeType: file.type || "image/jpeg",
    base64: base64
  });

  if (result.status === 'error') {
    throw new Error(result.message || "Upload gagal.");
  }
  return result.data;
};

// 9. Save Note
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

// --- SYSTEM DATABASE (JSON ON DRIVE) ---

// Returns: { fileId: string | null, systemFolderId: string | null }
export const locateSystemDB = async (): Promise<{ fileId: string | null, systemFolderId: string | null }> => {
  try {
    // 1. Check Root for "System" folder
    const rootRes = await getFolderContents("");
    if (rootRes.status !== 'success' || !Array.isArray(rootRes.data)) return { fileId: null, systemFolderId: null };
    
    const systemFolder = rootRes.data.find((i: any) => i.name === SYSTEM_FOLDER_NAME && i.type === 'folder');
    
    if (!systemFolder) return { fileId: null, systemFolderId: null };

    // 2. Check inside "System" folder for DB file
    const sysRes = await getFolderContents(systemFolder.id);
    if (sysRes.status !== 'success' || !Array.isArray(sysRes.data)) return { fileId: null, systemFolderId: systemFolder.id };

    const dbFile = sysRes.data.find((i: any) => 
      (i.name === DB_FILENAME || i.name === DB_FILENAME.replace('.json', '')) && i.type === 'note'
    );

    return { 
      fileId: dbFile ? dbFile.id : null, 
      systemFolderId: systemFolder.id 
    };

  } catch (e) {
    console.error("Error locating system DB:", e);
    return { fileId: null, systemFolderId: null };
  }
};

export const createSystemFolder = async (): Promise<string> => {
    const res = await createFolder("", SYSTEM_FOLDER_NAME);
    if (res.status === 'success' && res.data) return res.data.id;
    throw new Error("Gagal membuat folder System");
};

export const createSystemDBFile = async (initialMap: FolderMap, folderId: string): Promise<string> => {
  const content = JSON.stringify(initialMap);
  const res = await saveNoteToDrive(DB_FILENAME.replace('.json',''), content, folderId); 
  if (res && res.id) return res.id;
  throw new Error("Failed to create system DB file");
};

export const updateSystemDBFile = async (fileId: string, map: FolderMap): Promise<void> => {
  const content = JSON.stringify(map);
  // Re-save using the same fileId to overwrite
  await saveNoteToDrive(DB_FILENAME.replace('.json',''), content, "", fileId); 
};

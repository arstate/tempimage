
import { Item } from '../types';

// URL Final Baru (File Manager Backend)
const API_URL = "https://script.google.com/macros/s/AKfycbw-khPTpmPiuUhTzo-vqtkHZTqJ3MLqZtP-btpHLbnBVyJ13Z6k5glBBpMWomP8p6BIog/exec";

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

// 1. Get Folder Contents (Files + Subfolders)
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

// 4. Delete Items (Bulk)
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

// 7. Get File Content (for Notes)
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

// 8. Upload Image (With Folder ID)
export const uploadToDrive = async (file: File, folderId: string): Promise<any> => {
  const base64 = await fileToBase64(file);
  
  const result = await callGoogleScript({
    action: "uploadImage",
    folderId: folderId, // Now uses ID, not name
    fileName: file.name,
    mimeType: file.type || "image/jpeg",
    base64: base64
  });

  if (result.status === 'error') {
    throw new Error(result.message || "Upload gagal.");
  }
  return result.data;
};

// 9. Save Note (With Folder ID)
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


import { Item, FolderMap, CommentDB } from '../types';

const API_URL = "https://script.google.com/macros/s/AKfycbw-khPTpmPiuUhTzo-vqtkHZTqJ3MLqZtP-btpHLbnBVyJ13Z6k5glBBpMWomP8p6BIog/exec";

const DB_FILENAME_KEYWORD = "system_zombio_db"; 
const COMMENT_DB_FILENAME = "COMENTDATABASE";
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
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const textResult = await response.text();
    try { return JSON.parse(textResult); } catch (e) { throw new Error("Server response format error."); }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Gagal menghubungi server.");
  }
};

export const getFolderContents = async (folderId: string = ""): Promise<ApiResponse> => {
  return callGoogleScript({ action: "getFolderContents", folderId });
};

export const createFolder = async (parentId: string, name: string): Promise<ApiResponse> => {
  return callGoogleScript({ action: "createFolder", parentId, name });
};

export const renameItem = async (itemId: string, newName: string): Promise<ApiResponse> => {
  return callGoogleScript({ action: "renameItem", itemId, newName });
};

export const deleteItems = async (itemIds: string[]): Promise<ApiResponse> => {
  return callGoogleScript({ action: "deleteItems", itemIds });
};

export const moveItems = async (itemIds: string[], targetFolderId: string): Promise<ApiResponse> => {
  return callGoogleScript({ action: "moveItems", itemIds, targetFolderId });
};

export const getFileContent = async (fileId: string): Promise<string> => {
  const result = await callGoogleScript({ action: "getFileContent", fileId });
  return result.status === 'success' ? (result.data?.content || "") : "";
};

export const uploadToDrive = async (file: File, folderId: string): Promise<any> => {
  const reader = new FileReader();
  const base64 = await new Promise<string>((res) => {
    reader.onload = () => res(reader.result as string);
    reader.readAsDataURL(file);
  });
  return callGoogleScript({ action: "uploadImage", folderId, fileName: file.name, mimeType: file.type || "image/jpeg", base64 });
};

export const saveNoteToDrive = async (title: string, content: string, folderId: string, fileId?: string): Promise<any> => {
  const result = await callGoogleScript({ action: "saveNote", folderId, title, content, fileId: fileId || null });
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
  } catch (e) { return { fileId: null, commentFileId: null, systemFolderId: null }; }
};

export const createSystemFolder = async (): Promise<string> => {
    const res = await createFolder("", SYSTEM_FOLDER_NAME);
    if (res.status === 'success' && res.data) return res.data.id;
    throw new Error("Gagal membuat folder System");
};

export const createSystemDBFile = async (initialMap: FolderMap, folderId: string): Promise<string> => {
  const res = await saveNoteToDrive(DB_FILENAME_KEYWORD, JSON.stringify(initialMap), folderId); 
  return res.id;
};

export const createCommentDBFile = async (initialComments: CommentDB, folderId: string): Promise<string> => {
  const res = await saveNoteToDrive(COMMENT_DB_FILENAME, JSON.stringify(initialComments), folderId); 
  return res.id;
};

export const updateSystemDBFile = async (fileId: string, map: FolderMap): Promise<void> => {
  await saveNoteToDrive(DB_FILENAME_KEYWORD, JSON.stringify(map), "", fileId); 
};

export const updateCommentDBFile = async (fileId: string, comments: CommentDB): Promise<void> => {
  await saveNoteToDrive(COMMENT_DB_FILENAME, JSON.stringify(comments), "", fileId); 
};

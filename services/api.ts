
import { StoredImage, StoredNote } from '../types';

// URL Baru dari User
const API_URL = "https://script.google.com/macros/s/AKfycbxCMu2Px0le2Gzd-EUXWxoLWsByqZ9c46wr2sv8C-jRmnqLyEXQ6DHax9YK5iyI6wg_Ww/exec";

interface ApiResponse {
  status: 'success' | 'error';
  data?: any; // Data object containing id, url, etc.
  id?: string; // Fallback if API returns id at root
  fileId?: string; // Fallback
  message?: string;
  url?: string;
  thumbnail?: string;
  type?: string;
  date?: string;
}

interface DriveFile {
  id: string;
  name: string;
  url: string; // View URL
  thumbnail: string; // Thumbnail URL
  type: string; // MimeType
  date: string;
}

// Helper: Convert File/Blob to Base64
export const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// 0. Create Folder Explicitly
export const createFolderInDrive = async (folderName: string): Promise<void> => {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "createFolder",
      folderName: folderName
    })
  });

  const result: ApiResponse = await response.json();
  if (result.status === 'error') throw new Error(result.message);
  
  console.log("Folder created/verified in Drive:", folderName);
};

// 1. Upload Image / File
export const uploadToDrive = async (file: File, folderName: string): Promise<DriveFile> => {
  const base64 = await fileToBase64(file);
  
  const payload = {
    action: "uploadImage",
    folderName: folderName,
    fileName: file.name,
    mimeType: file.type, 
    base64: base64
  };

  console.log("Uploading payload:", { ...payload, base64: payload.base64.substring(0, 50) + "..." });

  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const result: ApiResponse = await response.json();
  console.log("Upload response:", result);

  if (result.status === 'error') throw new Error(result.message || "Upload failed from server.");
  
  // Robust handling: Check result.data OR root properties
  const fileData = result.data || result;

  if (!fileData || (!fileData.id && !fileData.fileId)) {
    throw new Error("API response missing File ID. Check server logs.");
  }

  // Normalize return data
  return {
    id: fileData.id || fileData.fileId,
    name: fileData.name || file.name,
    url: fileData.url || "",
    thumbnail: fileData.thumbnail || fileData.url || "",
    type: fileData.type || file.type,
    date: fileData.date || new Date().toISOString()
  };
};

// 2. Upload Note (As Text File)
export const uploadNoteToDrive = async (noteTitle: string, content: string, folderName: string): Promise<DriveFile> => {
  const blob = new Blob([content], { type: 'text/plain' });
  const base64 = await fileToBase64(blob);
  const fileName = `${noteTitle || 'Untitled'}.txt`;

  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "uploadImage", 
      folderName: folderName,
      fileName: fileName,
      mimeType: 'text/plain',
      base64: base64
    })
  });

  const result: ApiResponse = await response.json();
  if (result.status === 'error') throw new Error(result.message);
  
  const fileData = result.data || result;
  
  return {
    id: fileData.id || fileData.fileId,
    name: fileData.name || fileName,
    url: fileData.url || "",
    thumbnail: "",
    type: 'text/plain',
    date: fileData.date || new Date().toISOString()
  };
};

// 3. Load Gallery (Get Files)
export const loadGallery = async (folderName: string): Promise<{ images: StoredImage[], notes: StoredNote[] }> => {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "getFiles",
      folderName: folderName
    })
  });

  const result: ApiResponse = await response.json();
  if (result.status === 'error') throw new Error(result.message);

  const rawFiles: any[] = result.data || []; // Expecting array
  
  const images: StoredImage[] = [];
  const notes: StoredNote[] = [];

  rawFiles.forEach((file) => {
    // Determine type safely
    const fileType = file.mimeType || file.type || 'application/octet-stream';
    const isImage = fileType.startsWith('image/') || (file.name && file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i));
    const isText = fileType === 'text/plain' || (file.name && file.name.endsWith('.txt'));

    if (isImage) {
      images.push({
        id: file.id,
        galleryId: folderName,
        name: file.name || "Untitled",
        type: fileType,
        size: 0, 
        data: file.thumbnail || file.url, // Prefer thumbnail for speed
        timestamp: file.date ? new Date(file.date).getTime() : Date.now()
      });
    } else if (isText) {
      notes.push({
        id: file.id,
        galleryId: folderName,
        title: file.name ? file.name.replace('.txt', '') : "Untitled",
        content: file.url, // URL for external link
        timestamp: file.date ? new Date(file.date).getTime() : Date.now()
      });
    }
  });

  return { images, notes };
};

// 4. Delete File
export const deleteFromDrive = async (fileId: string): Promise<void> => {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "deleteFile",
      fileId: fileId
    })
  });

  const result: ApiResponse = await response.json();
  if (result.status === 'error') throw new Error(result.message);
};


import { StoredImage, StoredNote } from '../types';

// URL Final dari User
const API_URL = "https://script.google.com/macros/s/AKfycbziuE1X6G9JMd0zC5j9L78YWvsX2GjRcBNp8MXCk2BOPJL4zZ-bJTkkS61Kld_0ML49tA/exec";

interface ApiResponse {
  status: 'success' | 'error';
  data?: any;
  message?: string;
}

interface DriveFile {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  type: string;
  date: string;
  snippet?: string;
}

export interface CloudFolder {
  id: string;
  name: string;
  url: string;
}

const callGoogleScript = async (payload: any): Promise<ApiResponse> => {
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

// --- OPTIMIZATION: IMAGE COMPRESSION ---
// Mobile photos are huge (5-10MB). Converting to Base64 creates massive strings that crash browsers.
// We compress client-side to max 1920px width/height and 0.8 quality.
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // If not an image or very small, just return raw base64
    if (!file.type.startsWith('image/') || file.size < 500 * 1024) { 
       fileToBase64(file).then(resolve).catch(reject);
       return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;

        // Calculate new dimensions
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
           fileToBase64(file).then(resolve).catch(reject); // Fallback
           return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with 0.8 quality
        // This drastically reduces Base64 string length
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const getGoogleCdnUrl = (fileId: string): string => {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
};

// 0. Fetch All Folders from Cloud
export const fetchAllCloudGalleries = async (): Promise<CloudFolder[]> => {
  const result = await callGoogleScript({
    action: "getFolders"
  });
  
  if (result.status === "success" && Array.isArray(result.data)) {
    return result.data;
  } else {
    return [];
  }
};

// 0.5 Fetch File Content (For Notes)
export const getFileContent = async (fileId: string): Promise<string> => {
  const result = await callGoogleScript({
    action: "getFileContent",
    fileId: fileId
  });

  if (result.status === 'success') {
    return typeof result.data?.content === 'string' ? result.data.content : "";
  } else {
    throw new Error(result.message || "Gagal mengambil konten catatan.");
  }
};

// 1. Create Folder Explicitly
export const createFolderInDrive = async (folderName: string): Promise<string> => {
  const result = await callGoogleScript({
    action: "createFolder",
    folderName: folderName
  });

  if (result.status === 'error') throw new Error(result.message);
  return result.data?.folderId || "";
};

// 1.5 Delete Folder
export const deleteFolderInDrive = async (folderId: string): Promise<void> => {
  const result = await callGoogleScript({
    action: "deleteFolder",
    folderId: folderId
  });

  if (result.status === 'error') throw new Error(result.message);
};

// 1.6 Rename Folder
export const renameFolderInDrive = async (folderId: string, newName: string): Promise<void> => {
  const result = await callGoogleScript({
    action: "renameFolder",
    folderId: folderId,
    newName: newName
  });

  if (result.status === 'error') throw new Error(result.message);
};

// 2. Upload Image / File (WITH COMPRESSION)
export const uploadToDrive = async (file: File, folderName: string): Promise<DriveFile> => {
  // Use compressed base64
  const base64 = await compressImage(file);
  
  const result = await callGoogleScript({
    action: "uploadImage",
    folderName: folderName,
    fileName: file.name,
    mimeType: "image/jpeg", // Always send as JPEG if compressed, handles png transparency poorly but stable for photos
    base64: base64
  });

  if (result.status === 'error') {
    throw new Error(result.message || "Upload gagal dari sisi server.");
  }
  
  const data = result.data;
  if (!data || !data.id) {
    throw new Error("Respon server tidak memiliki File ID.");
  }

  const cdnUrl = getGoogleCdnUrl(data.id);

  return {
    id: data.id,
    name: data.name || file.name,
    url: cdnUrl, 
    thumbnail: cdnUrl,
    type: file.type || "image/jpeg",
    date: new Date().toISOString(),
    snippet: ""
  };
};

// 3. Upload Note (Create or Update)
export const uploadNoteToDrive = async (noteTitle: string, content: string, folderName: string, fileId?: string): Promise<DriveFile> => {
  const result = await callGoogleScript({
    action: "saveNote", 
    folderName: folderName,
    title: noteTitle,
    content: content,
    fileId: fileId || null 
  });

  if (result.status === 'error') throw new Error(result.message);
  
  const data = result.data;

  return {
    id: data.id,
    name: data.name,
    url: data.url, 
    thumbnail: "",
    type: 'text/plain',
    date: new Date().toISOString(),
    snippet: content.substring(0, 100) 
  };
};

// 4. Load Gallery (Get Files)
export const loadGallery = async (folderName: string): Promise<{ images: StoredImage[], notes: StoredNote[] }> => {
  const result = await callGoogleScript({
    action: "getFiles",
    folderName: folderName
  });

  if (result.status === 'error') throw new Error(result.message);

  const rawFiles: any[] = result.data || []; 
  
  const images: StoredImage[] = [];
  const notes: StoredNote[] = [];

  rawFiles.forEach((file) => {
    const rawMime = file.mimeType || file.type;
    const mime = (rawMime || "").toLowerCase();
    const name = (file.name || "").toLowerCase();
    
    let fileType = "unknown";
    
    if (mime.startsWith('image/') || name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)) {
      fileType = "image";
    } else if (mime.startsWith('text/') || name.endsWith('.txt')) {
      fileType = "note";
    }

    if (fileType === "image") {
      const cdnUrl = getGoogleCdnUrl(file.id);
      
      images.push({
        id: file.id,
        galleryId: folderName,
        name: file.name || "Untitled Image",
        type: mime || 'image/jpeg',
        size: 0, 
        data: cdnUrl,
        timestamp: file.lastUpdated ? new Date(file.lastUpdated).getTime() : Date.now()
      });
    } else if (fileType === "note") {
      notes.push({
        id: file.id,
        galleryId: folderName,
        title: (file.name || "Untitled Note").replace('.txt', ''),
        content: file.url,
        snippet: file.snippet || "Memuat preview...", 
        timestamp: file.lastUpdated ? new Date(file.lastUpdated).getTime() : Date.now()
      });
    }
  });

  return { images, notes };
};

// 5. Delete File
export const deleteFromDrive = async (fileId: string): Promise<void> => {
  const result = await callGoogleScript({
    action: "deleteFile",
    fileId: fileId
  });

  if (result.status === 'error') throw new Error(result.message);
};

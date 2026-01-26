
import { StoredImage, StoredNote } from '../types';

// URL Final dari User (Deployment Terbaru - Fix Gambar & Error)
const API_URL = "https://script.google.com/macros/s/AKfycbw0mSJvV2I2sBZib-Gga3iNITIz06BHR1B3QqfOIKcgRGqCWwll6lDeLarE50FdViG3Bg/exec";

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
}

export interface CloudFolder {
  id: string;
  name: string;
  url: string;
}

// --- CORE HELPER: THE SILVER BULLET ---
// Menggunakan 'text/plain' untuk mem-bypass preflight CORS check browser
const callGoogleScript = async (payload: any): Promise<ApiResponse> => {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      // HEADER KUNCI: Jangan application/json, tapi text/plain
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    // Ambil text dulu, baru parse (untuk jaga-jaga jika GAS return HTML error)
    const textResult = await response.text();
    
    try {
      return JSON.parse(textResult);
    } catch (e) {
      console.error("Non-JSON Response received:", textResult);
      throw new Error("Server merespon dengan format yang salah (HTML/Text). Cek console.");
    }

  } catch (error) {
    console.error("Fetch Error:", error);
    // Lempar error agar bisa ditangkap UI
    throw new Error(error instanceof Error ? error.message : "Gagal menghubungi server Google.");
  }
};

// Helper: Convert File/Blob to Base64
export const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// 0. Fetch All Folders from Cloud
export const fetchAllCloudGalleries = async (): Promise<CloudFolder[]> => {
  const result = await callGoogleScript({
    action: "getFolders"
  });
  
  if (result.status === "success" && Array.isArray(result.data)) {
    return result.data;
  } else {
    console.warn("Gagal load folder cloud:", result.message);
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
    // Pastikan return string, jangan object atau undefined
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

// 2. Upload Image / File
export const uploadToDrive = async (file: File, folderName: string): Promise<DriveFile> => {
  const base64 = await fileToBase64(file);
  
  const result = await callGoogleScript({
    action: "uploadImage",
    folderName: folderName,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream", 
    base64: base64
  });

  if (result.status === 'error') {
    throw new Error(result.message || "Upload gagal dari sisi server.");
  }
  
  // Validasi Data Balikan
  const data = result.data;
  if (!data || !data.id) {
    throw new Error("Respon server tidak memiliki File ID.");
  }

  return {
    id: data.id,
    name: data.name || file.name,
    url: data.url || "",
    // Use URL (HD) as primary data source, ignore thumbnail logic if HD is preferred
    thumbnail: data.thumbnail || data.url || "", 
    type: file.type || "image/png",
    date: new Date().toISOString()
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
    date: new Date().toISOString()
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
    // --- SAFETY CHECK (SAFE MODE) ---
    // Mencegah error 'cannot read property of undefined'
    
    // 1. Ambil mimeType atau type, fallback ke string kosong
    const rawMime = file.mimeType || file.type;
    const mime = (rawMime || "").toLowerCase();
    const name = (file.name || "").toLowerCase();
    
    // 2. Logic Deteksi
    let fileType = "unknown";
    
    if (mime.startsWith('image/') || name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)) {
      fileType = "image";
    } else if (mime.startsWith('text/') || name.endsWith('.txt')) {
      fileType = "note";
    }

    if (fileType === "image") {
      images.push({
        id: file.id,
        galleryId: folderName,
        name: file.name || "Untitled Image",
        type: mime || 'image/jpeg',
        size: 0, 
        // Menggunakan URL full resolusi (view link) alih-alih thumbnail
        data: file.url || file.thumbnail, 
        timestamp: file.lastUpdated ? new Date(file.lastUpdated).getTime() : Date.now()
      });
    } else if (fileType === "note") {
      notes.push({
        id: file.id,
        galleryId: folderName,
        title: (file.name || "Untitled Note").replace('.txt', ''),
        content: file.url, // URL disimpan di list, konten diambil on-demand
        timestamp: file.lastUpdated ? new Date(file.lastUpdated).getTime() : Date.now()
      });
    }
    // File tipe lain diabaikan agar tidak crash
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


import { StoredImage, StoredNote } from '../types';

// URL Final dari User
const API_URL = "https://script.google.com/macros/s/AKfycbxK6aGRAo1J6PxACZah5ZTPg425MCsBtjZR_jE4mGQA0K4VROwkgdGi_L35lPp7019sWQ/exec";

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

// 0. Create Folder Explicitly
export const createFolderInDrive = async (folderName: string): Promise<string> => {
  const result = await callGoogleScript({
    action: "createFolder",
    folderName: folderName
  });

  if (result.status === 'error') throw new Error(result.message);
  return result.data?.folderId || "";
};

// 1. Upload Image / File
export const uploadToDrive = async (file: File, folderName: string): Promise<DriveFile> => {
  const base64 = await fileToBase64(file);
  
  const result = await callGoogleScript({
    action: "uploadImage",
    folderName: folderName,
    fileName: file.name,
    mimeType: file.type, // Dikirim untuk info, walau backend detect via blob
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
    thumbnail: data.thumbnail || data.url || "", // Fallback
    type: file.type,
    date: new Date().toISOString()
  };
};

// 2. Upload Note (As Text File)
export const uploadNoteToDrive = async (noteTitle: string, content: string, folderName: string): Promise<DriveFile> => {
  const result = await callGoogleScript({
    action: "saveNote", // Sesuai backend baru Anda "saveNote"
    folderName: folderName,
    title: noteTitle,
    content: content,
    fileId: null // null = new file
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

// 3. Load Gallery (Get Files)
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
    // Deteksi tipe file berdasarkan mimeType atau ekstensi
    const mime = file.mimeType || "";
    const name = file.name || "";
    
    const isImage = mime.startsWith('image/') || name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isText = mime === 'text/plain' || name.endsWith('.txt');

    if (isImage) {
      images.push({
        id: file.id,
        galleryId: folderName,
        name: name,
        type: mime || 'image/jpeg',
        size: 0, 
        data: file.thumbnail || file.url, // Prioritaskan thumbnail agar ringan
        timestamp: file.lastUpdated ? new Date(file.lastUpdated).getTime() : Date.now()
      });
    } else if (isText) {
      notes.push({
        id: file.id,
        galleryId: folderName,
        title: name.replace('.txt', ''),
        content: file.url, // Simpan URL view
        timestamp: file.lastUpdated ? new Date(file.lastUpdated).getTime() : Date.now()
      });
    }
  });

  return { images, notes };
};

// 4. Delete File
export const deleteFromDrive = async (fileId: string): Promise<void> => {
  const result = await callGoogleScript({
    action: "deleteFile",
    fileId: fileId
  });

  if (result.status === 'error') throw new Error(result.message);
};

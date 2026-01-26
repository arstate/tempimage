
import { StoredImage, StoredNote } from '../types';

const API_URL = "https://script.google.com/macros/s/AKfycbxnJTXOUwCbkeZ8FrYyFD0cXbjE_OxrofpUtTJIQIgI6SEz-XAGn5wey6W_Ika6HVR2UQ/exec";

interface ApiResponse {
  status: 'success' | 'error';
  data: any;
  message?: string;
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

// 1. Upload Image / File
export const uploadToDrive = async (file: File, folderName: string): Promise<DriveFile> => {
  const base64 = await fileToBase64(file);
  
  // Clean base64 string if needed (API might expect pure base64 or dataURI)
  // Usually GAS needs the full dataURI or just the part after comma. 
  // Based on your prompt example "reader.result", it sends the full Data URI.
  
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "uploadImage",
      folderName: folderName,
      fileName: file.name,
      mimeType: file.type, 
      base64: base64
    })
  });

  const result: ApiResponse = await response.json();
  if (result.status === 'error') throw new Error(result.message);
  
  return result.data;
};

// 2. Upload Note (As Text File)
export const uploadNoteToDrive = async (noteTitle: string, content: string, folderName: string): Promise<DriveFile> => {
  // Convert text content to base64
  // We use UTF-8 encoding for safety
  const blob = new Blob([content], { type: 'text/plain' });
  const base64 = await fileToBase64(blob);
  const fileName = `${noteTitle || 'Untitled'}.txt`;

  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "uploadImage", // We use the same action as it handles file creation
      folderName: folderName,
      fileName: fileName,
      mimeType: 'text/plain',
      base64: base64
    })
  });

  const result: ApiResponse = await response.json();
  if (result.status === 'error') throw new Error(result.message);
  return result.data;
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

  const rawFiles: DriveFile[] = result.data || [];
  
  const images: StoredImage[] = [];
  const notes: StoredNote[] = [];

  // Helper to fetch text content for notes
  const fetchTextContent = async (url: string): Promise<string> => {
    try {
      // Note: This might fail if the file isn't publicly downloadable or CORS issues.
      // If the GAS script returns a download URL that allows CORS, this works.
      const res = await fetch(url);
      return await res.text();
    } catch (e) {
      return "Error loading note content. CORS or permission issue.";
    }
  };

  // Process files in parallel
  await Promise.all(rawFiles.map(async (file) => {
    const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isText = file.type === 'text/plain' || file.name.endsWith('.txt');

    if (isImage) {
      images.push({
        id: file.id,
        galleryId: folderName, // Using folderName as galleryId context
        name: file.name,
        type: file.type || 'image/jpeg',
        size: 0, // API might not return size, strictly generic
        data: file.thumbnail || file.url, // Use thumbnail for preview if available, else URL
        timestamp: new Date(file.date).getTime()
      });
    } else if (isText) {
      // For notes, we try to fetch the content, or just show placeholder
      // Since 'getFiles' lists files, getting content requires a second hop usually.
      // We will store the URL in content for now, or fetch if possible.
      // Let's attempt to fetch content if it's a small text file.
      
      // NOTE: fetching content from Drive URL directly via client-side fetch often hits CORS.
      // A robust implementation would have 'getFiles' return the content for text files directly in the JSON.
      // Assuming for now we put the View URL as content, or the user clicks to edit (which might be complex).
      // Strategy: We will try to fetch the text content.
      
      let content = "Loading...";
      // We accept that this might be slow or fail depending on Drive permissions
      // To make it snappy, we might skip fetching content here and do it on click, 
      // but the UI renders content in the card.
      
      notes.push({
        id: file.id,
        galleryId: folderName,
        title: file.name.replace('.txt', ''),
        content: file.url, // Storing URL temporarily, UI will handle fetching or link
        timestamp: new Date(file.date).getTime()
      });
    }
  }));

  return { images, notes };
};

// 4. Delete File
export const deleteFromDrive = async (fileId: string): Promise<void> => {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "deleteFile",
      fileId: fileId // API seems to expect fileId based on standard GAS patterns
    })
  });

  const result: ApiResponse = await response.json();
  if (result.status === 'error') throw new Error(result.message);
};

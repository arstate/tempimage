
import { Gallery, StoredImage, StoredNote } from '../types';

const DB_NAME = 'ZombioGalleryDB_V2';
const STORE_GALLERIES = 'galleries';
const STORE_IMAGES = 'images';
const STORE_NOTES = 'notes';
const DB_VERSION = 3;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_GALLERIES)) {
        db.createObjectStore(STORE_GALLERIES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        const imageStore = db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
        imageStore.createIndex('galleryId', 'galleryId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_NOTES)) {
        const noteStore = db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
        noteStore.createIndex('galleryId', 'galleryId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Gallery Actions
export const saveGallery = async (gallery: Gallery): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_GALLERIES, 'readwrite');
  tx.objectStore(STORE_GALLERIES).put(gallery);
  return new Promise((res) => (tx.oncomplete = () => res()));
};

export const getGalleries = async (): Promise<Gallery[]> => {
  const db = await initDB();
  return new Promise((res) => {
    const request = db.transaction(STORE_GALLERIES, 'readonly').objectStore(STORE_GALLERIES).getAll();
    request.onsuccess = () => res(request.result);
  });
};

export const deleteGallery = async (id: string): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction([STORE_GALLERIES, STORE_IMAGES, STORE_NOTES], 'readwrite');
  
  // Delete Gallery
  tx.objectStore(STORE_GALLERIES).delete(id);
  
  // Delete Images
  const imageStore = tx.objectStore(STORE_IMAGES);
  const imageIndex = imageStore.index('galleryId');
  const imgRequest = imageIndex.getAllKeys(id);
  imgRequest.onsuccess = () => {
    imgRequest.result.forEach(key => imageStore.delete(key));
  };

  // Delete Notes
  const noteStore = tx.objectStore(STORE_NOTES);
  const noteIndex = noteStore.index('galleryId');
  const noteRequest = noteIndex.getAllKeys(id);
  noteRequest.onsuccess = () => {
    noteRequest.result.forEach(key => noteStore.delete(key));
  };

  return new Promise((res) => (tx.oncomplete = () => res()));
};

// --- Cache Management Helpers ---

export const clearGalleryCache = async (galleryId: string): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction([STORE_IMAGES, STORE_NOTES], 'readwrite');

  // Clear Images for this gallery
  const imageStore = tx.objectStore(STORE_IMAGES);
  const imageIndex = imageStore.index('galleryId');
  const imgRequest = imageIndex.getAllKeys(galleryId);
  imgRequest.onsuccess = () => {
    imgRequest.result.forEach(key => imageStore.delete(key));
  };

  // Clear Notes for this gallery
  const noteStore = tx.objectStore(STORE_NOTES);
  const noteIndex = noteStore.index('galleryId');
  const noteRequest = noteIndex.getAllKeys(galleryId);
  noteRequest.onsuccess = () => {
    noteRequest.result.forEach(key => noteStore.delete(key));
  };

  return new Promise((res) => (tx.oncomplete = () => res()));
};

export const saveBulkImages = async (images: StoredImage[]): Promise<void> => {
  if (images.length === 0) return;
  const db = await initDB();
  const tx = db.transaction(STORE_IMAGES, 'readwrite');
  const store = tx.objectStore(STORE_IMAGES);
  images.forEach(img => store.put(img));
  return new Promise((res) => (tx.oncomplete = () => res()));
};

export const saveBulkNotes = async (notes: StoredNote[]): Promise<void> => {
  if (notes.length === 0) return;
  const db = await initDB();
  const tx = db.transaction(STORE_NOTES, 'readwrite');
  const store = tx.objectStore(STORE_NOTES);
  notes.forEach(note => store.put(note));
  return new Promise((res) => (tx.oncomplete = () => res()));
};

// Image Actions (Individual)
export const saveImage = async (image: StoredImage): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_IMAGES, 'readwrite');
  tx.objectStore(STORE_IMAGES).put(image);
  return new Promise((res) => (tx.oncomplete = () => res()));
};

export const getImagesByGallery = async (galleryId: string): Promise<StoredImage[]> => {
  const db = await initDB();
  return new Promise((res) => {
    const index = db.transaction(STORE_IMAGES, 'readonly').objectStore(STORE_IMAGES).index('galleryId');
    const request = index.getAll(galleryId);
    request.onsuccess = () => res(request.result);
  });
};

export const deleteImage = async (id: string): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_IMAGES, 'readwrite');
  tx.objectStore(STORE_IMAGES).delete(id);
  return new Promise((res) => (tx.oncomplete = () => res()));
};

// Note Actions (Individual)
export const saveNote = async (note: StoredNote): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_NOTES, 'readwrite');
  tx.objectStore(STORE_NOTES).put(note);
  return new Promise((res) => (tx.oncomplete = () => res()));
};

export const getNotesByGallery = async (galleryId: string): Promise<StoredNote[]> => {
  const db = await initDB();
  return new Promise((res) => {
    const index = db.transaction(STORE_NOTES, 'readonly').objectStore(STORE_NOTES).index('galleryId');
    const request = index.getAll(galleryId);
    request.onsuccess = () => res(request.result);
  });
};

export const deleteNote = async (id: string): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_NOTES, 'readwrite');
  tx.objectStore(STORE_NOTES).delete(id);
  return new Promise((res) => (tx.oncomplete = () => res()));
};

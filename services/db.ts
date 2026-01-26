
import { Gallery, StoredImage, StoredNote, Item } from '../types';

const DB_NAME = 'ZombioGalleryDB_V3'; // Increment Version
const STORE_GALLERIES = 'galleries';
const STORE_FOLDER_CACHE = 'folder_cache'; // New Store for caching file lists
const DB_VERSION = 4;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Keep existing logic if needed, but primarily we use folder_cache now
      if (!db.objectStoreNames.contains(STORE_GALLERIES)) {
        db.createObjectStore(STORE_GALLERIES, { keyPath: 'id' });
      }
      
      // New Cache Store: Key = folderId, Value = Item[]
      if (!db.objectStoreNames.contains(STORE_FOLDER_CACHE)) {
        db.createObjectStore(STORE_FOLDER_CACHE, { keyPath: 'folderId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// --- FOLDER CACHE FUNCTIONS ---

export const getCachedFolder = async (folderId: string): Promise<Item[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_FOLDER_CACHE, 'readonly');
    const store = tx.objectStore(STORE_FOLDER_CACHE);
    // Use "root" for empty string folderId
    const key = folderId || "root"; 
    const request = store.get(key);
    
    request.onsuccess = () => {
      resolve(request.result ? request.result.items : []);
    };
    request.onerror = () => resolve([]);
  });
};

export const cacheFolderContents = async (folderId: string, items: Item[]): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_FOLDER_CACHE, 'readwrite');
  const store = tx.objectStore(STORE_FOLDER_CACHE);
  
  const key = folderId || "root";
  store.put({ folderId: key, items: items, timestamp: Date.now() });
  
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const clearCache = async (): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(STORE_FOLDER_CACHE, 'readwrite');
    tx.objectStore(STORE_FOLDER_CACHE).clear();
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

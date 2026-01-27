
import { Gallery, StoredImage, StoredNote, Item, SystemDB, FolderMap } from '../types';

const DB_NAME = 'ZombioGalleryDB_V3'; // Keep Name
const STORE_GALLERIES = 'galleries';
const STORE_FOLDER_CACHE = 'folder_cache';
const STORE_DELETED_META = 'deleted_meta'; 
const STORE_SYSTEM_MAP = 'system_map'; // New Store for Folder Mapping
const DB_VERSION = 6; // Incremented

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_GALLERIES)) {
        db.createObjectStore(STORE_GALLERIES, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORE_FOLDER_CACHE)) {
        db.createObjectStore(STORE_FOLDER_CACHE, { keyPath: 'folderId' });
      }

      if (!db.objectStoreNames.contains(STORE_DELETED_META)) {
        db.createObjectStore(STORE_DELETED_META, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_SYSTEM_MAP)) {
        db.createObjectStore(STORE_SYSTEM_MAP, { keyPath: 'key' }); // Singleton store
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// --- FOLDER CACHE FUNCTIONS ---

export const getCachedFolder = async (folderId: string): Promise<Item[] | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_FOLDER_CACHE, 'readonly');
    const store = tx.objectStore(STORE_FOLDER_CACHE);
    const key = folderId || "root"; 
    const request = store.get(key);
    
    request.onsuccess = () => {
      resolve(request.result ? request.result.items : null);
    };
    request.onerror = () => resolve(null);
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

export const updateItemInCache = async (folderId: string, updatedItem: Item): Promise<void> => {
    const items = (await getCachedFolder(folderId)) || [];
    const index = items.findIndex(i => i.id === updatedItem.id);
    
    if (index !== -1) {
        items[index] = updatedItem;
    } else {
        items.push(updatedItem);
    }
    
    await cacheFolderContents(folderId, items);
};

export const clearCache = async (): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(STORE_FOLDER_CACHE, 'readwrite');
    tx.objectStore(STORE_FOLDER_CACHE).clear();
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

// --- DELETED META FUNCTIONS ---

export const saveDeletedMeta = async (itemId: string, originalParentId: string): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_DELETED_META, 'readwrite');
  const store = tx.objectStore(STORE_DELETED_META);
  store.put({ id: itemId, originalParentId: originalParentId });
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

export const getDeletedMeta = async (itemId: string): Promise<string | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_DELETED_META, 'readonly');
    const store = tx.objectStore(STORE_DELETED_META);
    const request = store.get(itemId);
    request.onsuccess = () => {
      resolve(request.result ? request.result.originalParentId : null);
    };
    request.onerror = () => resolve(null);
  });
};

export const removeDeletedMeta = async (itemId: string): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_DELETED_META, 'readwrite');
  tx.objectStore(STORE_DELETED_META).delete(itemId);
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

// --- SYSTEM MAP FUNCTIONS (DB CACHE) ---

export const getSystemMap = async (): Promise<SystemDB | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_SYSTEM_MAP, 'readonly');
    const store = tx.objectStore(STORE_SYSTEM_MAP);
    const request = store.get('main_map');
    request.onsuccess = () => {
      resolve(request.result ? request.result.data : null);
    };
    request.onerror = () => resolve(null);
  });
};

export const saveSystemMap = async (data: SystemDB): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_SYSTEM_MAP, 'readwrite');
  const store = tx.objectStore(STORE_SYSTEM_MAP);
  store.put({ key: 'main_map', data: data });
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

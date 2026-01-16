
import { Gallery, StoredImage } from '../types';

const DB_NAME = 'ZombioGalleryDB_V2';
const STORE_GALLERIES = 'galleries';
const STORE_IMAGES = 'images';
const DB_VERSION = 2;

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
  // Delete gallery and all its images
  const tx = db.transaction([STORE_GALLERIES, STORE_IMAGES], 'readwrite');
  tx.objectStore(STORE_GALLERIES).delete(id);
  const imageStore = tx.objectStore(STORE_IMAGES);
  const index = imageStore.index('galleryId');
  const request = index.getAllKeys(id);
  request.onsuccess = () => {
    request.result.forEach(key => imageStore.delete(key));
  };
  return new Promise((res) => (tx.oncomplete = () => res()));
};

// Image Actions
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

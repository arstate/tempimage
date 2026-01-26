
export interface Gallery {
  id: string;
  name: string;
  timestamp: number;
}

export interface StoredImage {
  id: string;
  galleryId: string;
  name: string;
  type: string;
  size: number;
  data: string;
  timestamp: number;
}

export interface StoredNote {
  id: string;
  galleryId: string;
  title: string;
  content: string; // HTML content
  timestamp: number;
}


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

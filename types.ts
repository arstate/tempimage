
export interface StoredImage {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64 or Blob Data URL
  timestamp: number;
}

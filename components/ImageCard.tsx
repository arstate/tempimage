
import React, { useMemo, useRef, useEffect } from 'react';
import { Trash2, Maximize2, Download, GripVertical } from 'lucide-react';
import { StoredImage } from '../types';

interface ImageCardProps {
  image: StoredImage;
  onDelete: (id: string) => void;
  onMaximize: (url: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ image, onDelete, onMaximize }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullImageRef = useRef<HTMLImageElement>(null); // Ref untuk gambar asli (tidak terpotong)

  const formattedSize = (image.size / 1024 / 1024).toFixed(2) + ' MB';
  const formattedDate = new Date(image.timestamp).toLocaleDateString();

  // Konversi Base64 ke File Object & Blob URL
  const { blobUrl, fileObject } = useMemo(() => {
    try {
      const parts = image.data.split(',');
      const byteString = atob(parts[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: image.type });
      const file = new File([blob], image.name, { type: image.type });
      return { 
        blobUrl: URL.createObjectURL(blob), 
        fileObject: file 
      };
    } catch (e) {
      return { blobUrl: image.data, fileObject: null };
    }
  }, [image.data, image.type, image.name]);

  // Cleanup Blob URL
  useEffect(() => {
    return () => {
      if (blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = image.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDragStart = (e: React.DragEvent) => {
    const dt = e.dataTransfer;
    dt.effectAllowed = 'all';

    // 1. Kirim File Fisik (Penting untuk WA/Telegram/Explorer)
    if (fileObject) {
      dt.items.add(fileObject);
    }

    // 2. Metadata untuk Drag to Desktop (Chrome/Edge)
    dt.setData('DownloadURL', `${image.type}:${image.name}:${blobUrl}`);
    dt.setData('text/uri-list', blobUrl);
    dt.setData('text/plain', image.name);
    
    // 3. HTML Fallback
    dt.setData('text/html', `<img src="${image.data}" alt="${image.name}" />`);

    // 4. FIX GHOST IMAGE: Gunakan gambar 'fullImageRef' yang tidak terpotong
    if (fullImageRef.current) {
      // Kita set bayangan drag menggunakan elemen yang aslinya (aspect ratio terjaga)
      // Titik tangkap (offset) disesuaikan agar terasa natural
      const rect = fullImageRef.current.getBoundingClientRect();
      dt.setDragImage(fullImageRef.current, rect.width / 2, rect.height / 2);
    }
  };

  return (
    <div 
      ref={containerRef}
      draggable="true"
      onDragStart={handleDragStart}
      className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-blue-500/10 cursor-grab active:cursor-grabbing"
    >
      {/* ELEMEN TERSEMBUNYI UNTUK GHOST IMAGE (DIPERLUKAN AGAR TIDAK TERPOTONG SAAT DRAG) */}
      <div className="fixed -top-[9999px] -left-[9999px] pointer-events-none opacity-0">
        <img
          ref={fullImageRef}
          src={blobUrl}
          alt="drag-preview"
          className="max-w-[300px] h-auto" // Ukuran bayangan tidak boleh terlalu raksasa
        />
      </div>

      {/* Indikator Drag */}
      <div className="absolute top-2 left-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/80 backdrop-blur-sm p-1 rounded border border-blue-400/50 pointer-events-none">
        <GripVertical size={14} className="text-white" />
      </div>

      {/* Preview Galeri (Tetap Square/Terpotong demi estetika grid) */}
      <div className="aspect-square w-full overflow-hidden bg-slate-900 flex items-center justify-center pointer-events-none">
        <img
          src={blobUrl}
          alt={image.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          draggable="false"
        />
      </div>
      
      {/* Tombol Aksi */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); onMaximize(blobUrl); }}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
        >
          <Maximize2 size={20} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
        >
          <Download size={20} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}
          className="p-3 bg-red-500/20 hover:bg-red-500/40 rounded-full transition-colors text-red-400"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Info File */}
      <div className="p-3 flex flex-col bg-slate-800/90 backdrop-blur-sm pointer-events-none border-t border-slate-700/50">
        <span className="text-sm font-medium truncate text-slate-200">{image.name}</span>
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-slate-500 uppercase">{formattedSize}</span>
          <span className="text-[10px] text-slate-500 uppercase">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
};

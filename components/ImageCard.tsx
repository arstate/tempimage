
import React, { useMemo, useRef, useEffect } from 'react';
import { Trash2, Maximize2, Download, GripVertical } from 'lucide-react';
import { StoredImage } from '../types';

interface ImageCardProps {
  image: StoredImage;
  onDelete: (id: string) => void;
  onMaximize: (url: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ image, onDelete, onMaximize }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formattedSize = (image.size / 1024 / 1024).toFixed(2) + ' MB';
  const formattedDate = new Date(image.timestamp).toLocaleDateString();

  // Membangun Blob URL dan File Object
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

  // Cleanup Blob URL saat komponen unmount
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
    
    // Memberitahu browser bahwa ini adalah aksi pemindahan file
    dt.effectAllowed = 'all';

    // 1. Tambahkan File Fisik (Metode utama untuk aplikasi modern seperti WA/Telegram)
    if (fileObject) {
      dt.items.add(fileObject);
    }

    // 2. DownloadURL Hack (Metode klasik untuk drag ke Desktop/Folder di Chrome/Edge)
    // Format: "mime:filename:url"
    const downloadData = `${image.type}:${image.name}:${blobUrl}`;
    dt.setData('DownloadURL', downloadData);

    // 3. Fallback Link & Teks
    dt.setData('text/uri-list', blobUrl);
    dt.setData('text/plain', image.name);
    
    // 4. HTML Fallback (Base64 agar beberapa aplikasi bisa langsung merender)
    dt.setData('text/html', `<img src="${image.data}" alt="${image.name}" />`);

    // 5. GHOST IMAGE: Gunakan elemen gambar asli agar bayangannya tidak kotak
    if (imgRef.current) {
      // Kita set titik pusat tarikan di tengah gambar
      dt.setDragImage(imgRef.current, imgRef.current.clientWidth / 2, imgRef.current.clientHeight / 2);
    }
  };

  return (
    <div 
      ref={containerRef}
      draggable="true"
      onDragStart={handleDragStart}
      className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-blue-500/10 cursor-grab active:cursor-grabbing"
    >
      {/* Indikator Draggable */}
      <div className="absolute top-2 left-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/80 backdrop-blur-sm p-1 rounded border border-blue-400/50 pointer-events-none">
        <GripVertical size={14} className="text-white" />
      </div>

      <div className="aspect-square w-full overflow-hidden bg-slate-900 flex items-center justify-center pointer-events-none">
        <img
          ref={imgRef}
          src={blobUrl}
          alt={image.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          draggable="false" // Kita handle drag via kontainer induk
        />
      </div>
      
      {/* Overlay Aksi - Hanya muncul saat hover, dipisahkan dari area drag jika perlu */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); onMaximize(blobUrl); }}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          title="Tampilan Fullscreen"
        >
          <Maximize2 size={20} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          title="Download"
        >
          <Download size={20} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}
          className="p-3 bg-red-500/20 hover:bg-red-500/40 rounded-full transition-colors text-red-400"
          title="Hapus"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Info File */}
      <div className="p-3 flex flex-col bg-slate-800/90 backdrop-blur-sm pointer-events-none border-t border-slate-700/50">
        <span className="text-sm font-medium truncate text-slate-200">{image.name}</span>
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{formattedSize}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
};

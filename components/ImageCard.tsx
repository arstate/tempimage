
import React, { useMemo, useRef } from 'react';
import { Trash2, Maximize2, Download, GripVertical } from 'lucide-react';
import { StoredImage } from '../types';

interface ImageCardProps {
  image: StoredImage;
  onDelete: (id: string) => void;
  onMaximize: (url: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ image, onDelete, onMaximize }) => {
  const imgRef = useRef<HTMLImageElement>(null);
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
    
    // 1. Kirim File Fisik (Sangat penting untuk WA/Telegram)
    if (fileObject) {
      dt.items.add(fileObject);
    }

    // 2. Metadata tambahan
    dt.setData('DownloadURL', `${image.type}:${image.name}:${blobUrl}`);
    dt.setData('text/uri-list', blobUrl);
    dt.setData('text/plain', image.name);
    
    // 3. HTML Fallback (Base64 agar tujuan bisa baca langsung)
    dt.setData('text/html', `<img src="${image.data}" alt="${image.name}" />`);

    dt.effectAllowed = 'copyMove';

    // 4. FIX GHOST IMAGE: Gunakan gambar asli agar tidak kotak (square) saat ditarik
    const dragIcon = new Image();
    dragIcon.src = blobUrl;
    
    // Kita buat ukuran ghost image yang proporsional (max 200px) agar tidak terlalu besar di layar
    // Namun tetap mempertahankan aspek rasio asli (seperti fullscreen)
    dt.setDragImage(imgRef.current!, 50, 50);
  };

  return (
    <div 
      className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-blue-500/10"
    >
      {/* Pegangan Drag */}
      <div 
        draggable="true"
        onDragStart={handleDragStart}
        className="absolute top-2 left-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 p-1.5 rounded-lg shadow-xl cursor-grab active:cursor-grabbing border border-blue-400"
      >
        <GripVertical size={16} className="text-white" />
      </div>

      <div className="aspect-square w-full overflow-hidden bg-slate-900 flex items-center justify-center">
        <img
          ref={imgRef}
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
          onClick={() => onMaximize(blobUrl)}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          title="Tampilan Fullscreen"
        >
          <Maximize2 size={20} />
        </button>
        <button
          onClick={handleDownload}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          title="Download"
        >
          <Download size={20} />
        </button>
        <button
          onClick={() => onDelete(image.id)}
          className="p-3 bg-red-500/20 hover:bg-red-500/40 rounded-full transition-colors text-red-400"
          title="Hapus"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div className="p-3 flex flex-col bg-slate-800/90 backdrop-blur-sm pointer-events-none">
        <span className="text-sm font-medium truncate text-slate-200">{image.name}</span>
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-slate-500 uppercase">{formattedSize}</span>
          <span className="text-[10px] text-slate-500 uppercase">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
};

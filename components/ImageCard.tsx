
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
  const ghostRef = useRef<HTMLImageElement>(null);

  const formattedSize = (image.size / 1024 / 1024).toFixed(2) + ' MB';
  const formattedDate = new Date(image.timestamp).toLocaleDateString();

  // Mempersiapkan Blob dan File Object secara efisien
  const { blobUrl, fileObject } = useMemo(() => {
    try {
      const parts = image.data.split(',');
      if (parts.length < 2) throw new Error("Invalid data format");
      
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
      console.error("Error creating blob:", e);
      return { blobUrl: image.data, fileObject: null };
    }
  }, [image.data, image.type, image.name]);

  // Bersihkan memory blob URL saat komponen dihapus
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
    // Pastikan kita bekerja dengan dataTransfer
    const dt = e.dataTransfer;
    if (!dt) return;

    // 1. Set Efek Visual
    dt.effectAllowed = 'copyMove';

    // 2. Kirim File Fisik (SANGAT PENTING untuk WA/Telegram Desktop)
    if (fileObject) {
      dt.items.add(fileObject);
    }

    // 3. Format Khusus Chrome untuk Drag ke Desktop/Folder
    // Format: "mime:filename:full_url"
    const downloadHeader = `${image.type}:${image.name}:${blobUrl}`;
    dt.setData('DownloadURL', downloadHeader);

    // 4. Fallback Data
    dt.setData('text/uri-list', blobUrl);
    dt.setData('text/plain', image.name);

    // 5. ATUR VISUAL PREVIEW (GHOST IMAGE) AGAR TIDAK TERPOTONG
    if (ghostRef.current) {
      // Kita gunakan gambar tersembunyi yang memiliki proporsi asli
      // Gambar ini berukuran maksimal 250px agar tidak terlalu besar saat ditarik
      dt.setDragImage(ghostRef.current, ghostRef.current.offsetWidth / 2, ghostRef.current.offsetHeight / 2);
    }
  };

  return (
    <div 
      ref={containerRef}
      draggable="true"
      onDragStart={handleDragStart}
      className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-blue-500/10 cursor-grab active:cursor-grabbing"
    >
      {/* 
        GHOST IMAGE PREVIEW (Invisible to user, visible to Browser Drag Engine)
        Kita letakkan di dalam kartu agar browser mudah merendernya saat drag dimulai.
      */}
      <img
        ref={ghostRef}
        src={blobUrl}
        alt="drag-ghost"
        className="absolute pointer-events-none opacity-0 z-[-1]"
        style={{ 
          width: '240px', 
          height: 'auto',
          top: 0,
          left: 0
        }}
      />

      {/* Indikator Titik Drag (Grip) */}
      <div className="absolute top-2 left-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/80 backdrop-blur-sm p-1 rounded border border-blue-400/50 pointer-events-none">
        <GripVertical size={14} className="text-white" />
      </div>

      {/* Tampilan Visual Galeri (Square/Cover) */}
      <div className="aspect-square w-full overflow-hidden bg-slate-900 flex items-center justify-center pointer-events-none">
        <img
          src={blobUrl}
          alt={image.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          draggable="false"
        />
      </div>
      
      {/* Overlay Tombol Aksi */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); onMaximize(blobUrl); }}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          title="Fullscreen"
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

      {/* Label Info Bawah */}
      <div className="p-3 flex flex-col bg-slate-800/90 backdrop-blur-sm pointer-events-none border-t border-slate-700/50">
        <span className="text-sm font-medium truncate text-slate-200">{image.name}</span>
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-slate-500 uppercase font-mono">{formattedSize}</span>
          <span className="text-[10px] text-slate-500 uppercase font-mono">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
};

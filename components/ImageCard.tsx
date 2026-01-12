
import React, { useMemo, useRef, useEffect } from 'react';
import { Trash2, Maximize2, Download, GripVertical } from 'lucide-react';
import { StoredImage } from '../types';

interface ImageCardProps {
  image: StoredImage;
  onDelete: (id: string) => void;
  onMaximize: (url: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ image, onDelete, onMaximize }) => {
  const ghostRef = useRef<HTMLImageElement>(null);

  const formattedSize = (image.size / 1024 / 1024).toFixed(2) + ' MB';
  const formattedDate = new Date(image.timestamp).toLocaleDateString();

  // Konversi Base64 ke Blob URL dan File Object
  // Ini memastikan kita memegang referensi file asli yang bisa ditarik
  const { blobUrl, fileObject } = useMemo(() => {
    try {
      const parts = image.data.split(',');
      if (parts.length < 2) return { blobUrl: image.data, fileObject: null };
      
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
      console.error("Conversion error:", e);
      return { blobUrl: image.data, fileObject: null };
    }
  }, [image.data, image.type, image.name]);

  // Cleanup Blob URL untuk menghindari kebocoran memori
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
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
    if (!dt) return;

    // Izinkan operasi Copy (menyalin file)
    dt.effectAllowed = 'copy';

    // 1. TAMBAHKAN FILE ASLI KE DATA TRANSFER
    // Ini kunci agar WA/Telegram mengenali ini sebagai kiriman file gambar asli
    if (fileObject) {
      dt.items.add(fileObject);
    }

    // 2. METADATA UNTUK DESKTOP (Chrome/Edge)
    // Memungkinkan drag langsung ke folder komputer untuk save file
    const downloadHeader = `${image.type}:${image.name}:${blobUrl}`;
    dt.setData('DownloadURL', downloadHeader);
    
    // Fallback URL
    dt.setData('text/uri-list', blobUrl);
    dt.setData('text/plain', image.name);

    // 3. SET GHOST IMAGE (VISUAL SAAT DRAG)
    // Kita gunakan elemen ghostRef yang tidak ter-crop (aspect-ratio asli)
    if (ghostRef.current) {
      // Kita set bayangan drag ke gambar asli yang sudah dimuat
      // Offset diletakkan di tengah gambar
      dt.setDragImage(ghostRef.current, ghostRef.current.offsetWidth / 2, ghostRef.current.offsetHeight / 2);
    }
  };

  return (
    <div 
      draggable="true"
      onDragStart={handleDragStart}
      className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-blue-500/10 cursor-grab active:cursor-grabbing"
    >
      {/* 
        GHOST IMAGE ELEMENT
        Ini adalah gambar asli (original ratio) yang disembunyikan dari UI
        tapi digunakan oleh browser sebagai visual "bayangan" saat gambar ditarik.
        Ukurannya dibatasi agar tidak terlalu memenuhi layar saat ditarik.
      */}
      <div className="absolute opacity-0 pointer-events-none -z-10 overflow-hidden w-0 h-0">
        <img
          ref={ghostRef}
          src={blobUrl}
          alt="ghost"
          style={{ maxWidth: '300px', height: 'auto' }}
          className="block"
        />
      </div>

      {/* Indikator Grip */}
      <div className="absolute top-2 left-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/80 backdrop-blur-sm p-1 rounded border border-blue-400/50 pointer-events-none">
        <GripVertical size={14} className="text-white" />
      </div>

      {/* Tampilan Grid (Thumbnail) - Tetap object-cover agar rapi dalam grid */}
      <div className="aspect-square w-full overflow-hidden bg-slate-900 flex items-center justify-center pointer-events-none">
        <img
          src={blobUrl}
          alt={image.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          draggable="false" 
        />
      </div>
      
      {/* Tombol Overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); onMaximize(blobUrl); }}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          title="Lihat Fullscreen"
        >
          <Maximize2 size={20} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          title="Download File"
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

      {/* Info Label */}
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

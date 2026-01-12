
import React, { useMemo, useRef } from 'react';
import { Trash2, Maximize2, Download, GripVertical } from 'lucide-react';
import { StoredImage } from '../types';

interface ImageCardProps {
  image: StoredImage;
  onDelete: (id: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ image, onDelete }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const formattedSize = (image.size / 1024 / 1024).toFixed(2) + ' MB';
  const formattedDate = new Date(image.timestamp).toLocaleDateString();

  // Buat File object dan Blob URL
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
    
    // 1. TAMBAHKAN FILE ASLI (Paling Penting untuk WA Web/App lain)
    // Ini memasukkan file fisik ke dalam "antrean" drop
    if (fileObject && dt.items) {
      dt.items.add(fileObject);
    }

    // 2. DownloadURL (Standar Chrome untuk drag ke Desktop/Folder)
    const downloadData = `${image.type}:${image.name}:${blobUrl}`;
    dt.setData('DownloadURL', downloadData);

    // 3. HTML Snippet (Biasanya dibaca oleh aplikasi Rich Text)
    // Menggunakan base64 di sini lebih aman karena website tujuan tidak bisa akses blobUrl kita
    const htmlSnippet = `<img src="${image.data}" alt="${image.name}" />`;
    dt.setData('text/html', htmlSnippet);

    // 4. URI List & Plain Text (Fallback)
    dt.setData('text/uri-list', blobUrl);
    dt.setData('text/plain', image.name);

    dt.effectAllowed = 'all';

    // 5. ATUR VISUAL GHOST (Hanya fotonya saja yang terlihat ditarik)
    if (imgRef.current) {
      // Kita beri sedikit offset agar kursor berada di tengah gambar yang ditarik
      dt.setDragImage(imgRef.current, imgRef.current.offsetWidth / 2, imgRef.current.offsetHeight / 2);
    }
  };

  return (
    <div 
      className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-500 transition-all duration-300 shadow-lg hover:shadow-blue-500/10 cursor-grab active:cursor-grabbing"
      draggable="true"
      onDragStart={handleDragStart}
    >
      {/* Tombol Pegangan Drag yang Jelas */}
      <div className="absolute top-2 left-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 p-1.5 rounded-lg shadow-xl border border-blue-400 pointer-events-none">
        <GripVertical size={16} className="text-white" />
      </div>

      <div className="aspect-square w-full overflow-hidden bg-slate-900">
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
          onClick={(e) => { e.stopPropagation(); window.open(blobUrl, '_blank'); }}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          title="Lihat"
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

      <div className="p-3 flex flex-col relative z-10 bg-slate-800/90 backdrop-blur-sm pointer-events-none">
        <span className="text-sm font-medium truncate text-slate-200" title={image.name}>
          {image.name}
        </span>
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{formattedSize}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
};

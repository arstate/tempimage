
import React, { useMemo, useRef, useEffect } from 'react';
import { Trash2, Maximize2, Download } from 'lucide-react';
import { StoredImage } from '../types';

interface ImageCardProps {
  image: StoredImage;
  index: number;
  onDelete: (id: string) => void;
  onMaximize: (url: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ image, index, onDelete, onMaximize }) => {
  const ghostRef = useRef<HTMLImageElement>(null);

  const { blobUrl, fileObject } = useMemo(() => {
    try {
      const parts = image.data.split(',');
      if (parts.length < 2) return { blobUrl: image.data, fileObject: null };
      const byteString = atob(parts[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: image.type });
      const file = new File([blob], image.name, { type: image.type });
      return { blobUrl: URL.createObjectURL(blob), fileObject: file };
    } catch (e) {
      return { blobUrl: image.data, fileObject: null };
    }
  }, [image.data, image.type, image.name]);

  useEffect(() => {
    return () => { if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = image.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      draggable="true"
      onDragStart={(e) => {
        const dt = e.dataTransfer;
        if (!dt) return;
        dt.effectAllowed = 'copy';
        if (fileObject) dt.items.add(fileObject);
        dt.setData('DownloadURL', `${image.type}:${image.name}:${blobUrl}`);
        if (ghostRef.current) dt.setDragImage(ghostRef.current, ghostRef.current.offsetWidth / 2, ghostRef.current.offsetHeight / 2);
      }}
      className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-md transition-all hover:border-blue-500/30 flex flex-col"
    >
      {/* Ghost for drag */}
      <div className="absolute opacity-0 pointer-events-none -z-10 w-0 h-0 overflow-hidden">
        <img ref={ghostRef} src={blobUrl} style={{ maxWidth: '300px' }} />
      </div>

      {/* Image Area */}
      <div className="relative aspect-square w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        <span className="absolute top-2 left-2 z-10 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">
          #{index + 1}
        </span>
        <img src={blobUrl} alt={image.name} className="w-full h-full object-cover" draggable="false" />
      </div>

      {/* Persistent Controls Outside */}
      <div className="p-3 bg-slate-900">
        <div className="flex justify-between items-center gap-2 mb-3">
          <button 
            onClick={() => onMaximize(blobUrl)}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg flex justify-center transition-colors border border-slate-700"
            title="Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
          <button 
            onClick={handleDownload}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg flex justify-center transition-colors border border-slate-700"
            title="Download"
          >
            <Download size={16} />
          </button>
          <button 
            onClick={() => onDelete(image.id)}
            className="flex-1 py-2 bg-slate-800 hover:bg-red-500/20 text-red-400 rounded-lg flex justify-center transition-colors border border-slate-700"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
        
        <div className="text-[10px] text-slate-400 truncate font-medium uppercase tracking-tighter" title={image.name}>
          {image.name}
        </div>
      </div>
    </div>
  );
};

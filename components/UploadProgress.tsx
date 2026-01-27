
import React, { useEffect, useState } from 'react';
import { FileIcon, X, CheckCircle, AlertCircle, Loader2, Minimize2, Maximize2 } from 'lucide-react';

export interface UploadItem {
  id: string;
  file: File;
  status: 'uploading' | 'success' | 'error';
  progress: number; // 0-100
}

interface UploadProgressProps {
  uploads: UploadItem[];
  onClose: () => void;
  onRemove: (id: string) => void;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({ uploads, onClose, onRemove }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const activeUploads = uploads.filter(u => u.status === 'uploading').length;

  if (uploads.length === 0) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-[300] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${isMinimized ? 'w-72 h-14' : 'w-80 sm:w-96 max-h-[400px]'}`}>
      
      {/* HEADER */}
      <div className="bg-slate-800 p-3 flex items-center justify-between cursor-pointer border-b border-slate-700" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-2">
          {activeUploads > 0 ? <Loader2 size={16} className="animate-spin text-blue-400"/> : <CheckCircle size={16} className="text-green-400"/>}
          <span className="text-xs font-bold text-slate-200">
            {activeUploads > 0 ? `Mengupload ${activeUploads} file...` : 'Upload Selesai'}
          </span>
        </div>
        <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                {isMinimized ? <Maximize2 size={14}/> : <Minimize2 size={14}/>}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                <X size={14}/>
            </button>
        </div>
      </div>

      {/* BODY (Scrollable) */}
      {!isMinimized && (
        <div className="overflow-y-auto p-2 space-y-2 flex-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
            {uploads.map((item) => (
                <div key={item.id} className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50 flex gap-3 items-center relative overflow-hidden group">
                    {/* Progress Bar Background */}
                    {item.status === 'uploading' && (
                        <div className="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-300" style={{ width: `${item.progress}%` }}></div>
                    )}
                    
                    <div className="p-2 bg-slate-800 rounded text-slate-400">
                        <FileIcon size={16}/>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate" title={item.file.name}>{item.file.name}</p>
                        <p className="text-[10px] text-slate-500">
                            {item.status === 'uploading' ? 'Sedang memproses...' : item.status === 'success' ? 'Berhasil' : 'Gagal'}
                        </p>
                    </div>

                    <div className="flex-shrink-0">
                        {item.status === 'uploading' && <Loader2 size={14} className="animate-spin text-blue-500"/>}
                        {item.status === 'success' && <CheckCircle size={14} className="text-green-500"/>}
                        {item.status === 'error' && <AlertCircle size={14} className="text-red-500"/>}
                    </div>

                     {item.status !== 'uploading' && (
                        <button onClick={() => onRemove(item.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-opacity">
                            <X size={10}/>
                        </button>
                    )}
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

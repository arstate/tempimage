
import React, { useState } from 'react';
import { Download, X, CheckCircle, AlertCircle, Loader2, Minimize2, Maximize2, FileText, Image as ImageIcon } from 'lucide-react';
import { DownloadItem } from '../types';

interface DownloadProgressProps {
  downloads: DownloadItem[];
  onClose: () => void;
  onClearCompleted: () => void;
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({ downloads, onClose, onClearCompleted }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const activeDownloads = downloads.filter(d => d.status === 'downloading' || d.status === 'pending').length;
  const completedDownloads = downloads.filter(d => d.status === 'completed').length;
  const total = downloads.length;

  if (downloads.length === 0) return null;

  // Calculate Total Percentage
  const totalProgress = Math.round(downloads.reduce((acc, curr) => acc + curr.progress, 0) / total);

  return (
    <div className={`fixed bottom-4 right-4 z-[300] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${isMinimized ? 'w-72 h-14' : 'w-80 sm:w-96 max-h-[400px]'}`}>
      
      {/* HEADER */}
      <div className="bg-slate-800 p-3 flex items-center justify-between cursor-pointer border-b border-slate-700" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-2">
          {activeDownloads > 0 ? (
             <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-emerald-400"/>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">Downloading... {totalProgress}%</span>
                    <span className="text-[10px] text-slate-400">{completedDownloads}/{total} files</span>
                </div>
             </div>
          ) : (
             <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-400"/>
                <span className="text-xs font-bold text-slate-200">Download Selesai</span>
             </div>
          )}
        </div>
        <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                {isMinimized ? <Maximize2 size={14}/> : <Minimize2 size={14}/>}
            </button>
            <button onClick={(e) => { e.stopPropagation(); activeDownloads > 0 ? onClose() : onClearCompleted(); }} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                <X size={14}/>
            </button>
        </div>
      </div>

      {/* BODY (Scrollable) */}
      {!isMinimized && (
        <div className="overflow-y-auto p-2 space-y-2 flex-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
            {downloads.map((item) => (
                <div key={item.id} className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50 flex gap-3 items-center relative overflow-hidden group">
                    {/* Progress Bar Background */}
                    <div 
                        className={`absolute bottom-0 left-0 h-0.5 transition-all duration-300 ${item.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${item.progress}%` }}
                    ></div>
                    
                    <div className="p-2 bg-slate-800 rounded text-slate-400">
                        {item.name.endsWith('.txt') ? <FileText size={16}/> : <ImageIcon size={16}/>}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                            <p className="text-xs font-medium text-slate-300 truncate max-w-[180px]" title={item.name}>{item.name}</p>
                            <span className="text-[10px] text-slate-500 font-mono">{item.progress}%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">
                            {item.status === 'pending' && 'Menunggu...'}
                            {item.status === 'downloading' && 'Mendownload...'}
                            {item.status === 'completed' && 'Tersimpan'}
                            {item.status === 'error' && 'Gagal'}
                        </p>
                    </div>

                    <div className="flex-shrink-0">
                        {item.status === 'downloading' && <Loader2 size={14} className="animate-spin text-emerald-500"/>}
                        {item.status === 'completed' && <CheckCircle size={14} className="text-emerald-500"/>}
                        {item.status === 'error' && <AlertCircle size={14} className="text-red-500"/>}
                        {item.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-700"></div>}
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

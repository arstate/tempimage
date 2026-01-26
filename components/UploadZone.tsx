
import React, { useCallback, useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2, Minimize2, Maximize2, Plus } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingInput, setIsProcessingInput] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false); // Default expanded
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    // Process dropped files
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  }, [onFilesSelected]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingInput(true);

    // Optimasi UI Thread (setTimeout)
    setTimeout(() => {
      const fileArray = Array.from(files);
      onFilesSelected(fileArray);
      
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      setIsProcessingInput(false);
    }, 500); 
  };

  const triggerInput = () => {
    inputRef.current?.click();
  };

  // --- TAMPILAN MINIMIZED (KECIL) ---
  if (isMinimized) {
    return (
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative bg-slate-900 border border-slate-700 rounded-xl p-3 flex items-center justify-between transition-all duration-300 shadow-sm
          ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'hover:border-slate-500'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="flex items-center gap-3 w-full">
            {/* Tombol Upload Kecil */}
            <button 
                onClick={triggerInput}
                disabled={isProcessingInput}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg active:scale-95"
            >
                {isProcessingInput ? (
                    <Loader2 size={16} className="animate-spin" />
                ) : (
                    <Plus size={16} />
                )}
                <span>Upload</span>
            </button>

            <span className="text-xs text-slate-500 hidden sm:inline-block">
                {isProcessingInput ? 'Memproses...' : 'atau drag gambar kesini'}
            </span>
        </div>

        {/* Tombol Maximize */}
        <button 
            onClick={() => setIsMinimized(false)}
            className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2"
            title="Tampilkan Full UI"
        >
            <Maximize2 size={18} />
        </button>
      </div>
    );
  }

  // --- TAMPILAN FULL UI (EXPANDED) ---
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 transition-all duration-300 flex flex-col items-center justify-center gap-4 text-center animate-in fade-in zoom-in-95
        ${isDragging 
          ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' 
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'}`}
    >
      {/* Tombol Minimize di Kanan Atas */}
      <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={(e) => {
                e.stopPropagation(); // Mencegah trigger input file
                setIsMinimized(true);
            }}
            className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-full transition-colors opacity-0 group-hover:opacity-100"
            title="Minimize UI"
          >
              <Minimize2 size={20} />
          </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*" 
        onChange={handleFileInput}
        className="absolute inset-0 opacity-0 cursor-pointer z-10"
        disabled={isProcessingInput}
      />
      
      <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        {isProcessingInput ? (
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        ) : (
          <Upload className="w-8 h-8 text-blue-400" />
        )}
      </div>
      
      <div>
        <h3 className="text-xl font-semibold mb-1">
          {isProcessingInput ? 'Menyiapkan Antrian...' : 'Upload Gambar Baru'}
        </h3>
        <p className="text-slate-400 text-sm">
          {isProcessingInput ? 'Mohon tunggu sebentar...' : (
            <>Drag & Drop atau <span className="text-blue-400 font-medium">Klik disini</span></>
          )}
        </p>
      </div>

      {!isProcessingInput && (
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ImageIcon size={14} />
            <span>Kualitas Original (Tanpa Kompresi)</span>
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useCallback, useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingInput, setIsProcessingInput] = useState(false);
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
    // 1. Ambil referensi files segera
    const files = e.target.files;
    
    if (!files || files.length === 0) return;

    // 2. Tampilkan loading state agar user tahu klik berhasil
    setIsProcessingInput(true);

    // 3. OPTIMASI IOS/ANDROID:
    // Beri jeda 500ms agar "Native File Picker" (Popup Galeri) punya waktu untuk close/menutup
    // dan melepaskan resource UI Thread sebelum React mulai memproses data file yang berat.
    setTimeout(() => {
      // Convert ke Array agar aman jika input di-reset
      const fileArray = Array.from(files);
      
      // Kirim ke App.tsx
      onFilesSelected(fileArray);
      
      // Reset input value agar bisa pilih file yang sama lagi & lepas memori reference
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      
      setIsProcessingInput(false);
    }, 500); 
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 transition-all duration-300 flex flex-col items-center justify-center gap-4 text-center
        ${isDragging 
          ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' 
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*" // Menerima semua jenis gambar
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

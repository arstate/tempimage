
import React, { useCallback, useState } from 'react';
import { Upload, Image as ImageIcon, Clipboard } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  }, [onFilesSelected]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
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
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInput}
        className="absolute inset-0 opacity-0 cursor-pointer z-10"
      />
      
      <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        <Upload className="w-8 h-8 text-blue-400" />
      </div>
      
      <div>
        <h3 className="text-xl font-semibold mb-1">Upload New Images</h3>
        <p className="text-slate-400 text-sm">
          Drag & Drop, <span className="text-blue-400 font-medium">Click to browse</span>, or Paste (Ctrl+V)
        </p>
      </div>

      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ImageIcon size={14} />
          <span>Supports PNG, JPG, GIF</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clipboard size={14} />
          <span>Clipboard Paste</span>
        </div>
      </div>
    </div>
  );
};

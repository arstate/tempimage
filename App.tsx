
import React, { useState, useEffect, useCallback } from 'react';
import { UploadZone } from './components/UploadZone';
import { ImageCard } from './components/ImageCard';
import { StoredImage } from './types';
import { getAllImagesFromDB, saveImageToDB, deleteImageFromDB } from './services/db';
import { LayoutGrid, Image as ImageIcon, Search, Trash2, Github, X } from 'lucide-react';

const App: React.FC = () => {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Load images
  useEffect(() => {
    const loadImages = async () => {
      try {
        const stored = await getAllImagesFromDB();
        setImages(stored.sort((a, b) => b.timestamp - a.timestamp));
      } catch (error) {
        console.error('Failed to load images:', error);
      } finally {
        setLoading(false);
      }
    };
    loadImages();
  }, []);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const newImages: StoredImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const promise = new Promise<StoredImage>((resolve) => {
        reader.onload = (e) => {
          resolve({
            id: crypto.randomUUID(),
            name: file.name || `Pasted Image ${new Date().toLocaleTimeString()}`,
            type: file.type,
            size: file.size,
            data: e.target?.result as string,
            timestamp: Date.now(),
          });
        };
      });
      reader.readAsDataURL(file);
      const img = await promise;
      await saveImageToDB(img);
      newImages.push(img);
    }
    setImages((prev) => [...newImages, ...prev].sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  // Paste handling
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) imageFiles.push(blob);
        }
      }
      if (imageFiles.length > 0) processFiles(imageFiles);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this asset?')) {
      await deleteImageFromDB(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
    }
  };

  const filteredImages = images.filter((img) =>
    img.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-20 bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ImageIcon className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-white">
              Zombio <span className="text-blue-500">Vault</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <a href="https://github.com" className="text-slate-400 hover:text-white transition-colors">
               <Github size={20} />
             </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <UploadZone onFilesSelected={processFiles} />

        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Cari file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
            />
          </div>
          <div className="text-xs text-slate-500 uppercase tracking-widest">
            {filteredImages.length} ASSETS
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
             <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredImages.map((img) => (
              <ImageCard 
                key={img.id} 
                image={img} 
                onDelete={handleDelete} 
                onMaximize={(url) => setPreviewUrl(url)}
              />
            ))}
          </div>
        )}
      </main>

      {/* MODAL FULLSCREEN (Mirip Screenshot Anda) */}
      {previewUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4 sm:p-10 transition-all"
          onClick={() => setPreviewUrl(null)}
        >
          <button className="absolute top-6 right-6 text-white/50 hover:text-white z-[110]">
            <X size={32} />
          </button>
          
          {/* Gambar ini bisa di-drag langsung seperti di fullscreen browser asli */}
          <img 
            src={previewUrl} 
            alt="Preview" 
            className="max-w-full max-h-full object-contain shadow-2xl cursor-move"
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              // Jika ditarik dari sini, browser akan secara native menganggap ini file
              e.dataTransfer.effectAllowed = 'copy';
            }}
          />
          
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-xs uppercase tracking-[0.2em] pointer-events-none">
            Klik di mana saja untuk kembali • Bisa drag gambar langsung ke WA
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-md border-t border-slate-900 py-3">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-[10px] text-slate-600 uppercase tracking-widest">
          <span>Browser Storage Active</span>
          <span className="text-blue-500 font-bold">{images.length} FILES STORED</span>
        </div>
      </footer>
    </div>
  );
};

export default App;

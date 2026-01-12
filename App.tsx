
import React, { useState, useEffect, useCallback } from 'react';
import { UploadZone } from './components/UploadZone';
import { ImageCard } from './components/ImageCard';
import { StoredImage } from './types';
import { getAllImagesFromDB, saveImageToDB, deleteImageFromDB } from './services/db';
import { LayoutGrid, Image as ImageIcon, Search, Trash2, Github } from 'lucide-react';

const App: React.FC = () => {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Load images from IndexedDB
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

  // Handle Global Paste (Ctrl+V)
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

      if (imageFiles.length > 0) {
        processFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this image?')) {
      await deleteImageFromDB(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
    }
  };

  const clearAll = async () => {
    if (confirm('Are you sure you want to delete ALL images from local storage?')) {
      for (const img of images) {
        await deleteImageFromDB(img.id);
      }
      setImages([]);
    }
  };

  const filteredImages = images.filter((img) =>
    img.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ImageIcon className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Project Zombio <span className="text-blue-500">Vault</span>
            </h1>
          </div>
          
          <div className="hidden sm:flex items-center gap-6 text-sm text-slate-400 font-medium">
            <a href="#" className="hover:text-blue-400 transition-colors">Explorer</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Shared</a>
            <a href="#" className="hover:text-blue-400 transition-colors flex items-center gap-1">
              <Github size={16} /> GitHub
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Local Asset Gallery</h2>
          <p className="text-slate-400">Secure browser-based storage for your high-res assets. Your files never leave your device.</p>
        </div>

        {/* Upload Action */}
        <UploadZone onFilesSelected={processFiles} />

        {/* Gallery Controls */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-800/30 p-4 rounded-xl border border-slate-700">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search assets by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 rounded-lg border border-slate-700 text-xs text-slate-400">
              <LayoutGrid size={14} />
              <span>{filteredImages.length} Assets Found</span>
            </div>
            
            {images.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm transition-all"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">Purge Gallery</span>
              </button>
            )}
          </div>
        </div>

        {/* Gallery Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-medium">Restoring vault contents...</p>
          </div>
        ) : filteredImages.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredImages.map((img) => (
              <ImageCard key={img.id} image={img} onDelete={handleDelete} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-slate-800 rounded-3xl bg-slate-900/50">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <ImageIcon size={32} className="text-slate-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Vault is Empty</h3>
            <p className="text-slate-400 max-w-xs mx-auto">
              Start adding images by dragging them here or pasting from your clipboard.
            </p>
          </div>
        )}
      </main>

      {/* Stats Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-md border-t border-slate-800 text-slate-500 text-[10px] uppercase tracking-widest py-3">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <div className="flex gap-4">
            <span>Powered by IndexedDB</span>
            <span>Zero Server Latency</span>
          </div>
          <div className="text-blue-500 font-medium">
            {images.length} Local Files Stored
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

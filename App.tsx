
import React, { useState, useEffect, useCallback } from 'react';
import { UploadZone } from './components/UploadZone';
import { ImageCard } from './components/ImageCard';
import { Gallery, StoredImage } from './types';
import { 
  getGalleries, saveGallery, deleteGallery, 
  getImagesByGallery, saveImage, deleteImage 
} from './services/db';
import { Folder, Plus, ArrowLeft, Image as ImageIcon, X, Clipboard, LayoutGrid, Trash2 } from 'lucide-react';

const App: React.FC = () => {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [currentGallery, setCurrentGallery] = useState<Gallery | null>(null);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Load Galleries
  useEffect(() => {
    loadGalleries();
  }, []);

  const loadGalleries = async () => {
    setLoading(true);
    const stored = await getGalleries();
    setGalleries(stored.sort((a, b) => b.timestamp - a.timestamp));
    setLoading(false);
  };

  const loadImages = async (galleryId: string) => {
    const stored = await getImagesByGallery(galleryId);
    setImages(stored.sort((a, b) => a.timestamp - b.timestamp)); // Sort by oldest to keep numbering consistent
  };

  const handleCreateGallery = async () => {
    const name = prompt('Nama Galeri Baru:');
    if (!name) return;
    const newGallery: Gallery = {
      id: crypto.randomUUID(),
      name,
      timestamp: Date.now()
    };
    await saveGallery(newGallery);
    setGalleries(prev => [newGallery, ...prev]);
  };

  const selectGallery = (gallery: Gallery) => {
    setCurrentGallery(gallery);
    loadImages(gallery.id);
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (!currentGallery) return;
    const newImages: StoredImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const promise = new Promise<StoredImage>((resolve) => {
        reader.onload = (e) => {
          resolve({
            id: crypto.randomUUID(),
            galleryId: currentGallery.id,
            name: file.name || `Asset ${Date.now()}`,
            type: file.type,
            size: file.size,
            data: e.target?.result as string,
            timestamp: Date.now(),
          });
        };
      });
      reader.readAsDataURL(file);
      const img = await promise;
      await saveImage(img);
      newImages.push(img);
    }
    setImages(prev => [...prev, ...newImages]);
  }, [currentGallery]);

  // Paste Support for current gallery
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!currentGallery) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) files.push(blob);
        }
      }
      if (files.length > 0) processFiles(files);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentGallery, processFiles]);

  const handleDeleteImage = async (id: string) => {
    if (confirm('Hapus foto ini?')) {
      await deleteImage(id);
      setImages(prev => prev.filter(img => img.id !== id));
    }
  };

  const handleDeleteGallery = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Hapus seluruh galeri dan semua foto di dalamnya?')) {
      await deleteGallery(id);
      setGalleries(prev => prev.filter(g => g.id !== id));
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentGallery ? (
              <button 
                onClick={() => setCurrentGallery(null)}
                className="p-2 hover:bg-slate-800 rounded-full transition-colors text-blue-400"
              >
                <ArrowLeft size={24} />
              </button>
            ) : (
              <div className="bg-blue-600 p-2 rounded-lg">
                <ImageIcon className="text-white" size={20} />
              </div>
            )}
            <h1 className="text-xl font-bold">
              {currentGallery ? currentGallery.name : (
                <>Zombio <span className="text-blue-500">Vault</span></>
              )}
            </h1>
          </div>
          
          {!currentGallery && (
            <button 
              onClick={handleCreateGallery}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Galeri Baru</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !currentGallery ? (
          /* GALLERY LIST VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {galleries.length === 0 ? (
              <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 border-2 border-dashed border-slate-800 rounded-2xl">
                <Folder size={48} className="text-slate-700" />
                <p className="text-slate-500">Belum ada galeri. Silahkan buat baru.</p>
              </div>
            ) : (
              galleries.map(g => (
                <div 
                  key={g.id}
                  onClick={() => selectGallery(g)}
                  className="group relative bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-blue-500/50 cursor-pointer transition-all hover:shadow-xl hover:shadow-blue-500/5"
                >
                  <button 
                    onClick={(e) => handleDeleteGallery(g.id, e)}
                    className="absolute top-4 right-4 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                    <Folder size={32} />
                  </div>
                  <h3 className="font-bold text-lg truncate mb-1">{g.name}</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">
                    {new Date(g.timestamp).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : (
          /* GALLERY DETAIL VIEW */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <UploadZone onFilesSelected={processFiles} />
            
            <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 gap-4">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="text-xs font-mono text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full border border-blue-400/20">
                  {images.length} TOTAL ASSETS
                </div>
                <button 
                  onClick={async () => {
                    try {
                      const clipboardItems = await navigator.clipboard.read();
                      for (const item of clipboardItems) {
                        const imageTypes = item.types.filter(t => t.startsWith('image/'));
                        if (imageTypes.length > 0) {
                          const blob = await item.getType(imageTypes[0]);
                          const file = new File([blob], `Pasted_${Date.now()}.png`, { type: blob.type });
                          processFiles([file]);
                        }
                      }
                    } catch (e) {
                      alert("Gunakan Ctrl+V atau pastikan izin clipboard aktif");
                    }
                  }}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all border border-slate-700 text-blue-300"
                >
                  <Clipboard size={14} />
                  PASTE PHOTO
                </button>
              </div>
              <LayoutGrid size={18} className="text-slate-600 hidden sm:block" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {images.map((img, idx) => (
                <ImageCard 
                  key={img.id} 
                  image={img} 
                  index={idx}
                  onDelete={handleDeleteImage}
                  onMaximize={setPreviewUrl}
                />
              ))}
              {images.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-600 border border-dashed border-slate-800 rounded-xl">
                  Galeri kosong. Paste foto atau seret file ke atas.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL FULLSCREEN */}
      {previewUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <button className="absolute top-6 right-6 text-white/50 hover:text-white z-[110] bg-white/10 p-2 rounded-full backdrop-blur-md">
            <X size={24} />
          </button>
          <img 
            src={previewUrl} 
            alt="Preview" 
            className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Footer Info */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-900 py-3 px-6 backdrop-blur-md z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-mono">
          <span>Database: IndexedDB v2</span>
          <span>{currentGallery ? `Browsing: ${currentGallery.name}` : 'Vault Overview'}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;

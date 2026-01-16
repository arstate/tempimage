
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UploadZone } from './components/UploadZone';
import { ImageCard } from './components/ImageCard';
import { Gallery, StoredImage } from './types';
import { 
  getGalleries, saveGallery, deleteGallery, 
  getImagesByGallery, saveImage, deleteImage 
} from './services/db';
import { Folder, Plus, ArrowLeft, Image as ImageIcon, X, Clipboard, LayoutGrid, Trash2, AlertCircle } from 'lucide-react';

type ModalType = 'input' | 'confirm' | 'alert' | null;

interface ModalState {
  type: ModalType;
  title: string;
  message?: string;
  inputValue?: string;
  onConfirm?: (value?: string) => void;
  confirmText?: string;
  isDanger?: boolean;
}

const App: React.FC = () => {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [currentGallery, setCurrentGallery] = useState<Gallery | null>(null);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Custom Modal State
  const [modal, setModal] = useState<ModalState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGalleries();
  }, []);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (modal?.type === 'input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [modal]);

  const loadGalleries = async () => {
    setLoading(true);
    const stored = await getGalleries();
    setGalleries(stored.sort((a, b) => b.timestamp - a.timestamp));
    setLoading(false);
  };

  const loadImages = async (galleryId: string) => {
    const stored = await getImagesByGallery(galleryId);
    setImages(stored.sort((a, b) => a.timestamp - b.timestamp));
  };

  const handleCreateGalleryDialog = () => {
    setModal({
      type: 'input',
      title: 'Buat Galeri Baru',
      message: 'Masukkan nama untuk folder galeri Anda:',
      inputValue: '',
      confirmText: 'Buat Galeri',
      onConfirm: async (name) => {
        if (!name?.trim()) return;
        const newGallery: Gallery = {
          id: crypto.randomUUID(),
          name: name.trim(),
          timestamp: Date.now()
        };
        await saveGallery(newGallery);
        setGalleries(prev => [newGallery, ...prev]);
        setModal(null);
      }
    });
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

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!currentGallery || modal) return;
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
  }, [currentGallery, processFiles, modal]);

  const handleDeleteImageDialog = (id: string) => {
    setModal({
      type: 'confirm',
      title: 'Hapus Foto?',
      message: 'Foto ini akan dihapus secara permanen dari database lokal Anda.',
      confirmText: 'Ya, Hapus',
      isDanger: true,
      onConfirm: async () => {
        await deleteImage(id);
        setImages(prev => prev.filter(img => img.id !== id));
        setModal(null);
      }
    });
  };

  const handleDeleteGalleryDialog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setModal({
      type: 'confirm',
      title: 'Hapus Seluruh Galeri?',
      message: 'Semua foto di dalam galeri ini akan ikut terhapus secara permanen.',
      confirmText: 'Hapus Galeri',
      isDanger: true,
      onConfirm: async () => {
        await deleteGallery(id);
        setGalleries(prev => prev.filter(g => g.id !== id));
        setModal(null);
      }
    });
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
                <>temp<span className="text-blue-500">img</span></>
              )}
            </h1>
          </div>
          
          {!currentGallery && (
            <button 
              onClick={handleCreateGalleryDialog}
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
                    onClick={(e) => handleDeleteGalleryDialog(g.id, e)}
                    className="absolute top-4 right-4 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
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
                      let found = false;
                      for (const item of clipboardItems) {
                        const imageTypes = item.types.filter(t => t.startsWith('image/'));
                        if (imageTypes.length > 0) {
                          const blob = await item.getType(imageTypes[0]);
                          const file = new File([blob], `Pasted_${Date.now()}.png`, { type: blob.type });
                          processFiles([file]);
                          found = true;
                        }
                      }
                      if (!found) {
                        setModal({
                          type: 'alert',
                          title: 'Clipboard Kosong',
                          message: 'Tidak ada gambar yang ditemukan di clipboard Anda.',
                          confirmText: 'OK'
                        });
                      }
                    } catch (e) {
                      setModal({
                        type: 'alert',
                        title: 'Akses Ditolak',
                        message: 'Berikan izin akses clipboard atau gunakan shortcut keyboard Ctrl+V.',
                        confirmText: 'Paham'
                      });
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
                  onDelete={handleDeleteImageDialog}
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

      {/* FULLSCREEN PREVIEW */}
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

      {/* CUSTOM SYSTEM MODAL */}
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setModal(null)} />
          
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${modal.isDanger ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  {modal.type === 'confirm' ? <Trash2 size={24} /> : modal.type === 'alert' ? <AlertCircle size={24} /> : <Folder size={24} />}
                </div>
                <h3 className="text-xl font-bold">{modal.title}</h3>
              </div>
              
              {modal.message && <p className="text-slate-400 text-sm leading-relaxed">{modal.message}</p>}
              
              {modal.type === 'input' && (
                <input
                  ref={inputRef}
                  type="text"
                  value={modal.inputValue}
                  onChange={(e) => setModal({ ...modal, inputValue: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') modal.onConfirm?.(modal.inputValue);
                    if (e.key === 'Escape') setModal(null);
                  }}
                  placeholder="Contoh: tempimg UI"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white"
                />
              )}
            </div>
            
            <div className="flex border-t border-slate-800 p-4 gap-3 bg-slate-900/50">
              {modal.type !== 'alert' && (
                <button
                  onClick={() => setModal(null)}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
              )}
              <button
                onClick={() => modal.onConfirm ? modal.onConfirm(modal.inputValue) : setModal(null)}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all shadow-lg
                  ${modal.isDanger 
                    ? 'bg-red-600 hover:bg-red-500 text-white' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
              >
                {modal.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-900 py-3 px-6 backdrop-blur-md z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-mono">
          <span>Database: IndexedDB v2</span>
          <span>{currentGallery ? `Browsing: ${currentGallery.name}` : 'tempimg Overview'}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;

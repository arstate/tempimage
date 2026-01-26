
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UploadZone } from './components/UploadZone';
import { ImageCard } from './components/ImageCard';
import { NoteCard } from './components/NoteCard';
import { TextEditor } from './components/TextEditor';
import { Gallery, StoredImage, StoredNote } from './types';
import { 
  getGalleries, saveGallery, deleteGallery 
} from './services/db'; // Keep DB for Gallery List ONLY
import { 
  uploadToDrive, loadGallery, deleteFromDrive, uploadNoteToDrive, createFolderInDrive
} from './services/api'; // New API Service
import { Folder, Plus, ArrowLeft, Image as ImageIcon, X, Clipboard, LayoutGrid, Trash2, AlertCircle, FileText, Cloud, CloudLightning } from 'lucide-react';

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
  const [notes, setNotes] = useState<StoredNote[]>([]); 
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false); // For upload spinners
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<StoredNote | null>(null);
  
  const [modal, setModal] = useState<ModalState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGalleriesLocal();
  }, []);

  useEffect(() => {
    if (modal?.type === 'input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [modal]);

  // Load Folder List from Local IndexedDB (to keep the menu fast)
  const loadGalleriesLocal = async () => {
    setLoading(true);
    const stored = await getGalleries();
    setGalleries(stored.sort((a, b) => b.timestamp - a.timestamp));
    setLoading(false);
  };

  // Load Content from Google Drive API
  const loadGalleryData = async (galleryName: string) => {
    setLoading(true);
    try {
      const { images: apiImages, notes: apiNotes } = await loadGallery(galleryName);
      setImages(apiImages);
      setNotes(apiNotes);
    } catch (error) {
      console.error(error);
      setModal({
        type: 'alert',
        title: 'Gagal Memuat Data',
        message: 'Tidak dapat mengambil data dari Google Drive. Pastikan API URL benar.',
        confirmText: 'OK'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGalleryDialog = () => {
    setModal({
      type: 'input',
      title: 'Buat Folder Baru',
      message: 'Folder ini akan dibuat di Google Drive sekarang juga.',
      inputValue: '',
      confirmText: 'Buat Folder',
      onConfirm: async (name) => {
        if (!name?.trim()) return;
        
        const cleanName = name.trim();
        setModal(null); // Close modal first
        setProcessing(true); // Show spinner

        try {
          // 1. Create Folder in Google Drive
          await createFolderInDrive(cleanName);

          // 2. Save local reference
          const newGallery: Gallery = {
            id: crypto.randomUUID(),
            name: cleanName,
            timestamp: Date.now()
          };
          
          await saveGallery(newGallery);
          setGalleries(prev => [newGallery, ...prev]);
          
        } catch (error) {
          console.error("Create folder error:", error);
          setModal({
            type: 'alert',
            title: 'Gagal Membuat Folder',
            message: 'Gagal menghubungkan ke Google Drive API. Periksa koneksi internet.',
            confirmText: 'OK'
          });
        } finally {
          setProcessing(false);
        }
      }
    });
  };

  const selectGallery = (gallery: Gallery) => {
    setCurrentGallery(gallery);
    loadGalleryData(gallery.name); // Use Name for API Folder mapping
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (!currentGallery) return;
    setProcessing(true);
    
    // Optimistic UI updates could be hard here, so we show loading
    const uploadPromises = Array.from(files).map(async (file) => {
      if (!file.type.startsWith('image/')) return null;
      try {
        const driveFile = await uploadToDrive(file, currentGallery.name);
        return {
          id: driveFile.id,
          galleryId: currentGallery.name,
          name: driveFile.name,
          type: driveFile.type || file.type,
          size: file.size,
          data: driveFile.thumbnail || driveFile.url, // Use thumbnail from API
          timestamp: Date.now(),
        } as StoredImage;
      } catch (e) {
        console.error("Upload failed", e);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const successImages = results.filter((img): img is StoredImage => img !== null);
    
    setImages(prev => [...successImages, ...prev]); // Prepend new images
    setProcessing(false);
    
    if (successImages.length < files.length) {
      setModal({
        type: 'alert',
        title: 'Upload Tidak Sempurna',
        message: 'Beberapa file gagal diunggah ke Google Drive.',
        confirmText: 'OK'
      });
    }
  }, [currentGallery]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!currentGallery || modal || editingNote) return;
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
  }, [currentGallery, processFiles, modal, editingNote]);

  const handleDeleteImageDialog = (id: string) => {
    setModal({
      type: 'confirm',
      title: 'Hapus File Drive?',
      message: 'File ini akan dihapus dari Google Drive Anda.',
      confirmText: 'Hapus Permanen',
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteFromDrive(id);
          setImages(prev => prev.filter(img => img.id !== id));
          setModal(null);
        } catch (e) {
          setModal({
            type: 'alert',
            title: 'Gagal Menghapus',
            message: 'Terjadi kesalahan saat menghubungi Google Drive.',
            confirmText: 'OK'
          });
        }
      }
    });
  };

  const handleDeleteGalleryDialog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setModal({
      type: 'confirm',
      title: 'Hapus Folder (Lokal)?',
      message: 'Ini hanya menghapus pintasan folder di aplikasi ini. File di Google Drive TIDAK akan terhapus.',
      confirmText: 'Hapus Pintasan',
      isDanger: true,
      onConfirm: async () => {
        await deleteGallery(id);
        setGalleries(prev => prev.filter(g => g.id !== id));
        setModal(null);
      }
    });
  };

  // --- Note Logic ---

  const handleAddNote = () => {
    if (!currentGallery) return;
    const newNote: StoredNote = {
      id: 'temp-' + Date.now(),
      galleryId: currentGallery.name,
      title: 'Catatan Baru',
      content: '', // Empty content for new note
      timestamp: Date.now()
    };
    setEditingNote(newNote);
  };

  const handleSaveNote = async (id: string, title: string, content: string) => {
    if (!currentGallery) return;
    
    // We only support creating NEW notes via upload for simplicity in this version
    // Editing existing Drive files is complex via simple web app fetch without Auth tokens
    
    setProcessing(true);
    try {
      const driveFile = await uploadNoteToDrive(title, content, currentGallery.name);
      
      const newNote: StoredNote = {
        id: driveFile.id,
        galleryId: currentGallery.name,
        title: title,
        content: driveFile.url, // Store URL
        timestamp: Date.now()
      };

      setNotes(prev => [newNote, ...prev]);
      setEditingNote(null);
    } catch (e) {
      console.error(e);
      setModal({
         type: 'alert',
         title: 'Gagal Menyimpan',
         message: 'Gagal mengunggah catatan ke Drive.',
         confirmText: 'OK'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteNoteDialog = (id: string) => {
    setModal({
      type: 'confirm',
      title: 'Hapus Catatan?',
      message: 'File teks ini akan dihapus dari Google Drive.',
      confirmText: 'Hapus',
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteFromDrive(id);
          setNotes(prev => prev.filter(n => n.id !== id));
          setModal(null);
        } catch (e) {
          alert("Gagal menghapus note");
        }
      }
    });
  };

  const handleNoteClick = (note: StoredNote) => {
     if (note.content.startsWith('http')) {
         window.open(note.content, '_blank');
     } else {
         setEditingNote(note);
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
                <Cloud className="text-white" size={20} />
              </div>
            )}
            <h1 className="text-xl font-bold">
              {currentGallery ? currentGallery.name : (
                <>temp<span className="text-blue-500">img</span> <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 ml-2 align-middle">Cloud</span></>
              )}
            </h1>
          </div>
          
          {!currentGallery && (
            <button 
              onClick={handleCreateGalleryDialog}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Folder Baru</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {processing && (
           <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center backdrop-blur-sm">
             <div className="bg-slate-900 p-6 rounded-2xl flex flex-col items-center gap-4 shadow-2xl border border-slate-800">
               <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
               <p className="font-semibold text-blue-400">Syncing to Google Drive...</p>
             </div>
           </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20 flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 animate-pulse">Menghubungkan ke API...</p>
          </div>
        ) : !currentGallery ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {galleries.length === 0 ? (
              <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 border-2 border-dashed border-slate-800 rounded-2xl">
                <Folder size={48} className="text-slate-700" />
                <p className="text-slate-500">Belum ada folder. Buat folder untuk mulai upload ke Drive.</p>
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
                  <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-widest">
                     <CloudLightning size={12} className="text-blue-500" />
                     <span>Synced</span>
                  </div>
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
                  {images.length} FILES • {notes.length} NOTES
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleAddNote}
                    className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2 rounded-lg text-xs font-bold transition-all border border-amber-500/30 text-amber-500"
                  >
                    <FileText size={14} />
                    ADD NOTE (TXT)
                  </button>
                  
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
                    PASTE
                  </button>
                </div>
              </div>
              <LayoutGrid size={18} className="text-slate-600 hidden sm:block" />
            </div>

            {/* NOTES SECTION */}
            {notes.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Documents (Drive)</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {notes.map((note) => (
                    <NoteCard 
                      key={note.id} 
                      note={note} 
                      onClick={handleNoteClick}
                      onDelete={handleDeleteNoteDialog}
                    />
                  ))}
                </div>
                <div className="h-px bg-slate-800 my-6"></div>
              </div>
            )}

            {/* IMAGES SECTION */}
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
              {images.length === 0 && notes.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-600 border border-dashed border-slate-800 rounded-xl">
                  Folder Drive ini kosong.
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

      {/* TEXT EDITOR MODAL */}
      {editingNote && (
        <TextEditor 
          note={editingNote}
          onSave={handleSaveNote}
          onClose={() => setEditingNote(null)}
        />
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
                  placeholder="Nama Folder Drive..."
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
          <span>Storage: Google Drive (API)</span>
          <span>{currentGallery ? `Folder: ${currentGallery.name}` : 'tempimg Cloud'}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;

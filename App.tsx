
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UploadZone } from './components/UploadZone';
import { ImageCard } from './components/ImageCard';
import { NoteCard } from './components/NoteCard';
import { TextEditor } from './components/TextEditor';
import { Gallery, StoredImage, StoredNote } from './types';
import { 
  uploadToDrive, loadGallery, deleteFromDrive, uploadNoteToDrive, createFolderInDrive, fetchAllCloudGalleries, getFileContent, deleteFolderInDrive
} from './services/api'; 
import { Folder, Plus, ArrowLeft, X, Clipboard, LayoutGrid, Trash2, AlertCircle, FileText, Cloud, CloudLightning, RefreshCw, Loader2 } from 'lucide-react';

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

interface UploadStatus {
  current: number;
  total: number;
  percent: number;
}

const App: React.FC = () => {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [currentGallery, setCurrentGallery] = useState<Gallery | null>(null);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [notes, setNotes] = useState<StoredNote[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // --- NEW STATES FOR LOADING OVERLAYS ---
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ current: 0, total: 0, percent: 0 });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // ---------------------------------------

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<StoredNote | null>(null);
  
  const [modal, setModal] = useState<ModalState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    syncGalleries();
  }, []);

  useEffect(() => {
    if (modal?.type === 'input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [modal]);

  const syncGalleries = async () => {
    setLoading(true);
    try {
      const cloudFolders = await fetchAllCloudGalleries();
      const mappedGalleries: Gallery[] = cloudFolders.map(f => ({
        id: f.id,
        name: f.name,
        timestamp: Date.now() 
      }));
      setGalleries(mappedGalleries);
    } catch (error) {
      console.error("Failed to sync folders", error);
    } finally {
      setLoading(false);
    }
  };

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
        setModal(null); 
        
        // Use generic saving loading state since we don't have isCreatingFolder
        setIsSaving(true); 

        try {
          await createFolderInDrive(cleanName);
          await syncGalleries();
        } catch (error) {
          console.error("Create folder error:", error);
          setModal({
            type: 'alert',
            title: 'Gagal Membuat Folder',
            message: 'Gagal menghubungkan ke Google Drive API.',
            confirmText: 'OK'
          });
        } finally {
          setIsSaving(false);
        }
      }
    });
  };

  const selectGallery = (gallery: Gallery) => {
    setCurrentGallery(gallery);
    loadGalleryData(gallery.name); 
  };

  // --- REFACTORED: SEQUENTIAL UPLOAD WITH PROGRESS ---
  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (!currentGallery) return;
    
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    setUploadStatus({ current: 0, total: fileArray.length, percent: 0 });
    
    let successCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      
      // Update UI Status
      setUploadStatus({
        current: i + 1,
        total: fileArray.length,
        percent: Math.round(((i) / fileArray.length) * 100)
      });

      const type = file.type || "";
      if (!type.startsWith('image/')) continue;

      try {
        await uploadToDrive(file, currentGallery.name);
        successCount++;
      } catch (e) {
        console.error("Upload failed for file:", file.name, e);
      }
    }

    setUploadStatus({ current: fileArray.length, total: fileArray.length, percent: 100 });
    
    // Refresh gallery content
    await loadGalleryData(currentGallery.name);
    
    setIsUploading(false);
    
    if (successCount < fileArray.length) {
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
        setIsDeleting(true);
        setModal(null);
        try {
          await deleteFromDrive(id);
          setImages(prev => prev.filter(img => img.id !== id));
        } catch (e) {
          setModal({
            type: 'alert',
            title: 'Gagal Menghapus',
            message: 'Terjadi kesalahan saat menghubungi Google Drive.',
            confirmText: 'OK'
          });
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  // --- REFACTORED: REAL DELETE FOLDER ---
  const handleDeleteGalleryDialog = (gallery: Gallery, e: React.MouseEvent) => {
    e.stopPropagation();
    setModal({
      type: 'confirm',
      title: 'Hapus Folder?',
      message: `Yakin ingin menghapus folder "${gallery.name}" selamanya? Semua isi akan hilang.`,
      confirmText: 'Hapus Folder',
      isDanger: true,
      onConfirm: async () => {
        setModal(null);
        setIsDeleting(true);
        try {
           await deleteFolderInDrive(gallery.id);
           await syncGalleries(); // Refresh list folder
        } catch (error) {
           console.error(error);
           setModal({
            type: 'alert',
            title: 'Gagal Hapus',
            message: 'Gagal menghapus folder di Drive.',
            confirmText: 'OK'
          });
        } finally {
           setIsDeleting(false);
        }
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
      content: '', 
      timestamp: Date.now()
    };
    setEditingNote(newNote);
  };

  // --- REFACTORED: SAVE WITHOUT CLOSING ---
  const handleSaveNote = async (id: string, title: string, content: string) => {
    if (!currentGallery) return;
    
    setIsSaving(true);
    try {
      const isNew = id.startsWith('temp-');
      const fileIdToUpdate = isNew ? undefined : id;

      const driveFile = await uploadNoteToDrive(title, content, currentGallery.name, fileIdToUpdate);
      
      // Update local state without closing editor
      const savedNote: StoredNote = {
        id: driveFile.id,
        galleryId: currentGallery.name,
        title: title,
        content: driveFile.url,
        snippet: content.substring(0, 100), // temp update snippet
        timestamp: Date.now()
      };
      
      // Update Notes List in Background
      if (isNew) {
        setNotes(prev => [savedNote, ...prev]);
        // Update editing ID so next save is an update, not create
        setEditingNote(prev => prev ? { ...prev, id: driveFile.id, title, content } : null);
      } else {
        setNotes(prev => prev.map(n => n.id === id ? savedNote : n));
        setEditingNote(prev => prev ? { ...prev, title, content } : null);
      }
      
      alert("Catatan berhasil disimpan!");
      // Background refresh to get snippet/data from server if needed
      // loadGalleryData(currentGallery.name); 

    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan catatan.");
    } finally {
      setIsSaving(false);
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
        setModal(null);
        setIsDeleting(true);
        try {
          await deleteFromDrive(id);
          setNotes(prev => prev.filter(n => n.id !== id));
        } catch (e) {
          alert("Gagal menghapus note");
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  const handleNoteClick = async (note: StoredNote) => {
     if (note.content && note.content.startsWith('http')) {
       // Just generic loading for fetch
       setIsSaving(true); 
       try {
         const content = await getFileContent(note.id);
         setEditingNote({ ...note, content: content || "" });
       } catch (e) {
         setModal({
           type: 'alert',
           title: 'Gagal Membuka',
           message: 'Gagal mengambil isi catatan dari Google Drive.',
           confirmText: 'Tutup'
         });
       } finally {
         setIsSaving(false);
       }
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
          
          <div className="flex gap-2">
            {!currentGallery && (
               <button 
                onClick={syncGalleries}
                disabled={loading}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                title="Refresh Folder"
              >
                <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              </button>
            )}

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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {loading ? (
          <div className="flex justify-center py-20 flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 animate-pulse">Mengambil data dari Google Drive...</p>
          </div>
        ) : !currentGallery ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {galleries.length === 0 ? (
              <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 border-2 border-dashed border-slate-800 rounded-2xl">
                <Folder size={48} className="text-slate-700" />
                <p className="text-slate-500">Drive Kosong. Buat folder baru.</p>
              </div>
            ) : (
              galleries.map(g => (
                <div 
                  key={g.id}
                  onClick={() => selectGallery(g)}
                  className="group relative bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-blue-500/50 cursor-pointer transition-all hover:shadow-xl hover:shadow-blue-500/5"
                >
                  <button 
                    onClick={(e) => handleDeleteGalleryDialog(g, e)}
                    className="absolute top-4 right-4 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 z-10"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                    <Folder size={32} />
                  </div>
                  <h3 className="font-bold text-lg truncate mb-1">{g.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-widest">
                     <CloudLightning size={12} className="text-blue-500" />
                     <span>GDrive</span>
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
                    ADD NOTE
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
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Sticky Notes</h2>
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
            </div>
            {images.length === 0 && notes.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-600 border border-dashed border-slate-800 rounded-xl">
                  Folder Drive ini kosong.
                </div>
              )}
          </div>
        )}
      </main>

      {/* --- OVERLAYS --- */}
      
      {/* 1. UPLOAD OVERLAY */}
      {isUploading && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.85)", zIndex: 9999,
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "white"
        }}>
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h3 className="text-xl font-bold mb-2">Mengupload...</h3>
          <p className="text-2xl font-bold mb-4">
            File {uploadStatus.current} dari {uploadStatus.total}
          </p>
          <div className="w-64 h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${uploadStatus.percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-400">{uploadStatus.percent}%</p>
        </div>
      )}

      {/* 2. GENERIC ACTION LOADING (Delete / Save) */}
      {(isDeleting || isSaving) && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", zIndex: 9999,
          display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(2px)"
        }}>
          <div className="bg-white text-slate-900 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in zoom-in-95">
            <Loader2 className="animate-spin text-blue-600" size={24} />
            <span className="font-bold text-sm">
              {isDeleting ? "Menghapus..." : "Menyimpan..."}
            </span>
          </div>
        </div>
      )}

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
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
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

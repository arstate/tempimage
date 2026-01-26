
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, MoreVertical, 
  ArrowLeft, Plus, Trash2, Copy, Move, Edit, CheckSquare, 
  Loader2, Home, Upload, ChevronRight, X, AlertCircle, Download, CornerUpLeft
} from 'lucide-react';
import * as API from './services/api';
import * as DB from './services/db';
import { Item, StoredNote } from './types';
import { TextEditor } from './components/TextEditor';

// --- TYPES FOR MODALS ---
type ModalType = 'input' | 'confirm' | 'alert' | 'select' | null;
interface ModalState {
  type: ModalType;
  title: string;
  message?: string;
  inputValue?: string;
  options?: { label: string; value: string }[];
  onConfirm?: (value?: string) => void;
  confirmText?: string;
  isDanger?: boolean;
}

const App = () => {
  // --- CORE STATE ---
  const [currentFolderId, setCurrentFolderId] = useState<string>(""); 
  const [parentFolderId, setParentFolderId] = useState<string>(""); // Store parent for navigation/move
  const [folderHistory, setFolderHistory] = useState<{id:string, name:string}[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false); 
  const [bgProcessing, setBgProcessing] = useState(false); 
  
  // --- UI STATE ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{x:number, y:number, targetItem?: Item} | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false); 
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);
  
  // --- EDITOR & MODALS ---
  const [modal, setModal] = useState<ModalState | null>(null);
  const [editingNote, setEditingNote] = useState<StoredNote | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // --- 1. LOAD DATA (CACHE FIRST STRATEGY) ---
  const loadFolder = useCallback(async (folderId: string = "") => {
    // 1. Try Load from Cache Immediate
    try {
        const cachedItems = await DB.getCachedFolder(folderId);
        if (cachedItems && cachedItems.length > 0) {
            setItems(cachedItems);
        } else {
            setLoading(true); // Only show spinner if cache miss
        }
    } catch (e) { console.warn("Cache read error", e); }

    // 2. Fetch from Network (Silent Update)
    try {
      const res = await API.getFolderContents(folderId);
      setLoading(false);
      if (res.status === 'success') {
        setItems(res.data);
        setParentFolderId(res.parentFolderId || ""); 
        // 3. Update Cache
        await DB.cacheFolderContents(folderId, res.data);
      } else {
        console.error(res.message);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolder(currentFolderId);
  }, [currentFolderId, loadFolder]);

  // Focus inputs in modal
  useEffect(() => {
    if (modal?.type === 'input' && inputRef.current) inputRef.current.focus();
    if (modal?.type === 'select' && selectRef.current) selectRef.current.focus();
  }, [modal]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (isNewDropdownOpen && !(event.target as Element).closest('.new-dropdown-container')) {
            setIsNewDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNewDropdownOpen]);

  // --- 2. SELECTION LOGIC ---
  const toggleSelection = (id: string, multi: boolean) => {
    const newSet = new Set(multi ? selectedIds : []);
    if (multi && newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleItemClick = (e: React.MouseEvent, item: Item) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
        toggleSelection(item.id, true);
        return;
    }
    if (item.type === 'folder') {
        setFolderHistory(prev => [...prev, { id: item.id, name: item.name }]);
        setCurrentFolderId(item.id);
    } else if (item.type === 'note') {
        handleOpenNote(item);
    } else if (item.type === 'image') {
        setPreviewImage(item.url || null);
    }
  };

  // --- 3. CONTEXT MENU ---
  const handleContextMenu = (e: React.MouseEvent, item?: Item) => {
    e.preventDefault();
    if (item && !selectedIds.has(item.id)) {
      setSelectedIds(new Set([item.id]));
    }
    setContextMenu({ x: e.pageX, y: e.pageY, targetItem: item });
  };

  // --- 4. ACTIONS & DOWNLOAD ---
  const handleDownload = async (item: Item) => {
    if (!item.url) return;
    try {
        const response = await fetch(item.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name; 
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (e) {
        window.open(item.url, '_blank');
    }
  };

  const executeAction = async (action: string) => {
    const ids = Array.from(selectedIds);
    const targetItem = contextMenu?.targetItem || (ids.length === 1 ? items.find(i => i.id === ids[0]) : null);
    
    setContextMenu(null);
    setIsNewDropdownOpen(false);

    if (action === 'download' && targetItem) {
        handleDownload(targetItem);
    }
    else if (action === 'delete') {
       if (ids.length === 0) return;
       setModal({
         type: 'confirm',
         title: 'Hapus Item?',
         message: `Yakin ingin menghapus ${ids.length} item?`,
         confirmText: 'Hapus',
         isDanger: true,
         onConfirm: async () => {
            setModal(null);
            setBgProcessing(true);
            await API.deleteItems(ids);
            await loadFolder(currentFolderId);
            setBgProcessing(false);
         }
       });
    } 
    else if (action === 'duplicate') {
        if (ids.length === 0) return;
        setBgProcessing(true);
        await API.duplicateItems(ids);
        await loadFolder(currentFolderId);
        setBgProcessing(false);
    }
    else if (action === 'move') {
        if (ids.length === 0) return;
        
        // List folders available to move into (exclude self if folder, exclude folders being moved)
        const availableFolders = items.filter(i => i.type === 'folder' && !ids.includes(i.id));
        const options = [];
        
        // Add Parent Option
        if (currentFolderId) {
            options.push({ label: '📁 .. (Folder Induk)', value: parentFolderId || "" }); // Empty string = root
        }
        
        availableFolders.forEach(f => options.push({ label: `📁 ${f.name}`, value: f.id }));
        
        if (options.length === 0) {
            setModal({ type: 'alert', title: 'Tidak Bisa Pindah', message: 'Tidak ada folder tujuan yang tersedia disini.' });
            return;
        }

        setModal({
            type: 'select',
            title: `Pindahkan ${ids.length} Item`,
            message: 'Pilih folder tujuan:',
            options: options,
            confirmText: 'Pindahkan',
            onConfirm: async (targetId) => {
                 // Undefined target check
                 if (targetId === undefined) return;
                 setModal(null);
                 setBgProcessing(true);
                 await API.moveItems(ids, targetId);
                 await loadFolder(currentFolderId);
                 setBgProcessing(false);
            }
        });
    }
    else if (action === 'rename') {
        if (!targetItem) return;
        setModal({
            type: 'input',
            title: 'Ganti Nama',
            inputValue: targetItem.name,
            confirmText: 'Simpan',
            onConfirm: async (newName) => {
                if(newName && newName !== targetItem.name) {
                    setModal(null);
                    setBgProcessing(true);
                    await API.renameItem(targetItem.id, newName);
                    await loadFolder(currentFolderId);
                    setBgProcessing(false);
                }
            }
        });
    }
    else if (action === 'new_folder') {
        setModal({
            type: 'input',
            title: 'Folder Baru',
            inputValue: 'Folder Baru',
            confirmText: 'Buat',
            onConfirm: async (name) => {
                if(name) {
                    setModal(null);
                    setBgProcessing(true);
                    await API.createFolder(currentFolderId, name);
                    await loadFolder(currentFolderId);
                    setBgProcessing(false);
                }
            }
        });
    }
  };

  // --- 5. DRAG & DROP UPLOAD ---
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    
    // A. External Files (Upload)
    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setBgProcessing(true);
      for (const file of files) {
          try { await API.uploadToDrive(file, currentFolderId); } catch(err) { console.error(err); }
      }
      await loadFolder(currentFolderId);
      setBgProcessing(false);
      return;
    }

    // B. Internal Items (Move)
    const movedItemId = e.dataTransfer.getData("text/item-id");
    let targetElement = e.target as HTMLElement;
    while(targetElement && !targetElement.getAttribute("data-folder-id")) {
       targetElement = targetElement.parentElement as HTMLElement;
       if (!targetElement || targetElement === e.currentTarget) break;
    }
    const targetFolderId = targetElement?.getAttribute("data-folder-id");
    
    if (movedItemId && targetFolderId && movedItemId !== targetFolderId) {
       setBgProcessing(true);
       try {
         await API.moveItems([movedItemId], targetFolderId);
         await loadFolder(currentFolderId);
       } catch(err) { console.error(err); } 
       finally { setBgProcessing(false); }
    }
  };

  // --- NOTE HANDLING ---
  const handleOpenNote = async (item: Item) => {
      setBgProcessing(true);
      try {
          const content = await API.getFileContent(item.id);
          setEditingNote({
              id: item.id,
              galleryId: currentFolderId,
              title: item.name.replace('.txt', ''),
              content: content,
              timestamp: item.lastUpdated
          });
      } catch(e) { alert("Gagal membuka catatan"); } 
      finally { setBgProcessing(false); }
  };

  const handleCreateNote = () => {
      setEditingNote({
          id: 'temp-' + Date.now(),
          galleryId: currentFolderId,
          title: 'Catatan Baru',
          content: '',
          timestamp: Date.now()
      });
      setIsNewDropdownOpen(false);
      setContextMenu(null);
  };

  const handleSaveNote = async (id: string, title: string, content: string) => {
      setBgProcessing(true);
      try {
          const isNew = id.startsWith('temp-');
          const fileId = isNew ? undefined : id;
          await API.saveNoteToDrive(title, content, currentFolderId, fileId);
          await loadFolder(currentFolderId);
          setEditingNote(null);
      } catch(e) { alert("Gagal menyimpan note"); } 
      finally { setBgProcessing(false); }
  };

  // --- BREADCRUMB ---
  const handleBreadcrumbClick = (index: number) => {
     if (index === -1) {
         setFolderHistory([]);
         setCurrentFolderId("");
     } else {
         const target = folderHistory[index];
         setFolderHistory(prev => prev.slice(0, index + 1));
         setCurrentFolderId(target.id);
     }
  };

  // --- HELPER: GROUP ITEMS ---
  const groupedItems = {
      folders: items.filter(i => i.type === 'folder'),
      notes: items.filter(i => i.type === 'note'),
      images: items.filter(i => i.type === 'image')
  };

  // --- RENDER ---
  return (
    <div 
      className="min-h-screen bg-slate-950 text-slate-200 relative select-none"
      onContextMenu={(e) => handleContextMenu(e)} 
      onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
      onClick={() => {
        setContextMenu(null);
        setSelectedIds(new Set());
      }}
    >
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800 h-16 flex items-center px-4 justify-between shadow-sm">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-right">
           <button 
             onClick={() => handleBreadcrumbClick(-1)}
             className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${currentFolderId === "" ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:bg-slate-800'}`}
           >
             <Home size={18} />
             <span className="hidden sm:inline">Drive</span>
           </button>
           
           {folderHistory.map((h, idx) => (
             <React.Fragment key={h.id}>
               <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
               <button 
                 onClick={() => handleBreadcrumbClick(idx)}
                 className={`p-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${idx === folderHistory.length - 1 ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:bg-slate-800'}`}
               >
                 {h.name}
               </button>
             </React.Fragment>
           ))}
        </div>

        {/* Add New Button (Toggle Dropdown) */}
        <div className="flex items-center gap-2 new-dropdown-container">
            {bgProcessing && (
                <div className="flex items-center gap-2 text-xs text-blue-400 mr-4 animate-pulse">
                    <Loader2 size={14} className="animate-spin" />
                    Processing...
                </div>
            )}
            
            <div className="relative">
                <button 
                    onClick={() => setIsNewDropdownOpen(!isNewDropdownOpen)}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg transition-all border border-transparent
                    ${isNewDropdownOpen ? 'bg-slate-800 border-slate-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'}`}
                >
                    <Plus size={18} />
                    <span className="hidden sm:inline">Baru</span>
                </button>
                
                {/* Dropdown Menu */}
                {isNewDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                        <button onClick={(e) => { e.stopPropagation(); executeAction('new_folder'); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded-lg flex items-center gap-3 text-sm text-slate-200 transition-colors">
                            <Folder size={18} className="text-blue-400"/> Folder Baru
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleCreateNote(); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded-lg flex items-center gap-3 text-sm text-slate-200 transition-colors">
                            <FileText size={18} className="text-yellow-400"/> Catatan Baru
                        </button>
                        <div className="h-px bg-slate-700 my-1"></div>
                        <label className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded-lg flex items-center gap-3 text-sm text-slate-200 cursor-pointer transition-colors">
                            <Upload size={18} className="text-green-400"/> Upload File
                            <input type="file" multiple className="hidden" onChange={(e) => {
                                setIsNewDropdownOpen(false);
                                if(e.target.files) {
                                    const files = Array.from(e.target.files);
                                    setBgProcessing(true);
                                    Promise.all(files.map(f => API.uploadToDrive(f, currentFolderId)))
                                        .then(() => loadFolder(currentFolderId))
                                        .finally(() => setBgProcessing(false));
                                }
                            }} />
                        </label>
                    </div>
                )}
            </div>
        </div>
      </header>

      {/* MULTI-SELECT TOOLBAR */}
      {selectedIds.size > 0 && (
        <div className="sticky top-16 z-30 bg-blue-600 text-white px-4 py-2 flex justify-between items-center shadow-md animate-in slide-in-from-top-2">
           <div className="flex items-center gap-3">
             <button onClick={() => setSelectedIds(new Set())} className="p-1 hover:bg-blue-500 rounded"><X size={18}/></button>
             <span className="font-semibold text-sm">{selectedIds.size} terpilih</span>
           </div>
           <div className="flex gap-2">
             <button onClick={(e) => { e.stopPropagation(); executeAction('duplicate'); }} className="p-2 hover:bg-blue-500 rounded tooltip" title="Copy"><Copy size={18}/></button>
             <button onClick={(e) => { e.stopPropagation(); executeAction('move'); }} className="p-2 hover:bg-blue-500 rounded tooltip" title="Move"><Move size={18}/></button>
             {selectedIds.size === 1 && (
                 <>
                   <button onClick={(e) => { e.stopPropagation(); executeAction('rename'); }} className="p-2 hover:bg-blue-500 rounded" title="Rename"><Edit size={18}/></button>
                   <button onClick={(e) => { e.stopPropagation(); executeAction('download'); }} className="p-2 hover:bg-blue-500 rounded" title="Download"><Download size={18}/></button>
                 </>
             )}
             <button onClick={(e) => { e.stopPropagation(); executeAction('delete'); }} className="p-2 hover:bg-red-500 rounded bg-red-600/50" title="Delete"><Trash2 size={18}/></button>
           </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="p-4 md:p-6 pb-20 space-y-8">
        
        {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                <Loader2 size={32} className="animate-spin text-blue-500"/>
                <p className="text-sm">Memuat isi folder...</p>
            </div>
        ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl">
                <Folder size={64} className="mb-4 opacity-20" />
                <p className="font-medium">Folder Kosong</p>
                <p className="text-xs mt-1 text-slate-500">Klik kanan untuk opsi baru</p>
            </div>
        ) : (
            <>
                {/* 1. FOLDERS SECTION */}
                {groupedItems.folders.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Folder size={14}/> Folders
                            </h2>
                            <div className="h-px bg-slate-800 flex-1"></div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {groupedItems.folders.map(item => (
                                <FolderItem 
                                    key={item.id} 
                                    item={item} 
                                    selected={selectedIds.has(item.id)}
                                    onClick={handleItemClick}
                                    onContextMenu={handleContextMenu}
                                    onToggleSelect={() => toggleSelection(item.id, true)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* 2. NOTES SECTION */}
                {groupedItems.notes.length > 0 && (
                    <section>
                         <div className="flex items-center gap-3 mb-4 mt-8">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText size={14}/> Notes
                            </h2>
                            <div className="h-px bg-slate-800 flex-1"></div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {groupedItems.notes.map(item => (
                                <NoteItem 
                                    key={item.id} 
                                    item={item} 
                                    selected={selectedIds.has(item.id)}
                                    onClick={handleItemClick}
                                    onContextMenu={handleContextMenu}
                                    onToggleSelect={() => toggleSelection(item.id, true)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* 3. IMAGES SECTION */}
                {groupedItems.images.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-4 mt-8">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <ImageIcon size={14}/> Images
                            </h2>
                            <div className="h-px bg-slate-800 flex-1"></div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {groupedItems.images.map(item => (
                                <ImageItem 
                                    key={item.id} 
                                    item={item} 
                                    selected={selectedIds.has(item.id)}
                                    onClick={handleItemClick}
                                    onContextMenu={handleContextMenu}
                                    onToggleSelect={() => toggleSelection(item.id, true)}
                                />
                            ))}
                        </div>
                    </section>
                )}
            </>
        )}
      </main>

      {/* --- OVERLAYS --- */}

      {/* 1. Drag & Drop File Indicator */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-blue-500/20 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in-95">
           <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center">
              <div className="p-4 bg-blue-500/10 rounded-full mb-4">
                  <Upload size={48} className="text-blue-500 animate-bounce"/>
              </div>
              <h2 className="text-2xl font-bold">Lepaskan untuk Upload</h2>
           </div>
        </div>
      )}

      {/* 2. Context Menu */}
      {contextMenu && (
        <>
            <div className="fixed inset-0 z-[99]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}></div>
            
            <div 
            className="fixed z-[100] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1.5 min-w-[200px] animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
            style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 220) }}
            >
            {contextMenu.targetItem ? (
                // --- MENU ITEM (File/Folder) ---
                <>
                <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/50 mb-1 truncate max-w-[200px]">
                    {contextMenu.targetItem.name}
                </div>
                <button onClick={() => executeAction('rename')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Edit size={16} className="text-slate-400"/> Rename</button>
                <button onClick={() => executeAction('duplicate')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Copy size={16} className="text-slate-400"/> Copy</button>
                <button onClick={() => executeAction('move')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Move size={16} className="text-slate-400"/> Move</button>
                {contextMenu.targetItem.type !== 'folder' && (
                    <button onClick={() => executeAction('download')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Download size={16} className="text-slate-400"/> Download</button>
                )}
                <div className="h-px bg-slate-700 my-1"/>
                <button onClick={() => executeAction('delete')} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 text-sm transition-colors"><Trash2 size={16}/> Delete</button>
                </>
            ) : (
                // --- MENU EMPTY SPACE ---
                <>
                <button onClick={() => executeAction('new_folder')} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Folder size={16} className="text-blue-400"/> New Folder</button>
                <button onClick={handleCreateNote} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><FileText size={16} className="text-yellow-400"/> New Note</button>
                <label className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 cursor-pointer transition-colors">
                    <Upload size={16} className="text-green-400"/> Upload File
                    <input type="file" multiple className="hidden" onChange={(e) => {
                        setContextMenu(null);
                        if(e.target.files) {
                            const files = Array.from(e.target.files);
                            setBgProcessing(true);
                            Promise.all(files.map(f => API.uploadToDrive(f, currentFolderId)))
                                .then(() => loadFolder(currentFolderId))
                                .finally(() => setBgProcessing(false));
                        }
                    }} />
                </label>
                <div className="h-px bg-slate-700 my-1"/>
                <button onClick={() => { setContextMenu(null); loadFolder(currentFolderId); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Loader2 size={16} className="text-slate-400"/> Refresh</button>
                </>
            )}
            </div>
        </>
      )}

      {/* 3. Image Preview */}
      {previewImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewImage(null)}>
            <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white z-10"><X size={24}/></button>
            <img src={previewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} referrerPolicy="no-referrer" />
        </div>
      )}

      {/* 4. Text Editor */}
      {editingNote && (
          <TextEditor 
            note={editingNote}
            onSave={handleSaveNote}
            onClose={() => setEditingNote(null)}
          />
      )}

      {/* 5. Modal */}
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setModal(null)} />
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
             <div className="p-6">
                 <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                     {modal.isDanger && <AlertCircle className="text-red-500" size={20} />}
                     {modal.title}
                 </h3>
                 {modal.message && <p className="text-sm text-slate-400 mb-4">{modal.message}</p>}
                 
                 {/* Input Type */}
                 {modal.type === 'input' && (
                     <input 
                       ref={inputRef}
                       type="text" 
                       defaultValue={modal.inputValue}
                       className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                       onKeyDown={(e) => { if(e.key === 'Enter') modal.onConfirm?.(e.currentTarget.value); }}
                       onChange={(e) => { if (modal) modal.inputValue = e.target.value; }}
                     />
                 )}

                 {/* Select Type */}
                 {modal.type === 'select' && modal.options && (
                     <select 
                       ref={selectRef}
                       className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                       onChange={(e) => { if (modal) modal.inputValue = e.target.value; }}
                       defaultValue={modal.options[0]?.value}
                     >
                        {modal.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                     </select>
                 )}
             </div>
             
             <div className="bg-slate-800/50 p-4 flex gap-3 border-t border-slate-800">
                 <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors text-slate-300">Batal</button>
                 <button 
                    onClick={() => {
                        // For select, if inputValue is unset, use the first option value
                        let val = modal.inputValue;
                        if (modal.type === 'select' && !val && modal.options && modal.options.length > 0) {
                            val = modal.options[0].value;
                        }
                        modal.onConfirm?.(val);
                    }} 
                    className={`flex-1 py-2 rounded-lg text-sm font-medium text-white shadow-lg transition-transform active:scale-95 ${modal.isDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                 >
                     {modal.confirmText || 'OK'}
                 </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- SUB COMPONENTS FOR GRID ITEMS ---

const FolderItem = ({ item, selected, onClick, onContextMenu, onToggleSelect }: any) => (
    <div 
        data-folder-id={item.id}
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/item-id", item.id)}
        onClick={(e) => onClick(e, item)}
        onContextMenu={(e) => onContextMenu(e, item)}
        className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-2
        ${selected ? 'bg-blue-500/20 border-blue-500 shadow-md' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-600'}`}
    >
        <div className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <CheckSquare size={18} className={selected ? "text-blue-500 bg-slate-900 rounded" : "text-slate-500 hover:text-slate-300"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/>
        </div>
        <Folder size={48} className="text-blue-500 fill-blue-500/10 drop-shadow-md" />
        <span className="text-xs font-medium text-slate-200 text-center truncate w-full px-1">{item.name}</span>
    </div>
);

const NoteItem = ({ item, selected, onClick, onContextMenu, onToggleSelect }: any) => (
    <div 
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/item-id", item.id)}
        onClick={(e) => onClick(e, item)}
        onContextMenu={(e) => onContextMenu(e, item)}
        className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 h-40 overflow-hidden shadow-sm
        ${selected ? 'ring-2 ring-blue-500 shadow-lg scale-[1.02]' : 'hover:-translate-y-1 hover:shadow-lg'}`}
        style={{ backgroundColor: '#fff9c4', color: '#333' }}
    >
        <div className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
             <CheckSquare size={18} className={selected ? "text-blue-600" : "text-slate-400"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/>
        </div>
        <h4 className="font-bold text-sm border-b border-black/10 pb-1 truncate">{item.name.replace('.txt', '')}</h4>
        <p className="text-[10px] leading-relaxed opacity-80 break-words line-clamp-6">{item.snippet || "No preview"}</p>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#fff9c4] to-transparent pointer-events-none"/>
    </div>
);

const ImageItem = ({ item, selected, onClick, onContextMenu, onToggleSelect }: any) => (
    <div 
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/item-id", item.id)}
        onClick={(e) => onClick(e, item)}
        onContextMenu={(e) => onContextMenu(e, item)}
        className={`group relative rounded-xl border overflow-hidden transition-all cursor-pointer aspect-square bg-slate-950 shadow-sm
        ${selected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-800 hover:border-slate-600'}`}
    >
        <div className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <CheckSquare size={18} className={selected ? "text-blue-500 bg-slate-900 rounded" : "text-white drop-shadow-md"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/>
        </div>
        <img 
            src={item.thumbnail} 
            alt={item.name} 
            className="w-full h-full object-cover" 
            loading="lazy" 
            referrerPolicy="no-referrer"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 translate-y-full group-hover:translate-y-0 transition-transform">
            <p className="text-[10px] text-white truncate text-center">{item.name}</p>
        </div>
    </div>
);

export default App;

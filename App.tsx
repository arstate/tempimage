
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, MoreVertical, 
  ArrowLeft, Plus, Trash2, Copy, Move, Edit, CheckSquare, 
  Loader2, Home, Upload, ChevronRight, X, AlertCircle, Download, CornerUpLeft,
  CheckCircle, XCircle
} from 'lucide-react';
import * as API from './services/api';
import * as DB from './services/db';
import { Item, StoredNote } from './types';
import { TextEditor } from './components/TextEditor';

// --- TYPES ---
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

interface Notification {
  id: string;
  message: string;
  type: 'loading' | 'success' | 'error';
}

// --- HELPER: STRIP HTML ---
const stripHtml = (html: string) => {
  if (!html) return "";
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

const App = () => {
  // --- CORE STATE ---
  const [currentFolderId, setCurrentFolderId] = useState<string>(""); 
  const [parentFolderId, setParentFolderId] = useState<string>(""); 
  const [folderHistory, setFolderHistory] = useState<{id:string, name:string}[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false); 
  
  // --- UI STATE ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null); 
  const [contextMenu, setContextMenu] = useState<{x:number, y:number, targetItem?: Item} | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false); 
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);
  
  // --- NOTIFICATIONS STATE ---
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // --- DRAG SELECTION STATE ---
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{x:number, y:number, width:number, height:number} | null>(null);
  const dragStartPos = useRef<{x:number, y:number} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- EDITOR & MODALS ---
  const [modal, setModal] = useState<ModalState | null>(null);
  const [editingNote, setEditingNote] = useState<StoredNote | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const activeFolderIdRef = useRef<string>(currentFolderId);

  // Update ref whenever state changes
  useEffect(() => {
    activeFolderIdRef.current = currentFolderId;
  }, [currentFolderId]);

  // --- NOTIFICATION HELPERS ---
  const addNotification = (message: string, type: 'loading' | 'success' | 'error' = 'success', duration = 3000) => {
    const id = Date.now().toString() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    if (type !== 'loading') {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }
    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const updateNotification = (id: string, message: string, type: 'success' | 'error') => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, message, type } : n));
    setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  // --- 1. LOAD DATA & CACHING LOGIC ---
  const prefetchNoteContents = async (folderId: string, notesToFetch: Item[]) => {
      if (notesToFetch.length === 0) return;
      for (const note of notesToFetch) {
          if (folderId !== activeFolderIdRef.current) return;
          try {
              if (!note.content) {
                  const content = await API.getFileContent(note.id);
                  const updatedItem = { ...note, content: content };
                  await DB.updateItemInCache(folderId, updatedItem);
                  if (folderId === activeFolderIdRef.current) {
                      setItems(prevItems => prevItems.map(i => i.id === note.id ? updatedItem : i));
                  }
              }
          } catch (e) { console.warn("Failed to prefetch note:", note.name); }
      }
  };

  const loadFolder = useCallback(async (folderId: string = "") => {
    setItems([]); 
    setSelectedIds(new Set()); 
    setLastSelectedId(null);
    
    let cachedItems: Item[] | null = null;
    try {
        if (folderId === activeFolderIdRef.current) {
            cachedItems = await DB.getCachedFolder(folderId);
        }
    } catch (e) { console.warn("Cache read error", e); }

    if (folderId !== activeFolderIdRef.current) return;

    if (cachedItems !== null) {
        setItems(cachedItems);
    } else {
        setLoading(true);
    }

    try {
      const res = await API.getFolderContents(folderId);
      if (folderId !== activeFolderIdRef.current) return;
      setLoading(false);
      
      if (res.status === 'success') {
        const freshItems: Item[] = res.data;
        setParentFolderId(res.parentFolderId || ""); 

        const mergedItems = freshItems.map(newItem => {
            const cachedItem = cachedItems?.find(c => c.id === newItem.id);
            if (cachedItem && cachedItem.content && newItem.type === 'note') {
                return { ...newItem, content: cachedItem.content };
            }
            return newItem;
        });

        setItems(mergedItems);
        await DB.cacheFolderContents(folderId, mergedItems);
        const notesMissingContent = mergedItems.filter(i => i.type === 'note' && !i.content);
        prefetchNoteContents(folderId, notesMissingContent);

      } else {
        console.error(res.message);
      }
    } catch (e) {
      if (folderId === activeFolderIdRef.current) {
          console.error(e);
          setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadFolder(currentFolderId);
  }, [currentFolderId, loadFolder]);

  // --- EVENT LISTENERS ---
  useEffect(() => {
    if (modal?.type === 'input' && inputRef.current) inputRef.current.focus();
  }, [modal]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (isNewDropdownOpen && !(event.target as Element).closest('.new-dropdown-container')) {
            setIsNewDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNewDropdownOpen]);

  // --- DRAG SELECTION ---
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
        if (!isDragSelecting || !dragStartPos.current) return;
        // FIX: Use clientX/clientY for viewport coordinates (matches fixed position)
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        const x = Math.min(dragStartPos.current.x, currentX);
        const y = Math.min(dragStartPos.current.y, currentY);
        const width = Math.abs(currentX - dragStartPos.current.x);
        const height = Math.abs(currentY - dragStartPos.current.y);
        setSelectionBox({ x, y, width, height });

        const newSelected = new Set(e.shiftKey ? selectedIds : []);
        items.forEach(item => {
            const el = document.getElementById(`item-${item.id}`);
            if (el) {
                const rect = el.getBoundingClientRect();
                // FIX: Use rect directly (viewport) without adding scroll, because x/y are now viewport based
                const elX = rect.left;
                const elY = rect.top;
                
                if (x < elX + rect.width && x + width > elX && y < elY + rect.height && y + height > elY) {
                    newSelected.add(item.id);
                }
            }
        });
        setSelectedIds(newSelected);
    };

    const handleWindowMouseUp = () => {
        if (isDragSelecting) {
            setIsDragSelecting(false);
            setSelectionBox(null);
            dragStartPos.current = null;
        }
    };

    if (isDragSelecting) {
        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDragSelecting, items, selectedIds]);

  const startDragSelection = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, .item-clickable') || e.button !== 0) return;
      setIsDragSelecting(true);
      // FIX: Capture viewport coordinates
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      setSelectionBox({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
      if (!e.ctrlKey && !e.shiftKey) setSelectedIds(new Set());
      setContextMenu(null);
      setIsNewDropdownOpen(false);
  };

  // --- SELECTION & CLICK LOGIC ---
  const handleItemClick = (e: React.MouseEvent, item: Item) => {
    e.stopPropagation();
    if (e.shiftKey && lastSelectedId) {
        const lastIndex = items.findIndex(i => i.id === lastSelectedId);
        const currentIndex = items.findIndex(i => i.id === item.id);
        if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            const rangeIds = items.slice(start, end + 1).map(i => i.id);
            const newSet = new Set(selectedIds);
            rangeIds.forEach(id => newSet.add(id));
            setSelectedIds(newSet);
        }
    } else if (e.ctrlKey || e.metaKey) {
        const newSet = new Set(selectedIds);
        if (newSet.has(item.id)) newSet.delete(item.id);
        else { newSet.add(item.id); setLastSelectedId(item.id); }
        setSelectedIds(newSet);
    } else {
        setSelectedIds(new Set([item.id]));
        setLastSelectedId(item.id);
    }
  };

  const handleItemDoubleClick = (e: React.MouseEvent, item: Item) => {
    e.stopPropagation();
    if (item.type === 'folder') {
        setFolderHistory(prev => [...prev, { id: item.id, name: item.name }]);
        setCurrentFolderId(item.id);
    } else if (item.type === 'note') {
        handleOpenNote(item);
    } else if (item.type === 'image') {
        setPreviewImage(item.url || null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item?: Item) => {
    e.preventDefault();
    if (item) {
      if (!selectedIds.has(item.id)) {
        setSelectedIds(new Set([item.id]));
        setLastSelectedId(item.id);
      }
      setContextMenu({ x: e.pageX, y: e.pageY, targetItem: item });
    } else {
      setContextMenu({ x: e.pageX, y: e.pageY, targetItem: undefined });
    }
  };

  // --- ACTIONS ---
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
    // FIX: Cast ids to string[] to resolve TypeScript 'unknown[]' error
    const ids = Array.from(selectedIds) as string[];
    const targetItem = contextMenu?.targetItem || (ids.length === 1 ? items.find(i => i.id === ids[0]) : null);
    
    setContextMenu(null);
    setIsNewDropdownOpen(false);

    if (action === 'download' && targetItem) {
        handleDownload(targetItem);
    }
    // --- OPTIMISTIC DELETE ---
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
            
            // 1. Optimistic UI Update: Remove immediately
            const previousItems = [...items];
            setItems(prev => prev.filter(i => !ids.includes(i.id)));
            setSelectedIds(new Set());
            
            // 2. Add Notification
            const notifId = addNotification(`Menghapus ${ids.length} item...`, 'loading');

            try {
                // 3. API Call
                await API.deleteItems(ids);
                updateNotification(notifId, 'Berhasil dihapus', 'success');
                // Update Cache after success
                const remainingItems = previousItems.filter(i => !ids.includes(i.id));
                await DB.cacheFolderContents(currentFolderId, remainingItems);
            } catch (e) {
                // 4. Revert on Error
                setItems(previousItems);
                updateNotification(notifId, 'Gagal menghapus', 'error');
            }
         }
       });
    } 
    else if (action === 'duplicate') {
        if (ids.length === 0) return;
        const notifId = addNotification(`Menduplikasi ${ids.length} item...`, 'loading');
        try {
            await API.duplicateItems(ids);
            updateNotification(notifId, 'Berhasil diduplikasi', 'success');
            loadFolder(currentFolderId);
        } catch(e) { updateNotification(notifId, 'Gagal duplikasi', 'error'); }
    }
    else if (action === 'move') {
        if (ids.length === 0) return;
        const availableFolders = items.filter(i => i.type === 'folder' && !ids.includes(i.id));
        const options = [];
        if (currentFolderId) options.push({ label: '📁 .. (Folder Induk)', value: parentFolderId || "" }); 
        availableFolders.forEach(f => options.push({ label: `📁 ${f.name}`, value: f.id }));
        
        if (options.length === 0) {
            setModal({ type: 'alert', title: 'Info', message: 'Tidak ada tujuan pindah.' });
            return;
        }

        setModal({
            type: 'select',
            title: `Pindahkan ${ids.length} Item`,
            message: 'Pilih folder tujuan:',
            options: options,
            confirmText: 'Pindahkan',
            onConfirm: async (targetId) => {
                 if (targetId === undefined) return;
                 setModal(null);
                 const notifId = addNotification('Memindahkan item...', 'loading');
                 try {
                     await API.moveItems(ids, targetId);
                     updateNotification(notifId, 'Berhasil dipindahkan', 'success');
                     loadFolder(currentFolderId);
                 } catch(e) { updateNotification(notifId, 'Gagal memindahkan', 'error'); }
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
                    const notifId = addNotification('Mengganti nama...', 'loading');
                    try {
                        await API.renameItem(targetItem.id, newName);
                        updateNotification(notifId, 'Nama berhasil diganti', 'success');
                        loadFolder(currentFolderId);
                    } catch(e) { updateNotification(notifId, 'Gagal ganti nama', 'error'); }
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
                    const notifId = addNotification('Membuat folder...', 'loading');
                    try {
                        await API.createFolder(currentFolderId, name);
                        updateNotification(notifId, 'Folder berhasil dibuat', 'success');
                        loadFolder(currentFolderId);
                    } catch(e) { updateNotification(notifId, 'Gagal buat folder', 'error'); }
                }
            }
        });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files.length > 0) {
      // FIX: Cast files to File[] to avoid 'unknown' items in the array
      const files = Array.from(e.dataTransfer.files) as File[];
      const notifId = addNotification(`Mengupload ${files.length} file...`, 'loading', 60000); // Long timeout for upload
      for (const file of files) {
          try { await API.uploadToDrive(file, currentFolderId); } catch(err) { console.error(err); }
      }
      updateNotification(notifId, 'Upload selesai', 'success');
      await loadFolder(currentFolderId);
      return;
    }
    const movedItemId = e.dataTransfer.getData("text/item-id");
    let targetElement = e.target as HTMLElement;
    while(targetElement && !targetElement.getAttribute("data-folder-id")) {
       targetElement = targetElement.parentElement as HTMLElement;
       if (!targetElement || targetElement === e.currentTarget) break;
    }
    const targetFolderId = targetElement?.getAttribute("data-folder-id");
    if (movedItemId && targetFolderId && movedItemId !== targetFolderId) {
       const notifId = addNotification('Memindahkan via drag...', 'loading');
       try {
         await API.moveItems([movedItemId], targetFolderId);
         updateNotification(notifId, 'Berhasil dipindahkan', 'success');
         await loadFolder(currentFolderId);
       } catch(err) { updateNotification(notifId, 'Gagal pindah', 'error'); } 
    }
  };

  // --- NOTE HANDLING ---
  const handleOpenNote = async (item: Item) => {
      if (item.content) {
          setEditingNote({ id: item.id, galleryId: currentFolderId, title: item.name.replace('.txt', ''), content: item.content, timestamp: item.lastUpdated });
          return;
      }
      const notifId = addNotification('Membuka catatan...', 'loading');
      try {
          const content = await API.getFileContent(item.id);
          const updatedItem = { ...item, content };
          await DB.updateItemInCache(currentFolderId, updatedItem);
          if (currentFolderId === activeFolderIdRef.current) setItems(prev => prev.map(i => i.id === item.id ? updatedItem : i));
          setEditingNote({ id: item.id, galleryId: currentFolderId, title: item.name.replace('.txt', ''), content: content, timestamp: item.lastUpdated });
          removeNotification(notifId);
      } catch(e) { updateNotification(notifId, 'Gagal buka catatan', 'error'); } 
  };

  const handleCreateNote = () => {
      setEditingNote({ id: 'temp-' + Date.now(), galleryId: currentFolderId, title: 'Catatan Baru', content: '', timestamp: Date.now() });
      setIsNewDropdownOpen(false);
      setContextMenu(null);
  };

  const handleSaveNote = async (id: string, title: string, content: string) => {
      const notifId = addNotification('Menyimpan catatan...', 'loading');
      try {
          const isNew = id.startsWith('temp-');
          const fileId = isNew ? undefined : id;
          const result = await API.saveNoteToDrive(title, content, currentFolderId, fileId);
          if (!isNew && fileId) {
              const updatedItem: Item = { ...items.find(i => i.id === fileId)!, name: title + '.txt', content: content, lastUpdated: Date.now(), snippet: stripHtml(content).substring(0, 150) };
              await DB.updateItemInCache(currentFolderId, updatedItem);
              if (currentFolderId === activeFolderIdRef.current) setItems(prev => prev.map(i => i.id === fileId ? updatedItem : i));
          } else {
              if (currentFolderId === activeFolderIdRef.current) await loadFolder(currentFolderId); 
          }
          setEditingNote(null);
          updateNotification(notifId, 'Catatan tersimpan', 'success');
      } catch(e) { updateNotification(notifId, 'Gagal simpan', 'error'); }
  };

  const handleBreadcrumbClick = (index: number) => {
     if (index === -1) { setFolderHistory([]); setCurrentFolderId(""); } 
     else { const target = folderHistory[index]; setFolderHistory(prev => prev.slice(0, index + 1)); setCurrentFolderId(target.id); }
  };

  const groupedItems = {
      folders: items.filter(i => i.type === 'folder'),
      notes: items.filter(i => i.type === 'note'),
      images: items.filter(i => i.type === 'image')
  };

  return (
    <div 
      className="min-h-screen bg-slate-950 text-slate-200 relative select-none"
      ref={containerRef}
      onContextMenu={(e) => handleContextMenu(e)} 
      onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
      onMouseDown={startDragSelection}
    >
      
      {/* SELECTION BOX */}
      {selectionBox && (
          <div className="fixed z-50 bg-blue-500/20 border border-blue-400 pointer-events-none"
             style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />
      )}
      
      {/* FLOATING SELECTION MENU */}
      <SelectionFloatingMenu 
         selectedIds={selectedIds} 
         items={items}
         onClear={() => setSelectedIds(new Set())}
         onAction={executeAction}
         containerRef={containerRef}
      />

      {/* NOTIFICATIONS */}
      <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 pointer-events-none">
          {notifications.map(n => (
              <div key={n.id} className="bg-slate-800/90 backdrop-blur-md border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300">
                  {n.type === 'loading' && <Loader2 size={18} className="animate-spin text-blue-400" />}
                  {n.type === 'success' && <CheckCircle size={18} className="text-green-400" />}
                  {n.type === 'error' && <XCircle size={18} className="text-red-400" />}
                  <span className="text-sm font-medium">{n.message}</span>
              </div>
          ))}
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800 h-16 flex items-center px-4 justify-between shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-right">
           <button onClick={() => handleBreadcrumbClick(-1)} className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${currentFolderId === "" ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:bg-slate-800'}`}>
             <Home size={18} /> <span className="hidden sm:inline">Drive</span>
           </button>
           {folderHistory.map((h, idx) => (
             <React.Fragment key={h.id}>
               <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
               <button onClick={() => handleBreadcrumbClick(idx)} className={`p-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${idx === folderHistory.length - 1 ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:bg-slate-800'}`}>
                 {h.name}
               </button>
             </React.Fragment>
           ))}
        </div>

        <div className="flex items-center gap-2 new-dropdown-container">
            <div className="relative">
                <button onClick={() => setIsNewDropdownOpen(!isNewDropdownOpen)} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg transition-all border border-transparent ${isNewDropdownOpen ? 'bg-slate-800 border-slate-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'}`}>
                    <Plus size={18} /> <span className="hidden sm:inline">Baru</span>
                </button>
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
                                    // FIX: Cast files to File[] to resolve 'unknown' typing issues
                                    const files = Array.from(e.target.files) as File[];
                                    const notifId = addNotification(`Mengupload ${files.length} file...`, 'loading', 60000);
                                    Promise.all(files.map(f => API.uploadToDrive(f, currentFolderId)))
                                        .then(() => { updateNotification(notifId, 'Upload selesai', 'success'); loadFolder(currentFolderId); })
                                        .catch(() => updateNotification(notifId, 'Upload gagal', 'error'));
                                }
                            }} />
                        </label>
                    </div>
                )}
            </div>
        </div>
      </header>

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
                {groupedItems.folders.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Folder size={14}/> Folders</h2>
                            <div className="h-px bg-slate-800 flex-1"></div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {groupedItems.folders.map(item => (
                                <FolderItem key={item.id} item={item} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} onToggleSelect={() => handleItemClick({ stopPropagation: () => {}, ctrlKey: true } as any, item)} />
                            ))}
                        </div>
                    </section>
                )}
                {groupedItems.notes.length > 0 && (
                    <section>
                         <div className="flex items-center gap-3 mb-4 mt-8">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Notes</h2>
                            <div className="h-px bg-slate-800 flex-1"></div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {groupedItems.notes.map(item => (
                                <NoteItem key={item.id} item={item} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} onToggleSelect={() => handleItemClick({ stopPropagation: () => {}, ctrlKey: true } as any, item)} />
                            ))}
                        </div>
                    </section>
                )}
                {groupedItems.images.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-4 mt-8">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={14}/> Images</h2>
                            <div className="h-px bg-slate-800 flex-1"></div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {groupedItems.images.map(item => (
                                <ImageItem key={item.id} item={item} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} onToggleSelect={() => handleItemClick({ stopPropagation: () => {}, ctrlKey: true } as any, item)} />
                            ))}
                        </div>
                    </section>
                )}
            </>
        )}
      </main>

      {/* OVERLAYS */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-blue-500/20 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in-95">
           <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center">
              <div className="p-4 bg-blue-500/10 rounded-full mb-4"><Upload size={48} className="text-blue-500 animate-bounce"/></div>
              <h2 className="text-2xl font-bold">Lepaskan untuk Upload</h2>
           </div>
        </div>
      )}

      {contextMenu && (
        <>
            <div className="fixed inset-0 z-[99]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}></div>
            <div className="fixed z-[100] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1.5 min-w-[200px] animate-in fade-in zoom-in-95 duration-100 overflow-hidden" style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 220) }}>
            {contextMenu.targetItem ? (
                <>
                <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/50 mb-1 truncate max-w-[200px]">{contextMenu.targetItem.name}</div>
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
                <>
                <button onClick={() => executeAction('new_folder')} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Folder size={16} className="text-blue-400"/> New Folder</button>
                <button onClick={handleCreateNote} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><FileText size={16} className="text-yellow-400"/> New Note</button>
                <label className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 cursor-pointer transition-colors">
                    <Upload size={16} className="text-green-400"/> Upload File
                    <input type="file" multiple className="hidden" onChange={(e) => {
                        setContextMenu(null);
                        if(e.target.files) {
                            // FIX: Cast files to File[] to resolve 'unknown' typing issues
                            const files = Array.from(e.target.files) as File[];
                            const notifId = addNotification(`Mengupload ${files.length} file...`, 'loading', 60000);
                            Promise.all(files.map(f => API.uploadToDrive(f, currentFolderId)))
                                .then(() => { updateNotification(notifId, 'Upload selesai', 'success'); loadFolder(currentFolderId); })
                                .catch(() => updateNotification(notifId, 'Upload gagal', 'error'));
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

      {previewImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewImage(null)}>
            <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white z-10"><X size={24}/></button>
            <img src={previewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} referrerPolicy="no-referrer" />
        </div>
      )}

      {editingNote && <TextEditor note={editingNote} onSave={handleSaveNote} onClose={() => setEditingNote(null)} />}

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
                 {modal.type === 'input' && (
                     <input ref={inputRef} type="text" defaultValue={modal.inputValue} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" onKeyDown={(e) => { if(e.key === 'Enter') modal.onConfirm?.(e.currentTarget.value); }} onChange={(e) => { if (modal) modal.inputValue = e.target.value; }} />
                 )}
                 {modal.type === 'select' && modal.options && (
                     <select ref={selectRef} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" onChange={(e) => { if (modal) modal.inputValue = e.target.value; }} defaultValue={modal.options[0]?.value}>
                        {modal.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                     </select>
                 )}
             </div>
             <div className="bg-slate-800/50 p-4 flex gap-3 border-t border-slate-800">
                 <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors text-slate-300">Batal</button>
                 <button onClick={() => { let val = modal.inputValue; if (modal.type === 'select' && !val && modal.options && modal.options.length > 0) val = modal.options[0].value; modal.onConfirm?.(val); }} className={`flex-1 py-2 rounded-lg text-sm font-medium text-white shadow-lg transition-transform active:scale-95 ${modal.isDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                     {modal.confirmText || 'OK'}
                 </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- FLOATING SELECTION MENU COMPONENT ---
const SelectionFloatingMenu = ({ selectedIds, items, onClear, onAction, containerRef }: { selectedIds: Set<string>, items: Item[], onClear: () => void, onAction: (a: string) => void, containerRef: React.RefObject<HTMLDivElement> }) => {
    const [pos, setPos] = useState<{top?: number, left?: number, bottom?: number, x?:number}>({ bottom: 24, left: window.innerWidth / 2 }); 
    const [styleType, setStyleType] = useState<'contextual' | 'dock'>('dock');
    const menuRef = useRef<HTMLDivElement>(null);
    
    useLayoutEffect(() => {
        if (selectedIds.size === 0) return;
        
        const updatePosition = () => {
            const rects: DOMRect[] = [];
            selectedIds.forEach(id => {
                const el = document.getElementById(`item-${id}`);
                if (el) rects.push(el.getBoundingClientRect());
            });

            if (rects.length === 0) {
                 setStyleType('dock');
                 setPos({ bottom: 32, left: window.innerWidth / 2 });
                 return;
            }

            // Viewport Coordinates of the Selection Bounding Box
            const viewMinY = Math.min(...rects.map(r => r.top));
            const viewMaxY = Math.max(...rects.map(r => r.bottom));
            const viewMinX = Math.min(...rects.map(r => r.left));
            const viewMaxX = Math.max(...rects.map(r => r.right));
            
            const centerX = viewMinX + (viewMaxX - viewMinX) / 2;
            const viewportHeight = window.innerHeight;
            const selectionHeight = viewMaxY - viewMinY;

            // --- DOCK MODE LOGIC ---
            // If many items (>8) OR selection spans significant vertical space (> 40% viewport)
            if (selectedIds.size > 8 || selectionHeight > (viewportHeight * 0.4)) {
                setStyleType('dock');
                setPos({ bottom: 32, left: window.innerWidth / 2 });
                return;
            }

            // --- CONTEXTUAL MODE LOGIC ---
            // Dimensions and Safe Zones
            const headerHeight = 80; // Approx safety from top (header + spacing)
            const menuHeight = menuRef.current ? menuRef.current.offsetHeight : 60;
            const gap = 12;

            // Decision: Above or Below?
            // Preference: ABOVE the items
            let targetTop;
            
            // If there is enough space ABOVE the selection (viewMinY) relative to header
            if (viewMinY > (headerHeight + menuHeight + gap)) {
                // Place ABOVE: 
                // We add window.scrollY to make it absolute to document
                targetTop = window.scrollY + viewMinY - menuHeight - gap;
            } else {
                // Not enough space above (blocked by header/top edge), place BELOW
                targetTop = window.scrollY + viewMaxY + gap;
            }

            // --- CLAMPING LOGIC FOR MOBILE (HORIZONTAL) ---
            let finalLeft = centerX;
            if (menuRef.current) {
                const menuWidth = menuRef.current.offsetWidth;
                const screenWidth = window.innerWidth;
                const padding = 16; // Margin from screen edge

                const minSafe = (menuWidth / 2) + padding;
                const maxSafe = screenWidth - (menuWidth / 2) - padding;

                if (minSafe < maxSafe) { 
                    finalLeft = Math.max(minSafe, Math.min(maxSafe, centerX));
                } else {
                    finalLeft = screenWidth / 2;
                }
            }

            setStyleType('contextual');
            setPos({ top: targetTop, left: finalLeft });
        };

        updatePosition();
        
        // Listener for resize/orientation change
        window.addEventListener('resize', updatePosition);
        return () => window.removeEventListener('resize', updatePosition);

    }, [selectedIds, items]);

    if (selectedIds.size === 0) return null;

    // dockStyle: FIXED position (doesn't add to scroll height, stays in viewport)
    const dockStyle = "fixed z-50 transform -translate-x-1/2 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-blue-500/50 p-2 rounded-2xl shadow-2xl shadow-blue-500/10 animate-in zoom-in-95 slide-in-from-bottom-5 duration-200 transition-all max-w-[95vw] overflow-x-auto";
    
    // contextStyle: ABSOLUTE position (follows document flow)
    const contextStyle = "absolute z-50 transform -translate-x-1/2 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-blue-500/50 p-1.5 rounded-full shadow-2xl shadow-blue-500/20 animate-in fade-in zoom-in-95 duration-150 transition-all duration-300 ease-out max-w-[95vw] overflow-x-auto";

    const isContext = styleType === 'contextual';

    return (
        <div 
            ref={menuRef}
            className={isContext ? contextStyle : dockStyle}
            style={{ 
                top: isContext ? pos.top : undefined, 
                left: isContext ? pos.left : '50%', // Dock is always center
                bottom: isContext ? undefined : pos.bottom 
            }}
        >
            <div className={`flex items-center gap-2 ${isContext ? 'px-2' : 'px-3 border-r border-white/10 mr-1'}`}>
                <span className="font-bold text-sm text-blue-100">{selectedIds.size}</span>
                <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={14} /></button>
            </div>
            
            <button onClick={(e) => { e.stopPropagation(); onAction('duplicate'); }} className="p-2 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-colors tooltip" title="Duplicate"><Copy size={18}/></button>
            <button onClick={(e) => { e.stopPropagation(); onAction('move'); }} className="p-2 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-colors tooltip" title="Move"><Move size={18}/></button>
            
            {selectedIds.size === 1 && (
                <>
                <button onClick={(e) => { e.stopPropagation(); onAction('rename'); }} className="p-2 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-colors tooltip" title="Rename"><Edit size={18}/></button>
                <button onClick={(e) => { e.stopPropagation(); onAction('download'); }} className="p-2 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-colors tooltip" title="Download"><Download size={18}/></button>
                </>
            )}
            
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={(e) => { e.stopPropagation(); onAction('delete'); }} className="p-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors tooltip" title="Delete"><Trash2 size={18}/></button>
        </div>
    );
};

// --- SUB COMPONENTS FOR GRID ITEMS ---

const FolderItem = ({ item, selected, onClick, onDoubleClick, onContextMenu, onToggleSelect }: any) => (
    <div id={`item-${item.id}`} data-folder-id={item.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/item-id", item.id)} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }} className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-2 item-clickable ${selected ? 'bg-blue-500/20 border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-600'}`}>
        <div className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <CheckSquare size={18} className={selected ? "text-blue-500 bg-slate-900 rounded" : "text-slate-500 hover:text-slate-300"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/>
        </div>
        <Folder size={48} className="text-blue-500 fill-blue-500/10 drop-shadow-md" />
        <span className="text-xs font-medium text-slate-200 text-center truncate w-full px-1 select-none">{item.name}</span>
    </div>
);

const NoteItem = ({ item, selected, onClick, onDoubleClick, onContextMenu, onToggleSelect }: any) => {
    const preview = stripHtml(item.content || item.snippet || "").substring(0, 150);
    return (
        <div id={`item-${item.id}`} draggable onDragStart={(e) => e.dataTransfer.setData("text/item-id", item.id)} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }} className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 h-40 overflow-hidden shadow-sm item-clickable ${selected ? 'ring-2 ring-blue-500 shadow-lg scale-[1.02]' : 'hover:-translate-y-1 hover:shadow-lg'}`} style={{ backgroundColor: '#fff9c4', color: '#333' }}>
            <div className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <CheckSquare size={18} className={selected ? "text-blue-600" : "text-slate-400"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/>
            </div>
            <h4 className="font-bold text-sm border-b border-black/10 pb-1 truncate select-none">{item.name.replace('.txt', '')}</h4>
            <p className="text-[10px] leading-relaxed opacity-80 break-words line-clamp-6 select-none">{preview || "No preview"}</p>
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#fff9c4] to-transparent pointer-events-none"/>
        </div>
    );
};

const ImageItem = ({ item, selected, onClick, onDoubleClick, onContextMenu, onToggleSelect }: any) => (
    <div id={`item-${item.id}`} draggable onDragStart={(e) => e.dataTransfer.setData("text/item-id", item.id)} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }} className={`group relative rounded-xl border overflow-hidden transition-all cursor-pointer aspect-square bg-slate-950 shadow-sm item-clickable ${selected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-slate-800 hover:border-slate-600'}`}>
        <div className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <CheckSquare size={18} className={selected ? "text-blue-500 bg-slate-900 rounded" : "text-white drop-shadow-md"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/>
        </div>
        <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover select-none" loading="lazy" referrerPolicy="no-referrer"/>
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 translate-y-full group-hover:translate-y-0 transition-transform">
            <p className="text-[10px] text-white truncate text-center select-none">{item.name}</p>
        </div>
    </div>
);

export default App;

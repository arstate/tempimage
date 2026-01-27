
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, MoreVertical, 
  ArrowLeft, Plus, Trash2, Copy, Move, Edit, CheckSquare, 
  Loader2, Home, Upload, ChevronRight, X, AlertCircle, Download, CornerUpLeft,
  CheckCircle, XCircle, Image, RotateCcw, Ban
} from 'lucide-react';
import * as API from './services/api';
import * as DB from './services/db';
import { Item, StoredNote } from './types';
import { TextEditor } from './components/TextEditor';
import { UploadProgress, UploadItem } from './components/UploadProgress';

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

const RECYCLE_BIN_NAME = "Recycle Bin";

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
  const [recycleBinId, setRecycleBinId] = useState<string>(""); // Store Recycle Bin ID
  const [folderHistory, setFolderHistory] = useState<{id:string, name:string}[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false); 
  
  // --- GLOBAL LOADING OVERLAY (BLOCKING) ---
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState("");

  // --- PROCESSING STATE (NON-BLOCKING ACTIONS) ---
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // --- UI STATE ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null); 
  const [contextMenu, setContextMenu] = useState<{x:number, y:number, targetItem?: Item, isRecycleBinBtn?: boolean} | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false); 
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);
  
  // --- UPLOAD STATE ---
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);

  // --- NOTIFICATIONS STATE ---
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // --- DRAG/TOUCH SELECTION STATE ---
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

  // --- 0. INITIAL URL CHECK (Persistence) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const folderIdParam = params.get('folder');
    if (folderIdParam && folderIdParam !== currentFolderId) {
        setCurrentFolderId(folderIdParam);
    }
  }, []); // Run once on mount

  // Update URL when folder changes
  useEffect(() => {
    const url = new URL(window.location.href);
    if (currentFolderId) {
        url.searchParams.set('folder', currentFolderId);
    } else {
        url.searchParams.delete('folder');
    }
    window.history.pushState({}, '', url);
  }, [currentFolderId]);

  // --- SAFETY: PREVENT ACCIDENTAL CLOSE ---
  useEffect(() => {
    const isUploading = uploadQueue.some(u => u.status === 'uploading');
    const isBusy = isGlobalLoading || isProcessingAction || isUploading;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isBusy) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
        return ''; // Legacy
      }
    };

    if (isBusy) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isGlobalLoading, isProcessingAction, uploadQueue]);


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
        const freshItems: Item[] = (Array.isArray(res.data) ? res.data : [])
            .filter((i: any) => i && i.id && i.name);

        setParentFolderId(res.parentFolderId || ""); 

        // SORTING: 0-9 then A-Z (Case Insensitive)
        freshItems.sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        // RECYCLE BIN DISCOVERY (If in root)
        if (folderId === "") {
            const bin = freshItems.find(i => i.name === RECYCLE_BIN_NAME && i.type === 'folder');
            if (bin) {
                setRecycleBinId(bin.id);
            }
        }

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
          console.error("Load Folder Error:", e);
          setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadFolder(currentFolderId);
  }, [currentFolderId, loadFolder]);

  // --- RECYCLE BIN HELPERS ---
  const getOrCreateRecycleBin = async (): Promise<string> => {
      if (recycleBinId) return recycleBinId;

      // Check root folder explicitly if we haven't found it yet
      const res = await API.getFolderContents("");
      const rootItems: Item[] = Array.isArray(res.data) ? res.data : [];
      const existingBin = rootItems.find(i => i.name === RECYCLE_BIN_NAME && i.type === 'folder');
      
      if (existingBin) {
          setRecycleBinId(existingBin.id);
          return existingBin.id;
      }

      // Create if not exists
      const createRes = await API.createFolder("", RECYCLE_BIN_NAME);
      if (createRes.status === 'success' && createRes.data) {
          setRecycleBinId(createRes.data.id);
          return createRes.data.id;
      }
      throw new Error("Could not create Recycle Bin");
  };

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

  // --- SELECTION LOGIC (SHARED MOUSE & TOUCH) ---
  const updateSelection = (currentX: number, currentY: number) => {
      if (!dragStartPos.current) return;
      
      const x = Math.min(dragStartPos.current.x, currentX);
      const y = Math.min(dragStartPos.current.y, currentY);
      const width = Math.abs(currentX - dragStartPos.current.x);
      const height = Math.abs(currentY - dragStartPos.current.y);
      setSelectionBox({ x, y, width, height });

      const newSelected = new Set(selectedIds); 
      
      items.forEach(item => {
          const el = document.getElementById(`item-${item.id}`);
          if (el) {
              const rect = el.getBoundingClientRect();
              const elX = rect.left;
              const elY = rect.top;
              
              if (x < elX + rect.width && x + width > elX && y < elY + rect.height && y + height > elY) {
                  newSelected.add(item.id);
              }
          }
      });
      setSelectedIds(newSelected);
  };

  // --- MOUSE DRAG SELECTION ---
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
        if (!isDragSelecting) return;
        updateSelection(e.clientX, e.clientY);
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
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      setSelectionBox({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
      if (!e.ctrlKey && !e.shiftKey) setSelectedIds(new Set());
      setContextMenu(null);
      setIsNewDropdownOpen(false);
  };

  // --- TOUCH SELECTION (MOBILE) ---
  const handleTouchStart = (e: React.TouchEvent) => {
     if ((e.target as HTMLElement).closest('button, .item-clickable')) return;
     if (e.touches.length === 1) {
         dragStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
     }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
     if (!dragStartPos.current) return;
     const x = e.touches[0].clientX;
     const y = e.touches[0].clientY;
     
     if (!isDragSelecting) {
         const dist = Math.sqrt(Math.pow(x - dragStartPos.current.x, 2) + Math.pow(y - dragStartPos.current.y, 2));
         if (dist > 10) { 
             setIsDragSelecting(true);
         }
     }

     if (isDragSelecting) {
         updateSelection(x, y);
         if(e.cancelable) e.preventDefault(); 
     }
  };

  const handleTouchEnd = () => {
      setIsDragSelecting(false);
      setSelectionBox(null);
      dragStartPos.current = null;
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

  // --- ROBUST FILE ACTIONS (COPY & DOWNLOAD) ---
  
  // Updated Helper: Uses STABLE PUBLIC PROXIES (AllOrigins & WSRV)
  const getBlobFromUrl = async (url: string): Promise<Blob> => {
      // 1. Attempt Direct Fetch (Just in case CORS is open)
      try {
          const response = await fetch(url, {
              mode: 'cors',
              credentials: 'omit',
              referrerPolicy: 'no-referrer'
          });
          if (response.ok) return await response.blob();
      } catch (e) { /* ignore */ }

      // 2. Primary Proxy: AllOrigins (Raw Mode)
      // This is generally very reliable for fetching raw files.
      try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl);
          if (!response.ok) throw new Error(`AllOrigins status: ${response.status}`);
          return await response.blob();
      } catch (err1) {
          console.warn("Proxy 1 (AllOrigins) failed, trying backup...", err1);
      }

      // 3. Backup Proxy: WSRV (Image Proxy)
      // WSRV is specialized for images and very good at bypassing Google's restrictions.
      // We explicitly ask for output=png to ensure we get a valid image blob back.
      try {
          const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=png`;
          const response = await fetch(proxyUrl);
          if (!response.ok) throw new Error(`WSRV status: ${response.status}`);
          return await response.blob();
      } catch (err2) {
          throw new Error("Gagal mengunduh: Semua jalur proxy sibuk atau diblokir.");
      }
  };

  const handleDownload = async (item: Item | string) => {
    const url = typeof item === 'string' ? item : (item.url || item.thumbnail);
    const name = typeof item === 'string' ? 'download.png' : item.name;

    if (!url) return;
    
    // Lock app state to prevent closing
    setIsProcessingAction(true);
    const notifId = addNotification('Mengunduh gambar...', 'loading');
    
    try {
        const blob = await getBlobFromUrl(url);
        const blobUrl = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = name; 
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
        
        updateNotification(notifId, 'Download berhasil', 'success');
    } catch (e) {
        console.error(e);
        // Show specific error notification for the user
        const msg = e instanceof Error ? e.message : "Network Error";
        updateNotification(notifId, `Gagal: ${msg}`, 'error');
    } finally {
        setIsProcessingAction(false);
    }
  };

  const handleCopyImage = async (item: Item | string) => {
      const url = typeof item === 'string' ? item : (item.thumbnail || item.url);
      if (!url) return;

      const notifId = addNotification('Menyalin gambar...', 'loading');
      try {
          const blob = await getBlobFromUrl(url);
          
          await navigator.clipboard.write([
              new ClipboardItem({
                  [blob.type]: blob
              })
          ]);
          updateNotification(notifId, 'Gambar disalin ke clipboard!', 'success');
      } catch (err) {
          console.error("Clipboard Error:", err);
          updateNotification(notifId, 'Gagal menyalin: Proxy/Izin Error', 'error');
      }
  };

  const executeAction = async (action: string) => {
    const ids = Array.from(selectedIds) as string[];
    const targetItem = contextMenu?.targetItem || (ids.length === 1 ? items.find(i => i.id === ids[0]) : null);
    const isRecycleBinView = currentFolderId === recycleBinId;
    
    // --- PROTECTION: PREVENT ACTIONS ON RECYCLE BIN FOLDER ITSELF ---
    if (ids.includes(recycleBinId)) {
        if (['delete', 'move', 'rename'].includes(action)) {
            addNotification("Folder System tidak dapat diubah/dihapus", "error");
            setContextMenu(null);
            setIsNewDropdownOpen(false);
            return;
        }
    }

    setContextMenu(null);
    setIsNewDropdownOpen(false);

    if (action === 'download' && targetItem) {
        handleDownload(targetItem);
    }
    else if (action === 'copy_image' && targetItem) {
        handleCopyImage(targetItem);
    }
    
    // --- DELETE LOGIC (SOFT VS PERMANENT) ---
    else if (action === 'delete' || action === 'delete_permanent') {
       if (ids.length === 0) return;
       
       const isPermanent = action === 'delete_permanent' || isRecycleBinView;
       const title = isPermanent ? 'Hapus Permanen?' : 'Pindah ke Sampah?';
       const confirmMsg = isPermanent 
          ? `Hapus ${ids.length} item selamanya? Tidak bisa dikembalikan.`
          : `Pindahkan ${ids.length} item ke Recycle Bin?`;

       setModal({
         type: 'confirm',
         title: title,
         message: confirmMsg,
         confirmText: 'Hapus',
         isDanger: true,
         onConfirm: async () => {
            setModal(null);
            setIsProcessingAction(true); // START PROTECTION
            
            // UI Feedback: Set status to 'deleting'
            setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: 'deleting' } : i));
            setSelectedIds(new Set());
            
            try {
                if (isPermanent) {
                     // 1. Permanent Delete
                    const notifId = addNotification(`Menghapus ${ids.length} item permanen...`, 'loading');
                    await API.deleteItems(ids);
                    
                    // Cleanup DB metadata
                    for(const id of ids) await DB.removeDeletedMeta(id);

                    updateNotification(notifId, 'Berhasil dihapus permanen', 'success');
                } else {
                    // 2. Soft Delete (Move to Recycle Bin)
                    const notifId = addNotification(`Memindahkan ke sampah...`, 'loading');
                    const binId = await getOrCreateRecycleBin();
                    
                    // Save metadata for restore
                    for(const id of ids) {
                        await DB.saveDeletedMeta(id, currentFolderId);
                    }

                    await API.moveItems(ids, binId);
                    updateNotification(notifId, 'Dipindahkan ke Recycle Bin', 'success');
                }
                
                // Refresh
                await loadFolder(currentFolderId);

            } catch (e) {
                // Revert status on error
                setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: undefined } : i));
                addNotification('Gagal menghapus', 'error');
            } finally {
                setIsProcessingAction(false); // END PROTECTION
            }
         }
       });
    }
    
    // --- RESTORE LOGIC ---
    else if (action === 'restore') {
        if (ids.length === 0) return;
        
        // UI Feedback: Set status to 'restoring'
        setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: 'restoring' } : i));
        setSelectedIds(new Set());

        setIsProcessingAction(true); // START PROTECTION
        const notifId = addNotification(`Mengembalikan ${ids.length} item...`, 'loading');

        try {
            // Restore sequentially to handle different destinations
            for (const id of ids) {
                let originalParent = await DB.getDeletedMeta(id);
                if (!originalParent) originalParent = ""; // Default to root
                await API.moveItems([id], originalParent);
                await DB.removeDeletedMeta(id);
            }
            updateNotification(notifId, 'Item berhasil dikembalikan', 'success');
            await loadFolder(currentFolderId);

        } catch(e) {
             setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: undefined } : i));
             updateNotification(notifId, 'Gagal restore', 'error');
        } finally {
            setIsProcessingAction(false); // END PROTECTION
        }
    }

    // --- RECYCLE BIN BULK ACTIONS ---
    else if (action === 'empty_bin') {
        if (!recycleBinId) return;
        // Fetch items inside bin first to get IDs (we might be in root, triggering this via context menu)
        const res = await API.getFolderContents(recycleBinId);
        const binItems: Item[] = Array.isArray(res.data) ? res.data : [];
        const binIds = binItems.map(i => i.id);

        if (binIds.length === 0) {
            addNotification("Recycle Bin sudah kosong", 'success');
            return;
        }

        setModal({
            type: 'confirm',
            title: 'Kosongkan Recycle Bin?',
            message: `Hapus semua ${binIds.length} item secara permanen?`,
            confirmText: 'Kosongkan',
            isDanger: true,
            onConfirm: async () => {
                setModal(null);
                setIsProcessingAction(true); // START PROTECTION
                const notifId = addNotification("Mengosongkan Recycle Bin...", 'loading');
                try {
                    await API.deleteItems(binIds);
                    for(const id of binIds) await DB.removeDeletedMeta(id);
                    updateNotification(notifId, 'Recycle Bin dikosongkan', 'success');
                    if (currentFolderId === recycleBinId) loadFolder(recycleBinId);
                } catch(e) { updateNotification(notifId, 'Gagal mengosongkan', 'error'); } 
                finally { setIsProcessingAction(false); } // END PROTECTION
            }
        });
    }

    else if (action === 'restore_all') {
         if (!recycleBinId) return;
         const res = await API.getFolderContents(recycleBinId);
         const binItems: Item[] = Array.isArray(res.data) ? res.data : [];
         const binIds = binItems.map(i => i.id);

         if (binIds.length === 0) {
             addNotification("Tidak ada item untuk direstore", 'success');
             return;
         }

         setIsProcessingAction(true); // START PROTECTION
         const notifId = addNotification("Mengembalikan semua item...", 'loading');
         try {
             // If we are currently IN the recycle bin, show loading UI on items
             if (currentFolderId === recycleBinId) {
                 setItems(prev => prev.map(i => ({...i, status: 'restoring'})));
             }

             for (const id of binIds) {
                 let originalParent = await DB.getDeletedMeta(id);
                 if (!originalParent) originalParent = "";
                 await API.moveItems([id], originalParent);
                 await DB.removeDeletedMeta(id);
             }
             updateNotification(notifId, 'Semua item dikembalikan', 'success');
             if (currentFolderId === recycleBinId) loadFolder(recycleBinId);
         } catch(e) { updateNotification(notifId, 'Gagal restore all', 'error'); }
         finally { setIsProcessingAction(false); } // END PROTECTION
    }

    else if (action === 'duplicate') {
        if (ids.length === 0) return;
        setIsProcessingAction(true); // START PROTECTION
        const notifId = addNotification(`Menduplikasi ${ids.length} item...`, 'loading');
        try {
            await API.duplicateItems(ids);
            updateNotification(notifId, 'Berhasil diduplikasi', 'success');
            loadFolder(currentFolderId);
        } catch(e) { updateNotification(notifId, 'Gagal duplikasi', 'error'); }
        finally { setIsProcessingAction(false); } // END PROTECTION
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
                 setIsProcessingAction(true); // START PROTECTION
                 const notifId = addNotification('Memindahkan item...', 'loading');
                 try {
                     await API.moveItems(ids, targetId);
                     updateNotification(notifId, 'Berhasil dipindahkan', 'success');
                     loadFolder(currentFolderId);
                 } catch(e) { updateNotification(notifId, 'Gagal memindahkan', 'error'); }
                 finally { setIsProcessingAction(false); } // END PROTECTION
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
                    setIsProcessingAction(true); // START PROTECTION
                    const notifId = addNotification('Mengganti nama...', 'loading');
                    try {
                        await API.renameItem(targetItem.id, newName);
                        updateNotification(notifId, 'Nama berhasil diganti', 'success');
                        loadFolder(currentFolderId);
                    } catch(e) { updateNotification(notifId, 'Gagal ganti nama', 'error'); }
                    finally { setIsProcessingAction(false); } // END PROTECTION
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
                    setIsProcessingAction(true); // START PROTECTION
                    const notifId = addNotification('Membuat folder...', 'loading');
                    try {
                        await API.createFolder(currentFolderId, name);
                        updateNotification(notifId, 'Folder berhasil dibuat', 'success');
                        loadFolder(currentFolderId);
                    } catch(e) { updateNotification(notifId, 'Gagal buat folder', 'error'); }
                    finally { setIsProcessingAction(false); } // END PROTECTION
                }
            }
        });
    }
  };

  // --- UPLOAD LOGIC (SEQUENTIAL) ---
  const handleUploadFiles = async (files: File[]) => {
      const newUploads: UploadItem[] = files.map(f => ({
          id: Math.random().toString(36).substr(2, 9),
          file: f,
          status: 'uploading',
          progress: 5 
      }));

      setUploadQueue(prev => [...prev, ...newUploads]);

      for (const item of newUploads) {
          try {
              const progressInterval = setInterval(() => {
                  setUploadQueue(prev => prev.map(u => 
                      u.id === item.id && u.status === 'uploading' && u.progress < 90 
                      ? { ...u, progress: u.progress + 10 } 
                      : u
                  ));
              }, 300);

              await API.uploadToDrive(item.file, currentFolderId);
              
              clearInterval(progressInterval);
              setUploadQueue(prev => prev.map(u => 
                  u.id === item.id ? { ...u, status: 'success', progress: 100 } : u
              ));

          } catch (err) {
              console.error("Upload failed for:", item.file.name, err);
              setUploadQueue(prev => prev.map(u => 
                  u.id === item.id ? { ...u, status: 'error', progress: 0 } : u
              ));
          }
      }
      loadFolder(currentFolderId); 
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes("text/item-id")) {
        const movedItemId = e.dataTransfer.getData("text/item-id");
        let targetElement = e.target as HTMLElement;
        while(targetElement && !targetElement.getAttribute("data-folder-id")) {
            targetElement = targetElement.parentElement as HTMLElement;
            if (!targetElement || targetElement === e.currentTarget) break;
        }
        const targetFolderId = targetElement?.getAttribute("data-folder-id");
        if (movedItemId && targetFolderId && movedItemId !== targetFolderId) {
            const notifId = addNotification('Memindahkan via drag...', 'loading');
            setIsProcessingAction(true); // START PROTECTION
            try {
                await API.moveItems([movedItemId], targetFolderId);
                updateNotification(notifId, 'Berhasil dipindahkan', 'success');
                await loadFolder(currentFolderId);
            } catch(err) { updateNotification(notifId, 'Gagal pindah', 'error'); }
            finally { setIsProcessingAction(false); } // END PROTECTION
        }
        return;
    }

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  // --- NOTE HANDLING ---
  const handleOpenNote = async (item: Item) => {
      setIsGlobalLoading(true);
      setGlobalLoadingMessage("Membuka catatan...");
      try {
          if (item.content) {
              setEditingNote({ id: item.id, galleryId: currentFolderId, title: item.name.replace('.txt', ''), content: item.content, timestamp: item.lastUpdated });
          } else {
              const content = await API.getFileContent(item.id);
              const updatedItem = { ...item, content };
              await DB.updateItemInCache(currentFolderId, updatedItem);
              if (currentFolderId === activeFolderIdRef.current) setItems(prev => prev.map(i => i.id === item.id ? updatedItem : i));
              setEditingNote({ id: item.id, galleryId: currentFolderId, title: item.name.replace('.txt', ''), content: content, timestamp: item.lastUpdated });
          }
      } catch(e) { 
          addNotification('Gagal buka catatan', 'error'); 
      } finally {
          setIsGlobalLoading(false);
      }
  };

  const handleCreateNote = () => {
      setEditingNote({ id: 'temp-' + Date.now(), galleryId: currentFolderId, title: 'Catatan Baru', content: '', timestamp: Date.now() });
      setIsNewDropdownOpen(false);
      setContextMenu(null);
  };

  const handleSaveNote = async (id: string, title: string, content: string) => {
      setIsGlobalLoading(true);
      setGlobalLoadingMessage("Menyimpan catatan...");
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
          addNotification('Catatan tersimpan', 'success');
      } catch(e) { 
          addNotification('Gagal simpan', 'error'); 
      } finally {
          setIsGlobalLoading(false);
      }
  };

  const handleBreadcrumbClick = (index: number) => {
     if (index === -1) { setFolderHistory([]); setCurrentFolderId(""); } 
     else { const target = folderHistory[index]; setFolderHistory(prev => prev.slice(0, index + 1)); setCurrentFolderId(target.id); }
  };

  // REMOVED FILTER: Now we show the Recycle Bin folder (but check ID for icon)
  const filteredItems = items; 

  const groupedItems = {
      folders: filteredItems.filter(i => i.type === 'folder'),
      notes: filteredItems.filter(i => i.type === 'note'),
      images: filteredItems.filter(i => i.type === 'image')
  };

  return (
    <div 
      className="min-h-screen bg-slate-950 text-slate-200 relative select-none touch-pan-y"
      ref={containerRef}
      onContextMenu={(e) => handleContextMenu(e)} 
      onDragOver={(e) => { 
          e.preventDefault(); 
          e.stopPropagation(); 
          if (e.dataTransfer && !e.dataTransfer.types.includes("text/item-id")) {
            setIsDraggingFile(true); 
          }
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
      onMouseDown={startDragSelection}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      
      {/* SELECTION BOX */}
      {selectionBox && (
          <div className="fixed z-50 bg-blue-500/20 border border-blue-400 pointer-events-none"
             style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />
      )}

      {/* BLOCKING LOADING OVERLAY */}
      {isGlobalLoading && (
          <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center cursor-wait">
              <Loader2 size={48} className="animate-spin text-blue-500 mb-4"/>
              <p className="text-white font-semibold text-lg animate-pulse">{globalLoadingMessage}</p>
          </div>
      )}
      
      {/* FLOATING SELECTION MENU */}
      <SelectionFloatingMenu 
         selectedIds={selectedIds} 
         items={items}
         onClear={() => setSelectedIds(new Set())}
         onAction={executeAction}
         containerRef={containerRef}
         isInRecycleBin={currentFolderId === recycleBinId}
         recycleBinId={recycleBinId}
      />

      {/* UPLOAD PROGRESS WIDGET */}
      <UploadProgress 
        uploads={uploadQueue} 
        onClose={() => setUploadQueue([])} 
        onRemove={(id) => setUploadQueue(prev => prev.filter(u => u.id !== id))} 
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

        {/* Hide 'New' button in Recycle Bin */}
        {currentFolderId !== recycleBinId && (
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
                                    handleUploadFiles(Array.from(e.target.files));
                                }
                            }} />
                        </label>
                    </div>
                )}
            </div>
        </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="p-4 md:p-6 pb-20 space-y-8">
        {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                <Loader2 size={32} className="animate-spin text-blue-500"/>
                <p className="text-sm">Memuat isi folder...</p>
            </div>
        ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl">
                <Folder size={64} className="mb-4 opacity-20" />
                <p className="font-medium">{currentFolderId === recycleBinId ? "Recycle Bin Kosong" : "Folder Kosong"}</p>
                {currentFolderId !== recycleBinId && <p className="text-xs mt-1 text-slate-500">Klik kanan untuk opsi baru</p>}
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
                                <FolderItem key={item.id} item={item} isRecycleBin={item.id === recycleBinId} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} onToggleSelect={() => handleItemClick({ stopPropagation: () => {}, ctrlKey: true } as any, item)} />
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

      {/* RECYCLE BIN FLOATING BUTTON (Keep it for quick access) */}
      {currentFolderId !== recycleBinId && (
          <div 
             className="fixed bottom-6 left-6 z-[250] group"
             onContextMenu={(e) => { 
                 e.preventDefault(); 
                 e.stopPropagation();
                 setContextMenu({ x: e.pageX, y: e.pageY, isRecycleBinBtn: true });
             }}
          >
              <button 
                  onClick={() => {
                      if (recycleBinId) {
                           setFolderHistory(prev => [...prev, { id: recycleBinId, name: RECYCLE_BIN_NAME }]);
                           setCurrentFolderId(recycleBinId);
                      } else {
                           // Try to find/create it then go
                           getOrCreateRecycleBin().then(id => {
                               setFolderHistory(prev => [...prev, { id: id, name: RECYCLE_BIN_NAME }]);
                               setCurrentFolderId(id);
                           });
                      }
                  }}
                  className="bg-slate-800 border border-slate-700 p-3 rounded-full shadow-2xl hover:bg-slate-700 hover:border-slate-500 transition-all active:scale-95 flex items-center justify-center relative overflow-hidden"
              >
                  <Trash2 size={24} className="text-slate-400 group-hover:text-red-400 transition-colors" />
                  <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
              </button>
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  Recycle Bin
              </div>
          </div>
      )}

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
            
            {/* RECYCLE BIN BUTTON CONTEXT MENU */}
            {contextMenu.isRecycleBinBtn ? (
                <>
                <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/50 mb-1">Recycle Bin Options</div>
                <button onClick={() => executeAction('empty_bin')} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 text-sm transition-colors"><Trash2 size={16}/> Empty Recycle Bin</button>
                <button onClick={() => executeAction('restore_all')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><RotateCcw size={16} className="text-green-400"/> Restore All Items</button>
                </>
            ) : contextMenu.targetItem ? (
                <>
                <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/50 mb-1 truncate max-w-[200px]">{contextMenu.targetItem.name}</div>
                
                {/* CHECK IF TARGET IS RECYCLE BIN FOLDER ITSELF */}
                {contextMenu.targetItem.id === recycleBinId ? (
                     <div className="px-3 py-2 text-xs text-slate-500 italic">System Folder (Protected)</div>
                ) : (
                    /* RECYCLE BIN ITEM CONTEXT MENU */
                    currentFolderId === recycleBinId ? (
                         <>
                         <button onClick={() => executeAction('restore')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><RotateCcw size={16} className="text-green-400"/> Restore</button>
                         <button onClick={() => executeAction('delete_permanent')} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 text-sm transition-colors"><Ban size={16}/> Delete Permanently</button>
                         </>
                    ) : (
                        // NORMAL ITEM CONTEXT MENU
                        <>
                        <button onClick={() => executeAction('rename')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Edit size={16} className="text-slate-400"/> Rename</button>
                        <button onClick={() => executeAction('duplicate')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Copy size={16} className="text-slate-400"/> Copy</button>
                        <button onClick={() => executeAction('move')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Move size={16} className="text-slate-400"/> Move</button>
                        {contextMenu.targetItem.type !== 'folder' && (
                            <>
                            <button onClick={() => executeAction('download')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Download size={16} className="text-slate-400"/> Download</button>
                            {contextMenu.targetItem.type === 'image' && (
                                <button onClick={() => executeAction('copy_image')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Image size={16} className="text-slate-400"/> Copy Image</button>
                            )}
                            </>
                        )}
                        <div className="h-px bg-slate-700 my-1"/>
                        <button onClick={() => executeAction('delete')} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 text-sm transition-colors"><Trash2 size={16}/> Delete</button>
                        </>
                    )
                )}
                </>
            ) : (
                // NORMAL BACKGROUND CONTEXT MENU (New Folder, etc)
                // If in recycle bin, restrict options
                currentFolderId === recycleBinId ? (
                     <>
                     <button onClick={() => executeAction('empty_bin')} className="w-full text-left px-3 py-2.5 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 text-sm transition-colors"><Trash2 size={16}/> Empty Recycle Bin</button>
                     <button onClick={() => executeAction('restore_all')} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><RotateCcw size={16} className="text-green-400"/> Restore All Items</button>
                     <div className="h-px bg-slate-700 my-1"/>
                     <button onClick={() => { setContextMenu(null); loadFolder(currentFolderId); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Loader2 size={16} className="text-slate-400"/> Refresh</button>
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
                                handleUploadFiles(Array.from(e.target.files));
                            }
                        }} />
                    </label>
                    <div className="h-px bg-slate-700 my-1"/>
                    <button onClick={() => { setContextMenu(null); loadFolder(currentFolderId); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Loader2 size={16} className="text-slate-400"/> Refresh</button>
                    </>
                )
            )}
            </div>
        </>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewImage(null)}>
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                 <button onClick={(e) => { e.stopPropagation(); handleCopyImage(previewImage); }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white" title="Copy Image">
                    <Image size={24}/>
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); handleDownload(previewImage); }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white" title="Download">
                    <Download size={24}/>
                 </button>
                 <button onClick={() => setPreviewImage(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white">
                    <X size={24}/>
                 </button>
            </div>
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
const SelectionFloatingMenu = ({ selectedIds, items, onClear, onAction, containerRef, isInRecycleBin, recycleBinId }: { selectedIds: Set<string>, items: Item[], onClear: () => void, onAction: (a: string) => void, containerRef: React.RefObject<HTMLDivElement>, isInRecycleBin: boolean, recycleBinId: string }) => {
    const [pos, setPos] = useState<{top?: number, left?: number, bottom?: number, x?:number}>({ bottom: 24, left: window.innerWidth / 2 }); 
    const [styleType, setStyleType] = useState<'contextual' | 'dock'>('dock');
    const menuRef = useRef<HTMLDivElement>(null);
    
    // Check if Recycle Bin folder is selected in Home View
    const isRecycleBinFolderSelected = !isInRecycleBin && Array.from(selectedIds).some(id => id === recycleBinId);

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

            const viewMinY = Math.min(...rects.map(r => r.top));
            const viewMaxY = Math.max(...rects.map(r => r.bottom));
            const viewMinX = Math.min(...rects.map(r => r.left));
            const viewMaxX = Math.max(...rects.map(r => r.right));
            
            const centerX = viewMinX + (viewMaxX - viewMinX) / 2;
            const viewportHeight = window.innerHeight;
            const selectionHeight = viewMaxY - viewMinY;

            if (selectedIds.size > 8 || selectionHeight > (viewportHeight * 0.4)) {
                setStyleType('dock');
                setPos({ bottom: 32, left: window.innerWidth / 2 });
                return;
            }

            const headerHeight = 80;
            const menuHeight = menuRef.current ? menuRef.current.offsetHeight : 60;
            const gap = 12;

            let targetTop;
            if (viewMinY > (headerHeight + menuHeight + gap)) {
                targetTop = window.scrollY + viewMinY - menuHeight - gap;
            } else {
                targetTop = window.scrollY + viewMaxY + gap;
            }

            let finalLeft = centerX;
            if (menuRef.current) {
                const menuWidth = menuRef.current.offsetWidth;
                const screenWidth = window.innerWidth;
                const padding = 16;
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
        window.addEventListener('resize', updatePosition);
        return () => window.removeEventListener('resize', updatePosition);

    }, [selectedIds, items]);

    if (selectedIds.size === 0) return null;

    const dockStyle = "fixed z-50 transform -translate-x-1/2 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-blue-500/50 p-2 rounded-2xl shadow-2xl shadow-blue-500/10 animate-in zoom-in-95 slide-in-from-bottom-5 duration-200 transition-all max-w-[95vw] overflow-x-auto";
    const contextStyle = "absolute z-50 transform -translate-x-1/2 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-blue-500/50 p-1.5 rounded-full shadow-2xl shadow-blue-500/20 animate-in fade-in zoom-in-95 duration-150 transition-all duration-300 ease-out max-w-[95vw] overflow-x-auto";
    const isContext = styleType === 'contextual';

    return (
        <div 
            ref={menuRef}
            className={isContext ? contextStyle : dockStyle}
            style={{ 
                top: isContext ? pos.top : undefined, 
                left: isContext ? pos.left : '50%', 
                bottom: isContext ? undefined : pos.bottom 
            }}
        >
            <div className={`flex items-center gap-2 ${isContext ? 'px-2' : 'px-3 border-r border-white/10 mr-1'}`}>
                <span className="font-bold text-sm text-blue-100">{selectedIds.size}</span>
                <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={14} /></button>
            </div>
            
            {/* If Recycle Bin folder itself is selected, show minimal options */}
            {isRecycleBinFolderSelected ? (
                <span className="px-2 text-xs text-slate-400 font-medium">System Folder</span>
            ) : isInRecycleBin ? (
                <>
                <button onClick={(e) => { e.stopPropagation(); onAction('restore'); }} className="p-2 hover:bg-green-500/20 hover:text-green-400 rounded-lg transition-colors tooltip" title="Restore"><RotateCcw size={18}/></button>
                <div className="w-px h-6 bg-white/10 mx-1"></div>
                <button onClick={(e) => { e.stopPropagation(); onAction('delete_permanent'); }} className="p-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors tooltip" title="Delete Permanently"><Ban size={18}/></button>
                </>
            ) : (
                <>
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
                </>
            )}
        </div>
    );
};

// --- SUB COMPONENTS FOR GRID ITEMS ---

const ItemOverlay = ({ status }: { status?: string }) => {
    if (!status || status === 'idle') return null;
    return (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center rounded-xl animate-in fade-in">
            <Loader2 size={24} className="text-blue-400 animate-spin mb-1" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                {status === 'deleting' ? 'Deleting...' : 'Restoring...'}
            </span>
        </div>
    );
};

const FolderItem = ({ item, selected, onClick, onDoubleClick, onContextMenu, onToggleSelect, isRecycleBin }: any) => (
    <div id={`item-${item.id}`} data-folder-id={item.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/item-id", item.id)} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }} className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-2 item-clickable ${selected ? 'bg-blue-500/20 border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-600'}`}>
        <ItemOverlay status={item.status} />
        <div className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <CheckSquare size={18} className={selected ? "text-blue-500 bg-slate-900 rounded" : "text-slate-500 hover:text-slate-300"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/>
        </div>
        {/* Render Trash Icon if Recycle Bin */}
        {isRecycleBin ? (
             <Trash2 size={48} className="text-red-500 fill-red-500/10 drop-shadow-md" />
        ) : (
             <Folder size={48} className="text-blue-500 fill-blue-500/10 drop-shadow-md" />
        )}
        <span className={`text-xs font-medium text-center truncate w-full px-1 select-none ${isRecycleBin ? 'text-red-400' : 'text-slate-200'}`}>{item.name}</span>
    </div>
);

const NoteItem = ({ item, selected, onClick, onDoubleClick, onContextMenu, onToggleSelect }: any) => (
    <div id={`item-${item.id}`} draggable onDragStart={(e) => e.dataTransfer.setData("text/item-id", item.id)} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }} className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-2 item-clickable ${selected ? 'bg-blue-500/20 border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-600'}`}>
        <ItemOverlay status={item.status} />
        <div className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <CheckSquare size={18} className={selected ? "text-blue-500 bg-slate-900 rounded" : "text-slate-500 hover:text-slate-300"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/>
        </div>
        <FileText size={48} className="text-yellow-500 fill-yellow-500/10 drop-shadow-md" />
        <span className="text-xs font-medium text-slate-200 text-center truncate w-full px-1 select-none" title={item.name}>{item.name.replace('.txt', '')}</span>
    </div>
);

const ImageItem = ({ item, selected, onClick, onDoubleClick, onContextMenu, onToggleSelect }: any) => (
    <div id={`item-${item.id}`} draggable onDragStart={(e) => e.dataTransfer.setData("text/item-id", item.id)} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }} className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden aspect-square flex flex-col items-center justify-center bg-slate-950 item-clickable ${selected ? 'border-blue-500 shadow-md ring-1 ring-blue-500' : 'border-slate-800 hover:border-slate-600'}`}>
        <ItemOverlay status={item.status} />
        <div className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <CheckSquare size={18} className={selected ? "text-blue-500 bg-slate-900 rounded" : "text-slate-500 hover:text-slate-300 shadow-sm"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/>
        </div>
        {item.thumbnail || item.url ? (
             <img src={item.thumbnail || item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
             <ImageIcon size={32} className="text-slate-600" />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-1.5 truncate">
             <span className="text-[10px] font-medium text-slate-200 block text-center truncate select-none">{item.name}</span>
        </div>
    </div>
);

export default App;

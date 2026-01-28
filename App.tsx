
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, MoreVertical, 
  ArrowLeft, Plus, Trash2, Copy, Move, Edit, CheckSquare, 
  Loader2, Home, Upload, ChevronRight, X, AlertCircle, Download, CornerUpLeft,
  CheckCircle, XCircle, Image, RotateCcw, Ban, GripVertical, Database, Lock, ShieldAlert, Cloud, CloudUpload, FileJson, RefreshCw,
  CheckCheck, MessageSquare, Reply, Send, User, Clock
} from 'lucide-react';
import * as API from './services/api';
import * as DB from './services/db';
// Fix: Import custom ModalState and AppNotification from types.ts
import { Item, StoredNote, DownloadItem, FolderMap, SystemDB, Comment, CommentDB, ModalState, AppNotification } from './types';
import { TextEditor } from './components/TextEditor';
import { UploadProgress, UploadItem } from './components/UploadProgress';
import { DownloadProgress } from './components/DownloadProgress';

// --- HELPERS ---
const stripHtml = (html: string) => {
  if (!html) return "";
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

const RECYCLE_BIN_NAME = "Recycle Bin";
const SYSTEM_FOLDER_NAME = "System";
const SYSTEM_PASSWORD = "1509";
const DB_FILENAME_BASE = "system_zombio_db"; 

const App = () => {
  const [currentFolderId, setCurrentFolderId] = useState<string>(""); 
  const [parentFolderId, setParentFolderId] = useState<string>(""); 
  const [recycleBinId, setRecycleBinId] = useState<string>(""); 
  const [folderHistory, setFolderHistory] = useState<{id:string, name:string}[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false); 
  const [systemMap, setSystemMap] = useState<FolderMap>({});
  const systemMapRef = useRef<FolderMap>({}); 
  const [dbFileId, setDbFileId] = useState<string | null>(null);
  const [commentFileId, setCommentFileId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentDB>({});
  const commentsRef = useRef<CommentDB>({});
  const [systemFolderId, setSystemFolderId] = useState<string | null>(null);
  const [isSystemInitialized, setIsSystemInitialized] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false); 
  const [isSavingDB, setIsSavingDB] = useState(false);
  const [isSavingComments, setIsSavingComments] = useState(false);
  const saveTimeoutRef = useRef<any>(null);
  const commentSaveTimeoutRef = useRef<any>(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(true); 
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState("Memulai Sistem...");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null); 
  const [contextMenu, setContextMenu] = useState<{x:number, y:number, targetItem?: Item, isRecycleBinBtn?: boolean} | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false); 
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
  // Fix: Use AppNotification instead of the built-in Notification type to avoid property missing errors
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{x:number, y:number, width:number, height:number} | null>(null);
  const [customDragItem, setCustomDragItem] = useState<Item | null>(null);
  const [customDragPos, setCustomDragPos] = useState<{x:number, y:number} | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{x:number, y:number} | null>(null);
  const isPaintingRef = useRef<boolean>(false); 
  const longPressTimerRef = useRef<any>(null);
  const activeFolderIdRef = useRef<string>(currentFolderId);
  // Fix: ModalState is now defined and imported from types.ts
  const [modal, setModal] = useState<ModalState | null>(null);
  const [editingNote, setEditingNote] = useState<StoredNote | null>(null);
  const [viewingRawFile, setViewingRawFile] = useState<{title: string, content: string} | null>(null); 
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Comment input state
  const [commentName, setCommentName] = useState(localStorage.getItem('zombio_comment_name') || '');
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => { activeFolderIdRef.current = currentFolderId; }, [currentFolderId]);

  useEffect(() => {
    if (previewImage) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [previewImage]);

  // --- DATABASE SYNC LOGIC ---

  const triggerCloudSync = useCallback(() => {
      if (!dbFileId) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setIsSavingDB(true);
      // Faster sync for realtime feel
      saveTimeoutRef.current = setTimeout(async () => {
          try {
              await API.updateSystemDBFile(dbFileId, systemMapRef.current);
              setIsSavingDB(false);
              await DB.saveSystemMap({ fileId: dbFileId, map: systemMapRef.current, lastSync: Date.now() });
          } catch (e) { setIsSavingDB(false); }
      }, 1500); 
  }, [dbFileId]);

  const triggerCommentSync = useCallback(() => {
    if (!commentFileId) return;
    if (commentSaveTimeoutRef.current) clearTimeout(commentSaveTimeoutRef.current);
    setIsSavingComments(true);
    commentSaveTimeoutRef.current = setTimeout(async () => {
        try {
            await API.updateCommentDBFile(commentFileId, commentsRef.current);
            setIsSavingComments(false);
            await DB.saveCommentsCache(commentsRef.current);
        } catch (e) { setIsSavingComments(false); }
    }, 1500);
  }, [commentFileId]);

  const updateMap = useCallback((action: 'add' | 'remove' | 'update' | 'move', updateItems: {id: string, name?: string, parentId?: string}[]) => {
      const nextMap = { ...systemMapRef.current };
      let changed = false;

      updateItems.forEach(item => {
          if (action === 'add' || action === 'update') {
              const existing = nextMap[item.id];
              const newParentId = item.parentId !== undefined ? item.parentId : (existing?.parentId || "root");
              const newName = item.name || existing?.name;
              
              if (newName && (existing?.name !== newName || existing?.parentId !== newParentId)) {
                  nextMap[item.id] = { id: item.id, name: newName, parentId: newParentId };
                  changed = true;
              }
          } else if (action === 'remove') {
              if (nextMap[item.id]) {
                  delete nextMap[item.id];
                  changed = true;
              }
          } else if (action === 'move') {
              if (nextMap[item.id] && item.parentId !== undefined && nextMap[item.id].parentId !== item.parentId) {
                  nextMap[item.id] = { ...nextMap[item.id], parentId: item.parentId };
                  changed = true;
              }
          }
      });

      if (changed) {
          systemMapRef.current = nextMap;
          setSystemMap(nextMap);
          DB.saveSystemMap({ fileId: dbFileId!, map: nextMap, lastSync: Date.now() });
          triggerCloudSync();
      }
  }, [dbFileId, triggerCloudSync]);

  // --- INITIALIZATION ---

  useEffect(() => {
    const initSystem = async () => {
       try {
           setIsGlobalLoading(true);
           setGlobalLoadingMessage("Sinkronisasi Cloud...");
           
           // 1. Cari file eksis di Drive (Mencegah duplikasi antar device)
           const cloudLocation = await API.locateSystemDB();
           let sysFolderId = cloudLocation.systemFolderId;
           let currentDbFileId = cloudLocation.fileId; 
           let currentCommentFileId = cloudLocation.commentFileId;

           let finalMap: FolderMap = { "root": { id: "root", name: "Home", parentId: "" } };
           let finalComments: CommentDB = {};

           if (!sysFolderId) {
               setGlobalLoadingMessage("Membuat Folder System...");
               sysFolderId = await API.createSystemFolder();
           }
           setSystemFolderId(sysFolderId);

           // 2. Load atau Buat Database File
           if (currentDbFileId) {
               setGlobalLoadingMessage("Mengunduh Database...");
               try {
                   const content = await API.getFileContent(currentDbFileId);
                   finalMap = JSON.parse(content);
               } catch(e) { console.error("DB Parse Error", e); }
           } else {
               setGlobalLoadingMessage("Inisialisasi Database...");
               currentDbFileId = await API.createSystemDBFile(finalMap, sysFolderId);
           }

           // 3. Load atau Buat Comment File
           if (currentCommentFileId) {
               try {
                   const content = await API.getFileContent(currentCommentFileId);
                   finalComments = JSON.parse(content);
               } catch(e) {}
           } else {
               currentCommentFileId = await API.createCommentDBFile(finalComments, sysFolderId);
           }

           // 4. Update State & Cache
           systemMapRef.current = finalMap;
           setSystemMap(finalMap);
           setDbFileId(currentDbFileId);
           setCommentFileId(currentCommentFileId);
           setComments(finalComments);
           commentsRef.current = finalComments;

           await DB.saveSystemMap({ fileId: currentDbFileId, map: finalMap, lastSync: Date.now() });
           await DB.saveCommentsCache(finalComments);

           setIsSystemInitialized(true);
           
           // 5. Resolusi Deep Link (Hash) berdasarkan database yang baru diunduh
           const hash = window.location.hash.replace(/^#/, ''); 
           if (hash && hash !== '/' && hash !== '') {
               setGlobalLoadingMessage("Membuka Folder...");
               const pathSegments = hash.split('/').filter(p => p);
               let currentParentId = "root";
               let lastFoundId = "";
               const traceHistory: {id:string, name:string}[] = [];

               for (const segment of pathSegments) {
                   const decodedName = decodeURIComponent(segment);
                   const foundId = Object.keys(finalMap).find(key => {
                       const node = finalMap[key];
                       return node.name === decodedName && (node.parentId === currentParentId || (currentParentId === "root" && node.parentId === ""));
                   });

                   if (foundId) {
                       currentParentId = foundId;
                       lastFoundId = foundId;
                       traceHistory.push({ id: foundId, name: decodedName });
                   } else {
                       // Jika path terputus, kita berhenti di folder terakhir yang diketahui
                       break;
                   }
               }

               if (lastFoundId) {
                   setFolderHistory(traceHistory);
                   setCurrentFolderId(lastFoundId);
               }
           }
       } catch (err) { 
           console.error("Critical Init Error:", err);
           setIsNotFound(true); 
       } finally { 
           setIsGlobalLoading(false); 
       }
    };
    initSystem();
  }, []);

  // Sync Hash to URL
  useEffect(() => {
    if (!isSystemInitialized || isNotFound) return;
    const pathSegments = folderHistory.map(f => encodeURIComponent(f.name));
    const newHash = pathSegments.length > 0 ? '/' + pathSegments.join('/') : '';
    if (window.location.hash !== `#${newHash}`) { 
        window.history.replaceState(null, '', `#${newHash}`); 
    }
  }, [currentFolderId, folderHistory, isSystemInitialized, isNotFound]);

  // --- NOTIFICATIONS ---

  // Fix: Modified to use AppNotification and handle prev state correctly with custom type
  const addNotification = (message: string, type: 'loading' | 'success' | 'error' = 'success', duration = 3000) => {
    const id = Date.now().toString() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
    if (type !== 'loading') { setTimeout(() => { setNotifications(prev => prev.filter(n => n.id !== id)); }, duration); }
    return id;
  };

  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  // Fix: Updated to use AppNotification type for map function
  const updateNotification = (id: string, message: string, type: 'success' | 'error') => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, message, type } : n));
    setTimeout(() => { setNotifications(prev => prev.filter(n => n.id !== id)); }, 3000);
  };

  // --- CORE ACTIONS ---

  const loadFolder = useCallback(async (folderId: string = "") => {
    setItems([]); setSelectedIds(new Set()); setLastSelectedId(null);
    let cachedItems: Item[] | null = null;
    try { if (folderId === activeFolderIdRef.current) cachedItems = await DB.getCachedFolder(folderId); } catch (e) {}
    
    if (folderId !== activeFolderIdRef.current) return;
    if (cachedItems !== null) setItems(cachedItems); else setLoading(true);

    try {
      const res = await API.getFolderContents(folderId);
      if (folderId !== activeFolderIdRef.current) return;
      setLoading(false);

      if (res.status === 'success') {
        const freshItems: Item[] = (Array.isArray(res.data) ? res.data : []);
        setParentFolderId(res.parentFolderId || ""); 
        freshItems.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        
        if (folderId === "") {
            const bin = freshItems.find(i => i.name === RECYCLE_BIN_NAME && i.type === 'folder');
            if (bin) setRecycleBinId(bin.id);
        }

        // --- DISCOVERY: Auto-update map for all folders found in this view ---
        const discoveredFolders = freshItems.filter(i => i.type === 'folder');
        if (discoveredFolders.length > 0) {
            updateMap('add', discoveredFolders.map(f => ({ 
                id: f.id, 
                name: f.name, 
                parentId: folderId || "root" 
            })));
        }

        setItems(freshItems);
        await DB.cacheFolderContents(folderId, freshItems);
      }
    } catch (e) { if (folderId === activeFolderIdRef.current) setLoading(false); }
  }, [updateMap]);

  useEffect(() => { if (isSystemInitialized && !isNotFound) loadFolder(currentFolderId); }, [currentFolderId, loadFolder, isSystemInitialized, isNotFound]);

  const getOrCreateRecycleBin = async (): Promise<string> => {
      if (recycleBinId) return recycleBinId;
      const res = await API.getFolderContents("");
      const rootItems: Item[] = Array.isArray(res.data) ? res.data : [];
      const existingBin = rootItems.find(i => i.name === RECYCLE_BIN_NAME && i.type === 'folder');
      if (existingBin) { setRecycleBinId(existingBin.id); return existingBin.id; }
      const createRes = await API.createFolder("", RECYCLE_BIN_NAME);
      if (createRes.status === 'success' && createRes.data) { setRecycleBinId(createRes.data.id); return createRes.data.id; }
      throw new Error("Could not create Recycle Bin");
  };

  // --- UI EVENT HANDLERS ---

  const handlePointerDown = (e: React.PointerEvent) => {
     if ((e.target as HTMLElement).closest('button, .item-handle, .floating-ui, select, input, .comment-area')) return;
     if (!e.isPrimary) return;
     const target = e.target as HTMLElement;
     const checkbox = target.closest('.selection-checkbox');
     const itemRow = target.closest('[data-item-id]');
     dragStartPos.current = { x: e.clientX, y: e.clientY };
     if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
     
     if (checkbox && itemRow) {
         e.stopPropagation();
         const id = itemRow.getAttribute('data-item-id');
         if(id) { handleToggleSelect(id); isPaintingRef.current = true; }
         containerRef.current?.setPointerCapture(e.pointerId); setIsDragSelecting(true);
     } else if (itemRow) {
         const id = itemRow.getAttribute('data-item-id');
         if (id) {
             const clickedItem = items.find(i => i.id === id);
             if (clickedItem) {
                 longPressTimerRef.current = setTimeout(() => {
                     if (clickedItem.id === systemFolderId || currentFolderId === systemFolderId) return;
                     setCustomDragItem(clickedItem); setCustomDragPos({ x: e.clientX, y: e.clientY });
                     if (!selectedIds.has(clickedItem.id)) setSelectedIds(new Set([clickedItem.id]));
                     if (navigator.vibrate) navigator.vibrate(50);
                 }, 500); 
             }
         }
         isPaintingRef.current = false; 
     } else {
         isPaintingRef.current = false; setSelectionBox({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
         setIsDragSelecting(true); if (!e.ctrlKey && !e.shiftKey) setSelectedIds(new Set());
         containerRef.current?.setPointerCapture(e.pointerId);
     }
     setContextMenu(null); setIsNewDropdownOpen(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
     if (!dragStartPos.current) return;
     if (customDragItem) {
         setCustomDragPos({ x: e.clientX, y: e.clientY });
         const elements = document.elementsFromPoint(e.clientX, e.clientY);
         const folderEl = elements.find(el => {
             const row = el.closest('[data-folder-id]');
             const id = row?.getAttribute('data-folder-id');
             return id && id !== customDragItem.id && !selectedIds.has(id);
         })?.closest('[data-folder-id]');
         setDropTargetId(folderEl ? folderEl.getAttribute('data-folder-id') : null);
         return;
     }
     const moveDist = Math.sqrt(Math.pow(e.clientX - dragStartPos.current.x, 2) + Math.pow(e.clientY - dragStartPos.current.y, 2));
     if (moveDist > 8) {
         if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
         if (!isDragSelecting) { setIsDragSelecting(true); containerRef.current?.setPointerCapture(e.pointerId); }
         const currentX = e.clientX; const currentY = e.clientY;
         const x = Math.min(dragStartPos.current.x, currentX); const y = Math.min(dragStartPos.current.y, currentY);
         const width = Math.abs(currentX - dragStartPos.current.x); const height = Math.abs(currentY - dragStartPos.current.y);
         setSelectionBox({ x, y, width, height });
         const newSelected = new Set(selectedIds);
         items.forEach(item => {
            const el = document.getElementById(`item-${item.id}`);
            if (el) {
                const rect = el.getBoundingClientRect();
                if (x < rect.right && x + width > rect.left && y < rect.bottom && y + height > rect.top) {
                    newSelected.add(item.id);
                }
            }
         });
         setSelectedIds(newSelected);
     }
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
      const currentDrag = customDragItem;
      const targetId = dropTargetId;

      setCustomDragItem(null); setCustomDragPos(null); setDropTargetId(null);
      setIsDragSelecting(false); setSelectionBox(null); dragStartPos.current = null;
      isPaintingRef.current = false;
      if (containerRef.current) { try { containerRef.current.releasePointerCapture(e.pointerId); } catch(err) {} }

      if (currentDrag && targetId) {
          if (targetId === systemFolderId) { addNotification("Tidak bisa memindahkan ke Folder System", "error"); } 
          else {
              const idsToMove = selectedIds.size > 0 ? Array.from(selectedIds) : [currentDrag.id];
              const targetName = items.find(i => i.id === targetId)?.name || "Folder";
              const backupItems = [...items];
              setItems(prev => prev.map(item => idsToMove.includes(item.id) ? { ...item, status: 'moving' } : item));
              const notifId = addNotification(`Memindahkan ke ${targetName}...`, 'loading');
              try {
                  const finalTargetId = targetId === "" ? "root" : targetId;
                  await API.moveItems(idsToMove, finalTargetId);
                  updateMap('move', items.filter(i => idsToMove.includes(i.id) && i.type === 'folder').map(f => ({ id: f.id, parentId: finalTargetId })));
                  updateNotification(notifId, 'Berhasil dipindahkan', 'success');
                  await loadFolder(currentFolderId);
              } catch(err) { updateNotification(notifId, 'Gagal pindah', 'error'); setItems(backupItems); } 
          }
      }
  };

  const handleToggleSelect = (id: string) => {
      setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
      setLastSelectedId(id);
  };

  const handleSelectAllByCategory = () => {
    if (selectedIds.size === 0) return;
    const selectedItems = items.filter(i => selectedIds.has(i.id));
    const types = new Set(selectedItems.map(i => i.type));
    const matches = items.filter(i => types.has(i.type));
    const newSet = new Set(matches.map(i => i.id));
    setSelectedIds(newSet);
  };

  const handleItemClick = (e: React.MouseEvent, item: Item) => {
    if (isPaintingRef.current || customDragItem) return;
    if (e.shiftKey && lastSelectedId) {
        const lastIndex = items.findIndex(i => i.id === lastSelectedId);
        const currentIndex = items.findIndex(i => i.id === item.id);
        if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex); const end = Math.max(lastIndex, currentIndex);
            const rangeIds = items.slice(start, end + 1).map(i => i.id);
            const newSet = new Set(selectedIds); rangeIds.forEach(itemId => newSet.add(itemId)); setSelectedIds(newSet);
        }
    } else if (e.ctrlKey || e.metaKey) { handleToggleSelect(item.id); } 
    else { setSelectedIds(new Set([item.id])); setLastSelectedId(item.id); }
  };

  const handleItemDoubleClick = async (e: React.MouseEvent, item: Item) => {
    e.stopPropagation();
    if (item.type === 'folder') {
        if (item.id === systemFolderId || item.name === SYSTEM_FOLDER_NAME) {
            setModal({
                type: 'input', title: 'Folder Terkunci', message: 'Masukkan Password', confirmText: 'Buka', inputValue: '',
                onConfirm: (val) => {
                    if (val === SYSTEM_PASSWORD) { 
                        setModal(null); 
                        setFolderHistory(prev => [...prev, { id: item.id, name: item.name }]); 
                        setCurrentFolderId(item.id); 
                    } else { addNotification("Password Salah!", "error"); }
                }
            });
            return;
        }
        setFolderHistory(prev => [...prev, { id: item.id, name: item.name }]); 
        setCurrentFolderId(item.id);
    } else if (item.type === 'note') {
        if (item.name.includes(DB_FILENAME_BASE)) { 
            const notifId = addNotification('Membaca Database...', 'loading');
            try {
                const content = await API.getFileContent(item.id);
                let display = content;
                try { const json = JSON.parse(content || "{}"); display = JSON.stringify(json, null, 2); } catch(e) {}
                setViewingRawFile({ title: item.name, content: display || "" }); 
                removeNotification(notifId);
            } catch(e) { updateNotification(notifId, 'Gagal membuka', 'error'); }
        } else { handleOpenNote(item); }
    } else if (item.type === 'image') { setPreviewImage(item.url || null); }
  };

  const handleContextMenu = (e: React.MouseEvent | React.PointerEvent, item?: Item) => {
    e.preventDefault();
    const x = (e as any).pageX || (e as any).clientX;
    const y = (e as any).pageY || (e as any).clientY;
    
    if (item) { 
      if (!selectedIds.has(item.id)) { setSelectedIds(new Set([item.id])); setLastSelectedId(item.id); } 
      setContextMenu({ x, y, targetItem: item }); 
    } else { 
      setContextMenu({ x, y, isRecycleBinBtn: currentFolderId === recycleBinId });
    }
  };

  const handleAddComment = () => {
    if (!commentName.trim() || !commentText.trim() || !modal?.targetItem) return;
    localStorage.setItem('zombio_comment_name', commentName);
    const newComment: Comment = { id: Date.now().toString(), itemId: modal.targetItem.id, author: commentName, text: commentText, timestamp: Date.now(), parentId: replyingTo || undefined };
    const nextComments = { ...commentsRef.current };
    if (!nextComments[modal.targetItem.id]) nextComments[modal.targetItem.id] = [];
    nextComments[modal.targetItem.id].push(newComment);
    commentsRef.current = nextComments;
    setComments(nextComments);
    setCommentText(''); setReplyingTo(null);
    triggerCommentSync();
  };

  // --- FILE OPERATIONS ---

  const handleUploadFiles = async (files: File[]) => {
      if (files.length === 0) return;
      const newUploads: UploadItem[] = files.map(f => ({ id: Date.now().toString() + Math.random(), file: f, status: 'uploading', progress: 0 }));
      setUploadQueue(prev => [...prev, ...newUploads]);
      for (const uploadItem of newUploads) {
          try {
             const progressInterval = setInterval(() => {
                 setUploadQueue(prev => prev.map(u => u.id === uploadItem.id ? { ...u, progress: Math.min(u.progress + 10, 90) } : u));
             }, 300);
             await API.uploadToDrive(uploadItem.file, currentFolderId);
             clearInterval(progressInterval);
             setUploadQueue(prev => prev.map(u => u.id === uploadItem.id ? { ...u, status: 'success', progress: 100 } : u));
          } catch (e) { setUploadQueue(prev => prev.map(u => u.id === uploadItem.id ? { ...u, status: 'error' } : u)); }
      }
      loadFolder(currentFolderId);
  };

  const executeAction = async (action: string) => {
      if (!contextMenu && !['paste', 'new_folder', 'empty_bin', 'restore_all'].includes(action) && selectedIds.size === 0) return;
      const item = contextMenu?.targetItem;
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : (item ? [item.id] : []);
      setContextMenu(null);

      switch (action) {
          case 'comment':
            const target = items.find(i => i.id === ids[0]);
            if (target) setModal({ type: 'comment', title: `Komentar: ${target.name}`, targetItem: target });
            break;
          case 'new_folder':
              setModal({
                  type: 'input', title: 'Folder Baru', message: 'Masukkan nama folder:', inputValue: 'New Folder',
                  onConfirm: async (name) => {
                      if (name) {
                          setModal(null);
                          const notifId = addNotification('Membuat folder...', 'loading');
                          try {
                              const res = await API.createFolder(currentFolderId, name);
                              if (res.status === 'success' && res.data) {
                                  updateMap('add', [{ id: res.data.id, name: res.data.name, parentId: currentFolderId || "root" }]);
                                  updateNotification(notifId, 'Folder dibuat', 'success');
                                  await loadFolder(currentFolderId);
                              }
                          } catch (e) { updateNotification(notifId, 'Gagal membuat', 'error'); }
                      }
                  }
              });
              break;
          case 'rename':
              const targetRen = items.find(i => i.id === ids[0]);
              if (targetRen) {
                setModal({
                    type: 'input', title: 'Ganti Nama', inputValue: targetRen.name,
                    onConfirm: async (newName) => {
                        if (newName && newName !== targetRen.name) {
                            setModal(null);
                            const notifId = addNotification('Mengganti nama...', 'loading');
                            try {
                                await API.renameItem(targetRen.id, newName);
                                if (targetRen.type === 'folder') updateMap('update', [{ id: targetRen.id, name: newName }]);
                                updateNotification(notifId, 'Berhasil diganti', 'success');
                                await loadFolder(currentFolderId);
                            } catch (e) { updateNotification(notifId, 'Gagal', 'error'); }
                        }
                    }
                });
              }
              break;
          case 'delete':
              setModal({
                  type: 'confirm', title: 'Hapus Item?', message: `Pindahkan ${ids.length} item ke Recycle Bin?`, confirmText: 'Hapus', isDanger: true,
                  onConfirm: async () => {
                      setModal(null);
                      const notifId = addNotification(`Menghapus ${ids.length} item...`, 'loading');
                      try {
                          const binId = await getOrCreateRecycleBin();
                          for (const id of ids) await DB.saveDeletedMeta(id, currentFolderId || "root");
                          await API.moveItems(ids, binId);
                          updateMap('move', items.filter(i => ids.includes(i.id) && i.type === 'folder').map(f => ({ id: f.id, parentId: binId })));
                          updateNotification(notifId, 'Berhasil dihapus', 'success');
                          await loadFolder(currentFolderId);
                      } catch (e) { updateNotification(notifId, 'Gagal', 'error'); }
                  }
              });
              break;
          case 'restore_all':
              const notifRA = addNotification('Mengembalikan semua item...', 'loading');
              try {
                  const binId = await getOrCreateRecycleBin();
                  const res = await API.getFolderContents(binId);
                  const itemsToRestore = (res.status === 'success' && Array.isArray(res.data)) ? (res.data as Item[]) : [];
                  
                  if (itemsToRestore.length === 0) { updateNotification(notifRA, 'Recycle Bin Kosong', 'success'); return; }
                  
                  const restoreGroups: Record<string, string[]> = {};
                  for (const it of itemsToRestore) {
                      const orig = await DB.getDeletedMeta(it.id) || "root";
                      if (!restoreGroups[orig]) restoreGroups[orig] = [];
                      restoreGroups[orig].push(it.id);
                  }

                  for (const [targetFolder, itemIds] of Object.entries(restoreGroups)) {
                      await API.moveItems(itemIds, targetFolder);
                      const folders = itemsToRestore.filter(i => itemIds.includes(i.id) && i.type === 'folder');
                      if (folders.length > 0) updateMap('move', folders.map(f => ({ id: f.id, parentId: targetFolder })));
                      for(const id of itemIds) await DB.removeDeletedMeta(id);
                  }
                  updateNotification(notifRA, 'Semua item dikembalikan', 'success');
                  loadFolder(currentFolderId);
              } catch(e) { updateNotification(notifRA, 'Gagal', 'error'); }
              break;
          case 'download':
              const targets = items.filter(i => ids.includes(i.id) && i.type !== 'folder');
              targets.forEach(item => { if (item.url) window.open(item.url, '_blank'); });
              break;
      }
  };

  const handleCreateNote = () => { setEditingNote({ id: 'temp-' + Date.now(), galleryId: currentFolderId, title: 'Catatan Baru', content: '', timestamp: Date.now() }); setIsNewDropdownOpen(false); };
  const handleSaveNote = async (id: string, title: string, content: string) => { 
      setIsGlobalLoading(true); setGlobalLoadingMessage("Menyimpan..."); 
      try { 
          const isNew = id.startsWith('temp-'); 
          await API.saveNoteToDrive(title, content, currentFolderId, isNew ? undefined : id); 
          setEditingNote(null); 
          addNotification('Tersimpan', 'success'); 
          await loadFolder(currentFolderId);
      } catch(e) { addNotification('Gagal', 'error'); } finally { setIsGlobalLoading(false); } 
  };
  const handleOpenNote = async (item: Item) => { 
      setIsGlobalLoading(true); setGlobalLoadingMessage("Membuka..."); 
      try { 
          const content = await API.getFileContent(item.id); 
          setEditingNote({ id: item.id, galleryId: currentFolderId, title: item.name.replace('.txt', ''), content: content, timestamp: item.lastUpdated }); 
      } catch(e) { addNotification('Gagal', 'error'); } finally { setIsGlobalLoading(false); } 
  };
  const handleBreadcrumbClick = (index: number) => { 
      if (index === -1) { setFolderHistory([]); setCurrentFolderId(""); } 
      else { const target = folderHistory[index]; setFolderHistory(prev => prev.slice(0, index + 1)); setCurrentFolderId(target.id); } 
  };
  
  const groupedItems = { folders: items.filter(i => i.type === 'folder'), notes: items.filter(i => i.type === 'note'), images: items.filter(i => i.type === 'image') };
  const isSystemFolder = currentFolderId === systemFolderId;

  if (isNotFound) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6 space-y-6">
              <div className="p-6 bg-slate-900 rounded-full shadow-2xl border border-slate-800"><AlertCircle size={64} className="text-slate-500" /></div>
              <h1 className="text-2xl font-bold text-white">Folder Tidak Ditemukan</h1>
              <button onClick={() => window.location.href = '#/'} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg flex items-center gap-2"><Home size={18} /> Kembali ke Home</button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 relative select-none" ref={containerRef} onContextMenu={(e) => handleContextMenu(e)} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer?.types.includes("Files")) setIsDraggingFile(true); }} onDragLeave={() => setIsDraggingFile(false)} onDrop={(e) => { e.preventDefault(); setIsDraggingFile(false); if (e.dataTransfer.files) handleUploadFiles(Array.from(e.dataTransfer.files)); }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      {isDraggingFile && (<div className="fixed inset-0 z-[1000] bg-blue-500/20 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none"><CloudUpload size={64} className="text-blue-500 mb-4 animate-bounce" /><h2 className="text-3xl font-bold text-blue-100">Drop Files Here</h2></div>)}
      {customDragItem && customDragPos && (<div className="fixed z-[999] pointer-events-none p-4 rounded-xl border border-blue-500 bg-slate-800/90 shadow-2xl flex flex-col items-center gap-2 w-32 backdrop-blur-sm" style={{ left: customDragPos.x, top: customDragPos.y, transform: 'translate(-50%, -50%) rotate(5deg)' }}>{customDragItem.type === 'folder' ? <Folder size={32} className="text-blue-500"/> : customDragItem.type === 'note' ? <FileText size={32} className="text-yellow-500"/> : (customDragItem.thumbnail ? <img src={customDragItem.thumbnail} className="w-16 h-16 object-cover rounded"/> : <ImageIcon size={32} className="text-purple-500"/>)}<span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">{selectedIds.size > 1 ? `${selectedIds.size} Items` : customDragItem.name}</span></div>)}
      {selectionBox && (<div className="fixed z-50 bg-blue-500/20 border border-blue-400 pointer-events-none" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />)}
      {isGlobalLoading && (<div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center cursor-wait"><div className="relative"><Loader2 size={48} className="animate-spin text-blue-500 mb-4"/><div className="absolute inset-0 flex items-center justify-center"><Database size={20} className="text-blue-300" /></div></div><p className="text-white font-semibold text-lg animate-pulse">{globalLoadingMessage}</p></div>)}
      
      <SelectionFloatingMenu selectedIds={selectedIds} items={items} onClear={() => setSelectedIds(new Set())} onSelectAll={handleSelectAllByCategory} onAction={executeAction} containerRef={containerRef} isInRecycleBin={currentFolderId === recycleBinId} recycleBinId={recycleBinId} isSystemFolder={currentFolderId === systemFolderId} systemFolderId={systemFolderId}/>
      <UploadProgress uploads={uploadQueue} onClose={() => setUploadQueue([])} onRemove={(id) => setUploadQueue(prev => prev.filter(u => u.id !== id))} />
      <DownloadProgress downloads={downloadQueue} onClose={() => setDownloadQueue([])} onClearCompleted={() => setDownloadQueue(prev => prev.filter(d => d.status !== 'completed'))} />
      
      <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 pointer-events-none">
          {notifications.map(n => (
              <div key={n.id} className="bg-slate-800/90 backdrop-blur-md border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
                  {n.type === 'loading' && <Loader2 size={18} className="animate-spin text-blue-400" />} {n.type === 'success' && <CheckCircle size={18} className="text-green-400" />} {n.type === 'error' && <XCircle size={18} className="text-red-400" />}
                  <span className="text-sm font-medium">{n.message}</span>
              </div>
          ))}
      </div>

      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800 h-16 flex items-center px-4 justify-between shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-right">
           <button onClick={() => handleBreadcrumbClick(-1)} className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${currentFolderId === "" ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:bg-slate-800'}`}><Home size={18} /> <span className="hidden sm:inline">Home</span></button>
           {folderHistory.map((h, idx) => ( <React.Fragment key={h.id}><ChevronRight size={14} className="text-slate-600 flex-shrink-0" /><button onClick={() => handleBreadcrumbClick(idx)} className={`p-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${idx === folderHistory.length - 1 ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:bg-slate-800'}`}>{h.name}</button></React.Fragment> ))}
        </div>
        {!isRecycleBinId(currentFolderId, recycleBinId) && !isSystemFolder && (
        <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isSavingDB || isSavingComments ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                {isSavingDB || isSavingComments ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />} {isSavingDB || isSavingComments ? 'Syncing...' : 'Synced'}
            </div>
            <div className="relative">
                <button onPointerDown={(e) => { e.stopPropagation(); setIsNewDropdownOpen(!isNewDropdownOpen); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg transition-all"><Plus size={18} /> Baru</button>
                {isNewDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 origin-top-right">
                        <button onPointerDown={(e) => { e.stopPropagation(); executeAction('new_folder'); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded-lg flex items-center gap-3 text-sm"><Folder size={18} className="text-blue-400"/> Folder Baru</button>
                        <button onPointerDown={(e) => { e.stopPropagation(); handleCreateNote(); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded-lg flex items-center gap-3 text-sm"><FileText size={18} className="text-yellow-400"/> Catatan Baru</button>
                        <div className="h-px bg-slate-700 my-1"></div>
                        <label className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded-lg flex items-center gap-3 text-sm cursor-pointer" onPointerDown={(e) => e.stopPropagation()}>
                            <Upload size={18} className="text-green-400"/> Upload File
                            <input type="file" multiple className="hidden" onChange={(e) => { setIsNewDropdownOpen(false); if(e.target.files) handleUploadFiles(Array.from(e.target.files)); }} />
                        </label>
                    </div>
                )}
            </div>
        </div>
        )}
      </header>

      <main className="p-4 md:p-6 pb-20 space-y-8 min-h-[calc(100vh-4rem)]">
        {loading ? ( <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50"><Loader2 size={32} className="animate-spin text-blue-500"/><p>Memuat folder...</p></div> ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl">
                <Folder size={64} className="mb-4 opacity-20" />
                <p className="font-medium">Folder Kosong</p>
            </div>
        ) : (
            <>
                {groupedItems.folders.length > 0 && ( <section><h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Folder size={14}/> Folders</h2><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">{groupedItems.folders.map(item => (<FolderItem key={item.id} item={item} hasComments={(comments[item.id]?.length || 0) > 0} isRecycleBin={item.id === recycleBinId} isSystem={item.id === systemFolderId || item.name === SYSTEM_FOLDER_NAME} selected={selectedIds.has(item.id)} isDropTarget={dropTargetId === item.id} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} onToggleSelect={() => handleToggleSelect(item.id)} onCommentClick={() => setModal({ type: 'comment', title: `Komentar: ${item.name}`, targetItem: item })} />))}</div></section> )}
                {groupedItems.notes.length > 0 && ( <section><h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 mt-8 flex items-center gap-2"><FileText size={14}/> Notes</h2><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">{groupedItems.notes.map(item => (<NoteItem key={item.id} item={item} hasComments={(comments[item.id]?.length || 0) > 0} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} onToggleSelect={() => handleToggleSelect(item.id)} onCommentClick={() => setModal({ type: 'comment', title: `Komentar: ${item.name}`, targetItem: item })} />))}</div></section> )}
                {groupedItems.images.length > 0 && ( <section><h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 mt-8 flex items-center gap-2"><ImageIcon size={14}/> Images</h2><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">{groupedItems.images.map(item => (<ImageItem key={item.id} item={item} hasComments={(comments[item.id]?.length || 0) > 0} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} onToggleSelect={() => handleToggleSelect(item.id)} onCommentClick={() => setModal({ type: 'comment', title: `Komentar: ${item.name}`, targetItem: item })} />))}</div></section> )}
            </>
        )}
      </main>

      {currentFolderId !== recycleBinId && !isSystemFolder && (
          <div className="fixed bottom-6 left-6 z-[250]">
              <button onClick={() => { if (recycleBinId) { setFolderHistory(prev => [...prev, { id: recycleBinId, name: RECYCLE_BIN_NAME }]); setCurrentFolderId(recycleBinId); } }} className="bg-slate-800 border border-slate-700 p-3 rounded-full shadow-2xl hover:bg-slate-700 transition-all flex items-center justify-center"><Trash2 size={24} className="text-slate-400" /></button>
          </div>
      )}

      {contextMenu && ( <><div className="fixed inset-0 z-[99]" onClick={() => setContextMenu(null)}></div><div className="fixed z-[100] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1.5 min-w-[200px] animate-in fade-in zoom-in-95 duration-100" style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 220) }}>{contextMenu.isRecycleBinBtn ? (<> <button onClick={() => executeAction('restore_all')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm"><RotateCcw size={16} className="text-green-400"/> Restore All</button> </>) : contextMenu.targetItem ? (<> <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-700/50 mb-1 truncate">{contextMenu.targetItem.name}</div><button onClick={() => executeAction('comment')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm"><MessageSquare size={16} className="text-blue-400"/> Komentar</button><button onClick={() => executeAction('rename')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm">Ganti Nama</button><button onClick={() => executeAction('delete')} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 flex items-center gap-3 text-sm">Hapus</button> </>) : (<button onClick={() => loadFolder(currentFolderId)} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm">Refresh</button>)}</div></>)}
      
      {viewingRawFile && (<div className="fixed inset-0 z-[200] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/80" onClick={() => setViewingRawFile(null)} /><div className="relative w-full max-w-4xl h-[80vh] bg-slate-900 border border-slate-700 rounded-2xl flex flex-col overflow-hidden animate-in zoom-in-95"><div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between"><h3 className="text-sm font-bold">{viewingRawFile.title}</h3><button onClick={() => setViewingRawFile(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X size={20} /></button></div><div className="flex-1 overflow-auto p-4"><pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{viewingRawFile.content}</pre></div></div></div>)}
      {previewImage && (<div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewImage(null)}><div className="absolute top-4 right-4 z-10 flex gap-2"><button onClick={() => setPreviewImage(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><X size={24}/></button></div><img src={previewImage} className="max-w-full max-h-full object-contain rounded shadow-2xl" /></div>)}
      {editingNote && <TextEditor note={editingNote} onSave={handleSaveNote} onClose={() => setEditingNote(null)} />}
      
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className={`relative w-full ${modal.type === 'comment' ? 'max-w-2xl' : 'max-w-sm'} bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden`}>
            {modal.type === 'comment' ? (
              <div className="flex flex-col h-[600px] comment-area">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-lg font-bold">{modal.title}</h3>
                  <button onClick={() => setModal(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {modal.targetItem && (comments[modal.targetItem.id] || []).map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs">{comment.author[0]}</div>
                      <div className="flex-1 bg-slate-800 p-3 rounded-2xl rounded-tl-none">
                        <div className="flex justify-between mb-1"><span className="text-xs font-bold text-blue-400">{comment.author}</span><span className="text-[10px] text-slate-500">{new Date(comment.timestamp).toLocaleString()}</span></div>
                        <p className="text-sm">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                  <input type="text" placeholder="Nama" value={commentName} onChange={(e) => setCommentName(e.target.value)} className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-xs" />
                  <input type="text" placeholder="Tulis komentar..." value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') handleAddComment(); }} className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs" />
                  <button onClick={handleAddComment} className="p-2 bg-blue-600 rounded-lg"><Send size={18}/></button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-2">{modal.title}</h3>
                  {modal.message && <p className="text-sm text-slate-400 mb-4">{modal.message}</p>}
                  {modal.type === 'input' && (<input type="text" defaultValue={modal.inputValue} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2" onKeyDown={(e) => { if(e.key === 'Enter') modal.onConfirm?.(e.currentTarget.value); }} onChange={(e) => { if (modal) modal.inputValue = e.target.value; }} autoFocus />)}
                </div>
                <div className="bg-slate-800/50 p-4 flex gap-3">
                  <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors">Batal</button>
                  <button onClick={() => modal.onConfirm?.(modal.inputValue)} className={`flex-1 py-2 rounded-lg text-sm font-bold text-white ${modal.isDanger ? 'bg-red-600' : 'bg-blue-600'}`}>{modal.confirmText || 'OK'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- SUB-COMPONENTS ---
interface ItemProps {
  item: Item;
  selected: boolean;
  hasComments?: boolean;
  onClick: (e: React.MouseEvent, item: Item) => void;
  onDoubleClick: (e: React.MouseEvent, item: Item) => void;
  onContextMenu: (e: React.MouseEvent | React.PointerEvent, item: Item) => void;
  onToggleSelect: () => void;
  onCommentClick?: () => void;
}

const isRecycleBinId = (id: string, binId: string) => id === binId && binId !== "";

const CommentBadge = ({ onClick }: { onClick?: () => void }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    className="absolute bottom-2 right-2 z-30 p-1.5 bg-blue-600 text-white rounded-full shadow-lg border border-blue-400/50"
  >
    <MessageSquare size={12} fill="currentColor"/>
  </button>
);

const SelectionFloatingMenu = ({ selectedIds, items, onClear, onSelectAll, onAction, containerRef, isInRecycleBin, recycleBinId, isSystemFolder, systemFolderId }: { selectedIds: Set<string>, items: Item[], onClear: () => void, onSelectAll: () => void, onAction: (a: string) => void, containerRef: React.RefObject<HTMLDivElement>, isInRecycleBin: boolean, recycleBinId: string, isSystemFolder: boolean, systemFolderId: string | null }) => {
    if (selectedIds.size === 0) return null; 
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 bg-slate-900 border border-blue-500/50 p-2 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
            <div className="px-3 border-r border-white/10 flex items-center gap-2">
                <span className="font-bold text-blue-100">{selectedIds.size}</span>
                <button onClick={onClear} className="p-1.5 hover:bg-white/10 rounded-full"><X size={14}/></button>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onAction('rename'); }} disabled={selectedIds.size > 1} className="p-2.5 hover:bg-white/10 rounded-lg disabled:opacity-30"><Edit size={18}/></button>
            <button onClick={(e) => { e.stopPropagation(); onAction('comment'); }} disabled={selectedIds.size > 1} className="p-2.5 hover:bg-blue-500/20 text-blue-400 rounded-lg disabled:opacity-30"><MessageSquare size={18}/></button>
            <button onClick={(e) => { e.stopPropagation(); onAction('delete'); }} className="p-2.5 hover:bg-red-500/20 text-red-400 rounded-lg"><Trash2 size={18}/></button>
        </div>
    );
};

const FolderItem: React.FC<ItemProps & { isRecycleBin?: boolean; isSystem?: boolean; isDropTarget?: boolean }> = ({ item, selected, hasComments, onClick, onDoubleClick, onContextMenu, onToggleSelect, onCommentClick, isRecycleBin, isSystem, isDropTarget }) => ( 
  <div id={`item-${item.id}`} data-folder-id={item.id} data-item-id={item.id} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => onContextMenu(e, item)} className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-2 ${isDropTarget ? 'bg-blue-500/40 border-blue-400' : selected ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'}`}> 
    <div className={`absolute top-2 left-2 z-20 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><CheckSquare size={18} className={selected ? "text-blue-500" : "text-slate-500"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/></div>
    {hasComments && <CommentBadge onClick={onCommentClick}/>}
    {isRecycleBin ? <Trash2 size={48} className="text-red-500" /> : isSystem ? <div className="relative"><Folder size={48} className="text-slate-500"/><Lock size={14} className="absolute bottom-0 right-0 text-amber-500 bg-slate-900 rounded-full"/></div> : <Folder size={48} className="text-blue-500" />}
    <span className="text-xs font-medium truncate w-full text-center">{item.name}</span>
  </div> 
);

const NoteItem: React.FC<ItemProps> = ({ item, selected, hasComments, onClick, onDoubleClick, onContextMenu, onToggleSelect, onCommentClick }) => (
  <div id={`item-${item.id}`} data-item-id={item.id} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => onContextMenu(e, item)} className={`group relative p-4 rounded-xl border transition-all cursor-pointer aspect-square flex flex-col gap-2 ${selected ? 'bg-yellow-100 border-blue-500' : 'bg-[#fff9c4] border-transparent hover:border-yellow-300'}`}>
    <div className={`absolute top-2 left-2 z-20 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><CheckSquare size={18} className={selected ? "text-blue-600" : "text-slate-600"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/></div>
    {hasComments && <CommentBadge onClick={onCommentClick}/>}
    <div className="flex-1 overflow-hidden"><h4 className="text-sm font-bold text-slate-900 truncate mb-1">{item.name.replace('.txt','')}</h4><p className="text-[10px] text-slate-800 line-clamp-6">{stripHtml(item.content || "")}</p></div>
  </div>
);

const ImageItem: React.FC<ItemProps> = ({ item, selected, hasComments, onClick, onDoubleClick, onContextMenu, onToggleSelect, onCommentClick }) => (
  <div id={`item-${item.id}`} data-item-id={item.id} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => onContextMenu(e, item)} className={`group relative rounded-xl border transition-all cursor-pointer aspect-square overflow-hidden bg-slate-950 flex items-center justify-center ${selected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-slate-800 hover:border-slate-600'}`}>
    <div className={`absolute top-2 left-2 z-20 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><CheckSquare size={18} className={selected ? "text-blue-500" : "text-slate-300"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/></div>
    {hasComments && <CommentBadge onClick={onCommentClick}/>}
    {item.thumbnail || item.url ? <img src={item.thumbnail || item.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ImageIcon size={32} className="text-slate-700"/>}
    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 truncate"><span className="text-[9px] text-white block text-center truncate">{item.name}</span></div>
  </div>
);

export default App;

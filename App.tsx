
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, MoreVertical, 
  ArrowLeft, Plus, Trash2, Copy, Move, Edit, CheckSquare, 
  Loader2, Home, Upload, ChevronRight, X, AlertCircle, Download, CornerUpLeft,
  CheckCircle, XCircle, Image, RotateCcw, Ban, GripVertical, Database, Lock, ShieldAlert, Cloud, CloudUpload, FileJson, RefreshCw,
  CheckCheck
} from 'lucide-react';
import * as API from './services/api';
import * as DB from './services/db';
import { Item, StoredNote, DownloadItem, FolderMap, SystemDB } from './types';
import { TextEditor } from './components/TextEditor';
import { UploadProgress, UploadItem } from './components/UploadProgress';
import { DownloadProgress } from './components/DownloadProgress';

// --- TYPES ---
type ModalType = 'input' | 'confirm' | 'alert' | 'select' | 'password' | null;
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
const SYSTEM_FOLDER_NAME = "System";
const SYSTEM_PASSWORD = "1509";
const DB_FILENAME_BASE = "system_zombio_db"; 

const stripHtml = (html: string) => {
  if (!html) return "";
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

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
  const [systemFolderId, setSystemFolderId] = useState<string | null>(null);
  const [isSystemInitialized, setIsSystemInitialized] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false); 
  const [isSavingDB, setIsSavingDB] = useState(false);
  const saveTimeoutRef = useRef<any>(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(true); 
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState("Memulai Sistem...");
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null); 
  const [contextMenu, setContextMenu] = useState<{x:number, y:number, targetItem?: Item, isRecycleBinBtn?: boolean} | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false); 
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{x:number, y:number, width:number, height:number} | null>(null);
  const [customDragItem, setCustomDragItem] = useState<Item | null>(null);
  const [customDragPos, setCustomDragPos] = useState<{x:number, y:number} | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{x:number, y:number} | null>(null);
  const lastTouchedIdRef = useRef<string | null>(null);
  const isPaintingRef = useRef<boolean>(false); 
  const longPressTimerRef = useRef<any>(null);
  const activeFolderIdRef = useRef<string>(currentFolderId);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [editingNote, setEditingNote] = useState<StoredNote | null>(null);
  const [viewingRawFile, setViewingRawFile] = useState<{title: string, content: string} | null>(null); 
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => { activeFolderIdRef.current = currentFolderId; }, [currentFolderId]);

  useEffect(() => {
    if (previewImage) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [previewImage]);

  const triggerCloudSync = useCallback(() => {
      if (!dbFileId) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setIsSavingDB(true);
      saveTimeoutRef.current = setTimeout(async () => {
          try {
              await API.updateSystemDBFile(dbFileId, systemMapRef.current);
              setIsSavingDB(false);
              await DB.saveSystemMap({ fileId: dbFileId, map: systemMapRef.current, lastSync: Date.now() });
          } catch (e) { setIsSavingDB(false); }
      }, 1500); 
  }, [dbFileId]);

  useEffect(() => {
    if (!isSystemInitialized || !dbFileId || isSavingDB) return;
    const interval = setInterval(async () => {
        try {
            if (!isSavingDB) {
                const content = await API.getFileContent(dbFileId);
                const remoteMap = JSON.parse(content);
                if (JSON.stringify(remoteMap) !== JSON.stringify(systemMapRef.current)) {
                    systemMapRef.current = remoteMap;
                    setSystemMap(remoteMap);
                    await DB.saveSystemMap({ fileId: dbFileId, map: remoteMap, lastSync: Date.now() });
                    if (currentFolderId) loadFolder(currentFolderId);
                }
            }
        } catch (e) {}
    }, 60000); 
    return () => clearInterval(interval);
  }, [isSystemInitialized, dbFileId, isSavingDB, currentFolderId]);

  useEffect(() => {
    const initSystem = async () => {
       try {
           const cachedDB = await DB.getSystemMap();
           let currentMap: FolderMap = cachedDB ? cachedDB.map : {};
           setGlobalLoadingMessage("Sinkronisasi Cloud...");
           const location = await API.locateSystemDB();
           let sysFolderId = location.systemFolderId;
           let currentFileId = location.fileId; 
           if (!sysFolderId) {
               setGlobalLoadingMessage("Membuat Folder System...");
               sysFolderId = await API.createSystemFolder();
           }
           setSystemFolderId(sysFolderId);
           if (!currentFileId) {
               setGlobalLoadingMessage("Membuat Database Baru...");
               if (!cachedDB) currentMap = { "root": { id: "root", name: "Home", parentId: "" } };
               const newId = await API.createSystemDBFile(currentMap, sysFolderId);
               currentFileId = newId;
           } else {
               setGlobalLoadingMessage("Mengunduh Database Terbaru...");
               try {
                   const content = await API.getFileContent(currentFileId);
                   currentMap = JSON.parse(content);
               } catch(e) { }
           }
           await DB.saveSystemMap({ fileId: currentFileId, map: currentMap, lastSync: Date.now() });
           systemMapRef.current = currentMap;
           setSystemMap(currentMap);
           setDbFileId(currentFileId);
           setIsSystemInitialized(true);
           const hash = window.location.hash.replace(/^#/, ''); 
           const path = hash.split('/').filter(p => p);
           if (path.length > 0) {
               setGlobalLoadingMessage("Membuka Link...");
               let parentSearchId = "root"; 
               let foundId = "";
               const traceHistory: {id:string, name:string}[] = [];
               for (const segment of path) {
                   const decodedName = decodeURIComponent(segment);
                   const entryId = Object.keys(currentMap).find(key => {
                       const node = currentMap[key];
                       return node.name === decodedName && (node.parentId || "root") === parentSearchId;
                   });
                   if (entryId) { parentSearchId = entryId; traceHistory.push({ id: entryId, name: decodedName }); foundId = entryId; } 
               }
               if (foundId) { setFolderHistory(traceHistory); setCurrentFolderId(foundId); } else { setIsNotFound(true); }
           } else { setCurrentFolderId(""); }
       } catch (err) { setIsNotFound(true); } finally { setIsGlobalLoading(false); }
    };
    initSystem();
  }, []);

  useEffect(() => {
    if (!isSystemInitialized || isNotFound) return;
    const pathSegments = folderHistory.map(f => encodeURIComponent(f.name));
    const newHash = pathSegments.length > 0 ? '/' + pathSegments.join('/') : '';
    if (window.location.hash !== `#${newHash}`) { window.history.replaceState(null, '', `#${newHash}`); }
  }, [currentFolderId, folderHistory, isSystemInitialized, isNotFound]);

  const updateMap = (action: 'add' | 'remove' | 'update' | 'move', items: {id: string, name?: string, parentId?: string}[]) => {
      const nextMap = { ...systemMapRef.current };
      items.forEach(item => {
          if (action === 'add' || action === 'update') {
              if (item.name) {
                  const existing = nextMap[item.id];
                  nextMap[item.id] = { id: item.id, name: item.name, parentId: item.parentId !== undefined ? item.parentId : (existing?.parentId || "root") };
              }
          } else if (action === 'remove') delete nextMap[item.id];
          else if (action === 'move') { if (nextMap[item.id] && item.parentId !== undefined) nextMap[item.id] = { ...nextMap[item.id], parentId: item.parentId }; }
      });
      systemMapRef.current = nextMap;
      setSystemMap(nextMap);
      DB.saveSystemMap({ fileId: dbFileId, map: nextMap, lastSync: Date.now() });
      triggerCloudSync();
  };

  const addNotification = (message: string, type: 'loading' | 'success' | 'error' = 'success', duration = 3000) => {
    const id = Date.now().toString() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
    if (type !== 'loading') { setTimeout(() => { setNotifications(prev => prev.filter(n => n.id !== id)); }, duration); }
    return id;
  };

  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  const updateNotification = (id: string, message: string, type: 'success' | 'error') => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, message, type } : n));
    setTimeout(() => { setNotifications(prev => prev.filter(n => n.id !== id)); }, 3000);
  };

  const prefetchNoteContents = async (folderId: string, notesToFetch: Item[]) => {
      if (notesToFetch.length === 0) return;
      for (const note of notesToFetch) {
          if (folderId !== activeFolderIdRef.current) return;
          try {
              if (!note.content) {
                  const content = await API.getFileContent(note.id);
                  const updatedItem = { ...note, content: content };
                  await DB.updateItemInCache(folderId, updatedItem);
                  if (folderId === activeFolderIdRef.current) setItems(prevItems => prevItems.map(i => i.id === note.id ? updatedItem : i));
              }
          } catch (e) {}
      }
  };

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
        const mergedItems = freshItems.map(newItem => {
            const cachedItem = cachedItems?.find(c => c.id === newItem.id);
            if (cachedItem && cachedItem.content && newItem.type === 'note') return { ...newItem, content: cachedItem.content };
            return newItem;
        });
        setItems(mergedItems);
        const folders = freshItems.filter(i => i.type === 'folder');
        if (folders.length > 0) updateMap('add', folders.map(f => ({ id: f.id, name: f.name, parentId: folderId || "root" })));
        await DB.cacheFolderContents(folderId, mergedItems);
        const notesMissingContent = mergedItems.filter(i => i.type === 'note' && !i.content);
        prefetchNoteContents(folderId, notesMissingContent);
      }
    } catch (e) { if (folderId === activeFolderIdRef.current) setLoading(false); }
  }, [dbFileId]);

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

  const handlePointerDown = (e: React.PointerEvent) => {
     if ((e.target as HTMLElement).closest('button, .item-handle, .floating-ui, select, input')) return;
     if (!e.isPrimary) return;
     const target = e.target as HTMLElement;
     const checkbox = target.closest('.selection-checkbox');
     const itemRow = target.closest('[data-item-id]');
     dragStartPos.current = { x: e.clientX, y: e.clientY };
     if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
     
     if (checkbox && itemRow) {
         e.stopPropagation();
         const id = itemRow.getAttribute('data-item-id');
         if(id) { handleToggleSelect(id); lastTouchedIdRef.current = id; isPaintingRef.current = true; }
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

      // FIX BUG: Langsung hapus UI drag saat dilepas
      setCustomDragItem(null);
      setCustomDragPos(null);
      setDropTargetId(null);
      setIsDragSelecting(false);
      setSelectionBox(null);
      dragStartPos.current = null;
      lastTouchedIdRef.current = null;
      isPaintingRef.current = false;
      if (containerRef.current) { try { containerRef.current.releasePointerCapture(e.pointerId); } catch(err) {} }

      if (currentDrag && targetId) {
          if (targetId === systemFolderId) {
              addNotification("Tidak bisa memindahkan ke Folder System", "error");
          } else {
              const idsToMove = selectedIds.size > 0 ? Array.from(selectedIds) : [currentDrag.id];
              const targetName = items.find(i => i.id === targetId)?.name || "Folder";
              
              // OPTIMISTIC: Beri overlay 'deleting' atau hapus sementara dari view
              const backupItems = [...items];
              setItems(prev => prev.map(item => idsToMove.includes(item.id) ? { ...item, status: 'deleting' } : item));
              
              const notifId = addNotification(`Memindahkan ${idsToMove.length} item ke ${targetName}...`, 'loading');
              try {
                  await API.moveItems(idsToMove, targetId);
                  const foldersMoved = backupItems.filter(i => idsToMove.includes(i.id) && i.type === 'folder');
                  if (foldersMoved.length > 0) updateMap('move', foldersMoved.map(f => ({ id: f.id, parentId: targetId })));
                  updateNotification(notifId, 'Berhasil dipindahkan', 'success');
                  await loadFolder(currentFolderId);
              } catch(err) {
                  updateNotification(notifId, 'Gagal pindah', 'error');
                  setItems(backupItems); // Rollback
              } 
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
                    if (val === SYSTEM_PASSWORD) { setModal(null); setFolderHistory(prev => [...prev, { id: item.id, name: item.name }]); setCurrentFolderId(item.id); } 
                    else { addNotification("Password Salah!", "error"); }
                }
            });
            return;
        }
        setFolderHistory(prev => [...prev, { id: item.id, name: item.name }]); setCurrentFolderId(item.id);
    } else if (item.type === 'note') {
        if (item.name.includes(DB_FILENAME_BASE)) { 
            const notifId = addNotification('Membaca Database...', 'loading');
            try {
                let content = item.content;
                if (!content) content = await API.getFileContent(item.id);
                try { const json = JSON.parse(content || "{}"); content = JSON.stringify(json, null, 2); } catch(e) {}
                setViewingRawFile({ title: item.name, content: content || "" }); removeNotification(notifId);
            } catch(e) { updateNotification(notifId, 'Gagal membuka DB', 'error'); }
        } else { handleOpenNote(item); }
    } else if (item.type === 'image') { setPreviewImage(item.url || null); }
  };

  const handleContextMenu = (e: React.MouseEvent | React.PointerEvent, item?: Item) => {
    e.preventDefault();
    if (item) { if (!selectedIds.has(item.id)) { setSelectedIds(new Set([item.id])); setLastSelectedId(item.id); } setContextMenu({ x: (e as any).pageX || (e as any).clientX, y: (e as any).pageY || (e as any).clientY, targetItem: item }); } 
    else { setContextMenu({ x: (e as any).pageX || (e as any).clientX, y: (e as any).pageY || (e as any).clientY, targetItem: undefined }); }
  };

  const downloadWithProgress = async (url: string, name: string, isImage: boolean) => {
    const id = Date.now().toString();
    setDownloadQueue(prev => [...prev, { id, name, status: 'pending', progress: 0 }]);
    try {
        let finalUrl = url;
        if (isImage) finalUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&q=100&output=jpg`; 
        setDownloadQueue(prev => prev.map(d => d.id === id ? { ...d, status: 'downloading' } : d));
        const response = await fetch(finalUrl);
        if (!response.ok) throw new Error("Network response was not ok");
        if (!response.body) throw new Error("No body");
        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;
        const reader = response.body.getReader();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (total) {
                const progress = Math.round((loaded / total) * 100);
                setDownloadQueue(prev => prev.map(d => d.id === id ? { ...d, progress } : d));
            }
        }
        const blob = new Blob(chunks);
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl; a.download = name; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(downloadUrl); document.body.removeChild(a);
        setDownloadQueue(prev => prev.map(d => d.id === id ? { ...d, status: 'completed', progress: 100 } : d));
        setTimeout(() => setDownloadQueue(prev => prev.filter(d => d.id !== id)), 3000);
    } catch (e) {
        window.open(url, '_blank');
        setDownloadQueue(prev => prev.map(d => d.id === id ? { ...d, status: 'completed', progress: 100 } : d));
    }
  };

  const handleBulkDownload = async (ids: string[]) => {
      const targets = items.filter(i => ids.includes(i.id) && i.type !== 'folder'); 
      if (targets.length === 0) return;
      addNotification(`Memulai download ${targets.length} file...`, 'success');
      for (const item of targets) {
          if (item.url) downloadWithProgress(item.url, item.name, item.type === 'image');
          else if (item.type === 'note' && item.content) {
              const blob = new Blob([item.content], { type: 'text/plain' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = item.name.endsWith('.txt') ? item.name : `${item.name}.txt`; a.click(); window.URL.revokeObjectURL(url);
          }
      }
  };

  const handleCopyImage = async (url: string) => {
      try {
          const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=jpg`; 
          const data = await fetch(proxyUrl); const blob = await data.blob();
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
          addNotification("Gambar disalin ke clipboard", "success");
      } catch (e) { addNotification("Gagal menyalin gambar", "error"); }
  };

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

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault(); setIsDraggingFile(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleUploadFiles(Array.from(e.dataTransfer.files));
      }
  };

  const executeAction = async (action: string) => {
      if (!contextMenu && action !== 'paste' && selectedIds.size === 0) return;
      const item = contextMenu?.targetItem;
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : (item ? [item.id] : []);
      setContextMenu(null);

      switch (action) {
          case 'new_folder':
              setModal({
                  type: 'input', title: 'Folder Baru', message: 'Masukkan nama folder:', inputValue: 'New Folder',
                  onConfirm: async (name) => {
                      if (name) {
                          setModal(null);
                          const tempId = 'temp-' + Date.now();
                          const optimisticFolder: Item = { 
                            id: tempId, name: name, type: 'folder', lastUpdated: Date.now(), status: 'restoring' 
                          };
                          
                          // OPTIMISTIC: Munculkan langsung
                          setItems(prev => [...prev, optimisticFolder].sort((a,b) => a.name.localeCompare(b.name)));
                          const notifId = addNotification('Membuat folder...', 'loading');
                          
                          try {
                              const res = await API.createFolder(currentFolderId, name);
                              if (res.status === 'success' && res.data) {
                                  updateMap('add', [{ id: res.data.id, name: res.data.name, parentId: currentFolderId }]);
                                  updateNotification(notifId, 'Folder dibuat', 'success');
                                  // Refresh untuk ganti tempId jadi realId
                                  await loadFolder(currentFolderId);
                              } else { throw new Error(res.message); }
                          } catch (e) { 
                              updateNotification(notifId, 'Gagal membuat folder', 'error');
                              setItems(prev => prev.filter(i => i.id !== tempId)); // Rollback
                          }
                      }
                  }
              });
              break;

          case 'rename':
              const targetItem = items.find(i => i.id === ids[0]);
              if (targetItem) {
                setModal({
                    type: 'input', title: 'Ganti Nama', inputValue: targetItem.name,
                    onConfirm: async (newName) => {
                        if (newName && newName !== targetItem.name) {
                            setModal(null);
                            const oldName = targetItem.name;
                            const optimisticItems = items.map(i => i.id === targetItem.id ? { ...i, name: newName } : i);
                            
                            // OPTIMISTIC: Ubah nama langsung
                            setItems(optimisticItems);
                            const notifId = addNotification('Mengganti nama...', 'loading');
                            
                            try {
                                await API.renameItem(targetItem.id, newName);
                                if (targetItem.type === 'folder') updateMap('update', [{ id: targetItem.id, name: newName }]);
                                updateNotification(notifId, 'Berhasil diganti', 'success');
                                await loadFolder(currentFolderId);
                            } catch (e) { 
                                updateNotification(notifId, 'Gagal ganti nama', 'error'); 
                                setItems(prev => prev.map(i => i.id === targetItem.id ? { ...i, name: oldName } : i)); // Rollback
                            }
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
                      const backupItems = [...items];
                      
                      // OPTIMISTIC: Beri overlay 'deleting'
                      setItems(prev => prev.map(item => ids.includes(item.id) ? { ...item, status: 'deleting' } : item));
                      const notifId = addNotification(`Menghapus ${ids.length} item...`, 'loading');
                      
                      try {
                          const binId = await getOrCreateRecycleBin();
                          for (const id of ids) await DB.saveDeletedMeta(id, currentFolderId || "root");
                          await API.moveItems(ids, binId);
                          const foldersDeleted = backupItems.filter(i => ids.includes(i.id) && i.type === 'folder');
                          if (foldersDeleted.length > 0) updateMap('move', foldersDeleted.map(f => ({ id: f.id, parentId: binId })));
                          updateNotification(notifId, 'Item dipindahkan ke Recycle Bin', 'success');
                          await loadFolder(currentFolderId);
                      } catch (e) { 
                          updateNotification(notifId, 'Gagal menghapus', 'error'); 
                          setItems(backupItems); // Rollback
                      }
                  }
              });
              break;

          case 'delete_permanent':
               setModal({
                  type: 'confirm', title: 'Hapus Permanen?', message: `Tindakan ini tidak bisa dibatalkan! Hapus ${ids.length} item?`, confirmText: 'Hapus Selamanya', isDanger: true,
                  onConfirm: async () => {
                      setModal(null);
                      const backupItems = [...items];
                      setItems(prev => prev.map(item => ids.includes(item.id) ? { ...item, status: 'deleting' } : item));
                      
                      const notifId = addNotification(`Menghapus permanen ${ids.length} item...`, 'loading');
                      try {
                          await API.deleteItems(ids);
                          const folders = backupItems.filter(i => ids.includes(i.id) && i.type === 'folder');
                          if(folders.length > 0) updateMap('remove', folders.map(f => ({ id: f.id })));
                          for(const id of ids) await DB.removeDeletedMeta(id);
                          updateNotification(notifId, 'Item dihapus permanen', 'success');
                          await loadFolder(currentFolderId);
                      } catch (e) { 
                          updateNotification(notifId, 'Gagal hapus permanen', 'error'); 
                          setItems(backupItems);
                      }
                  }
              });
              break;

          case 'move':
              const folderOptions = Object.values(systemMap).filter(f => !ids.includes(f.id) && f.id !== currentFolderId && f.id !== recycleBinId).sort((a,b) => a.name.localeCompare(b.name)).map(f => ({ label: f.name, value: f.id }));
              folderOptions.unshift({ label: "Home (Root)", value: "" });
              setModal({
                  type: 'select', title: 'Pindahkan ke...', options: folderOptions, confirmText: 'Pindah',
                  onConfirm: async (targetId) => {
                      if (targetId !== undefined) {
                          setModal(null);
                          const targetName = targetId === "" ? "Home" : (systemMap[targetId]?.name || "Folder");
                          const backupItems = [...items];
                          
                          // OPTIMISTIC: Status moving
                          setItems(prev => prev.map(item => ids.includes(item.id) ? { ...item, status: 'deleting' } : item));
                          const notifId = addNotification(`Memindahkan ke ${targetName}...`, 'loading');
                          
                          try {
                              await API.moveItems(ids, targetId);
                              const foldersMoved = backupItems.filter(i => ids.includes(i.id) && i.type === 'folder');
                              if (foldersMoved.length > 0) updateMap('move', foldersMoved.map(f => ({ id: f.id, parentId: targetId })));
                              updateNotification(notifId, 'Berhasil dipindahkan', 'success');
                              await loadFolder(currentFolderId);
                          } catch (e) { 
                              updateNotification(notifId, 'Gagal pindah', 'error'); 
                              setItems(backupItems);
                          }
                      }
                  }
              });
              break;

          case 'restore':
              const notifRestore = addNotification(`Mengembalikan ${ids.length} item...`, 'loading');
              const backupRestore = [...items];
              setItems(prev => prev.map(item => ids.includes(item.id) ? { ...item, status: 'restoring' } : item));
              try {
                  const restoreMap: Record<string, string[]> = {}; const defaultTarget = "root";
                  for (const id of ids) {
                      const originalParent = await DB.getDeletedMeta(id);
                      const target = originalParent || defaultTarget;
                      if (!restoreMap[target]) restoreMap[target] = []; restoreMap[target].push(id);
                  }
                  for (const [targetFolder, itemIds] of Object.entries(restoreMap)) {
                      await API.moveItems(itemIds, targetFolder);
                      const foldersRestored = backupRestore.filter(i => itemIds.includes(i.id) && i.type === 'folder');
                      if (foldersRestored.length > 0) updateMap('move', foldersRestored.map(f => ({ id: f.id, parentId: targetFolder })));
                      for(const id of itemIds) await DB.removeDeletedMeta(id);
                  }
                  updateNotification(notifRestore, 'Item dikembalikan', 'success');
                  await loadFolder(currentFolderId);
              } catch (e) { 
                  updateNotification(notifRestore, 'Gagal restore', 'error'); 
                  setItems(backupRestore);
              }
              break;
              
          case 'duplicate':
              const notifDup = addNotification(`Menduplikasi ${ids.length} item...`, 'loading');
              try {
                  await API.duplicateItems(ids);
                  updateNotification(notifDup, 'Berhasil diduplikasi', 'success'); loadFolder(currentFolderId);
              } catch (e) { updateNotification(notifDup, 'Gagal duplikasi', 'error'); }
              break;
          case 'download':
              handleBulkDownload(ids);
              break;
          case 'copy_image':
             if (ids.length === 1) {
                 const item = items.find(i => i.id === ids[0]);
                 if (item && item.url) handleCopyImage(item.url);
             }
             break;
      }
  };

  const handleCreateNote = () => { setEditingNote({ id: 'temp-' + Date.now(), galleryId: currentFolderId, title: 'Catatan Baru', content: '', timestamp: Date.now() }); setIsNewDropdownOpen(false); setContextMenu(null); };
  const handleSaveNote = async (id: string, title: string, content: string) => { setIsGlobalLoading(true); setGlobalLoadingMessage("Menyimpan..."); try { const isNew = id.startsWith('temp-'); const fileId = isNew ? undefined : id; await API.saveNoteToDrive(title, content, currentFolderId, fileId); if (!isNew && fileId) { const updatedItem: Item = { ...items.find(i => i.id === fileId)!, name: title + '.txt', content: content, lastUpdated: Date.now(), snippet: stripHtml(content).substring(0, 150) }; await DB.updateItemInCache(currentFolderId, updatedItem); if (currentFolderId === activeFolderIdRef.current) setItems(prev => prev.map(i => i.id === fileId ? updatedItem : i)); } else { if (currentFolderId === activeFolderIdRef.current) await loadFolder(currentFolderId); } setEditingNote(null); addNotification('Tersimpan', 'success'); } catch(e) { addNotification('Gagal', 'error'); } finally { setIsGlobalLoading(false); } };
  const handleOpenNote = async (item: Item) => { setIsGlobalLoading(true); setGlobalLoadingMessage("Membuka..."); try { if (item.content) setEditingNote({ id: item.id, galleryId: currentFolderId, title: item.name.replace('.txt', ''), content: item.content, timestamp: item.lastUpdated }); else { const content = await API.getFileContent(item.id); const updatedItem = { ...item, content }; await DB.updateItemInCache(currentFolderId, updatedItem); if (currentFolderId === activeFolderIdRef.current) setItems(prev => prev.map(i => i.id === item.id ? updatedItem : i)); setEditingNote({ id: item.id, galleryId: currentFolderId, title: item.name.replace('.txt', ''), content: content, timestamp: item.lastUpdated }); } } catch(e) { addNotification('Gagal', 'error'); } finally { setIsGlobalLoading(false); } };
  const handleBreadcrumbClick = (index: number) => { if (index === -1) { setFolderHistory([]); setCurrentFolderId(""); } else { const target = folderHistory[index]; setFolderHistory(prev => prev.slice(0, index + 1)); setCurrentFolderId(target.id); } };
  
  const groupedItems = { folders: items.filter(i => i.type === 'folder'), notes: items.filter(i => i.type === 'note'), images: items.filter(i => i.type === 'image') };
  const isSystemFolder = currentFolderId === systemFolderId;

  if (isNotFound) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6 space-y-6">
              <div className="p-6 bg-slate-900 rounded-full shadow-2xl border border-slate-800"><AlertCircle size={64} className="text-slate-500" /></div>
              <div><h1 className="text-2xl font-bold text-white mb-2">Folder Tidak Ditemukan</h1><p className="text-slate-400 max-w-md">Link tidak valid atau database belum sinkron.</p></div>
              <button onClick={() => { setIsNotFound(false); setCurrentFolderId(""); setFolderHistory([]); window.history.replaceState(null, '', '#/'); }} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg flex items-center gap-2"><Home size={18} /> Kembali ke Home</button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 relative select-none" ref={containerRef} onContextMenu={(e) => handleContextMenu(e)} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer && e.dataTransfer.types.includes("Files") && !e.dataTransfer.types.includes("text/item-id")) setIsDraggingFile(true); }} onDragLeave={() => setIsDraggingFile(false)} onDrop={handleDrop} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
      {isDraggingFile && (<div className="fixed inset-0 z-[1000] bg-blue-500/20 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in-95"><CloudUpload size={64} className="text-blue-500 mb-4 animate-bounce" /><h2 className="text-3xl font-bold text-blue-100">Drop Files Here</h2><p className="text-blue-200 mt-2">Upload to {currentFolderId ? "Current Folder" : "Home"}</p></div>)}
      {customDragItem && customDragPos && (<div className="fixed z-[999] pointer-events-none p-4 rounded-xl border border-blue-500 bg-slate-800/90 shadow-2xl flex flex-col items-center gap-2 w-32 backdrop-blur-sm" style={{ left: customDragPos.x, top: customDragPos.y, transform: 'translate(-50%, -50%) rotate(5deg)' }}>{customDragItem.type === 'folder' ? <Folder size={32} className="text-blue-500"/> : customDragItem.type === 'note' ? <FileText size={32} className="text-yellow-500"/> : (customDragItem.thumbnail ? <img src={customDragItem.thumbnail} className="w-16 h-16 object-cover rounded"/> : <ImageIcon size={32} className="text-purple-500"/>)}<span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">{selectedIds.size > 1 ? `${selectedIds.size} Items` : customDragItem.name}</span></div>)}
      {selectionBox && (<div className="fixed z-50 bg-blue-500/20 border border-blue-400 pointer-events-none" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />)}
      {isGlobalLoading && (<div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center cursor-wait animate-in fade-in"><div className="relative"><Loader2 size={48} className="animate-spin text-blue-500 mb-4"/><div className="absolute inset-0 flex items-center justify-center"><Database size={20} className="text-blue-300 opacity-80" /></div></div><p className="text-white font-semibold text-lg animate-pulse">{globalLoadingMessage}</p></div>)}
      
      <SelectionFloatingMenu selectedIds={selectedIds} items={items} onClear={() => setSelectedIds(new Set())} onSelectAll={handleSelectAllByCategory} onAction={executeAction} containerRef={containerRef} isInRecycleBin={currentFolderId === recycleBinId} recycleBinId={recycleBinId} isSystemFolder={currentFolderId === systemFolderId} systemFolderId={systemFolderId}/>
      <UploadProgress uploads={uploadQueue} onClose={() => setUploadQueue([])} onRemove={(id) => setUploadQueue(prev => prev.filter(u => u.id !== id))} />
      <DownloadProgress downloads={downloadQueue} onClose={() => setDownloadQueue([])} onClearCompleted={() => setDownloadQueue(prev => prev.filter(d => d.status !== 'completed'))} />
      
      <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 pointer-events-none">
          {notifications.map(n => (
              <div key={n.id} className="bg-slate-800/90 backdrop-blur-md border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300">
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
        {currentFolderId !== recycleBinId && !isSystemFolder && (
        <div className="flex items-center gap-2 new-dropdown-container">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${isSavingDB ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                {isSavingDB ? <><Loader2 size={14} className="animate-spin" /> <span className="hidden sm:inline">Syncing...</span></> : <><Cloud size={14} /> <span className="hidden sm:inline">Synced</span></>}
            </div>
            <div className="relative">
                <button onClick={() => setIsNewDropdownOpen(!isNewDropdownOpen)} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg transition-all border border-transparent ${isNewDropdownOpen ? 'bg-slate-800 border-slate-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'}`}><Plus size={18} /> <span className="hidden sm:inline">Baru</span></button>
                {isNewDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150 origin-top-right floating-ui" onPointerDown={(e) => e.stopPropagation()}>
                        <button onClick={(e) => { e.stopPropagation(); executeAction('new_folder'); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded-lg flex items-center gap-3 text-sm text-slate-200 transition-colors"><Folder size={18} className="text-blue-400"/> Folder Baru</button>
                        <button onClick={(e) => { e.stopPropagation(); handleCreateNote(); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded-lg flex items-center gap-3 text-sm text-slate-200 transition-colors"><FileText size={18} className="text-yellow-400"/> Catatan Baru</button>
                        <div className="h-px bg-slate-700 my-1"></div>
                        <label className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded-lg flex items-center gap-3 text-sm text-slate-200 cursor-pointer transition-colors" onClick={(e) => e.stopPropagation()}>
                            <Upload size={18} className="text-green-400"/> Upload File
                            <input type="file" multiple className="hidden" onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} onChange={(e) => { setIsNewDropdownOpen(false); if(e.target.files) handleUploadFiles(Array.from(e.target.files)); }} />
                        </label>
                    </div>
                )}
            </div>
        </div>
        )}
        {isSystemFolder && (<div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-amber-400 text-xs font-semibold"><Lock size={14}/> Read-Only</div>)}
      </header>

      <main className="p-4 md:p-6 pb-20 space-y-8">
        {loading ? ( <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50"><Loader2 size={32} className="animate-spin text-blue-500"/><p className="text-sm">Memuat isi folder...</p></div> ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl">
                {currentFolderId === recycleBinId ? <Trash2 size={64} className="mb-4 opacity-20" /> : isSystemFolder ? <ShieldAlert size={64} className="mb-4 opacity-20 text-amber-500"/> : <Folder size={64} className="mb-4 opacity-20" />}
                <p className="font-medium">{currentFolderId === recycleBinId ? "Recycle Bin Kosong" : isSystemFolder ? "System Folder (Protected)" : "Folder Kosong"}</p>
                {currentFolderId !== recycleBinId && !isSystemFolder && (
                    <div className="mt-4 flex gap-3">
                         <button onClick={() => executeAction('new_folder')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300">Folder Baru</button>
                         <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 cursor-pointer" onClick={(e) => e.stopPropagation()}>Upload File<input type="file" multiple className="hidden" onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} onChange={(e) => { if(e.target.files) handleUploadFiles(Array.from(e.target.files)); }} /></label>
                    </div>
                )}
            </div>
        ) : (
            <>
                {groupedItems.folders.length > 0 && ( <section><div className="flex items-center gap-3 mb-4"><h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Folder size={14}/> Folders</h2><div className="h-px bg-slate-800 flex-1"></div></div><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">{groupedItems.folders.map(item => (<FolderItem key={item.id} item={item} isRecycleBin={item.id === recycleBinId} isSystem={item.id === systemFolderId || item.name === SYSTEM_FOLDER_NAME} selected={selectedIds.has(item.id)} isDropTarget={dropTargetId === item.id} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} onToggleSelect={() => handleToggleSelect(item.id)} />))}</div></section> )}
                {groupedItems.notes.length > 0 && ( <section><div className="flex items-center gap-3 mb-4 mt-8"><h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Notes</h2><div className="h-px bg-slate-800 flex-1"></div></div><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">{groupedItems.notes.map(item => (<NoteItem key={item.id} item={item} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} onToggleSelect={() => handleToggleSelect(item.id)} />))}</div></section> )}
                {groupedItems.images.length > 0 && ( <section><div className="flex items-center gap-3 mb-4 mt-8"><h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={14}/> Images</h2><div className="h-px bg-slate-800 flex-1"></div></div><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">{groupedItems.images.map(item => (<ImageItem key={item.id} item={item} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} onToggleSelect={() => handleToggleSelect(item.id)} />))}</div></section> )}
            </>
        )}
      </main>

      {currentFolderId !== recycleBinId && !isSystemFolder && (
          <div className="fixed bottom-6 left-6 z-[250] group" onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: (e as any).pageX, y: (e as any).pageY, isRecycleBinBtn: true }); }}>
              <button onClick={() => { if (recycleBinId) { setFolderHistory(prev => [...prev, { id: recycleBinId, name: RECYCLE_BIN_NAME }]); setCurrentFolderId(recycleBinId); } else { getOrCreateRecycleBin().then(id => { setFolderHistory(prev => [...prev, { id: id, name: RECYCLE_BIN_NAME }]); setCurrentFolderId(id); }); } }} className="bg-slate-800 border border-slate-700 p-3 rounded-full shadow-2xl hover:bg-slate-700 hover:border-slate-500 transition-all active:scale-95 flex items-center justify-center relative overflow-hidden"><Trash2 size={24} className="text-slate-400 group-hover:text-red-400 transition-colors" /><div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div></button>
          </div>
      )}

      {contextMenu && ( <><div className="fixed inset-0 z-[99]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}></div><div className="fixed z-[100] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1.5 min-w-[200px] animate-in fade-in zoom-in-95 duration-100 overflow-hidden floating-ui" onPointerDown={(e) => e.stopPropagation()} style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 220) }}>{contextMenu.isRecycleBinBtn ? (<> <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/50 mb-1">Recycle Bin Options</div><button onClick={() => executeAction('empty_bin')} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 text-sm transition-colors"><Trash2 size={16}/> Empty Recycle Bin</button><button onClick={() => executeAction('restore_all')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><RotateCcw size={16} className="text-green-400"/> Restore All Items</button> </>) : contextMenu.targetItem ? (<> <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/50 mb-1 truncate max-w-[200px]">{contextMenu.targetItem.name}</div>{(contextMenu.targetItem.id === recycleBinId || contextMenu.targetItem.id === systemFolderId || contextMenu.targetItem.name === SYSTEM_FOLDER_NAME) ? (<div className="px-3 py-2 text-xs text-slate-500 italic">System Folder (Protected)</div>) : (currentFolderId === recycleBinId ? (<> <button onClick={() => executeAction('restore')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><RotateCcw size={16} className="text-green-400"/> Restore</button><button onClick={() => executeAction('delete_permanent')} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 text-sm transition-colors"><Ban size={16}/> Delete Permanently</button> </>) : isSystemFolder ? (<> <button onClick={() => executeAction('download')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Download size={16} className="text-slate-400"/> Download</button> {contextMenu.targetItem.type === 'image' && (<button onClick={() => executeAction('copy_image')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Image size={16} className="text-slate-400"/> Copy Image</button>)} <div className="px-3 py-2 text-xs text-amber-500/70 italic flex items-center gap-1"><Lock size={12}/> Read-Only</div> </>) : (<> <button onClick={() => executeAction('rename')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Edit size={16} className="text-slate-400"/> Rename</button><button onClick={() => executeAction('duplicate')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Copy size={16} className="text-slate-400"/> Copy</button><button onClick={() => executeAction('move')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Move size={16} className="text-slate-400"/> Move</button>{contextMenu.targetItem.type !== 'folder' && (<><button onClick={() => executeAction('download')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Download size={16} className="text-slate-400"/> Download</button>{contextMenu.targetItem.type === 'image' && (<button onClick={() => executeAction('copy_image')} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Image size={16} className="text-slate-400"/> Copy Image</button>)}</>)}<div className="h-px bg-slate-700 my-1"/><button onClick={() => executeAction('delete')} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 text-sm transition-colors"><Trash2 size={16}/> Delete</button></>))} </>) : (<> {currentFolderId === recycleBinId ? (<> <button onClick={() => executeAction('empty_bin')} className="w-full text-left px-3 py-2.5 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 text-sm transition-colors"><Trash2 size={16}/> Empty Recycle Bin</button><button onClick={() => executeAction('restore_all')} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><RotateCcw size={16} className="text-green-400"/> Restore All Items</button><div className="h-px bg-slate-700 my-1"/><button onClick={() => { setContextMenu(null); loadFolder(currentFolderId); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Loader2 size={16} className="text-slate-400"/> Refresh</button> </>) : isSystemFolder ? (<> <div className="px-3 py-2.5 text-xs text-amber-500 flex items-center gap-2"><Lock size={14}/> System Folder Protected</div><div className="h-px bg-slate-700 my-1"/><button onClick={() => { setContextMenu(null); loadFolder(currentFolderId); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Loader2 size={16} className="text-slate-400"/> Refresh</button> </>) : (<> <button onClick={() => executeAction('new_folder')} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Folder size={16} className="text-blue-400"/> New Folder</button><button onClick={handleCreateNote} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><FileText size={16} className="text-yellow-400"/> New Note</button><label className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 cursor-pointer transition-colors" onClick={(e) => e.stopPropagation()}><Upload size={16} className="text-green-400"/> Upload File<input type="file" multiple className="hidden" onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} onChange={(e) => { setContextMenu(null); if(e.target.files) handleUploadFiles(Array.from(e.target.files)); }} /></label><div className="h-px bg-slate-700 my-1"/><button onClick={() => { setContextMenu(null); loadFolder(currentFolderId); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-200 transition-colors"><Loader2 size={16} className="text-slate-400"/> Refresh</button> </>) } </>) }</div></>)}
      
      {viewingRawFile && (<div className="fixed inset-0 z-[200] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setViewingRawFile(null)} /><div className="relative w-full max-w-4xl h-[80vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95"><div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between"><div className="flex items-center gap-3"><FileJson size={20} className="text-blue-400" /><h3 className="text-sm font-bold text-slate-200">{viewingRawFile.title}</h3><span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] text-slate-500 uppercase">Read Only</span></div><button onClick={() => setViewingRawFile(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><X size={20} /></button></div><div className="flex-1 overflow-auto p-4 bg-[#0d1117]"><pre className="text-xs md:text-sm font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed">{viewingRawFile.content}</pre></div></div></div>)}
      {previewImage && (<div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewImage(null)}><div className="absolute top-4 right-4 z-10 flex gap-2"><button onClick={(e) => { e.stopPropagation(); handleCopyImage(previewImage); }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white"><Image size={24}/></button><button onClick={(e) => { e.stopPropagation(); downloadWithProgress(previewImage, "image.jpg", true); }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white"><Download size={24}/></button><button onClick={() => setPreviewImage(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white"><X size={24}/></button></div><img src={previewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} referrerPolicy="no-referrer" /></div>)}
      {editingNote && <TextEditor note={editingNote} onSave={handleSaveNote} onClose={() => setEditingNote(null)} />}
      {modal && (<div className="fixed inset-0 z-[200] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setModal(null)} /><div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95"><div className="p-6"><h3 className="text-lg font-bold mb-2 flex items-center gap-2">{modal.isDanger && <AlertCircle className="text-red-500" size={20} />}{modal.title}</h3>{modal.message && <p className="text-sm text-slate-400 mb-4">{modal.message}</p>}{modal.type === 'input' && (<input ref={inputRef} type="text" defaultValue={modal.inputValue} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" onKeyDown={(e) => { if(e.key === 'Enter') modal.onConfirm?.(e.currentTarget.value); }} onChange={(e) => { if (modal) modal.inputValue = e.target.value; }} autoFocus />)}{modal.type === 'password' && (<input ref={inputRef} type="password" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" onKeyDown={(e) => { if(e.key === 'Enter') modal.onConfirm?.(e.currentTarget.value); }} onChange={(e) => { if (modal) modal.inputValue = e.target.value; }} autoFocus placeholder="Masukkan password..." />)}{modal.type === 'select' && modal.options && (<select ref={selectRef} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" onChange={(e) => { if (modal) modal.inputValue = e.target.value; }} defaultValue={modal.options[0]?.value}>{modal.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>)}</div><div className="bg-slate-800/50 p-4 flex gap-3 border-t border-slate-800"><button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors text-slate-300">Batal</button><button onClick={() => { let val = modal.inputValue; if (modal.type === 'select' && !val && modal.options && modal.options.length > 0) val = modal.options[0].value; modal.onConfirm?.(val); }} className={`flex-1 py-2 rounded-lg text-sm font-medium text-white shadow-lg transition-transform active:scale-95 ${modal.isDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>{modal.confirmText || 'OK'}</button></div></div></div>)}
    </div>
  );
};

// --- SUB COMPONENTS ---
interface ItemComponentProps {
  item: Item;
  selected: boolean;
  onClick: (e: React.MouseEvent, item: Item) => void;
  onDoubleClick: (e: React.MouseEvent, item: Item) => void;
  onContextMenu: (e: React.MouseEvent | React.PointerEvent, item: Item) => void;
  onToggleSelect: () => void;
}

const ItemOverlay = ({ status }: { status?: string }) => { if (!status || status === 'idle') return null; return ( <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center rounded-xl animate-in fade-in"><Loader2 size={24} className="text-blue-400 animate-spin mb-1" /><span className="text-[10px] font-bold text-white uppercase tracking-wider">{status === 'deleting' ? 'Deleting...' : 'Restoring...'}</span></div> ); };
const DragHandle = ({ item }: { item: Item }) => { return (<div className="absolute top-2 right-10 z-20 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-slate-800/80 rounded-lg hover:bg-slate-700 cursor-grab active:cursor-grabbing text-slate-400 item-handle backdrop-blur-sm border border-slate-600/30 shadow-lg" draggable={true} onDragStart={(e: React.DragEvent) => { e.dataTransfer.setData("text/item-id", item.id); if (item.type === 'note' && item.content) e.dataTransfer.setData("text/plain", stripHtml(item.content)); e.stopPropagation(); }}><GripVertical size={18} /></div>); };
const MoreBtn = ({ onTrigger }: { onTrigger: (e: React.MouseEvent | React.PointerEvent) => void }) => ( <button className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-slate-800/80 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white backdrop-blur-sm border border-slate-600/30 shadow-lg" onPointerDown={(e) => { e.stopPropagation(); onTrigger(e); }} onClick={(e) => { e.stopPropagation(); onTrigger(e); }} title="Lainnya"><MoreVertical size={18} /></button> );

const FolderItem = ({ item, selected, onClick, onDoubleClick, onContextMenu, onToggleSelect, isRecycleBin, isSystem, isDropTarget }: ItemComponentProps & { isRecycleBin?: boolean; isSystem?: boolean; isDropTarget?: boolean }) => ( <div id={`item-${item.id}`} data-folder-id={item.id} data-item-id={item.id} draggable={false} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }} style={{ touchAction: 'pan-y' }} className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-2 item-clickable select-none ${isDropTarget ? 'bg-blue-500/40 border-blue-400 scale-105 shadow-xl ring-2 ring-blue-400 z-30' : selected ? 'bg-blue-500/20 border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-600'}`}> <ItemOverlay status={item.status} /> <div className={`absolute top-2 left-2 z-20 transition-opacity selection-checkbox ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><CheckSquare size={18} className={selected ? "text-blue-500 bg-slate-900 rounded" : "text-slate-500 hover:text-slate-300"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/></div> {!isRecycleBin && !isSystem && <><DragHandle item={item} /><MoreBtn onTrigger={(e) => onContextMenu(e, item)} /></>} {isRecycleBin ? (<Trash2 size={48} className="text-red-500 fill-red-500/10 drop-shadow-md pointer-events-none" />) : isSystem ? (<div className="relative"><Folder size={48} className="text-slate-500 fill-slate-500/10 drop-shadow-md pointer-events-none" /><Lock size={16} className="absolute bottom-0 right-0 text-amber-400 bg-slate-900 rounded-full p-0.5 border border-slate-800" /></div>) : (<Folder size={48} className="text-blue-500 fill-blue-500/10 drop-shadow-md pointer-events-none" />)} <span className={`text-xs font-medium text-center truncate w-full px-1 ${isRecycleBin ? 'text-red-400' : isSystem ? 'text-slate-400' : 'text-slate-200'}`}>{item.name}</span> </div> );
const NoteItem = ({ item, selected, onClick, onDoubleClick, onContextMenu, onToggleSelect }: ItemComponentProps) => { const isDBFile = item.name.includes(DB_FILENAME_BASE); const cleanText = stripHtml(item.content || item.snippet || "").slice(0, 150); return ( <div id={`item-${item.id}`} data-item-id={item.id} draggable={false} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }} style={{ touchAction: 'pan-y' }} className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 item-clickable select-none aspect-square shadow-lg hover:shadow-xl hover:-translate-y-1 hover:rotate-1 duration-200 ${selected ? 'bg-yellow-200 border-blue-500 ring-2 ring-blue-500 scale-[1.02] z-10' : isDBFile ? 'bg-slate-800 border-slate-700 hover:border-blue-500/50' : 'bg-[#fff9c4] border-transparent hover:border-yellow-300'}`}> <ItemOverlay status={item.status} /> <div className={`absolute top-2 left-2 z-20 transition-opacity selection-checkbox ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><CheckSquare size={18} className={selected ? "text-blue-600 bg-white rounded shadow-sm" : "text-slate-600/50 hover:text-slate-900"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/></div> <DragHandle item={item} /><MoreBtn onTrigger={(e) => onContextMenu(e, item)} /> {isDBFile ? (<div className="flex-1 w-full flex flex-col items-center justify-center text-slate-400"><Database size={32} className="mb-2 text-blue-500" /><span className="text-xs font-mono font-bold text-center break-all">{item.name}</span></div>) : (<><div className="flex-1 w-full overflow-hidden flex flex-col"><h4 className="text-sm font-bold text-slate-900 mb-1.5 truncate border-b border-slate-800/10 pb-1">{item.name.replace('.txt', '')}</h4><p className="text-xs text-slate-800/90 leading-relaxed font-sans font-medium break-words whitespace-pre-wrap line-clamp-6">{cleanText || <span className="italic text-slate-500">Kosong...</span>}</p></div><div className="flex items-center justify-between w-full pt-2 mt-auto opacity-50"><FileText size={10} className="text-slate-600" /><span className="text-[9px] text-slate-600">{new Date(item.lastUpdated).toLocaleDateString()}</span></div></>)} </div> ); };
const ImageItem = ({ item, selected, onClick, onDoubleClick, onContextMenu, onToggleSelect }: ItemComponentProps) => ( <div id={`item-${item.id}`} data-item-id={item.id} draggable={false} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }} style={{ touchAction: 'pan-y' }} className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden aspect-square flex flex-col items-center justify-center bg-slate-950 item-clickable select-none ${selected ? 'border-blue-500 shadow-md ring-1 ring-blue-500' : 'border-slate-800 hover:border-slate-600'}`}> <ItemOverlay status={item.status} /> <div className={`absolute top-2 left-2 z-20 transition-opacity selection-checkbox ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><CheckSquare size={18} className={selected ? "text-blue-500 bg-slate-900 rounded" : "text-slate-500 hover:text-slate-300 shadow-sm"} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}/></div> <DragHandle item={item} /><MoreBtn onTrigger={(e) => onContextMenu(e, item)} /> {item.thumbnail || item.url ? (<img src={item.thumbnail || item.url} alt={item.name} className="w-full h-full object-cover pointer-events-none" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('bg-slate-800'); }} />) : (<ImageIcon size={32} className="text-slate-600 pointer-events-none" />)} <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-1.5 truncate pointer-events-none"><span className="text-[10px] font-medium text-slate-200 block text-center truncate">{item.name}</span></div> </div> );

const SelectionFloatingMenu = ({ selectedIds, items, onClear, onSelectAll, onAction, containerRef, isInRecycleBin, recycleBinId, isSystemFolder, systemFolderId }: { selectedIds: Set<string>, items: Item[], onClear: () => void, onSelectAll: () => void, onAction: (a: string) => void, containerRef: React.RefObject<HTMLDivElement>, isInRecycleBin: boolean, recycleBinId: string, isSystemFolder: boolean, systemFolderId: string | null }) => {
    const [pos, setPos] = useState<{top?: number, left?: number, bottom?: number, x?:number}>({ bottom: 24, left: window.innerWidth / 2 }); const [styleType, setStyleType] = useState<'contextual' | 'dock'>('dock'); const menuRef = useRef<HTMLDivElement>(null); 
    const isRecycleBinFolderSelected = !isInRecycleBin && Array.from(selectedIds).some(id => id === recycleBinId); 
    const isSystemFolderSelected = !isInRecycleBin && Array.from(selectedIds).some(id => { const item = items.find(i => i.id === id); return item?.id === systemFolderId || item?.name === SYSTEM_FOLDER_NAME; });
    const singleSelectedItem = selectedIds.size === 1 ? items.find(i => i.id === Array.from(selectedIds)[0]) : null;

    useLayoutEffect(() => {
        if (selectedIds.size === 0) return;
        const updatePosition = () => { 
            const rects: DOMRect[] = []; 
            selectedIds.forEach(id => { const el = document.getElementById(`item-${id}`); if (el) rects.push(el.getBoundingClientRect()); }); 
            if (rects.length === 0) { setStyleType('dock'); setPos({ bottom: 32, left: window.innerWidth / 2 }); return; } 
            const viewMinY = Math.min(...rects.map(r => r.top)); const viewMaxY = Math.max(...rects.map(r => r.bottom)); const centerX = Math.min(...rects.map(r => r.left)) + (Math.max(...rects.map(r => r.right)) - Math.min(...rects.map(r => r.left))) / 2; const viewportHeight = window.innerHeight; 
            if (selectedIds.size > 8 || (viewMaxY - viewMinY) > (viewportHeight * 0.4)) { setStyleType('dock'); setPos({ bottom: 32, left: window.innerWidth / 2 }); return; } 
            const menuHeight = menuRef.current ? menuRef.current.offsetHeight : 60; const gap = 12; let targetTop = (viewMinY > (80 + menuHeight + gap)) ? window.scrollY + viewMinY - menuHeight - gap : window.scrollY + viewMaxY + gap; let finalLeft = centerX; 
            if (menuRef.current) { const menuWidth = menuRef.current.offsetWidth; const minSafe = (menuWidth / 2) + 16; const maxSafe = window.innerWidth - (menuWidth / 2) - 16; finalLeft = Math.max(minSafe, Math.min(maxSafe, centerX)); } 
            setStyleType('contextual'); setPos({ top: targetTop, left: finalLeft }); 
        }; updatePosition(); window.addEventListener('resize', updatePosition); return () => window.removeEventListener('resize', updatePosition);
    }, [selectedIds, items]);

    if (selectedIds.size === 0) return null; 
    const dockStyle = "fixed z-[999] transform -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-blue-500/50 p-2 rounded-2xl shadow-2xl shadow-blue-500/10 animate-in zoom-in-95 slide-in-from-bottom-5 duration-200 transition-all max-w-[95vw] overflow-x-auto pointer-events-auto floating-ui"; 
    const contextStyle = "absolute z-[999] transform -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-blue-500/50 p-1.5 rounded-full shadow-2xl shadow-blue-500/20 animate-in fade-in zoom-in-95 duration-150 transition-all duration-300 ease-out max-w-[95vw] overflow-x-auto pointer-events-auto floating-ui"; 
    const isContext = styleType === 'contextual';
    return ( <div ref={menuRef} className={isContext ? contextStyle : dockStyle} onPointerDown={(e) => e.stopPropagation()} style={{ top: isContext ? pos.top : undefined, left: isContext ? pos.left : '50%', bottom: isContext ? undefined : pos.bottom }}> <div className={`flex items-center gap-2 ${isContext ? 'px-2' : 'px-3 border-r border-white/10 mr-1'}`}><span className="font-bold text-sm text-blue-100">{selectedIds.size}</span><button onClick={(e) => { e.stopPropagation(); onClear(); }} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><X size={14} /></button><button onClick={(e) => { e.stopPropagation(); onSelectAll(); }} className="p-1.5 hover:bg-white/10 hover:text-blue-400 rounded-full transition-colors" title="Select All in Category"><CheckCheck size={14} /></button></div> {isRecycleBinFolderSelected ? (<span className="px-2 text-xs text-slate-400 font-medium">System Folder</span>) : isSystemFolderSelected ? (<span className="px-2 text-xs text-amber-500 font-medium flex items-center gap-1"><Lock size={12}/> Protected</span>) : isInRecycleBin ? (<> <button onClick={(e) => { e.stopPropagation(); onAction('restore'); }} className="p-2.5 hover:bg-green-500/20 hover:text-green-400 rounded-lg transition-colors tooltip" title="Restore"><RotateCcw size={18}/></button><div className="w-px h-6 bg-white/10 mx-1"></div><button onClick={(e) => { e.stopPropagation(); onAction('delete_permanent'); }} className="p-2.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors tooltip" title="Delete Permanently"><Ban size={18}/></button> </>) : isSystemFolder ? (<> <button onClick={(e) => { e.stopPropagation(); onAction('download'); }} className="p-2.5 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-colors tooltip" title="Download"><Download size={18}/></button> {singleSelectedItem && singleSelectedItem.type === 'image' && (<button onClick={(e) => { e.stopPropagation(); onAction('copy_image'); }} className="p-2.5 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-colors tooltip" title="Copy Image"><Image size={18}/></button>)} <div className="px-3 py-2 text-xs text-amber-500/70 italic flex items-center gap-1"><Lock size={12}/> Read-Only</div> </>) : (<> <button onClick={(e) => { e.stopPropagation(); onAction('duplicate'); }} className="p-2.5 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-colors tooltip" title="Duplicate"><Copy size={18}/></button><button onClick={(e) => { e.stopPropagation(); onAction('move'); }} className="p-2.5 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-colors tooltip" title="Move"><Move size={18}/></button>{selectedIds.size === 1 && <button onClick={(e) => { e.stopPropagation(); onAction('rename'); }} className="p-2.5 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-colors tooltip" title="Rename"><Edit size={18}/></button>}<button onClick={(e) => { e.stopPropagation(); onAction('download'); }} className="p-2.5 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-colors tooltip" title="Download"><Download size={18}/></button><div className="w-px h-6 bg-white/10 mx-1"></div><button onClick={(e) => { e.stopPropagation(); onAction('delete'); }} className="p-2.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors tooltip" title="Delete"><Trash2 size={18}/></button> </>) } </div> );
};

export default App;

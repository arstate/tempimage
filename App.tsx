import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, MoreVertical, 
  ArrowLeft, Plus, Trash2, Copy, Move, Edit, CheckSquare, 
  Loader2, Home, Upload, ChevronRight, X, AlertCircle, Download, 
  CheckCircle, XCircle, Image, RotateCcw, Ban, GripVertical, Database, Lock, 
  ShieldAlert, Cloud, CloudUpload, FileJson, RefreshCw,
  CheckCheck, MessageSquare, Reply, Send, User, Clock,
  Grid, Monitor, Globe, Settings, ShoppingBag, Minus, Square, Search, Wifi,
  Maximize2, UploadCloud, MonitorCheck, ExternalLink, Minimize2, LayoutGrid
} from 'lucide-react';
import * as API from './services/api';
import * as DB from './services/db';
import { Item, StoredNote, DownloadItem, FolderMap, SystemDB, Comment, CommentDB, StoredImage } from './types';
import { TextEditor } from './components/TextEditor';
import { UploadProgress, UploadItem } from './components/UploadProgress';
import { DownloadProgress } from './components/DownloadProgress';
import { UploadZone } from './components/UploadZone';
import { ImageCard } from './components/ImageCard';

// --- TYPES ---
type ModalType = 'input' | 'confirm' | 'alert' | 'select' | 'password' | 'comment' | null;
interface ModalState {
  type: ModalType;
  title: string;
  message?: string;
  inputValue?: string;
  options?: { label: string; value: string }[];
  onConfirm?: (value?: string) => void;
  confirmText?: string;
  isDanger?: boolean;
  targetItem?: Item;
}

interface Notification {
  id: string;
  message: string;
  type: 'loading' | 'success' | 'error';
}

const RECYCLE_BIN_NAME = "Recycle Bin";
const SYSTEM_FOLDER_NAME = "System";
const SYSTEM_PASSWORD = "1509";
const DB_FILENAME_BASE = "system_zombio_db.json"; 

const stripHtml = (html: string) => {
  if (!html) return "";
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

// --- GALLERY APP COMPONENT ---
const GalleryApp = ({ items, onUpload, onDelete, loading }: any) => {
  const images = items.filter((i: Item) => i.type === 'image');

  return (
    <div className="h-full bg-slate-900 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-800 bg-slate-950/50">
        <UploadZone onFilesSelected={onUpload} />
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        {loading && images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-50">
            <Loader2 size={40} className="animate-spin text-blue-500 mb-2" />
            <p className="text-slate-400 text-sm">Memuat galeri...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl p-12">
            <ImageIcon size={64} className="mb-4 opacity-10" />
            <p className="text-lg font-medium">Belum ada foto</p>
            <p className="text-sm opacity-60">Upload gambar pertama Anda untuk memulai galeri</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {images.map((img: Item, idx: number) => (
              <ImageCard 
                key={img.id} 
                image={{
                  id: img.id,
                  galleryId: "",
                  name: img.name,
                  type: "image/jpeg",
                  size: 0,
                  data: img.url || "",
                  timestamp: img.lastUpdated
                }} 
                index={idx} 
                onDelete={onDelete} 
                onMaximize={(url) => window.open(url, '_blank')} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- APP STORE COMPONENT ---
const AppStoreApp = ({ config, setConfig, addNotification }: any) => {
  const [appName, setAppName] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);

  const popularApps = [
    { id: 'gallery', name: 'Gallery', url: 'internal://gallery', icon: 'image' },
    { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/embed', icon: 'globe' },
    { id: 'spotify', name: 'Spotify', url: 'https://open.spotify.com/embed', icon: 'globe' },
    { id: 'canva', name: 'Canva', url: 'https://www.canva.com', icon: 'globe' },
    { id: 'google-maps', name: 'Maps', url: 'https://www.google.com/maps/embed', icon: 'globe' }
  ];

  const handleInstall = async (app: any) => {
    if (!config) return;
    if (config.installedApps.some((a: any) => a.url === app.url)) {
      addNotification("Aplikasi sudah terpasang", "error");
      return;
    }
    
    setIsInstalling(true);
    const updatedConfig = {
      ...config,
      installedApps: [...config.installedApps, { ...app, type: app.url.startsWith('internal') ? 'system' : 'webapp' }]
    };
    
    try {
      await API.saveSystemConfig(updatedConfig);
      setConfig(updatedConfig);
      addNotification(`${app.name} berhasil ditambahkan`, "success");
    } catch (e) {
      addNotification("Gagal menyimpan konfigurasi", "error");
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUninstall = async (appId: string) => {
    if (!config) return;
    const app = config.installedApps.find((a: any) => a.id === appId);
    if (app?.type === 'system' && app?.id === 'file-explorer') {
       addNotification("Aplikasi sistem tidak dapat dihapus", "error");
       return;
    }

    const updatedConfig = {
      ...config,
      installedApps: config.installedApps.filter((a: any) => a.id !== appId)
    };

    try {
      await API.saveSystemConfig(updatedConfig);
      setConfig(updatedConfig);
      addNotification("Aplikasi berhasil dihapus", "success");
    } catch (e) {
      addNotification("Gagal menghapus aplikasi", "error");
    }
  };

  const handleCustomInstall = () => {
    if (!appName.trim() || !appUrl.trim()) {
        addNotification("Isi nama dan URL!", "error");
        return;
    }
    const cleanUrl = appUrl.startsWith('http') || appUrl.startsWith('internal') ? appUrl : `https://${appUrl}`;
    const newApp = {
      id: 'custom-' + Date.now(),
      name: appName,
      url: cleanUrl,
      icon: 'globe',
      type: 'webapp'
    };
    handleInstall(newApp);
    setAppName('');
    setAppUrl('');
  };

  return (
    <div className="h-full bg-slate-900 text-white p-4 sm:p-8 overflow-y-auto space-y-8 pb-20">
      <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
        <div className="p-3 bg-pink-500/20 rounded-2xl shadow-xl">
          <ShoppingBag size={40} className="text-pink-500" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">App Store</h1>
          <p className="text-slate-400 text-xs sm:text-sm">Pasang aplikasi web favorit ke desktop cloud Anda</p>
        </div>
      </div>

      {/* CUSTOM INSTALL FORM */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2 text-blue-400">
           <Plus size={20} /> Install Web App Baru
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 backdrop-blur-md">
          <div className="space-y-1">
             <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Nama Aplikasi</label>
             <input 
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                placeholder="Contoh: ChatGPT" 
                value={appName}
                onChange={e => setAppName(e.target.value)}
              />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">URL Web (https://...)</label>
            <div className="flex gap-2">
              <input 
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                placeholder="Contoh: chat.openai.com" 
                value={appUrl}
                onChange={e => setAppUrl(e.target.value)}
              />
              <button 
                onClick={handleCustomInstall}
                disabled={isInstalling || !appName || !appUrl}
                className="px-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2"
              >
                {isInstalling ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                <span>Instal</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALLED APPS LIST */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
           <CheckCircle size={20} className="text-green-500"/> Terpasang
        </h2>
        <div className="space-y-2">
           {config?.installedApps.map((app: any) => (
             <div key={app.id} className="flex justify-between items-center p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl group hover:bg-slate-800/60 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center text-blue-400 border border-slate-800">
                    {app.icon === 'image' ? <ImageIcon size={24} className="text-pink-400" /> :
                     app.icon === 'folder' ? <Folder size={24} className="text-blue-400"/> :
                     app.icon === 'settings' ? <Settings size={24} className="text-slate-400"/> :
                     app.icon === 'shopping-bag' ? <ShoppingBag size={24} className="text-pink-400"/> :
                     <Globe size={24} />}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{app.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{app.type === 'system' ? 'System App' : app.url}</div>
                  </div>
                </div>
                {app.type === 'webapp' && (
                  <button 
                    onClick={() => handleUninstall(app.id)}
                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Hapus Aplikasi"
                  >
                    <Trash2 size={18}/>
                  </button>
                )}
             </div>
           ))}
        </div>
      </section>

      {/* RECOMMENDATIONS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-300">Rekomendasi Aplikasi</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {popularApps.map(app => {
            const isInstalled = config?.installedApps.some((a: any) => a.url === app.url);
            return (
              <div key={app.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 flex flex-col items-center gap-4 group hover:bg-slate-800/60 transition-all">
                <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl relative">
                  {app.icon === 'image' ? <ImageIcon size={32} className="text-pink-400" /> : <Globe size={32} className="text-blue-400" />}
                  {isInstalled && <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1"><CheckCircle size={10} className="text-white"/></div>}
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm">{app.name}</p>
                  <p className="text-[10px] text-slate-500">{app.url.startsWith('internal') ? 'System App' : 'PWA / Web View'}</p>
                </div>
                <button 
                  onClick={() => handleInstall(app)}
                  disabled={isInstalled}
                  className={`w-full py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${isInstalled ? 'bg-slate-700 text-slate-400' : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white'}`}
                >
                  {isInstalled ? 'Terpasang' : 'Instal'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

// --- FILE EXPLORER APP COMPONENT ---
const FileExplorerApp = ({ 
    currentFolderId, setCurrentFolderId,
    folderHistory, setFolderHistory,
    items, setItems,
    loading, setLoading,
    systemMap, setSystemMap,
    dbFileId, setDbFileId,
    comments, setComments,
    recycleBinId, setRecycleBinId,
    systemFolderId, setSystemFolderId,
    isSavingDB, setIsSavingDB,
    isSavingComments, setIsSavingComments,
    triggerCloudSync, triggerCommentSync,
    handleRefreshComments,
    addNotification, removeNotification, updateNotification,
    setModal, modal,
    setEditingNote,
    setViewingRawFile,
    setPreviewImage,
    handleUploadFiles,
    executeAction,
    loadFolder,
    selectedIds, setSelectedIds,
    onContextMenu 
}: any) => {
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{x:number, y:number, width:number, height:number} | null>(null);
  const [customDragItem, setCustomDragItem] = useState<Item | null>(null);
  const [customDragPos, setCustomDragPos] = useState<{x:number, y:number} | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [isExternalDragging, setIsExternalDragging] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{x:number, y:number} | null>(null);
  const isPaintingRef = useRef<boolean>(false); 
  const longPressTimerRef = useRef<any>(null);

  // EXTERNAL DRAG AND DROP HANDLERS
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsExternalDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExternalDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExternalDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
     if ((e.target as HTMLElement).closest('button, .item-handle, .floating-ui, select, input, .comment-area')) return;
     
     const target = e.target as HTMLElement;
     const checkbox = target.closest('.selection-checkbox');
     const itemRow = target.closest('[data-item-id]');
     
     if (e.button === 2) return;

     const rect = containerRef.current?.getBoundingClientRect();
     const localX = e.clientX - (rect?.left || 0);
     const localY = e.clientY - (rect?.top || 0);

     dragStartPos.current = { x: localX, y: localY };
     if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
     
     if (checkbox && itemRow) {
         e.stopPropagation();
         const id = itemRow.getAttribute('data-item-id');
         if(id) { 
            setSelectedIds((prev: Set<string>) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
            setLastSelectedId(id);
            isPaintingRef.current = true; 
         }
         setIsDragSelecting(true);
     } else if (itemRow) {
         const id = itemRow.getAttribute('data-item-id');
         if (id) {
             const clickedItem = items.find((i: Item) => i.id === id);
             if (clickedItem) {
                 longPressTimerRef.current = setTimeout(() => {
                     if (clickedItem.id === systemFolderId || currentFolderId === systemFolderId) return;
                     setCustomDragItem(clickedItem); 
                     setCustomDragPos({ x: e.clientX, y: e.clientY });
                     if (!selectedIds.has(clickedItem.id)) setSelectedIds(new Set([clickedItem.id]));
                     if (navigator.vibrate) navigator.vibrate(50);
                 }, 500); 
             }
         }
         isPaintingRef.current = false; 
     } else {
         isPaintingRef.current = false; 
         setSelectionBox({ x: localX, y: localY, width: 0, height: 0 });
         setIsDragSelecting(true); 
         if (!e.ctrlKey && !e.shiftKey) setSelectedIds(new Set());
     }
     setIsNewDropdownOpen(false);
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

     const rect = containerRef.current?.getBoundingClientRect();
     if (!rect) return;
     const currentLocalX = e.clientX - rect.left;
     const currentLocalY = e.clientY - rect.top;

     const moveDist = Math.sqrt(Math.pow(currentLocalX - dragStartPos.current.x, 2) + Math.pow(currentLocalY - dragStartPos.current.y, 2));
     if (moveDist > 5) {
         if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
         if (!isDragSelecting) { setIsDragSelecting(true); }
         
         const x = Math.min(dragStartPos.current.x, currentLocalX); 
         const y = Math.min(dragStartPos.current.y, currentLocalY);
         const width = Math.abs(currentLocalX - dragStartPos.current.x); 
         const height = Math.abs(currentLocalY - dragStartPos.current.y);
         setSelectionBox({ x, y, width, height });
         
         const newSelected = new Set(selectedIds);
         items.forEach((item: Item) => {
            const el = document.getElementById(`item-${item.id}`);
            if (el) {
                const itemRect = el.getBoundingClientRect();
                const relativeItemLeft = itemRect.left - rect.left;
                const relativeItemTop = itemRect.top - rect.top;
                const relativeItemRight = itemRect.right - rect.left;
                const relativeItemBottom = itemRect.bottom - rect.top;

                if (x < relativeItemRight && x + width > relativeItemLeft && y < relativeItemBottom && y + height > relativeItemTop) {
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
      setCustomDragItem(null); setCustomDragPos(null); setDropTargetId(null); setIsDragSelecting(false); setSelectionBox(null); dragStartPos.current = null; isPaintingRef.current = false;
      if (currentDrag && targetId) {
          if (targetId === systemFolderId) {
              addNotification("Cannot move to System folder", "error");
          } else {
              const idsToMove: string[] = selectedIds.size > 0 ? Array.from(selectedIds) : [currentDrag.id];
              const targetName = items.find((i: Item) => i.id === targetId)?.name || "Folder";
              const backupItems = [...items];
              setItems((prev: Item[]) => prev.map(item => idsToMove.includes(item.id) ? { ...item, status: 'moving' } : item));
              const notifId = addNotification(`Moving ${idsToMove.length} items to ${targetName}...`, 'loading');
              try {
                  const finalTargetId = targetId === "" ? "root" : targetId;
                  await API.moveItems(idsToMove, finalTargetId);
                  updateNotification(notifId, 'Moved successfully', 'success');
                  await loadFolder(currentFolderId);
              } catch(err) {
                  updateNotification(notifId, 'Move failed', 'error');
                  setItems(backupItems); 
              } 
          }
      }
  };

  const handleItemClick = (e: React.MouseEvent, item: Item) => {
    if (isPaintingRef.current || customDragItem) return;
    if (e.shiftKey && lastSelectedId) {
        const lastIndex = items.findIndex((i: Item) => i.id === lastSelectedId);
        const currentIndex = items.findIndex((i: Item) => i.id === item.id);
        if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex); const end = Math.max(lastIndex, currentIndex);
            const rangeIds = items.slice(start, end + 1).map((i: Item) => i.id);
            const newSet = new Set(selectedIds); rangeIds.forEach(itemId => newSet.add(itemId)); setSelectedIds(newSet);
        }
    } else if (e.ctrlKey || e.metaKey) { 
        // Fix for "Cannot find name 'id'" - changed 'id' to 'item.id'
        setSelectedIds((prev: Set<string>) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; });
        setLastSelectedId(item.id);
    } 
    else { setSelectedIds(new Set([item.id])); setLastSelectedId(item.id); }
  };

  const handleItemDoubleClick = async (e: React.MouseEvent, item: Item) => {
    e.stopPropagation();
    if (item.type === 'folder') {
        if (item.id === systemFolderId || item.name === SYSTEM_FOLDER_NAME) {
            setModal({
                type: 'password', title: 'System Folder Locked', message: 'Enter password (1509)', confirmText: 'Open', inputValue: '',
                onConfirm: (val) => {
                    if (val === SYSTEM_PASSWORD) { 
                      setModal(null); 
                      setFolderHistory((prev: any[]) => [...prev, { id: item.id, name: item.name }]); 
                      setCurrentFolderId(item.id); 
                    } 
                    else { addNotification("Incorrect Password", "error"); }
                }
            });
            return;
        }
        setFolderHistory((prev: any[]) => [...prev, { id: item.id, name: item.name }]); 
        setCurrentFolderId(item.id);
    } else if (item.type === 'note') {
        if (item.name.includes(DB_FILENAME_BASE)) { 
            const notifId = addNotification('Reading Database...', 'loading');
            try {
                let content = item.content;
                if (!content) content = await API.getFileContent(item.id);
                try { const json = JSON.parse(content || "{}"); content = JSON.stringify(json, null, 2); } catch(e) {}
                setViewingRawFile({ title: item.name, content: content || "" }); removeNotification(notifId);
            } catch(e) { updateNotification(notifId, 'Failed to open DB', 'error'); }
        } else { 
            setItems((prev: Item[]) => prev.map(i => i.id === item.id ? { ...i, status: 'creating' } : i));
            await handleOpenNote(item); 
            setItems((prev: Item[]) => prev.map(i => i.id === item.id ? { ...i, status: 'idle' } : i));
        }
    } else if (item.type === 'image') { setPreviewImage(item.url || null); }
  };

  const handleOpenNote = async (item: Item) => { 
    const notifId = addNotification("Opening note...", "loading"); 
    try { 
        let content = item.content; 
        if (!content) content = await API.getFileContent(item.id); 
        setEditingNote({ id: item.id, galleryId: currentFolderId, title: item.name.replace('.txt', ''), content: content || "", timestamp: item.lastUpdated }); 
        removeNotification(notifId);
    } catch(e) { updateNotification(notifId, 'Failed to open', 'error'); } 
  };

  const localHandleContextMenu = (e: React.MouseEvent | React.PointerEvent, item?: Item) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (item && !selectedIds.has(item.id)) { 
        setSelectedIds(new Set([item.id])); 
        setLastSelectedId(item.id); 
    }
    onContextMenu(e, item, currentFolderId === recycleBinId);
  };

  const groupedItems = { 
    folders: items.filter((i: Item) => i.type === 'folder'), 
    notes: items.filter((i: Item) => i.type === 'note'), 
    images: items.filter((i: Item) => i.type === 'image') 
  };
  const isSystemFolder = currentFolderId === systemFolderId;

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-slate-900 overflow-hidden relative touch-none" 
         onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
         onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
         onContextMenu={(e) => localHandleContextMenu(e)}>
      
      {selectionBox && (<div className="absolute z-[150] bg-blue-500/20 border border-blue-400 pointer-events-none" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />)}
      
      {isExternalDragging && (
        <div className="absolute inset-0 z-[160] bg-blue-600/20 backdrop-blur-[2px] border-2 border-dashed border-blue-500 m-4 rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in-95">
           <UploadCloud size={48} className="text-blue-500 mb-2 animate-bounce"/>
           <span className="text-lg font-bold text-blue-500 uppercase tracking-widest">Drop files to upload</span>
        </div>
      )}

      {/* Explorer Header */}
      <div className="flex items-center justify-between p-3 bg-slate-950/50 border-b border-slate-800">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
           <button onClick={() => { setFolderHistory([]); setCurrentFolderId(""); }} className={`p-1.5 rounded-lg flex items-center gap-2 text-xs font-medium transition-colors ${currentFolderId === "" ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:bg-slate-800'}`}><Home size={16} /> Home</button>
           {folderHistory.map((h: any, idx: number) => ( <React.Fragment key={h.id}><ChevronRight size={12} className="text-slate-600 flex-shrink-0" /><button onClick={() => { setFolderHistory((prev: any[]) => prev.slice(0, idx+1)); setCurrentFolderId(h.id); }} className={`p-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${idx === folderHistory.length - 1 ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:bg-slate-800'}`}>{h.name}</button></React.Fragment> ))}
        </div>
        {currentFolderId !== recycleBinId && !isSystemFolder && (
          <div className="flex items-center gap-2">
            <button onPointerDown={(e) => { e.stopPropagation(); setIsNewDropdownOpen(!isNewDropdownOpen); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 text-xs font-bold transition-all"><Plus size={14} /> New</button>
            {isNewDropdownOpen && (
              <div className="absolute right-3 top-12 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 p-1 animate-in zoom-in-95 duration-150 origin-top-right">
                <button onClick={() => { setIsNewDropdownOpen(false); executeAction('new_folder'); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg flex items-center gap-2 text-xs"><Folder size={14} className="text-blue-400"/> New Folder</button>
                <button onClick={() => { setIsNewDropdownOpen(false); setEditingNote({ id: 'temp-'+Date.now(), galleryId: currentFolderId, title: 'Untitled Note', content: '', timestamp: Date.now() }); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg flex items-center gap-2 text-xs"><FileText size={14} className="text-yellow-400"/> New Note</button>
                <button onClick={() => { setIsNewDropdownOpen(false); executeAction('native_upload'); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg flex items-center gap-2 text-xs"><Upload size={14} className="text-green-400"/> Upload File</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Explorer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading && items.length === 0 ? ( <div className="flex flex-col items-center justify-center py-10 opacity-50"><Loader2 size={32} className="animate-spin text-blue-500"/></div> ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
             <Folder size={48} className="mb-2 opacity-20"/>
             <p className="text-sm">This folder is empty</p>
          </div>
        ) : (
          <>
            {groupedItems.folders.length > 0 && ( <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{groupedItems.folders.map((item: Item) => (<FolderItem key={item.id} item={item} hasComments={(comments[item.id]?.length || 0) > 0} isRecycleBin={item.id === recycleBinId} isSystem={item.id === systemFolderId || item.name === SYSTEM_FOLDER_NAME} selected={selectedIds.has(item.id)} isDropTarget={dropTargetId === item.id} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={localHandleContextMenu} onToggleSelect={() => { setSelectedIds((prev: Set<string>) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; }); setLastSelectedId(item.id); }} onCommentClick={async () => { setItems((prev: Item[]) => prev.map(i => i.id === item.id ? { ...i, status: 'creating' } : i)); await handleRefreshComments(); setItems((prev: Item[]) => prev.map(i => i.id === item.id ? { ...i, status: 'idle' } : i)); setModal({ type: 'comment', title: `Comments: ${item.name}`, targetItem: item }); }} />))}</div> )}
            {groupedItems.notes.length > 0 && ( <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{groupedItems.notes.map((item: Item) => (<NoteItem key={item.id} item={item} hasComments={(comments[item.id]?.length || 0) > 0} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={localHandleContextMenu} onToggleSelect={() => { setSelectedIds((prev: Set<string>) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; }); setLastSelectedId(item.id); }} onCommentClick={async () => { setItems((prev: Item[]) => prev.map(i => i.id === item.id ? { ...i, status: 'creating' } : i)); await handleRefreshComments(); setItems((prev: Item[]) => prev.map(i => i.id === item.id ? { ...i, status: 'idle' } : i)); setModal({ type: 'comment', title: `Comments: ${item.name}`, targetItem: item }); }} />))}</div> )}
            {groupedItems.images.length > 0 && ( <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{groupedItems.images.map((item: Item) => (<ImageItem key={item.id} item={item} hasComments={(comments[item.id]?.length || 0) > 0} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={localHandleContextMenu} onToggleSelect={() => { setSelectedIds((prev: Set<string>) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; }); setLastSelectedId(item.id); }} onCommentClick={async () => { setItems((prev: Item[]) => prev.map(i => i.id === item.id ? { ...i, status: 'creating' } : i)); await handleRefreshComments(); setItems((prev: Item[]) => prev.map(i => i.id === item.id ? { ...i, status: 'idle' } : i)); setModal({ type: 'comment', title: `Comments: ${item.name}`, targetItem: item }); }} />))}</div> )}
          </>
        )}
      </div>

      {/* Floating Selection Menu in-app */}
      {selectedIds.size > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-full px-4 py-2 flex items-center gap-3 shadow-2xl z-[80] animate-in slide-in-from-bottom-5">
              <span className="text-xs font-bold text-blue-400">{selectedIds.size} Selected</span>
              <div className="w-px h-4 bg-slate-700"></div>
              <button onClick={() => executeAction('comment')} className="p-1.5 hover:bg-slate-800 rounded-lg text-blue-400" title="Comment"><MessageSquare size={16}/></button>
              <button onClick={() => executeAction('download')} className="p-1.5 hover:bg-slate-800 rounded-lg text-emerald-400" title="Download"><Download size={16}/></button>
              <button onClick={() => executeAction('move')} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300" title="Move"><Move size={16}/></button>
              <button onClick={() => executeAction('duplicate')} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300" title="Duplicate"><Copy size={16}/></button>
              <button onClick={() => executeAction('delete')} className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500" title="Delete"><Trash2 size={16}/></button>
              <button onClick={() => setSelectedIds(new Set())} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500" title="Cancel Selection"><X size={16}/></button>
          </div>
      )}
    </div>
  );
};

// --- SETTINGS APP COMPONENT ---
const SettingsApp = ({ config, onSave }: any) => {
  const [localConfig, setLocalConfig] = useState(config);
  return (
    <div className="h-full bg-slate-900 text-white p-6 flex flex-col gap-6 overflow-auto">
      <h2 className="text-2xl font-bold flex items-center gap-3 text-white"><Settings size={28} className="text-blue-600"/> Settings</h2>
      <div className="space-y-6 max-w-lg">
        <section className="bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Appearance</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Wallpaper URL</label>
              <input 
                className="w-full p-2 border border-slate-700 rounded-lg text-sm bg-slate-950 text-white focus:outline-none focus:border-blue-500" 
                value={localConfig.wallpaper} 
                onChange={(e) => setLocalConfig({...localConfig, wallpaper: e.target.value})}
              />
            </div>
          </div>
        </section>
        <button 
          onClick={() => onSave(localConfig)}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

// --- MAIN OS SHELL APP ---
const App = () => {
  const [config, setConfig] = useState<API.SystemConfig | null>(null);
  const [windows, setWindows] = useState<any[]>([]); 
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [globalContextMenu, setGlobalContextMenu] = useState<{x:number, y:number, targetItem?: Item, isRecycleBin?: boolean} | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // EXPLORER STATE
  const [currentFolderId, setCurrentFolderId] = useState<string>(""); 
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
  const [recycleBinId, setRecycleBinId] = useState<string>("");
  const [isSystemInitialized, setIsSystemInitialized] = useState(false);
  const [isSavingDB, setIsSavingDB] = useState(false);
  const [isSavingComments, setIsSavingComments] = useState(false);
  const [isGlobalLoading, setIsGlobalLoading] = useState(true); 
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState("Booting System...");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [editingNote, setEditingNote] = useState<StoredNote | null>(null);
  const [viewingRawFile, setViewingRawFile] = useState<{title: string, content: string} | null>(null); 
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [commentName, setCommentName] = useState(localStorage.getItem('zombio_comment_name') || '');
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Interaction State (Mobile Performance)
  const [isInteracting, setIsInteracting] = useState(false);

  // --- FULLSCREEN LOGIC ---
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.error(e));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // --- OS BOOT ---
  useEffect(() => {
    const boot = async () => {
      try {
        setGlobalLoadingMessage("Loading System Configuration...");
        const osConfig = await API.getSystemConfig();
        setConfig(osConfig);

        setGlobalLoadingMessage("Locating Cloud Storage...");
        const cloudLocation = await API.locateSystemDB();
        let sysFolderId = cloudLocation.systemFolderId;
        let curDbFileId = cloudLocation.fileId; 
        let curCommentFileId = cloudLocation.commentFileId;

        if (!sysFolderId) {
            setGlobalLoadingMessage("Initializing System Folder...");
            sysFolderId = await API.createSystemFolder();
        }
        setSystemFolderId(sysFolderId);

        let finalMap: FolderMap = { "root": { id: "root", name: "Home", parentId: "" } };
        if (curDbFileId) {
            setGlobalLoadingMessage("Syncing File System DB...");
            const content = await API.getFileContent(curDbFileId);
            finalMap = JSON.parse(content);
        } else {
            curDbFileId = await API.createSystemDBFile(finalMap, sysFolderId);
        }

        let finalComments: CommentDB = {};
        if (curCommentFileId) {
            setGlobalLoadingMessage("Syncing Comments DB...");
            const content = await API.getFileContent(curCommentFileId);
            finalComments = JSON.parse(content);
        } else {
            curCommentFileId = await API.createCommentDBFile(finalComments, sysFolderId);
        }

        systemMapRef.current = finalMap; setSystemMap(finalMap); setDbFileId(curDbFileId);
        commentsRef.current = finalComments; setComments(finalComments); setCommentFileId(curCommentFileId);
        
        await DB.saveSystemMap({ fileId: curDbFileId, map: finalMap, lastSync: Date.now() });
        await DB.saveCommentsCache(finalComments);

        setIsSystemInitialized(true);
      } catch (e) {
        console.error("Boot Error:", e);
      } finally {
        setIsGlobalLoading(false);
      }
    };
    boot();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- SHARED EXPLORER ACTIONS ---
  const loadFolder = useCallback(async (folderId: string = "") => {
    const cacheKey = folderId || "root";
    const cached = await DB.getCachedFolder(cacheKey);
    if (cached) setItems(cached);
    else { setItems([]); setLoading(true); }
    
    setSelectedIds(new Set());
    try {
      const res = await API.getFolderContents(folderId);
      if (res.status === 'success') {
        const freshItems: Item[] = (Array.isArray(res.data) ? res.data : []);
        freshItems.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        if (folderId === "") {
            const bin = freshItems.find(i => i.name === RECYCLE_BIN_NAME && i.type === 'folder');
            if (bin) setRecycleBinId(bin.id);
        }
        setItems(freshItems);
        await DB.cacheFolderContents(cacheKey, freshItems);
        const folders = freshItems.filter(i => i.type === 'folder');
        if (folders.length > 0) {
            const nextMap = { ...systemMapRef.current };
            folders.forEach(f => { nextMap[f.id] = { id: f.id, name: f.name, parentId: folderId || "root" }; });
            systemMapRef.current = nextMap; setSystemMap(nextMap); triggerCloudSync();
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [systemMap]);

  useEffect(() => { if (isSystemInitialized) loadFolder(currentFolderId); }, [currentFolderId, isSystemInitialized]);

  const triggerCloudSync = useCallback(() => {
    if (!dbFileId) return;
    setIsSavingDB(true);
    setTimeout(async () => {
      try { await API.updateSystemDBFile(dbFileId, systemMapRef.current); setIsSavingDB(false); } 
      catch (e) { setIsSavingDB(false); }
    }, 5000);
  }, [dbFileId]);

  const triggerCommentSync = useCallback(async () => {
    if (!commentFileId) return;
    setIsSavingComments(true);
    try { 
      await API.updateCommentDBFile(commentFileId, commentsRef.current); 
      await DB.saveCommentsCache(commentsRef.current); 
    } 
    catch (e) { console.error(e); } finally { setIsSavingComments(false); }
  }, [commentFileId]);

  const handleRefreshComments = useCallback(async () => {
    if (!commentFileId) return;
    try {
        const content = await API.getFileContent(commentFileId);
        const remoteComments = JSON.parse(content);
        commentsRef.current = remoteComments; setComments(remoteComments);
        await DB.saveCommentsCache(remoteComments);
    } catch (e) { console.error(e); }
  }, [commentFileId]);

  const addNotification = (message: string, type: 'loading' | 'success' | 'error' = 'success', duration = 3000) => {
    const id = Math.random().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    if (type !== 'loading') setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), duration);
    return id;
  };
  
  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  
  const updateNotification = (id: string, message: string, type: 'success' | 'error') => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, message, type } : n));
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3000);
  };

  const handleDownloadItems = async (ids: string[]) => {
    const itemsToDownload = items.filter(i => ids.includes(i.id) && i.type === 'image');
    if (itemsToDownload.length === 0) return addNotification("Only images can be downloaded", "error");

    const newDownloads: DownloadItem[] = itemsToDownload.map(i => ({
      id: i.id, name: i.name, status: 'pending', progress: 0
    }));

    setDownloadQueue(prev => [...prev, ...newDownloads]);

    for (const dItem of newDownloads) {
        setDownloadQueue(prev => prev.map(d => d.id === dItem.id ? { ...d, status: 'downloading' } : d));
        try {
            const item = itemsToDownload.find(i => i.id === dItem.id);
            if (!item || !item.url) throw new Error("URL missing");

            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(item.url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("Fetch failed");
            
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = item.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
            setDownloadQueue(prev => prev.map(d => d.id === dItem.id ? { ...d, status: 'completed', progress: 100 } : d));
        } catch (e) {
            setDownloadQueue(prev => prev.map(d => d.id === dItem.id ? { ...d, status: 'error', error: 'Failed' } : d));
        }
    }
  };

  const executeAction = async (action: string) => {
    const ids = Array.from(selectedIds);
    switch (action) {
      case 'comment':
        const targetComment = items.find(i => i.id === ids[0]);
        if(targetComment) {
          setItems(prev => prev.map(i => i.id === targetComment.id ? { ...i, status: 'creating' } : i));
          await handleRefreshComments();
          setItems(prev => prev.map(i => i.id === targetComment.id ? { ...i, status: 'idle' } : i));
          setModal({ type: 'comment', title: `Comments: ${targetComment.name}`, targetItem: targetComment });
        }
        break;
      case 'download':
        handleDownloadItems(ids);
        break;
      case 'new_folder':
        setModal({ type: 'input', title: 'New Folder', inputValue: 'Untitled Folder', onConfirm: async (name) => {
          if(!name) return; setModal(null); const notif = addNotification('Creating folder...', 'loading');
          try { await API.createFolder(currentFolderId, name); updateNotification(notif, 'Folder created', 'success'); await loadFolder(currentFolderId); }
          catch(e) { updateNotification(notif, 'Failed', 'error'); }
        }});
        break;
      case 'native_upload': {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.onchange = (e: any) => {
            if (e.target.files) handleUploadFiles(Array.from(e.target.files));
          };
          input.click();
          break;
      }
      case 'rename':
        const target = items.find(i => i.id === ids[0]);
        if(!target) return;
        setModal({ type: 'input', title: 'Rename', inputValue: target.name, onConfirm: async (newName) => {
          if(!newName) return; setModal(null); const notif = addNotification('Renaming...', 'loading');
          try { await API.renameItem(target.id, newName); updateNotification(notif, 'Renamed', 'success'); await loadFolder(currentFolderId); }
          catch(e) { updateNotification(notif, 'Failed', 'error'); }
        }});
        break;
      case 'delete':
        setModal({ type: 'confirm', title: 'Move to Recycle Bin?', isDanger: true, confirmText: 'Delete', onConfirm: async () => {
          setModal(null); const notif = addNotification('Deleting...', 'loading');
          try { 
            const binId = recycleBinId || (await API.createFolder("", RECYCLE_BIN_NAME)).data.id;
            await API.moveItems(ids, binId); updateNotification(notif, 'Deleted', 'success'); await loadFolder(currentFolderId); 
          } catch(e) { updateNotification(notif, 'Failed', 'error'); }
        }});
        break;
      case 'duplicate':
        const notifDup = addNotification('Duplicating...', 'loading');
        try { await API.duplicateItems(ids); updateNotification(notifDup, 'Duplicated', 'success'); await loadFolder(currentFolderId); }
        catch(e) { updateNotification(notifDup, 'Failed', 'error'); }
        break;
      case 'move':
        const opts = Object.values(systemMap).map(f => ({ label: f.name, value: f.id }));
        setModal({ type: 'select', title: 'Move to...', options: opts, onConfirm: async (targetId) => {
          if(!targetId) return; setModal(null); const notif = addNotification('Moving...', 'loading');
          try { await API.moveItems(ids, targetId); updateNotification(notif, 'Moved', 'success'); await loadFolder(currentFolderId); }
          catch(e) { updateNotification(notif, 'Failed', 'error'); }
        }});
        break;
    }
  };

  const handleUploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const newUploads: UploadItem[] = files.map(f => ({ id: Math.random().toString(), file: f, status: 'uploading', progress: 0 }));
    setUploadQueue(prev => [...prev, ...newUploads]);
    for (const up of newUploads) {
      try { await API.uploadToDrive(up.file, currentFolderId); setUploadQueue(prev => prev.map(u => u.id === up.id ? {...u, status:'success', progress: 100} : u)); }
      catch(e) { setUploadQueue(prev => prev.map(u => u.id === up.id ? {...u, status:'error'} : u)); }
    }
    await loadFolder(currentFolderId);
  };

  const handleSaveNote = async (id: string, title: string, content: string) => { 
    setGlobalLoadingMessage("Saving note..."); setIsGlobalLoading(true); 
    try { 
        const isNew = id.startsWith('temp-'); 
        await API.saveNoteToDrive(title, content, currentFolderId, isNew ? undefined : id); 
        setEditingNote(null); 
        addNotification('Note saved', 'success'); 
        await loadFolder(currentFolderId); 
    } catch(e) { addNotification('Failed to save', 'error'); } finally { setIsGlobalLoading(false); } 
  };

  const handleAddComment = async () => {
    if (!commentName.trim() || !commentText.trim() || !modal?.targetItem) return;
    setIsPostingComment(true); 
    const targetId = modal.targetItem.id;
    const newComment: Comment = { 
      id: Date.now().toString(), itemId: targetId, author: commentName, text: commentText, timestamp: Date.now() 
    };
    const next = { ...commentsRef.current }; 
    if (!next[targetId]) next[targetId] = []; 
    next[targetId] = [...next[targetId], newComment];
    commentsRef.current = next; setComments(next);
    try { await triggerCommentSync(); setCommentText(''); addNotification("Comment posted", "success"); } 
    catch (e) { addNotification("Failed", "error"); } finally { setIsPostingComment(false); }
  };

  // --- PERFORMANCE OPTIMIZED WINDOW MANAGER ---
  const handleWindowAction = (instanceId: string, e: React.PointerEvent, actionType: 'move' | 'resize', corner?: string) => {
    if (e.button !== 0) return;
    const win = windows.find(w => w.instanceId === instanceId);
    if (!win || win.isMaximized) return;

    setActiveWindowId(instanceId);
    setIsInteracting(true); 

    const startX = e.pageX;
    const startY = e.pageY;
    const initialPos = { ...win.position };
    const initialSize = { ...win.size };

    const winEl = document.getElementById(`window-${instanceId}`);
    if (!winEl) return;

    winEl.style.willChange = actionType === 'move' ? 'left, top' : 'width, height, left, top';
    winEl.style.transform = 'translateZ(0)';

    let currentX = initialPos.x;
    let currentY = initialPos.y;
    let currentW = initialSize.w;
    let currentH = initialSize.h;

    const onPointerMove = (moveEvent: PointerEvent) => {
        requestAnimationFrame(() => {
          const dx = moveEvent.pageX - startX;
          const dy = moveEvent.pageY - startY;

          if (actionType === 'move') {
              currentX = initialPos.x + dx;
              currentY = initialPos.y + dy;
              winEl.style.left = `${currentX}px`;
              winEl.style.top = `${currentY}px`;
          } else if (actionType === 'resize') {
              if (corner?.includes('right')) currentW = Math.max(300, initialSize.w + dx);
              if (corner?.includes('bottom')) currentH = Math.max(200, initialSize.h + dy);
              if (corner?.includes('left')) {
                  const deltaW = initialSize.w - dx;
                  if (deltaW >= 300) { currentW = deltaW; currentX = initialPos.x + dx; winEl.style.left = `${currentX}px`; }
              }
              if (corner?.includes('top')) {
                  const deltaH = initialSize.h - dy;
                  if (deltaH >= 200) { currentH = deltaH; currentY = initialPos.y + dy; winEl.style.top = `${currentY}px`; }
              }
              winEl.style.width = `${currentW}px`;
              winEl.style.height = `${currentH}px`;
          }
        });
    };

    const onPointerUp = () => {
        setIsInteracting(false);
        winEl.style.willChange = 'auto';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        
        setWindows(prev => prev.map(w => w.instanceId === instanceId ? {
            ...w, 
            position: { x: currentX, y: currentY },
            size: { w: currentW, h: currentH }
        } : w));
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
  };

  const openApp = (app: API.AppDefinition) => {
    setStartMenuOpen(false);
    const existing = windows.find(w => w.appId === app.id);
    if (existing) { 
      setWindows(prev => prev.map(w => w.instanceId === existing.instanceId ? {...w, isMinimized: false} : w));
      setActiveWindowId(existing.instanceId); 
      return; 
    }
    const newWindow = {
      instanceId: Date.now().toString(), appId: app.id, title: app.name, appData: app, isMinimized: false, isMaximized: false,
      position: { x: 100 + (windows.length * 30), y: 50 + (windows.length * 30) }, size: { w: 900, h: 600 }
    };
    setWindows([...windows, newWindow]); setActiveWindowId(newWindow.instanceId);
  };
  
  const closeWindow = (instanceId: string) => setWindows(prev => prev.filter(w => w.instanceId !== instanceId));
  const toggleMaximize = (instanceId: string) => setWindows(prev => prev.map(w => w.instanceId === instanceId ? {...w, isMaximized: !w.isMaximized, isMinimized: false} : w));
  const toggleMinimize = (instanceId: string) => setWindows(prev => prev.map(w => w.instanceId === instanceId ? {...w, isMinimized: !w.isMinimized} : w));

  if (isGlobalLoading) return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
      <div className="relative w-16 h-16"><Loader2 className="animate-spin text-blue-500 absolute w-full h-full"/><Database size={32} className="absolute inset-0 m-auto text-blue-400 opacity-50"/></div>
      <p className="text-white font-bold tracking-widest uppercase text-xs animate-pulse">{globalLoadingMessage}</p>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-slate-900 select-none font-sans" 
         style={{ backgroundImage: `url(${config?.wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
         onPointerDown={() => setGlobalContextMenu(null)}>
      
      {isInteracting && (
        <div className="fixed inset-0 z-[9999] cursor-move bg-transparent touch-none" />
      )}

      {/* DESKTOP ICONS */}
      <div className="absolute top-0 left-0 bottom-12 w-full p-4 flex flex-col flex-wrap content-start gap-2 z-0" 
           onPointerDown={() => { setStartMenuOpen(false); setActiveWindowId(null); }}>
        {config?.installedApps.map(app => (
          <div key={app.id} onDoubleClick={() => openApp(app)} className="w-24 flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 cursor-default group transition-colors">
            <div className="w-14 h-14 glass-light rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform text-white">
              {app.icon === 'folder' ? <Folder size={32} className="text-blue-400 drop-shadow-lg"/> :
               app.icon === 'settings' ? <Settings size={32} className="text-slate-300 drop-shadow-lg"/> :
               app.icon === 'shopping-bag' ? <ShoppingBag size={32} className="text-pink-400 drop-shadow-lg"/> : 
               app.icon === 'image' ? <ImageIcon size={32} className="text-pink-400 drop-shadow-lg" /> :
               <Globe size={32} className="text-emerald-400 drop-shadow-lg"/>}
            </div>
            <span className="text-[10px] text-white font-bold text-shadow text-center line-clamp-2 px-1">{app.name}</span>
          </div>
        ))}
      </div>

      {/* WINDOWS */}
      {windows.map(win => (
        <div key={win.instanceId} id={`window-${win.instanceId}`}
             className={`absolute flex flex-col glass rounded-xl shadow-2xl overflow-hidden transition-none animate-window-open ${win.isMaximized ? 'inset-0 !top-0 !left-0 !w-full !h-[calc(100vh-64px)] rounded-none' : ''} ${activeWindowId === win.instanceId ? 'z-40 ring-1 ring-white/20 shadow-[0_30px_60px_rgba(0,0,0,0.5)]' : 'z-10'} ${win.isMinimized ? 'hidden' : ''}`}
             style={!win.isMaximized ? { top: win.position.y, left: win.position.x, width: win.size.w, height: win.size.h } : {}}
             onPointerDown={() => setActiveWindowId(win.instanceId)}>
          
          <div className="h-10 bg-slate-950/40 border-b border-white/5 flex items-center justify-between px-3 select-none cursor-default touch-none"
               onDoubleClick={() => toggleMaximize(win.instanceId)}
               onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'move')}>
            <div className="flex items-center gap-2 pointer-events-none">
               <div className="w-4 h-4 flex items-center justify-center text-white">
                 {win.appId === 'file-explorer' ? <Folder size={14}/> : 
                  win.appId === 'app-store' ? <ShoppingBag size={14}/> : 
                  win.appId === 'settings' ? <Settings size={14}/> : 
                  win.appData.icon === 'image' ? <ImageIcon size={14}/> : <Globe size={14}/>}
               </div>
               <span className="text-[10px] font-bold text-slate-300 tracking-wide uppercase">{win.title}</span>
            </div>
            <div className="flex items-center" onPointerDown={e => e.stopPropagation()}>
              <button onClick={()=>toggleMinimize(win.instanceId)} className="p-2 hover:bg-white/10 rounded-lg text-white/50"><Minus size={14}/></button>
              <button onClick={()=>toggleMaximize(win.instanceId)} className="p-2 hover:bg-white/10 rounded-lg text-white/50"><Square size={12}/></button>
              <button onClick={()=>closeWindow(win.instanceId)} className="p-2 hover:bg-red-600 rounded-lg text-white/80"><X size={14}/></button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {win.appId === 'file-explorer' && (
              <FileExplorerApp {...{
                  currentFolderId, setCurrentFolderId, folderHistory, setFolderHistory, items, setItems, loading, setLoading,
                  systemMap, setSystemMap, dbFileId, setDbFileId, comments, setComments, recycleBinId, setRecycleBinId,
                  systemFolderId, setSystemFolderId, isSavingDB, setIsSavingDB, isSavingComments, setIsSavingComments,
                  triggerCloudSync, triggerCommentSync, handleRefreshComments, addNotification, removeNotification, updateNotification,
                  setModal, modal, setEditingNote, setViewingRawFile, setPreviewImage, handleUploadFiles, executeAction, loadFolder,
                  selectedIds, setSelectedIds, 
                  onContextMenu: (e: any, item: any, isBin: boolean) => setGlobalContextMenu({ x: e.clientX, y: e.clientY, targetItem: item, isRecycleBin: isBin })
              }} />
            )}
            {win.appData.url === 'internal://gallery' && (
              <GalleryApp 
                items={items} 
                loading={loading}
                onUpload={(files: any) => handleUploadFiles(Array.from(files))}
                onDelete={async (id: string) => {
                  const notif = addNotification("Menghapus foto...", "loading");
                  try {
                    await API.deleteItems([id]);
                    updateNotification(notif, "Foto terhapus", "success");
                    loadFolder(currentFolderId);
                  } catch (e) { updateNotification(notif, "Gagal menghapus", "error"); }
                }}
              />
            )}
            {win.appId === 'settings' && <SettingsApp config={config!} onSave={async (c:any)=>{
                try {
                   await API.saveSystemConfig(c);
                   setConfig(c);
                   addNotification("Pengaturan disimpan", "success");
                } catch(e) { addNotification("Gagal menyimpan", "error"); }
            }}/>}
            {win.appId === 'app-store' && <AppStoreApp config={config!} setConfig={setConfig} addNotification={addNotification}/>}
            {(win.appData.type === 'webapp') && (
              <div className="h-full flex flex-col bg-white">
                <div className="p-1 bg-slate-100 flex items-center justify-between gap-2 border-b">
                   <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Globe size={12} className="text-slate-400 ml-2 flex-shrink-0"/>
                      <input className="flex-1 bg-white px-3 py-1 rounded-lg border-none text-[10px] outline-none text-slate-800" value={win.appData.url} readOnly />
                   </div>
                   <button onClick={() => window.open(win.appData.url, '_blank')} className="p-1.5 hover:bg-slate-200 rounded text-slate-500"><ExternalLink size={14}/></button>
                </div>
                <iframe src={win.appData.url} className="flex-1 w-full border-none" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation" />
              </div>
            )}
          </div>

          {!win.isMaximized && (
            <>
              <div className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize hover:bg-white/10 touch-none" onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'resize', 'left')} />
              <div className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize hover:bg-white/10 touch-none" onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'resize', 'right')} />
              <div className="absolute bottom-0 left-0 w-full h-1.5 cursor-ns-resize hover:bg-white/10 touch-none" onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'resize', 'bottom')} />
              <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-blue-400/30 z-[60] touch-none" onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'resize', 'bottom-right')} />
              <div className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize hover:bg-blue-400/30 z-[60] touch-none" onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'resize', 'bottom-left')} />
            </>
          )}
        </div>
      ))}

      {/* START MENU */}
      {startMenuOpen && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[600px] max-w-[95vw] h-[550px] glass rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] z-[60] p-8 flex flex-col animate-in slide-in-from-bottom-5 duration-200">
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-6 flex-1 content-start overflow-y-auto pr-2 no-scrollbar">
             {config?.installedApps.map(app => (
               <button key={app.id} onClick={()=>openApp(app)} className="flex flex-col items-center gap-2 group">
                 <div className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    {app.icon === 'folder' ? <Folder size={24} className="text-blue-400"/> : 
                     app.icon === 'settings' ? <Settings size={24} className="text-slate-300"/> : 
                     app.icon === 'shopping-bag' ? <ShoppingBag size={24} className="text-pink-400"/> :
                     app.icon === 'image' ? <ImageIcon size={24} className="text-pink-400" /> :
                     <Globe size={24} className="text-emerald-400"/>}
                 </div>
                 <span className="text-[10px] text-white font-medium truncate w-full text-center group-hover:text-blue-400">{app.name}</span>
               </button>
             ))}
          </div>
          <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-xl">ZD</div>
                 <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Cloud User</span>
                    <span className="text-[10px] text-slate-400">Personal Account</span>
                 </div>
              </div>
          </div>
        </div>
      )}

      {/* TASKBAR */}
      <div className="absolute bottom-0 w-full h-16 sm:h-12 glass border-t border-white/5 flex items-center justify-between px-4 z-[70]"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-24 flex items-center gap-2">
            <button 
                onClick={toggleFullscreen}
                className="p-2 rounded-xl hover:bg-white/10 transition-all text-white/50 hover:text-white"
                title="Toggle Fullscreen"
            >
                {isFullscreen ? <Minimize2 size={20}/> : <Maximize2 size={20}/>}
            </button>
        </div> 

        <div className="flex items-center gap-1.5">
           <button onClick={() => setStartMenuOpen(!startMenuOpen)} className={`p-2.5 rounded-xl hover:bg-white/10 transition-all ${startMenuOpen ? 'bg-white/10 scale-90' : ''}`}><Grid size={24} className="text-blue-400"/></button>
           <div className="w-px h-6 bg-white/5 mx-2"></div>
           {windows.map(win => (
             <button key={win.instanceId} onClick={() => { if (win.isMinimized) toggleMinimize(win.instanceId); setActiveWindowId(win.instanceId); }}
                     className={`p-2 rounded-xl hover:bg-white/10 transition-all relative group ${activeWindowId === win.instanceId && !win.isMinimized ? 'bg-white/10' : 'opacity-60'}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-lg ${win.appId === 'file-explorer' ? 'bg-blue-600' : win.appId === 'app-store' ? 'bg-pink-600' : win.appData.icon === 'image' ? 'bg-pink-500' : 'bg-slate-700'}`}>
                   {win.appId === 'file-explorer' ? <Folder size={14}/> : 
                    win.appId === 'app-store' ? <ShoppingBag size={14}/> : 
                    win.appId === 'settings' ? <Settings size={14}/> : 
                    win.appData.icon === 'image' ? <ImageIcon size={14} /> : win.title.charAt(0)}
                </div>
                {!win.isMinimized && activeWindowId === win.instanceId && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-blue-400 rounded-full"></div>}
             </button>
           ))}
        </div>

        <div className="flex items-center gap-3 text-white w-24 justify-end">
             <div className="flex flex-col items-end leading-none font-bold">
               <span className="text-[10px]">{clock.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
               <span className="text-[8px] text-slate-400">{clock.toLocaleDateString([], {day:'2-digit', month:'2-digit'})}</span>
             </div>
        </div>
      </div>

      {/* GLOBAL CONTEXT MENU */}
      {globalContextMenu && (
        <div className="fixed inset-0 z-[1000]" onClick={() => setGlobalContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setGlobalContextMenu(null); }}>
          <div className="absolute z-[1001] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[180px] animate-in zoom-in-95 duration-100 overflow-hidden" 
               style={{ top: globalContextMenu.y, left: globalContextMenu.x }} onClick={(e) => e.stopPropagation()}>
            {globalContextMenu.targetItem ? (
                <>
                  <button onClick={() => { executeAction('comment'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><MessageSquare size={14}/> Comment</button>
                  {globalContextMenu.targetItem.type === 'image' && (
                    <button onClick={() => { executeAction('download'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-emerald-400"><Download size={14}/> Download Original</button>
                  )}
                  <button onClick={() => { executeAction('rename'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><Edit size={14}/> Rename</button>
                  <button onClick={() => { executeAction('move'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><Move size={14}/> Move</button>
                  <div className="h-px bg-slate-800 my-1"></div>
                  <button onClick={() => { executeAction('delete'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 text-xs flex items-center gap-2"><Trash2 size={14}/> Delete</button>
                </>
            ) : (
                <>
                  <button onClick={() => { executeAction('new_folder'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><Folder size={14}/> New Folder</button>
                  <button onClick={() => { executeAction('native_upload'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-green-400"><Upload size={14}/> Upload Files</button>
                  <button onClick={() => { loadFolder(currentFolderId); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><RefreshCw size={14}/> Refresh</button>
                </>
            )}
          </div>
        </div>
      )}

      {/* OVERLAYS */}
      <UploadProgress uploads={uploadQueue} onClose={() => setUploadQueue([])} onRemove={(id) => setUploadQueue(prev => prev.filter(u => u.id !== id))} />
      <DownloadProgress downloads={downloadQueue} onClose={() => setDownloadQueue([])} onClearCompleted={() => setDownloadQueue(prev => prev.filter(d => d.status !== 'completed'))} />
      {previewImage && (<div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}><button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 text-white"><X size={32}/></button><img src={previewImage} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" /></div>)}
      {editingNote && <TextEditor note={editingNote} onSave={handleSaveNote} onClose={() => setEditingNote(null)} />}
      
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isPostingComment && setModal(null)} />
          <div className={`relative w-full ${modal.type === 'comment' ? 'max-w-2xl' : 'max-w-sm'} bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden`}>
            {modal.type === 'comment' ? (
              <div className="flex flex-col h-[500px] max-h-[70vh]">
                <div className="p-4 bg-slate-950 flex items-center justify-between"><h3 className="text-sm font-bold">{modal.title}</h3><button onClick={() => setModal(null)}><X size={18}/></button></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                   {(comments[modal.targetItem!.id] || []).map((c: any) => (
                      <div key={c.id} className="flex gap-3">
                         <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white uppercase">{c.author?.[0]}</div>
                         <div className="flex-1 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                           <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold text-blue-400">{c.author}</span><span className="text-[8px] text-slate-500">{new Date(c.timestamp).toLocaleTimeString()}</span></div>
                           <p className="text-xs text-slate-200">{c.text}</p>
                         </div>
                      </div>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-800 flex gap-2">
                   <input className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-xs" placeholder="Komentar..." value={commentText} onChange={e=>setCommentText(e.target.value)} />
                   <input className="w-20 bg-slate-800 rounded-lg px-2 py-2 text-xs" placeholder="Nama" value={commentName} onChange={e=>setCommentName(e.target.value)} />
                   <button onClick={handleAddComment} className="p-2 bg-blue-600 text-white rounded-lg"><Send size={16}/></button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-2">{modal.title}</h3>
                {modal.type === 'input' && <input className="w-full bg-slate-800 p-3 rounded-lg text-sm text-white" defaultValue={modal.inputValue} onChange={e=>setModal({...modal, inputValue: e.target.value})} />}
                {modal.type === 'password' && <input className="w-full bg-slate-800 p-3 rounded-lg text-sm" type="password" placeholder="Password" onChange={e=>setModal({...modal, inputValue: e.target.value})} />}
                <div className="mt-6 flex gap-3"><button onClick={() => setModal(null)} className="flex-1 py-2 text-slate-400">Cancel</button><button onClick={() => modal.onConfirm?.(modal.inputValue)} className={`flex-1 py-2 rounded-lg text-white ${modal.isDanger ? 'bg-red-600' : 'bg-blue-600'}`}>{modal.confirmText || 'OK'}</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      <div className="fixed bottom-20 right-4 z-[300] flex flex-col gap-2">
        {notifications.map(n => (
          <div key={n.id} className="bg-slate-900/90 border border-slate-700 p-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-5">
             {n.type === 'loading' ? <Loader2 size={16} className="animate-spin text-blue-400"/> : n.type === 'success' ? <CheckCircle size={16} className="text-green-400"/> : <XCircle size={16} className="text-red-400"/>}
             <span className="text-[10px] font-bold text-white uppercase">{n.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- HELPER ITEM COMPONENTS ---
interface ItemComponentProps { item: Item; selected: boolean; hasComments?: boolean; onClick: (e: React.MouseEvent, item: Item) => void; onDoubleClick: (e: React.MouseEvent, item: Item) => void; onContextMenu: (e: React.MouseEvent | React.PointerEvent, item: Item) => void; onToggleSelect: () => void; onCommentClick?: () => void; }
const ItemOverlay = ({ status }: { status?: string }) => { 
    if (!status || status === 'idle') return null; 
    return ( 
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[90] flex flex-col items-center justify-center rounded-xl"> 
            <Loader2 size={24} className="text-blue-400 animate-spin mb-1" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                {status === 'creating' ? 'loading' : status}
            </span> 
        </div> 
    ); 
};
const FolderItem: React.FC<ItemComponentProps & { isRecycleBin?: boolean; isSystem?: boolean; isDropTarget?: boolean }> = ({ item, selected, hasComments, onClick, onDoubleClick, onContextMenu, onToggleSelect, onCommentClick, isRecycleBin, isSystem, isDropTarget }) => ( <div id={`item-${item.id}`} data-folder-id={item.id} data-item-id={item.id} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => onContextMenu(e, item)} className={`group relative p-4 rounded-xl border transition-all cursor-default flex flex-col items-center gap-2 ${isDropTarget ? 'bg-blue-500/40 border-blue-400 scale-105' : selected ? 'bg-blue-500/20 border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'}`}> <ItemOverlay status={item.status} /> {hasComments && <button onClick={(e)=>{e.stopPropagation(); onCommentClick?.();}} className="absolute bottom-1.5 right-1.5 p-1 bg-blue-600 rounded-full z-30"><MessageSquare size={10} fill="white"/></button>} <div className={`absolute top-2 left-2 z-20 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><CheckSquare size={16} className={selected ? "text-blue-500" : "text-slate-500"} onClick={(e)=>{e.stopPropagation(); onToggleSelect();}}/></div> <Folder size={40} className={`${isRecycleBin ? 'text-red-500' : isSystem ? 'text-slate-500' : 'text-blue-500'} drop-shadow-md`}/> <span className="text-[10px] font-bold text-center truncate w-full px-1 text-slate-300">{item.name}</span> </div> );
const NoteItem: React.FC<ItemComponentProps> = ({ item, selected, hasComments, onClick, onDoubleClick, onContextMenu, onToggleSelect, onCommentClick }) => ( <div id={`item-${item.id}`} data-item-id={item.id} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => onContextMenu(e, item)} className={`group relative p-4 rounded-xl border transition-all cursor-default flex flex-col gap-2 aspect-square ${selected ? 'bg-[#fff9c4] border-blue-500 ring-2 ring-blue-500' : 'bg-[#fff9c4] border-transparent'}`}> <ItemOverlay status={item.status} /> {hasComments && <button onClick={(e)=>{e.stopPropagation(); onCommentClick?.();}} className="absolute bottom-1.5 right-1.5 p-1 bg-blue-600 rounded-full z-30"><MessageSquare size={10} fill="white"/></button>} <div className={`absolute top-2 left-2 z-20 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><CheckSquare size={16} className="text-blue-600" onClick={(e)=>{e.stopPropagation(); onToggleSelect();}}/></div> <div className="flex-1 overflow-hidden"><h4 className="text-[10px] font-bold text-slate-900 border-b border-black/10 pb-1 mb-1 truncate">{item.name}</h4><p className="text-[9px] text-slate-800 line-clamp-5">{stripHtml(item.content || item.snippet || "")}</p></div> </div> );
const ImageItem: React.FC<ItemComponentProps> = ({ item, selected, hasComments, onClick, onDoubleClick, onContextMenu, onToggleSelect, onCommentClick }) => ( <div id={`item-${item.id}`} data-item-id={item.id} onClick={(e) => onClick(e, item)} onDoubleClick={(e) => onDoubleClick(e, item)} onContextMenu={(e) => onContextMenu(e, item)} className={`group relative rounded-xl border transition-all cursor-default overflow-hidden aspect-square flex flex-col items-center justify-center bg-slate-950 ${selected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-800'}`}> <ItemOverlay status={item.status} /> {hasComments && <button onClick={(e)=>{e.stopPropagation(); onCommentClick?.();}} className="absolute bottom-1.5 right-1.5 p-1 bg-blue-600 rounded-full z-30"><MessageSquare size={10} fill="white"/></button>} <div className={`absolute top-2 left-2 z-20 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><CheckSquare size={16} className="text-blue-500" onClick={(e)=>{e.stopPropagation(); onToggleSelect();}}/></div> {item.thumbnail || item.url ? <img src={item.thumbnail || item.url} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" /> : <ImageIcon size={24} className="text-slate-600" />} <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 truncate"><span className="text-[8px] font-bold text-slate-200 block text-center truncate">{item.name}</span></div> </div> );

export default App;
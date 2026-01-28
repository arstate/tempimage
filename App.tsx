
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, MoreVertical, 
  ArrowLeft, Plus, Trash2, Copy, Move, Edit, CheckSquare, 
  Loader2, Home, Upload, ChevronRight, X, AlertCircle, Download, 
  CheckCircle, XCircle, Image, RotateCcw, Ban, GripVertical, Database, Lock, 
  ShieldAlert, Cloud, CloudUpload, FileJson, RefreshCw,
  CheckCheck, MessageSquare, Reply, Send, User, Clock,
  Grid, Monitor, Globe, Settings, ShoppingBag, Minus, Square, Search, Wifi,
  Maximize2
} from 'lucide-react';
import * as API from './services/api';
import * as DB from './services/db';
import { Item, StoredNote, DownloadItem, FolderMap, SystemDB, Comment, CommentDB } from './types';
import { TextEditor } from './components/TextEditor';
import { UploadProgress, UploadItem } from './components/UploadProgress';
import { DownloadProgress } from './components/DownloadProgress';

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
    onContextMenu // Global context menu handler from App.tsx
}: any) => {
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);
  // selectionBox coordinates are now relative to the explorer container
  const [selectionBox, setSelectionBox] = useState<{x:number, y:number, width:number, height:number} | null>(null);
  const [customDragItem, setCustomDragItem] = useState<Item | null>(null);
  const [customDragPos, setCustomDragPos] = useState<{x:number, y:number} | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{x:number, y:number} | null>(null);
  const isPaintingRef = useRef<boolean>(false); 
  const longPressTimerRef = useRef<any>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
     if ((e.target as HTMLElement).closest('button, .item-handle, .floating-ui, select, input, .comment-area')) return;
     const target = e.target as HTMLElement;
     const checkbox = target.closest('.selection-checkbox');
     const itemRow = target.closest('[data-item-id]');
     
     // Detect right click
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
                     setCustomDragItem(clickedItem); setCustomDragPos({ x: e.clientX, y: e.clientY });
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
     const currentLocalX = e.clientX - (rect?.left || 0);
     const currentLocalY = e.clientY - (rect?.top || 0);

     const moveDist = Math.sqrt(Math.pow(currentLocalX - dragStartPos.current.x, 2) + Math.pow(currentLocalY - dragStartPos.current.y, 2));
     if (moveDist > 8) {
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
                const containerRect = containerRef.current!.getBoundingClientRect();
                const relativeItemLeft = itemRect.left - containerRect.left;
                const relativeItemTop = itemRect.top - containerRect.top;
                const relativeItemRight = itemRect.right - containerRect.left;
                const relativeItemBottom = itemRect.bottom - containerRect.top;

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
            // Show loading overlay on thumbnail while opening
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
    <div ref={containerRef} className="h-full flex flex-col bg-slate-900 overflow-hidden relative" 
         onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
         onContextMenu={(e) => localHandleContextMenu(e)}>
      
      {selectionBox && (<div className="absolute z-[150] bg-blue-500/20 border border-blue-400 pointer-events-none" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />)}
      {customDragItem && customDragPos && (<div className="fixed z-[999] pointer-events-none p-3 rounded-lg border border-blue-500 bg-slate-800/90 shadow-2xl flex flex-col items-center gap-2 w-24 backdrop-blur-sm" style={{ left: customDragPos.x, top: customDragPos.y, transform: 'translate(-50%, -50%) rotate(5deg)' }}>{customDragItem.type === 'folder' ? <Folder size={24} className="text-blue-500"/> : customDragItem.type === 'note' ? <FileText size={24} className="text-yellow-500"/> : <ImageIcon size={24} className="text-purple-500"/>}<span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">{selectedIds.size > 1 ? `${selectedIds.size} Items` : customDragItem.name}</span></div>)}

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
                <label className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg flex items-center gap-2 text-xs cursor-pointer"><Upload size={14} className="text-green-400"/> Upload File<input type="file" multiple className="hidden" onChange={(e) => { if(e.target.files) handleUploadFiles(Array.from(e.target.files)); setIsNewDropdownOpen(false); }} /></label>
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
    <div className="h-full bg-slate-50 text-slate-800 p-6 flex flex-col gap-6 overflow-auto">
      <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-900"><Settings size={28} className="text-blue-600"/> Settings</h2>
      <div className="space-y-6 max-w-lg">
        <section className="bg-white p-4 rounded-xl shadow-sm border">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Appearance</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Wallpaper URL</label>
              <input 
                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-500" 
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

// --- APP STORE COMPONENT ---
const AppStore = ({ installedApps, onInstall, onUninstall }: any) => {
  const [newApp, setNewApp] = useState({ name: "", url: "", icon: "globe" });
  const handleInstall = () => {
    if(!newApp.name || !newApp.url) return alert("Please enter Name and URL!");
    const appData: API.AppDefinition = {
      id: "app-" + Date.now(),
      name: newApp.name,
      url: newApp.url.startsWith('http') ? newApp.url : 'https://' + newApp.url,
      icon: "globe",
      type: "webapp"
    };
    onInstall(appData);
    setNewApp({ name: "", url: "", icon: "globe" });
  };
  return (
    <div className="h-full bg-slate-50 text-slate-800 p-6 flex flex-col gap-6 overflow-auto">
      <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-900"><ShoppingBag size={28} className="text-pink-600"/> App Store</h2>
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Install New Web App</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
           <input placeholder="App Name (e.g. YouTube)" className="p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" value={newApp.name} onChange={e=>setNewApp({...newApp, name: e.target.value})} />
           <input placeholder="Web URL (e.g. youtube.com)" className="p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" value={newApp.url} onChange={e=>setNewApp({...newApp, url: e.target.value})} />
        </div>
        <button onClick={handleInstall} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95">Install App</button>
      </div>
      
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Installed Apps</h3>
        {installedApps.map((app: any) => (
          <div key={app.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-blue-600 shadow-inner">
                {app.icon === 'folder' ? <Folder size={20}/> : app.icon === 'settings' ? <Settings size={20}/> : app.icon === 'shopping-bag' ? <ShoppingBag size={20}/> : <Globe size={20}/>}
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{app.name}</div>
                <div className="text-[10px] text-slate-400 font-mono">{app.type.toUpperCase()}</div>
              </div>
            </div>
            {app.type === 'webapp' && (
              <button onClick={() => onUninstall(app.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- MAIN OS SHELL APP ---
const App = () => {
  // OS STATE
  const [config, setConfig] = useState<API.SystemConfig | null>(null);
  const [windows, setWindows] = useState<any[]>([]); 
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  
  // GLOBAL CONTEXT MENU STATE
  const [globalContextMenu, setGlobalContextMenu] = useState<{x:number, y:number, targetItem?: Item, isRecycleBin?: boolean} | null>(null);

  // FILE EXPLORER SHARED STATE
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
        setNotifications([{id: 'boot-error', message: 'Boot failure. Please refresh.', type: 'error'}]);
      } finally {
        setIsGlobalLoading(false);
      }
    };
    boot();
  }, []);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- SHARED EXPLORER ACTIONS ---
  const loadFolder = useCallback(async (folderId: string = "") => {
    const cacheKey = folderId || "root";
    
    // Check Cache first
    const cached = await DB.getCachedFolder(cacheKey);
    if (cached) {
      setItems(cached);
    } else {
      setItems([]);
      setLoading(true);
    }
    
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
        // Save to cache
        await DB.cacheFolderContents(cacheKey, freshItems);

        const folders = freshItems.filter(i => i.type === 'folder');
        if (folders.length > 0) {
            const nextMap = { ...systemMapRef.current };
            folders.forEach(f => { nextMap[f.id] = { id: f.id, name: f.name, parentId: folderId || "root" }; });
            systemMapRef.current = nextMap; setSystemMap(nextMap); triggerCloudSync();
        }
      }
    } catch (e) { console.error("Load folder error", e); } finally { setLoading(false); }
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
      id: i.id,
      name: i.name,
      status: 'pending',
      progress: 0
    }));

    setDownloadQueue(prev => [...prev, ...newDownloads]);

    for (const dItem of newDownloads) {
        setDownloadQueue(prev => prev.map(d => d.id === dItem.id ? { ...d, status: 'downloading' } : d));
        try {
            const item = itemsToDownload.find(i => i.id === dItem.id);
            if (!item || !item.url) throw new Error("URL missing");

            // Use wsrv.nl proxy to bypass CORS and download original quality
            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(item.url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("Fetch failed from proxy");
            
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = item.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(blobUrl), 200);

            setDownloadQueue(prev => prev.map(d => d.id === dItem.id ? { ...d, status: 'completed', progress: 100 } : d));
        } catch (e) {
            console.error("Download error:", e);
            setDownloadQueue(prev => prev.map(d => d.id === dItem.id ? { ...d, status: 'error', error: 'Failed to download' } : d));
        }
    }
  };

  const executeAction = async (action: string) => {
    const ids = Array.from(selectedIds);
    switch (action) {
      case 'comment':
        const targetComment = items.find(i => i.id === ids[0]);
        if(targetComment) {
          // Add loading state to the target item while comments refresh
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
    localStorage.setItem('zombio_comment_name', commentName);
    
    const targetId = modal.targetItem.id;
    const newComment: Comment = { 
      id: Date.now().toString(), 
      itemId: targetId, 
      author: commentName, 
      text: commentText, 
      timestamp: Date.now() 
    };
    
    const next = { ...commentsRef.current }; 
    if (!next[targetId]) next[targetId] = []; 
    next[targetId] = [...next[targetId], newComment];
    
    commentsRef.current = next; 
    setComments(next);
    
    try { 
      await triggerCommentSync(); 
      setCommentText(''); 
      addNotification("Comment posted", "success"); 
    } 
    catch (e) { addNotification("Failed to post", "error"); } finally { setIsPostingComment(false); }
  };

  // --- WINDOW MANAGER ---
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
  
  const closeWindow = (instanceId: string) => { setWindows(prev => prev.filter(w => w.instanceId !== instanceId)); };
  
  const toggleMaximize = (instanceId: string) => { setWindows(prev => prev.map(w => w.instanceId === instanceId ? {...w, isMaximized: !w.isMaximized, isMinimized: false} : w)); };
  
  const toggleMinimize = (instanceId: string) => { setWindows(prev => prev.map(w => w.instanceId === instanceId ? {...w, isMinimized: !w.isMinimized} : w)); };

  const updateConfig = async (newConf: API.SystemConfig) => { setConfig(newConf); await API.saveSystemConfig(newConf); addNotification("Settings saved", "success"); };
  
  const installApp = async (newApp: API.AppDefinition) => { if(!config) return; const newConfig = { ...config, installedApps: [...config.installedApps, newApp] }; updateConfig(newConfig); };
  
  const uninstallApp = async (appId: string) => { if(!config) return; const newConfig = { ...config, installedApps: config.installedApps.filter(a => a.id !== appId) }; updateConfig(newConfig); };

  const handleWindowAction = useCallback((id: string, e: React.PointerEvent, type: 'move' | 'resize', corner?: string) => {
    if (e.button !== 0) return;
    const win = windows.find(w => w.instanceId === id);
    if (!win || win.isMaximized) return;
    
    setActiveWindowId(id);
    const startX = e.pageX;
    const startY = e.pageY;
    const startPos = { ...win.position };
    const startSize = { ...win.size };

    let rafId: number;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const deltaX = moveEvent.pageX - startX;
        const deltaY = moveEvent.pageY - startY;

        setWindows(prev => prev.map(w => {
          if (w.instanceId !== id) return w;
          
          if (type === 'move') {
            return { ...w, position: { x: startPos.x + deltaX, y: startPos.y + deltaY } };
          } else if (type === 'resize') {
            let newW = startSize.w;
            let newH = startSize.h;
            let newX = startPos.x;
            let newY = startPos.y;

            if (corner?.includes('right')) newW = Math.max(300, startSize.w + deltaX);
            if (corner?.includes('bottom')) newH = Math.max(200, startSize.h + deltaY);
            if (corner?.includes('left')) {
               const widthChange = startSize.w - deltaX;
               if (widthChange >= 300) { newW = widthChange; newX = startPos.x + deltaX; }
            }
            if (corner?.includes('top')) {
               const heightChange = startSize.h - deltaY;
               if (heightChange >= 200) { newH = heightChange; newY = startPos.y + deltaY; }
            }

            return { ...w, position: { x: newX, y: newY }, size: { w: newW, h: newH } };
          }
          return w;
        }));
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      cancelAnimationFrame(rafId);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [windows]);

  if (isGlobalLoading) return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
      <div className="relative w-16 h-16"><Loader2 className="animate-spin text-blue-500 absolute w-full h-full"/><Database size={32} className="absolute inset-0 m-auto text-blue-400 opacity-50"/></div>
      <p className="text-white font-bold tracking-widest uppercase text-xs animate-pulse">{globalLoadingMessage}</p>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-slate-900 select-none transition-all duration-700 font-sans" 
         style={{ backgroundImage: `url(${config?.wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
         onPointerDown={() => setGlobalContextMenu(null)}>
      
      {/* DESKTOP ICONS */}
      <div className="absolute top-0 left-0 bottom-12 w-full p-4 flex flex-col flex-wrap content-start gap-2 z-0 overflow-hidden" 
           onPointerDown={() => { setStartMenuOpen(false); setActiveWindowId(null); }}>
        {config?.installedApps.map(app => (
          <div key={app.id} onDoubleClick={() => openApp(app)} className="w-24 flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 cursor-default group transition-colors">
            <div className="w-14 h-14 glass-light rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform text-white">
              {app.icon === 'folder' ? <Folder size={32} className="text-blue-400 drop-shadow-lg"/> :
               app.icon === 'settings' ? <Settings size={32} className="text-slate-300 drop-shadow-lg"/> :
               app.icon === 'shopping-bag' ? <ShoppingBag size={32} className="text-pink-400 drop-shadow-lg"/> : 
               <Globe size={32} className="text-emerald-400 drop-shadow-lg"/>}
            </div>
            <span className="text-[10px] text-white font-bold text-shadow text-center line-clamp-2 px-1">{app.name}</span>
          </div>
        ))}
      </div>

      {/* WINDOWS */}
      {windows.map(win => (
        <div key={win.instanceId} 
             className={`absolute flex flex-col glass rounded-xl shadow-2xl overflow-hidden transition-all duration-300 animate-window-open ${win.isMaximized ? 'inset-0 !top-0 !left-0 !w-full !h-[calc(100vh-48px)] rounded-none' : ''} ${activeWindowId === win.instanceId ? 'z-40 ring-1 ring-white/20' : 'z-10'} ${win.isMinimized ? 'hidden' : ''}`}
             style={!win.isMaximized ? { top: win.position.y, left: win.position.x, width: win.size.w, height: win.size.h } : {}}
             onPointerDown={() => setActiveWindowId(win.instanceId)}>
          
          <div className="h-10 bg-slate-950/40 border-b border-white/5 flex items-center justify-between px-3 select-none"
               onDoubleClick={() => toggleMaximize(win.instanceId)}
               onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'move')}>
            <div className="flex items-center gap-2">
               <div className="w-4 h-4 flex items-center justify-center text-white">{win.appId === 'file-explorer' ? <Folder size={14}/> : <Globe size={14}/>}</div>
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
            {win.appId === 'settings' && <SettingsApp config={config!} onSave={updateConfig}/>}
            {win.appId === 'store' && <AppStore installedApps={config!.installedApps} onInstall={installApp} onUninstall={uninstallApp}/>}
            {(win.appData.type === 'webapp' || win.appId === 'browser') && (
              <div className="h-full flex flex-col bg-white">
                <div className="p-1 bg-slate-100 flex items-center gap-2 border-b"><Globe size={12} className="text-slate-400 ml-2"/><input className="flex-1 bg-white px-3 py-1 rounded-lg border-none text-[10px] outline-none" defaultValue={win.appData.url || 'https://www.google.com'} /></div>
                <iframe src={win.appData.url || "https://www.wikipedia.org"} className="flex-1 w-full border-none" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
              </div>
            )}
          </div>

          {!win.isMaximized && (
            <>
              <div className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize hover:bg-white/10" onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'resize', 'left')} />
              <div className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize hover:bg-white/10" onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'resize', 'right')} />
              <div className="absolute bottom-0 left-0 w-full h-1.5 cursor-ns-resize hover:bg-white/10" onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'resize', 'bottom')} />
              <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-blue-400/30 z-[60]" onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'resize', 'bottom-right')} />
              <div className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize hover:bg-blue-400/30 z-[60]" onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'resize', 'bottom-left')} />
            </>
          )}
        </div>
      ))}

      {/* START MENU */}
      {startMenuOpen && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-[600px] max-w-[95vw] h-[550px] glass rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] z-[60] p-8 flex flex-col animate-in slide-in-from-bottom-5 duration-300">
          <div className="mb-8">
            <div className="bg-white/10 p-3 rounded-2xl flex items-center gap-3 border border-white/5 shadow-inner">
              <Search size={18} className="text-slate-300 ml-2"/>
              <input type="text" placeholder="Search for apps, settings, and files" className="bg-transparent border-none outline-none text-white text-sm w-full placeholder-slate-400 font-medium"/>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-6 flex-1 content-start">
             {config?.installedApps.map(app => (
               <button key={app.id} onClick={()=>openApp(app)} className="flex flex-col items-center gap-2 group">
                 <div className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    {app.icon === 'folder' ? <Folder size={24} className="text-blue-400"/> : app.icon === 'settings' ? <Settings size={24}/> : app.icon === 'shopping-bag' ? <ShoppingBag size={24} className="text-pink-400"/> : <Globe size={24} className="text-emerald-400"/>}
                 </div>
                 <span className="text-[10px] text-white font-medium truncate w-full text-center group-hover:text-blue-400 transition-colors">{app.name}</span>
               </button>
             ))}
          </div>
        </div>
      )}

      {/* TASKBAR */}
      <div className="absolute bottom-0 w-full h-12 glass border-t border-white/5 flex items-center justify-between px-4 z-[70] shadow-2xl">
        <div className="w-24"></div> 
        <div className="flex items-center gap-1.5">
           <button onClick={() => setStartMenuOpen(!startMenuOpen)} 
                   className={`p-2.5 rounded-xl hover:bg-white/10 transition-all active:scale-90 ${startMenuOpen ? 'bg-white/10 shadow-inner' : ''}`}>
             <Grid size={24} className="text-blue-400 fill-blue-400/20"/>
           </button>
           <div className="w-px h-6 bg-white/5 mx-2"></div>
           {windows.map(win => (
             <button key={win.instanceId} onClick={() => { if (win.isMinimized) toggleMinimize(win.instanceId); setActiveWindowId(win.instanceId); }}
                     className={`p-2 rounded-xl hover:bg-white/10 transition-all relative group ${activeWindowId === win.instanceId && !win.isMinimized ? 'bg-white/10 scale-105' : 'opacity-60'}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-lg ${win.appId === 'file-explorer' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                   {win.appId === 'file-explorer' ? <Folder size={16}/> : win.title.charAt(0)}
                </div>
                {!win.isMinimized && activeWindowId === win.instanceId && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-blue-400 rounded-full"></div>}
                {win.isMinimized && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1 bg-slate-400 rounded-full"></div>}
             </button>
           ))}
        </div>
        <div className="flex items-center gap-4 text-white">
           <div className="flex items-center gap-3 p-1 px-3 hover:bg-white/5 rounded-xl transition-colors cursor-default">
             <div className="flex flex-col items-end leading-none font-bold">
               <span className="text-[10px] tracking-tight">{clock.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
               <span className="text-[9px] text-slate-400">{clock.toLocaleDateString([], {day:'2-digit', month:'2-digit', year:'numeric'})}</span>
             </div>
           </div>
        </div>
      </div>

      {/* GLOBAL CONTEXT MENU RENDERING (Outside any Window Container) */}
      {globalContextMenu && (
        <div className="fixed inset-0 z-[1000] overflow-hidden" 
             onClick={() => setGlobalContextMenu(null)} 
             onContextMenu={(e) => { e.preventDefault(); setGlobalContextMenu(null); }}>
          <div className="absolute z-[1001] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[160px] animate-in zoom-in-95 duration-100" 
               style={{ top: globalContextMenu.y, left: globalContextMenu.x }} onClick={(e) => e.stopPropagation()}>
            {globalContextMenu.targetItem ? (
                <>
                  <button onClick={() => { executeAction('comment'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 text-xs flex items-center gap-2 text-slate-200"><MessageSquare size={14}/> Comment</button>
                  {globalContextMenu.targetItem.type === 'image' && (
                    <button onClick={() => { executeAction('download'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 text-xs flex items-center gap-2 text-emerald-400"><Download size={14}/> Download Original</button>
                  )}
                  <button onClick={() => { executeAction('rename'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 text-xs flex items-center gap-2 text-slate-200"><Edit size={14}/> Rename</button>
                  <button onClick={() => { executeAction('move'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 text-xs flex items-center gap-2 text-slate-200"><Move size={14}/> Move</button>
                  <div className="h-px bg-slate-700 my-1"></div>
                  <button onClick={() => { executeAction('delete'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 text-xs flex items-center gap-2"><Trash2 size={14}/> {globalContextMenu.isRecycleBin ? 'Delete Permanently' : 'Delete'}</button>
                </>
            ) : (
                <>
                  <button onClick={() => { executeAction('new_folder'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 text-xs flex items-center gap-2 text-slate-200"><Folder size={14}/> New Folder</button>
                  <button onClick={() => { loadFolder(currentFolderId); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 text-xs flex items-center gap-2 text-slate-200"><RefreshCw size={14}/> Refresh</button>
                </>
            )}
          </div>
        </div>
      )}

      {/* SHARED MODALS & OVERLAYS */}
      <UploadProgress uploads={uploadQueue} onClose={() => setUploadQueue([])} onRemove={(id) => setUploadQueue(prev => prev.filter(u => u.id !== id))} />
      <DownloadProgress downloads={downloadQueue} onClose={() => setDownloadQueue([])} onClearCompleted={() => setDownloadQueue(prev => prev.filter(d => d.status !== 'completed'))} />
      
      {previewImage && (<div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewImage(null)}><div className="absolute top-4 right-4 z-10 flex gap-2"><button onClick={() => setPreviewImage(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white"><X size={24}/></button></div><img src={previewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} referrerPolicy="no-referrer" /></div>)}
      {editingNote && <TextEditor note={editingNote} onSave={handleSaveNote} onClose={() => setEditingNote(null)} />}
      
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!isPostingComment) setModal(null); }} />
          <div className={`relative w-full ${modal.type === 'comment' ? 'max-w-2xl' : 'max-w-sm'} bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95`}>
            {modal.type === 'comment' ? (
              <div className="flex flex-col h-[600px] max-h-[80vh] bg-slate-900 relative">
                {isPostingComment && <div className="absolute inset-0 z-50 bg-slate-950/80 flex items-center justify-center flex-col"><Loader2 size={48} className="animate-spin text-blue-500 mb-4"/><p className="text-xs font-bold text-blue-400 uppercase">Saving to Cloud...</p></div>}
                <div className="p-4 bg-slate-950 flex items-center justify-between border-b border-slate-800"><h3 className="text-sm font-bold flex items-center gap-2"><MessageSquare size={16} className="text-blue-400"/> {modal.title}</h3><button onClick={() => setModal(null)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500"><X size={18}/></button></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                   {(comments[modal.targetItem!.id] || []).length === 0 ? <p className="text-center py-10 text-slate-600 italic">No comments yet</p> : 
                    comments[modal.targetItem!.id].map((c: any) => (
                      <div key={c.id} className="flex gap-3">
                         <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white uppercase">{c.author?.[0] || 'A'}</div>
                         <div className="flex-1 bg-slate-800/50 p-3 rounded-2xl rounded-tl-none border border-slate-700">
                           <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold text-blue-400">{c.author}</span><span className="text-[8px] text-slate-500">{new Date(c.timestamp).toLocaleString()}</span></div>
                           <p className="text-xs text-slate-200">{c.text}</p>
                         </div>
                      </div>
                    ))}
                </div>
                <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                   <input className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500" placeholder="Type comment..." value={commentText} onChange={e=>setCommentText(e.target.value)} />
                   <input className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-xs outline-none focus:border-blue-500" placeholder="Name" value={commentName} onChange={e=>setCommentName(e.target.value)} />
                   <button onClick={handleAddComment} className="p-2 bg-blue-600 text-white rounded-lg"><Send size={16}/></button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-2">{modal.title}</h3>
                {modal.message && <p className="text-xs text-slate-400 mb-4">{modal.message}</p>}
                {modal.type === 'input' && <input className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500" defaultValue={modal.inputValue} onChange={e=>setModal({...modal, inputValue: e.target.value})} />}
                {modal.type === 'password' && <input className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500" type="password" placeholder="Password" onChange={e=>setModal({...modal, inputValue: e.target.value})} />}
                {modal.type === 'select' && <select className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500" onChange={e=>setModal({...modal, inputValue: e.target.value})}>{modal.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
                <div className="mt-6 flex gap-3">
                   <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-800">Cancel</button>
                   <button onClick={() => modal.onConfirm?.(modal.inputValue)} className={`flex-1 py-2 rounded-lg text-xs font-bold text-white ${modal.isDanger ? 'bg-red-600' : 'bg-blue-600'}`}>{modal.confirmText || 'OK'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OS NOTIFICATIONS */}
      <div className="fixed bottom-14 right-4 z-[300] flex flex-col gap-2">
        {notifications.map(n => (
          <div key={n.id} className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-5">
             {n.type === 'loading' ? <Loader2 size={16} className="animate-spin text-blue-400"/> : n.type === 'success' ? <CheckCircle size={16} className="text-green-400"/> : <XCircle size={16} className="text-red-400"/>}
             <span className="text-[10px] font-bold text-white tracking-wide uppercase">{n.message}</span>
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

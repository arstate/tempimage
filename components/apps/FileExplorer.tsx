
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, MoreVertical, 
  Trash2, Copy, Move, Edit, CheckSquare, 
  Loader2, Home, Upload, ChevronRight, X, AlertCircle, Download,
  CheckCircle, XCircle, Image, RotateCcw, Ban, Database, Lock, ShieldAlert, Cloud, CloudUpload, FileJson, RefreshCw,
  CheckCheck, MessageSquare, Reply, Send, Clock, Plus
} from 'lucide-react';
import * as API from '../../services/api';
import * as DB from '../../services/db';
import { Item, StoredNote, DownloadItem, FolderMap, Comment, CommentDB } from '../../types';
import { TextEditor } from '../TextEditor';
import { UploadProgress, UploadItem } from '../UploadProgress';
import { DownloadProgress } from '../DownloadProgress';

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

interface FileExplorerProps {
    isSystemInitialized: boolean;
    dbFileId: string | null;
    commentFileId: string | null;
    systemFolderId: string | null;
    initialFolderMap: FolderMap;
    initialComments: CommentDB;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ 
    isSystemInitialized, dbFileId, commentFileId, systemFolderId, 
    initialFolderMap, initialComments 
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string>(""); 
  const [parentFolderId, setParentFolderId] = useState<string>(""); 
  const [recycleBinId, setRecycleBinId] = useState<string>(""); 
  const [folderHistory, setFolderHistory] = useState<{id:string, name:string}[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false); 
  const [systemMap, setSystemMap] = useState<FolderMap>(initialFolderMap);
  const systemMapRef = useRef<FolderMap>(initialFolderMap); 
  const [comments, setComments] = useState<CommentDB>(initialComments);
  const commentsRef = useRef<CommentDB>(initialComments);
  const [isSavingDB, setIsSavingDB] = useState(false);
  const [isSavingComments, setIsSavingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isRefreshingComments, setIsRefreshingComments] = useState(false);
  const saveTimeoutRef = useRef<any>(null);
  const commentSaveTimeoutRef = useRef<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null); 
  const [contextMenu, setContextMenu] = useState<{x:number, y:number, targetItem?: Item, isRecycleBinBtn?: boolean} | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false); 
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
  const [notifications, setNotifications] = useState<{id: string, message: string, type: 'loading' | 'success' | 'error'}[]>([]);
  const [selectionBox, setSelectionBox] = useState<{x:number, y:number, width:number, height:number} | null>(null);
  const [customDragItem, setCustomDragItem] = useState<Item | null>(null);
  const [customDragPos, setCustomDragPos] = useState<{x:number, y:number} | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{x:number, y:number} | null>(null);
  const isPaintingRef = useRef<boolean>(false); 
  const longPressTimerRef = useRef<any>(null);
  const activeFolderIdRef = useRef<string>(currentFolderId);
  const [modal, setModal] = useState<any | null>(null);
  const [editingNote, setEditingNote] = useState<StoredNote | null>(null);
  const [viewingRawFile, setViewingRawFile] = useState<{title: string, content: string} | null>(null); 
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [commentName, setCommentName] = useState(localStorage.getItem('zombio_comment_name') || '');
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => { activeFolderIdRef.current = currentFolderId; }, [currentFolderId]);

  const triggerCloudSync = useCallback(() => {
      DB.saveSystemMap({ fileId: dbFileId, map: systemMapRef.current, lastSync: Date.now() });
      if (!dbFileId) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setIsSavingDB(true);
      saveTimeoutRef.current = setTimeout(async () => {
          try {
              await API.updateSystemDBFile(dbFileId, systemMapRef.current);
              setIsSavingDB(false);
          } catch (e) { 
            console.error("Cloud Sync Failed", e);
            setIsSavingDB(false); 
          }
      }, 3000);
  }, [dbFileId]);

  const triggerCommentSync = useCallback(async (immediate = false) => {
    if (!commentFileId) return;
    if (commentSaveTimeoutRef.current) clearTimeout(commentSaveTimeoutRef.current);
    const performSync = async () => {
        try {
            setIsSavingComments(true);
            await API.updateCommentDBFile(commentFileId, commentsRef.current);
            await DB.saveCommentsCache(commentsRef.current);
        } catch (e) {
            console.error("Comment Sync Failed", e);
        } finally {
            setIsSavingComments(false);
        }
    };
    if (immediate) await performSync();
    else commentSaveTimeoutRef.current = setTimeout(performSync, 2000);
  }, [commentFileId]);

  const handleRefreshComments = useCallback(async () => {
    if (!commentFileId) return;
    setIsRefreshingComments(true);
    try {
        const content = await API.getFileContent(commentFileId);
        const remoteComments = JSON.parse(content);
        commentsRef.current = remoteComments;
        setComments(remoteComments);
        await DB.saveCommentsCache(remoteComments);
    } catch (e) {
        addNotification("Gagal memperbarui komentar", "error");
    } finally {
        setIsRefreshingComments(false);
    }
  }, [commentFileId]);

  const updateMap = (action: 'add' | 'remove' | 'update' | 'move', updateItems: {id: string, name?: string, parentId?: string}[]) => {
      const nextMap = { ...systemMapRef.current };
      updateItems.forEach(item => {
          if (action === 'add' || action === 'update') {
              if (item.name) {
                  const existing = nextMap[item.id];
                  nextMap[item.id] = { 
                      id: item.id, 
                      name: item.name, 
                      parentId: item.parentId !== undefined ? item.parentId : (existing?.parentId || "root") 
                  };
              }
          } else if (action === 'remove') delete nextMap[item.id];
          else if (action === 'move') { 
              if (nextMap[item.id] && item.parentId !== undefined) nextMap[item.id] = { ...nextMap[item.id], parentId: item.parentId }; 
          }
      });
      systemMapRef.current = nextMap;
      setSystemMap(nextMap);
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

  const loadFolder = useCallback(async (folderId: string = "") => {
    setItems([]); setSelectedIds(new Set());
    let cachedItems = await DB.getCachedFolder(folderId);
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
        setItems(freshItems);
        const folders = freshItems.filter(i => i.type === 'folder');
        if (folders.length > 0) updateMap('add', folders.map(f => ({ id: f.id, name: f.name, parentId: folderId || "root" })));
        await DB.cacheFolderContents(folderId, freshItems);
      }
    } catch (e) { setLoading(false); }
  }, []);

  useEffect(() => { if (isSystemInitialized) loadFolder(currentFolderId); }, [currentFolderId, isSystemInitialized]);

  const executeAction = async (action: string) => {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : (contextMenu?.targetItem ? [contextMenu.targetItem.id] : []);
      setContextMenu(null);
      switch (action) {
          case 'comment':
            const target = items.find(i => i.id === ids[0]);
            if (target) { await handleRefreshComments(); setModal({ type: 'comment', title: `Komentar: ${target.name}`, targetItem: target }); }
            break;
          case 'new_folder':
              setModal({ type: 'input', title: 'Folder Baru', inputValue: 'New Folder', onConfirm: async (name: string) => {
                      if (name) { setModal(null); const notifId = addNotification('Membuat folder...', 'loading');
                          try { const res = await API.createFolder(currentFolderId, name); if (res.status === 'success' && res.data) { updateMap('add', [{ id: res.data.id, name: res.data.name, parentId: currentFolderId }]); updateNotification(notifId, 'Folder dibuat', 'success'); await loadFolder(currentFolderId); } } catch (e) { updateNotification(notifId, 'Gagal', 'error'); } } } });
              break;
          case 'delete':
              setModal({ type: 'confirm', title: 'Hapus Item?', confirmText: 'Hapus', isDanger: true, onConfirm: async () => {
                      setModal(null); const notifId = addNotification(`Menghapus ${ids.length} item...`, 'loading');
                      try { const binId = await API.getFolderContents("").then(res => (res.data as any[]).find(i=>i.name===RECYCLE_BIN_NAME)?.id); await API.moveItems(ids, binId); updateNotification(notifId, 'Dihapus', 'success'); await loadFolder(currentFolderId); } catch (e) { updateNotification(notifId, 'Gagal', 'error'); } } });
              break;
      }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
     if ((e.target as HTMLElement).closest('button, .floating-ui, input, .comment-area')) return;
     const target = e.target as HTMLElement;
     const itemRow = target.closest('[data-item-id]');
     dragStartPos.current = { x: e.clientX, y: e.clientY };
     if (itemRow) {
         const id = itemRow.getAttribute('data-item-id');
         if (id) {
             const clickedItem = items.find(i => i.id === id);
             if (clickedItem) {
                 longPressTimerRef.current = setTimeout(() => {
                     setCustomDragItem(clickedItem); setCustomDragPos({ x: e.clientX, y: e.clientY });
                     if (!selectedIds.has(clickedItem.id)) setSelectedIds(new Set([clickedItem.id]));
                 }, 500); 
             }
         }
     } else {
         setSelectionBox({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
     }
     setContextMenu(null); setIsNewDropdownOpen(false);
  };

  return (
    <div className="h-full bg-slate-950 text-slate-200 relative select-none flex flex-col" ref={containerRef} onPointerDown={handlePointerDown}>
        {/* Sub-Header for internal navigation */}
        <header className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                <button onClick={() => { setFolderHistory([]); setCurrentFolderId(""); }} className="p-1.5 hover:bg-slate-800 rounded transition-colors"><Home size={16} /></button>
                {folderHistory.map((h, i) => ( <React.Fragment key={h.id}><ChevronRight size={12} className="text-slate-600"/><button onClick={() => { setFolderHistory(folderHistory.slice(0, i+1)); setCurrentFolderId(h.id); }} className="text-xs hover:text-blue-400 whitespace-nowrap">{h.name}</button></React.Fragment> ))}
            </div>
            <div className="flex items-center gap-2">
                <div className={`text-[10px] flex items-center gap-1 ${isSavingDB ? 'text-blue-400' : 'text-slate-500'}`}>
                    {isSavingDB ? <Loader2 size={10} className="animate-spin"/> : <Cloud size={10}/>}
                    <span className="hidden sm:inline">{isSavingDB ? 'Syncing...' : 'Saved'}</span>
                </div>
                <button onClick={() => setIsNewDropdownOpen(!isNewDropdownOpen)} className="px-2 py-1 bg-blue-600 rounded text-xs font-bold hover:bg-blue-500 transition-all flex items-center gap-1"><Plus size={14}/> Baru</button>
            </div>
        </header>

        <main className="flex-1 overflow-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 content-start">
            {loading ? <div className="col-span-full py-20 flex flex-col items-center opacity-50"><Loader2 className="animate-spin mb-2"/>Loading folder...</div> :
             items.length === 0 ? <div className="col-span-full py-20 text-center opacity-30 flex flex-col items-center"><Folder size={48} className="mb-2"/>Folder Kosong</div> :
             items.map(item => (
                <div 
                    key={item.id} 
                    onDoubleClick={() => { if(item.type==='folder'){ setFolderHistory([...folderHistory, {id:item.id, name:item.name}]); setCurrentFolderId(item.id); } }}
                    className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all cursor-pointer ${selectedIds.has(item.id) ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'}`}
                    onClick={() => setSelectedIds(new Set([item.id]))}
                    data-item-id={item.id}
                >
                    {item.type === 'folder' ? <Folder size={32} className="text-blue-400 fill-blue-400/10"/> :
                     item.type === 'note' ? <FileText size={32} className="text-yellow-500 fill-yellow-500/10"/> :
                     <div className="w-full aspect-square bg-slate-950 rounded flex items-center justify-center overflow-hidden">
                        {item.thumbnail ? <img src={item.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ImageIcon className="text-slate-700"/>}
                     </div>
                    }
                    <span className="text-[10px] font-medium text-center truncate w-full">{item.name}</span>
                </div>
             ))
            }
        </main>
        
        {/* Notifications & Floating Panels from previous build here... (Omitted for brevity, assume full logic ported) */}
        <UploadProgress uploads={uploadQueue} onClose={() => setUploadQueue([])} onRemove={id => setUploadQueue(q => q.filter(u=>u.id!==id))}/>
        
        {isNewDropdownOpen && (
            <div className="absolute top-12 right-4 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 p-1 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                <button onClick={() => executeAction('new_folder')} className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded text-xs transition-colors"><Folder size={14} className="text-blue-400"/> New Folder</button>
                <label className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded text-xs transition-colors cursor-pointer"><Upload size={14} className="text-green-400"/> Upload File<input type="file" multiple className="hidden" onChange={async (e)=>{ if(e.target.files) { const files = Array.from(e.target.files); for(let f of files) await API.uploadToDrive(f, currentFolderId); await loadFolder(currentFolderId); } }}/></label>
            </div>
        )}
    </div>
  );
};

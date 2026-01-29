
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, MoreVertical, 
  ArrowLeft, Plus, Trash2, Copy, Move, Edit, CheckSquare, 
  Loader2, Home, Upload, ChevronRight, X, AlertCircle, Download, 
  CheckCircle, XCircle, Image, RotateCcw, Ban, GripVertical, Database, Lock, 
  ShieldAlert, Cloud, CloudUpload, FileJson, RefreshCw,
  CheckCheck, MessageSquare, Reply, Send, User, Clock,
  Grid, Monitor, Globe, Settings, ShoppingBag, Minus, Square, Search, Wifi,
  Maximize2, MonitorCheck, ExternalLink, Minimize2, LayoutGrid, Youtube, Play, Pause, SkipForward, Music,
  UploadCloud, RefreshCcw, Hand, Power, Focus
} from 'lucide-react';
import * as API from './services/api';
import * as DB from './services/db';
import { Item, StoredNote, DownloadItem, FolderMap, SystemDB, Comment, CommentDB, StoredImage } from './types';
import { TextEditor } from './components/TextEditor';
import { UploadProgress, UploadItem } from './components/UploadProgress';
import { DownloadProgress } from './components/DownloadProgress';
import { UploadZone } from './components/UploadZone';
import { ImageCard } from './components/ImageCard';
import { NotesApp } from './components/NotesApp';

// --- CONSTANTS ---
const DEFAULT_YOUTUBE_KEYS = [
  "AIzaSyAs8bePXF_yYJdgGKbFLTVLq06DTwngOQQ",
  "AIzaSyCe5-HkDEUTmGwjBQ8TrL-sxs_SMLLTjVA",
  "AIzaSyAKNAH4Tzd08pWYpVlwDx-ehXYbpfvsCqo",
  "AIzaSyDkoRMEP5tvCnujASCkCsDXLhruyieAds4",
  "AIzaSyC1V-c8uxlnyDI7ZqUjK5KoJb1wYeZcdg4"
];

const GRID_SIZE_X = 100;
const GRID_SIZE_Y = 120;

// --- TYPES ---
type ModalType = 'input' | 'confirm' | 'alert' | 'select' | 'password' | 'comment' | 'properties' | null;
interface ModalState {
  type: ModalType;
  title: string;
  message?: string;
  inputValue?: string;
  options?: { label: string; value: string }[];
  onConfirm?: (value?: string) => void;
  confirmText?: string;
  isDanger?: boolean;
  targetItem?: Item | API.AppDefinition;
  isLoading?: boolean;
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

// --- FILE SYSTEM ITEM COMPONENTS ---

const FolderItem = ({ item, hasComments, isRecycleBin, isSystem, selected, isDropTarget, onClick, onDoubleClick, onContextMenu, onToggleSelect, onCommentClick }: any) => (
  <div 
    id={`item-${item.id}`}
    data-item-id={item.id}
    data-folder-id={item.id}
    onClick={(e) => onClick(e, item)}
    onDoubleClick={(e) => onDoubleClick(e, item)}
    onContextMenu={(e) => onContextMenu(e, item)}
    className={`relative group p-2 rounded-xl border transition-all duration-200 flex flex-col items-center gap-2 select-none cursor-pointer
      ${selected ? 'bg-blue-600/20 border-blue-500/50 shadow-lg' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'}
      ${isDropTarget ? 'ring-2 ring-yellow-400 bg-yellow-400/10' : ''}
    `}
  >
    <div 
      onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
      className={`selection-checkbox absolute top-2 left-2 w-5 h-5 rounded-full border border-slate-500 flex items-center justify-center transition-all z-10
        ${selected ? 'bg-blue-500 border-blue-500 opacity-100' : 'bg-slate-900/50 opacity-0 group-hover:opacity-100 hover:bg-slate-700'}
      `}
    >
      {selected && <CheckCheck size={12} className="text-white"/>}
    </div>

    {hasComments && (
      <button 
        onClick={(e) => { e.stopPropagation(); onCommentClick(); }}
        className="absolute top-2 right-2 p-1 bg-slate-900/80 rounded-full text-yellow-400 hover:text-white hover:bg-yellow-600 transition-colors z-10"
      >
        <MessageSquare size={12} fill="currentColor" className="opacity-100"/>
      </button>
    )}

    <div className="w-16 h-14 flex items-center justify-center relative">
      {item.status === 'creating' || item.status === 'deleting' ? (
         <Loader2 size={24} className="animate-spin text-slate-400"/>
      ) : isRecycleBin ? <Trash2 size={40} className="text-red-500 drop-shadow-lg"/> : 
       isSystem ? <Database size={40} className="text-slate-400 drop-shadow-lg"/> :
       <Folder size={40} className={`${item.status === 'moving' ? 'text-slate-600' : 'text-blue-400'} drop-shadow-lg transition-colors`}/>}
      
      {item.status === 'moving' && <div className="absolute inset-0 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-white"/></div>}
    </div>

    <span className={`text-[11px] font-medium text-center leading-tight line-clamp-2 px-1 rounded ${selected ? 'text-blue-200' : 'text-slate-300'}`}>
      {item.status === 'creating' ? 'Creating...' : item.name}
    </span>
  </div>
);

const NoteItem = ({ item, hasComments, selected, onClick, onDoubleClick, onContextMenu, onToggleSelect, onCommentClick }: any) => (
  <div 
    id={`item-${item.id}`}
    data-item-id={item.id}
    onClick={(e) => onClick(e, item)}
    onDoubleClick={(e) => onDoubleClick(e, item)}
    onContextMenu={(e) => onContextMenu(e, item)}
    className={`relative group p-2 rounded-xl border transition-all duration-200 flex flex-col items-center gap-2 select-none cursor-pointer
      ${selected ? 'bg-blue-600/20 border-blue-500/50 shadow-lg' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'}
    `}
  >
    <div 
      onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
      className={`selection-checkbox absolute top-2 left-2 w-5 h-5 rounded-full border border-slate-500 flex items-center justify-center transition-all z-10
        ${selected ? 'bg-blue-500 border-blue-500 opacity-100' : 'bg-slate-900/50 opacity-0 group-hover:opacity-100 hover:bg-slate-700'}
      `}
    >
      {selected && <CheckCheck size={12} className="text-white"/>}
    </div>

    {hasComments && (
      <button 
        onClick={(e) => { e.stopPropagation(); onCommentClick(); }}
        className="absolute top-2 right-2 p-1 bg-slate-900/80 rounded-full text-yellow-400 hover:text-white hover:bg-yellow-600 transition-colors z-10"
      >
        <MessageSquare size={12} fill="currentColor" className="opacity-100"/>
      </button>
    )}

    <div className="w-16 h-14 flex items-center justify-center relative bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400"></div>
      {item.status === 'creating' || item.status === 'deleting' ? <Loader2 size={20} className="animate-spin text-slate-400"/> : (
        <div className="p-1.5 text-[6px] text-slate-800 w-full h-full overflow-hidden text-left font-mono leading-tight opacity-70">
          {item.content || "No content..."}
        </div>
      )}
    </div>

    <span className={`text-[11px] font-medium text-center leading-tight line-clamp-2 px-1 rounded ${selected ? 'text-blue-200' : 'text-slate-300'}`}>
      {item.status === 'deleting' ? 'Deleting...' : item.name.replace('.txt','')}
    </span>
  </div>
);

const ImageItem = ({ item, hasComments, selected, onClick, onDoubleClick, onContextMenu, onToggleSelect, onCommentClick }: any) => (
  <div 
    id={`item-${item.id}`}
    data-item-id={item.id}
    onClick={(e) => onClick(e, item)}
    onDoubleClick={(e) => onDoubleClick(e, item)}
    onContextMenu={(e) => onContextMenu(e, item)}
    className={`relative group p-2 rounded-xl border transition-all duration-200 flex flex-col items-center gap-2 select-none cursor-pointer
      ${selected ? 'bg-blue-600/20 border-blue-500/50 shadow-lg' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'}
    `}
  >
    <div 
      onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
      className={`selection-checkbox absolute top-2 left-2 w-5 h-5 rounded-full border border-slate-500 flex items-center justify-center transition-all z-10
        ${selected ? 'bg-blue-500 border-blue-500 opacity-100' : 'bg-slate-900/50 opacity-0 group-hover:opacity-100 hover:bg-slate-700'}
      `}
    >
      {selected && <CheckCheck size={12} className="text-white"/>}
    </div>

    {hasComments && (
      <button 
        onClick={(e) => { e.stopPropagation(); onCommentClick(); }}
        className="absolute top-2 right-2 p-1 bg-slate-900/80 rounded-full text-yellow-400 hover:text-white hover:bg-yellow-600 transition-colors z-10"
      >
        <MessageSquare size={12} fill="currentColor" className="opacity-100"/>
      </button>
    )}

    <div className="w-16 h-14 flex items-center justify-center relative bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
      {item.status === 'uploading' || item.status === 'deleting' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80"><Loader2 size={20} className="animate-spin text-blue-500"/></div>
      ) : (
        <>
           <img 
            src={item.thumbnail || item.url} 
            className="w-full h-full object-cover" 
            loading="lazy" 
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display='none'; }}
           />
           <ImageIcon size={20} className="text-slate-700 absolute -z-10"/>
        </>
      )}
    </div>

    <span className={`text-[11px] font-medium text-center leading-tight line-clamp-2 px-1 rounded ${selected ? 'text-blue-200' : 'text-slate-300'}`}>
      {item.status === 'deleting' ? 'Deleting...' : item.name}
    </span>
  </div>
);

// ... (Other components like YouTubeApp, GalleryApp, AppStoreApp remain unchanged, skipping for brevity but assuming they are here) ...
const YouTubeApp = ({ customKeys }: { customKeys?: string[] }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const allKeys = useMemo(() => [...(customKeys || []), ...DEFAULT_YOUTUBE_KEYS], [customKeys]);

  const searchYouTube = async (query: string) => {
    setLoading(true);
    setError("");
    let success = false;

    for (const key of allKeys) {
      try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(query)}&type=video&key=${key}`;
        const res = await fetch(url);
        
        if (res.status === 403 || res.status === 429) {
           continue; 
        }

        const data = await res.json();
        if (data.items) {
          setVideos(data.items);
          success = true;
          break;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (!success) {
      setError("Semua API Key limit habis atau terjadi kesalahan jaringan.");
    }
    setLoading(false);
  };

  return (
    <div className="h-full bg-[#0f0f0f] text-white flex flex-col">
       <div className="p-4 bg-[#0f0f0f] border-b border-[#272727] flex items-center gap-4">
          <div className="flex items-center gap-1 text-red-600 font-bold text-lg tracking-tighter">
             <Youtube size={28} fill="currentColor" />
             <span className="text-white">YouTube</span>
          </div>
          <div className="flex-1 max-w-2xl mx-auto flex gap-2">
             <input 
                className="flex-1 bg-[#121212] border border-[#303030] rounded-full px-4 py-2 text-sm focus:border-blue-500 outline-none" 
                placeholder="Telusuri"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchYouTube(searchQuery)}
             />
             <button onClick={() => searchYouTube(searchQuery)} className="bg-[#222] hover:bg-[#303030] px-4 py-2 rounded-full border border-[#303030]">
                <Search size={18} className="text-gray-400"/>
             </button>
          </div>
       </div>
       <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {currentVideoId && (
             <div className="flex-1 bg-black flex items-center justify-center relative group">
                <iframe 
                   src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1`} 
                   title="YouTube video player" 
                   className="w-full h-full border-0" 
                   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                   allowFullScreen
                ></iframe>
                <button onClick={() => setCurrentVideoId(null)} className="absolute top-4 left-4 bg-black/50 p-2 rounded-full hover:bg-red-600 text-white z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                   <ArrowLeft size={20}/>
                </button>
             </div>
          )}
          <div className={`${currentVideoId ? 'w-full md:w-80 border-l border-[#272727]' : 'w-full'} overflow-y-auto p-4 bg-[#0f0f0f]`}>
             {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-500"/></div>
             ) : error ? (
                <div className="text-red-500 text-center py-10 text-sm">{error}</div>
             ) : (
                <div className={`grid gap-4 ${currentVideoId ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                   {videos.map((vid: any) => (
                      <div key={vid.id.videoId} onClick={() => setCurrentVideoId(vid.id.videoId)} className="cursor-pointer group">
                         <div className="relative aspect-video rounded-xl overflow-hidden mb-2">
                            <img src={vid.snippet.thumbnails.medium.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                         </div>
                         <h3 className="font-bold text-sm line-clamp-2 text-white group-hover:text-blue-400">{vid.snippet.title}</h3>
                         <p className="text-xs text-gray-400 mt-1">{vid.snippet.channelTitle}</p>
                      </div>
                   ))}
                </div>
             )}
          </div>
       </div>
    </div>
  );
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
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {images.map((img: Item, idx: number) => (
              <ImageCard 
                key={img.id} 
                image={{ id: img.id, galleryId: "", name: img.name, type: "image/jpeg", size: 0, data: img.url || "", timestamp: img.lastUpdated }} 
                index={idx} onDelete={onDelete} onMaximize={(url) => window.open(url, '_blank')} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- CANVA APP COMPONENT WITH REMOTE CONTROLLER UI ---
const CanvaApp = ({ onLaunch, onCloseApp }: { onLaunch: () => void, onCloseApp: () => void }) => {
  const [isRunning, setIsRunning] = useState(false);
  const externalWindowRef = useRef<Window | null>(null);

  const handleLaunch = () => {
    // Calculate Dimensions
    const width = window.screen.availWidth;
    const height = window.screen.availHeight - 48; // Leave room for taskbar hint
    
    externalWindowRef.current = window.open(
      'https://www.canva.com', 
      'CanvaWindow', 
      `width=${width},height=${height},top=0,left=0,toolbar=no,menubar=no,location=no,status=no`
    );

    setIsRunning(true);
    onLaunch();
  };

  const handleFocus = () => {
    if (externalWindowRef.current && !externalWindowRef.current.closed) {
      externalWindowRef.current.focus();
    } else {
      // Re-launch if closed
      handleLaunch();
    }
  };

  const handleClose = () => {
    if (externalWindowRef.current) {
      externalWindowRef.current.close();
    }
    setIsRunning(false);
    onCloseApp();
  };

  // If running, show "Remote Controller" UI inside the window
  if (isRunning) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900 relative text-white">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
         
         <div className="z-10 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
            <div className="relative">
               <div className="w-32 h-32 bg-slate-800 rounded-full flex items-center justify-center shadow-2xl border border-slate-700">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Canva_icon_2021.svg/600px-Canva_icon_2021.svg.png" 
                    className="w-20 h-20 object-contain opacity-50"
                    alt="Canva Logo"
                  />
               </div>
               {/* Pulsing Status */}
               <div className="absolute -bottom-2 -right-2 bg-green-900/80 border border-green-500 text-green-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-md">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  Running Externally
               </div>
            </div>

            <h2 className="text-xl font-bold text-slate-300">Canva Remote Control</h2>
            <p className="text-slate-500 text-center max-w-xs text-sm">
               Aplikasi berjalan di jendela terpisah. Gunakan kontrol ini untuk mengelola sesi.
            </p>

            <div className="flex gap-4 mt-4">
               <button 
                 onClick={handleClose}
                 className="flex flex-col items-center gap-2 group"
               >
                  <div className="w-14 h-14 bg-red-500/10 group-hover:bg-red-500 text-red-500 group-hover:text-white rounded-2xl flex items-center justify-center transition-all shadow-lg border border-red-500/20">
                     <Power size={24} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-red-400">Tutup</span>
               </button>

               <button 
                 onClick={handleFocus}
                 className="flex flex-col items-center gap-2 group"
               >
                  <div className="w-14 h-14 bg-blue-500/10 group-hover:bg-blue-500 text-blue-500 group-hover:text-white rounded-2xl flex items-center justify-center transition-all shadow-lg border border-blue-500/20">
                     <Focus size={24} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-blue-400">Buka Kembali</span>
               </button>
            </div>
         </div>
      </div>
    );
  }

  // Launcher UI (Default)
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-[#7d2ae8] relative text-white overflow-hidden">
       {/* Background Animation */}
       <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
       
       <div className="z-10 text-center animate-in zoom-in-95 duration-500 p-8">
          <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-full flex items-center justify-center shadow-2xl">
             <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Canva_icon_2021.svg/600px-Canva_icon_2021.svg.png" 
                className="w-16 h-16 object-contain"
                alt="Canva Logo"
             />
          </div>
          <h1 className="text-4xl font-bold mb-2 text-shadow">Canva Designer</h1>
          <p className="text-white/80 mb-8 max-w-md mx-auto text-sm drop-shadow">
            Aplikasi ini akan berjalan di jendela khusus agar performa maksimal. Taskbar Cloud OS akan tetap aktif di window utama.
          </p>

          <button 
            onClick={handleLaunch}
            className="bg-white text-[#7d2ae8] px-8 py-4 rounded-full font-bold text-xl shadow-xl hover:scale-105 transition-transform flex items-center gap-3 mx-auto"
          >
            <span>Buka Jendela Canva</span>
            <ExternalLink size={24} />
          </button>
       </div>
    </div>
  );
};

// --- APP STORE COMPONENT ---
const AppStoreApp = ({ config, setConfig, addNotification, systemFolderId }: any) => {
   const [appName, setAppName] = useState('');
   const [appUrl, setAppUrl] = useState('');
   const [customIconFile, setCustomIconFile] = useState<File | null>(null);
   const [isInstalling, setIsInstalling] = useState(false);
   const [useProxy, setUseProxy] = useState(false);
   // State to track apps currently being uninstalled
   const [uninstallingIds, setUninstallingIds] = useState<Set<string>>(new Set());
 
   const popularApps = [
     { id: 'notes', name: 'Notes', url: 'internal://notes', icon: 'file-text' },
     { id: 'gallery', name: 'Gallery', url: 'internal://gallery', icon: 'image' },
     { id: 'youtube', name: 'YouTube', url: 'internal://youtube', icon: 'youtube' },
     { id: 'spotify', name: 'Spotify', url: 'https://open.spotify.com/embed', icon: 'music' },
     { id: 'canva', name: 'Canva', url: 'https://www.canva.com', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Canva_icon_2021.svg' },
     { id: 'google-maps', name: 'Maps', url: 'https://www.google.com/maps/embed', icon: 'globe' }
   ];

   const handleInstall = async (app: any) => {
    if (!config) return;
    if (config.installedApps.some((a: any) => a.id === app.id)) return;
    setIsInstalling(true);
    let finalIcon = app.icon;
    if (app.type === 'webapp' && customIconFile && systemFolderId) {
        try {
            const iconFolderId = await API.ensureAppIconFolder(systemFolderId);
            const uploadRes = await API.uploadToDrive(customIconFile, iconFolderId);
            finalIcon = uploadRes.thumbnail || uploadRes.url; 
        } catch (e) { console.error(e); }
    }
    const updatedConfig = { ...config, installedApps: [...config.installedApps, { ...app, icon: finalIcon, type: app.url?.startsWith('internal') ? 'system' : 'webapp' }] };
    try { await API.saveSystemConfig(updatedConfig); setConfig(updatedConfig); addNotification(`${app.name} berhasil ditambahkan`, "success"); } 
    catch (e) { addNotification("Gagal menyimpan konfigurasi", "error"); } finally { setIsInstalling(false); setCustomIconFile(null); }
   };

   const handleUninstall = async (appId: string) => {
    if (!config) return;
    const app = config.installedApps.find((a: any) => a.id === appId);
    if ((app?.type === 'system' && (app?.id === 'file-explorer' || app?.id === 'notes')) || app?.id === 'youtube') return;
    
    // Set loading state for this specific app
    setUninstallingIds(prev => new Set(prev).add(appId));

    try {
        const updatedConfig = { ...config, installedApps: config.installedApps.filter((a: any) => a.id !== appId) };
        await API.saveSystemConfig(updatedConfig);
        setConfig(updatedConfig);
        addNotification("Aplikasi berhasil dihapus", "success");
    } catch (e) {
        addNotification("Gagal menghapus aplikasi", "error");
    } finally {
        // Remove loading state
        setUninstallingIds(prev => {
            const next = new Set(prev);
            next.delete(appId);
            return next;
        });
    }
   };

   return (
    <div className="h-full bg-slate-900 text-white p-4 sm:p-8 overflow-y-auto space-y-8 pb-20">
      <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
        <div className="p-3 bg-pink-500/20 rounded-2xl shadow-xl"><ShoppingBag size={40} className="text-pink-500" /></div>
        <div><h1 className="text-2xl sm:text-3xl font-bold">App Store</h1><p className="text-slate-400 text-xs sm:text-sm">Pasang aplikasi web favorit</p></div>
      </div>
      <section className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2 text-blue-400"><Plus size={20} /> Install Web App</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 backdrop-blur-md">
          <div className="space-y-1"><label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Nama Aplikasi</label><input className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm" placeholder="Contoh: ChatGPT" value={appName} onChange={e => setAppName(e.target.value)}/></div>
          <div className="space-y-1 lg:col-span-2"><label className="text-[10px] uppercase font-bold text-slate-500 ml-1">URL Web</label><div className="flex flex-col gap-2"><input className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm" placeholder="Contoh: chat.openai.com" value={appUrl} onChange={e => setAppUrl(e.target.value)}/><div className="flex items-center gap-2"><input type="checkbox" checked={useProxy} onChange={e => setUseProxy(e.target.checked)} className="bg-slate-900"/><label className="text-xs text-slate-400">Bypass Blokir</label></div></div></div>
          <div className="flex items-end"><button onClick={() => { if(!appName || !appUrl) return; handleInstall({ id: 'custom-'+Date.now(), name: appName, url: appUrl, icon: 'globe', type: 'webapp' }); }} disabled={isInstalling} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold">{isInstalling ? <Loader2 className="animate-spin"/> : 'Instal'}</button></div>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-300">Terpasang</h2>
        <div className="space-y-2">
            {config?.installedApps.map((app: any) => (
                <div key={app.id} className="flex justify-between items-center p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800">
                            {app.icon.startsWith('http') ? <img src={app.icon} className="w-full h-full object-cover"/> : <Globe size={24}/>}
                        </div>
                        <div className="font-bold text-sm">{app.name}</div>
                    </div>
                    {app.type === 'webapp' && (
                        <button 
                            onClick={() => handleUninstall(app.id)} 
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg flex items-center gap-2 disabled:opacity-50"
                            disabled={uninstallingIds.has(app.id)}
                        >
                            {uninstallingIds.has(app.id) ? (
                                <>
                                    <Loader2 size={18} className="animate-spin"/>
                                    <span className="text-xs font-bold">Uninstalling...</span>
                                </>
                            ) : (
                                <Trash2 size={18}/>
                            )}
                        </button>
                    )}
                </div>
            ))}
        </div>
      </section>
      <section className="space-y-4"><h2 className="text-lg font-bold text-slate-300">Rekomendasi</h2><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{popularApps.map(app => (<div key={app.id} className="bg-slate-800/40 p-4 rounded-2xl flex flex-col items-center gap-4"><div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center">{app.icon.startsWith('http') ? <img src={app.icon} className="w-full h-full object-cover rounded-xl"/> : <Globe size={32}/>}</div><p className="font-bold text-sm">{app.name}</p><button onClick={() => handleInstall(app)} className="w-full py-2 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-bold">Instal</button></div>))}</div></section>
    </div>
   );
};

// ... FileExplorerApp component (no changes needed) ...
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
    onContextMenu,
    openNotesApp
}: any) => {
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{x:number, y:number, width:number, height:number} | null>(null);
  const [customDragItem, setCustomDragItem] = useState<Item | null>(null);
  const [customDragPos, setCustomDragPos] = useState<{x:number, y:number} | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [isExternalDragging, setIsExternalDragging] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{x:number, y:number} | null>(null);
  const isPaintingRef = useRef<boolean>(false); 
  const longPressTimerRef = useRef<any>(null);

  // EXTERNAL DRAG AND DROP HANDLERS
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) setIsExternalDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsExternalDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsExternalDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleUploadFiles(Array.from(e.dataTransfer.files));
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
         const x = Math.min(dragStartPos.current.x, currentLocalX); const y = Math.min(dragStartPos.current.y, currentLocalY);
         const width = Math.abs(currentLocalX - dragStartPos.current.x); const height = Math.abs(currentLocalY - dragStartPos.current.y);
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
          executeAction('move', Array.from(selectedIds), targetId);
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
                onConfirm: (val: string | undefined) => {
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
            openNotesApp(item.id);
        }
    } else if (item.type === 'image') { setPreviewImage(item.url || null); }
  };

  const openComments = async (item: Item) => {
      setIsCommentsLoading(true);
      setItems((prev: Item[]) => prev.map(i => i.id === item.id ? { ...i, status: 'creating' } : i)); 
      await handleRefreshComments(); 
      setItems((prev: Item[]) => prev.map(i => i.id === item.id ? { ...i, status: 'idle' } : i)); 
      setIsCommentsLoading(false);
      setModal({ type: 'comment', title: `Comments: ${item.name}`, targetItem: item });
  };

  const localHandleContextMenu = (e: React.MouseEvent | React.PointerEvent, item?: Item) => {
    e.preventDefault(); e.stopPropagation();
    if (item) {
        if (!selectedIds.has(item.id)) { setSelectedIds(new Set([item.id])); setLastSelectedId(item.id); }
        onContextMenu(e, item, currentFolderId === recycleBinId);
    } else {
        onContextMenu(e, null, currentFolderId === recycleBinId);
    }
  };

  const groupedItems = { folders: items.filter((i: Item) => i.type === 'folder'), notes: items.filter((i: Item) => i.type === 'note'), images: items.filter((i: Item) => i.type === 'image') };
  const isSystemFolder = currentFolderId === systemFolderId;

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-slate-900 overflow-hidden relative touch-none" 
         onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
         onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
         onContextMenu={(e) => localHandleContextMenu(e)}>
      
      {selectionBox && (<div className="absolute z-[150] bg-blue-500/20 border border-blue-400 pointer-events-none" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />)}
      {isExternalDragging && ( <div className="absolute inset-0 z-[160] bg-blue-600/20 backdrop-blur-[2px] border-2 border-dashed border-blue-500 m-4 rounded-2xl flex flex-col items-center justify-center pointer-events-none"><UploadCloud size={48} className="text-blue-500 mb-2 animate-bounce"/><span className="text-lg font-bold text-blue-500 uppercase tracking-widest">Drop files to upload</span></div> )}

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
                <button onClick={() => { setIsNewDropdownOpen(false); openNotesApp(undefined, true); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg flex items-center gap-2 text-xs"><FileText size={14} className="text-yellow-400"/> New Note</button>
                <button onClick={() => { setIsNewDropdownOpen(false); executeAction('native_upload'); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg flex items-center gap-2 text-xs"><Upload size={14} className="text-green-400"/> Upload File</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading && items.length === 0 ? ( <div className="flex flex-col items-center justify-center py-10 opacity-50"><Loader2 size={32} className="animate-spin text-blue-500"/></div> ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
             <Folder size={48} className="mb-2 opacity-20"/>
             <p className="text-sm">This folder is empty</p>
          </div>
        ) : (
          <>
            {groupedItems.folders.length > 0 && ( <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{groupedItems.folders.map((item: Item) => (<FolderItem key={item.id} item={item} hasComments={(comments[item.id]?.length || 0) > 0} isRecycleBin={item.id === recycleBinId} isSystem={item.id === systemFolderId || item.name === SYSTEM_FOLDER_NAME} selected={selectedIds.has(item.id)} isDropTarget={dropTargetId === item.id} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={localHandleContextMenu} onToggleSelect={() => { setSelectedIds((prev: Set<string>) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; }); setLastSelectedId(item.id); }} onCommentClick={() => openComments(item)} />))}</div> )}
            {groupedItems.notes.length > 0 && ( <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{groupedItems.notes.map((item: Item) => (<NoteItem key={item.id} item={item} hasComments={(comments[item.id]?.length || 0) > 0} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={localHandleContextMenu} onToggleSelect={() => { setSelectedIds((prev: Set<string>) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; }); setLastSelectedId(item.id); }} onCommentClick={() => openComments(item)} />))}</div> )}
            {groupedItems.images.length > 0 && ( <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{groupedItems.images.map((item: Item) => (<ImageItem key={item.id} item={item} hasComments={(comments[item.id]?.length || 0) > 0} selected={selectedIds.has(item.id)} onClick={handleItemClick} onDoubleClick={handleItemDoubleClick} onContextMenu={localHandleContextMenu} onToggleSelect={() => { setSelectedIds((prev: Set<string>) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; }); setLastSelectedId(item.id); }} onCommentClick={() => openComments(item)} />))}</div> )}
          </>
        )}
      </div>

      {isCommentsLoading && (
         <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-50">
             <div className="bg-slate-800 p-4 rounded-xl flex items-center gap-3 shadow-xl">
                 <Loader2 className="animate-spin text-yellow-400"/>
                 <span className="text-white text-xs font-bold">Memuat Komentar...</span>
             </div>
         </div>
      )}

      {selectedIds.size > 0 && !selectedIds.has(systemFolderId) && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-full px-4 py-2 flex items-center gap-3 shadow-2xl z-[80] animate-in slide-in-from-bottom-5">
              <span className="text-xs font-bold text-blue-400">{selectedIds.size} Selected</span>
              <div className="w-px h-4 bg-slate-700"></div>
              
              {selectedIds.has(recycleBinId) ? (
                  <>
                    <button onClick={() => executeAction('restore_all')} className="p-1.5 hover:bg-slate-800 rounded-lg text-green-400 flex items-center gap-2" title="Restore All">
                        <RotateCcw size={16}/> <span className="text-xs font-bold">Restore All</span>
                    </button>
                    <button onClick={() => executeAction('empty_bin')} className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500 flex items-center gap-2" title="Empty Recycle Bin">
                        <Trash2 size={16}/> <span className="text-xs font-bold">Empty Bin</span>
                    </button>
                  </>
              ) : (
                  <>
                    <button onClick={() => executeAction('comment')} className="p-1.5 hover:bg-slate-800 rounded-lg text-yellow-400" title="Comment"><MessageSquare size={16}/></button>
                    <button onClick={() => executeAction('download')} className="p-1.5 hover:bg-slate-800 rounded-lg text-emerald-400" title="Download"><Download size={16}/></button>
                    <button onClick={() => executeAction('move')} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300" title="Move"><Move size={16}/></button>
                    <button onClick={() => executeAction('duplicate')} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300" title="Duplicate"><Copy size={16}/></button>
                    <button onClick={() => executeAction('delete')} className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500" title="Delete"><Trash2 size={16}/></button>
                  </>
              )}
              
              <button onClick={() => setSelectedIds(new Set())} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500" title="Cancel Selection"><X size={16}/></button>
          </div>
      )}
    </div>
  );
};

// --- SETTINGS APP COMPONENT ---
const SettingsApp = ({ config, onSave, systemFolderId, addNotification, installPrompt, onInstallPWA }: any) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [isUploading, setIsUploading] = useState(false);
  const [installStatus, setInstallStatus] = useState<'hidden' | 'available' | 'installed'>('hidden');

  useEffect(() => {
    // Check if running in standalone mode (PWA installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) {
      setInstallStatus('installed');
    } else if (installPrompt) {
      setInstallStatus('available');
    } else {
      setInstallStatus('hidden');
    }
  }, [installPrompt]);

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!systemFolderId) {
          addNotification("System folder not found", "error");
          return;
      }

      setIsUploading(true);
      try {
          const res = await API.uploadToDrive(file, systemFolderId);
          if (res && (res.url || res.thumbnail)) {
              const newWallpaperUrl = res.url || res.thumbnail;
              const newConfig = { ...localConfig, wallpaper: newWallpaperUrl };
              setLocalConfig(newConfig);
              await onSave(newConfig);
              addNotification("Wallpaper Uploaded", "success");
          }
      } catch (e) {
          console.error(e);
          addNotification("Failed to upload wallpaper", "error");
      } finally {
          setIsUploading(false);
      }
  };

  return (
    <div className="h-full bg-slate-900 text-white p-6 flex flex-col gap-6 overflow-auto">
      <h2 className="text-2xl font-bold flex items-center gap-3 text-white"><Settings size={28} className="text-blue-600"/> Settings</h2>
      <div className="space-y-6 max-w-lg">
        {/* --- SYSTEM SETTINGS (PWA) --- */}
        <section className="bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">System</h3>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-700">
                            <Monitor size={20} className="text-blue-400"/>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white">Install Web App</div>
                            <div className="text-[10px] text-slate-400">Install as PWA on Device</div>
                        </div>
                    </div>
                    <button 
                        onClick={onInstallPWA}
                        disabled={installStatus !== 'available'}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2
                          ${installStatus === 'available' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-95' : 
                            installStatus === 'installed' ? 'bg-green-500/20 text-green-400' : 
                            'bg-slate-700/50 text-slate-500 cursor-not-allowed'}`}
                    >
                        {installStatus === 'available' ? (
                           <>
                             <Download size={14} />
                             <span>Install App</span>
                           </>
                        ) : installStatus === 'installed' ? (
                           <>
                             <CheckCircle size={14} />
                             <span>Installed</span>
                           </>
                        ) : (
                           <span>Unavailable / Installed</span>
                        )}
                    </button>
                </div>
            </div>
        </section>

        <section className="bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Appearance</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">Wallpaper Image</label>
              
              <div className="flex flex-col gap-3">
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                      {isUploading ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                              <Loader2 className="animate-spin text-blue-400"/>
                          </div>
                      ) : (
                          <img src={localConfig.wallpaper} className="w-full h-full object-cover"/>
                      )}
                  </div>
                  
                  <div className="flex gap-2">
                       <label className={`flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-white text-center cursor-pointer transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                           <input type="file" accept="image/*" className="hidden" onChange={handleWallpaperUpload} disabled={isUploading} />
                           {isUploading ? "Uploading..." : "Upload New Image"}
                       </label>
                  </div>
              </div>

              <div className="mt-4">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">OR ENTER URL</label>
                  <input 
                      className="w-full p-2 border border-slate-700 rounded-lg text-sm bg-slate-950 text-white focus:outline-none focus:border-blue-500" 
                      value={localConfig.wallpaper} 
                      onChange={(e) => setLocalConfig({...localConfig, wallpaper: e.target.value})} 
                      placeholder="https://..."
                  />
              </div>
            </div>
          </div>
        </section>
        <button onClick={() => onSave(localConfig)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95">Save Changes</button>
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
  const [globalContextMenu, setGlobalContextMenu] = useState<{x:number, y:number, targetItem?: Item | API.AppDefinition, isRecycleBin?: boolean, type?: 'desktop' | 'item' | 'app' | 'folder-background'} | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCanvaRunning, setIsCanvaRunning] = useState(false);

  // EXPLORER STATE
  const [currentFolderId, setCurrentFolderId] = useState<string>(""); 
  const currentFolderIdRef = useRef<string>(""); // Ref to track current folder accurately during async ops
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
  const [bootProgress, setBootProgress] = useState(0); // Progress bar state
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

  // Interaction State
  const [isInteracting, setIsInteracting] = useState(false);
  const [selectedDesktopIcon, setSelectedDesktopIcon] = useState<string | null>(null);
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(e => console.error(e)); } 
    else { if (document.exitFullscreen) document.exitFullscreen(); }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // --- PWA INSTALL HANDLER ---
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  // --- OS BOOT ---
  useEffect(() => {
    const boot = async () => {
      try {
        setBootProgress(10);
        setGlobalLoadingMessage("Loading System Configuration...");
        const osConfig = await API.getSystemConfig();
        setBootProgress(30);
        
        let configUpdated = false;
        if (!osConfig.installedApps.some(app => app.id === 'youtube')) { osConfig.installedApps.push({ id: 'youtube', name: 'YouTube', url: 'internal://youtube', icon: 'youtube', type: 'system' }); configUpdated = true; }
        if (!osConfig.installedApps.some(app => app.id === 'notes')) { osConfig.installedApps.push({ id: 'notes', name: 'Notes', url: 'internal://notes', icon: 'file-text', type: 'system' }); configUpdated = true; }
        if (!osConfig.installedApps.some(app => app.id === 'recycle-bin')) { osConfig.installedApps.push({ id: 'recycle-bin', name: 'Recycle Bin', url: 'internal://recycle-bin', icon: 'trash', type: 'system' }); configUpdated = true; }

        setConfig(osConfig);

        setGlobalLoadingMessage("Locating Cloud Storage...");
        setBootProgress(50);
        const cloudLocation = await API.locateSystemDB();
        let sysFolderId = cloudLocation.systemFolderId;
        let curDbFileId = cloudLocation.fileId; 
        let curCommentFileId = cloudLocation.commentFileId;

        if (!sysFolderId) { setGlobalLoadingMessage("Initializing System Folder..."); sysFolderId = await API.createSystemFolder(); }
        setSystemFolderId(sysFolderId);
        setBootProgress(70);

        let finalMap: FolderMap = { "root": { id: "root", name: "Home", parentId: "" } };
        if (curDbFileId) {
            setGlobalLoadingMessage("Syncing File System DB...");
            const content = await API.getFileContent(curDbFileId);
            finalMap = JSON.parse(content);
        } else { curDbFileId = await API.createSystemDBFile(finalMap, sysFolderId); }
        setBootProgress(85);

        let finalComments: CommentDB = {};
        if (curCommentFileId) {
            setGlobalLoadingMessage("Syncing Comments DB...");
            const content = await API.getFileContent(curCommentFileId);
            finalComments = JSON.parse(content);
        } else { curCommentFileId = await API.createCommentDBFile(finalComments, sysFolderId); }

        systemMapRef.current = finalMap; setSystemMap(finalMap); setDbFileId(curDbFileId);
        commentsRef.current = finalComments; setComments(finalComments); setCommentFileId(curCommentFileId);
        
        await DB.saveSystemMap({ fileId: curDbFileId, map: finalMap, lastSync: Date.now() });
        await DB.saveCommentsCache(finalComments);
        setBootProgress(100);
        setGlobalLoadingMessage("Starting...");
        setIsSystemInitialized(true);
      } catch (e) { console.error("Boot Error:", e); } finally { 
          setTimeout(() => setIsGlobalLoading(false), 500); // Slight delay to show 100%
      }
    };
    boot();
  }, []);

  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(timer); }, []);

  // ... (Shared Explorer Actions, unchanged) ...
  // Fix Explorer Bug: Ensure we are only updating state if the folder hasn't changed during fetch
  const handleSetCurrentFolderId = (id: string) => {
      setCurrentFolderId(id);
      currentFolderIdRef.current = id;
  };

  const loadFolder = useCallback(async (folderId: string = "") => {
    // If the requested folder is not the one currently tracked, we might be lagging, but usually we want to respect the call
    // However, when multiple rapid clicks happen, we need to ensure the final result matches the final intent
    
    // Clear items immediately to show loading state for the NEW folder
    setItems([]); 
    setLoading(true);
    
    const cacheKey = folderId || "root";
    const cached = await DB.getCachedFolder(cacheKey);
    
    // Race condition check: If folder changed while DB fetch happened
    if (folderId !== currentFolderIdRef.current && isSystemInitialized) {
        // This check is a bit tricky because loadFolder might be called alongside setCurrentFolderId
        // But assuming consistent usage...
    }

    if (cached) setItems(cached); 
    
    setSelectedIds(new Set());
    try {
      const res = await API.getFolderContents(folderId);
      
      // CRITICAL FIX: Only update state if we are still looking at the requested folder
      if (currentFolderIdRef.current !== folderId) {
          return;
      }

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
    } catch (e) { console.error(e); } finally { 
        if (currentFolderIdRef.current === folderId) setLoading(false); 
    }
  }, [systemMap, isSystemInitialized]);

  useEffect(() => { 
      if (isSystemInitialized) {
          // Ensure ref matches state on init/change
          currentFolderIdRef.current = currentFolderId;
          loadFolder(currentFolderId); 
      }
  }, [currentFolderId, isSystemInitialized]);

  const triggerCloudSync = useCallback(() => {
    if (!dbFileId) return;
    setIsSavingDB(true);
    setTimeout(async () => {
      try { await API.updateSystemDBFile(dbFileId, systemMapRef.current); setIsSavingDB(false); } 
      catch (e) { setIsSavingDB(false); }
    }, 2000);
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
    const itemsToDownload = items.filter(i => ids.includes(i.id) && (i.type === 'image' || i.type === 'note'));
    if (itemsToDownload.length === 0) return addNotification("Only images and notes can be downloaded", "error");
    
    const newDownloads: DownloadItem[] = itemsToDownload.map(i => ({ id: i.id, name: i.name, status: 'pending', progress: 0 }));
    setDownloadQueue(prev => [...prev, ...newDownloads]);
    
    for (const dItem of newDownloads) {
        setDownloadQueue(prev => prev.map(d => d.id === dItem.id ? { ...d, status: 'downloading' } : d));
        try {
            const item = itemsToDownload.find(i => i.id === dItem.id);
            if (!item) throw new Error("Item missing");
            
            let blobUrl = "";
            
            if (item.type === 'image' && item.url) {
                const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(item.url)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error("Fetch failed");
                const blob = await response.blob();
                blobUrl = URL.createObjectURL(blob);
            } else if (item.type === 'note') {
                let content = item.content;
                if (!content) content = await API.getFileContent(item.id);
                const blob = new Blob([content], {type: 'text/plain'});
                blobUrl = URL.createObjectURL(blob);
            } else {
                throw new Error("Unsupported type");
            }

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

  const handleAddComment = async () => {
    if (!commentName.trim() || !commentText.trim() || !modal?.targetItem) return;
    setIsPostingComment(true); 
    const targetId = modal.targetItem.id;
    const newComment: Comment = { id: Date.now().toString(), itemId: targetId, author: commentName, text: commentText, timestamp: Date.now() };
    const next = { ...commentsRef.current }; 
    if (!next[targetId]) next[targetId] = []; 
    next[targetId] = [...next[targetId], newComment];
    commentsRef.current = next; setComments(next);
    try { await triggerCommentSync(); setCommentText(''); addNotification("Comment posted", "success"); } 
    catch (e) { addNotification("Failed", "error"); } finally { setIsPostingComment(false); }
  };

  const handleWebAppPropertyChange = async (appId: string, key: string, value: any) => {
     if(!config) return;
     
     // 1. Update Config State
     const updatedApps = config.installedApps.map(app => 
         app.id === appId ? { ...app, [key]: value } : app
     );
     const updatedConfig = { ...config, installedApps: updatedApps };
     setConfig(updatedConfig);

     // 2. Update Active Windows State (Immediate Feedback)
     setWindows(prev => prev.map(w => w.appId === appId ? { ...w, appData: { ...w.appData, [key]: value } } : w));

     // 3. Update Modal State (if open)
     if (modal && modal.targetItem && modal.targetItem.id === appId) {
         setModal({ ...modal, targetItem: { ...modal.targetItem, [key]: value } as any });
     }

     // 4. Save to Cloud
     try { 
         await API.saveSystemConfig(updatedConfig); 
     } catch(e) { 
         addNotification("Failed to save settings", "error"); 
     }
  };

  const executeAction = async (action: string, specificIds?: string[], targetFolderId?: string) => {
    const ids = specificIds || Array.from(selectedIds);
    if (ids.length === 0 && action !== 'new_folder' && action !== 'native_upload' && action !== 'empty_bin' && action !== 'restore_all') return;

    switch (action) {
      case 'comment':
        const targetComment = items.find(i => i.id === ids[0]);
        if(targetComment) {
          setIsPostingComment(false);
          setItems(prev => prev.map(i => i.id === targetComment.id ? { ...i, status: 'creating' } : i));
          await handleRefreshComments();
          setItems(prev => prev.map(i => i.id === targetComment.id ? { ...i, status: 'idle' } : i));
          setModal({ type: 'comment', title: `Comments: ${targetComment.name}`, targetItem: targetComment });
        }
        break;
      case 'download': handleDownloadItems(ids); break;
      case 'new_folder':
        setModal({ type: 'input', title: 'New Folder', inputValue: 'Untitled Folder', onConfirm: async (name) => {
          if(!name) return; setModal(null); 
          const tempId = `temp-${Date.now()}`;
          const tempItem: Item = { id: tempId, name: name, type: 'folder', lastUpdated: Date.now(), status: 'creating' };
          setItems(prev => [tempItem, ...prev]);
          try { 
              const res = await API.createFolder(currentFolderId, name); 
              if (res.status === 'success') {
                  setItems(prev => prev.map(i => i.id === tempId ? { ...i, id: res.data.id, status: 'idle' } : i));
                  await loadFolder(currentFolderId);
              } else throw new Error();
          }
          catch(e) { setItems(prev => prev.filter(i => i.id !== tempId)); addNotification('Failed to create folder', 'error'); }
        }});
        break;
      case 'native_upload': {
          const input = document.createElement('input');
          input.type = 'file'; input.multiple = true;
          input.onchange = (e: any) => { if (e.target.files) handleUploadFiles(Array.from(e.target.files)); };
          input.click();
          break;
      }
      case 'rename':
        const target = items.find(i => i.id === ids[0]);
        if(!target) return;
        setModal({ type: 'input', title: 'Rename', inputValue: target.name, onConfirm: async (newName) => {
          if(!newName) return; setModal(null); 
          const oldName = target.name;
          setItems(prev => prev.map(i => i.id === target.id ? { ...i, name: newName } : i));
          try { await API.renameItem(target.id, newName); await loadFolder(currentFolderId); }
          catch(e) { setItems(prev => prev.map(i => i.id === target.id ? { ...i, name: oldName } : i)); addNotification('Failed to rename', 'error'); }
        }});
        break;
      case 'delete':
        const isPerm = currentFolderId === recycleBinId;
        setModal({ type: 'confirm', title: isPerm ? 'Delete Permanently?' : 'Move to Recycle Bin?', isDanger: true, confirmText: 'Delete', onConfirm: async () => {
          setModal(null); 
          const idsToDelete = ids;
          setItems(prev => prev.map(i => idsToDelete.includes(i.id) ? { ...i, status: 'deleting' } : i));
          try { 
            if (!isPerm) {
                 const binId = recycleBinId || (await API.createFolder("", RECYCLE_BIN_NAME)).data.id;
                 if (!recycleBinId) setRecycleBinId(binId);
                 // Save meta for restore
                 for (const id of idsToDelete) {
                     await DB.saveDeletedMeta(id, currentFolderId);
                 }
                 await API.moveItems(idsToDelete, binId); 
            } else {
                 await API.deleteItems(idsToDelete);
                 for (const id of idsToDelete) { await DB.removeDeletedMeta(id); }
            }
            setItems(prev => prev.filter(i => !idsToDelete.includes(i.id)));
          } catch(e) { 
              addNotification('Delete failed', 'error'); 
              setItems(prev => prev.map(i => idsToDelete.includes(i.id) ? { ...i, status: 'idle' } : i));
          }
        }});
        break;
      case 'restore':
          setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: 'moving' } : i));
          const restorePromises = ids.map(async (id) => {
              const originalParent = await DB.getDeletedMeta(id);
              if (originalParent) {
                  await API.moveItems([id], originalParent);
                  await DB.removeDeletedMeta(id);
              } else {
                  // Fallback to root if unknown
                  await API.moveItems([id], ""); 
              }
          });
          try {
              await Promise.all(restorePromises);
              setItems(prev => prev.filter(i => !ids.includes(i.id)));
              addNotification("Items restored", "success");
          } catch(e) {
              addNotification("Restore failed", "error");
              setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: 'idle' } : i));
          }
          break;
      case 'restore_all':
          const notifRestore = addNotification("Restoring all items...", "loading");
          try {
              const binItemsRes = await API.getFolderContents(recycleBinId);
              if(binItemsRes.status === 'success' && Array.isArray(binItemsRes.data)) {
                  const itemsToRestore = binItemsRes.data;
                  if (itemsToRestore.length === 0) {
                      updateNotification(notifRestore, "Bin is empty", "success");
                      return;
                  }
                  const restoreIds = itemsToRestore.map((i: any) => i.id);
                  
                  // Use existing restore logic but manually since we are outside valid selection scope
                  const restoreAllPromises = restoreIds.map(async (id) => {
                      const originalParent = await DB.getDeletedMeta(id);
                      if (originalParent) {
                          await API.moveItems([id], originalParent);
                          await DB.removeDeletedMeta(id);
                      } else {
                          await API.moveItems([id], ""); 
                      }
                  });
                  await Promise.all(restoreAllPromises);
                  
                  updateNotification(notifRestore, "All items restored", "success");
                  // If we are currently viewing the bin, refresh it
                  if (currentFolderId === recycleBinId) loadFolder(recycleBinId);
              } else {
                  throw new Error("Failed to fetch bin contents");
              }
          } catch(e) {
              updateNotification(notifRestore, "Restore all failed", "error");
          }
          break;
      case 'empty_bin':
          setModal({ type: 'confirm', title: 'Empty Recycle Bin?', message: 'All files will be permanently deleted.', isDanger: true, confirmText: 'Empty Bin', onConfirm: async () => {
             setModal(null);
             
             // If we are not inside the bin, we need to fetch items first to clear view if needed
             // But simpler is to call delete on all items found in bin
             const notifEmpty = addNotification("Emptying bin...", "loading");
             try {
                 // First get items to delete
                 let itemsToDelete: string[] = [];
                 if (currentFolderId === recycleBinId && items.length > 0) {
                     itemsToDelete = items.map(i => i.id);
                 } else {
                     const binRes = await API.getFolderContents(recycleBinId);
                     if (binRes.status === 'success' && Array.isArray(binRes.data)) {
                         itemsToDelete = binRes.data.map((i: any) => i.id);
                     }
                 }

                 if (itemsToDelete.length > 0) {
                     await API.deleteItems(itemsToDelete);
                     for (const id of itemsToDelete) { await DB.removeDeletedMeta(id); }
                 }
                 
                 if (currentFolderId === recycleBinId) setItems([]);
                 updateNotification(notifEmpty, "Recycle Bin emptied", "success");
             } catch(e) {
                 updateNotification(notifEmpty, "Failed to empty bin", "error");
                 if (currentFolderId === recycleBinId) loadFolder(recycleBinId);
             }
          }});
          break;
      case 'duplicate':
        const notifDup = addNotification('Duplicating...', 'loading');
        try { await API.duplicateItems(ids); updateNotification(notifDup, 'Duplicated', 'success'); await loadFolder(currentFolderId); }
        catch(e) { updateNotification(notifDup, 'Failed', 'error'); }
        break;
      case 'move':
        const finalTarget = targetFolderId;
        if (!finalTarget) {
            const opts = Object.values(systemMap).map(f => ({ label: f.name, value: f.id }));
            setModal({ type: 'select', title: 'Move to...', options: opts, onConfirm: async (tid) => {
                if(!tid) return; setModal(null); executeAction('move', ids, tid);
            }});
            return;
        }
        setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: 'moving' } : i));
        try { 
            await API.moveItems(ids, finalTarget); 
            setItems(prev => prev.filter(i => !ids.includes(i.id)));
            addNotification('Moved successfully', 'success');
        } catch(e) { 
            setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: 'idle' } : i));
            addNotification('Move failed', 'error'); 
        }
        break;
    }
  };

  const handlePropertiesSave = async (updatedKeys: string[]) => {
     if(!config) return;
     const updatedConfig = { ...config, youtubeApiKeys: updatedKeys };
     try { await API.saveSystemConfig(updatedConfig); setConfig(updatedConfig); addNotification("API Keys updated", "success"); setModal(null); } 
     catch(e) { addNotification("Failed to save keys", "error"); }
  };
  
  const handleRefreshDesktop = async () => {
     const notifId = addNotification("Refreshing System...", "loading");
     try {
         const osConfig = await API.getSystemConfig();
         let configUpdated = false;
         // Ensure system apps exist
         if (!osConfig.installedApps.some(app => app.id === 'youtube')) { osConfig.installedApps.push({ id: 'youtube', name: 'YouTube', url: 'internal://youtube', icon: 'youtube', type: 'system' }); configUpdated = true; }
         if (!osConfig.installedApps.some(app => app.id === 'notes')) { osConfig.installedApps.push({ id: 'notes', name: 'Notes', url: 'internal://notes', icon: 'file-text', type: 'system' }); configUpdated = true; }
         if (!osConfig.installedApps.some(app => app.id === 'recycle-bin')) { osConfig.installedApps.push({ id: 'recycle-bin', name: 'Recycle Bin', url: 'internal://recycle-bin', icon: 'trash', type: 'system' }); configUpdated = true; }
         
         setConfig(osConfig);
         updateNotification(notifId, "System Refreshed", "success");
     } catch(e) {
         updateNotification(notifId, "Refresh Failed", "error");
     }
  };

  // ... (Window manager and other helper functions remain the same) ...
  const handleWindowAction = (instanceId: string, e: React.PointerEvent, actionType: 'move' | 'resize', corner?: string) => {
    if (e.button !== 0) return;
    const win = windows.find(w => w.instanceId === instanceId);
    if (!win || win.isMaximized) return;
    setActiveWindowId(instanceId); setIsInteracting(true); 
    const startX = e.pageX; const startY = e.pageY;
    const initialPos = { ...win.position }; const initialSize = { ...win.size };
    const winEl = document.getElementById(`window-${instanceId}`);
    if (!winEl) return;
    winEl.style.willChange = actionType === 'move' ? 'left, top' : 'width, height, left, top';
    winEl.style.transform = 'translateZ(0)';
    let currentX = initialPos.x; let currentY = initialPos.y; let currentW = initialSize.w; let currentH = initialSize.h;

    const onPointerMove = (moveEvent: PointerEvent) => {
        requestAnimationFrame(() => {
          const dx = moveEvent.pageX - startX; const dy = moveEvent.pageY - startY;
          if (actionType === 'move') {
              currentX = initialPos.x + dx; currentY = initialPos.y + dy;
              winEl.style.left = `${currentX}px`; winEl.style.top = `${currentY}px`;
          } else if (actionType === 'resize') {
              if (corner?.includes('right')) currentW = Math.max(300, initialSize.w + dx);
              if (corner?.includes('bottom')) currentH = Math.max(200, initialSize.h + dy);
              if (corner?.includes('left')) { const deltaW = initialSize.w - dx; if (deltaW >= 300) { currentW = deltaW; currentX = initialPos.x + dx; winEl.style.left = `${currentX}px`; } }
              if (corner?.includes('top')) { const deltaH = initialSize.h - dy; if (deltaH >= 200) { currentH = deltaH; currentY = initialPos.y + dy; winEl.style.top = `${currentY}px`; } }
              winEl.style.width = `${currentW}px`; winEl.style.height = `${currentH}px`;
          }
        });
    };
    const onPointerUp = () => {
        setIsInteracting(false); winEl.style.willChange = 'auto';
        window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp);
        setWindows(prev => prev.map(w => w.instanceId === instanceId ? { ...w, position: { x: currentX, y: currentY }, size: { w: currentW, h: currentH } } : w));
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true }); window.addEventListener('pointerup', onPointerUp);
  };

  const openApp = (app: API.AppDefinition, args: any = null) => {
    setStartMenuOpen(false);
    if (!app) { addNotification("App not ready", "error"); return; }
    
    if (app.id === 'notes') {
        const existingNoteWindow = windows.find(w => w.appId === 'notes');
        if (existingNoteWindow) {
            setWindows(prev => prev.map(w => {
                if (w.instanceId === existingNoteWindow.instanceId) {
                    return { ...w, isMinimized: false, args: args || w.args };
                }
                return w;
            }));
            setActiveWindowId(existingNoteWindow.instanceId);
            return;
        }
    }

    if (app.id === 'recycle-bin') {
        const explorer = config?.installedApps.find(a => a.id === 'file-explorer');
        if (explorer) {
             const newWindow = {
                  instanceId: Date.now().toString(), 
                  appId: 'file-explorer', 
                  title: 'Recycle Bin', 
                  appData: explorer, 
                  args: { folderId: recycleBinId }, 
                  isMinimized: false, 
                  isMaximized: false,
                  position: { x: 100 + (windows.length * 20), y: 100 + (windows.length * 20) }, 
                  size: { w: 800, h: 500 }
             };
             setWindows([...windows, newWindow]); 
             setActiveWindowId(newWindow.instanceId);
        }
        return;
    }

    const newWindow = {
      instanceId: Date.now().toString() + Math.random(), 
      appId: app.id, 
      title: app.name, 
      appData: app, 
      args: args, 
      isMinimized: false, 
      isMaximized: false,
      position: { x: 100 + (windows.length * 30), y: 50 + (windows.length * 30) }, 
      size: { w: 900, h: 600 }
    };
    setWindows([...windows, newWindow]); 
    setActiveWindowId(newWindow.instanceId);
  };

  const openNotesApp = (fileId?: string, isNew?: boolean) => {
    const notesApp = config?.installedApps.find(a => a.id === 'notes');
    if (notesApp) {
        openApp(notesApp, { fileId, isNew, folderId: currentFolderIdRef.current });
    }
  };
  
  const closeWindow = (instanceId: string) => setWindows(prev => prev.filter(w => w.instanceId !== instanceId));
  const toggleMaximize = (instanceId: string) => setWindows(prev => prev.map(w => w.instanceId === instanceId ? {...w, isMaximized: !w.isMaximized, isMinimized: false} : w));
  const toggleMinimize = (instanceId: string) => setWindows(prev => prev.map(w => w.instanceId === instanceId ? {...w, isMinimized: !w.isMinimized} : w));

  if (isGlobalLoading) return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[9999] select-none cursor-wait">
      {/* ... loading UI ... */}
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-1000">
         <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.5)]">
            <Cloud size={48} className="text-white fill-white" />
         </div>
         <h1 className="text-3xl font-bold text-white tracking-widest font-sans">CLOUD OS</h1>
         <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden mt-2">
            <div 
                className="h-full bg-blue-500 transition-all duration-500 ease-out" 
                style={{width: `${bootProgress}%`}}
            ></div>
         </div>
         <div className="text-xs font-mono text-blue-400">{bootProgress}%</div>
      </div>
      <div className="absolute bottom-20 flex flex-col items-center gap-2">
         <p className="text-slate-500 text-xs font-mono uppercase tracking-widest animate-pulse">
            {globalLoadingMessage}
         </p>
      </div>
      <div className="absolute bottom-6 text-[10px] text-slate-700">© 2025 Zombio Systems</div>
    </div>
  );

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-slate-900 select-none font-sans touch-none" 
         style={{ backgroundImage: `url(${config?.wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
         onPointerDown={() => { setGlobalContextMenu(null); setSelectedDesktopIcon(null); }}
         onContextMenu={(e) => {
             e.preventDefault();
             setGlobalContextMenu({ x: e.clientX, y: e.clientY, type: 'desktop' });
         }}
    >
      {isInteracting && <div className="fixed inset-0 z-[9999] cursor-move bg-transparent touch-none" />}

      {/* DESKTOP ICONS GRID CONTAINER */}
      <div className="absolute top-0 left-0 bottom-12 w-full p-4 z-0">
        <div className="grid grid-cols-[repeat(auto-fill,100px)] grid-rows-[repeat(auto-fill,120px)] h-full gap-2 pointer-events-none">
            {config?.installedApps.map((app) => {
                const isSelected = selectedDesktopIcon === app.id;

                return (
                <div 
                    key={app.id} 
                    style={{ position: 'relative', pointerEvents: 'auto' }}
                    onDoubleClick={(e) => { 
                        e.stopPropagation(); 
                        openApp(app); 
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDesktopIcon(app.id);
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        setSelectedDesktopIcon(app.id);
                        setGlobalContextMenu({ x: e.clientX, y: e.clientY, targetItem: app as any, type: 'app' });
                    }}
                    className={`w-24 flex flex-col items-center gap-1.5 p-2 rounded-lg cursor-default group transition-all duration-200 select-none 
                        ${isSelected ? 'bg-white/20 ring-1 ring-white/30' : 'hover:bg-white/10'}
                    `}
                >
                    <div className="w-12 h-12 glass-light rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform text-white overflow-hidden pointer-events-none">
                    {app.icon.startsWith('http') ? <img src={app.icon} className="w-full h-full object-cover"/> :
                    app.icon === 'folder' ? <Folder size={28} className="text-blue-400 drop-shadow-lg"/> :
                    app.icon === 'settings' ? <Settings size={28} className="text-slate-300 drop-shadow-lg"/> :
                    app.icon === 'shopping-bag' ? <ShoppingBag size={28} className="text-pink-400 drop-shadow-lg"/> : 
                    app.icon === 'image' ? <ImageIcon size={28} className="text-pink-400 drop-shadow-lg" /> :
                    app.icon === 'youtube' ? <Youtube size={28} className="text-red-500 drop-shadow-lg" /> :
                    app.icon === 'file-text' ? <FileText size={28} className="text-yellow-500 drop-shadow-lg"/> :
                    app.icon === 'trash' ? <Trash2 size={28} className="text-red-400 drop-shadow-lg"/> :
                    <Globe size={28} className="text-emerald-400 drop-shadow-lg"/>}
                    </div>
                    <span className="text-[10px] text-white font-bold text-shadow text-center line-clamp-2 px-1 pointer-events-none">{app.name}</span>
                </div>
                );
            })}
        </div>
      </div>

      {/* WINDOWS */}
      {windows.map(win => (
        <div key={win.instanceId} id={`window-${win.instanceId}`}
             className={`absolute flex flex-col glass rounded-xl shadow-2xl overflow-hidden transition-none animate-window-open ${win.isMaximized ? 'inset-0 !top-0 !left-0 !w-full !h-[calc(100%-48px)] rounded-none' : ''} ${activeWindowId === win.instanceId ? 'z-40 ring-1 ring-white/20 shadow-[0_30px_60px_rgba(0,0,0,0.5)]' : 'z-10'} ${win.isMinimized ? 'hidden' : ''}`}
             style={!win.isMaximized ? { top: win.position.y, left: win.position.x, width: win.size.w, height: win.size.h } : {}}
             onPointerDown={() => setActiveWindowId(win.instanceId)}
             onContextMenu={(e) => e.stopPropagation()}
        >
          {/* Window Header */}
          <div className="h-10 bg-slate-950/40 border-b border-white/5 flex items-center justify-between px-3 select-none cursor-default touch-none"
               onDoubleClick={() => toggleMaximize(win.instanceId)}
               onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'move')}>
            <div className="flex items-center gap-2 pointer-events-none">
               <div className="w-4 h-4 flex items-center justify-center text-white">
                 {win.appId === 'file-explorer' ? (win.args?.folderId === recycleBinId ? <Trash2 size={14}/> : <Folder size={14}/>) : 
                  (win.appId === 'app-store' || win.appId === 'store') ? <ShoppingBag size={14}/> : 
                  win.appId === 'settings' ? <Settings size={14}/> : 
                  win.appId === 'youtube' ? <Youtube size={14}/> :
                  win.appId === 'notes' ? <FileText size={14}/> :
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
                  currentFolderId: win.args?.folderId !== undefined ? win.args.folderId : currentFolderId, 
                  setCurrentFolderId: (id: string) => { if(win.args?.folderId !== undefined) { handleSetCurrentFolderId(id); } else handleSetCurrentFolderId(id); }, 
                  folderHistory, setFolderHistory, items, setItems, loading, setLoading,
                  systemMap, setSystemMap, dbFileId, setDbFileId, comments, setComments, recycleBinId, setRecycleBinId,
                  systemFolderId, setSystemFolderId, isSavingDB, setIsSavingDB, isSavingComments, setIsSavingComments,
                  triggerCloudSync, triggerCommentSync, handleRefreshComments, addNotification, removeNotification, updateNotification,
                  setModal, modal, setEditingNote, setViewingRawFile, setPreviewImage, handleUploadFiles, executeAction, 
                  loadFolder: (id: string) => loadFolder(id || (win.args?.folderId !== undefined ? win.args.folderId : currentFolderId)),
                  selectedIds, setSelectedIds, 
                  onContextMenu: (e: any, item: any, isBin: boolean) => {
                      if (item) { setGlobalContextMenu({ x: e.clientX, y: e.clientY, targetItem: item, isRecycleBin: isBin, type: 'item' }); } 
                      else { setGlobalContextMenu({ x: e.clientX, y: e.clientY, type: 'folder-background', isRecycleBin: (win.args?.folderId === recycleBinId || currentFolderId === recycleBinId) }); }
                  },
                  openNotesApp: (fileId?: string, isNew?: boolean) => {
                      // Pass current folder ID so new notes are saved there by default
                      const targetFolder = win.args?.folderId !== undefined ? win.args.folderId : currentFolderId;
                      openNotesApp(fileId, isNew);
                  }
              }} />
            )}
            {win.appId === 'notes' && (
              <NotesApp 
                initialFileId={win.args?.fileId}
                isNewNote={win.args?.isNew}
                initialFolderId={win.args?.folderId}
                currentFolderId={currentFolderId} 
                filesInFolder={items} 
                systemMap={systemMap} 
                onClose={() => closeWindow(win.instanceId)}
                onRefresh={() => loadFolder(win.args?.folderId || currentFolderId)}
                onSaveToCloud={async (id: string, title: string, content: string, targetFolderId?: string) => {
                   const res = await API.saveNoteToDrive(title, content, targetFolderId || win.args?.folderId || currentFolderId, id.startsWith('new-') ? undefined : id);
                   return res?.id;
                }}
              />
            )}
            {win.appId === 'canva' && <CanvaApp onLaunch={() => setIsCanvaRunning(true)} onCloseApp={() => setIsCanvaRunning(false)} />}
            {win.appData.url === 'internal://gallery' && (
              <GalleryApp 
                items={items} 
                loading={loading}
                onUpload={(files: any) => handleUploadFiles(Array.from(files))}
                onDelete={async (id: string) => {
                  const notif = addNotification("Menghapus foto...", "loading");
                  try { await API.deleteItems([id]); updateNotification(notif, "Foto terhapus", "success"); loadFolder(currentFolderId); } 
                  catch (e) { updateNotification(notif, "Gagal menghapus", "error"); }
                }}
              />
            )}
            {win.appId === 'youtube' && <YouTubeApp customKeys={config?.youtubeApiKeys} />}
            {win.appId === 'settings' && <SettingsApp config={config!} systemFolderId={systemFolderId} addNotification={addNotification} onSave={async (c:any)=>{ try { await API.saveSystemConfig(c); setConfig(c); addNotification("Pengaturan disimpan", "success"); } catch(e) { addNotification("Gagal menyimpan", "error"); } }} installPrompt={deferredPrompt} onInstallPWA={handleInstallClick} />}
            {(win.appId === 'app-store' || win.appId === 'store') && <AppStoreApp config={config!} setConfig={setConfig} addNotification={addNotification} systemFolderId={systemFolderId}/>}
            {(win.appData.type === 'webapp') && win.appId !== 'youtube' && win.appId !== 'canva' && (
              <div className="h-full flex flex-col bg-white">
                {!win.appData.hideAddressBar && (
                    <div className="p-1 bg-slate-100 flex items-center justify-between gap-2 border-b">
                       <div className="flex items-center gap-2 flex-1 min-w-0"><Globe size={12} className="text-slate-400 ml-2 flex-shrink-0"/><input className="flex-1 bg-white px-3 py-1 rounded-lg border-none text-[10px] outline-none text-slate-800" value={win.appData.url} readOnly /></div>
                       <button onClick={() => window.open(win.appData.url, '_blank')} className="p-1.5 hover:bg-slate-200 rounded text-slate-500"><ExternalLink size={14}/></button>
                    </div>
                )}
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
            </>
          )}
        </div>
      ))}

      {/* SYNC NOTIFICATION - FLOATING BOTTOM RIGHT */}
      {(isSavingDB || isSavingComments) && (
        <div className="fixed bottom-16 right-4 z-[200] bg-slate-800/90 border border-slate-600 p-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 duration-500">
           <Loader2 size={20} className="animate-spin text-blue-400"/>
           <div className="flex flex-col">
              <span className="text-xs font-bold text-white">Syncing Cloud Database...</span>
              <span className="text-[10px] text-slate-400">Do not close window</span>
           </div>
        </div>
      )}

      {/* START MENU */}
      {startMenuOpen && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[600px] max-w-[95vw] h-[550px] max-h-[80vh] glass rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] z-[60] p-8 flex flex-col animate-in slide-in-from-bottom-5 duration-200">
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-6 flex-1 content-start overflow-y-auto pr-2 no-scrollbar">
             {config?.installedApps.map(app => (
               <button key={app.id} onClick={()=>openApp(app)} className="flex flex-col items-center gap-2 group">
                 <div className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform overflow-hidden">
                    {app.icon.startsWith('http') ? <img src={app.icon} className="w-full h-full object-cover"/> :
                     app.icon === 'folder' ? <Folder size={24} className="text-blue-400"/> : 
                     app.icon === 'settings' ? <Settings size={24} className="text-slate-300"/> : 
                     app.icon === 'shopping-bag' ? <ShoppingBag size={24} className="text-pink-400"/> :
                     app.icon === 'image' ? <ImageIcon size={24} className="text-pink-400" /> :
                     app.icon === 'youtube' ? <Youtube size={24} className="text-red-500"/> :
                     app.icon === 'file-text' ? <FileText size={24} className="text-yellow-500"/> :
                     app.icon === 'trash' ? <Trash2 size={24} className="text-red-400"/> :
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
      <div className="absolute bottom-0 w-full h-12 glass border-t border-white/5 flex items-center justify-between px-4 z-[70]"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-24 flex items-center gap-2 hidden sm:flex">
            <button onClick={toggleFullscreen} className="p-2 rounded-xl hover:bg-white/10 transition-all text-white/50 hover:text-white" title="Toggle Fullscreen">
                {isFullscreen ? <Minimize2 size={20}/> : <Maximize2 size={20}/>}
            </button>
        </div> 

        <div className="flex items-center gap-1.5 mx-auto sm:mx-0 overflow-x-auto no-scrollbar max-w-full">
           <button onClick={() => setStartMenuOpen(!startMenuOpen)} className={`p-2.5 rounded-xl hover:bg-white/10 transition-all flex-shrink-0 ${startMenuOpen ? 'bg-white/10 scale-90' : ''}`}><Grid size={24} className="text-blue-400"/></button>
           <div className="w-px h-6 bg-white/5 mx-2 flex-shrink-0"></div>
           {windows.map(win => (
             <button key={win.instanceId} onClick={() => { if (win.isMinimized) toggleMinimize(win.instanceId); setActiveWindowId(win.instanceId); }}
                     className={`p-2 rounded-xl hover:bg-white/10 transition-all relative group flex-shrink-0 ${activeWindowId === win.instanceId && !win.isMinimized ? 'bg-white/10' : 'opacity-60'}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-lg ${win.appId === 'file-explorer' ? (win.args?.folderId === recycleBinId ? 'bg-red-900' : 'bg-blue-600') : (win.appId === 'app-store' || win.appId === 'store') ? 'bg-pink-600' : win.appId === 'youtube' ? 'bg-red-600' : win.appId === 'notes' ? 'bg-yellow-600' : win.appData.icon === 'image' ? 'bg-pink-500' : 'bg-slate-700'}`}>
                   {win.appId === 'file-explorer' ? (win.args?.folderId === recycleBinId ? <Trash2 size={14}/> : <Folder size={14}/>) : 
                    (win.appId === 'app-store' || win.appId === 'store') ? <ShoppingBag size={14}/> : 
                    win.appId === 'settings' ? <Settings size={14}/> : 
                    win.appId === 'youtube' ? <Youtube size={14}/> :
                    win.appId === 'notes' ? <FileText size={14}/> :
                    win.appData.icon === 'image' ? <ImageIcon size={14} /> : win.title.charAt(0)}
                </div>
                {!win.isMinimized && activeWindowId === win.instanceId && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-blue-400 rounded-full"></div>}
             </button>
           ))}
        </div>
        
        {/* Indikator Spesial Canva */}
        {isCanvaRunning && (
            <div className="px-4 flex items-center gap-2 border-l border-white/10 ml-2 animate-in fade-in duration-300 hidden sm:flex">
                <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                </span>
                <span className="text-xs text-purple-300 font-bold whitespace-nowrap">Canva Active</span>
                
                <button 
                onClick={() => alert("Tekan tombol Home/Recent Apps di HP Anda untuk kembali ke Canva.")}
                className="text-[10px] bg-white/10 px-2 py-1 rounded hover:bg-white/20 text-white ml-2 whitespace-nowrap"
                >
                Switch
                </button>
                <button 
                onClick={() => setIsCanvaRunning(false)}
                className="text-[10px] bg-red-500/20 px-2 py-1 rounded hover:bg-red-500/30 text-red-400 ml-1"
                title="Force Close Indicator"
                >
                <X size={12} />
                </button>
            </div>
        )}

        <div className="flex items-center gap-3 text-white w-24 justify-end hidden sm:flex">
             <div className="flex flex-col items-end leading-none font-bold">
               <span className="text-[10px]">{clock.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
               <span className="text-[8px] text-slate-400">{clock.toLocaleDateString([], {day:'2-digit', month:'2-digit'})}</span>
             </div>
        </div>
      </div>

      {/* GLOBAL CONTEXT MENU */}
      {globalContextMenu && (
        <div 
            className="absolute z-[1001] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[180px] animate-in zoom-in-95 duration-100 overflow-hidden" 
            style={{ top: globalContextMenu.y, left: globalContextMenu.x }}
            onPointerDown={(e) => e.stopPropagation()} 
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
            {/* ... Context Menu Items (unchanged) ... */}
            {/* (Reusing the existing context menu logic from previous step, ensuring consistency) */}
            {globalContextMenu.type === 'item' && globalContextMenu.targetItem ? (
                <>
                  <button onClick={() => { 
                      const itm = globalContextMenu.targetItem as Item;
                      if(itm.type === 'folder') loadFolder(itm.id);
                      else if(itm.type === 'note') openNotesApp(itm.id);
                      else if(itm.type === 'image') setPreviewImage(itm.url || null);
                      setGlobalContextMenu(null); 
                  }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-white font-bold"><ExternalLink size={14}/> Open</button>
                  {globalContextMenu.targetItem.id !== systemFolderId && globalContextMenu.targetItem.name !== SYSTEM_FOLDER_NAME && (
                      <>
                        {globalContextMenu.targetItem.id === recycleBinId || globalContextMenu.targetItem.name === RECYCLE_BIN_NAME ? (
                            <>
                                <div className="h-px bg-slate-800 my-1"></div>
                                <button onClick={() => { executeAction('restore_all'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-green-400"><RotateCcw size={14}/> Restore All</button>
                                <button onClick={() => { executeAction('empty_bin'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 text-xs flex items-center gap-2"><Trash2 size={14}/> Empty Recycle Bin</button>
                            </>
                        ) : (
                            <>
                                {!globalContextMenu.isRecycleBin && (
                                    <>
                                        <button onClick={() => { executeAction('rename', [globalContextMenu.targetItem!.id]); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><Edit size={14}/> Rename</button>
                                        <button onClick={() => { executeAction('download', [globalContextMenu.targetItem!.id]); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-emerald-400"><Download size={14}/> Download</button>
                                        <button onClick={() => { executeAction('comment', [globalContextMenu.targetItem!.id]); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><MessageSquare size={14}/> Comment</button>
                                        <button onClick={() => { executeAction('move', [globalContextMenu.targetItem!.id]); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><Move size={14}/> Move</button>
                                    </>
                                )}
                                {globalContextMenu.isRecycleBin ? (
                                    <>
                                        <div className="h-px bg-slate-800 my-1"></div>
                                        <button onClick={() => { executeAction('restore', [globalContextMenu.targetItem!.id]); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-green-400"><RotateCcw size={14}/> Restore</button>
                                    </>
                                ) : (
                                    <div className="h-px bg-slate-800 my-1"></div>
                                )}
                                <button onClick={() => { executeAction('delete', [globalContextMenu.targetItem!.id]); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 text-xs flex items-center gap-2"><Trash2 size={14}/> {globalContextMenu.isRecycleBin ? 'Delete Permanent' : 'Delete'}</button>
                            </>
                        )}
                      </>
                  )}
                </>
            ) : globalContextMenu.type === 'app' ? (
                <>
                   <button onClick={() => { openApp(globalContextMenu.targetItem as API.AppDefinition); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><ExternalLink size={14}/> Open</button>
                   {(globalContextMenu.targetItem?.type === 'webapp' || globalContextMenu.targetItem?.id === 'youtube') && (
                       <button onClick={() => { setModal({ type: 'properties', title: `${globalContextMenu.targetItem?.name} Properties`, targetItem: globalContextMenu.targetItem as any }); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><Settings size={14}/> Properties</button>
                   )}
                   {globalContextMenu.targetItem?.id === 'recycle-bin' && (
                       <>
                         <div className="h-px bg-slate-800 my-1"></div>
                         <button onClick={() => { executeAction('restore_all'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-green-400"><RotateCcw size={14}/> Restore All</button>
                         <button onClick={() => { executeAction('empty_bin'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 text-xs flex items-center gap-2"><Trash2 size={14}/> Empty Recycle Bin</button>
                       </>
                   )}
                </>
            ) : globalContextMenu.type === 'folder-background' ? (
                globalContextMenu.isRecycleBin ? (
                   <>
                     <button onClick={() => { executeAction('restore_all'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-green-400"><RotateCcw size={14}/> Restore All</button>
                     <button onClick={() => { executeAction('empty_bin'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 text-xs flex items-center gap-2"><Trash2 size={14}/> Empty Recycle Bin</button>
                     <div className="h-px bg-slate-800 my-1"></div>
                     <button onClick={() => { loadFolder(currentFolderId); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><RefreshCw size={14}/> Refresh</button>
                   </>
                ) : (
                   <>
                     <button onClick={() => { executeAction('new_folder'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><Folder size={14}/> New Folder</button>
                     <button onClick={() => { openNotesApp(undefined, true); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><FileText size={14}/> New Note</button>
                     <button onClick={() => { executeAction('native_upload'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-green-400"><Upload size={14}/> Upload File</button>
                     <div className="h-px bg-slate-800 my-1"></div>
                     <button onClick={() => { loadFolder(currentFolderId); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><RefreshCw size={14}/> Refresh</button>
                   </>
                )
            ) : (
                <>
                  <button onClick={() => { handleRefreshDesktop(); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><RefreshCcw size={14}/> Refresh System</button>
                  <div className="h-px bg-slate-800 my-1"></div>
                  <button onClick={() => { setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-400">Cancel</button>
                </>
            )}
        </div>
      )}

      {/* OVERLAYS */}
      <UploadProgress uploads={uploadQueue} onClose={() => setUploadQueue([])} onRemove={(id) => setUploadQueue(prev => prev.filter(u => u.id !== id))} />
      <DownloadProgress downloads={downloadQueue} onClose={() => setDownloadQueue([])} onClearCompleted={() => setDownloadQueue(prev => prev.filter(d => d.status !== 'completed'))} />
      {previewImage && (<div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}><button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 text-white"><X size={32}/></button><img src={previewImage} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" /></div>)}
      {editingNote && <TextEditor note={editingNote} onSave={async (id: string, title: string, content: string) => { await API.saveNoteToDrive(title, content, currentFolderId, id.startsWith('new-') ? undefined : id); setEditingNote(null); }} onClose={() => setEditingNote(null)} />}
      {modal && (/* ... Existing Modal Component ... */
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isPostingComment && setModal(null)} />
          <div className={`relative w-full ${modal.type === 'comment' || modal.type === 'properties' ? 'max-w-2xl' : 'max-w-sm'} bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden`}>
            {modal.type === 'comment' ? (
              <div className="flex flex-col h-[500px] max-h-[70vh]">
                <div className="p-4 bg-slate-950 flex items-center justify-between"><h3 className="text-sm font-bold">{modal.title}</h3><button disabled={isPostingComment} onClick={() => setModal(null)}><X size={18} className={isPostingComment ? 'opacity-50' : ''}/></button></div>
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
                    {isPostingComment && <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-400"/></div>}
                </div>
                <div className="p-4 border-t border-slate-800 flex gap-2">
                   <input disabled={isPostingComment} className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-xs" placeholder="Komentar..." value={commentText} onChange={e=>setCommentText(e.target.value)} />
                   <input disabled={isPostingComment} className="w-20 bg-slate-800 rounded-lg px-2 py-2 text-xs" placeholder="Nama" value={commentName} onChange={e=>setCommentName(e.target.value)} />
                   <button disabled={isPostingComment} onClick={handleAddComment} className="p-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"><Send size={16}/></button>
                </div>
              </div>
            ) : modal.type === 'properties' ? (
                <div className="p-6">
                   <h3 className="text-lg font-bold text-white mb-4">{modal.title}</h3>
                   
                   {modal.targetItem?.id === 'youtube' ? (
                        <div className="space-y-4">
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                <h4 className="text-xs text-slate-400 uppercase font-bold mb-2">Custom API Keys</h4>
                                <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                                    {(config?.youtubeApiKeys || []).map((key, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800">
                                            <span className="text-xs font-mono text-slate-500">{key.substring(0, 4)}...{key.substring(key.length-4)}</span>
                                            <button onClick={() => handlePropertiesSave((config?.youtubeApiKeys || []).filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400"><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white" placeholder="Enter new API Key" id="new-api-key-input"/>
                                    <button onClick={() => { const input = document.getElementById('new-api-key-input') as HTMLInputElement; if(input.value) { handlePropertiesSave([...(config?.youtubeApiKeys || []), input.value]); input.value = ""; } }} className="px-3 bg-blue-600 rounded text-xs text-white font-bold">Add</button>
                                </div>
                            </div>
                            <div className="flex justify-end pt-2"><button onClick={() => setModal(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-white">Close</button></div>
                       </div>
                   ) : modal.targetItem?.type === 'webapp' ? (
                       <div className="space-y-4">
                           <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                               <h4 className="text-xs text-slate-400 uppercase font-bold mb-3">Tampilan Aplikasi</h4>
                               <div className="flex items-center justify-between">
                                   <div className="flex flex-col">
                                       <label className="text-sm text-white font-medium">Sembunyikan Address Bar</label>
                                       <span className="text-[10px] text-slate-500">Menghilangkan bar URL untuk tampilan seperti native app.</span>
                                   </div>
                                   <label className="relative inline-flex items-center cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={!!modal.targetItem.hideAddressBar}
                                        onChange={(e) => handleWebAppPropertyChange(modal.targetItem!.id, 'hideAddressBar', e.target.checked)}
                                      />
                                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                               </div>
                           </div>
                           <div className="flex justify-end pt-2">
                               <button onClick={() => setModal(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-white">Tutup</button>
                           </div>
                       </div>
                   ) : (
                       <p className="text-slate-400 text-sm">Tidak ada pengaturan tambahan untuk item ini.</p>
                   )}
                </div>
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-2">{modal.title}</h3>
                {modal.message && <p className="text-sm text-slate-400 mb-4">{modal.message}</p>}
                {modal.type === 'input' && <input className="w-full bg-slate-800 p-3 rounded-lg text-sm text-white" defaultValue={modal.inputValue} onChange={e=>setModal({...modal, inputValue: e.target.value})} />}
                {modal.type === 'password' && <input className="w-full bg-slate-800 p-3 rounded-lg text-sm" type="password" placeholder="Password" onChange={e=>setModal({...modal, inputValue: e.target.value})} />}
                {modal.type === 'select' && <select className="w-full bg-slate-800 p-3 rounded-lg text-sm text-white outline-none" onChange={e=>setModal({...modal, inputValue: e.target.value})}><option value="">Select Folder</option>{modal.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>}
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

export default App;

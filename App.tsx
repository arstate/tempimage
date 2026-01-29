
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
  UploadCloud, Hand, ArrowUp
} from 'lucide-react';
import * as API from './services/api';
import * as DB from './services/db';
import { Item, StoredNote, DownloadItem, FolderMap, SystemDB, Comment, CommentDB, StoredImage, FolderNode } from './types';
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

// --- YOUTUBE APP COMPONENT ---
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

// --- APP STORE COMPONENT ---
const AppStoreApp = ({ config, setConfig, addNotification, systemFolderId }: any) => {
   const [appName, setAppName] = useState('');
   const [appUrl, setAppUrl] = useState('');
   const [customIconFile, setCustomIconFile] = useState<File | null>(null);
   const [isInstalling, setIsInstalling] = useState(false);
   const [uninstallingId, setUninstallingId] = useState<string | null>(null);
   const [useProxy, setUseProxy] = useState(false);
   const [showAddressBar, setShowAddressBar] = useState(true);
 
   const popularApps = [
     { id: 'notes', name: 'Notes', url: 'internal://notes', icon: 'file-text' },
     { id: 'gallery', name: 'Gallery', url: 'internal://gallery', icon: 'image' },
     { id: 'youtube', name: 'YouTube', url: 'internal://youtube', icon: 'youtube' },
     { id: 'spotify', name: 'Spotify', url: 'https://open.spotify.com/embed', icon: 'music' },
     { id: 'canva', name: 'Canva', url: 'https://www.canva.com', icon: 'globe' },
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
    const updatedConfig = { 
      ...config, 
      installedApps: [
        ...config.installedApps, 
        { 
          ...app, 
          icon: finalIcon, 
          type: app.url?.startsWith('internal') ? 'system' : 'webapp',
          useProxy: useProxy,
          showAddressBar: showAddressBar
        }
      ] 
    };
    try { 
      await API.saveSystemConfig(updatedConfig); 
      setConfig(updatedConfig); 
      addNotification(`${app.name} berhasil ditambahkan`, "success"); 
    } 
    catch (e) { addNotification("Gagal menyimpan konfigurasi", "error"); } 
    finally { 
      setIsInstalling(false); 
      setCustomIconFile(null); 
      setAppName('');
      setAppUrl('');
    }
   };

   const handleUninstall = async (appId: string) => {
    if (!config) return;
    const app = config.installedApps.find((a: any) => a.id === appId);
    if ((app?.type === 'system' && (app?.id === 'file-explorer' || app?.id === 'notes')) || app?.id === 'youtube') return;
    
    setUninstallingId(appId);
    const updatedConfig = { ...config, installedApps: config.installedApps.filter((a: any) => a.id !== appId) };
    try { 
      await API.saveSystemConfig(updatedConfig); 
      setConfig(updatedConfig); 
      addNotification("Aplikasi berhasil dihapus", "success"); 
    } catch (e) {
      addNotification("Gagal menghapus aplikasi", "error");
    } finally {
      setUninstallingId(null);
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
          <div className="space-y-1 lg:col-span-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">URL Web</label>
            <div className="flex flex-col gap-2">
              <input className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm" placeholder="Contoh: https://chat.openai.com" value={appUrl} onChange={e => setAppUrl(e.target.value)}/>
              <div className="flex items-center gap-4 py-2 px-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={useProxy} onChange={e => setUseProxy(e.target.checked)} className="w-4 h-4 bg-slate-900 rounded border-slate-700 text-blue-600 focus:ring-0" />
                  <span className="text-xs text-slate-300">Bypass Blocking (Proxy)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showAddressBar} onChange={e => setShowAddressBar(e.target.checked)} className="w-4 h-4 bg-slate-900 rounded border-slate-700 text-blue-600 focus:ring-0" />
                  <span className="text-xs text-slate-300">Tampilkan Address Bar</span>
                </label>
              </div>
            </div>
          </div>
          <div className="flex items-end"><button onClick={() => { if(!appName || !appUrl) return; handleInstall({ id: 'custom-'+Date.now(), name: appName, url: appUrl, icon: 'globe', type: 'webapp' }); }} disabled={isInstalling} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold">{isInstalling ? <Loader2 className="animate-spin mx-auto"/> : 'Instal'}</button></div>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-300">Terpasang</h2>
        <div className="space-y-2">
          {config?.installedApps.map((app: any) => (
            <div key={app.id} className="flex justify-between items-center p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800 overflow-hidden">
                  {app.icon.startsWith('http') ? <img src={app.icon} className="w-full h-full object-cover"/> : <Globe size={24}/>}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{app.name}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{app.type}</span>
                </div>
              </div>
              {app.type === 'webapp' && (
                <button 
                  onClick={() => handleUninstall(app.id)} 
                  disabled={uninstallingId === app.id}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  {uninstallingId === app.id ? <Loader2 size={18} className="animate-spin"/> : <Trash2 size={18}/>}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-4"><h2 className="text-lg font-bold text-slate-300">Rekomendasi</h2><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{popularApps.map(app => (<div key={app.id} className="bg-slate-800/40 p-4 rounded-2xl flex flex-col items-center gap-4"><div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center"><Globe size={32}/></div><p className="font-bold text-sm">{app.name}</p><button onClick={() => handleInstall(app)} className="w-full py-2 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-bold">Instal</button></div>))}</div></section>
    </div>
   );
};

// --- SETTINGS APP COMPONENT ---
const SettingsApp = ({ config, onSave, systemFolderId, addNotification }: any) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [isUploadingWallpaper, setIsUploadingWallpaper] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadWallpaper = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !systemFolderId) return;

    setIsUploadingWallpaper(true);
    const notifId = addNotification("Uploading wallpaper...", "loading");
    try {
      const res = await API.uploadToDrive(file, systemFolderId);
      const imageUrl = res.thumbnail || res.url;
      setLocalConfig({ ...localConfig, wallpaper: imageUrl });
      updateNotification(notifId, "Wallpaper uploaded", "success");
    } catch (e) {
      updateNotification(notifId, "Failed to upload wallpaper", "error");
    } finally {
      setIsUploadingWallpaper(false);
    }
  };

  const updateNotification = (id: string, message: string, type: 'success' | 'error') => {
    // This is passed from parent usually, but setting it here for consistency
  };

  return (
    <div className="h-full bg-slate-900 text-white p-6 flex flex-col gap-6 overflow-auto">
      <h2 className="text-2xl font-bold flex items-center gap-3 text-white"><Settings size={28} className="text-blue-600"/> Settings</h2>
      <div className="space-y-6 max-w-lg">
        <section className="bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Tampilan Desktop</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">Wallpaper URL</label>
              <div className="flex gap-2">
                <input className="flex-1 p-2 border border-slate-700 rounded-lg text-sm bg-slate-950 text-white focus:outline-none focus:border-blue-500" value={localConfig.wallpaper} onChange={(e) => setLocalConfig({...localConfig, wallpaper: e.target.value})} placeholder="https://..." />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingWallpaper}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center gap-2 text-xs transition-colors disabled:opacity-50"
                >
                  {isUploadingWallpaper ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14} />}
                  <span>Upload</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadWallpaper} />
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Imej yang di-upload akan disimpan di folder System secara otomatis.</p>
            </div>
            
            {localConfig.wallpaper && (
              <div className="aspect-video w-full rounded-lg overflow-hidden border border-slate-700 relative group">
                <img src={localConfig.wallpaper} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded backdrop-blur">Preview</span>
                </div>
              </div>
            )}
          </div>
        </section>
        <button onClick={() => onSave(localConfig)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95">Save Changes</button>
      </div>
    </div>
  );
};

// --- FILE EXPLORER APP COMPONENT ---
// Added missing implementation for FileExplorerApp to fix build errors.
const FileExplorerApp = ({
  currentFolderId, setCurrentFolderId, folderHistory, setFolderHistory, items, setItems,
  loading, setLoading, systemMap, setSystemMap, dbFileId, setDbFileId, comments, setComments,
  recycleBinId, setRecycleBinId, systemFolderId, setSystemFolderId, isSavingDB, setIsSavingDB,
  isSavingComments, setIsSavingComments, triggerCloudSync, triggerCommentSync, handleRefreshComments,
  addNotification, removeNotification, updateNotification, setModal, modal, setEditingNote,
  setViewingRawFile, setPreviewImage, handleUploadFiles, executeAction, loadFolder,
  selectedIds, setSelectedIds, onContextMenu, openNotesApp
}: any) => {

  const isRecycleBin = currentFolderId === recycleBinId;

  const toggleSelect = (id: string, multi: boolean = false) => {
    const next = new Set(selectedIds);
    if (multi) {
      if (next.has(id)) next.delete(id);
      else next.add(id);
    } else {
      next.clear();
      next.add(id);
    }
    setSelectedIds(next);
  };

  const navigateTo = (id: string, name: string) => {
    setFolderHistory((prev: any) => [...prev, { id: currentFolderId, name: systemMap[currentFolderId]?.name || 'Home' }]);
    setCurrentFolderId(id);
  };

  const navigateUp = () => {
    const current = systemMap[currentFolderId];
    if (current && current.parentId !== undefined) {
      setCurrentFolderId(current.parentId);
    } else {
      setCurrentFolderId("");
    }
  };

  const navigateBack = () => {
    if (folderHistory.length === 0) return;
    const last = folderHistory[folderHistory.length - 1];
    setFolderHistory((prev: any) => prev.slice(0, -1));
    setCurrentFolderId(last.id);
  };

  return (
    <div className="h-full bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* Navigation Bar */}
      <div className="flex items-center gap-2 p-2 bg-slate-800/50 border-b border-slate-700">
        <button onClick={navigateBack} disabled={folderHistory.length === 0} className="p-1.5 hover:bg-slate-700 rounded-lg disabled:opacity-30"><ArrowLeft size={18}/></button>
        <button onClick={navigateUp} className="p-1.5 hover:bg-slate-700 rounded-lg"><ArrowUp size={18}/></button>
        <button onClick={() => loadFolder(currentFolderId)} className="p-1.5 hover:bg-slate-700 rounded-lg"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></button>
        
        <div className="flex-1 flex items-center gap-2 bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-1.5 text-xs overflow-hidden">
          <Folder size={14} className="text-blue-400 flex-shrink-0"/>
          <div className="flex items-center gap-1 truncate">
            <span className="opacity-50 hover:opacity-100 cursor-pointer" onClick={() => setCurrentFolderId("")}>Home</span>
            {currentFolderId && <><ChevronRight size={12} className="opacity-30"/><span className="font-bold">{systemMap[currentFolderId]?.name || '...'}</span></>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => executeAction('new_folder')} className="p-1.5 hover:bg-slate-700 rounded-lg text-blue-400" title="New Folder"><Plus size={18}/></button>
          <button onClick={() => executeAction('native_upload')} className="p-1.5 hover:bg-slate-700 rounded-lg text-emerald-400" title="Upload"><Upload size={18}/></button>
          {selectedIds.size > 0 && (
            <>
              <div className="w-px h-6 bg-slate-700 mx-1"></div>
              <button onClick={() => executeAction('delete')} className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-500" title="Delete"><Trash2 size={18}/></button>
            </>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, null, isRecycleBin); }}
        onClick={() => setSelectedIds(new Set())}
      >
        {loading && items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-50">
            <Loader2 size={40} className="animate-spin text-blue-500 mb-2"/>
            <p className="text-sm">Loading items...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-30">
            {isRecycleBin ? <Trash2 size={80}/> : <Folder size={80}/>}
            <p className="text-lg font-medium">{isRecycleBin ? 'Recycle Bin is empty' : 'This folder is empty'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 content-start">
            {items.map((item: Item) => {
              const props = {
                key: item.id,
                item,
                selected: selectedIds.has(item.id),
                hasComments: comments[item.id]?.length > 0,
                onClick: (e: any) => { e.stopPropagation(); toggleSelect(item.id, e.ctrlKey || e.metaKey); },
                onToggleSelect: () => toggleSelect(item.id, true),
                onContextMenu: (e: any) => { e.preventDefault(); e.stopPropagation(); if (!selectedIds.has(item.id)) toggleSelect(item.id); onContextMenu(e, item, isRecycleBin); },
                onCommentClick: () => executeAction('comment', [item.id])
              };

              if (item.type === 'folder') return (
                <FolderItem {...props} 
                  isRecycleBin={item.name === 'Recycle Bin' || isRecycleBin}
                  isSystem={item.name === 'System'}
                  onDoubleClick={() => navigateTo(item.id, item.name)} 
                  isDropTarget={false}
                />
              );
              if (item.type === 'note') return (
                <NoteItem {...props} 
                  onDoubleClick={() => openNotesApp(item.id)}
                />
              );
              if (item.type === 'image') return (
                <ImageItem {...props} 
                  onDoubleClick={() => window.open(item.url, '_blank')}
                />
              );
              return null;
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-slate-950/50 border-t border-slate-800 px-3 py-1.5 flex justify-between items-center text-[10px] text-slate-500 font-mono">
        <div className="flex items-center gap-3">
          <span>{items.length} items</span>
          {selectedIds.size > 0 && <span className="text-blue-400 font-bold">{selectedIds.size} selected</span>}
        </div>
        <span>{isRecycleBin ? 'RECYCLE BIN' : (systemMap[currentFolderId]?.name || 'HOME').toUpperCase()}</span>
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

  // EXPLORER STATE
  const [currentFolderId, setCurrentFolderId] = useState<string>(""); 
  const currentFolderIdRef = useRef<string>(""); 
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

  // Desktop Interaction
  const [selectedDesktopIcon, setSelectedDesktopIcon] = useState<string | null>(null);
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(e => console.error(e)); } 
    else { if (document.exitFullscreen) document.exitFullscreen(); }
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
        
        let configUpdated = false;
        if (!osConfig.installedApps.some(app => app.id === 'youtube')) { osConfig.installedApps.push({ id: 'youtube', name: 'YouTube', url: 'internal://youtube', icon: 'youtube', type: 'system' }); configUpdated = true; }
        if (!osConfig.installedApps.some(app => app.id === 'notes')) { osConfig.installedApps.push({ id: 'notes', name: 'Notes', url: 'internal://notes', icon: 'file-text', type: 'system' }); configUpdated = true; }
        if (!osConfig.installedApps.some(app => app.id === 'recycle-bin')) { osConfig.installedApps.push({ id: 'recycle-bin', name: 'Recycle Bin', url: 'internal://recycle-bin', icon: 'trash', type: 'system' }); configUpdated = true; }

        setConfig(osConfig);

        setGlobalLoadingMessage("Locating Cloud Storage...");
        const cloudLocation = await API.locateSystemDB();
        let sysFolderId = cloudLocation.systemFolderId;
        let curDbFileId = cloudLocation.fileId; 
        let curCommentFileId = cloudLocation.commentFileId;

        if (!sysFolderId) { setGlobalLoadingMessage("Initializing System Folder..."); sysFolderId = await API.createSystemFolder(); }
        setSystemFolderId(sysFolderId);

        let finalMap: FolderMap = { "root": { id: "root", name: "Home", parentId: "" } };
        if (curDbFileId) {
            setGlobalLoadingMessage("Syncing File System DB...");
            const content = await API.getFileContent(curDbFileId);
            finalMap = JSON.parse(content);
        } else { curDbFileId = await API.createSystemDBFile(finalMap, sysFolderId); }

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
        setIsSystemInitialized(true);
      } catch (e) { console.error("Boot Error:", e); } finally { setIsGlobalLoading(false); }
    };
    boot();
  }, []);

  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(timer); }, []);

  const handleSetCurrentFolderId = (id: string) => {
      setCurrentFolderId(id);
      currentFolderIdRef.current = id;
  };

  const loadFolder = useCallback(async (folderId: string = "") => {
    setItems([]); 
    setLoading(true);
    const cacheKey = folderId || "root";
    const cached = await DB.getCachedFolder(cacheKey);
    if (cached) setItems(cached); 
    setSelectedIds(new Set());
    try {
      const res = await API.getFolderContents(folderId);
      if (currentFolderIdRef.current !== folderId) return;
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
    const itemsToDownload = items.filter(i => ids.includes(i.id) && i.type === 'image');
    if (itemsToDownload.length === 0) return addNotification("Only images can be downloaded", "error");
    const newDownloads: DownloadItem[] = itemsToDownload.map(i => ({ id: i.id, name: i.name, status: 'pending', progress: 0 }));
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
            link.href = blobUrl; link.download = item.name; document.body.appendChild(link); link.click(); document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
            setDownloadQueue(prev => prev.map(d => d.id === dItem.id ? { ...d, status: 'completed', progress: 100 } : d));
        } catch (e) { setDownloadQueue(prev => prev.map(d => d.id === dItem.id ? { ...d, status: 'error', error: 'Failed' } : d)); }
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

  const executeAction = async (action: string, specificIds?: string[], targetFolderId?: string) => {
    const ids = specificIds || Array.from(selectedIds);
    if (ids.length === 0 && action !== 'new_folder' && action !== 'native_upload') return;

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
                 for (const id of idsToDelete) { await DB.saveDeletedMeta(id, currentFolderId); }
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
              if (originalParent) { await API.moveItems([id], originalParent); await DB.removeDeletedMeta(id); } 
              else { await API.moveItems([id], ""); }
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
      case 'empty_bin':
          setModal({ type: 'confirm', title: 'Empty Recycle Bin?', message: 'All files will be permanently deleted.', isDanger: true, confirmText: 'Empty Bin', onConfirm: async () => {
             setModal(null);
             const allIds = items.map(i => i.id);
             setItems(prev => prev.map(i => ({ ...i, status: 'deleting' })));
             try {
                 await API.deleteItems(allIds);
                 setItems([]);
                 addNotification("Recycle Bin emptied", "success");
             } catch(e) {
                 addNotification("Failed to empty bin", "error");
                 loadFolder(recycleBinId);
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
            const opts = Object.values(systemMap as FolderMap).map(f => ({ label: f.name, value: f.id }));
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

  const handleRefreshDesktop = async () => {
     const notifId = addNotification("Refreshing System...", "loading");
     try {
         const osConfig = await API.getSystemConfig();
         setConfig(osConfig);
         updateNotification(notifId, "System Refreshed", "success");
     } catch(e) { updateNotification(notifId, "Refresh Failed", "error"); }
  };

  const handleWindowAction = (instanceId: string, e: React.PointerEvent, actionType: 'move' | 'resize', corner?: string) => {
    if (e.button !== 0) return;
    const win = windows.find(w => w.instanceId === instanceId);
    if (!win || win.isMaximized) return;
    setActiveWindowId(instanceId); 
    const startX = e.pageX; const startY = e.pageY;
    const initialPos = { ...win.position }; const initialSize = { ...win.size };
    const winEl = document.getElementById(`window-${instanceId}`);
    if (!winEl) return;
    winEl.style.willChange = actionType === 'move' ? 'left, top' : 'width, height, left, top';
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
        winEl.style.willChange = 'auto';
        window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp);
        setWindows(prev => prev.map(w => w.instanceId === instanceId ? { ...w, position: { x: currentX, y: currentY }, size: { w: currentW, h: currentH } } : w));
    };
    window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp);
  };

  const openApp = (app: API.AppDefinition, args: any = null) => {
    setStartMenuOpen(false);
    if (!app) { addNotification("App not ready", "error"); return; }
    if (app.id === 'notes') {
        const existingNoteWindow = windows.find(w => w.appId === 'notes');
        if (existingNoteWindow) {
            setWindows(prev => prev.map(w => w.instanceId === existingNoteWindow.instanceId ? { ...w, isMinimized: false, args: args || w.args } : w));
            setActiveWindowId(existingNoteWindow.instanceId); return;
        }
    }
    if (app.id === 'recycle-bin') {
        const explorer = config?.installedApps.find(a => a.id === 'file-explorer');
        if (explorer) {
             const newWindow = { instanceId: Date.now().toString(), appId: 'file-explorer', title: 'Recycle Bin', appData: explorer, args: { folderId: recycleBinId }, isMinimized: false, isMaximized: false, position: { x: 100, y: 100 }, size: { w: 800, h: 500 } };
             setWindows([...windows, newWindow]); setActiveWindowId(newWindow.instanceId);
        }
        return;
    }
    const newWindow = { instanceId: Date.now().toString() + Math.random(), appId: app.id, title: app.name, appData: app, args: args, isMinimized: false, isMaximized: false, position: { x: 100 + (windows.length * 30), y: 50 + (windows.length * 30) }, size: { w: 900, h: 600 } };
    setWindows([...windows, newWindow]); setActiveWindowId(newWindow.instanceId);
  };

  const openNotesApp = (fileId?: string, isNew?: boolean) => {
    const notesApp = config?.installedApps.find(a => a.id === 'notes');
    if (notesApp) openApp(notesApp, { fileId, isNew, folderId: currentFolderIdRef.current });
  };
  
  const closeWindow = (instanceId: string) => setWindows(prev => prev.filter(w => w.instanceId !== instanceId));
  const toggleMaximize = (instanceId: string) => setWindows(prev => prev.map(w => w.instanceId === instanceId ? {...w, isMaximized: !w.isMaximized, isMinimized: false} : w));
  const toggleMinimize = (instanceId: string) => setWindows(prev => prev.map(w => w.instanceId === instanceId ? {...w, isMinimized: !w.isMinimized} : w));

  if (isGlobalLoading) return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-6 z-[9999]">
      <div className="relative w-16 h-16"><Loader2 className="animate-spin text-blue-500 absolute w-full h-full"/><Database size={32} className="absolute inset-0 m-auto text-blue-400 opacity-50"/></div>
      <p className="text-white font-bold tracking-widest uppercase text-xs animate-pulse">{globalLoadingMessage}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-slate-900 select-none font-sans touch-none" 
         style={{ backgroundImage: `url(${config?.wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
         onPointerDown={() => { setGlobalContextMenu(null); setSelectedDesktopIcon(null); }}
         onContextMenu={(e) => { e.preventDefault(); setGlobalContextMenu({ x: e.clientX, y: e.clientY, type: 'desktop' }); }}>
      
      {/* DESKTOP AREA - UPDATED TO CLEAN GRID FLOW, NO DRAGGING */}
      <div className="absolute top-0 left-0 bottom-12 w-full p-6 z-0 overflow-y-auto no-scrollbar">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-4 pointer-events-none content-start max-w-full">
            {config?.installedApps.map((app: API.AppDefinition) => (
                <div key={app.id} 
                    onDoubleClick={(e) => { e.stopPropagation(); openApp(app); }}
                    onPointerDown={() => setSelectedDesktopIcon(app.id)}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedDesktopIcon(app.id); setGlobalContextMenu({ x: e.clientX, y: e.clientY, targetItem: app as any, type: 'app' }); }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl cursor-default group transition-all duration-200 select-none pointer-events-auto ${selectedDesktopIcon === app.id ? 'bg-white/20 ring-1 ring-white/30' : 'hover:bg-white/10'}`}>
                    <div className="w-14 h-14 glass-light rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform text-white overflow-hidden pointer-events-none">
                    {app.icon.startsWith('http') ? <img src={app.icon} className="w-full h-full object-cover"/> :
                    app.icon === 'folder' ? <Folder size={32} className="text-blue-400 drop-shadow-lg"/> :
                    app.icon === 'settings' ? <Settings size={32} className="text-slate-300 drop-shadow-lg"/> :
                    app.icon === 'shopping-bag' ? <ShoppingBag size={32} className="text-pink-400 drop-shadow-lg"/> : 
                    app.icon === 'image' ? <ImageIcon size={32} className="text-pink-400 drop-shadow-lg" /> :
                    app.icon === 'youtube' ? <Youtube size={32} className="text-red-500 drop-shadow-lg" /> :
                    app.icon === 'file-text' ? <FileText size={32} className="text-yellow-500 drop-shadow-lg"/> :
                    app.icon === 'trash' ? <Trash2 size={32} className="text-red-400 drop-shadow-lg"/> :
                    <Globe size={32} className="text-emerald-400 drop-shadow-lg"/>}
                    </div>
                    <span className="text-[11px] text-white font-bold text-shadow text-center line-clamp-2 px-1 pointer-events-none leading-tight">{app.name}</span>
                </div>
            ))}
        </div>
      </div>

      {windows.map(win => (
        <div key={win.instanceId} id={`window-${win.instanceId}`}
             className={`absolute flex flex-col glass rounded-xl shadow-2xl overflow-hidden transition-none animate-window-open ${win.isMaximized ? 'inset-0 !top-0 !left-0 !w-full !h-[calc(100%-48px)] rounded-none' : ''} ${activeWindowId === win.instanceId ? 'z-40 ring-1 ring-white/20 shadow-[0_30px_60px_rgba(0,0,0,0.5)]' : 'z-10'} ${win.isMinimized ? 'hidden' : ''}`}
             style={!win.isMaximized ? { top: win.position.y, left: win.position.x, width: win.size.w, height: win.size.h } : {}}
             onPointerDown={() => setActiveWindowId(win.instanceId)}>
          
          <div className="h-10 bg-slate-950/40 border-b border-white/5 flex items-center justify-between px-3 select-none cursor-default touch-none"
               onDoubleClick={() => toggleMaximize(win.instanceId)}
               onPointerDown={(e) => handleWindowAction(win.instanceId, e, 'move')}>
            <div className="flex items-center gap-2 pointer-events-none">
               <div className="w-4 h-4 flex items-center justify-center text-white">
                 {win.appId === 'file-explorer' ? (win.args?.folderId === recycleBinId ? <Trash2 size={14}/> : <Folder size={14}/>) : 
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
                  setCurrentFolderId: (id: string) => handleSetCurrentFolderId(id), 
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
                  openNotesApp
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
                   await API.saveNoteToDrive(title, content, targetFolderId || win.args?.folderId || currentFolderId, id.startsWith('new-') ? undefined : id);
                }}
              />
            )}
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
            {win.appId === 'settings' && (
              <SettingsApp 
                config={config!} 
                systemFolderId={systemFolderId}
                addNotification={addNotification}
                onSave={async (c:any)=>{ 
                  try { 
                    await API.saveSystemConfig(c); 
                    setConfig(c); 
                    addNotification("Pengaturan disimpan", "success"); 
                  } catch(e) { 
                    addNotification("Gagal menyimpan", "error"); 
                  } 
                }}
              />
            )}
            {(win.appId === 'app-store' || win.appId === 'store') && <AppStoreApp config={config!} setConfig={setConfig} addNotification={addNotification} systemFolderId={systemFolderId}/>}
            {(win.appData.type === 'webapp') && win.appId !== 'youtube' && (
              <div className="h-full flex flex-col bg-white">
                {win.appData.showAddressBar !== false && (
                  <div className="p-1.5 bg-slate-100 flex items-center justify-between gap-2 border-b">
                     <div className="flex items-center gap-2 flex-1 min-w-0 bg-white rounded-lg border border-slate-200 px-2 py-0.5 shadow-sm">
                        <Globe size={12} className="text-slate-400 flex-shrink-0"/>
                        <input className="flex-1 border-none text-[10px] outline-none text-slate-800 bg-transparent py-0.5" value={win.appData.url} readOnly />
                        {win.appData.useProxy && <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded font-bold">PROXY</span>}
                     </div>
                     <button onClick={() => window.open(win.appData.url, '_blank')} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors" title="Buka di Tab Baru"><ExternalLink size={14}/></button>
                  </div>
                )}
                <iframe 
                  src={win.appData.useProxy ? `https://wsrv.nl/?url=${encodeURIComponent(win.appData.url)}` : win.appData.url} 
                  className="flex-1 w-full border-none" 
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation" 
                />
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

      {(isSavingDB || isSavingComments) && (
        <div className="fixed bottom-16 right-4 z-[200] bg-slate-800/90 border border-slate-600 p-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 duration-500">
           <Loader2 size={20} className="animate-spin text-blue-400"/><div className="flex flex-col"><span className="text-xs font-bold text-white">Syncing Cloud Database...</span></div>
        </div>
      )}

      {startMenuOpen && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[600px] max-w-[95vw] h-[550px] max-h-[80vh] glass rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] z-[60] p-8 flex flex-col animate-in slide-in-from-bottom-5 duration-200">
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-6 flex-1 content-start overflow-y-auto pr-2 no-scrollbar">
             {config?.installedApps.map((app: API.AppDefinition) => (
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
        </div>
      )}

      <div className="absolute bottom-0 w-full h-12 glass border-t border-white/5 flex items-center justify-between px-4 z-[70]">
        <div className="w-24 hidden sm:flex"><button onClick={toggleFullscreen} className="p-2 rounded-xl text-white/50">{isFullscreen ? <Minimize2 size={20}/> : <Maximize2 size={20}/>}</button></div> 
        <div className="flex items-center gap-1.5 mx-auto sm:mx-0 overflow-x-auto no-scrollbar max-w-full">
           <button onClick={() => setStartMenuOpen(!startMenuOpen)} className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex-shrink-0"><Grid size={24} className="text-blue-400"/></button>
           <div className="w-px h-6 bg-white/5 mx-2 flex-shrink-0"></div>
           {windows.map(win => (
             <button key={win.instanceId} onClick={() => { if (win.isMinimized) toggleMinimize(win.instanceId); setActiveWindowId(win.instanceId); }}
                     className={`p-2 rounded-xl hover:bg-white/10 transition-all relative flex-shrink-0 ${activeWindowId === win.instanceId && !win.isMinimized ? 'bg-white/10' : 'opacity-60'}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-lg ${win.appId === 'file-explorer' ? (win.args?.folderId === recycleBinId ? 'bg-red-900' : 'bg-blue-600') : (win.appId === 'app-store' || win.appId === 'store') ? 'bg-pink-600' : win.appId === 'youtube' ? 'bg-red-600' : win.appId === 'notes' ? 'bg-yellow-600' : win.appData.icon === 'image' ? 'bg-pink-500' : 'bg-slate-700'}`}>
                   {win.appId === 'file-explorer' ? (win.args?.folderId === recycleBinId ? <Trash2 size={14}/> : <Folder size={14}/>) : win.appId === 'youtube' ? <Youtube size={14}/> : win.appId === 'notes' ? <FileText size={14}/> : win.title.charAt(0)}
                </div>
                {!win.isMinimized && activeWindowId === win.instanceId && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-blue-400 rounded-full"></div>}
             </button>
           ))}
        </div>
        <div className="flex items-center gap-3 text-white w-24 justify-end hidden sm:flex">
             <div className="flex flex-col items-end leading-none font-bold">
               <span className="text-[10px]">{clock.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
             </div>
        </div>
      </div>

      {globalContextMenu && (
        <div className="absolute z-[1001] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[180px] animate-in zoom-in-95 duration-100" style={{ top: globalContextMenu.y, left: globalContextMenu.x }}>
            {globalContextMenu.type === 'item' && globalContextMenu.targetItem ? (
                <>
                  <button onClick={() => { executeAction('comment', [globalContextMenu.targetItem!.id]); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><MessageSquare size={14}/> Comment</button>
                  <button onClick={() => { executeAction('delete', [globalContextMenu.targetItem!.id]); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 text-xs flex items-center gap-2"><Trash2 size={14}/> Delete</button>
                </>
            ) : globalContextMenu.type === 'app' ? (
                <button onClick={() => { openApp(globalContextMenu.targetItem as API.AppDefinition); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><ExternalLink size={14}/> Open</button>
            ) : globalContextMenu.type === 'folder-background' ? (
                <>
                  <button onClick={() => { executeAction('new_folder'); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><Folder size={14}/> New Folder</button>
                  <button onClick={() => { loadFolder(currentFolderId); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><RefreshCw size={14}/> Refresh</button>
                </>
            ) : (
                <button onClick={() => { handleRefreshDesktop(); setGlobalContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs flex items-center gap-2 text-slate-200"><RefreshCcw size={14}/> Refresh System</button>
            )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative w-full max-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">{modal.title}</h3>
            {modal.type === 'input' && <input className="w-full bg-slate-800 p-3 rounded-lg text-sm text-white" defaultValue={modal.inputValue} onChange={e=>setModal({...modal, inputValue: e.target.value})} />}
            <div className="mt-6 flex gap-3"><button onClick={() => setModal(null)} className="flex-1 py-2 text-slate-400">Cancel</button><button onClick={() => modal.onConfirm?.(modal.inputValue)} className={`flex-1 py-2 rounded-lg text-white ${modal.isDanger ? 'bg-red-600' : 'bg-blue-600'}`}>OK</button></div>
          </div>
        </div>
      )}

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

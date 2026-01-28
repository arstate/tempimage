
import React, { useState, useEffect, useRef } from 'react';
import * as API from './services/api'; 
import { 
  Monitor, Grid, X, Square, Minus, Settings, Globe, 
  ShoppingBag, Folder, Trash2, Plus, Search, Wifi, Loader2, Database, MessageSquare, Cloud, User
} from 'lucide-react';
import { AppDefinition, SystemConfig, WindowState } from './types';
import { FileExplorer } from './components/apps/FileExplorer';

// --- SUB-APPS ---

const BrowserApp = ({ url }: { url?: string }) => {
  const [targetUrl, setTargetUrl] = useState(url || "https://www.wikipedia.org");
  const [inputUrl, setInputUrl] = useState(targetUrl);
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-2 bg-slate-100 flex gap-2 border-b border-slate-200">
        <input 
          className="flex-1 px-4 py-1.5 rounded-full border border-slate-300 text-sm text-slate-800 focus:outline-none focus:border-blue-500" 
          value={inputUrl} 
          onChange={(e)=>setInputUrl(e.target.value)} 
          onKeyDown={(e) => { if(e.key === 'Enter') setTargetUrl(inputUrl); }}
        />
      </div>
      <div className="flex-1 bg-slate-50 relative">
        <iframe src={targetUrl} className="w-full h-full border-none" title="browser" sandbox="allow-scripts allow-same-origin allow-forms" />
      </div>
    </div>
  );
};

const SettingsApp = ({ config, onSave }: { config: SystemConfig, onSave: (c: SystemConfig) => void }) => {
  const [localConfig, setLocalConfig] = useState(config);
  return (
    <div className="h-full bg-slate-50 text-slate-800 p-8 overflow-auto">
      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3"><Settings size={32} className="text-slate-600"/> Personalization</h2>
      <div className="space-y-6 max-w-lg">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
           <div>
             <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Desktop Wallpaper URL</label>
             <input 
               className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
               value={localConfig.wallpaper}
               onChange={(e) => setLocalConfig({...localConfig, wallpaper: e.target.value})}
               placeholder="https://images.unsplash.com/..."
             />
           </div>
           <button 
             onClick={() => onSave(localConfig)}
             className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all active:scale-[0.98]"
           >
             Apply Background
           </button>
        </div>
      </div>
    </div>
  );
};

const AppStore = ({ installedApps, onInstall, onUninstall }: { installedApps: AppDefinition[], onInstall: (a: AppDefinition) => void, onUninstall: (id: string) => void }) => {
  const [newApp, setNewApp] = useState({ name: "", url: "", icon: "globe" });
  return (
    <div className="h-full bg-slate-50 text-slate-800 p-8 overflow-auto">
      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-blue-600"><ShoppingBag size={32}/> App Store</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-lg">Install New Web App</h3>
          <div className="space-y-3">
             <input placeholder="Name (e.g., YouTube)" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
               value={newApp.name} onChange={e=>setNewApp({...newApp, name: e.target.value})} />
             <input placeholder="URL (https://...)" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
               value={newApp.url} onChange={e=>setNewApp({...newApp, url: e.target.value})} />
             <button onClick={() => { if(newApp.name && newApp.url) { onInstall({ id: "app-"+Date.now(), ...newApp, type: "webapp" } as AppDefinition); setNewApp({name:"", url:"", icon:"globe"}); } }} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">Install</button>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="font-bold text-lg text-slate-500 uppercase text-sm tracking-widest">Installed Applications</h3>
          {installedApps.map(app => (
            <div key={app.id} className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-2xl">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                   {app.icon === 'folder' ? <Folder size={20}/> : app.icon === 'settings' ? <Settings size={20}/> : <Globe size={20}/>}
                 </div>
                 <div><div className="font-bold text-sm">{app.name}</div><div className="text-[10px] text-slate-400 uppercase font-bold">{app.type}</div></div>
               </div>
               {app.type === 'webapp' && <button onClick={() => onUninstall(app.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- OS SHELL ---

const App = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [systemState, setSystemState] = useState<any>(null);
  const [booting, setBooting] = useState(true);
  const [bootMsg, setBootMsg] = useState("Initializing kernel...");

  const nextZIndex = useRef(100);

  useEffect(() => {
    const boot = async () => {
        try {
            setBootMsg("Fetching system config...");
            const conf = await API.getSystemConfig();
            setConfig(conf);

            setBootMsg("Scanning cloud storage...");
            const drive = await API.locateSystemDB();
            
            setBootMsg("Syncing folder map...");
            let finalMap = { "root": { id: "root", name: "Home", parentId: "" } };
            if (drive.fileId) {
                const content = await API.getFileContent(drive.fileId);
                finalMap = JSON.parse(content);
            }

            setBootMsg("Loading discussions...");
            let finalComments = {};
            if (drive.commentFileId) {
                const content = await API.getFileContent(drive.commentFileId);
                finalComments = JSON.parse(content);
            }

            setSystemState({ drive, finalMap, finalComments });
            setBooting(false);
        } catch (e) {
            setBootMsg("Boot error. Please check backend.");
            console.error(e);
        }
    };
    boot();
  }, []);

  const openApp = (app: AppDefinition) => {
    setStartMenuOpen(false);
    const existing = windows.find(w => w.appId === app.id);
    if (existing) {
        setWindows(prev => prev.map(w => w.instanceId === existing.instanceId ? { ...w, isMinimized: false, zIndex: ++nextZIndex.current } : w));
        setActiveWindowId(existing.instanceId);
        return;
    }
    const instanceId = Date.now().toString();
    const newWindow: WindowState = {
      instanceId,
      appId: app.id,
      title: app.name,
      appData: app,
      isMinimized: false,
      isMaximized: false,
      position: { x: 80 + (windows.length * 30), y: 60 + (windows.length * 30) },
      size: { w: 900, h: 650 },
      zIndex: ++nextZIndex.current
    };
    setWindows([...windows, newWindow]);
    setActiveWindowId(instanceId);
  };

  const updateConfig = async (newConf: SystemConfig) => {
    setConfig(newConf);
    await API.saveSystemConfig(newConf);
  };

  if (booting) {
      return (
          <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center space-y-6">
              <div className="relative w-16 h-16 flex items-center justify-center">
                  <Loader2 size={64} className="animate-spin text-blue-500 absolute" />
                  <Database size={24} className="text-blue-300 opacity-80" />
              </div>
              <div className="text-center">
                  <h1 className="text-xl font-bold tracking-widest text-white uppercase mb-2">cloud device OS</h1>
                  <p className="text-slate-500 text-sm font-mono animate-pulse">{bootMsg}</p>
              </div>
          </div>
      );
  }

  return (
    <div 
      className="h-screen w-screen overflow-hidden relative bg-cover bg-center transition-all duration-1000"
      style={{ backgroundImage: `url(${config!.wallpaper})` }}
      onClick={() => setStartMenuOpen(false)}
    >
      {/* DESKTOP ICONS */}
      <div className="absolute inset-0 p-6 flex flex-col flex-wrap content-start gap-6 pointer-events-none">
        {config!.installedApps.map(app => (
          <div 
            key={app.id}
            onDoubleClick={(e) => { e.stopPropagation(); openApp(app); }}
            className="w-24 flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-white/10 cursor-pointer pointer-events-auto group transition-all"
          >
            <div className="w-14 h-14 bg-white/10 glass rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform text-white border border-white/10">
              {app.icon === 'folder' ? <Folder size={32} className="text-blue-400 fill-blue-500/10"/> : 
               app.icon === 'settings' ? <Settings size={32} className="text-slate-300"/> : 
               app.icon === 'shopping-bag' ? <ShoppingBag size={32} className="text-emerald-400"/> : <Globe size={32} className="text-purple-400"/>}
            </div>
            <span className="text-[11px] text-white text-center font-bold text-shadow drop-shadow-xl line-clamp-2">{app.name}</span>
          </div>
        ))}
      </div>

      {/* WINDOWS SHELL */}
      {windows.map(win => (
        <div
          key={win.instanceId}
          hidden={win.isMinimized}
          className={`absolute flex flex-col bg-slate-900 shadow-2xl overflow-hidden transition-[top,left,width,height] duration-200 ease-out window-animate
            ${win.isMaximized ? 'inset-0 !top-0 !left-0 !w-full !h-[calc(100vh-48px)] rounded-none' : 'rounded-xl border border-slate-700/50'}
            ${activeWindowId === win.instanceId ? 'ring-1 ring-blue-500/50' : 'opacity-95'}
          `}
          style={{ zIndex: win.zIndex, top: win.position.y, left: win.position.x, width: win.isMaximized ? '100%' : win.size.w, height: win.isMaximized ? 'calc(100vh - 48px)' : win.size.h }}
          onPointerDown={() => { setActiveWindowId(win.instanceId); setWindows(prev => prev.map(w => w.instanceId === win.instanceId ? { ...w, zIndex: ++nextZIndex.current } : w)); }}
        >
          {/* Header */}
          <div className="h-10 glass border-b border-white/5 flex items-center justify-between px-3"
             onMouseDown={(e) => {
               if(win.isMaximized) return;
               const startX = e.pageX - win.position.x; const startY = e.pageY - win.position.y;
               const handleDrag = (ev: MouseEvent) => setWindows(prev => prev.map(w => w.instanceId === win.instanceId ? { ...w, position: { x: ev.pageX - startX, y: ev.pageY - startY } } : w));
               window.addEventListener('mousemove', handleDrag);
               window.addEventListener('mouseup', () => window.removeEventListener('mousemove', handleDrag), {once:true});
             }}
          >
            <div className="flex items-center gap-3">
               {win.appData.icon === 'folder' ? <Folder size={14} className="text-blue-400"/> : <Globe size={14} className="text-slate-400"/>}
               <span className="text-[11px] font-bold tracking-tight text-slate-200">{win.title}</span>
            </div>
            <div className="flex items-center gap-1">
               <button onClick={(e)=>{e.stopPropagation(); setWindows(p=>p.map(w=>w.instanceId===win.instanceId?{...w,isMinimized:true}:w));}} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><Minus size={14} className="text-white"/></button>
               <button onClick={(e)=>{e.stopPropagation(); setWindows(p=>p.map(w=>w.instanceId===win.instanceId?{...w,isMaximized:!win.isMaximized}:w));}} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><Square size={12} className="text-white"/></button>
               <button onClick={(e)=>{e.stopPropagation(); setWindows(p=>p.filter(w=>w.instanceId!==win.instanceId));}} className="p-2 hover:bg-red-500 rounded-lg transition-colors"><X size={14} className="text-white"/></button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative bg-slate-950">
             {win.appId === 'file-explorer' && <FileExplorer isSystemInitialized={true} dbFileId={systemState.drive.fileId} commentFileId={systemState.drive.commentFileId} systemFolderId={systemState.drive.systemFolderId} initialFolderMap={systemState.finalMap} initialComments={systemState.finalComments} />}
             {win.appId === 'settings' && <SettingsApp config={config!} onSave={updateConfig}/>}
             {win.appId === 'store' && <AppStore installedApps={config!.installedApps} onInstall={a=>{updateConfig({...config!, installedApps: [...config!.installedApps, a]});}} onUninstall={id => { updateConfig({...config!, installedApps: config!.installedApps.filter(a=>a.id!==id)}); }} />}
             {(win.appData.type === 'webapp' || win.appId === 'browser') && <BrowserApp url={win.appData.url} />}
          </div>
        </div>
      ))}

      {/* START MENU */}
      {startMenuOpen && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-[600px] h-[580px] glass border border-white/10 rounded-3xl shadow-2xl z-[1000] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300" onClick={e=>e.stopPropagation()}>
           <div className="p-8 space-y-8 flex-1">
             <div className="relative">
               <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
               <input type="text" placeholder="Search for apps, settings, and documents" className="w-full bg-slate-950/40 border-b border-white/10 px-12 py-4 rounded-full text-sm text-white focus:outline-none focus:bg-slate-950/60 transition-all shadow-inner"/>
             </div>
             
             <div className="space-y-4">
               <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pinned Apps</h3>
                  <button className="text-[10px] bg-white/5 px-2 py-1 rounded hover:bg-white/10 text-white font-bold">All Apps &gt;</button>
               </div>
               <div className="grid grid-cols-6 gap-2">
                 {config!.installedApps.map(app => (
                   <button key={app.id} onClick={()=>openApp(app)} className="flex flex-col items-center gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all group">
                     <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        {app.icon === 'folder' ? <Folder size={24} className="text-blue-400"/> : <Globe size={24} className="text-purple-400"/>}
                     </div>
                     <span className="text-[10px] text-white font-medium truncate w-full text-center">{app.name}</span>
                   </button>
                 ))}
               </div>
             </div>
           </div>
           <div className="bg-white/5 p-6 flex justify-between items-center px-10 border-t border-white/5">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 border-2 border-white/20 flex items-center justify-center"><User size={18}/></div>
                 <div className="flex flex-col"><span className="text-sm font-bold text-white">System Admin</span><span className="text-[10px] text-slate-500 font-bold uppercase">Online</span></div>
              </div>
              <button onClick={()=>{setStartMenuOpen(false); openApp(config!.installedApps.find(a=>a.id==='settings')!);}} className="p-3 hover:bg-white/10 rounded-xl text-white transition-colors"><Settings size={20}/></button>
           </div>
        </div>
      )}

      {/* TASKBAR */}
      <div className="absolute bottom-0 w-full h-12 glass border-t border-white/10 flex items-center justify-between px-4 z-[999]">
        <div className="w-40"></div>
        <div className="flex items-center gap-1">
           <button onClick={(e) => { e.stopPropagation(); setStartMenuOpen(!startMenuOpen); }} className={`p-2 rounded-xl transition-all ${startMenuOpen ? 'bg-white/20 scale-90' : 'hover:bg-white/10'}`}><Grid size={24} className="text-blue-400 fill-blue-500/20"/></button>
           <div className="w-px h-6 bg-white/10 mx-1"></div>
           <div className="flex items-center gap-1">
             {config!.installedApps.filter(a => windows.some(w => w.appId === a.id)).map(app => {
               const isActive = windows.some(w => w.appId === app.id && activeWindowId === w.instanceId);
               const isMinimized = windows.find(w => w.appId === app.id)?.isMinimized;
               return (
                <button key={app.id} onClick={()=>openApp(app)} className={`p-2 rounded-xl transition-all relative group ${isActive ? 'bg-white/10' : 'hover:bg-white/10'}`}>
                   {app.icon === 'folder' ? <Folder size={20} className="text-blue-400"/> : <Globe size={20} className="text-purple-400"/>}
                   <div className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1 rounded-full transition-all duration-300 ${isActive ? 'bg-blue-400 w-4' : isMinimized ? 'bg-slate-500 w-1.5' : 'bg-transparent'}`}></div>
                </button>
               );
             })}
           </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-white w-40 justify-end">
           <div className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded transition-colors cursor-pointer"><Wifi size={14}/><Cloud size={14} className="text-blue-400"/></div>
           <div className="flex flex-col items-end leading-tight pr-2">
             <span className="font-bold">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
             <span className="text-[10px] text-slate-400">{new Date().toLocaleDateString()}</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;

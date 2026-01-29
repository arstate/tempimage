
import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, Download, Trash2, Plus, FileText, 
  ChevronLeft, CloudUpload, Folder, AlertTriangle, X,
  ArrowUp, ArrowLeft, Search, Home, Loader2,
  Copy, Scissors, MousePointerClick
} from 'lucide-react';
import * as API from '../services/api';
import { Item, FolderMap } from '../types';

interface NotesAppProps {
  initialFileId?: string;
  isNewNote?: boolean;
  initialFolderId?: string;
  currentFolderId: string;
  filesInFolder: Item[];
  systemMap: FolderMap;
  onClose: () => void;
  onRefresh: () => void;
  onSaveToCloud: (id: string, title: string, content: string, targetFolderId?: string) => Promise<string | undefined>;
}

// Local history helper
const getRecentNotes = (): {id: string, name: string, lastUpdated: number}[] => {
    try {
        const stored = localStorage.getItem('zombio_notes_recent');
        return stored ? JSON.parse(stored) : [];
    } catch(e) { return []; }
};

const saveToRecent = (id: string, name: string) => {
    const recent = getRecentNotes();
    const existingIdx = recent.findIndex(r => r.id === id);
    if (existingIdx >= 0) recent.splice(existingIdx, 1);
    recent.unshift({ id, name, lastUpdated: Date.now() });
    localStorage.setItem('zombio_notes_recent', JSON.stringify(recent.slice(0, 15)));
};

export const NotesApp: React.FC<NotesAppProps> = ({ 
  initialFileId, 
  isNewNote,
  initialFolderId,
  currentFolderId, 
  filesInFolder,
  systemMap,
  onClose,
  onRefresh,
  onSaveToCloud
}) => {
  // State
  const [activeNoteId, setActiveNoteId] = useState<string | null>(initialFileId || null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [recentNotes, setRecentNotes] = useState<{id: string, name: string}[]>([]);
  const [selectionMenu, setSelectionMenu] = useState<{x: number, y: number} | null>(null);
  
  // Picker State
  const [pickerCurrentFolderId, setPickerCurrentFolderId] = useState<string>('root');
  const [pickerHistory, setPickerHistory] = useState<string[]>([]);
  
  // Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Refs
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const initialContentRef = useRef('');

  useEffect(() => {
     setRecentNotes(getRecentNotes());
  }, []);

  // Use passed filesInFolder if valid, else fallback to local recents
  const displayNotes = filesInFolder.length > 0 ? filesInFolder.filter(i => i.type === 'note') : recentNotes.map(r => ({...r, type: 'note', snippet: 'Recent'} as Item));

  // --- HANDLE PROPS CHANGE (Single Instance Logic) ---
  useEffect(() => {
      // When props change (e.g. user double clicks a file in explorer while notes is open)
      if (initialFileId) {
          if (isDirty && activeNoteId !== initialFileId) {
              if (confirm("Ada perubahan belum disimpan. Buka file baru?")) {
                  setActiveNoteId(initialFileId);
              }
          } else {
              setActiveNoteId(initialFileId);
          }
      }
      if (isNewNote) {
          handleNewNote(true);
      }
  }, [initialFileId, isNewNote]);

  // --- LOAD NOTE ---
  useEffect(() => {
    const loadNote = async () => {
      if (!activeNoteId) return;

      // If it's a temp ID for new note, skip fetching
      if (activeNoteId.startsWith('new-')) return;

      const noteItem = displayNotes.find(n => n.id === activeNoteId);
      const recentItem = recentNotes.find(n => n.id === activeNoteId);

      setIsLoading(true);
      try {
          const name = noteItem ? noteItem.name : recentItem ? recentItem.name : "Untitled";
          setTitle(name.replace('.txt', ''));
          
          let loadedContent = (noteItem as any)?.content || "";
          if (!loadedContent) {
             loadedContent = await API.getFileContent(activeNoteId);
          }
          setContent(loadedContent);
          initialContentRef.current = loadedContent;
          setIsDirty(false);
          
          // Add to recents when opened
          saveToRecent(activeNoteId, name);
          setRecentNotes(getRecentNotes());
      } catch (e) {
          console.error("Failed to open note", e);
          setContent("Error loading content.");
      } finally {
          setIsLoading(false);
      }
    };

    loadNote();
  }, [activeNoteId]);

  // --- HANDLERS ---

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsDirty(true);
    setSelectionMenu(null); // Hide menu on type
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setIsDirty(true);
  };

  const handleSaveLocal = () => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${title || 'Untitled'}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const openSaveModal = () => {
    // PREFER INITIAL FOLDER ID, BUT HANDLE 'ROOT' STRING LOGIC
    let target = initialFolderId || currentFolderId;
    if (target === '' || target === 'root') target = 'root';
    
    setPickerCurrentFolderId(target);
    setPickerHistory([]);
    setShowSaveModal(true);
  }

  const handleCloudSaveAction = async () => {
    setIsLoading(true);
    try {
      const idToSave = activeNoteId && !activeNoteId.startsWith('new-') ? activeNoteId : `new-${Date.now()}`;
      
      // Fix: If picker is at 'root', send empty string to API for home folder
      const finalFolderId = pickerCurrentFolderId === 'root' ? '' : pickerCurrentFolderId;

      const savedId = await onSaveToCloud(
        idToSave, 
        title || 'Untitled Note', 
        content,
        finalFolderId
      );

      initialContentRef.current = content;
      setIsDirty(false);
      setShowSaveModal(false);
      
      // Handle ID Update (Transition from 'new-...' to real ID)
      const finalId = savedId || idToSave;
      
      if (activeNoteId !== finalId) {
          // If we had a temporary ID, remove it from recents locally before adding the new one
          if (activeNoteId?.startsWith('new-')) {
              const currentRecents = getRecentNotes();
              const filteredRecents = currentRecents.filter(r => r.id !== activeNoteId);
              localStorage.setItem('zombio_notes_recent', JSON.stringify(filteredRecents));
              setRecentNotes(filteredRecents);
          }
          setActiveNoteId(finalId);
      }
      
      // Update Recents with the final (real) ID
      saveToRecent(finalId, title || 'Untitled Note');
      setRecentNotes(getRecentNotes());
      
      onRefresh(); // Refresh file list in parent
    } catch (e) {
      alert("Gagal menyimpan ke cloud");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewNote = (force: boolean = false) => {
    if (!force && isDirty) {
      if(!confirm("Buang perubahan yang belum disimpan?")) return;
    }
    // Set a temporary ID so UI renders the editor
    setActiveNoteId(`new-${Date.now()}`);
    setTitle('');
    setContent('');
    setIsDirty(false);
  };

  // Logic to handle "Close": if note active -> go back to history. If no note -> close window.
  const attemptClose = () => {
    if (isDirty) {
      setShowExitPrompt(true);
    } else {
        // Clear active note (go back to empty state), but keep window open
        setActiveNoteId(null);
        setTitle('');
        setContent('');
    }
  };
  
  const confirmExitWithoutSaving = () => {
      setShowExitPrompt(false);
      // Clear active note (go back to empty state), but keep window open
      setActiveNoteId(null);
      setTitle('');
      setContent('');
  };

  // --- SELECTION POPUP LOGIC ---
  const handleSelection = (e: React.SyntheticEvent) => {
    const textarea = editorRef.current;
    if (!textarea) return;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
     const textarea = editorRef.current;
     if (!textarea) return;
     
     const start = textarea.selectionStart;
     const end = textarea.selectionEnd;

     if (start !== end) {
         // Has selection
         // Position popup near mouse
         const rect = textarea.getBoundingClientRect();
         // Ensure inside window bounds logic handled by absolute positioning
         setSelectionMenu({ x: e.clientX, y: e.clientY - 40 });
     } else {
         setSelectionMenu(null);
     }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
      // Hide menu on key press unless it's a selection key, 
      // but calculating position is hard without mouse. 
      // We'll just hide it to be safe.
      setSelectionMenu(null);
  }

  const performEditAction = (action: 'copy' | 'cut' | 'delete') => {
      const textarea = editorRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const selectedText = text.substring(start, end);

      if (action === 'copy' || action === 'cut') {
          navigator.clipboard.writeText(selectedText);
      }

      if (action === 'cut' || action === 'delete') {
          const newText = text.substring(0, start) + text.substring(end);
          setContent(newText);
          setIsDirty(true);
          // Restore cursor
          setTimeout(() => {
              textarea.focus();
              textarea.setSelectionRange(start, start);
          }, 0);
      }
      
      setSelectionMenu(null);
  };

  // --- PICKER NAVIGATION HELPERS ---
  const getPickerSubfolders = () => {
    // Fix: Use the current folder ID directly. 
    // In App.tsx logic, root-level folders have parentId assigned as "root".
    // We should NOT convert 'root' to '' here, otherwise we match the root node itself.
    const pid = pickerCurrentFolderId;
    
    // Ensure systemMap exists
    if (!systemMap) return [];

    return Object.values(systemMap).filter(f => 
      f.parentId === pid && 
      f.name !== 'System' && 
      f.name !== 'Recycle Bin' &&
      f.id !== 'root' // Explicitly exclude root node to prevent self-reference
    ).sort((a, b) => a.name.localeCompare(b.name));
  };

  const handlePickerEnter = (folderId: string) => {
    setPickerHistory(prev => [...prev, pickerCurrentFolderId]);
    setPickerCurrentFolderId(folderId);
  };

  const handlePickerUp = () => {
    if (pickerCurrentFolderId === 'root') return;

    const current = systemMap[pickerCurrentFolderId];
    if (current && current.parentId && current.parentId !== "") {
       setPickerHistory(prev => [...prev, pickerCurrentFolderId]);
       setPickerCurrentFolderId(current.parentId);
    } else {
       setPickerHistory(prev => [...prev, pickerCurrentFolderId]);
       setPickerCurrentFolderId('root');
    }
  };

  const handlePickerBack = () => {
    if (pickerHistory.length === 0) return;
    const prev = pickerHistory[pickerHistory.length - 1];
    setPickerHistory(h => h.slice(0, -1));
    setPickerCurrentFolderId(prev);
  };

  return (
    <div className="flex h-full bg-[#1e1e1e] text-[#d4d4d4] font-sans overflow-hidden relative">
      
      {/* --- SIDEBAR (History / List) --- */}
      <div className={`${sidebarOpen ? 'w-full sm:w-64 border-r' : 'w-0 overflow-hidden'} bg-[#252526] border-[#333] flex-shrink-0 transition-all duration-300 flex flex-col z-10`}>
        <div className="p-4 border-b border-[#333] flex items-center justify-between min-w-[200px]">
           <h2 className="font-bold text-sm text-yellow-500 flex items-center gap-2">
             <Folder size={16} /> 
             <span className="truncate max-w-[120px]">
                {filesInFolder.length > 0 ? (systemMap[currentFolderId]?.name || "Folder") : "Recent"}
             </span>
           </h2>
           <div className="flex items-center gap-2">
               <button onClick={() => handleNewNote(false)} className="p-1 hover:bg-[#333] rounded text-yellow-500" title="New Note">
                 <Plus size={18} />
               </button>
               {/* Close Window Button (only visible if sidebar is taking full width or explicit) */}
               <button onClick={onClose} className="p-1 hover:bg-red-500/20 rounded text-red-500 sm:hidden">
                   <X size={18} />
               </button>
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto min-w-[200px]">
          {displayNotes.length === 0 && (
            <div className="p-4 text-xs text-gray-500 text-center">Tidak ada catatan</div>
          )}
          {displayNotes.map(note => (
            <div 
              key={note.id}
              onClick={() => {
                if(isDirty && !confirm("Pindah catatan? Perubahan akan hilang.")) return;
                setActiveNoteId(note.id);
                // On mobile, auto hide sidebar
                if (window.innerWidth < 640) setSidebarOpen(false);
              }}
              className={`p-3 border-b border-[#333] cursor-pointer group transition-colors ${activeNoteId === note.id ? 'bg-[#37373d]' : 'hover:bg-[#2a2d2e]'}`}
            >
              <h3 className={`text-sm font-bold truncate ${activeNoteId === note.id ? 'text-white' : 'text-gray-300'}`}>
                {note.name.replace('.txt','')}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-500">{note.lastUpdated ? new Date(note.lastUpdated).toLocaleDateString() : ''}</span>
                <span className="text-[10px] text-gray-600 truncate flex-1">{note.snippet || "No preview"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- MAIN EDITOR --- */}
      <div className={`${activeNoteId ? 'flex-1' : 'hidden sm:flex sm:flex-1'} flex flex-col h-full bg-[#1e1e1e] relative min-w-0`}>
        
        {/* Toolbar */}
        <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#1e1e1e]">
           <div className="flex items-center gap-2">
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-[#333] rounded text-yellow-500">
               <ChevronLeft size={20} className={`transition-transform duration-300 ${!sidebarOpen ? 'rotate-180' : ''}`} />
             </button>
             {isDirty && <span className="text-xs text-yellow-500 font-medium px-2 py-0.5 bg-yellow-500/10 rounded-full">Belum Disimpan</span>}
           </div>

           {activeNoteId ? (
               <div className="flex items-center gap-2">
                 <button 
                    onClick={openSaveModal} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded text-xs font-medium transition-colors"
                    title="Save to Cloud"
                 >
                   <CloudUpload size={14} className="text-yellow-500" />
                   <span className="hidden sm:inline">Save Cloud</span>
                 </button>
                 
                 <button 
                    onClick={handleSaveLocal} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded text-xs font-medium transition-colors"
                    title="Download .txt"
                 >
                   <Download size={14} className="text-blue-400" />
                   <span className="hidden sm:inline">Save Local</span>
                 </button>

                 <div className="w-px h-4 bg-[#444] mx-1"></div>

                 <button onClick={attemptClose} className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded" title="Close Note">
                    <X size={18} />
                 </button>
               </div>
           ) : (
               <div className="text-xs text-gray-500 italic">Pilih atau buat catatan baru</div>
           )}
        </div>

        {/* Editor Inputs */}
        {activeNoteId ? (
            <div className="flex-1 flex flex-col overflow-hidden relative">
               <div className="px-8 pt-6 pb-2">
                 <input 
                   type="text" 
                   value={title}
                   onChange={handleTitleChange}
                   placeholder="Judul Catatan"
                   className="w-full bg-transparent text-2xl font-bold text-white placeholder-gray-600 outline-none border-none"
                 />
                 <div className="text-xs text-gray-500 mt-1 flex gap-2">
                    <span>{new Date().toLocaleString()}</span>
                    <span>{content.length} karakter</span>
                 </div>
               </div>
               
               <textarea
                 ref={editorRef}
                 value={content}
                 onChange={handleContentChange}
                 onSelect={handleSelection}
                 onMouseUp={handleMouseUp}
                 onKeyUp={handleKeyUp}
                 placeholder="Ketik sesuatu..."
                 className="flex-1 w-full bg-transparent px-8 py-4 text-base text-gray-300 outline-none resize-none leading-relaxed scrollbar-thin scrollbar-thumb-[#444]"
                 spellCheck={false}
               />

               {/* FLOATING ACTION MENU */}
               {selectionMenu && (
                   <div 
                      className="fixed z-50 flex items-center gap-1 bg-slate-800 border border-slate-600 p-1.5 rounded-full shadow-2xl animate-in fade-in zoom-in-95 duration-100"
                      style={{ top: selectionMenu.y, left: selectionMenu.x, transform: 'translateX(-50%)' }}
                      onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
                   >
                      <button onClick={() => performEditAction('copy')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 rounded-full text-xs font-bold text-slate-200 transition-colors">
                        <Copy size={12} className="text-blue-400" /> Copy
                      </button>
                      <div className="w-px h-3 bg-slate-600"></div>
                      <button onClick={() => performEditAction('cut')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 rounded-full text-xs font-bold text-slate-200 transition-colors">
                        <Scissors size={12} className="text-yellow-400" /> Cut
                      </button>
                      <div className="w-px h-3 bg-slate-600"></div>
                      <button onClick={() => performEditAction('delete')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/20 rounded-full text-xs font-bold text-red-400 transition-colors">
                        <Trash2 size={12} /> Delete
                      </button>
                   </div>
               )}
            </div>
        ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 flex-col gap-2">
                <FileText size={48} className="opacity-20"/>
                <span className="text-sm">Tidak ada catatan yang dipilih</span>
                <button onClick={() => handleNewNote(false)} className="px-4 py-2 bg-yellow-600/20 text-yellow-500 rounded-lg text-sm font-bold hover:bg-yellow-600/30 transition-colors">
                    + Buat Catatan Baru
                </button>
            </div>
        )}
      </div>

      {/* --- SAVE LOCATION MODAL (FILE EXPLORER STYLE) --- */}
      {showSaveModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#252526] w-full max-w-2xl h-[550px] rounded-xl shadow-2xl border border-[#444] flex flex-col overflow-hidden animate-in zoom-in-95">
            
            {/* Title Bar */}
            <div className="p-3 border-b border-[#333] flex justify-between items-center bg-[#2d2d2d]">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Save size={14} className="text-yellow-500"/> Simpan ke Cloud
              </span>
              <button onClick={() => setShowSaveModal(false)} className="hover:bg-red-500 hover:text-white rounded p-1 transition-colors"><X size={14}/></button>
            </div>

            {/* Navigation Bar */}
            <div className="flex items-center gap-2 p-2 border-b border-[#333] bg-[#2d2d2d]">
               <button 
                 onClick={handlePickerBack} 
                 disabled={pickerHistory.length === 0}
                 className="p-1.5 hover:bg-[#444] rounded text-gray-300 disabled:opacity-30 transition-colors"
                 title="Back"
               >
                 <ArrowLeft size={16}/>
               </button>
               <button 
                 onClick={handlePickerUp}
                 className="p-1.5 hover:bg-[#444] rounded text-gray-300 transition-colors"
                 title="Up to parent"
               >
                 <ArrowUp size={16}/>
               </button>
               
               {/* Address Bar */}
               <div className="flex-1 flex items-center gap-2 bg-[#1e1e1e] border border-[#444] rounded px-3 py-1.5 text-xs text-gray-300">
                  <Folder size={14} className="text-yellow-500"/>
                  <div className="flex gap-1">
                     <span className="text-gray-500">System</span>
                     <span className="text-gray-500">/</span>
                     <span className="font-medium text-white">{pickerCurrentFolderId === 'root' ? 'Home' : systemMap[pickerCurrentFolderId]?.name || "Folder"}</span>
                  </div>
               </div>

               <div className="w-48 bg-[#1e1e1e] border border-[#444] rounded flex items-center px-2 py-1.5">
                  <Search size={14} className="text-gray-500 mr-2"/>
                  <input placeholder="Search..." className="bg-transparent border-none outline-none text-xs text-white w-full" disabled/>
               </div>
            </div>
            
            {/* Folder Grid Area */}
            <div className="flex-1 bg-[#1e1e1e] overflow-y-auto p-4">
               <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
                  {getPickerSubfolders().length === 0 ? (
                      <div className="col-span-full flex flex-col items-center justify-center text-gray-500 py-10 opacity-50">
                          <Folder size={48} className="mb-2 stroke-1"/>
                          <span className="text-xs">Folder kosong</span>
                      </div>
                  ) : (
                      getPickerSubfolders().map(folder => (
                        <div 
                          key={folder.id}
                          onClick={() => handlePickerEnter(folder.id)}
                          className="group flex flex-col items-center gap-2 p-2 hover:bg-[#333] hover:bg-opacity-50 border border-transparent hover:border-[#444] rounded cursor-pointer transition-all active:scale-95"
                        >
                           <div className="w-16 h-14 flex items-center justify-center">
                              <Folder size={48} className="text-yellow-500 drop-shadow-md group-hover:scale-105 transition-transform" fill="currentColor" fillOpacity={0.2} />
                           </div>
                           <span className="text-[11px] text-gray-300 text-center w-full truncate px-1 group-hover:text-white">{folder.name}</span>
                        </div>
                      ))
                  )}
               </div>
            </div>

            {/* Footer / Input Area */}
            <div className="p-4 border-t border-[#333] bg-[#2d2d2d] flex flex-col gap-3">
               <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-16 text-right">File name:</span>
                  <div className="flex-1 bg-[#1e1e1e] border border-[#444] rounded flex items-center px-3 py-1.5">
                     <FileText size={14} className="text-blue-400 mr-2"/>
                     <input 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs text-white w-full font-medium" 
                     />
                     <span className="text-xs text-gray-500 ml-1">.txt</span>
                  </div>
               </div>
               
               <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-16 text-right">Save as type:</span>
                  <div className="flex-1 bg-[#1e1e1e] border border-[#444] rounded px-3 py-1.5 text-xs text-gray-400">
                     Text Document (*.txt)
                  </div>
                  <div className="flex gap-2">
                     <button onClick={handleCloudSaveAction} className="px-6 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-colors">Save</button>
                     <button onClick={() => setShowSaveModal(false)} className="px-4 py-1.5 bg-[#444] hover:bg-[#555] text-white rounded text-xs transition-colors">Cancel</button>
                  </div>
               </div>
            </div>

          </div>
        </div>
      )}

      {/* --- UNSAVED EXIT PROMPT --- */}
      {showExitPrompt && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-[#252526] w-full max-w-xs rounded-xl shadow-2xl border border-[#444] p-5 text-center animate-in zoom-in-95">
              <AlertTriangle size={32} className="text-yellow-500 mx-auto mb-3" />
              <h3 className="text-white font-bold mb-1">Belum Disimpan</h3>
              <p className="text-xs text-gray-400 mb-4">Perubahan Anda pada catatan ini belum disimpan ke Cloud. Ingin simpan sebelum keluar?</p>
              
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => openSaveModal()} 
                  className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded font-medium text-xs"
                >
                  Simpan ke Cloud
                </button>
                <button 
                  onClick={handleSaveLocal} 
                  className="w-full py-2 bg-[#333] hover:bg-[#444] text-blue-400 rounded font-medium text-xs"
                >
                  Unduh .txt (Lokal)
                </button>
                <button 
                  onClick={confirmExitWithoutSaving} 
                  className="w-full py-2 text-red-400 hover:bg-red-500/10 rounded font-medium text-xs mt-2"
                >
                  Tutup Tanpa Simpan
                </button>
                <button 
                  onClick={() => setShowExitPrompt(false)} 
                  className="w-full py-2 text-gray-500 hover:text-gray-300 text-xs"
                >
                  Batal
                </button>
              </div>
           </div>
        </div>
      )}

      {/* --- GLOBAL BLOCKING LOADING OVERLAY --- */}
      {isLoading && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-[2px] flex items-center justify-center cursor-wait">
            <div className="bg-[#252526] border border-[#444] p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-[#333]"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-white font-bold text-lg">Memproses...</span>
                    <span className="text-xs text-gray-400 mt-1">Mohon tunggu sebentar</span>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

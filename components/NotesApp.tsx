
import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, Download, Trash2, Plus, FileText, 
  ChevronLeft, CloudUpload, Folder, AlertTriangle, X 
} from 'lucide-react';
import * as API from '../services/api';
import { Item, FolderMap } from '../types';

interface NotesAppProps {
  initialFileId?: string;
  currentFolderId: string;
  filesInFolder: Item[];
  systemMap: FolderMap;
  onClose: () => void;
  onRefresh: () => void;
  onSaveToCloud: (id: string, title: string, content: string, targetFolderId?: string) => Promise<void>;
}

export const NotesApp: React.FC<NotesAppProps> = ({ 
  initialFileId, 
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
  
  // Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Refs
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const initialContentRef = useRef('');

  // Filter only text/note files for the sidebar
  const notesList = filesInFolder.filter(i => i.type === 'note');

  // --- LOAD NOTE ---
  useEffect(() => {
    const loadNote = async () => {
      if (!activeNoteId) {
        // Create new blank state
        setTitle('');
        setContent('');
        initialContentRef.current = '';
        setIsDirty(false);
        return;
      }

      const noteItem = notesList.find(n => n.id === activeNoteId);
      if (noteItem) {
        setTitle(noteItem.name.replace('.txt', ''));
        setIsLoading(true);
        try {
          // Check if content is pre-loaded in item (optimization) or fetch
          let loadedContent = noteItem.content || "";
          if (!loadedContent) {
             loadedContent = await API.getFileContent(activeNoteId);
          }
          setContent(loadedContent);
          initialContentRef.current = loadedContent;
          setIsDirty(false);
        } catch (e) {
          console.error("Failed to open note", e);
          setContent("Error loading content.");
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadNote();
  }, [activeNoteId]);

  // --- HANDLERS ---

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsDirty(true);
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
    
    // Local save doesn't clear dirty state relative to cloud, 
    // but usually user considers it "saved". 
    // We'll keep isDirty true for cloud sync purposes unless logic changes.
  };

  const handleCloudSaveAction = async (targetFolderId: string = currentFolderId) => {
    setIsLoading(true);
    try {
      await onSaveToCloud(
        activeNoteId || `new-${Date.now()}`, 
        title || 'Untitled Note', 
        content,
        targetFolderId
      );
      initialContentRef.current = content;
      setIsDirty(false);
      setShowSaveModal(false);
      onRefresh(); // Refresh file list
    } catch (e) {
      alert("Gagal menyimpan ke cloud");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewNote = () => {
    if (isDirty) {
      if(!confirm("Buang perubahan yang belum disimpan?")) return;
    }
    setActiveNoteId(null);
    setTitle('');
    setContent('');
    setIsDirty(false);
  };

  const attemptClose = () => {
    if (isDirty) {
      setShowExitPrompt(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="flex h-full bg-[#1e1e1e] text-[#d4d4d4] font-sans overflow-hidden relative">
      
      {/* --- SIDEBAR (Apple Notes Style) --- */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-[#252526] border-r border-[#333] flex-shrink-0 transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-[#333] flex items-center justify-between">
           <h2 className="font-bold text-sm text-yellow-500 flex items-center gap-2">
             <Folder size={16} /> 
             <span className="truncate max-w-[120px]">{systemMap[currentFolderId]?.name || "Folder"}</span>
           </h2>
           <button onClick={handleNewNote} className="p-1 hover:bg-[#333] rounded text-yellow-500">
             <Plus size={18} />
           </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {notesList.length === 0 && (
            <div className="p-4 text-xs text-gray-500 text-center">Tidak ada catatan</div>
          )}
          {notesList.map(note => (
            <div 
              key={note.id}
              onClick={() => {
                if(isDirty && !confirm("Pindah catatan? Perubahan akan hilang.")) return;
                setActiveNoteId(note.id);
              }}
              className={`p-3 border-b border-[#333] cursor-pointer group transition-colors ${activeNoteId === note.id ? 'bg-[#37373d]' : 'hover:bg-[#2a2d2e]'}`}
            >
              <h3 className={`text-sm font-bold truncate ${activeNoteId === note.id ? 'text-white' : 'text-gray-300'}`}>
                {note.name.replace('.txt','')}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-500">{new Date(note.lastUpdated).toLocaleDateString()}</span>
                <span className="text-[10px] text-gray-600 truncate flex-1">{note.snippet || "No preview"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- MAIN EDITOR --- */}
      <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] relative">
        
        {/* Toolbar */}
        <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#1e1e1e]">
           <div className="flex items-center gap-2">
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-[#333] rounded text-yellow-500">
               <ChevronLeft size={20} className={`transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
             </button>
             {isDirty && <span className="text-xs text-yellow-500 font-medium px-2 py-0.5 bg-yellow-500/10 rounded-full">Belum Disimpan</span>}
           </div>

           <div className="flex items-center gap-2">
             <button 
                onClick={() => setShowSaveModal(true)} 
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

             <button onClick={attemptClose} className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded">
                <X size={18} />
             </button>
           </div>
        </div>

        {/* Editor Inputs */}
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
             placeholder="Ketik sesuatu..."
             className="flex-1 w-full bg-transparent px-8 py-4 text-base text-gray-300 outline-none resize-none leading-relaxed scrollbar-thin scrollbar-thumb-[#444]"
             spellCheck={false}
           />

           {isLoading && (
             <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
               <div className="animate-spin w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
             </div>
           )}
        </div>
      </div>

      {/* --- SAVE LOCATION MODAL --- */}
      {showSaveModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#252526] w-full max-w-sm rounded-xl shadow-2xl border border-[#444] overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-[#333]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Save size={16} className="text-yellow-500"/> Simpan ke Cloud
              </h3>
            </div>
            
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-400">Pilih folder tujuan penyimpanan:</p>
              
              <div className="max-h-48 overflow-y-auto space-y-1 bg-[#1e1e1e] p-2 rounded border border-[#333]">
                {/* Always show current folder first */}
                <button 
                  onClick={() => handleCloudSaveAction(currentFolderId)}
                  className="w-full text-left px-3 py-2 rounded bg-yellow-500/10 text-yellow-500 text-xs font-medium border border-yellow-500/30 flex items-center gap-2"
                >
                  <Folder size={14} /> {systemMap[currentFolderId]?.name || "Folder Ini"} (Saat Ini)
                </button>

                {/* Other folders */}
                {Object.values(systemMap).filter(f => f.id !== 'root' && f.id !== currentFolderId).map(folder => (
                  <button 
                    key={folder.id}
                    onClick={() => handleCloudSaveAction(folder.id)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#333] text-gray-300 text-xs flex items-center gap-2"
                  >
                    <Folder size={14} className="text-gray-500" /> {folder.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-[#1e1e1e] flex justify-end gap-2">
              <button onClick={() => setShowSaveModal(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Batal</button>
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
                  onClick={() => handleCloudSaveAction()} 
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
                  onClick={onClose} 
                  className="w-full py-2 text-red-400 hover:bg-red-500/10 rounded font-medium text-xs mt-2"
                >
                  Keluar Tanpa Simpan
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

    </div>
  );
};

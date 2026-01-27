
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Bold, Italic, Copy, Scissors, Trash2, Type, AlignLeft, AlertCircle } from 'lucide-react';
import { StoredNote } from '../types';

interface TextEditorProps {
  note: StoredNote;
  onSave: (id: string, title: string, content: string) => void;
  onClose: () => void;
}

interface SelectionMenuPos {
  x: number;
  y: number;
  isFixed: boolean;
}

export const TextEditor: React.FC<TextEditorProps> = ({ note, onSave, onClose }) => {
  const [title, setTitle] = useState(note.title);
  const [isDirty, setIsDirty] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [selectionPos, setSelectionPos] = useState<SelectionMenuPos | null>(null);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const initialContentRef = useRef(note.content);

  // 1. Lock Background Scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);
  
  // Set initial content
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = note.content;
    }
  }, []);

  // --- SELECTION LOGIC ---
  const handleSelectionChange = () => {
    const selection = window.getSelection();
    
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectionPos(null);
      return;
    }

    // Ensure selection is inside our editor
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
      setSelectionPos(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Logic: If selection height > 40% of viewport, stick to bottom
    if (rect.height > viewportHeight * 0.4) {
      setSelectionPos({ x: 0, y: 0, isFixed: true });
    } else {
      // Floating position (Above selection)
      setSelectionPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 55, // Distance above the text
        isFixed: false
      });
    }
  };

  // Detect content changes
  const handleInput = () => {
    if (editorRef.current) {
      const currentContent = editorRef.current.innerHTML;
      const isContentChanged = currentContent !== initialContentRef.current;
      const isTitleChanged = title !== note.title;
      setIsDirty(isContentChanged || isTitleChanged);
    }
    handleSelectionChange();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setIsDirty(true);
  };

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
    setSelectionPos(null); // Hide menu after action
  };

  // Specialized Selection Actions
  const executeSelectionAction = (action: 'copy' | 'cut' | 'delete') => {
    if (action === 'copy') {
      document.execCommand('copy');
    } else if (action === 'cut') {
      document.execCommand('cut');
      handleInput();
    } else if (action === 'delete') {
      document.execCommand('delete');
      handleInput();
    }
    setSelectionPos(null);
  };

  const handleSave = () => {
    if (editorRef.current) {
      onSave(note.id, title, editorRef.current.innerHTML);
      initialContentRef.current = editorRef.current.innerHTML;
      setIsDirty(false);
      setShowCloseConfirm(false);
    }
  };

  const handleCloseRequest = () => {
    if (isDirty) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative bg-slate-900 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col border border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header / Toolbar */}
        <div className="bg-slate-950 border-b border-slate-800 p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <input 
              type="text" 
              value={title}
              onChange={handleTitleChange}
              className="bg-transparent text-xl font-bold text-white focus:outline-none w-full placeholder-slate-500"
              placeholder="Judul Catatan..."
            />
            <div className="flex items-center gap-2 ml-4">
              <button 
                onClick={handleSave} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${isDirty ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
              >
                <Save size={18} /> {isDirty ? 'Simpan*' : 'Simpan'}
              </button>
              <button onClick={handleCloseRequest} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Formatting Toolbar */}
          <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800">
            <button onClick={() => handleFormat('bold')} className="p-2 hover:bg-slate-800 rounded text-slate-300" title="Bold">
              <Bold size={18} />
            </button>
            <button onClick={() => handleFormat('italic')} className="p-2 hover:bg-slate-800 rounded text-slate-300" title="Italic">
              <Italic size={18} />
            </button>
            
            <div className="w-px h-6 bg-slate-700 mx-1"></div>

            <select 
              onChange={(e) => handleFormat('fontSize', e.target.value)} 
              className="bg-slate-800 text-slate-300 text-sm p-1.5 rounded border border-slate-700 focus:outline-none focus:border-blue-500"
              defaultValue="3"
            >
              <option value="1">Kecil</option>
              <option value="3">Normal</option>
              <option value="5">Besar</option>
              <option value="7">Raksasa</option>
            </select>

            <select 
              onChange={(e) => handleFormat('fontName', e.target.value)} 
              className="bg-slate-800 text-slate-300 text-sm p-1.5 rounded border border-slate-700 focus:outline-none focus:border-blue-500"
              defaultValue="Inter"
            >
              <option value="Inter">Sans Serif</option>
              <option value="Serif">Serif</option>
              <option value="Monospace">Monospace</option>
              <option value="Comic Sans MS">Comic</option>
            </select>
          </div>
        </div>

        {/* Editor Area */}
        <div 
          className="flex-1 bg-white overflow-y-auto cursor-text relative" 
          onClick={() => editorRef.current?.focus()}
          onScroll={() => setSelectionPos(null)} // Hide on scroll to prevent misalignment
        >
          <div 
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onMouseUp={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            className="min-h-full p-8 md:p-12 outline-none text-slate-900 text-lg leading-relaxed max-w-3xl mx-auto wysiwyg-content"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
          </div>

          {/* --- SMART SELECTION TOOLBAR --- */}
          {selectionPos && (
            <div 
              className={`z-[250] flex items-center gap-1 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-1.5 rounded-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 transition-all ${selectionPos.isFixed ? 'fixed bottom-8 left-1/2 -translate-x-1/2' : 'absolute'}`}
              style={!selectionPos.isFixed ? { 
                top: selectionPos.y, 
                left: selectionPos.x, 
                transform: 'translateX(-50%)' 
              } : {}}
              onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
            >
              <button onClick={() => executeSelectionAction('copy')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 rounded-full text-xs font-semibold text-slate-200 transition-colors">
                <Copy size={14} className="text-blue-400" /> Copy
              </button>
              <button onClick={() => executeSelectionAction('cut')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 rounded-full text-xs font-semibold text-slate-200 transition-colors">
                <Scissors size={14} className="text-emerald-400" /> Cut
              </button>
              <div className="w-px h-4 bg-slate-700 mx-1"></div>
              <button onClick={() => executeSelectionAction('delete')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/10 rounded-full text-xs font-semibold text-red-400 transition-colors">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>

        {/* Footer Status */}
        <div className="bg-slate-950 border-t border-slate-800 px-4 py-2 text-xs text-slate-500 font-mono flex justify-between">
          <span>{isDirty ? '● Unsaved Changes' : 'All saved'}</span>
          <span>{note.id.split('-')[0]}</span>
        </div>

        {/* --- UNSAVED CHANGES CONFIRMATION OVERLAY --- */}
        {showCloseConfirm && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center space-y-4 animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Belum Disimpan</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Anda memiliki perubahan yang belum disimpan. Ingin simpan sebelum keluar?
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={onClose}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors"
                >
                  Tutup Saja
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

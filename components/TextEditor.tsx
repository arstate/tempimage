
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Bold, Italic, Type, AlignLeft } from 'lucide-react';
import { StoredNote } from '../types';

interface TextEditorProps {
  note: StoredNote;
  onSave: (id: string, title: string, content: string) => void;
  onClose: () => void;
}

export const TextEditor: React.FC<TextEditorProps> = ({ note, onSave, onClose }) => {
  const [title, setTitle] = useState(note.title);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Set initial content
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = note.content;
    }
  }, []);

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleSave = () => {
    if (editorRef.current) {
      onSave(note.id, title, editorRef.current.innerHTML);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col border border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header / Toolbar */}
        <div className="bg-slate-950 border-b border-slate-800 p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-xl font-bold text-white focus:outline-none w-full placeholder-slate-500"
              placeholder="Judul Catatan..."
            />
            <div className="flex items-center gap-2 ml-4">
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors">
                <Save size={18} /> Simpan
              </button>
              <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
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
        <div className="flex-1 bg-white overflow-y-auto cursor-text" onClick={() => editorRef.current?.focus()}>
          <div 
            ref={editorRef}
            contentEditable
            className="min-h-full p-8 md:p-12 outline-none text-slate-900 text-lg leading-relaxed max-w-3xl mx-auto wysiwyg-content"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
          </div>
        </div>

        {/* Footer Status */}
        <div className="bg-slate-950 border-t border-slate-800 px-4 py-2 text-xs text-slate-500 font-mono flex justify-between">
          <span>WYSIWYG Mode</span>
          <span>{note.id.split('-')[0]}</span>
        </div>
      </div>
    </div>
  );
};

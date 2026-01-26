
import React, { useEffect, useState } from 'react';
import { FileText, Trash2, Edit3, ExternalLink } from 'lucide-react';
import { StoredNote } from '../types';

interface NoteCardProps {
  note: StoredNote;
  onClick: (note: StoredNote) => void;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onClick, onDelete }) => {
  const [previewText, setPreviewText] = useState<string>("Loading content...");
  const [isExternal, setIsExternal] = useState(false);

  useEffect(() => {
    // Check if content is a URL (Drive Integration)
    if (note.content.startsWith('http')) {
      setIsExternal(true);
      setPreviewText("Note stored in Drive. Click to view/download.");
      
      // Optional: Attempt to fetch if CORS allows (often blocked by Google Drive)
      // fetch(note.content).then(r => r.text()).then(t => setPreviewText(t)).catch(() => {});
    } else {
      // Local content
      setPreviewText(note.content.replace(/<[^>]+>/g, ' '));
    }
  }, [note.content]);

  return (
    <div 
      className="group relative bg-amber-50 rounded-xl overflow-hidden border border-amber-200/50 shadow-md transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer h-48 flex flex-col"
      onClick={() => onClick(note)}
    >
      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
          className="p-1.5 bg-white/80 hover:bg-red-50 text-red-400 rounded-lg shadow-sm border border-red-100"
          title="Delete Note"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 text-amber-600 mb-2">
          <FileText size={16} />
          <h3 className="font-bold text-slate-800 truncate text-sm">{note.title || 'Tanpa Judul'}</h3>
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-[11px] text-slate-600 leading-relaxed font-serif break-words">
            {previewText.substring(0, 150)}...
          </p>
        </div>
      </div>
      
      <div className="bg-amber-100/50 px-4 py-2 border-t border-amber-200/50 flex justify-between items-center text-[10px] text-amber-700/60 font-medium">
        <span>{isExternal ? 'DRIVE FILE' : 'LOCAL'}</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {isExternal ? <ExternalLink size={10} /> : <Edit3 size={10} />} 
          {isExternal ? 'Open' : 'Edit'}
        </span>
      </div>
    </div>
  );
};

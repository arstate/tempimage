
import React from 'react';
import { Trash2 } from 'lucide-react';
import { StoredNote } from '../types';

interface NoteCardProps {
  note: StoredNote;
  onClick: (note: StoredNote) => void;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onClick, onDelete }) => {
  return (
    <div 
      onClick={() => onClick(note)}
      className="relative group transition-transform hover:-translate-y-1 hover:shadow-lg"
      style={{
        width: "100%",
        height: "200px", // Fixed height for uniformity
        backgroundColor: "#fff9c4", // Sticky Note Yellow
        color: "#333",
        padding: "16px",
        borderRadius: "8px",
        boxShadow: "2px 2px 5px rgba(0,0,0,0.1)",
        cursor: "pointer",
        overflow: "hidden", 
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Delete Button (Hidden by default, shown on hover) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
          className="p-1.5 bg-white/50 hover:bg-red-500 hover:text-white text-red-500 rounded-full shadow-sm transition-colors"
          title="Hapus Catatan"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <h4 style={{ 
        margin: "0 0 10px 0", 
        borderBottom: "1px solid rgba(0,0,0,0.1)", 
        paddingBottom: "8px",
        fontWeight: "bold",
        fontSize: "0.9rem",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }}>
        📝 {note.title || "Tanpa Judul"}
      </h4>
      
      {/* Snippet Content */}
      <p style={{ 
        fontSize: "0.8rem", 
        whiteSpace: "pre-wrap", 
        lineHeight: "1.4",
        color: "#4b5563",
        flex: 1,
        overflow: "hidden"
      }}>
        {note.snippet || note.content || "Memuat preview..."}
      </p>
      
      {/* Fade effect at bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, 
        height: "40px", 
        background: "linear-gradient(transparent, #fff9c4)",
        pointerEvents: "none" 
      }} />
    </div>
  );
};

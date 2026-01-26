
import React from 'react';
import { Loader2, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

interface UploadWidgetProps {
  isVisible: boolean;
  onToggle: () => void;
  queueLength: number;
  currentFolder: string;
  currentFile: string;
  isProcessing: boolean;
}

export const UploadWidget: React.FC<UploadWidgetProps> = ({
  isVisible,
  onToggle,
  queueLength,
  currentFolder,
  currentFile,
  isProcessing
}) => {
  // Don't render anything if nothing is happening
  if (!isProcessing && queueLength === 0) return null;

  return (
    <div className={`fixed bottom-4 left-4 z-[100] transition-all duration-300 ${isVisible ? 'w-72' : 'w-auto'}`}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
        
        {/* Header Bar */}
        <div 
          className="bg-slate-800 p-3 flex items-center justify-between cursor-pointer hover:bg-slate-750"
          onClick={onToggle}
        >
          <div className="flex items-center gap-2">
            {isProcessing ? (
              <Loader2 size={16} className="text-blue-500 animate-spin" />
            ) : (
              <CheckCircle size={16} className="text-green-500" />
            )}
            {isVisible && <span className="text-xs font-bold text-white uppercase tracking-wider">Upload Progress</span>}
          </div>
          <button className="text-slate-400 hover:text-white transition-colors">
            {isVisible ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        {/* Content Area (Collapsible) */}
        {isVisible && (
          <div className="p-4 space-y-3">
            {isProcessing ? (
              <>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-mono">Target Folder</p>
                  <p className="text-sm font-semibold text-blue-400 truncate" title={currentFolder}>
                    {currentFolder}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-mono">Uploading File</p>
                  <p className="text-xs text-slate-300 truncate font-medium animate-pulse" title={currentFile}>
                    {currentFile}
                  </p>
                </div>

                {queueLength > 0 && (
                   <div className="pt-2 border-t border-slate-800 text-xs text-slate-500">
                     + {queueLength} files in queue
                   </div>
                )}
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-green-400">All uploads completed.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

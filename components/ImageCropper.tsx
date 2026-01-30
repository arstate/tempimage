
import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut, Move } from 'lucide-react';

interface ImageCropperProps {
  imageFile: File;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageFile, onCrop, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const CANVAS_SIZE = 300; // Ukuran tampilan canvas
  const EXPORT_SIZE = 512; // Ukuran hasil crop (HD Icon)

  useEffect(() => {
    const img = new Image();
    img.src = URL.createObjectURL(imageFile);
    img.onload = () => {
      setImage(img);
      // Fit image to canvas initially
      const minScale = CANVAS_SIZE / Math.min(img.width, img.height);
      setScale(minScale);
    };
    return () => {
        if (img.src) URL.revokeObjectURL(img.src);
    };
  }, [imageFile]);

  useEffect(() => {
    draw();
  }, [image, scale, position]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // Background (Dark)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw Image with Transform
    ctx.save();
    // Center logic
    ctx.translate(CANVAS_SIZE / 2 + position.x, CANVAS_SIZE / 2 + position.y);
    ctx.scale(scale, scale);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();

    // Draw Overlay (Circular or Rounded Rect mask visuals if needed, but we keep it full square 1:1)
    // Optional: Draw a subtle border to indicate crop area
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleZoom = (delta: number) => {
    setScale(prev => Math.max(0.1, prev + delta));
  };

  const handleSave = () => {
    if (!image) return;

    // Create an offscreen canvas for high-res export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_SIZE;
    exportCanvas.height = EXPORT_SIZE;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Calculate scaling factor between display canvas and export canvas
    const ratio = EXPORT_SIZE / CANVAS_SIZE;

    ctx.fillStyle = '#000000'; // Fallback bg (transparent ideally, but icons usually opaque)
    // Note: To support transparency, don't fillRect, but ensure original image has transparency.
    // ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

    ctx.save();
    // Apply same transforms scaled up
    ctx.translate((CANVAS_SIZE / 2 + position.x) * ratio, (CANVAS_SIZE / 2 + position.y) * ratio);
    ctx.scale(scale * ratio, scale * ratio);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();

    exportCanvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "icon_cropped.png", { type: "image/png" });
        onCrop(file);
      }
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 flex flex-col gap-6 w-full max-w-sm">
        <div className="flex justify-between items-center">
          <h3 className="text-white font-bold text-lg">Sesuaikan Icon (1:1)</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={20}/></button>
        </div>

        <div className="relative w-[300px] h-[300px] mx-auto bg-black/50 border-2 border-dashed border-slate-700 rounded-xl overflow-hidden cursor-move touch-none">
           <canvas 
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="w-full h-full object-contain"
           />
           <div className="absolute top-2 right-2 pointer-events-none text-white/20">
              <Move size={24}/>
           </div>
        </div>

        <div className="flex flex-col gap-2">
           <div className="flex items-center justify-between text-slate-400 text-xs px-1">
              <ZoomOut size={14}/>
              <span>Zoom</span>
              <ZoomIn size={14}/>
           </div>
           <input 
              type="range" 
              min="0.1" 
              max="5" 
              step="0.1" 
              value={scale} 
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full accent-blue-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
           />
        </div>

        <div className="flex gap-3">
           <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 font-bold text-sm hover:bg-slate-800 transition-colors">
             Batal
           </button>
           <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95">
             <Check size={16}/> Simpan
           </button>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { motion } from 'motion/react';

declare global {
  interface Window {
    Cropper: any;
  }
}

interface ImageCropperModalProps {
  imageUrl: string;
  onCancel: () => void;
  onConfirm: (croppedBase64: string, dataUrl: string) => void;
}

export function ImageCropperModal({ imageUrl, onCancel, onConfirm }: ImageCropperModalProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<any>(null);

  useEffect(() => {
    let cropperInstance: any = null;
    
    // Slight delay to ensure image is rendered and Cropper is available from CDN
    const initCropper = () => {
      if (imageRef.current && window.Cropper) {
        cropperInstance = new window.Cropper(imageRef.current, {
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.9,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: true,
          background: false,
        });
        cropperRef.current = cropperInstance;
      } else if (!window.Cropper) {
        setTimeout(initCropper, 100);
      }
    };

    initCropper();

    return () => {
      if (cropperInstance) {
        cropperInstance.destroy();
      }
    };
  }, [imageUrl]);

  const handleConfirm = () => {
    if (cropperRef.current) {
      const canvas = cropperRef.current.getCroppedCanvas();
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64Data = dataUrl.split(',')[1];
        onConfirm(base64Data, dataUrl);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-xl"
    >
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
        <img 
          ref={imageRef} 
          src={imageUrl} 
          alt="Crop target" 
          className="max-w-full max-h-full opacity-0"
          style={{ display: 'block' }}
        />
      </div>
      <div className="h-24 bg-[#09090B] border-t border-zinc-800/50 flex items-center justify-between px-6 shrink-0 safe-area-bottom">
        <button 
          onClick={onCancel}
          className="px-6 py-3.5 rounded-full bg-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-700 transition-colors flex items-center gap-2"
        >
          <X size={20} /> Hủy Bỏ
        </button>
        <button 
          onClick={handleConfirm}
          className="px-6 py-3.5 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
        >
          <Check size={20} /> Xác Nhận Cắt
        </button>
      </div>
    </motion.div>
  );
}

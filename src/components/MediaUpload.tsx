import { useRef, ChangeEvent } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';

export function MediaUpload({ 
  onMediaSelect 
}: { 
  onMediaSelect: (media: { data: string, mimeType: string, thumbnail: string }) => void 
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      
      // We pass the full dataURL as thumbnail for simplicity, 
      // though for large videos we might want an actual poster.
      // But for this use case, images are typical.
      onMediaSelect({ data: base64, mimeType: file.type, thumbnail: result });
    };
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-2">
      <input 
        type="file" 
        accept="image/*,video/mp4,video/webm" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        id="media-upload"
      />
      
      <button 
        onClick={() => fileInputRef.current?.click()}
        className="h-12 md:h-16 px-4 md:px-6 bg-zinc-800 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3 font-bold text-white hover:bg-zinc-700 transition-colors"
        aria-label="Tải lên hình ảnh/video"
      >
        <ImageIcon size={20} className="md:w-6 md:h-6" />
        <span className="hidden sm:inline text-sm md:text-base">Ảnh / Video</span>
      </button>

      {/* For mobile, adding 'capture' allows direct camera access */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        onChange={handleFileChange} 
        className="hidden" 
        id="camera-capture"
      />
      <button 
        onClick={() => document.getElementById('camera-capture')?.click()}
        className="h-12 w-12 md:h-16 md:w-16 bg-zinc-800 rounded-xl md:rounded-2xl flex items-center justify-center font-bold text-white hover:bg-zinc-700 transition-colors"
        aria-label="Chụp ảnh"
      >
        <Camera size={20} className="md:w-6 md:h-6" />
      </button>
    </div>
  );
}

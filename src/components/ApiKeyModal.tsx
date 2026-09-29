import { useState } from 'react';
import { X, Key } from 'lucide-react';

export function ApiKeyModal({ apiKey, setApiKey }: { apiKey: string, setApiKey: (k: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  const handleOpen = () => {
    setTempKey(apiKey);
    setIsOpen(true);
  };

  const handleSave = () => {
    setApiKey(tempKey);
    setIsOpen(false);
  };

  return (
    <>
      <button 
        onClick={handleOpen} 
        className={`p-1.5 rounded-full transition-colors ${apiKey ? 'text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-500/10' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
        aria-label="Cài đặt API Key"
      >
        <Key size={18} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-xl font-bold mb-3 text-zinc-900 dark:text-zinc-100">Cài đặt API Key</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
              Nhập khóa API của Google AI Studio để sử dụng dịch vụ. Nếu để trống, hệ thống sẽ dùng khóa mặc định.
            </p>
            
            <input 
              type="password"
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="Nhập API Key của bạn..."
              className="w-full p-4 text-sm bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400 rounded-xl mb-6 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 placeholder-zinc-400 dark:placeholder-zinc-600 font-mono"
            />
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleSave}
                className="w-full py-4 bg-blue-600 text-white text-sm font-bold rounded-xl active:scale-95 hover:bg-blue-700 transition-all uppercase tracking-wider shadow-sm"
              >
                Lưu cài đặt
              </button>
              
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full text-center py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 underline transition-colors"
              >
                Lấy Khóa API
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

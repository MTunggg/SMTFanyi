import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Loader2, X, Copy, Cpu, ArrowRightLeft, Clock, Trash2, Keyboard, Mic, Image as ImageIcon, Check, Sun, Moon } from 'lucide-react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ContextSelector, CONTEXT_OPTIONS } from './components/ContextSelector';
import { AudioRecorder } from './components/AudioRecorder';
import { MediaUpload } from './components/MediaUpload';
import { ImageCropperModal } from './components/ImageCropperModal';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    CryptoJS: any;
  }
}

type MediaState = { data: string; mimeType: string; thumbnail: string } | null;
type CropTargetState = { dataUrl: string; mimeType: string } | null;

type InputType = 'text' | 'audio' | 'image';

interface HistoryRecord {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: number;
  inputType: InputType;
  pinyin?: string;
}

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const ENCRYPTION_SECRET = "app_secret_key_v1_001";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSaveApiKey = (newKey: string) => {
    setApiKey(newKey);
    if (newKey && window.CryptoJS) {
      const encrypted = window.CryptoJS.AES.encrypt(newKey, ENCRYPTION_SECRET).toString();
      localStorage.setItem('userApiKey', encrypted);
    } else {
      localStorage.removeItem('userApiKey');
    }
  };

  const [context, setContext] = useState(CONTEXT_OPTIONS[0].id);
  const [textInput, setTextInput] = useState("");
  const [media, setMedia] = useState<MediaState>(null);
  const [cropTarget, setCropTarget] = useState<CropTargetState>(null);
  const [translationResult, setTranslationResult] = useState<{ translation: string, pinyin?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState<'vi-zh' | 'zh-vi'>('vi-zh');
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<{ text?: string, audio?: any, image?: any } | null>(null);
  
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastTranslatedInputRef = useRef<string>("");
  const hasConfirmedFallbackRef = useRef(false);

  const handleToggleDirection = () => {
    setDirection(prev => prev === 'vi-zh' ? 'zh-vi' : 'vi-zh');
    if (translationResult?.translation) {
      setTextInput(translationResult.translation);
      setTranslationResult(null);
    }
  };

  const confirmFallback = async () => {
    hasConfirmedFallbackRef.current = true;
    setShowFallbackModal(false);
    if (pendingPayload) {
      await performTranslation(pendingPayload);
      setPendingPayload(null);
    }
  };

  const cancelFallback = () => {
    setShowFallbackModal(false);
    setPendingPayload(null);
    setIsLoading(false);
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem('translationHistory');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history");
      }
    }

    const loadApiKey = () => {
      const encryptedKey = localStorage.getItem('userApiKey');
      if (encryptedKey && window.CryptoJS) {
        try {
          const decrypted = window.CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_SECRET).toString(window.CryptoJS.enc.Utf8);
          if (decrypted) {
            setApiKey(decrypted);
          } else {
            localStorage.removeItem('userApiKey');
            setApiKey("");
          }
        } catch (e) {
          localStorage.removeItem('userApiKey');
          setApiKey("");
        }
      } else {
        setApiKey("");
      }
    };

    if (document.readyState === 'complete') {
      loadApiKey();
    } else {
      window.addEventListener('load', loadApiKey);
      return () => window.removeEventListener('load', loadApiKey);
    }
  }, []);

  const handleSelectHistory = (item: HistoryRecord) => {
    setIsHistoryOpen(false);
    setTextInput(item.originalText || "");
    setTranslationResult({ translation: item.translatedText, pinyin: item.pinyin });
    setMedia(null);
  };

  const handleDeleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory(prev => {
      const newHistory = prev.filter(item => item.id !== id);
      localStorage.setItem('translationHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('translationHistory');
  };

  const performTranslation = async (payload: { text?: string, audio?: any, image?: any }) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError("");

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      
      let actualApiKey = apiKey;
      const encryptedKey = localStorage.getItem('userApiKey');
      if (encryptedKey && window.CryptoJS) {
        try {
          const decrypted = window.CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_SECRET).toString(window.CryptoJS.enc.Utf8);
          if (decrypted) {
            actualApiKey = decrypted;
          } else {
            localStorage.removeItem('userApiKey');
            setApiKey("");
            throw new Error("Dữ liệu khóa API bị lỗi, vui lòng nhập lại.");
          }
        } catch (e) {
          localStorage.removeItem('userApiKey');
          setApiKey("");
          throw new Error("Dữ liệu khóa API bị lỗi, vui lòng nhập lại.");
        }
      }

      if (actualApiKey) {
        headers["Authorization"] = `Bearer ${actualApiKey}`;
      }

      const response = await fetch("/api/translate", {
        method: "POST",
        headers,
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          text: payload.text,
          audio: payload.audio,
          image: payload.image ? { data: payload.image.data, mimeType: payload.image.mimeType } : undefined,
          context: context,
          direction,
          confirmedFallback: hasConfirmedFallbackRef.current
        })
      });

      const data = await response.json();

      if (response.status === 428 && data.requireConfirmation) {
        setPendingPayload(payload);
        setShowFallbackModal(true);
        return; // wait for user action
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Khóa API của bạn đã hết lượt dịch miễn phí. Vui lòng chờ 10 giây và thử lại hoặc đổi sang khoá khác");
        }
        throw new Error(data.error || "Có lỗi xảy ra");
      }
      
      if (data.original_text === "" && data.translation === "") {
        setError("Không nhận diện được giọng nói do tạp âm quá lớn, vui lòng thử lại");
        setTranslationResult(null);
        return;
      }

      if (payload.audio && data.original_text) {
        setTextInput(data.original_text);
        lastTranslatedInputRef.current = `${data.original_text.trim()}|${media ? 'media' : 'nomedia'}|${context}|${apiKey}|${direction}`;
      } else if (payload.text) {
        lastTranslatedInputRef.current = `${payload.text.trim()}|${media ? 'media' : 'nomedia'}|${context}|${apiKey}|${direction}`;
      }
      
      const inputType: InputType = payload.audio ? 'audio' : (payload.image ? 'image' : 'text');
      const originalText = data.original_text || payload.text || "";
      const translatedText = data.translation || "";
      const pinyinText = data.pinyin || "";
      
      const newRecord: HistoryRecord = {
        id: Date.now().toString(),
        originalText,
        translatedText,
        timestamp: Date.now(),
        inputType,
        pinyin: pinyinText
      };
      
      setHistory(prev => {
        const newHistory = [newRecord, ...prev].slice(0, 50);
        localStorage.setItem('translationHistory', JSON.stringify(newHistory));
        return newHistory;
      });

      setTranslationResult(data);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!textInput.trim() && !media) {
      setTranslationResult(null);
      lastTranslatedInputRef.current = "";
    }
  }, [textInput, media]);

  const handleTranslateText = async () => {
    if (!textInput.trim() && !media) return;
    await performTranslation({ text: textInput, image: media });
  };

  const handleAudioReady = async (audio: { data: string, mimeType: string }) => {
    await performTranslation({ audio });
  };

  const playAudio = () => {
    if (!translationResult || !translationResult.translation) return;
    const utterance = new SpeechSynthesisUtterance(translationResult.translation);
    
    // Attempt to guess language based on text. Basic heuristic:
    // If it contains Vietnamese characters, use vi-VN. If Chinese, zh-CN.
    const isVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(translationResult.translation);
    utterance.lang = isVietnamese ? 'vi-VN' : 'zh-CN';
    
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="min-h-screen w-full flex flex-col bg-zinc-50 dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300">
        {/* Header */}
        <header className="sticky top-0 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-[#09090B]/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/50 shrink-0 z-40 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-sm relative overflow-hidden shadow-sm">
              <span className="relative z-10">T</span>
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-400 to-transparent opacity-30"></div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-bold leading-none tracking-tight text-zinc-800 dark:text-zinc-100">Dịch Thuật Chuyên Nghiệp</h1>
              <div className="flex items-center gap-1 mt-1 text-[9px] text-zinc-500 font-mono uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
                Trực Tuyến
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="p-1 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => setIsHistoryOpen(true)} 
              className="p-1 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              aria-label="History"
            >
              <Clock size={18} />
            </button>
            <ApiKeyModal apiKey={apiKey} setApiKey={handleSaveApiKey} />
          </div>
        </header>

        {/* Main Content Split */}
        <main className="flex-1 flex flex-col gap-4 p-4 md:p-6 lg:max-w-4xl lg:mx-auto lg:w-full relative pb-32">
          <ContextSelector value={context} onChange={setContext} />
          
          <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-zinc-900/50 rounded-3xl border border-zinc-200 dark:border-zinc-800/50 mb-1 shadow-sm transition-colors duration-300">
            <span className={`font-semibold text-sm ${direction === 'vi-zh' ? 'text-zinc-800 dark:text-zinc-200' : 'text-blue-600 dark:text-blue-400'}`}>
              {direction === 'vi-zh' ? 'Tiếng Việt' : 'Tiếng Trung'}
            </span>
            <button
              onClick={handleToggleDirection}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-all active:scale-95 border border-zinc-200 dark:border-zinc-700/50 shadow-sm"
              aria-label="Đổi ngôn ngữ"
            >
              <ArrowRightLeft size={18} />
            </button>
            <span className={`font-semibold text-sm ${direction === 'zh-vi' ? 'text-zinc-800 dark:text-zinc-200' : 'text-blue-600 dark:text-blue-400'}`}>
              {direction === 'zh-vi' ? 'Tiếng Việt' : 'Tiếng Trung'}
            </span>
          </div>

          {/* Input Area */}
          <section className="bg-white dark:bg-[#18181B] rounded-3xl p-5 md:p-6 flex flex-col shadow-sm border border-zinc-200 dark:border-zinc-800/50 relative shrink-0 transition-colors duration-300 min-h-[150px]">
              <textarea
                ref={textareaRef}
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTranslateText();
                  }
                }}
                inputMode="text"
                enterKeyHint="send"
                placeholder="Nhập nội dung cần dịch..."
                className="w-full min-h-[120px] bg-transparent text-lg md:text-xl font-medium placeholder-zinc-400 dark:placeholder-zinc-600 resize-none focus:outline-none text-zinc-800 dark:text-zinc-100 overflow-hidden"
              />
            
            {textInput && (
              <button 
                onClick={() => {
                  setTextInput("");
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                  }
                }}
                className="absolute top-5 right-5 p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 bg-zinc-100 dark:bg-zinc-900/80 rounded-full transition-colors z-10"
              >
                <X size={16} />
              </button>
            )}

            {media && (
              <div className="relative w-20 h-20 mt-2 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700/50 shadow-sm z-10">
                {media.mimeType.startsWith('video') ? (
                  <video src={media.thumbnail} className="w-full h-full object-cover" />
                ) : (
                  <img src={media.thumbnail} className="w-full h-full object-cover" alt="Uploaded preview" />
                )}
                <button 
                  onClick={() => setMedia(null)}
                  className="absolute top-1 right-1 p-1 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 z-10">
              <MediaUpload onMediaSelect={(mediaObj) => {
                if (mediaObj.mimeType.startsWith('image/')) {
                  setCropTarget({ dataUrl: mediaObj.thumbnail, mimeType: mediaObj.mimeType });
                } else {
                  setMedia(mediaObj);
                }
              }} />
              
              <button
                onClick={handleTranslateText}
                disabled={isLoading || (!textInput.trim() && !media)}
                className="h-12 px-8 bg-blue-600 text-white rounded-full font-bold text-[13px] uppercase tracking-wide hover:bg-blue-700 disabled:opacity-50 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 transition-all active:scale-95 flex items-center justify-center min-w-[140px] shadow-sm"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Dịch Ngay"}
              </button>
            </div>
          </section>

          {/* Output Area */}
          <section className="output-container bg-white dark:bg-[#18181B] rounded-3xl flex flex-col shadow-sm border border-zinc-200 dark:border-zinc-800/50 transition-colors duration-300">
            {error ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-red-500 flex-1">
                <Cpu size={32} className="opacity-80" />
                <span className="text-sm font-semibold">{error}</span>
              </div>
            ) : translationResult ? (
              <div className="flex flex-col h-auto gap-3">
                  <div className="flex flex-col gap-3 pb-8 text-content-inner">
                    <span 
                      className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white leading-relaxed tracking-tight selection:bg-blue-500/30 block w-full"
                      style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word' }}
                    >
                      {translationResult.translation}
                    </span>
                    {direction === 'vi-zh' && translationResult.pinyin && (
                      <span 
                        className="text-base text-blue-600 dark:text-blue-400 font-medium block w-full"
                        style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word' }}
                      >
                        {translationResult.pinyin}
                      </span>
                    )}
                  </div>
                <div className="flex justify-end items-center gap-3 mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800/50 shrink-0 z-10">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(translationResult.translation);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 1000);
                    }}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors border shadow-sm ${
                      isCopied 
                        ? 'bg-green-50 dark:bg-green-500/20 text-green-600 dark:text-green-500 border-green-200 dark:border-green-500/30' 
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800/50'
                    }`}
                    aria-label="Sao chép"
                  >
                    {isCopied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                  <button 
                    onClick={playAudio}
                    className="w-11 h-11 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-200 dark:border-zinc-800/50 shadow-sm"
                    aria-label="Phát âm thanh"
                  >
                    <Volume2 size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-600 gap-3 flex-1">
                <span className="text-sm font-medium">Bản dịch sẽ hiển thị tại đây</span>
              </div>
            )}
          </section>
        </main>

        {/* Floating Audio Recorder (Bottom Center) */}
        <div className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <AudioRecorder onAudioReady={handleAudioReady} onError={setError} />
        </div>

        {/* Image Cropper Modal */}
        <AnimatePresence>
          {cropTarget && (
            <ImageCropperModal 
              imageUrl={cropTarget.dataUrl} 
              onCancel={() => setCropTarget(null)} 
              onConfirm={async (croppedBase64, dataUrl) => {
                const mediaObj = { data: croppedBase64, mimeType: cropTarget.mimeType, thumbnail: dataUrl };
                setMedia(mediaObj);
                setCropTarget(null);
                await performTranslation({ text: textInput, image: mediaObj });
              }} 
            />
          )}
        </AnimatePresence>

        {/* Fallback Confirmation Modal */}
        <AnimatePresence>
          {showFallbackModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
              >
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 pr-8">Sử dụng Google Dịch</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed">
                  Bạn đang không sử dụng API Key, hệ thống sẽ dịch bằng Google Dịch. Bạn có đồng ý tiếp tục?
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={cancelFallback}
                    className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700/50"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={confirmFallback}
                    className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md"
                  >
                    Xác nhận
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* History Drawer */}
        <AnimatePresence>
          {isHistoryOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 backdrop-blur-sm"
                onClick={() => setIsHistoryOpen(false)}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-full max-w-[340px] bg-zinc-50 dark:bg-[#121214] border-l border-zinc-200 dark:border-zinc-800 z-50 flex flex-col shadow-2xl"
              >
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-[#18181B]">
                  <h2 className="text-base font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                    <Clock size={18} className="text-blue-600 dark:text-blue-400" /> Lịch sử dịch thuật
                  </h2>
                  <button onClick={() => setIsHistoryOpen(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {history.length === 0 ? (
                     <div className="text-zinc-400 dark:text-zinc-500 text-center mt-10 text-sm font-medium">Chưa có lịch sử</div>
                  ) : (
                     history.map(item => (
                        <div 
                          key={item.id}
                          onClick={() => handleSelectHistory(item)}
                          className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 cursor-pointer hover:border-blue-300 dark:hover:border-zinc-600 hover:shadow-md dark:hover:shadow-none transition-all relative group"
                        >
                           <div className="flex justify-between items-start mb-3 gap-2">
                             <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500 text-[11px] uppercase tracking-wider font-semibold">
                                {item.inputType === 'text' && <Keyboard size={12} />}
                                {item.inputType === 'audio' && <Mic size={12} />}
                                {item.inputType === 'image' && <ImageIcon size={12} />}
                                <span>{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                             </div>
                             <button
                               onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                               className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-red-50 dark:hover:bg-zinc-800"
                             >
                                <Trash2 size={14} />
                             </button>
                           </div>
                           {item.originalText && <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-1 mb-2 font-medium">{item.originalText}</p>}
                           <p className="text-base font-bold text-zinc-900 dark:text-white line-clamp-2 leading-relaxed">{item.translatedText}</p>
                        </div>
                     ))
                  )}
                </div>
                
                {history.length > 0 && (
                   <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-white dark:bg-[#18181B]">
                      <button 
                        onClick={handleClearHistory}
                        className="w-full py-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded-2xl font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
                      >
                         <Trash2 size={18} /> Xóa toàn bộ lịch sử
                      </button>
                   </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

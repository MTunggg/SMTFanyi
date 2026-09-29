import React, { useState, useRef, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function AudioRecorder({ onAudioReady, onError }: { onAudioReady: (audio: { data: string, mimeType: string }) => void, onError?: (msg: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingStartTimeRef = useRef<number>(0);

  const startRecording = useCallback(async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Prevent double calling if already recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      mediaRecorder.onstop = () => {
        const duration = Date.now() - recordingStartTimeRef.current;
        stream.getTracks().forEach(track => track.stop());

        if (duration < 1000) {
          if (onError) {
            onError("Thời gian thu tiếng quá ngắn, vui lòng thử lại");
          }
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const base64 = base64data.split(',')[1];
          onAudioReady({ data: base64, mimeType: audioBlob.type || 'audio/webm' });
        };
      };

      mediaRecorder.start();
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Lỗi khi truy cập micro:", err);
      const msg = "Không thể truy cập micro. Vui lòng mở ứng dụng ở một tab mới hoặc cấp quyền micro trong trình duyệt.";
      if (onError) {
        onError(msg);
      } else {
        alert(msg);
      }
    }
  }, [onAudioReady, onError]);

  const stopRecording = useCallback((e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center relative pointer-events-auto">
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute -top-12 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] py-1.5 px-3 rounded-full font-mono tracking-widest uppercase flex items-center gap-2 shadow-lg border border-zinc-200 dark:border-zinc-700"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Đang lắng nghe
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex items-center justify-center">
        {isRecording && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }} transition={{ repeat: Infinity, duration: 1.2 }} className="absolute w-20 h-20 bg-blue-500/30 rounded-full" />
            <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="absolute w-20 h-20 bg-blue-500/20 rounded-full" />
          </div>
        )}
        
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerLeave={stopRecording}
          onPointerCancel={stopRecording}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'none' }}
          className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] border-4 border-zinc-100 dark:border-[#09090B] transition-colors touch-none select-none ${
            isRecording ? 'bg-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.5)]' : 'bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-400'
          }`}
          aria-label="Nhấn giữ để thu âm"
        >
          {isRecording ? <Square size={28} className="text-white fill-white" /> : <Mic size={32} className={isRecording ? 'text-white' : 'text-zinc-600 dark:text-zinc-400'} />}
        </motion.button>
      </div>
    </div>
  );
}


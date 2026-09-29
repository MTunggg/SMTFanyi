import { MessageCircle, Settings } from 'lucide-react';
import { motion } from 'motion/react';

export const CONTEXT_OPTIONS = [
  { id: 'casual', label: 'Giao Tiếp', icon: <MessageCircle size={18} /> },
  { id: 'work', label: 'Công Việc', icon: <Settings size={18} /> },
];

export function ContextSelector({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const isWork = value === 'work';

  return (
    <div className="flex bg-zinc-200/50 dark:bg-zinc-900/80 rounded-full p-1.5 w-full max-w-sm mx-auto shadow-inner border border-zinc-300/50 dark:border-zinc-800 relative h-[52px]">
      <div 
        className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white dark:bg-zinc-800 rounded-full shadow-md border border-zinc-200 dark:border-zinc-700/50 transition-all duration-300 ease-out"
        style={{ left: isWork ? 'calc(50% + 3px)' : '6px' }}
      />
      {CONTEXT_OPTIONS.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full transition-colors duration-300 relative z-10 ${
              isActive 
                ? 'text-blue-600 dark:text-blue-400 font-semibold' 
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 font-medium'
            }`}
          >
            <div>
              {opt.icon}
            </div>
            <span className="text-sm">{opt.label}</span>
          </button>
        )
      })}
    </div>
  );
}

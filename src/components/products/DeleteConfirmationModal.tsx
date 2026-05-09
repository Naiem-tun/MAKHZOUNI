import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmationModal({ isOpen, onClose, onConfirm }: DeleteConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-[280px] rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900 text-center border border-zinc-100 dark:border-zinc-800"
          >
            <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
              هل أنت متأكد من حذف هذا المنتج؟
            </p>

            <div className="flex gap-2">
              <button 
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px]"
                style={{ backgroundColor: '#B34C36' }}
              >
                تأكيد
              </button>
              <button 
                onClick={onClose}
                className="flex-1 rounded-xl bg-zinc-100 py-2.5 font-bold text-zinc-500 transition-all active:scale-95 text-[12px] dark:bg-zinc-800 dark:text-zinc-400"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

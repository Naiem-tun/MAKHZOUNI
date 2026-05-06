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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl dark:bg-zinc-900"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 left-6 text-zinc-400 hover:text-zinc-600"
            >
              <X size={20} />
            </button>
            
            <h2 className="mb-8 text-center text-xl font-black text-zinc-900 dark:text-white">
              تأكيد العملية
            </h2>

            <div className="mb-8 rounded-3xl border border-zinc-100 bg-zinc-50/50 p-10 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                هل أنت متأكد من حذف هذا المنتج؟
              </p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={onConfirm}
                className="w-full rounded-2xl bg-zinc-950 py-5 font-bold text-white shadow-xl transition-all hover:bg-zinc-900 active:scale-95 text-lg dark:bg-brand-600 dark:hover:bg-brand-700"
              >
                تأكيد
              </button>
              <button 
                onClick={onClose}
                className="w-full rounded-2xl border border-zinc-100 bg-white py-5 font-bold text-zinc-900 transition-all hover:bg-zinc-50 active:scale-95 text-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-700"
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

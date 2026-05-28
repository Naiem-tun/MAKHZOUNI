import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useModalBackButton } from '../../hooks/useModalBackButton';

interface CustomConfirmModalProps {
  show: boolean;
  message: string;
  type?: 'alert' | 'confirm';
  onConfirm?: () => void;
  onCancel: () => void;
}

export const CustomConfirmModal: React.FC<CustomConfirmModalProps> = ({
  show,
  message,
  type = 'alert',
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation();
  useModalBackButton(show, onCancel);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-[280px] bg-white dark:bg-zinc-900 rounded-lg p-6 shadow-2xl border border-zinc-100 dark:border-zinc-800 text-center"
          >
            <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
              {message}
            </p>
            
            <div className="flex gap-2">
              {type === 'confirm' ? (
                <>
                  <button 
                    onClick={() => {
                      onCancel();
                      if (onConfirm) onConfirm();
                    }}
                    className="flex-1 py-2.5 text-white rounded-lg text-[12px] font-black active:scale-95 transition-all shadow-lg shadow-[#B34C36]/20"
                    style={{ backgroundColor: '#B34C36' }}
                  >
                    {t('confirm')}
                  </button>
                  <button 
                    onClick={onCancel}
                    className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-[12px] font-bold active:scale-95 transition-all"
                  >
                    {t('cancel')}
                  </button>
                </>
              ) : (
                <button 
                  onClick={onCancel}
                  className="w-full py-2.5 bg-brand-500 text-white rounded-lg text-[12px] font-black active:scale-95 transition-all shadow-lg shadow-brand-500/20"
                >
                  {t('ok')}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

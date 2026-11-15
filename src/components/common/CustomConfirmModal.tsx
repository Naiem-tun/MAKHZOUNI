import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, X } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

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
  const { settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/55 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="relative w-full max-w-xs border shadow-2xl overflow-hidden text-right"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
          >
            <div
              className="px-4 py-3 border-b flex items-center justify-between"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="flex items-center gap-2 text-xs font-black" style={{ color: type === 'confirm' ? theme.negative : theme.accent }}>
                <AlertCircle size={14} />
                <span>{type === 'confirm' ? 'تأكيد الإجراء' : 'تنبيه'}</span>
              </div>
              <button
                type="button"
                onClick={onCancel}
                aria-label="إغلاق"
                className="p-1 border cursor-pointer"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <p className="text-[13px] font-bold leading-relaxed text-center" style={{ color: theme.text }}>
                {message}
              </p>

              <div className="flex gap-2">
                {type === 'confirm' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onCancel();
                        if (onConfirm) onConfirm();
                      }}
                      className="flex-1 py-2.5 border text-xs font-black transition-opacity hover:opacity-90 cursor-pointer"
                      style={{ backgroundColor: theme.negative, borderColor: theme.negative, color: '#FFFFFF' }}
                    >
                      {t('confirm')}
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      className="flex-1 py-2.5 border text-xs font-bold transition-colors cursor-pointer"
                      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
                    >
                      {t('cancel')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="w-full py-2.5 border text-xs font-black transition-opacity hover:opacity-90 cursor-pointer"
                    style={{ backgroundColor: theme.accent, borderColor: theme.accent, color: theme.accentText }}
                  >
                    {t('ok')}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

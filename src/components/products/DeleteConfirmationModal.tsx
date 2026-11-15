import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, X } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmationModal({ isOpen, onClose, onConfirm }: DeleteConfirmationModalProps) {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" dir="rtl" onClick={onClose}>
          <div
            className="relative w-full max-w-xs border shadow-2xl overflow-hidden text-right transition-colors"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-4 py-3 border-b flex items-center justify-between"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="flex items-center gap-2 text-xs font-black" style={{ color: theme.negative }}>
                <Trash2 size={14} />
                <span>تأكيد الحذف</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="p-1 border cursor-pointer"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <p className="text-[13px] font-bold leading-relaxed text-center" style={{ color: theme.text }}>
                {t('confirm_delete_product')}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onConfirm}
                  className="flex-1 py-2.5 border font-black text-xs transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: theme.negative, borderColor: theme.negative, color: '#FFFFFF' }}
                >
                  {t('confirm')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border font-bold text-xs transition-colors cursor-pointer"
                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

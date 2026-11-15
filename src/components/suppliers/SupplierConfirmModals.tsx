import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Archive, Trash2, X } from 'lucide-react';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface SupplierConfirmModalsProps {
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  deleteConfirmName: string;
  handleDeleteSupplier: () => void;

  deleteTxConfirmId: string | null;
  setDeleteTxConfirmId: (id: string | null) => void;
  handleDeleteTransaction: () => void;

  isClearAllConfirmOpen: boolean;
  setIsClearAllConfirmOpen: (open: boolean) => void;
  handleClearAllTransactions: () => void;
  handleArchiveCycle?: () => void;
  txCount?: number;

  isTotalModalOpen?: boolean;
  setIsTotalModalOpen?: (open: boolean) => void;
  grandTotal?: number;

  isSaving: boolean;
  settings: any;
}

export function SupplierConfirmModals({
  deleteConfirmId,
  setDeleteConfirmId,
  deleteConfirmName,
  handleDeleteSupplier,

  deleteTxConfirmId,
  setDeleteTxConfirmId,
  handleDeleteTransaction,

  isClearAllConfirmOpen,
  setIsClearAllConfirmOpen,
  handleClearAllTransactions,
  handleArchiveCycle,
  txCount = 0,

  isSaving,
  settings
}: SupplierConfirmModalsProps) {
  const { t } = useTranslation();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

  return (
    <>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div key="modal-delete-supplier" className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-[300px] border text-right shadow-2xl overflow-hidden"
              style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
            >
              <div
                className="px-4 py-3 border-b flex items-center justify-between"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <span className="text-xs font-black" style={{ color: theme.negative }}>تأكيد الحذف</span>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="p-1 border cursor-pointer"
                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-5 text-center">
                <p className="text-[13px] font-bold mb-5 leading-relaxed" style={{ color: theme.text }}>
                  {t('confirm_delete_supplier_desc')}{' '}
                  <span style={{ color: theme.negative }}>"{deleteConfirmName}"</span>{' '}
                  {settings.language === 'ar' ? '؟' : '?'} {t('confirm_delete_supplier_warning')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteSupplier}
                    disabled={isSaving}
                    className="flex-1 py-2.5 font-black text-white transition-opacity hover:opacity-90 text-[12px] disabled:opacity-50 cursor-pointer"
                    style={{ backgroundColor: theme.negative }}
                  >
                    {t('confirm')}
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-2.5 border text-[12px] font-bold transition-colors cursor-pointer"
                    style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Transaction Confirmation Modal */}
      <AnimatePresence>
        {deleteTxConfirmId && (
          <motion.div key="modal-delete-tx" className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTxConfirmId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-[300px] border text-right shadow-2xl overflow-hidden"
              style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
            >
              <div
                className="px-4 py-3 border-b flex items-center justify-between"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <span className="text-xs font-black" style={{ color: theme.negative }}>تأكيد حذف العملية</span>
                <button
                  type="button"
                  onClick={() => setDeleteTxConfirmId(null)}
                  className="p-1 border cursor-pointer"
                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-5 text-center">
                <p className="text-[13px] font-bold mb-5 leading-relaxed" style={{ color: theme.text }}>
                  {t('confirm_delete_operation')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteTransaction}
                    className="flex-1 py-2.5 font-black text-white transition-opacity hover:opacity-90 text-[12px] cursor-pointer"
                    style={{ backgroundColor: theme.negative }}
                  >
                    {t('confirm')}
                  </button>
                  <button
                    onClick={() => setDeleteTxConfirmId(null)}
                    className="flex-1 py-2.5 border text-[12px] font-bold transition-colors cursor-pointer"
                    style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear / Archive All Transactions Confirmation Modal */}
      <AnimatePresence>
        {isClearAllConfirmOpen && (
          <motion.div key="modal-clear-all" className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClearAllConfirmOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-sm border text-right shadow-2xl overflow-hidden"
              style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
            >
              <div
                className="px-5 py-4 border-b flex items-center justify-between"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 border"
                    style={{
                      color: theme.accent,
                      borderColor: `${theme.accent}45`,
                      backgroundColor: `${theme.accent}12`
                    }}
                  >
                    01
                  </span>
                  <div>
                    <h3 className="text-sm font-black" style={{ color: theme.text }}>
                      إغلاق دورة الموردين الحالية
                    </h3>
                    <p className="text-[11px]" style={{ color: theme.textMuted }}>
                      {txCount > 0 ? `يوجد ${txCount} معاملة مسجلة في هذه الدورة` : 'بدء دورة جديدة'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClearAllConfirmOpen(false)}
                  className="p-1.5 border cursor-pointer"
                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-5">
                <p className="text-xs leading-relaxed mb-4 font-bold" style={{ color: theme.textMuted }}>
                  ما الذي تفضل القيام به عند إغلاق هذه الدورة؟
                </p>

                <div className="space-y-2.5">
                  {/* Recommended Option: Archive and Reset */}
                  {handleArchiveCycle && (
                    <button
                      onClick={handleArchiveCycle}
                      disabled={isSaving || txCount === 0}
                      className="w-full p-3.5 font-bold text-xs transition-opacity hover:opacity-90 disabled:opacity-50 text-right flex items-start gap-3 cursor-pointer"
                      style={{ backgroundColor: theme.accent, color: theme.accentText }}
                    >
                      <Archive size={18} className="shrink-0 mt-0.5" />
                      <div>
                        <span className="block font-black">أرشفة الدورة وتصفير الشاشة (موصى به)</span>
                        <span className="block text-[10px] font-normal opacity-85 mt-0.5">
                          ينزل التقرير على هاتفك، يفرغ الشاشة لدورة نظيفة جديدة، ويحفظ البيانات لذاكرة الوكيل الذكي.
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Hard Delete Option */}
                  <button
                    onClick={handleClearAllTransactions}
                    disabled={isSaving}
                    className="w-full p-3 border font-bold text-xs transition-colors text-right flex items-center gap-2.5 cursor-pointer"
                    style={{
                      backgroundColor: `${theme.negative}10`,
                      borderColor: `${theme.negative}45`,
                      color: theme.negative
                    }}
                  >
                    <Trash2 size={16} className="shrink-0" />
                    <span>حذف نهائي بدون أرشفة (مسح تام)</span>
                  </button>

                  {/* Cancel */}
                  <button
                    onClick={() => setIsClearAllConfirmOpen(false)}
                    className="w-full py-2.5 border text-xs font-bold transition-colors text-center cursor-pointer"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text
                    }}
                  >
                    إلغاء والتراجع
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

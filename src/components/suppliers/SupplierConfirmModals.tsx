import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Archive, Trash2, Download, ShieldCheck, X } from 'lucide-react';

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

  return (
    <>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div key="modal-delete-supplier" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmId(null)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-[280px] rounded-lg bg-white p-6 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {t('confirm_delete_supplier_desc')} <span className="text-[#B34C36]">"{deleteConfirmName}"</span> {settings.language === 'ar' ? '؟' : '?'} {t('confirm_delete_supplier_warning')}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={handleDeleteSupplier}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-lg font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px] disabled:opacity-50"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  {t('confirm')}
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[12px] font-bold active:scale-95 transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Transaction Confirmation Modal */}
      <AnimatePresence>
        {deleteTxConfirmId && (
          <motion.div key="modal-delete-tx" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteTxConfirmId(null)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-[280px] rounded-lg bg-white p-6 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {t('confirm_delete_operation')}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={handleDeleteTransaction}
                  className="flex-1 py-2.5 rounded-lg font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px]"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  {t('confirm')}
                </button>
                <button 
                  onClick={() => setDeleteTxConfirmId(null)}
                  className="flex-1 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[12px] font-bold active:scale-95 transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear / Archive All Transactions Confirmation Modal */}
      <AnimatePresence>
        {isClearAllConfirmOpen && (
          <motion.div key="modal-clear-all" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsClearAllConfirmOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-sm rounded-lg bg-white p-6 dark:bg-zinc-900 text-right shadow-2xl border border-zinc-100 dark:border-zinc-800"
              dir="rtl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                  <Archive size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                    إغلاق دورة الموردين الحالية
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    {txCount > 0 ? `يوجد ${txCount} معاملة مسجلة في هذه الدورة` : 'بدء دورة جديدة'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-5">
                ما الذي تفضل القيام به عند إغلاق هذه الدورة؟
              </p>

              <div className="space-y-2.5">
                {/* Recommended Option: Archive and Reset */}
                {handleArchiveCycle && (
                  <button 
                    onClick={handleArchiveCycle}
                    disabled={isSaving || txCount === 0}
                    className="w-full p-3.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 text-right flex items-start gap-3"
                  >
                    <Archive size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="block font-black">أرشفة الدورة وتصفير الشاشة (موصى به)</span>
                      <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                        ينزل التقرير على هاتفك، يفرغ الشاشة لدورة نظيفة جديدة، ويحفظ البيانات لذاكرة الوكيل الذكي.
                      </span>
                    </div>
                  </button>
                )}

                {/* Hard Delete Option */}
                <button 
                  onClick={handleClearAllTransactions}
                  disabled={isSaving}
                  className="w-full p-3 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold text-xs transition-all active:scale-95 text-right flex items-center gap-2.5"
                >
                  <Trash2 size={16} className="shrink-0" />
                  <span>حذف نهائي بدون أرشفة (مسح تام)</span>
                </button>

                {/* Cancel */}
                <button 
                  onClick={() => setIsClearAllConfirmOpen(false)}
                  className="w-full py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold active:scale-95 transition-all text-center"
                >
                  إلغاء والتراجع
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

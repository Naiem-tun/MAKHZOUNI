import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

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

  isTotalModalOpen: boolean;
  setIsTotalModalOpen: (open: boolean) => void;
  grandTotal: number;

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

  isTotalModalOpen,
  setIsTotalModalOpen,
  grandTotal,

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

      {/* Clear All Transactions Confirmation Modal */}
      <AnimatePresence>
        {isClearAllConfirmOpen && (
          <motion.div key="modal-clear-all" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsClearAllConfirmOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-[280px] rounded-lg bg-white p-6 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {t('confirm_delete_all_operations')}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={handleClearAllTransactions}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-lg font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px] disabled:opacity-50"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  {t('confirm')}
                </button>
                <button 
                  onClick={() => setIsClearAllConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[12px] font-bold active:scale-95 transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Total Modal */}
      <AnimatePresence>
        {isTotalModalOpen && (
          <motion.div key="modal-total" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTotalModalOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-[320px] rounded-lg bg-white p-8 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <h2 className="text-zinc-500 dark:text-zinc-400 font-bold mb-2">{t('total_expenses')}</h2>
              <div className="flex items-center justify-center gap-2 mb-8">
                <span className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">
                  {grandTotal.toLocaleString(settings.language === 'ar' ? 'ar-TN' : 'en-US', { 
                    minimumFractionDigits: settings.currency === 'TND' || settings.currency === 'د.ت' ? 3 : 2, 
                    maximumFractionDigits: settings.currency === 'TND' || settings.currency === 'د.ت' ? 3 : 2 
                  })}
                </span>
                <span className="text-sm font-bold text-zinc-400 mt-2">{settings.currency}</span>
              </div>
              <button 
                onClick={() => setIsTotalModalOpen(false)}
                className="w-full py-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold active:scale-95 transition-all border border-zinc-200 dark:border-zinc-700"
              >
                {t('close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

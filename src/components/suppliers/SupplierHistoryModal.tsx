import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { History, X, Calendar, Trash2 } from 'lucide-react';
import { Supplier, SupplierTransaction } from '../../types';
import { safeParseDate, formatCurrency, formatAppDate } from '../../lib/utils';

interface SupplierHistoryModalProps {
  isHistoryModalOpen: boolean;
  setIsHistoryModalOpen: (open: boolean) => void;
  selectedSupplier: Supplier | null;
  transactions: SupplierTransaction[];
  settings: any;
  setDeleteTxConfirmId: (id: string) => void;
}

export function SupplierHistoryModal({
  isHistoryModalOpen,
  setIsHistoryModalOpen,
  selectedSupplier,
  transactions,
  settings,
  setDeleteTxConfirmId
}: SupplierHistoryModalProps) {
  const { t } = useTranslation();

  const supplierTx = selectedSupplier ? transactions
    .filter(t => t.supplierId === selectedSupplier.id)
    .sort((a, b) => {
      const dateA = safeParseDate(a.date);
      const dateB = safeParseDate(b.date);
      return dateB.getTime() - dateA.getTime();
    }) : [];

  const totalAmount = supplierTx.reduce((acc, tx) => acc + (tx.amount || 0), 0);

  return (
    <AnimatePresence>
      {isHistoryModalOpen && selectedSupplier && (
        <motion.div key="modal-history" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryModalOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg rounded-lg bg-white p-8 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                  <History size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t('operations_log')}</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-zinc-500">{selectedSupplier.name}</p>
                <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-lg text-zinc-500 font-bold">
                  {supplierTx.length} {t('operations')}
                </span>
              </div>
            </div>
          </div>
          <button onClick={() => setIsHistoryModalOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 scrollbar-hide">
          {supplierTx.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center text-brand-600 shadow-sm border border-zinc-100 dark:border-zinc-700">
                  <Calendar size={18} />
                </div>
                <div>
                  <div className="font-bold text-zinc-900 dark:text-white">{formatCurrency(tx.amount, settings.currency, settings.language)}</div>
                  <div className="text-[10px] text-zinc-400 capitalize">
                    {formatAppDate(safeParseDate(tx.date), settings.language, t, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  {tx.note && <div className="text-[10px] text-zinc-500 mt-0.5">{tx.note === 'session_purchases_total' ? t('session_purchases_total') : tx.note}</div>}
                </div>
              </div>
              <button 
                onClick={() => setDeleteTxConfirmId(tx.id!)}
                className="p-2 rounded-lg text-[#B34C36] hover:bg-[#B34C36]/5 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {supplierTx.length === 0 && (
            <div className="text-center py-12 text-zinc-400">
              <p className="text-sm">{t('no_expenses_waiting')}</p>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <span className="text-base font-bold text-zinc-500">{t('total_expenses')}</span>
          <span className="text-xl font-black text-zinc-900 dark:text-white">
            {formatCurrency(totalAmount, settings.currency, settings.language)}
          </span>
        </div>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

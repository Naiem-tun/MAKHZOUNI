import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CirclePlus } from 'lucide-react';
import { Supplier } from '../../types';

interface SupplierTransactionModalProps {
  isAddTxModalOpen: boolean;
  setIsAddTxModalOpen: (open: boolean) => void;
  selectedSupplier: Supplier | null;
  handleAddTransaction: (e: React.FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
  currency: string;
}

export function SupplierTransactionModal({
  isAddTxModalOpen,
  setIsAddTxModalOpen,
  selectedSupplier,
  handleAddTransaction,
  isSaving,
  currency
}: SupplierTransactionModalProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isAddTxModalOpen && selectedSupplier && (
        <motion.div key="modal-add-tx" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddTxModalOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md rounded-lg bg-white p-8 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600">
                <CirclePlus size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t('record_payment')}</h2>
                <p className="text-xs text-zinc-500">{t('suppliers')}: {selectedSupplier.name}</p>
              </div>
            </div>
            <form onSubmit={handleAddTransaction} className="space-y-4 text-right">
              <div>
                <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('purchase_price')}</label>
            <div className="relative">
              <input name="amount" type="number" step="0.001" placeholder="0.000" required className="w-full rounded-lg border bg-zinc-50 p-4 pr-12 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 font-mono text-lg" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">{currency}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('date')}</label>
            <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-lg border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700" />
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('notes')}</label>
            <input name="note" placeholder={t('record_payment_note_placeholder')} className="w-full rounded-lg border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setIsAddTxModalOpen(false)} className="flex-1 rounded-lg bg-zinc-100 py-3 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">{t('cancel')}</button>
            <button type="submit" disabled={isSaving} className="flex-1 rounded-lg py-3 font-semibold text-white shadow-lg shadow-[#B34C36]/20 disabled:opacity-50" style={{ backgroundColor: '#B34C36' }}>
              {isSaving ? t('saving') : t('confirm_payment')}
            </button>
          </div>
        </form>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { History, X, Calendar, Trash2, Archive } from 'lucide-react';
import { Supplier, SupplierTransaction } from '../../types';
import { safeParseDate, formatCurrency, formatAppDate } from '../../lib/utils';

interface SupplierHistoryModalProps {
  isHistoryModalOpen: boolean;
  setIsHistoryModalOpen: (open: boolean) => void;
  selectedSupplier: Supplier | null;
  transactions: SupplierTransaction[];
  activeTransactions?: SupplierTransaction[];
  settings: any;
  setDeleteTxConfirmId: (id: string) => void;
}

export function SupplierHistoryModal({
  isHistoryModalOpen,
  setIsHistoryModalOpen,
  selectedSupplier,
  transactions,
  activeTransactions = [],
  settings,
  setDeleteTxConfirmId
}: SupplierHistoryModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'current' | 'archived'>('current');

  // Active transactions for current open cycle
  const currentCycleTx = useMemo(() => {
    if (!selectedSupplier) return [];
    return activeTransactions
      .filter(t => t.supplierId === selectedSupplier.id)
      .sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());
  }, [selectedSupplier, activeTransactions]);

  // Previous archived transactions
  const archivedTx = useMemo(() => {
    if (!selectedSupplier) return [];
    const activeIds = new Set(currentCycleTx.map(t => t.id));
    return transactions
      .filter(t => t.supplierId === selectedSupplier.id && !activeIds.has(t.id))
      .sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());
  }, [selectedSupplier, transactions, currentCycleTx]);

  // Default to current cycle when opening
  useEffect(() => {
    if (isHistoryModalOpen) {
      setActiveTab('current');
    }
  }, [isHistoryModalOpen, selectedSupplier?.id]);

  const displayedTx = activeTab === 'current' ? currentCycleTx : archivedTx;
  const currentTotal = currentCycleTx.reduce((acc, tx) => acc + (tx.amount || 0), 0);
  const archivedTotal = archivedTx.reduce((acc, tx) => acc + (tx.amount || 0), 0);

  return (
    <AnimatePresence>
      {isHistoryModalOpen && selectedSupplier && (
        <motion.div key="modal-history" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setIsHistoryModalOpen(false)} 
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="relative w-full max-w-lg rounded-lg bg-white p-5 sm:p-7 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-right"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                  <History size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">{t('operations_log')}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs font-bold text-zinc-500">{selectedSupplier.name}</p>
                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-lg text-zinc-600 dark:text-zinc-400 font-bold border border-zinc-200 dark:border-zinc-700">
                      {currentCycleTx.length} {t('operations')} (الدورة الحالية)
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)} 
                className="h-9 w-9 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs for Current Cycle vs Archived Cycles */}
            {archivedTx.length > 0 && (
              <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1 mb-4 border border-zinc-200/60 dark:border-zinc-700/60">
                <button
                  type="button"
                  onClick={() => setActiveTab('current')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'current'
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  الدورة الحالية ({currentCycleTx.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('archived')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'archived'
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Archive size={12} />
                  <span>السجل المؤرشف ({archivedTx.length})</span>
                </button>
              </div>
            )}

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto space-y-2.5 pr-1 scrollbar-hide">
              {displayedTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center text-brand-600 shadow-sm border border-zinc-100 dark:border-zinc-700 shrink-0">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <div className="font-black text-sm text-zinc-900 dark:text-white">
                        {formatCurrency(tx.amount, settings.currency, settings.language)}
                      </div>
                      <div className="text-[10px] text-zinc-400 capitalize">
                        {formatAppDate(safeParseDate(tx.date), settings.language, t, { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {tx.note && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-200/50 dark:bg-zinc-700/50 px-1.5 py-0.5 rounded">
                            {tx.note === 'session_purchases_total' ? t('session_purchases_total') : tx.note}
                          </span>
                        )}
                        {activeTab === 'archived' && (
                          <span className="text-[9px] font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 px-1.5 py-0.5 rounded">
                            {tx.cycleName || 'دورة مؤرشفة'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDeleteTxConfirmId(tx.id!)}
                    className="p-2 rounded-lg text-[#B34C36] hover:bg-[#B34C36]/5 transition-colors"
                    title={t('delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {/* Empty State */}
              {displayedTx.length === 0 && (
                <div className="text-center py-10 px-4 text-zinc-400">
                  {activeTab === 'current' ? (
                    <div>
                      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        لا توجد معاملات مسجلة في الدورة الحالية
                      </p>
                      <p className="text-xs text-zinc-400 mb-3">
                        بدأت دورة جديدة بصفحة بيضاء نظيفة.
                      </p>
                      {archivedTx.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('archived')}
                          className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all inline-flex items-center gap-1.5"
                        >
                          <Archive size={12} />
                          <span>تصفح المعاملات المؤرشفة السابقة ({archivedTx.length})</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm">{t('no_expenses_waiting')}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <span className="text-xs sm:text-sm font-bold text-zinc-500">
                {activeTab === 'current' ? 'إجمالي معاملات الدورة الحالية' : 'إجمالي العمليات المؤرشفة'}
              </span>
              <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                {formatCurrency(activeTab === 'current' ? currentTotal : archivedTotal, settings.currency, settings.language)}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

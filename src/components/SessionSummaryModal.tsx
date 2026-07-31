import React from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { formatCurrency } from '../lib/utils';
import { useSessionManagement } from '../hooks/useSessionManagement';

export function SessionSummaryModal() {
  const { 
    user, 
    settings, 
    activeSupplier, 
    setActiveSupplier, 
    showToast, 
    isSessionSummaryOpen, 
    setIsSessionSummaryOpen 
  } = useAppContext();
  const { t } = useTranslation();

  const {
    sessionFinalTotal,
    setSessionFinalTotal,
    sessionDifference,
    setSessionDifference,
    recordAsExpense,
    setRecordAsExpense,
    isSavingSession,
    handleEndSessionConfirm
  } = useSessionManagement(
    user, 
    activeSupplier, 
    setActiveSupplier, 
    isSessionSummaryOpen, 
    setIsSessionSummaryOpen, 
    showToast, 
    t,
    settings
  );

  return (
    <AnimatePresence>
      {isSessionSummaryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsSessionSummaryOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-sm rounded-lg bg-white p-8 dark:bg-zinc-900 shadow-2xl border border-zinc-100 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-zinc-900 dark:text-white">{t('session_details')}</h2>
              <button 
                onClick={() => setIsSessionSummaryOpen(false)}
                className="h-10 w-10 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">{t('total_purchases_auto')}</label>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-2xl font-black text-zinc-900 dark:text-white text-center">
                  {formatCurrency(activeSupplier?.sessionTotal || 0, settings.currency)}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    {t('session_difference')}
                  </label>
                  {parseFloat(sessionDifference) > 0 && recordAsExpense && (
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/50 shrink-0">
                      {t('tax_expense_linked_hint')}
                    </span>
                  )}
                </div>
                <div className="relative flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 transition-all">
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={sessionDifference}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      setSessionDifference(valStr);
                      const valNum = parseFloat(valStr) || 0;
                      const autoTotal = activeSupplier?.sessionTotal || 0;
                      const newTotal = (autoTotal + valNum).toFixed(3);
                      setSessionFinalTotal(newTotal);
                    }}
                    className="w-full bg-transparent border-none p-4 font-black text-lg text-center focus:outline-none text-zinc-900 dark:text-white"
                  />
                  
                  <button
                    type="button"
                    onClick={() => setRecordAsExpense(!recordAsExpense)}
                    title={t('record_tax_as_expense')}
                    className="absolute left-3 p-1 rounded-md transition-all select-none active:scale-95"
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      recordAsExpense 
                        ? 'bg-amber-600 border-amber-600 text-white shadow-xs' 
                        : 'border-zinc-400 dark:border-zinc-500 bg-white dark:bg-zinc-800 text-transparent'
                    }`}>
                      {recordAsExpense && <Check size={13} strokeWidth={3.5} />}
                    </div>
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-500 text-center">{t('session_difference_hint')}</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">{t('final_amount_to_record')}</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0.000"
                  value={sessionFinalTotal}
                  onChange={(e) => {
                    const totalValStr = e.target.value;
                    setSessionFinalTotal(totalValStr);
                    const totalValNum = parseFloat(totalValStr) || 0;
                    const autoTotal = activeSupplier?.sessionTotal || 0;
                    const newDiff = (totalValNum - autoTotal).toFixed(3);
                    setSessionDifference(newDiff);
                  }}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg p-4 font-black text-lg focus:ring-2 focus:ring-brand-500 text-center transition-all focus:outline-none"
                />
                <p className="mt-2 text-xs text-zinc-500 text-center">{t('edit_amount_hint')}</p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleEndSessionConfirm}
                  disabled={isSavingSession}
                  className="w-full py-4 rounded-lg bg-brand-600 text-white font-black text-sm tracking-widest shadow-lg shadow-brand-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                  {isSavingSession ? <div className="animate-spin w-5 h-5 border-2 border-white rounded-full border-t-transparent mx-auto"></div> : t('save_and_end_session')}
                </button>
                  {(!sessionFinalTotal || parseFloat(sessionFinalTotal) <= 0) && (
                    <button
                      onClick={() => {
                         setActiveSupplier(null);
                         setIsSessionSummaryOpen(false);
                      }}
                      className="w-full mt-2 py-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold text-sm transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                       {t('end_session_without_saving') || 'إنهاء الجلسة بدون حفظ'}
                    </button>
                  )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

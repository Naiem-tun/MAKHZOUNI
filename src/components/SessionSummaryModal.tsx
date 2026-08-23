import React from 'react';
import { X, Check, Calendar, AlertCircle } from 'lucide-react';
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
    handleEndSessionConfirm,
    selectedDate,
    setSelectedDate,
    missedVisitDays,
    todayDate,
    todayDayName
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

  const formatDateDisplay = (d: Date) => {
    return d.toLocaleDateString(settings.language === 'en' ? 'en-US' : 'ar-TN', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

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
            className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 sm:p-7 dark:bg-zinc-900 shadow-2xl border border-zinc-100 dark:border-zinc-800 no-scrollbar"
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">{t('session_details')}</h2>
                {activeSupplier?.name && (
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-bold mt-0.5">{activeSupplier.name}</p>
                )}
              </div>
              <button 
                onClick={() => setIsSessionSummaryOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Date Selection Section (Smart Missed Visit detection) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Calendar size={14} className="text-brand-600" />
                    <span>تاريخ احتساب الفاتورة والزيارة</span>
                  </label>
                  {missedVisitDays.length > 0 && (
                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle size={10} />
                      زيارة فائتة
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {missedVisitDays.map((mv) => {
                    const isSelected = selectedDate.toDateString() === mv.date.toDateString();
                    return (
                      <button
                        key={mv.dayIndex}
                        type="button"
                        onClick={() => setSelectedDate(mv.date)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-right transition-all cursor-pointer ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 ring-2 ring-brand-500/20'
                            : 'border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-400'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold">
                              موعد الزيارة الفائتة: <span className="text-brand-600 dark:text-brand-400">{mv.dayName}</span>
                            </p>
                            <p className="text-[11px] text-zinc-500">{formatDateDisplay(mv.date)}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                          مقترح تلقائياً
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayDate)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-right transition-all cursor-pointer ${
                      selectedDate.toDateString() === todayDate.toDateString()
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 ring-2 ring-brand-500/20'
                        : 'border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedDate.toDateString() === todayDate.toDateString() ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-400'
                      }`}>
                        {selectedDate.toDateString() === todayDate.toDateString() && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold">اليوم الحالي ({todayDayName})</p>
                        <p className="text-[11px] text-zinc-500">{formatDateDisplay(todayDate)}</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{t('total_purchases_auto')}</label>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/80 rounded-lg text-xl font-black text-zinc-900 dark:text-white text-center border border-zinc-100 dark:border-zinc-700/50 font-mono">
                  {formatCurrency(activeSupplier?.sessionTotal || 0, settings.currency)}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {t('session_difference')}
                  </label>
                  {parseFloat(sessionDifference) > 0 && recordAsExpense && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/50 shrink-0">
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
                    className="w-full bg-transparent border-none p-3 font-black text-base text-center focus:outline-none text-zinc-900 dark:text-white font-mono"
                  />
                  
                  <button
                    type="button"
                    onClick={() => setRecordAsExpense(!recordAsExpense)}
                    title={t('record_tax_as_expense')}
                    className="absolute left-2.5 p-1 rounded-md transition-all select-none active:scale-95"
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
                <p className="mt-1 text-[11px] text-zinc-400 text-center">{t('session_difference_hint')}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">{t('final_amount_to_record')}</label>
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
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg p-3 font-black text-base focus:ring-2 focus:ring-brand-500 text-center transition-all focus:outline-none font-mono text-zinc-900 dark:text-white"
                />
                <p className="mt-1 text-[11px] text-zinc-400 text-center">{t('edit_amount_hint')}</p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleEndSessionConfirm}
                  disabled={isSavingSession}
                  className="w-full py-3.5 rounded-lg bg-brand-600 text-white font-bold text-sm shadow-md shadow-brand-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
                >
                  {isSavingSession ? <div className="animate-spin w-5 h-5 border-2 border-white rounded-full border-t-transparent mx-auto"></div> : t('save_and_end_session')}
                </button>
                {(!sessionFinalTotal || parseFloat(sessionFinalTotal) <= 0) && (
                  <button
                    onClick={() => {
                       setActiveSupplier(null);
                       setIsSessionSummaryOpen(false);
                    }}
                    className="w-full mt-2 py-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold text-xs transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
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

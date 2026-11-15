import React from 'react';
import { X, Check, Calendar, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { formatCurrency } from '../lib/utils';
import { useSessionManagement } from '../hooks/useSessionManagement';
import { useFolioTheme } from './folio/FolioPageChrome';

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
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsSessionSummaryOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="relative w-full max-w-sm max-h-[92vh] border shadow-2xl overflow-hidden flex flex-col transition-colors"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
            dir="rtl"
          >
            {/* Header */}
            <div
              className="px-4 py-3.5 sm:px-5 border-b flex items-center justify-between gap-3 shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="font-mono tabular-nums" style={{ color: theme.accent }}>01</span>
                  <span style={{ color: theme.textMuted }}>إغلاق حصة المورد</span>
                </div>
                <h2 className="text-base sm:text-lg font-black truncate" style={{ color: theme.text }}>
                  {t('session_details')}
                </h2>
                {activeSupplier?.name && (
                  <p className="text-xs font-bold truncate" style={{ color: theme.accent }}>
                    {activeSupplier.name}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsSessionSummaryOpen(false)}
                aria-label="إغلاق"
                className="p-1.5 border cursor-pointer shrink-0"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {/* Date Selection Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: theme.textMuted }}>
                    <Calendar size={13} style={{ color: theme.accent }} />
                    <span>تاريخ احتساب الفاتورة والزيارة</span>
                  </label>
                  {missedVisitDays.length > 0 && (
                    <span
                      className="text-[10px] font-black px-1.5 py-0.5 border flex items-center gap-1"
                      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.neutral, color: theme.neutral }}
                    >
                      <AlertCircle size={10} />
                      <span>زيارة فائتة</span>
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
                        className="w-full flex items-center justify-between p-3 border text-right transition-colors cursor-pointer"
                        style={{
                          backgroundColor: theme.surface,
                          borderColor: isSelected ? theme.accent : theme.border,
                          borderRight: isSelected ? `3px solid ${theme.accent}` : undefined,
                          color: theme.text,
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-4 h-4 border flex items-center justify-center shrink-0"
                            style={{
                              borderColor: isSelected ? theme.accent : theme.border,
                              backgroundColor: isSelected ? theme.accent : theme.surface,
                              color: theme.accentText,
                            }}
                          >
                            {isSelected && <Check size={11} strokeWidth={3} />}
                          </div>
                          <div>
                            <p className="text-xs font-bold">
                              موعد الزيارة الفائتة: <span style={{ color: theme.accent }}>{mv.dayName}</span>
                            </p>
                            <p className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>{formatDateDisplay(mv.date)}</p>
                          </div>
                        </div>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 border"
                          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.neutral, color: theme.neutral }}
                        >
                          مقترح تلقائياً
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayDate)}
                    className="w-full flex items-center justify-between p-3 border text-right transition-colors cursor-pointer"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: selectedDate.toDateString() === todayDate.toDateString() ? theme.accent : theme.border,
                      borderRight: selectedDate.toDateString() === todayDate.toDateString() ? `3px solid ${theme.accent}` : undefined,
                      color: theme.text,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 border flex items-center justify-center shrink-0"
                        style={{
                          borderColor: selectedDate.toDateString() === todayDate.toDateString() ? theme.accent : theme.border,
                          backgroundColor: selectedDate.toDateString() === todayDate.toDateString() ? theme.accent : theme.surface,
                          color: theme.accentText,
                        }}
                      >
                        {selectedDate.toDateString() === todayDate.toDateString() && <Check size={11} strokeWidth={3} />}
                      </div>
                      <div>
                        <p className="text-xs font-bold">اليوم الحالي ({todayDayName})</p>
                        <p className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>{formatDateDisplay(todayDate)}</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: theme.textMuted }}>{t('total_purchases_auto')}</label>
                <div
                  className="p-3 border text-xl font-black text-center font-mono tabular-nums"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                >
                  {formatCurrency(activeSupplier?.sessionTotal || 0, settings.currency)}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <label className="text-xs font-bold" style={{ color: theme.textMuted }}>
                    {t('session_difference')}
                  </label>
                  {parseFloat(sessionDifference) > 0 && recordAsExpense && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 border shrink-0"
                      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.neutral, color: theme.neutral }}
                    >
                      {t('tax_expense_linked_hint')}
                    </span>
                  )}
                </div>
                <div
                  className="relative flex items-center border overflow-hidden"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
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
                    className="w-full bg-transparent border-none p-3 font-black text-base text-center focus:outline-none font-mono tabular-nums"
                    style={{ color: theme.text }}
                  />

                  <button
                    type="button"
                    onClick={() => setRecordAsExpense(!recordAsExpense)}
                    title={t('record_tax_as_expense')}
                    className="absolute left-2.5 p-1 cursor-pointer select-none"
                  >
                    <div
                      className="w-5 h-5 border flex items-center justify-center transition-colors"
                      style={{
                        backgroundColor: recordAsExpense ? theme.neutral : theme.surfaceMuted,
                        borderColor: recordAsExpense ? theme.neutral : theme.border,
                        color: '#FFFFFF',
                      }}
                    >
                      {recordAsExpense && <Check size={13} strokeWidth={3.5} />}
                    </div>
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-center" style={{ color: theme.textMuted }}>{t('session_difference_hint')}</p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: theme.textMuted }}>{t('final_amount_to_record')}</label>
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
                  className="w-full border p-3 font-black text-base text-center focus:outline-none font-mono tabular-nums"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.accent }}
                />
                <p className="mt-1 text-[11px] text-center" style={{ color: theme.textMuted }}>{t('edit_amount_hint')}</p>
              </div>

              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  onClick={handleEndSessionConfirm}
                  disabled={isSavingSession}
                  className="w-full py-3.5 border font-black text-sm disabled:opacity-50 cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: theme.accent, borderColor: theme.accent, color: theme.accentText }}
                >
                  {isSavingSession ? <div className="animate-spin w-5 h-5 border-2 border-current rounded-full border-t-transparent mx-auto" /> : t('save_and_end_session')}
                </button>
                {(!sessionFinalTotal || parseFloat(sessionFinalTotal) <= 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSupplier(null);
                      setIsSessionSummaryOpen(false);
                    }}
                    className="w-full py-2.5 border font-bold text-xs cursor-pointer transition-colors"
                    style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
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

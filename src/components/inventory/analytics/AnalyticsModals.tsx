import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle2 } from 'lucide-react';
import { formatCurrency, safeParseDate, formatAppDate, formatQuantityWithGrouping } from '../../../lib/utils';
import { UserSettings } from '../../../types';
import { ParetoAnalysis, MarginSqueezeAnalysis } from './types';
import { useFolioTheme } from '../../folio/FolioPageChrome';

interface AnalyticsModalsProps {
  showCycleExplainer: boolean;
  setShowCycleExplainer: (show: boolean) => void;
  showParetoModal: boolean;
  setShowParetoModal: (show: boolean) => void;
  showMarginSqueezeModal: boolean;
  setShowMarginSqueezeModal: (show: boolean) => void;
  elapsedDays: number;
  currentReport: any;
  previousReport: any;
  paretoProfitAnalysis: ParetoAnalysis;
  marginSqueezeAnalysis: MarginSqueezeAnalysis;
  settings: UserSettings;
}

export const AnalyticsModals: React.FC<AnalyticsModalsProps> = ({
  showCycleExplainer,
  setShowCycleExplainer,
  showParetoModal,
  setShowParetoModal,
  showMarginSqueezeModal,
  setShowMarginSqueezeModal,
  elapsedDays,
  currentReport,
  previousReport,
  paretoProfitAnalysis,
  marginSqueezeAnalysis,
  settings,
}) => {
  const { t } = useTranslation();
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

  return (
    <>
      {/* Modal 1: شرح كيفية احتساب مدة الاستهلاك وسرعة النفاد */}
      <AnimatePresence>
        {showCycleExplainer && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
            dir="rtl"
            onClick={() => setShowCycleExplainer(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg max-h-[90vh] flex flex-col border shadow-2xl text-right z-10 overflow-hidden"
              style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
            >
              {/* Sticky Header */}
              <div
                className="px-5 py-4 border-b flex items-center justify-between sticky top-0 z-10 shrink-0"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 border shrink-0"
                    style={{
                      color: theme.accent,
                      borderColor: `${theme.accent}45`,
                      backgroundColor: `${theme.accent}12`
                    }}
                  >
                    01
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black truncate" style={{ color: theme.text }}>
                      آلية احتساب مدة الاستهلاك وسرعة النفاد
                    </h3>
                    <p className="text-[11px] truncate" style={{ color: theme.textMuted }}>
                      مرونة تامة تتكيف مع تواريخ الجرد الحقيقية في محلك
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCycleExplainer(false)}
                  className="p-1.5 border flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 min-h-0 overflow-y-auto">
                {/* Dynamic Timeline Card */}
                <div
                  className="border p-3.5 space-y-3"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between text-xs font-bold" style={{ color: theme.text }}>
                    <span>المخطط الزمني الفعلي لهذه الدورة:</span>
                    <span className="font-mono font-black tabular-nums" style={{ color: theme.accent }}>
                      {elapsedDays} يوماً بالتمام
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div
                      className="p-2.5 border"
                      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                    >
                      <span className="text-[10px] block font-medium" style={{ color: theme.textMuted }}>الجرد السابق</span>
                      <span className="text-xs font-black" style={{ color: theme.text }}>
                        {previousReport
                          ? formatAppDate(safeParseDate(previousReport.date), 'ar', t, { day: 'numeric', month: 'long', year: 'numeric' })
                          : 'أول جرد'}
                      </span>
                    </div>
                    <div
                      className="p-2.5 border"
                      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                    >
                      <span className="text-[10px] block font-medium" style={{ color: theme.textMuted }}>الجرد الحالي</span>
                      <span className="text-xs font-black" style={{ color: theme.accent }}>
                        {currentReport
                          ? formatAppDate(safeParseDate(currentReport.date), 'ar', t, { day: 'numeric', month: 'long', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
                    <strong style={{ color: theme.text }}>ليونة كاملة:</strong> التطبيق لا يفرض شهراً ثابتاً من 30 يوماً؛ بل يطرح التاريخين من بعضهما في الروزنامة بدقة. إذا أجريت الجرد القادم بعد 15 يوماً سيحسب 15 يوماً، وإذا أجريته بعد 40 يوماً سيحسب 40 يوماً.
                  </p>
                </div>

                {/* The Two Equations */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black" style={{ color: theme.text }}>
                    كيف يستفيد محلك من هذه المدة الحقيقية؟
                  </h4>

                  <div
                    className="p-3 border space-y-1"
                    style={{
                      backgroundColor: `${theme.accent}10`,
                      borderColor: `${theme.accent}40`
                    }}
                  >
                    <div className="text-xs font-black" style={{ color: theme.accent }}>
                      1. قياس معدل السحب اليومي الحقيقي:
                    </div>
                    <p className="text-[11px] font-mono font-bold" style={{ color: theme.text }}>
                      معدل السحب اليومي = الكمية المباعة بين الجردين ÷ {elapsedDays} يوماً
                    </p>
                    <p className="text-[10px]" style={{ color: theme.textMuted }}>
                      يعرف بدقة كم قطعة يشتريها الزبائن من كل سلعة في اليوم الواحد.
                    </p>
                  </div>

                  <div
                    className="p-3 border space-y-1"
                    style={{
                      backgroundColor: `${theme.positive}10`,
                      borderColor: `${theme.positive}40`
                    }}
                  >
                    <div className="text-xs font-black" style={{ color: theme.positive }}>
                      2. التنبؤ بموعد نفاد الرفوف:
                    </div>
                    <p className="text-[11px] font-mono font-bold" style={{ color: theme.text }}>
                      أيام بقاء المخزون = الرصيد المتوفر اليوم ÷ معدل السحب اليومي
                    </p>
                    <p className="text-[10px]" style={{ color: theme.textMuted }}>
                      يحميك من نفاد السلع المطلوبة فجأة وينبهك بتجهيز الطلبيات قبل نفادها.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="px-5 py-3.5 border-t shrink-0"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <button
                  type="button"
                  onClick={() => setShowCycleExplainer(false)}
                  className="w-full py-2.5 font-bold text-xs transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: theme.accent, color: theme.accentText }}
                >
                  فهمت ذلك، إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: كارت قاعدة 80/20 للأرباح (Golden Profit Drivers) */}
      <AnimatePresence>
        {showParetoModal && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
            dir="rtl"
            onClick={() => setShowParetoModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[90vh] flex flex-col border shadow-2xl text-right z-10 overflow-hidden"
              style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
            >
              {/* Sticky Header */}
              <div
                className="px-5 py-4 border-b flex items-center justify-between sticky top-0 z-10 shrink-0"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 border shrink-0"
                    style={{
                      color: theme.neutral,
                      borderColor: `${theme.neutral}45`,
                      backgroundColor: `${theme.neutral}12`
                    }}
                  >
                    02
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black truncate" style={{ color: theme.text }}>
                      قائمة السلع الذهبية (قاعدة 80/20 للأرباح)
                    </h3>
                    <p className="text-[11px] truncate" style={{ color: theme.textMuted }}>
                      السلع المسؤولة عن أكثر من {paretoProfitAnalysis.profitSharePct}% من أرباح المتجر الصافية
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowParetoModal(false)}
                  className="p-1.5 border flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 min-h-0 overflow-y-auto">
                {/* Summary Stats Strip */}
                <div
                  className="grid grid-cols-3 border divide-x divide-x-reverse text-center"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <div className="p-3" style={{ borderColor: theme.border }}>
                    <span className="text-[10px] block font-bold" style={{ color: theme.textMuted }}>عدد السلع الذهبية</span>
                    <span className="text-base font-mono font-black tabular-nums" style={{ color: theme.neutral }}>
                      {paretoProfitAnalysis.topItemsCount} صنف
                    </span>
                  </div>
                  <div className="p-3" style={{ borderColor: theme.border }}>
                    <span className="text-[10px] block font-bold" style={{ color: theme.textMuted }}>إجمالي أرباحها الصافية</span>
                    <span className="text-base font-mono font-black tabular-nums" style={{ color: theme.neutral }}>
                      {!showFinancials ? '••••••' : formatCurrency(paretoProfitAnalysis.topItemsProfit, settings.currency, language)}
                    </span>
                  </div>
                  <div className="p-3" style={{ borderColor: theme.border }}>
                    <span className="text-[10px] block font-bold" style={{ color: theme.textMuted }}>حصة الأرباح الإجمالية</span>
                    <span className="text-base font-mono font-black tabular-nums" style={{ color: theme.positive }}>
                      {paretoProfitAnalysis.profitSharePct}%
                    </span>
                  </div>
                </div>

                {/* Table of Golden Items */}
                <div
                  className="overflow-x-auto border pb-1 scrollbar-thin"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <table className="w-full min-w-[560px] text-right text-xs">
                    <thead
                      className="font-bold border-b"
                      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
                    >
                      <tr>
                        <th className="p-2.5 w-10 text-center whitespace-nowrap">#</th>
                        <th className="p-2.5 min-w-[150px] whitespace-nowrap">السلعة الذهبية</th>
                        <th className="p-2.5 text-center min-w-[90px] whitespace-nowrap">المباع</th>
                        <th className="p-2.5 text-center min-w-[100px] whitespace-nowrap">سعر البيع</th>
                        <th className="p-2.5 text-center min-w-[100px] whitespace-nowrap">الربح الصافي</th>
                        <th className="p-2.5 text-left pl-3 min-w-[110px] whitespace-nowrap">الرصيد المتبقي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: theme.border }}>
                      {paretoProfitAnalysis.topItems.map((item, idx) => {
                        const stockColor = item.currentStock <= 0 || item.daysUntilStockout <= 5 ? theme.negative : theme.positive;
                        return (
                          <tr key={idx} className="transition-colors" style={{ borderColor: theme.border }}>
                            <td className="p-2.5 text-[11px] font-mono font-bold tabular-nums text-center whitespace-nowrap" style={{ color: theme.neutral }}>
                              {idx + 1}
                            </td>
                            <td className="p-2.5">
                              <span className="font-bold block" style={{ color: theme.text }}>{item.name}</span>
                              <span className="text-[10px]" style={{ color: theme.textMuted }}>{item.category}</span>
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold tabular-nums whitespace-nowrap" style={{ color: theme.text }}>
                              {formatQuantityWithGrouping(item.soldQty)}
                            </td>
                            <td className="p-2.5 text-center font-mono tabular-nums font-medium whitespace-nowrap" style={{ color: theme.textMuted }}>
                              {!showFinancials ? '••••••' : formatCurrency(item.sellPrice, settings.currency, language)}
                            </td>
                            <td className="p-2.5 text-center font-mono tabular-nums font-black whitespace-nowrap" style={{ color: theme.neutral }}>
                              {!showFinancials ? '••••••' : formatCurrency(item.profit, settings.currency, language)}
                            </td>
                            <td className="p-2.5 text-left pl-3 whitespace-nowrap">
                              <span
                                className="px-2 py-0.5 border text-[10px] font-mono font-bold tabular-nums whitespace-nowrap"
                                style={{
                                  color: stockColor,
                                  borderColor: `${stockColor}45`,
                                  backgroundColor: `${stockColor}12`
                                }}
                              >
                                {formatQuantityWithGrouping(item.currentStock)} ق ({item.daysUntilStockout} يوم)
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                className="px-5 py-3.5 border-t shrink-0"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <button
                  type="button"
                  onClick={() => setShowParetoModal(false)}
                  className="w-full py-2.5 font-bold text-xs transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: theme.accent, color: theme.accentText }}
                >
                  إغلاق القائمة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 3: كارت كشف تآكل الأرباح بسبب أسعار الموردين (Margin Squeeze Alert) */}
      <AnimatePresence>
        {showMarginSqueezeModal && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
            dir="rtl"
            onClick={() => setShowMarginSqueezeModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[90vh] flex flex-col border shadow-2xl text-right z-10 overflow-hidden"
              style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
            >
              {/* Sticky Header */}
              <div
                className="px-5 py-4 border-b flex items-center justify-between sticky top-0 z-10 shrink-0"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 border shrink-0"
                    style={{
                      color: marginSqueezeAnalysis.count > 0 ? theme.negative : theme.positive,
                      borderColor: marginSqueezeAnalysis.count > 0 ? `${theme.negative}45` : `${theme.positive}45`,
                      backgroundColor: marginSqueezeAnalysis.count > 0 ? `${theme.negative}12` : `${theme.positive}12`
                    }}
                  >
                    03
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black truncate" style={{ color: theme.text }}>
                      رادار كشف تآكل الأرباح (زيادات أسعار الموردين)
                    </h3>
                    <p className="text-[11px] truncate" style={{ color: theme.textMuted }}>
                      السلع التي زادت تكلفتها أو تقلص هامش ربحها وتتطلب تعديل سعر البيع
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMarginSqueezeModal(false)}
                  className="p-1.5 border flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 min-h-0 overflow-y-auto">
                {marginSqueezeAnalysis.count > 0 ? (
                  <>
                    <div
                      className="p-3.5 border flex items-center justify-between gap-3"
                      style={{
                        backgroundColor: `${theme.negative}10`,
                        borderColor: `${theme.negative}45`
                      }}
                    >
                      <div>
                        <span className="text-xs font-bold block" style={{ color: theme.negative }}>
                          تم رصد {marginSqueezeAnalysis.count} سلع متوفرة في المحل ارتفعت تكلفتها
                        </span>
                        <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                          سلع موجودة على الرف حالياً (كمية &gt; 0) تتطلب تعديل سعر البيع لعدم تآكل الربح
                        </p>
                      </div>
                      <div className="text-left font-mono shrink-0 pr-2">
                        <span className="text-[10px] block whitespace-nowrap" style={{ color: theme.textMuted }}>فارق أرباح مهدد</span>
                        <span className="text-base font-black tabular-nums whitespace-nowrap" style={{ color: theme.negative }}>
                          {!showFinancials ? '••••••' : formatCurrency(marginSqueezeAnalysis.totalEstimatedLoss, settings.currency, language)}
                        </span>
                      </div>
                    </div>

                    <div
                      className="overflow-x-auto border pb-1 scrollbar-thin"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                    >
                      <table className="w-full min-w-[620px] text-right text-xs">
                        <thead
                          className="font-bold border-b"
                          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
                        >
                          <tr>
                            <th className="p-2.5 min-w-[140px] whitespace-nowrap">السلعة</th>
                            <th className="p-2.5 text-center min-w-[90px] whitespace-nowrap">المتوفر بالمتجر</th>
                            <th className="p-2.5 text-center min-w-[120px] whitespace-nowrap">سعر التكلفة الجديد</th>
                            <th className="p-2.5 text-center min-w-[95px] whitespace-nowrap">سعر البيع الحالي</th>
                            <th className="p-2.5 text-center min-w-[75px] whitespace-nowrap">الهامش الحالي</th>
                            <th className="p-2.5 text-left pl-3 min-w-[125px] whitespace-nowrap">السعر المقترح للبيع</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: theme.border }}>
                          {marginSqueezeAnalysis.items.map((it, idx) => (
                            <tr key={idx} className="transition-colors" style={{ borderColor: theme.border }}>
                              <td className="p-2.5">
                                <span className="font-bold block" style={{ color: theme.text }}>{it.name}</span>
                                <span className="text-[10px]" style={{ color: theme.textMuted }}>{it.category}</span>
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <span
                                  className="px-2 py-0.5 border text-[11px] font-mono font-bold tabular-nums"
                                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
                                >
                                  {formatQuantityWithGrouping(it.unitsSoldOrStock)} قطعة
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-mono tabular-nums font-bold whitespace-nowrap" style={{ color: theme.text }}>
                                <div>{!showFinancials ? '••••••' : formatCurrency(it.currentCost, settings.currency, language)}</div>
                                {it.costDiff > 0 && (
                                  <span className="text-[10px] font-bold block mt-0.5" style={{ color: theme.negative }}>
                                    (+{!showFinancials ? '•••' : formatCurrency(it.costDiff, settings.currency, language)} زيادة)
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center font-mono tabular-nums font-bold whitespace-nowrap" style={{ color: theme.text }}>
                                {!showFinancials ? '••••••' : formatCurrency(it.sellingPrice, settings.currency, language)}
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <span
                                  className="px-2 py-0.5 border text-[10px] font-mono font-black tabular-nums"
                                  style={{
                                    color: theme.negative,
                                    borderColor: `${theme.negative}45`,
                                    backgroundColor: `${theme.negative}12`
                                  }}
                                >
                                  {it.currentMarginPct}%
                                </span>
                              </td>
                              <td className="p-2.5 text-left pl-3 whitespace-nowrap">
                                <span
                                  className="px-2.5 py-1 border text-xs font-mono font-black tabular-nums inline-block"
                                  style={{
                                    color: theme.positive,
                                    borderColor: `${theme.positive}45`,
                                    backgroundColor: `${theme.positive}12`
                                  }}
                                >
                                  {!showFinancials ? '••••••' : formatCurrency(it.suggestedSellingPrice, settings.currency, language)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div
                      className="p-3 border text-[11px] flex items-start gap-2"
                      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
                    >
                      <span className="font-bold shrink-0" style={{ color: theme.text }}>آلية التسعير المقترح:</span>
                      <span>
                        يقوم النظام بعكس فارق زيادة المورد الحقيقي مباشرة على سعر بيعك (التكلفة الجديدة - التكلفة السابقة)، دون أي مضاعفات، لضمان استرداد كامل الزيادة وحماية هامش ربحك الصافي.
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="py-10 text-center space-y-2" style={{ color: theme.textMuted }}>
                    <CheckCircle2 size={36} className="mx-auto" style={{ color: theme.positive }} />
                    <p className="text-sm font-bold" style={{ color: theme.text }}>جميع الأسعار متزنة ومحمية</p>
                    <p className="text-xs">لم يتم رصد أي تآكل خطير في هوامش الربح في هذه الدورة.</p>
                  </div>
                )}
              </div>

              <div
                className="px-5 py-3.5 border-t shrink-0"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <button
                  type="button"
                  onClick={() => setShowMarginSqueezeModal(false)}
                  className="w-full py-2.5 border font-bold text-xs transition-colors cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text
                  }}
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

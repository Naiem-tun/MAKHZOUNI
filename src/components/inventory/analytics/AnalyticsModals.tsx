import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Clock, X, Crown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCurrency, safeParseDate, formatAppDate, formatQuantityWithGrouping } from '../../../lib/utils';
import { UserSettings } from '../../../types';
import { ParetoAnalysis, MarginSqueezeAnalysis } from './types';

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

  return (
    <>
      {/* Modal 1: شرح كيفية احتساب مدة الاستهلاك وسرعة النفاد */}
      <AnimatePresence>
        {showCycleExplainer && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCycleExplainer(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-right z-10 space-y-4 max-h-[90vh] overflow-y-auto"
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                      آلية احتساب مدة الاستهلاك وسرعة النفاد
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      مرونة تامة تتكيف مع تواريخ الجرد الحقيقية في محلك
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCycleExplainer(false)}
                  className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Dynamic Timeline Card */}
              <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  <span>المخطط الزمني الفعلي لهذه الدورة:</span>
                  <span className="text-brand-600 dark:text-brand-400 font-black">{elapsedDays} يوماً بالتمام</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block font-medium">الجرد السابق</span>
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                      {previousReport 
                        ? formatAppDate(safeParseDate(previousReport.date), 'ar', t, { day: 'numeric', month: 'long', year: 'numeric' })
                        : 'أول جرد'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block font-medium">الجرد الحالي</span>
                    <span className="text-xs font-black text-brand-600 dark:text-brand-400">
                      {currentReport 
                        ? formatAppDate(safeParseDate(currentReport.date), 'ar', t, { day: 'numeric', month: 'long', year: 'numeric' })
                        : '—'}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  💡 <strong>ليونة كاملة</strong>: التطبيق لا يفرض شهراً ثابتاً من 30 يوماً؛ بل يطرح التاريخين من بعضهما في الروزنامة بدقة. إذا أجريت الجرد القادم بعد 15 يوماً سيحسب 15 يوماً، وإذا أجريته بعد 40 يوماً سيحسب 40 يوماً.
                </p>
              </div>

              {/* The Two Equations */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                  كيف يستفيد محلك من هذه المدة الحقيقية؟
                </h4>

                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 text-xs font-black">
                    <span>1. قياس معدل السحب اليومي الحقيقي:</span>
                  </div>
                  <p className="text-[11px] text-blue-900 dark:text-blue-200 font-mono font-bold">
                    معدل السحب اليومي = الكمية المباعة بين الجردين ÷ {elapsedDays} يوماً
                  </p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">
                    يعرف بدقة كم قطعة يشتريها الزبائن من كل سلعة في اليوم الواحد.
                  </p>
                </div>

                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                    <span>2. التنبؤ بموعد نفاد الرفوف:</span>
                  </div>
                  <p className="text-[11px] text-emerald-900 dark:text-emerald-200 font-mono font-bold">
                    أيام بقاء المخزون = الرصيد المتوفر اليوم ÷ معدل السحب اليومي
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    يحميك من نفاد السلع المطلوبة فجأة وينبهك بتجهيز الطلبيات قبل نفادها.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCycleExplainer(false)}
                  className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
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
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowParetoModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-right z-10 space-y-4 max-h-[90vh] overflow-y-auto"
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Crown size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                      قائمة السلع الذهبية (قاعدة 80/20 للأرباح)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      السلع المسؤولة عن أكثر من {paretoProfitAnalysis.profitSharePct}% من أرباح المتجر الصافية
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowParetoModal(false)}
                  className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Summary Stats Strip */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl">
                  <span className="text-[10px] text-zinc-400 block font-medium">عدد السلع الذهبية</span>
                  <span className="text-base font-black text-amber-600 dark:text-amber-400">
                    {paretoProfitAnalysis.topItemsCount} صنف
                  </span>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl">
                  <span className="text-[10px] text-zinc-400 block font-medium">إجمالي أرباحها الصافية</span>
                  <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                    {!showFinancials ? '••••••' : formatCurrency(paretoProfitAnalysis.topItemsProfit, settings.currency, language)}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl">
                  <span className="text-[10px] text-zinc-400 block font-medium">حصة الأرباح الإجمالية</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {paretoProfitAnalysis.profitSharePct}%
                  </span>
                </div>
              </div>

              {/* Table of Golden Items */}
              <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl pb-1 scrollbar-thin">
                <table className="w-full min-w-[560px] text-right text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="p-2.5 w-10 text-center whitespace-nowrap">#</th>
                      <th className="p-2.5 min-w-[150px] whitespace-nowrap">السلعة الذهبية</th>
                      <th className="p-2.5 text-center min-w-[90px] whitespace-nowrap">المباع</th>
                      <th className="p-2.5 text-center min-w-[100px] whitespace-nowrap">سعر البيع</th>
                      <th className="p-2.5 text-center min-w-[100px] whitespace-nowrap">الربح الصافي</th>
                      <th className="p-2.5 text-left pl-3 min-w-[110px] whitespace-nowrap">الرصيد المتبقي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {paretoProfitAnalysis.topItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-colors">
                        <td className="p-2.5 text-[11px] font-bold text-amber-600 text-center whitespace-nowrap">{idx + 1}</td>
                        <td className="p-2.5">
                          <span className="font-bold text-zinc-900 dark:text-white block">{item.name}</span>
                          <span className="text-[10px] text-zinc-400">{item.category}</span>
                        </td>
                        <td className="p-2.5 text-center font-bold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                          {formatQuantityWithGrouping(item.soldQty)}
                        </td>
                        <td className="p-2.5 text-center font-mono font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                          {!showFinancials ? '••••••' : formatCurrency(item.sellPrice, settings.currency, language)}
                        </td>
                        <td className="p-2.5 text-center font-mono font-black text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {!showFinancials ? '••••••' : formatCurrency(item.profit, settings.currency, language)}
                        </td>
                        <td className="p-2.5 text-left pl-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                            item.currentStock <= 0 
                              ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 font-black' 
                              : item.daysUntilStockout <= 5 
                              ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                              : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {formatQuantityWithGrouping(item.currentStock)} ق ({item.daysUntilStockout} يوم)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowParetoModal(false)}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
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
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMarginSqueezeModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-right z-10 space-y-4 max-h-[90vh] overflow-y-auto"
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl ${
                    marginSqueezeAnalysis.count > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                  } flex items-center justify-center shrink-0`}>
                    {marginSqueezeAnalysis.count > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                      رادار كشف تآكل الأرباح (زيادات أسعار الموردين)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      السلع التي زادت تكلفتها أو تقلص هامش ربحها وتتطلب تعديل سعر البيع
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMarginSqueezeModal(false)}
                  className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {marginSqueezeAnalysis.count > 0 ? (
                <>
                  <div className="p-3 bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-200 block">
                        تم رصد {marginSqueezeAnalysis.count} سلع متوفرة في المحل ارتفعت تكلفتها
                      </span>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">
                        سلع موجودة على الرف حالياً (كمية &gt; 0) تتطلب تعديل سعر البيع لعدم تآكل الربح
                      </p>
                    </div>
                    <div className="text-left font-mono shrink-0 pr-2">
                      <span className="text-[10px] text-zinc-400 block whitespace-nowrap">فارق أرباح مهدد</span>
                      <span className="text-base font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {!showFinancials ? '••••••' : formatCurrency(marginSqueezeAnalysis.totalEstimatedLoss, settings.currency, language)}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl pb-1 scrollbar-thin">
                    <table className="w-full min-w-[620px] text-right text-xs">
                      <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="p-2.5 min-w-[140px] whitespace-nowrap">السلعة</th>
                          <th className="p-2.5 text-center min-w-[90px] whitespace-nowrap">المتوفر بالمتجر</th>
                          <th className="p-2.5 text-center min-w-[120px] whitespace-nowrap">سعر التكلفة الجديد</th>
                          <th className="p-2.5 text-center min-w-[95px] whitespace-nowrap">سعر البيع الحالي</th>
                          <th className="p-2.5 text-center min-w-[75px] whitespace-nowrap">الهامش الحالي</th>
                          <th className="p-2.5 text-left pl-3 min-w-[125px] whitespace-nowrap">السعر المقترح للبيع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {marginSqueezeAnalysis.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-rose-50/20 dark:hover:bg-rose-950/10 transition-colors">
                            <td className="p-2.5">
                              <span className="font-bold text-zinc-900 dark:text-white block">{it.name}</span>
                              <span className="text-[10px] text-zinc-400">{it.category}</span>
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                {formatQuantityWithGrouping(it.unitsSoldOrStock)} قطعة
                              </span>
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                              <div>{!showFinancials ? '••••••' : formatCurrency(it.currentCost, settings.currency, language)}</div>
                              {it.costDiff > 0 && (
                                <span className="text-[10px] text-rose-500 font-bold block mt-0.5">
                                  (+{!showFinancials ? '•••' : formatCurrency(it.costDiff, settings.currency, language)} زيادة)
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                              {!showFinancials ? '••••••' : formatCurrency(it.sellingPrice, settings.currency, language)}
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
                                {it.currentMarginPct}%
                              </span>
                            </td>
                            <td className="p-2.5 text-left pl-3 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 font-mono inline-block">
                                {!showFinancials ? '••••••' : formatCurrency(it.suggestedSellingPrice, settings.currency, language)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-[11px] text-zinc-500 flex items-start gap-2">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300 shrink-0">💡 آلية التسعير المقترح:</span>
                    <span>
                      يقوم النظام بعكس فارق زيادة المورد الحقيقي مباشرة على سعر بيعك (التكلفة الجديدة - التكلفة السابقة)، دون أي مضاعفات، لضمان استرداد كامل الزيادة وحماية هامش ربحك الصافي.
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-zinc-400 space-y-2">
                  <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">جميع الأسعار متزنة ومحمية</p>
                  <p className="text-xs">لم يتم رصد أي تآكل خطير في هوامش الربح في هذه الدورة.</p>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowMarginSqueezeModal(false)}
                  className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-xs transition-colors shadow-sm cursor-pointer"
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

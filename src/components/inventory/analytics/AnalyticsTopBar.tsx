import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Sparkles, Clock, Calendar, Activity, TrendingUp, TrendingDown,
  HelpCircle, Crown, ArrowLeft, AlertTriangle, CheckCircle2,
  Award, DollarSign, PieChart as PieChartIcon, Zap, History, Truck, ShieldAlert
} from 'lucide-react';
import { formatCurrency, safeParseDate, formatAppDate } from '../../../lib/utils';
import { UserSettings } from '../../../types';
import { 
  TimeHorizon, 
  AnalyticsSubTab, 
  MacroStrategicDiagnostic, 
  SummaryMetrics, 
  ParetoAnalysis, 
  MarginSqueezeAnalysis 
} from './types';

interface AnalyticsTopBarProps {
  sortedReports: any[];
  timeHorizon: TimeHorizon;
  setTimeHorizon: (h: TimeHorizon) => void;
  selectedReportIndex: number;
  setSelectedReportIndex: (idx: number) => void;
  currentReport: any;
  previousReport: any;
  elapsedDays: number;
  setShowCycleExplainer: (show: boolean) => void;
  setShowParetoModal: (show: boolean) => void;
  setShowMarginSqueezeModal: (show: boolean) => void;
  analyzedItemsCount: number;
  summaryMetrics: SummaryMetrics;
  macroStrategicDiagnostic: MacroStrategicDiagnostic | null;
  paretoProfitAnalysis: ParetoAnalysis;
  marginSqueezeAnalysis: MarginSqueezeAnalysis;
  subTab: AnalyticsSubTab;
  setSubTab: (tab: AnalyticsSubTab) => void;
  settings: UserSettings;
}

export const AnalyticsTopBar: React.FC<AnalyticsTopBarProps> = ({
  sortedReports,
  timeHorizon,
  setTimeHorizon,
  selectedReportIndex,
  setSelectedReportIndex,
  currentReport,
  previousReport,
  elapsedDays,
  setShowCycleExplainer,
  setShowParetoModal,
  setShowMarginSqueezeModal,
  analyzedItemsCount,
  summaryMetrics,
  macroStrategicDiagnostic,
  paretoProfitAnalysis,
  marginSqueezeAnalysis,
  subTab,
  setSubTab,
  settings,
}) => {
  const { t } = useTranslation();
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  return (
    <div className="space-y-6">
      {/* Top Controller: Inventory Selector & General Delta Bar */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-850 to-zinc-900 text-white rounded-2xl p-6 shadow-md border border-zinc-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold border border-brand-500/30 flex items-center gap-1">
                <Sparkles size={12} />
                نظام تحليلات الجرد ومسار النمو
              </span>
              <span className="text-xs text-zinc-400">
                إجمالي الجرود المتاحة: {sortedReports.length}
              </span>
            </div>
            <h2 className="text-2xl font-black">ذكاء الجرد ومؤشرات الأداء</h2>
            <p className="text-xs text-zinc-400">
              تحليل الاستهلاك الحقيقي، سرعة نفاد الرفوف، مسار نمو المتجر، وتراكم الأرباح عبر الزمن.
            </p>
          </div>

          {/* Time Horizon Selector & Optional Report Dropdown */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-start lg:self-auto">
            {/* Horizon Selector */}
            <div className="flex items-center gap-1 p-1 bg-zinc-800/90 border border-zinc-700/80 rounded-xl shadow-inner">
              <button
                type="button"
                onClick={() => setTimeHorizon('cycle')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  timeHorizon === 'cycle'
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Clock size={13} />
                <span>دورة محددة</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeHorizon('3months')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  timeHorizon === '3months'
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Calendar size={13} />
                <span>آخر 3 أشهر</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeHorizon('6months')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  timeHorizon === '6months'
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Calendar size={13} />
                <span>آخر 6 أشهر</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeHorizon('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  timeHorizon === 'all'
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Activity size={13} />
                <span>كامل المسار</span>
              </button>
            </div>

            {/* If Single Cycle is chosen, show inventory picker dropdown */}
            {timeHorizon === 'cycle' && (
              <div className="flex items-center gap-2 bg-zinc-800/90 border border-zinc-700/80 rounded-xl p-1.5 shadow-inner">
                <Calendar size={16} className="text-zinc-400 mr-1" />
                <select
                  value={selectedReportIndex}
                  onChange={(e) => setSelectedReportIndex(Number(e.target.value))}
                  aria-label="اختر عملية الجرد للتحليل"
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-2 py-1"
                >
                  {sortedReports.map((rep, idx) => {
                    const dateStr = formatAppDate(safeParseDate(rep.date), 'ar', t, { 
                      day: 'numeric', 
                      month: 'short', 
                      year: 'numeric' 
                    });
                    return (
                      <option key={rep.id || idx} value={idx} className="bg-zinc-800 text-white">
                        {idx === 0 ? '⭐ الجرد الأخير: ' : `الجرد رقم ${sortedReports.length - idx}: `} {dateStr}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Selected Inventory Key Info Ribbon: Cycle Mode */}
        {timeHorizon === 'cycle' && currentReport && (
          <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-[11px] text-zinc-400">تاريخ إجراء الجرد</span>
              <span className="font-bold text-zinc-200">
                {formatAppDate(safeParseDate(currentReport.date), 'ar', t, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="block text-[11px] text-zinc-400">المدة المحسوبة للاستهلاك</span>
                <button
                  type="button"
                  onClick={() => setShowCycleExplainer(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                  title="اضغط لمعرفة كيف تم حساب الأيام وسرعة النفاد"
                >
                  <HelpCircle size={11} />
                  <span>كيف تُحسب؟</span>
                </button>
              </div>
              <div className="space-y-0.5">
                <span className="font-black text-sm text-zinc-200 flex items-center gap-1.5">
                  <Clock size={14} className="text-brand-400 shrink-0" />
                  <span>{previousReport ? `${elapsedDays} يوماً استهلاك فعلي` : 'دورة جرد أولى'}</span>
                </span>
                {previousReport && (
                  <span className="block text-[11px] text-zinc-400 font-medium">
                    (من {formatAppDate(safeParseDate(previousReport.date), 'ar', t, { day: 'numeric', month: 'short' })} إلى {formatAppDate(safeParseDate(currentReport.date), 'ar', t, { day: 'numeric', month: 'short', year: 'numeric' })})
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="block text-[11px] text-zinc-400">أصناف الجرد المسجلة</span>
              <span className="font-bold text-zinc-200">
                {analyzedItemsCount} صنف مسجل
              </span>
            </div>

            <div>
              <span className="block text-[11px] text-zinc-400">نسبة النمو مقارنة بالسابق</span>
              <div className="flex items-center gap-2">
                {summaryMetrics.growthRevenuePct !== null ? (
                  <span className={`font-bold flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${
                    summaryMetrics.growthRevenuePct >= 0 
                      ? 'bg-emerald-500/20 text-emerald-300' 
                      : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {summaryMetrics.growthRevenuePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {summaryMetrics.growthRevenuePct >= 0 ? '+' : ''}{summaryMetrics.growthRevenuePct.toFixed(1)}% مبيعات
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">الجرد المرجعي الأول</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Selected Inventory Key Info Ribbon: Macro Timeframe Mode */}
        {timeHorizon !== 'cycle' && macroStrategicDiagnostic && (
          <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-[11px] text-zinc-400">النطاق الزمني الاستراتيجي</span>
              <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                <Calendar size={14} className="text-brand-400" />
                {macroStrategicDiagnostic.periodName} ({macroStrategicDiagnostic.count} دورات جرد)
              </span>
            </div>

            <div>
              <span className="block text-[11px] text-zinc-400">إجمالي المبيعات التراكمية</span>
              <span className="font-bold text-zinc-200" dir="ltr">
                {!showFinancials ? '••••••' : formatCurrency(macroStrategicDiagnostic.totalRevenue, settings.currency, language)}
              </span>
            </div>

            <div>
              <span className="block text-[11px] text-zinc-400">صافي أرباحك الكلية المحققة</span>
              <span className="font-bold text-emerald-400" dir="ltr">
                {!showFinancials ? '••••••' : formatCurrency(macroStrategicDiagnostic.totalNetProfit, settings.currency, language)}
              </span>
            </div>

            <div>
              <span className="block text-[11px] text-zinc-400">نمو المبيعات خلال الفترة</span>
              <div className="flex items-center gap-2">
                {macroStrategicDiagnostic.revGrowthPct !== null ? (
                  <span className={`font-bold flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${
                    macroStrategicDiagnostic.revGrowthPct >= 0 
                      ? 'bg-emerald-500/20 text-emerald-300' 
                      : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {macroStrategicDiagnostic.revGrowthPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {macroStrategicDiagnostic.revGrowthPct >= 0 ? '+' : ''}{macroStrategicDiagnostic.revGrowthPct.toFixed(1)}% مبيعات
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">دورة واحدة في هذا النطاق</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Executive Strategic Intelligence Cards Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Pareto 80/20 Golden Profit Drivers Card */}
        <div 
          onClick={() => setShowParetoModal(true)}
          className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:via-zinc-900 dark:to-zinc-900 border border-amber-300/80 dark:border-amber-700/60 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-amber-400 dark:hover:border-amber-500 cursor-pointer transition-all group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <Crown size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    قاعدة 80/20 الذهبية
                  </span>
                  <span className="text-[11px] text-zinc-400 font-bold">
                    أعمدة أرباح المتجر
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white mt-1">
                  {paretoProfitAnalysis.topItemsCount > 0 
                    ? `${paretoProfitAnalysis.topItemsCount} أصناف تصنع ${paretoProfitAnalysis.profitSharePct}% من أرباح محلك`
                    : 'تحليل السلع الذهبية الأكثر ربحية'}
                </h4>
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform shrink-0">
              <span>عرض القائمة</span>
              <ArrowLeft size={13} />
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/40 flex items-center justify-between text-xs">
            <span className="text-zinc-600 dark:text-zinc-300 font-medium">
              أرباح هذه السلع الذهبية: <strong className="text-amber-600 dark:text-amber-400 font-black">{!showFinancials ? '••••••' : formatCurrency(paretoProfitAnalysis.topItemsProfit, settings.currency, language)}</strong>
            </span>
            <span className="text-[11px] text-zinc-400">
              تمثل {paretoProfitAnalysis.itemsSharePct}% فقط من مجمل أصناف المحل
            </span>
          </div>
        </div>

        {/* 2. Margin Squeeze & Supplier Price Hike Alert Card */}
        <div 
          onClick={() => setShowMarginSqueezeModal(true)}
          className={`relative overflow-hidden bg-gradient-to-br ${
            marginSqueezeAnalysis.count > 0 
              ? 'from-rose-500/10 via-rose-500/5 to-transparent dark:from-rose-950/30 dark:via-zinc-900 dark:to-zinc-900 border-rose-300/80 dark:border-rose-800/60 hover:border-rose-400' 
              : 'from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 border-emerald-300/80 dark:border-emerald-800/60 hover:border-emerald-400'
          } border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all group`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${
                marginSqueezeAnalysis.count > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
              } flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                {marginSqueezeAnalysis.count > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                    marginSqueezeAnalysis.count > 0 
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300' 
                      : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {marginSqueezeAnalysis.count > 0 ? 'رادار تآكل الأرباح' : 'سلامة الهوامش الربحية'}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-bold">
                    أسعار الموردين والبيع
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white mt-1">
                  {marginSqueezeAnalysis.count > 0
                    ? `رصد ${marginSqueezeAnalysis.count} سلع تآكلت أرباحها وتحتاج تعديل السعر`
                    : 'كافة أسعار البيع متناسقة ومحمية بهامش ربح صحي'}
                </h4>
              </div>
            </div>
            <span className={`text-[11px] font-bold ${
              marginSqueezeAnalysis.count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            } flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform shrink-0`}>
              <span>{marginSqueezeAnalysis.count > 0 ? 'فحص السلع' : 'عرض التفاصيل'}</span>
              <ArrowLeft size={13} />
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-200/50 dark:border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-600 dark:text-zinc-300 font-medium">
              {marginSqueezeAnalysis.count > 0 ? (
                <>فارق أرباح مهددة: <strong className="text-rose-600 dark:text-rose-400 font-black">{!showFinancials ? '••••••' : formatCurrency(marginSqueezeAnalysis.totalEstimatedLoss, settings.currency, language)}</strong></>
              ) : (
                <>جميع زيادات الموردين تم استيعابها في أسعار البيع بنجاح</>
              )}
            </span>
            <span className="text-[11px] text-zinc-400">
              {marginSqueezeAnalysis.count > 0 ? 'انقر لتعديل أسعار البيع المقترحة' : 'حماية الهامش 100%'}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-200 dark:border-zinc-800 scrollbar-none">
        {[
          { id: 'diagnostic', label: 'مسار النمو وتشخيص المتجر 🧭', icon: Award },
          { id: 'overview', label: 'الخلاصة المالية للجرد', icon: DollarSign },
          { id: 'categories', label: 'مردودية الأقسام ورأس المال', icon: PieChartIcon },
          { id: 'velocity', label: 'سرعة الدوران والأصناف الراكدة', icon: Zap },
          { id: 'purchases', label: 'حركة المشتريات اليومية', icon: History },
          { id: 'suppliers', label: 'تحليل أداء الموردين 🚚', icon: Truck },
          { id: 'shrinkage', label: 'سلامة الجرد والهدر والتوالف', icon: ShieldAlert },
          { id: 'trends', label: 'مسار وتطور الجرود السابقة', icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

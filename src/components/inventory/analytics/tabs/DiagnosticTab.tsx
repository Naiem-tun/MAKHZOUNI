import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Compass, Target, Award, TrendingUp, Clock, Activity, 
  Flame, Zap, AlertTriangle, CheckCircle2, Wallet 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { formatCurrency, safeParseDate, formatAppDate, formatQuantityWithGrouping } from '../../../../lib/utils';
import { UserSettings } from '../../../../types';
import { 
  TimeHorizon, 
  StoreHealthDiagnostic, 
  MacroStrategicDiagnostic, 
  CycleHighlights, 
  MarketDebtsStats, 
  MultiInventoryTrendItem 
} from '../types';

interface DiagnosticTabProps {
  timeHorizon: TimeHorizon;
  macroStrategicDiagnostic: MacroStrategicDiagnostic | null;
  storeHealthDiagnostic: StoreHealthDiagnostic | null;
  currentReport: any;
  previousReport: any;
  cycleHighlights: CycleHighlights | null;
  marketDebtsStats: MarketDebtsStats;
  multiInventoryTrends: MultiInventoryTrendItem[];
  settings: UserSettings;
}

export const DiagnosticTab: React.FC<DiagnosticTabProps> = ({
  timeHorizon,
  macroStrategicDiagnostic,
  storeHealthDiagnostic,
  currentReport,
  previousReport,
  cycleHighlights,
  marketDebtsStats,
  multiInventoryTrends,
  settings,
}) => {
  const { t } = useTranslation();
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  if (timeHorizon !== 'cycle' && macroStrategicDiagnostic) {
    return (
      <div className="space-y-6">
        {/* Executive Macro Diagnostic Master Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm overflow-hidden relative">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
            {/* Macro Score Widget */}
            <div className="flex items-center gap-4 shrink-0">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 ${macroStrategicDiagnostic.macroRing} bg-zinc-50 dark:bg-zinc-800/80 flex flex-col items-center justify-center shadow-inner`}>
                <span className={`text-3xl sm:text-4xl font-black ${macroStrategicDiagnostic.macroColor} font-mono tracking-tight`}>
                  {macroStrategicDiagnostic.macroScore}
                </span>
                <span className="text-[10px] text-zinc-400 font-bold mt-0.5">من 100</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${macroStrategicDiagnostic.macroBg}`}>
                    {macroStrategicDiagnostic.macroBadge}
                  </span>
                  <span className="text-xs text-zinc-400 font-bold">
                    نطاق: {macroStrategicDiagnostic.periodName} ({macroStrategicDiagnostic.count} دورات جرد)
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white">
                  {macroStrategicDiagnostic.macroTitle}
                </h3>
                <p className="text-xs text-zinc-500 max-w-md">
                  تحليل استراتيجي تراكمي يقيس مسار نمو المبيعات، تراكم الأرباح الصافية، وتوسع رأس مال البضائع.
                </p>
              </div>
            </div>

            {/* Quick Key Macro Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto shrink-0 text-center">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="block text-[10px] font-bold text-zinc-400">إجمالي المبيعات</span>
                <span className="text-sm sm:text-base font-black text-zinc-900 dark:text-white font-mono" dir="ltr">
                  {!showFinancials ? '••••••' : formatCurrency(macroStrategicDiagnostic.totalRevenue, settings.currency, language)}
                </span>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="block text-[10px] font-bold text-zinc-400">صافي أرباحك الكلية</span>
                <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono" dir="ltr">
                  {!showFinancials ? '••••••' : formatCurrency(macroStrategicDiagnostic.totalNetProfit, settings.currency, language)}
                </span>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="block text-[10px] font-bold text-zinc-400">نسبة نمو المبيعات</span>
                <span className={`text-sm sm:text-base font-black font-mono ${
                  macroStrategicDiagnostic.revGrowthPct !== null && macroStrategicDiagnostic.revGrowthPct >= 0
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {macroStrategicDiagnostic.revGrowthPct !== null 
                    ? `${macroStrategicDiagnostic.revGrowthPct >= 0 ? '+' : ''}${macroStrategicDiagnostic.revGrowthPct.toFixed(1)}%` 
                    : '—'}
                </span>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="block text-[10px] font-bold text-zinc-400">توسع رأس المال</span>
                <span className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400 font-mono">
                  {macroStrategicDiagnostic.stockGrowthPct !== null 
                    ? `${macroStrategicDiagnostic.stockGrowthPct >= 0 ? '+' : ''}${macroStrategicDiagnostic.stockGrowthPct.toFixed(1)}%` 
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Narrative Macro Story */}
          <div className="pt-6">
            <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-brand-600 dark:text-brand-400">
              <Compass size={16} />
              <span>التقرير الاستراتيجي الشامل لمسيرة متجرك ({macroStrategicDiagnostic.periodName}):</span>
            </div>
            <div className="p-4 rounded-xl bg-brand-500/5 dark:bg-brand-500/10 border border-brand-500/20 text-zinc-800 dark:text-zinc-200 text-sm leading-relaxed font-medium">
              {macroStrategicDiagnostic.story}
            </div>
          </div>
        </div>

        {/* 5 Macro Vital Indicators */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Target size={18} className="text-brand-500" />
              المؤشرات الاستراتيجية الكبرى ({macroStrategicDiagnostic.periodName}):
            </h3>
            <span className="text-xs text-zinc-400">تقييم تراكمي شامل ومقارنة الفترات</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {macroStrategicDiagnostic.indicators.map((ind) => (
              <div 
                key={ind.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4.5 shadow-xs space-y-2.5 transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                      {ind.title}
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {ind.details}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <span className="text-base font-black text-zinc-900 dark:text-white block font-mono">
                      {ind.value}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md inline-block mt-1 ${
                      ind.status === 'excellent' 
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : ind.status === 'good'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                        : ind.status === 'neutral'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                    }`}>
                      {ind.statusLabel}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300 shrink-0">💡 التوجيه:</span>
                  <span className="text-[11px] leading-relaxed">{ind.advice}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestones in Period (Peak Cycle & Averages) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Award size={18} className="text-amber-500" />
              أبرز المحطات والنتائج القياسية للفترة:
            </h3>
            <span className="text-xs text-zinc-400">المحطات المفصلية في هذا النطاق</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* 1. Peak Cycle */}
            <div className="bg-white dark:bg-zinc-900 border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.03] to-transparent rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Award size={15} />
                  الجرد الذهبي القياسي (Peak Cycle)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold border border-amber-500/20">
                  الرقم القياسي 🏆
                </span>
              </div>
              {macroStrategicDiagnostic.peakCycle ? (
                <div>
                  <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                    {formatAppDate(safeParseDate(macroStrategicDiagnostic.peakCycle.date), 'ar', t, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </h4>
                  <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-400">صافي ربح الدورة:</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(Number(macroStrategicDiagnostic.peakCycle.netProfit ?? (Number(macroStrategicDiagnostic.peakCycle.totalProfit || 0) - Number(macroStrategicDiagnostic.peakCycle.totalExpenses || 0))), settings.currency, language)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    أعلى مبيعات بلغت {formatCurrency(macroStrategicDiagnostic.peakCycle.totalRevenue, settings.currency, language)}. الدورة الأكثر ربحية في هذه الفترة.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-400">لا توجد بيانات كافية.</p>
              )}
            </div>

            {/* 2. Average Cycle Return */}
            <div className="bg-white dark:bg-zinc-900 border border-blue-500/20 bg-gradient-to-b from-blue-500/[0.03] to-transparent rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <TrendingUp size={15} />
                  متوسط العائد لكل دورة جرد
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-bold border border-blue-500/20">
                  معدل الجرد 📊
                </span>
              </div>
              <div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xs text-zinc-400">متوسط المبيعات:</span>
                  <span className="text-sm font-black text-zinc-900 dark:text-white font-mono">
                    {formatCurrency(macroStrategicDiagnostic.avgRevenuePerCycle, settings.currency, language)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-zinc-400">متوسط صافي الربح:</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(macroStrategicDiagnostic.avgNetPerCycle, settings.currency, language)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                  ما يعود به متجرك في المتوسط عند إتمام كل دورة جرد.
                </p>
              </div>
            </div>

            {/* 3. Lowest Cycle */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Clock size={15} />
                  الدورة الأقل أداءً في الفترة
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold">
                  أدنى نقطة 📉
                </span>
              </div>
              {macroStrategicDiagnostic.lowestCycle ? (
                <div>
                  <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    {formatAppDate(safeParseDate(macroStrategicDiagnostic.lowestCycle.date), 'ar', t, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </h4>
                  <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-400">صافي ربح الدورة:</span>
                    <span className="text-sm font-black text-zinc-700 dark:text-zinc-300 font-mono">
                      {formatCurrency(Number(macroStrategicDiagnostic.lowestCycle.netProfit ?? (Number(macroStrategicDiagnostic.lowestCycle.totalProfit || 0) - Number(macroStrategicDiagnostic.lowestCycle.totalExpenses || 0))), settings.currency, language)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    مبيعات بلغت {formatCurrency(macroStrategicDiagnostic.lowestCycle.totalRevenue, settings.currency, language)}. استعن بأسباب هذه الدورة لتفادي تكرارها.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-400">لا توجد بيانات كافية.</p>
              )}
            </div>
          </div>
        </div>

        {/* Timeline Evolution Chart for this period */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <Activity size={18} className="text-brand-500" />
                منحنى مسار النمو وتوازي المبيعات والأرباح ({macroStrategicDiagnostic.periodName})
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                مقارنة مسار المبيعات المحققة مع صافي الأرباح وقيمة رأس مال المخزون عبر الجرود
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-brand-500" />
                <span className="text-zinc-600 dark:text-zinc-400">المبيعات</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-zinc-600 dark:text-zinc-400">صافي الربح</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-zinc-600 dark:text-zinc-400">المخزون المتبقي</span>
              </div>
            </div>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={multiInventoryTrends}>
                <defs>
                  <linearGradient id="macroTrendRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004eff" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#004eff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="macroTrendNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="shortName" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} hide />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                    textAlign: 'right' 
                  }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      revenue: 'المبيعات المستهلكة',
                      profit: 'الربح الإجمالي',
                      netProfit: 'صافي الربح',
                      stockValue: 'قيمة المخزون المتبقي',
                      expenses: 'المصاريف',
                    };
                    return [formatCurrency(value, settings.currency, language), labels[name] || name];
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#004eff" strokeWidth={3} fillOpacity={1} fill="url(#macroTrendRev)" />
                <Area type="monotone" dataKey="netProfit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#macroTrendNet)" />
                <Area type="monotone" dataKey="stockValue" stroke="#60a5fa" strokeWidth={2} strokeDasharray="4 4" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Historical Cycle Performance Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <Activity size={16} className="text-brand-500" />
              سجل ومقارنة جرود الفترة ({macroStrategicDiagnostic.periodName})
            </h4>
            <span className="text-xs text-zinc-400">
              {macroStrategicDiagnostic.count} دورات جردية
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400">
                  <th className="pb-3 font-bold">الدورة</th>
                  <th className="pb-3 font-bold">تاريخ الجرد</th>
                  <th className="pb-3 font-bold">المبيعات المحققة</th>
                  <th className="pb-3 font-bold">الربح الإجمالي</th>
                  <th className="pb-3 font-bold">المصاريف المقيدة</th>
                  <th className="pb-3 font-bold">صافي الربح (عائدك)</th>
                  <th className="pb-3 font-bold">قيمة المخزون المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {multiInventoryTrends.slice().reverse().map((tItem, i) => (
                  <tr key={tItem.id || i} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${tItem.isPeak ? 'bg-amber-500/[0.04]' : ''}`}>
                    <td className="py-3 font-black text-brand-600 dark:text-brand-400 flex items-center gap-2">
                      {tItem.name}
                      {tItem.isPeak && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold border border-amber-500/20">
                          الأفضل 🏆
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-zinc-500">{tItem.fullDate}</td>
                    <td className="py-3 font-bold text-zinc-900 dark:text-white" dir="ltr">
                      {!showFinancials ? '••••••' : formatCurrency(tItem.revenue, settings.currency, language)}
                    </td>
                    <td className="py-3 font-bold text-emerald-600" dir="ltr">
                      {!showFinancials ? '••••••' : formatCurrency(tItem.profit, settings.currency, language)}
                    </td>
                    <td className="py-3 text-rose-500" dir="ltr">
                      {!showFinancials ? '••••••' : formatCurrency(tItem.expenses, settings.currency, language)}
                    </td>
                    <td className="py-3 font-black text-emerald-700 dark:text-emerald-400" dir="ltr">
                      {!showFinancials ? '••••••' : formatCurrency(tItem.netProfit, settings.currency, language)}
                    </td>
                    <td className="py-3 font-bold text-blue-600 dark:text-blue-400" dir="ltr">
                      {!showFinancials ? '••••••' : formatCurrency(tItem.stockValue, settings.currency, language)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* Single-Cycle Diagnostic View */
  if (!storeHealthDiagnostic || !currentReport) return null;

  return (
    <div className="space-y-6">
      {/* Executive Diagnostic Master Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm overflow-hidden relative">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
          {/* Score Widget */}
          <div className="flex items-center gap-4 shrink-0">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 ${storeHealthDiagnostic.scoreRing} bg-zinc-50 dark:bg-zinc-800/80 flex flex-col items-center justify-center shadow-inner`}>
              <span className={`text-3xl sm:text-4xl font-black ${storeHealthDiagnostic.scoreColor} font-mono tracking-tight`}>
                {storeHealthDiagnostic.score}
              </span>
              <span className="text-[10px] text-zinc-400 font-bold mt-0.5">من 100</span>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${storeHealthDiagnostic.scoreBg}`}>
                  {storeHealthDiagnostic.scoreBadge}
                </span>
                <span className="text-xs text-zinc-400">تقييم الجرد الدوري</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white">
                {storeHealthDiagnostic.scoreTitle}
              </h3>
              <p className="text-xs text-zinc-500 max-w-md">
                مقياس مركب يقيس كفاءة المبيعات، ضبط المصاريف، وتوازن نمو الأرباح الحقيقية.
              </p>
            </div>
          </div>

          {/* Quick Key Comparison Strip */}
          <div className="grid grid-cols-3 gap-3 w-full lg:w-auto shrink-0 text-center">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <span className="block text-[10px] font-bold text-zinc-400">نمو المبيعات</span>
              <span className={`text-sm sm:text-base font-black ${
                storeHealthDiagnostic.revPctChange !== null && storeHealthDiagnostic.revPctChange >= 0
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-rose-600 dark:text-rose-400'
              }`}>
                {storeHealthDiagnostic.revPctChange !== null 
                  ? `${storeHealthDiagnostic.revPctChange >= 0 ? '+' : ''}${storeHealthDiagnostic.revPctChange.toFixed(1)}%` 
                  : '—'}
              </span>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <span className="block text-[10px] font-bold text-zinc-400">نمو صافي الربح</span>
              <span className={`text-sm sm:text-base font-black ${
                storeHealthDiagnostic.netPctChange !== null && storeHealthDiagnostic.netPctChange >= 0
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-rose-600 dark:text-rose-400'
              }`}>
                {storeHealthDiagnostic.netPctChange !== null 
                  ? `${storeHealthDiagnostic.netPctChange >= 0 ? '+' : ''}${storeHealthDiagnostic.netPctChange.toFixed(1)}%` 
                  : '—'}
              </span>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <span className="block text-[10px] font-bold text-zinc-400">نسبة المصاريف</span>
              <span className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                {((storeHealthDiagnostic.curExpenses / (Number(currentReport.totalProfit || 1))) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Narrative Story Section */}
        <div className="pt-6">
          <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-brand-600 dark:text-brand-400">
            <Compass size={16} />
            <span>التقرير التشخيصي التنفيذي لمتجرك:</span>
          </div>
          <div className="p-4 rounded-xl bg-brand-500/5 dark:bg-brand-500/10 border border-brand-500/20 text-zinc-800 dark:text-zinc-200 text-sm leading-relaxed font-medium">
            {storeHealthDiagnostic.story}
          </div>
        </div>
      </div>

      {/* 5 Evaluated Vital Indicators */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Target size={18} className="text-brand-500" />
            المؤشرات الحيوية لتقييم المتجر (مؤشر جيد / سيء):
          </h3>
          <span className="text-xs text-zinc-400">مقارنة تحليلية مباشرة بين الجردين</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {storeHealthDiagnostic.indicators.map((ind) => (
            <div 
              key={ind.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4.5 shadow-xs space-y-2.5 transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                    {ind.title}
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {ind.details}
                  </p>
                </div>
                <div className="text-left shrink-0">
                  <span className="text-base font-black text-zinc-900 dark:text-white block font-mono">
                    {ind.value}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md inline-block mt-1 ${
                    ind.status === 'excellent' 
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : ind.status === 'good'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                      : ind.status === 'neutral'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                  }`}>
                    {ind.statusLabel}
                  </span>
                </div>
              </div>

              {/* Operational Advice */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-bold text-zinc-700 dark:text-zinc-300 shrink-0">💡 التوجيه:</span>
                <span className="text-[11px] leading-relaxed">{ind.advice}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cycle Stars vs Frozen Capital */}
      {cycleHighlights && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Flame size={18} className="text-amber-500" />
              أبطال الدورة مقابل رأس المال المجمد:
            </h3>
            <span className="text-xs text-zinc-400">تحليل مساهمة الأصناف الفردية في هذا الجرد</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* 1. Star Profit */}
            <div className="bg-white dark:bg-zinc-900 border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.03] to-transparent rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Award size={15} />
                  بطل الأرباح (الأعلى عائداً)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20">
                  نجم الجرد 🌟
                </span>
              </div>
              {cycleHighlights.starProfitItem ? (
                <div>
                  <h4 className="text-sm font-black text-zinc-900 dark:text-white truncate">
                    {cycleHighlights.starProfitItem.name}
                  </h4>
                  <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-400">صافي ربحه:</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(cycleHighlights.starProfitItem.profit, settings.currency, language)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    ساهم ببيع {formatQuantityWithGrouping(cycleHighlights.starProfitItem.soldQty)} قطعة. احرص على عدم نفاد مخزونه نهائياً.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-400">لا توجد بيانات ربحية كافية بعد.</p>
              )}
            </div>

            {/* 2. Star Velocity */}
            <div className="bg-white dark:bg-zinc-900 border border-blue-500/20 bg-gradient-to-b from-blue-500/[0.03] to-transparent rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Zap size={15} />
                  الأسرع حركة (الأكثر طلباً)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-bold border border-blue-500/20">
                  دوران سريع ⚡
                </span>
              </div>
              {cycleHighlights.starVelocityItem ? (
                <div>
                  <h4 className="text-sm font-black text-zinc-900 dark:text-white truncate">
                    {cycleHighlights.starVelocityItem.name}
                  </h4>
                  <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-400">إجمالي المبيعات:</span>
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono">
                      {formatQuantityWithGrouping(cycleHighlights.starVelocityItem.soldQty)} قطعة
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    بمعدل سحب {cycleHighlights.starVelocityItem.dailyVelocity.toFixed(1)} قطعة/يوم. السلعة الأكبر جذباً للمستهلك.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-400">لا توجد مبيعات مسجلة في هذا الجرد.</p>
              )}
            </div>

            {/* 3. Heaviest Dead Stock */}
            <div className="bg-white dark:bg-zinc-900 border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.03] to-transparent rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle size={15} />
                  أكبر سيولة معطلة (راكد)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold border border-amber-500/20">
                  رأس مال نائم 🧊
                </span>
              </div>
              {cycleHighlights.heaviestDeadStock ? (
                <div>
                  <h4 className="text-sm font-black text-zinc-900 dark:text-white truncate">
                    {cycleHighlights.heaviestDeadStock.name}
                  </h4>
                  <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-400">قيمة المحبوس:</span>
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">
                      {formatCurrency(cycleHighlights.heaviestDeadStock.deadCapital, settings.currency, language)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    لديك {formatQuantityWithGrouping(cycleHighlights.heaviestDeadStock.currentStock)} قطعة لم تبع قط. يُنصح بعمل تخفيض لتسييل هذا الصنف.
                  </p>
                </div>
              ) : (
                <div className="pt-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={16} />
                  ممتاز! لا يوجد صنف راكد يجمد سيولة ملحوظة.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Market Debts & Liquidity Risk Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
              <Wallet size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                ميزان السيولة النقدية وديون السوق (Customer Debts Risk)
              </h4>
              <p className="text-[11px] text-zinc-400">
                قياس أثر أموالك المعلقة عند الزبائن على أرباح ورأس مال المتجر
              </p>
            </div>
          </div>

          <div className="self-start sm:self-auto">
            {marketDebtsStats.unpaidCustomerDebts === 0 ? (
              <span className="text-xs font-black px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                أمان مالي تام: لا ديون خارجية 🟢
              </span>
            ) : storeHealthDiagnostic.curNet > 0 && (marketDebtsStats.unpaidCustomerDebts / storeHealthDiagnostic.curNet) <= 0.4 ? (
              <span className="text-xs font-black px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                ديون منضبطة وضمن الحدود الآمنة 🟢
              </span>
            ) : (
              <span className="text-xs font-black px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20">
                تنبيه: حجم الديون يحبس السيولة 🔴
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center sm:text-right">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <span className="block text-[11px] text-zinc-400 font-bold mb-1">ديون الزبائن في السوق</span>
            <span className="text-base font-black text-zinc-900 dark:text-white font-mono">
              {formatCurrency(marketDebtsStats.unpaidCustomerDebts, settings.currency, language)}
            </span>
            <span className="block text-[10px] text-zinc-400 mt-0.5">
              لدى {marketDebtsStats.customerDebtCount} زبون مدين
            </span>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <span className="block text-[11px] text-zinc-400 font-bold mb-1">نسبة الديون من صافي ربح الجرد</span>
            <span className={`text-base font-black font-mono ${
              storeHealthDiagnostic.curNet > 0 && (marketDebtsStats.unpaidCustomerDebts / storeHealthDiagnostic.curNet) > 0.5
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-zinc-900 dark:text-white'
            }`}>
              {storeHealthDiagnostic.curNet > 0 
                ? `${((marketDebtsStats.unpaidCustomerDebts / storeHealthDiagnostic.curNet) * 100).toFixed(0)}%`
                : '—'}
            </span>
            <span className="block text-[10px] text-zinc-400 mt-0.5">
              من عائد جيبك الصافي
            </span>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <span className="block text-[11px] text-zinc-400 font-bold mb-1">ديون الموردين الواجب دفعها</span>
            <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
              {formatCurrency(marketDebtsStats.unpaidSupplierDebts, settings.currency, language)}
            </span>
            <span className="block text-[10px] text-zinc-400 mt-0.5">
              مستحقات للموردين
            </span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
          <span className="font-bold text-zinc-800 dark:text-zinc-200 shrink-0">💡 التحليل المالي:</span>
          <span>
            {marketDebtsStats.unpaidCustomerDebts === 0
              ? 'نموذج نقدي مثالي (Cash Business) دون مخاطر تعثر سداد الزبائن، مما يمنحك سيولة فورية لإعادة تدويرها في المخزون.'
              : storeHealthDiagnostic.curNet > 0 && (marketDebtsStats.unpaidCustomerDebts / storeHealthDiagnostic.curNet) > 0.6
              ? `ديون الزبائن تعادل ${(marketDebtsStats.unpaidCustomerDebts / storeHealthDiagnostic.curNet * 100).toFixed(0)}% من صافي ربح دورتك؛ هذا يعني أن جزءاً كبيراً من مكاسبك لم يدخل جيبك بعد بل ما زال في السوق. ننصح بالتركيز على تحصيل الديون قبل منح تسهيلات جديدة.`
              : 'نسبة ديون السوق متوازنة ومقبولة ولا تعطل حركة المشتريات اليومية.'}
          </span>
        </div>
      </div>

      {/* Quick Evolution Comparison (Before ➔ After) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
            <Activity size={16} className="text-brand-500" />
            تطور الأرقام المالية: الجرد السابق ➔ الجرد الحالي
          </h4>
          <span className="text-xs text-zinc-400">
            {previousReport ? 'مقارنة دورتين متتاليتين' : 'الدورة الأولى المرجعية'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {/* Sales */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <span className="block text-[11px] text-zinc-400 font-bold mb-1">المبيعات المحققة</span>
            <div className="text-xs text-zinc-500 line-through mb-0.5" dir="ltr">
              {previousReport ? formatCurrency(previousReport.totalRevenue, settings.currency, language) : '—'}
            </div>
            <div className="text-base font-black text-zinc-900 dark:text-white" dir="ltr">
              {formatCurrency(currentReport.totalRevenue, settings.currency, language)}
            </div>
          </div>

          {/* Profit */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <span className="block text-[11px] text-zinc-400 font-bold mb-1">إجمالي الأرباح</span>
            <div className="text-xs text-zinc-500 line-through mb-0.5" dir="ltr">
              {previousReport ? formatCurrency(previousReport.totalProfit, settings.currency, language) : '—'}
            </div>
            <div className="text-base font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
              {formatCurrency(currentReport.totalProfit, settings.currency, language)}
            </div>
          </div>

          {/* Expenses */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <span className="block text-[11px] text-zinc-400 font-bold mb-1">المصاريف التشغيلية</span>
            <div className="text-xs text-zinc-500 line-through mb-0.5" dir="ltr">
              {previousReport ? formatCurrency(previousReport.totalExpenses, settings.currency, language) : '—'}
            </div>
            <div className="text-base font-black text-rose-600 dark:text-rose-400" dir="ltr">
              {formatCurrency(currentReport.totalExpenses, settings.currency, language)}
            </div>
          </div>

          {/* Stock Value */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <span className="block text-[11px] text-zinc-400 font-bold mb-1">قيمة المخزون المتبقي</span>
            <div className="text-xs text-zinc-500 line-through mb-0.5" dir="ltr">
              {previousReport ? formatCurrency(previousReport.totalRemainingValue, settings.currency, language) : '—'}
            </div>
            <div className="text-base font-black text-zinc-900 dark:text-white" dir="ltr">
              {formatCurrency(currentReport.totalRemainingValue, settings.currency, language)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

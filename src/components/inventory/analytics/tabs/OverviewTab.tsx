import React from 'react';
import { Package, TrendingUp, DollarSign, Sparkles, AlertCircle, Hourglass, ShieldAlert } from 'lucide-react';
import { formatCurrency, formatQuantityWithGrouping } from '../../../../lib/utils';
import { UserSettings } from '../../../../types';
import { SummaryMetrics } from '../types';

interface OverviewTabProps {
  summaryMetrics: SummaryMetrics;
  settings: UserSettings;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ summaryMetrics, settings }) => {
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  return (
    <div className="space-y-6">
      {/* Main 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stock Valuation Remaining */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold">قيمة المخزون المتبقي (التكلفة)</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600">
              <Package size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white">
            {!showFinancials ? '••••••' : formatCurrency(summaryMetrics.totalRemainingValue, settings.currency, language)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            رأس المال الحقيقي المتبقي على الرفوف بعد الجرد
          </p>
        </div>

        {/* Total Consumed / Revenue */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold">المبيعات / الاستهلاك المحقق</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white">
            {!showFinancials ? '••••••' : formatCurrency(summaryMetrics.totalRevenue, settings.currency, language)}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            تم استهلاك {formatQuantityWithGrouping(summaryMetrics.totalSoldPieces)} قطعة خلال الدورة
          </p>
        </div>

        {/* Total Profit */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold">الربح الإجمالي المحقق</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white">
            {!showFinancials ? '••••••' : formatCurrency(summaryMetrics.totalProfit, settings.currency, language)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
            <span>هامش الربح الإجمالي:</span>
            <span className="font-bold text-zinc-700 dark:text-zinc-300">
              {summaryMetrics.totalRevenue > 0 
                ? ((summaryMetrics.totalProfit / summaryMetrics.totalRevenue) * 100).toFixed(1) + '%' 
                : '0%'}
            </span>
          </div>
        </div>

        {/* Net Profit after expenses */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold">صافي الربح الفعلي</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600">
              <Sparkles size={18} />
            </div>
          </div>
          <div className={`text-2xl font-black ${
            summaryMetrics.netProfit >= 0 ? 'text-zinc-900 dark:text-white' : 'text-rose-600'
          }`}>
            {!showFinancials ? '••••••' : formatCurrency(summaryMetrics.netProfit, settings.currency, language)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            بعد خصم المصاريف المسجلة ({formatCurrency(summaryMetrics.totalExpenses, settings.currency, language)})
          </p>
        </div>
      </div>

      {/* Quick Action Alerts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dead stock alert card */}
        <div className="p-5 rounded-xl border border-rose-100 dark:border-rose-950/50 bg-rose-50/50 dark:bg-rose-950/20 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-600 shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <h4 className="font-bold text-rose-950 dark:text-rose-200 text-sm">بضاعة راكدة (صفر استهلاك)</h4>
            <div className="text-lg font-black text-rose-700 dark:text-rose-400 mt-1">
              {summaryMetrics.deadStockCount} صنف معطل
            </div>
            <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1">
              تجمد رأس مال قدره {!showFinancials ? '••••••' : formatCurrency(summaryMetrics.deadStockCapital, settings.currency, language)} على الرفوف دون أي حركة بيع في هذه الدورة.
            </p>
          </div>
        </div>

        {/* Critical stock alert */}
        <div className="p-5 rounded-xl border border-amber-100 dark:border-amber-950/50 bg-amber-50/50 dark:bg-amber-950/20 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
            <Hourglass size={24} />
          </div>
          <div>
            <h4 className="font-bold text-amber-950 dark:text-amber-200 text-sm">أصناف شارفت على النفاد</h4>
            <div className="text-lg font-black text-amber-700 dark:text-amber-400 mt-1">
              {summaryMetrics.criticalStockCount} أصناف حرجة
            </div>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
              مخزونها الحالي يكفي لأقل من 5 أيام فقط استناداً لمعدل الاستهلاك المحسوب بالجرد.
            </p>
          </div>
        </div>

        {/* Health & Discrepancy indicator */}
        <div className="p-5 rounded-xl border border-blue-100 dark:border-blue-950/50 bg-blue-50/50 dark:bg-blue-950/20 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h4 className="font-bold text-blue-950 dark:text-blue-200 text-sm">التوالف والزيادات غير المفسرة</h4>
            <div className="text-lg font-black text-blue-700 dark:text-blue-400 mt-1">
              {formatCurrency(summaryMetrics.damageLoss, settings.currency, language)} توالف
            </div>
            <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-1">
              {summaryMetrics.surplusCount > 0 
                ? `وهناك ${summaryMetrics.surplusCount} صنف بزيادة فعلية عن المسجل بقيمة ${formatCurrency(summaryMetrics.surplusValue, settings.currency, language)}.` 
                : 'لا توجد فروقات فائض غير مبررة مسجلة.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

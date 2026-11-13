import React from 'react';
import { Award, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '../../../../lib/utils';
import { UserSettings } from '../../../../types';
import { CategoryBreakdownItem, AnalyzedItem } from '../types';

interface CategoriesTabProps {
  topRoiProducts: AnalyzedItem[];
  categoryBreakdown: CategoryBreakdownItem[];
  settings: UserSettings;
}

export const CategoriesTab: React.FC<CategoriesTabProps> = ({
  topRoiProducts,
  categoryBreakdown,
  settings,
}) => {
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  return (
    <div className="space-y-6">
      {/* Top Multipliers Highlight Card */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-sm">
              <Award size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-900 dark:text-white">
                كاشف عائد الدينار المستثمر في السلع
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                كم ديناراً يرجع لمحلك مقابل كل 1 دينار تدفعه في شراء هذا المنتج؟
              </p>
            </div>
          </div>
        </div>

        {/* Quick badges of top return products */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          {topRoiProducts.map((p, idx) => (
            <div key={idx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400 font-bold truncate max-w-[100px]">{p.category}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200/50">
                  #{idx + 1}
                </span>
              </div>
              <div className="font-bold text-xs text-zinc-900 dark:text-white truncate mt-1" title={p.name}>
                {p.name}
              </div>
              <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">يرجع لك:</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                  {p.returnPerDinar.toFixed(2)} د
                  <ArrowUpRight size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Performance Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-base text-zinc-900 dark:text-white">
              مقارنة أداء ومساهمة أقسام المحل
            </h3>
            <p className="text-xs text-zinc-500">
              مرتبة حسب المساهمة الأكبر في صافي الأرباح المحققة خلال هذه الدورة
            </p>
          </div>
          <span className="text-xs text-zinc-400 font-bold">
            إجمالي الأقسام: {categoryBreakdown.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryBreakdown.map((cat, i) => (
            <div 
              key={i}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-brand-500/50 transition-all"
            >
              <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 font-black text-xs flex items-center justify-center">
                      {i + 1}
                    </span>
                    <h4 className="font-black text-base text-zinc-900 dark:text-white">
                      {cat.category}
                    </h4>
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-1">
                    يحتوي على {cat.itemCount} صنف مسجل
                  </span>
                </div>

                <div className="text-left">
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200/50 dark:border-emerald-900/40 block">
                    {cat.profPct.toFixed(1)}% من ربح المحل
                  </span>
                </div>
              </div>

              {/* Profit vs Revenue Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-medium">مساهمة المبيعات:</span>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">{cat.revPct.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, cat.revPct))}%` }}
                  />
                </div>
              </div>

              {/* 3 Core Metrics for this category */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
                <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
                  <span className="block text-[10px] text-zinc-400">مبيعات القسم</span>
                  <span className="font-black text-xs text-zinc-900 dark:text-white mt-0.5 block">
                    {!showFinancials ? '•••' : formatCurrency(cat.revenue, settings.currency, language)}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                  <span className="block text-[10px] text-emerald-600 dark:text-emerald-400">أرباحه الصافية</span>
                  <span className="font-black text-xs text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                    {!showFinancials ? '•••' : formatCurrency(cat.profit, settings.currency, language)}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
                  <span className="block text-[10px] text-zinc-400">المجمد على الرف</span>
                  <span className="font-black text-xs text-zinc-900 dark:text-white mt-0.5 block">
                    {!showFinancials ? '•••' : formatCurrency(cat.remainingValue, settings.currency, language)}
                  </span>
                </div>
              </div>

              {/* Key takeaway note */}
              <div className="text-[11px] bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5 flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                <span>معدل هامش الربح بالقسم:</span>
                <span className="font-black text-brand-600 dark:text-brand-400">
                  {cat.profitMargin.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

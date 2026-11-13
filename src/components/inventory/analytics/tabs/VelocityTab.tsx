import React from 'react';
import { Zap, Hourglass, AlertTriangle, Search, X } from 'lucide-react';
import { formatCurrency, formatQuantityWithGrouping } from '../../../../lib/utils';
import { UserSettings } from '../../../../types';
import { AnalyzedItem } from '../types';

interface VelocityTabProps {
  topMovingItems: AnalyzedItem[];
  stagnantItems: AnalyzedItem[];
  displayReplenishmentItems: AnalyzedItem[];
  replenishmentItems: AnalyzedItem[];
  replenishmentSearch: string;
  setReplenishmentSearch: (q: string) => void;
  urgentFilter: 'all' | 'critical' | 'warning';
  setUrgentFilter: (f: 'all' | 'critical' | 'warning') => void;
  itemsPerPage: number;
  setItemsPerPage: (n: number) => void;
  isLatestReportSelected: boolean;
  daysSinceLatestInventory: number;
  settings: UserSettings;
}

export const VelocityTab: React.FC<VelocityTabProps> = ({
  topMovingItems,
  stagnantItems,
  displayReplenishmentItems,
  replenishmentItems,
  replenishmentSearch,
  setReplenishmentSearch,
  urgentFilter,
  setUrgentFilter,
  itemsPerPage,
  setItemsPerPage,
  isLatestReportSelected,
  daysSinceLatestInventory,
  settings,
}) => {
  const language = settings.language || 'ar';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fast moving */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600">
                <Zap size={18} />
              </div>
              <div>
                <h3 className="font-black text-zinc-900 dark:text-white">الأصناف الأعلى استهلاكاً (قاطرة المبيعات)</h3>
                <p className="text-[11px] text-zinc-500">أكثر المنتجات خروجاً ومبيعاً خلال فترة الجرد</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {topMovingItems.length > 0 ? (
              topMovingItems.map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 font-black text-xs flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-zinc-900 dark:text-white">{item.name}</span>
                        {item.batchCount > 1 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                            {item.batchCount} دفعات
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        معدل: {item.dailyVelocity.toFixed(1)} قطعة/يوم • الرصيد المجمع: {formatQuantityWithGrouping(item.currentStock)}
                      </div>
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                      {formatQuantityWithGrouping(item.soldQty)} مباع
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      ربح: {formatCurrency(item.profit, settings.currency, language)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-zinc-400 py-8">لم يتم تسجيل كميات مستهلكة في هذا الجرد</p>
            )}
          </div>
        </div>

        {/* Dead stock */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600">
                <Hourglass size={18} />
              </div>
              <div>
                <h3 className="font-black text-zinc-900 dark:text-white">الأصناف الراكدة (رأس المال المجمد)</h3>
                <p className="text-[11px] text-zinc-500">أصناف لم تنقص حبة واحدة بين الجردين</p>
              </div>
            </div>
            <span className="text-xs font-bold text-rose-500 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40">
              {stagnantItems.length} صنف
            </span>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {stagnantItems.length > 0 ? (
              stagnantItems.map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-zinc-900 dark:text-white">{item.name}</span>
                      {item.batchCount > 1 && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                          {item.batchCount} دفعات
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      الكمية الراكدة المجمعة: {formatQuantityWithGrouping(item.currentStock)} قطعة • القسم: {item.category}
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="font-black text-sm text-rose-600 dark:text-rose-400">
                      {formatCurrency(item.deadCapital, settings.currency, language)}
                    </div>
                    <div className="text-[10px] text-zinc-400">تكلفة مجمدة</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-zinc-400 py-8">ممتاز! لا توجد أصناف راكدة معطلة في هذا الجرد</p>
            )}
          </div>
        </div>
      </div>

      {/* Urgent replenishment table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500 shrink-0" />
            <div>
              <h3 className="font-black text-zinc-900 dark:text-white text-base">
                جدول أيام بقاء المخزون ومقترحات الشراء
              </h3>
              <p className="text-[11px] text-zinc-500">
                مرتبة تصاعدياً من الأقرب للنفاد • تم دمج النسخ المتعددة لنفس الصنف تلقائياً
              </p>
            </div>
          </div>

          {/* Controls: Search, Filter & Per Page */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative flex-1 md:w-56 min-w-[180px]">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={replenishmentSearch}
                onChange={(e) => setReplenishmentSearch(e.target.value)}
                placeholder="ابحث باسم المنتج..."
                className="w-full pr-8 pl-7 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {replenishmentSearch && (
                <button
                  type="button"
                  onClick={() => setReplenishmentSearch('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setUrgentFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  urgentFilter === 'all'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                الكل ({replenishmentItems.length})
              </button>
              <button
                type="button"
                onClick={() => setUrgentFilter('critical')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  urgentFilter === 'critical'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-rose-600 dark:text-rose-400 hover:opacity-80'
                }`}
              >
                حرج (≤ 5 أيام)
              </button>
              <button
                type="button"
                onClick={() => setUrgentFilter('warning')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  urgentFilter === 'warning'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-amber-600 dark:text-amber-400 hover:opacity-80'
                }`}
              >
                متوسط (6-15 يوم)
              </button>
            </div>

            {/* Per Page Buttons */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg text-xs font-bold">
              <span className="text-[10px] text-zinc-400 px-1.5">عرض:</span>
              {[20, 30, 50, -1].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setItemsPerPage(count)}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    itemsPerPage === count
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {count === -1 ? 'الكل' : count}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
          <span>
            عرض {displayReplenishmentItems.length} من أصل {replenishmentItems.length} صنف مستهلك
          </span>
          <span className="text-[11px] text-zinc-400">
            {isLatestReportSelected 
              ? `⚡ مرت ${daysSinceLatestInventory} أيام منذ الجرد: محسوبة بمحاكاة السحب اليومي التقديري حتى تاريخ اليوم` 
              : 'أرشيف: محسوبة بناءً على كميات تاريخ الجرد'}
          </span>
        </div>

        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <table className="w-full min-w-[780px] text-right text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400">
                <th className="pb-2.5 font-bold w-10 text-center whitespace-nowrap">#</th>
                <th className="pb-2.5 font-bold min-w-[180px] whitespace-nowrap">المنتج (مجمع النسخ)</th>
                <th className="pb-2.5 font-bold min-w-[90px] whitespace-nowrap">القسم</th>
                <th className="pb-2.5 font-bold min-w-[130px] whitespace-nowrap text-center">
                  {isLatestReportSelected ? 'المتبقي التقديري على الرف اليوم' : 'رصيد الجرد'}
                </th>
                <th className="pb-2.5 font-bold min-w-[180px] whitespace-nowrap">معدل السحب (يومي / أسبوعي / بالكرتونة)</th>
                <th className="pb-2.5 font-bold min-w-[110px] whitespace-nowrap text-center">أيام البقاء ابتداءً من اليوم</th>
                <th className="pb-2.5 font-bold min-w-[130px] whitespace-nowrap">القرار المقترح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {displayReplenishmentItems.map((item, i) => (
                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                  <td className="py-2.5 font-bold text-zinc-400 text-[11px] text-center whitespace-nowrap">{i + 1}</td>
                  <td className="py-2.5 font-bold text-zinc-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span>{item.name}</span>
                      {item.batchCount > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/40" title="تم دمج كميات عدة نسخ شراء مختلفة لهذا الصنف">
                          {item.batchCount} أسعار شراء
                        </span>
                      )}
                      {item.returnPerDinar > 1 && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" title={`كل 1 د تكلفة يعود بـ ${item.returnPerDinar.toFixed(2)} د مبيعات`}>
                          عائد {item.returnPerDinar.toFixed(2)} د
                        </span>
                      )}
                    </div>
                    {isLatestReportSelected && (
                      <div className="text-[10px] text-zinc-400 font-normal mt-0.5">
                        رصيد النظام: {formatQuantityWithGrouping(item.liveCurrentStock)}
                        {item.estimatedConsumedSinceInventory > 0 && (
                          <span className="text-zinc-500"> (قُدّر استهلاك ~{formatQuantityWithGrouping(item.estimatedConsumedSinceInventory)} في {daysSinceLatestInventory} أيام)</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 text-zinc-500 whitespace-nowrap">{item.category}</td>
                  <td className="py-2.5 font-black text-sm text-zinc-900 dark:text-zinc-100 text-center whitespace-nowrap">
                    {formatQuantityWithGrouping(item.currentStock)} قطعة
                  </td>
                  <td className="py-2.5 text-zinc-700 dark:text-zinc-200">
                    <div className="font-bold text-xs flex items-center gap-1.5 flex-wrap">
                      <span className="whitespace-nowrap">{item.dailyVelocity.toFixed(1)} <span className="text-[10px] text-zinc-400 font-normal">ق/يوم</span></span>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span className="text-brand-600 dark:text-brand-400 font-black whitespace-nowrap">{item.weeklyVelocity.toFixed(1)} <span className="text-[10px] text-zinc-400 font-normal">ق/أسبوع</span></span>
                    </div>
                    {item.piecesPerBox > 1 && (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40 whitespace-nowrap">
                          📦 {item.weeklyBoxesVelocity !== null ? `${item.weeklyBoxesVelocity} كرتونة/أسبوع` : '—'}
                        </span>
                        {item.daysForOneBox && item.daysForOneBox > 0 && (
                          <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                            (كرتونة كل {item.daysForOneBox} يوم)
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 text-center whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full font-black text-xs inline-flex items-center gap-1 whitespace-nowrap ${
                      item.currentStock === 0
                        ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-black'
                        : item.daysUntilStockout <= 5
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-200 dark:border-rose-900'
                        : item.daysUntilStockout <= 15
                        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 border border-amber-200 dark:border-amber-900'
                        : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600'
                    }`}>
                      {item.currentStock === 0 ? 'نفد تماماً 🔴' : `${item.daysUntilStockout} يوم`}
                    </span>
                  </td>
                  <td className="py-2.5">
                    {item.currentStock === 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        طلب فوري عاجل (الرف فارغ)
                      </span>
                    ) : item.daysUntilStockout <= 5 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        إدراج في أول طلبية مورد
                      </span>
                    ) : item.daysUntilStockout <= 15 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        طلب في الزيارة القادمة
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        المخزون متزن وآمن
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {displayReplenishmentItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    لا توجد أصناف تطابق الفلتر المحدد حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

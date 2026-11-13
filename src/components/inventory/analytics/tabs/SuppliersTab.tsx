import React from 'react';
import { Package, DollarSign, TrendingUp, Award, Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { formatCurrency, formatQuantityWithGrouping } from '../../../../lib/utils';
import { UserSettings } from '../../../../types';
import { SupplierPerformanceData } from '../types';

interface SuppliersTabProps {
  supplierPerformanceData: SupplierPerformanceData;
  supplierSearchQuery: string;
  setSupplierSearchQuery: (q: string) => void;
  supplierSortBy: 'profit' | 'purchases' | 'stock_qty' | 'margin';
  setSupplierSortBy: (sort: 'profit' | 'purchases' | 'stock_qty' | 'margin') => void;
  expandedSupplierDetailsId: string | null;
  setExpandedSupplierDetailsId: React.Dispatch<React.SetStateAction<string | null>>;
  settings: UserSettings;
}

export const SuppliersTab: React.FC<SuppliersTabProps> = ({
  supplierPerformanceData,
  supplierSearchQuery,
  setSupplierSearchQuery,
  supplierSortBy,
  setSupplierSortBy,
  expandedSupplierDetailsId,
  setExpandedSupplierDetailsId,
  settings,
}) => {
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="border border-emerald-800/40 rounded-2xl p-5 shadow-xs bg-gradient-to-r from-emerald-950/70 via-teal-900/40 to-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl border shrink-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <Package size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white">
                  بضاعة وأرباح الموردين في المخزون المتوفر بالمحل
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  المخزون الفعلي الحالي
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-1">
                حساب دقيق لصافي الأرباح المتوقعة ورأس المال للسلع الموجودة فعلياً في محلك ومخزنك الآن دون تكرار
              </p>
            </div>
          </div>
          <div className="text-left bg-zinc-900/80 border border-zinc-800 px-4 py-2.5 rounded-xl shrink-0">
            <span className="text-[11px] text-zinc-400 block font-medium">
              إجمالي رأس مال بضائع الموردين
            </span>
            <span className="text-lg font-black text-emerald-400 font-mono tabular-nums" dir="ltr">
              {!showFinancials ? '••••••' : formatCurrency(
                supplierPerformanceData.grandCurrentStockCost,
                settings.currency,
                language
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. رأس مال البضاعة المتوفرة */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500">رأس مال البضاعة المتوفرة</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-xl font-black text-zinc-900 dark:text-white font-mono tabular-nums" dir="ltr">
            {!showFinancials ? '••••••' : formatCurrency(supplierPerformanceData.grandCurrentStockCost, settings.currency, language)}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            تكلفة شراء السلع الموجودة حالياً بالمحل
          </span>
        </div>

        {/* 2. إجمالي الأرباح المتوقعة */}
        <div className="bg-white dark:bg-zinc-900 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl p-4 shadow-xs bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">إجمالي الأرباح المتوقعة</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums" dir="ltr">
            {!showFinancials ? '••••••' : `+${formatCurrency(supplierPerformanceData.grandCurrentStockProfit, settings.currency, language)}`}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            صافي المكسب عند بيع المخزون ({supplierPerformanceData.grandCurrentStockMargin}% هامش)
          </span>
        </div>

        {/* 3. أعلى مورد في أرباح المخزون */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500">أعلى مورد في أرباح المخزون</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
              <Award size={16} />
            </div>
          </div>
          <div className="text-base font-black text-zinc-900 dark:text-white truncate">
            {supplierPerformanceData.topProfitSupplier ? supplierPerformanceData.topProfitSupplier.supplierName : 'لا توجد بضاعة متوفرة'}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 font-mono tabular-nums" dir="ltr">
            {supplierPerformanceData.topProfitSupplier && showFinancials
              ? `+${formatCurrency(supplierPerformanceData.topProfitSupplier.currentStockProfit, settings.currency, language)} (${formatQuantityWithGrouping(supplierPerformanceData.topProfitSupplier.currentStockPieces)} قطعة)`
              : '—'}
          </div>
        </div>

        {/* 4. القطع المتوفرة بالمحل */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500">القطع المتوفرة بالمحل</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Package size={16} />
            </div>
          </div>
          <div className="text-xl font-black text-zinc-900 dark:text-white font-mono tabular-nums" dir="ltr">
            {formatQuantityWithGrouping(supplierPerformanceData.grandCurrentStockPieces)} قطعة
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            عبر {supplierPerformanceData.suppliersWithStockCount} مورد لديهم بضاعة حالياً
          </span>
        </div>
      </div>

      {/* Controls: Search & Sort Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={supplierSearchQuery}
            onChange={(e) => setSupplierSearchQuery(e.target.value)}
            placeholder="ابحث باسم المورد أو رقم الهاتف أو نوع البضاعة..."
            className="w-full pr-9 pl-8 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {supplierSearchQuery && (
            <button
              type="button"
              onClick={() => setSupplierSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort Buttons */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/90 p-1 rounded-xl text-xs font-bold self-start sm:self-auto overflow-x-auto">
          <span className="text-[10px] text-zinc-400 px-2 hidden sm:inline">ترتيب حسب:</span>
          <button
            type="button"
            onClick={() => setSupplierSortBy('profit')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              supplierSortBy === 'profit'
                ? 'bg-emerald-600 text-white shadow-xs font-black'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            الأعلى ربحاً ⭐
          </button>
          <button
            type="button"
            onClick={() => setSupplierSortBy('purchases')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              supplierSortBy === 'purchases'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-black'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            قيمة البضاعة (رأس المال)
          </button>
          <button
            type="button"
            onClick={() => setSupplierSortBy('stock_qty')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              supplierSortBy === 'stock_qty'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-black'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            القطع المتوفرة
          </button>
          <button
            type="button"
            onClick={() => setSupplierSortBy('margin')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              supplierSortBy === 'margin'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-black'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            هامش الربحية (%)
          </button>
        </div>
      </div>

      {/* Supplier Performance Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-zinc-50/80 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold">
                <th className="py-3 px-4">المورد ونوع البضاعة</th>
                <th className="py-3 px-4">رأس مال بضاعته المتوفرة</th>
                <th className="py-3 px-4">القطع المتوفرة</th>
                <th className="py-3 px-4">الأصناف المتوفرة</th>
                <th className="py-3 px-4">معدل الهامش الربحي</th>
                <th className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-black">إجمالي الأرباح المتوقعة</th>
                <th className="py-3 px-4">آخر توريد</th>
                <th className="py-3 px-4">الأصناف المتوفرة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {supplierPerformanceData.suppliers
                .filter(s => {
                  if (!supplierSearchQuery.trim()) return true;
                  const q = supplierSearchQuery.toLowerCase().trim();
                  return s.supplierName.toLowerCase().includes(q) || 
                         s.typeOfGoods.toLowerCase().includes(q) ||
                         (s.phone && s.phone.includes(q));
                })
                .sort((a, b) => {
                  if (supplierSortBy === 'profit') return b.currentStockProfit - a.currentStockProfit;
                  if (supplierSortBy === 'purchases') return b.currentStockCost - a.currentStockCost;
                  if (supplierSortBy === 'stock_qty') return b.currentStockPieces - a.currentStockPieces;
                  if (supplierSortBy === 'margin') return b.avgMargin - a.avgMargin;
                  return 0;
                })
                .map((s, idx) => {
                  const isExpanded = expandedSupplierDetailsId === (s.supplierId || s.supplierName);

                  return (
                    <React.Fragment key={s.supplierId || s.supplierName || idx}>
                      <tr 
                        className={`transition-colors cursor-pointer ${
                          isExpanded ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                        }`}
                        onClick={() => setExpandedSupplierDetailsId(prev => prev === (s.supplierId || s.supplierName) ? null : (s.supplierId || s.supplierName))}
                      >
                        {/* 1. المورد */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                              s.isUnassigned
                                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            }`}>
                              {s.isUnassigned ? '؟' : idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-zinc-900 dark:text-white block text-sm">
                                  {s.supplierName}
                                </span>
                                {s.isUnassigned && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold">
                                    غير محدد
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-zinc-400">
                                {s.isUnassigned
                                  ? 'بضائع متوفرة لم يُحدد لها مورد بعد'
                                  : `${s.typeOfGoods || 'مورد عام'} ${s.phone ? `• ${s.phone}` : ''}`}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. رأس مال بضاعته بالمحل حالياً */}
                        <td className="py-3.5 px-4 font-black text-sm text-zinc-900 dark:text-white" dir="ltr">
                          {!showFinancials ? '••••••' : formatCurrency(s.currentStockCost, settings.currency, language)}
                        </td>

                        {/* 3. عدد القطع المتوفرة حالياً */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-xs ${
                            s.currentStockPieces > 0
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                          }`}>
                            <Package size={12} />
                            {formatQuantityWithGrouping(s.currentStockPieces)} قطعة
                          </span>
                        </td>

                        {/* 4. عدد الأصناف المتوفرة */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs">
                            {s.currentStockItemsCount} صنف متوفر
                          </span>
                        </td>

                        {/* 5. معدل الهامش الربحي */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-xs ${
                              s.avgMargin >= 20
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50'
                                : s.avgMargin >= 12
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50'
                            }`}>
                              <TrendingUp size={11} />
                              {s.avgMargin.toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* 6. إجمالي الأرباح المتوقعة من بضاعته بالمحل */}
                        <td className="py-3.5 px-4 font-black text-sm text-emerald-600 dark:text-emerald-400" dir="ltr">
                          {!showFinancials ? '••••••' : `+${formatCurrency(s.currentStockProfit, settings.currency, language)}`}
                        </td>

                        {/* 7. آخر توريد */}
                        <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                          {s.recentTxDate 
                            ? s.recentTxDate.toLocaleDateString(language === 'ar' ? 'ar-TN' : 'en-US', { day: 'numeric', month: 'short' })
                            : '—'}
                        </td>

                        {/* 8. زر عرض الأصناف */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedSupplierDetailsId(prev => prev === (s.supplierId || s.supplierName) ? null : (s.supplierId || s.supplierName));
                              }}
                              className={`p-1.5 px-3 rounded-lg transition-colors text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                                isExpanded
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                              }`}
                              title="عرض قائمة الأصناف المتوفرة من هذا المورد بالمحل"
                            >
                              <Package size={13} />
                              <span>عرض أصنافه ({s.currentStockItemsCount})</span>
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* صف تفاصيل أصناف المورد الموسعة */}
                      {isExpanded && (
                        <tr className="bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800">
                          <td colSpan={8} className="p-4">
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
                              {/* كروت ملخص سريعة لبضاعة المورد المتوفرة */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                <div className="bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-2.5">
                                  <span className="text-[11px] text-zinc-500 font-bold block mb-1">
                                    رأس مال بضاعته المتوفرة بالمحل
                                  </span>
                                  <span className="text-sm font-black text-zinc-900 dark:text-white" dir="ltr">
                                    {!showFinancials ? '••••••' : formatCurrency(s.currentStockCost, settings.currency, language)}
                                  </span>
                                </div>
                                <div className="bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-2.5">
                                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block mb-1">
                                    الأرباح المتوقعة من بيعها
                                  </span>
                                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
                                    {!showFinancials ? '••••••' : `+${formatCurrency(s.currentStockProfit, settings.currency, language)}`}
                                  </span>
                                </div>
                                <div className="bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-xl p-2.5">
                                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold block mb-1">
                                    إجمالي القطع بالمخزن
                                  </span>
                                  <span className="text-sm font-black text-purple-600 dark:text-purple-400 font-mono tabular-nums">
                                    {formatQuantityWithGrouping(s.currentStockPieces)} قطعة
                                  </span>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl p-2.5">
                                  <span className="text-[11px] text-zinc-500 font-bold block mb-1">
                                    الأصناف المتوفرة بالمحل
                                  </span>
                                  <span className="text-sm font-black text-zinc-800 dark:text-zinc-200">
                                    {s.currentStockItemsCount} صنف متوفر
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-zinc-900 dark:text-white">
                                    📦 أصناف المورد المتوفرة بالمحل: <span className="text-emerald-600 dark:text-emerald-400">{s.supplierName}</span>
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/50">
                                    مخزون فعلي متوفر حالياً بالمحل فقط
                                  </span>
                                </div>
                              </div>
                              
                              {s.items.length > 0 ? (
                                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                                  <table className="w-full text-right text-xs">
                                    <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 z-10">
                                      <tr className="text-zinc-400 font-bold border-b border-zinc-100 dark:border-zinc-800">
                                        <th className="py-2 px-3">اسم الصنف</th>
                                        <th className="py-2 px-3">الكمية المتوفرة بالمحل</th>
                                        <th className="py-2 px-3">سعر التكلفة</th>
                                        <th className="py-2 px-3">سعر البيع</th>
                                        <th className="py-2 px-3">ربح القطعة</th>
                                        <th className="py-2 px-3">هامش الربح (%)</th>
                                        <th className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-black">
                                          إجمالي الربح المتوقع
                                        </th>
                                        <th className="py-2 px-3">
                                          إجمالي رأس المال
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                      {s.items.map((item, iIdx) => (
                                        <tr key={iIdx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30">
                                          <td className="py-2 px-3 font-bold text-zinc-800 dark:text-zinc-200">{item.name}</td>
                                          <td className="py-2 px-3">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-black text-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 font-mono tabular-nums">
                                              {formatQuantityWithGrouping(item.currentStockQty)} قطعة
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 font-semibold text-zinc-600 dark:text-zinc-400" dir="ltr">
                                            {formatCurrency(item.costPrice, settings.currency, language)}
                                          </td>
                                          <td className="py-2 px-3 font-semibold text-zinc-900 dark:text-white" dir="ltr">
                                            {formatCurrency(item.sellPrice, settings.currency, language)}
                                          </td>
                                          <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                                            +{formatCurrency(item.unitProfit, settings.currency, language)}
                                          </td>
                                          <td className="py-2 px-3">
                                            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-black ${
                                              item.marginPct >= 20 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                              item.marginPct >= 10 ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' :
                                              'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                                            }`}>
                                              {item.marginPct.toFixed(1)}%
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
                                            +{formatCurrency(item.currentStockProfit, settings.currency, language)}
                                          </td>
                                          <td className="py-2 px-3 text-zinc-600 dark:text-zinc-300 font-semibold" dir="ltr">
                                            {formatCurrency(item.currentStockCost, settings.currency, language)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="py-4 px-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl text-center">
                                  <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                    لا توجد كميات حالية متبقية بالمخزن لهذا المورد.
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              {supplierPerformanceData.suppliers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    لا توجد بضائع متوفرة بالمخزن حالياً منسوبة للموردين
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

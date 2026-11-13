import React from 'react';
import { Truck, ChevronUp, ChevronDown, Layers, History } from 'lucide-react';
import { formatCurrency, formatQuantityWithGrouping } from '../../../../lib/utils';
import { UserSettings } from '../../../../types';
import { DayPurchasesGroup } from '../types';

interface PurchasesTabProps {
  dailyPurchases: DayPurchasesGroup[];
  expandedDayKey: string | null;
  setExpandedDayKey: (key: string | null) => void;
  expandedInvoiceId: string | null;
  setExpandedInvoiceId: (id: string | null) => void;
  settings: UserSettings;
}

export const PurchasesTab: React.FC<PurchasesTabProps> = ({
  dailyPurchases,
  expandedDayKey,
  setExpandedDayKey,
  expandedInvoiceId,
  setExpandedInvoiceId,
  settings,
}) => {
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Truck size={24} />
          </div>
          <div>
            <h3 className="font-black text-base text-zinc-900 dark:text-white">
              سجل حركة المشتريات اليومية
            </h3>
            <p className="text-xs text-zinc-500">
              إجمالي المبالغ المدفوعة لشراء البضائع موزعة حسب كل يوم
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-zinc-400 block">إجمالي مشتريات السجل</span>
          <span className="text-lg font-black text-blue-600 dark:text-blue-400">
            {!showFinancials ? '••••••' : formatCurrency(dailyPurchases.reduce((acc, d) => acc + d.total, 0), settings.currency, language)}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {dailyPurchases.length > 0 ? (
          dailyPurchases.map((day, i) => {
            const isExpanded = expandedDayKey === day.key;
            const categoriesList = Object.entries(day.categoriesBreakdown);

            return (
              <div
                key={day.key}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-brand-500/40"
              >
                {/* Day Summary Card (Clickable to expand details) */}
                <div 
                  onClick={() => setExpandedDayKey(isExpanded ? null : day.key)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0 font-black text-xs">
                      {i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-zinc-900 dark:text-white">
                          {day.date.toLocaleDateString(language === 'ar' ? 'ar-TN' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
                          {day.invoicesCount} {day.invoicesCount === 1 ? 'فاتورة' : 'فواتير'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {formatQuantityWithGrouping(day.totalItems)} صنف ({formatQuantityWithGrouping(day.totalPieces)} قطعة)
                        </span>
                      </div>
                      
                      {/* Quick categories chips summary */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {categoriesList.slice(0, 3).map(([catName, catData], cIdx) => (
                          <span 
                            key={cIdx} 
                            className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                          >
                            {catName}: <strong className="font-bold text-zinc-900 dark:text-white">{formatCurrency(catData.total, settings.currency, language)}</strong>
                          </span>
                        ))}
                        {categoriesList.length > 3 && (
                          <span className="text-[10px] text-zinc-400 font-bold">
                            +{categoriesList.length - 3} فئات أخرى
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
                    <div className="text-left">
                      <span className="text-[10px] text-zinc-400 block font-medium">إجمالي المشتريات اليومي</span>
                      <span className="text-base font-black text-zinc-900 dark:text-white">
                        {!showFinancials ? '••••••' : formatCurrency(day.total, settings.currency, language)}
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Detail Panel: Categories & Invoices breakdown */}
                {isExpanded && (
                  <div className="p-4 bg-zinc-50/70 dark:bg-zinc-950/40 border-t border-zinc-100 dark:border-zinc-800 space-y-5">
                    {/* 1. Category Breakdown */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Layers size={14} className="text-brand-500" />
                        <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                          توزيع المشتريات حسب الفئات والسلع
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {categoriesList.map(([catName, catData], idx) => {
                          const share = day.total > 0 ? (catData.total / day.total) * 100 : 0;
                          return (
                            <div 
                              key={idx} 
                              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-3 rounded-xl"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-zinc-900 dark:text-white">
                                  {catName}
                                </span>
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-sm bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400">
                                  {share.toFixed(0)}%
                                </span>
                              </div>
                              <div className="flex items-baseline justify-between">
                                <span className="text-[11px] text-zinc-400">
                                  {catData.count} عملية ({formatQuantityWithGrouping(catData.pieces)} ق)
                                </span>
                                <span className="text-xs font-black text-zinc-900 dark:text-white">
                                  {formatCurrency(catData.total, settings.currency, language)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Grouped Invoices breakdown */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Truck size={15} className="text-blue-500" />
                          <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                            فواتير المشتريات والتوريد ({day.invoicesCount} {day.invoicesCount === 1 ? 'فاتورة' : 'فواتير'})
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          اضغط على أي فاتورة لعرض تفاصيل السلع المشتراة
                        </span>
                      </div>

                      <div className="space-y-3">
                        {day.invoices.map((inv, invIdx) => {
                          const isInvoiceExpanded = expandedInvoiceId === inv.id;
                          return (
                            <div 
                              key={inv.id || invIdx}
                              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
                            >
                              {/* Invoice Card Header */}
                              <div 
                                onClick={() => setExpandedInvoiceId(isInvoiceExpanded ? null : inv.id)}
                                className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                              >
                                <div className="flex items-start sm:items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs shadow-xs">
                                    <Truck size={16} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white">
                                        {inv.supplierName}
                                      </span>
                                      {inv.hasExplicitInvoiceNumber ? (
                                        <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40">
                                          فاتورة #{inv.invoiceNumber}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                          فاتورة توريد يومية
                                        </span>
                                      )}
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                        {inv.category}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                                      <span className="font-medium">{inv.itemsCount} صنف</span>
                                      <span>•</span>
                                      <span className="font-medium">{formatQuantityWithGrouping(inv.totalPieces)} قطعة</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/60">
                                  <div className="text-left">
                                    <span className="text-[10px] text-zinc-400 block font-medium">إجمالي الفاتورة</span>
                                    <span className="text-sm font-black text-brand-600 dark:text-brand-400 tabular-nums">
                                      {!showFinancials ? '••••••' : formatCurrency(inv.totalAmount, settings.currency, language)}
                                    </span>
                                  </div>
                                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                                    {isInvoiceExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </div>
                                </div>
                              </div>

                              {/* Invoice Itemized Products Table */}
                              {isInvoiceExpanded && (
                                <div className="bg-zinc-50/90 dark:bg-zinc-950/60 border-t border-zinc-100 dark:border-zinc-800/80 p-3 sm:p-4">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-right text-xs">
                                      <thead>
                                        <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-400 text-[10px] font-bold">
                                          <th className="pb-2 pr-2">الصنف</th>
                                          <th className="pb-2 text-center">الكمية المشتراة</th>
                                          <th className="pb-2 text-center">سعر الشراء</th>
                                          <th className="pb-2 text-left pl-2">المجموع</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800/50">
                                        {inv.items.map((it, itIdx) => (
                                          <tr key={it.id || itIdx} className="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 transition-colors">
                                            <td className="py-2.5 pr-2">
                                              <span className="font-bold text-zinc-900 dark:text-white block">
                                                {it.name}
                                              </span>
                                              <div className="flex items-center gap-2 mt-0.5">
                                                {it.barcode && (
                                                  <span className="font-mono text-[10px] text-zinc-400">
                                                    {it.barcode}
                                                  </span>
                                                )}
                                                {it.note && (
                                                  <span className="text-[10px] text-zinc-400 italic">
                                                    ({it.note})
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-2.5 text-center">
                                              {it.numBoxes && it.numBoxes > 0 ? (
                                                <div>
                                                  <span className="font-bold text-zinc-900 dark:text-white">
                                                    {it.numBoxes} كرتونة
                                                  </span>
                                                  <span className="block text-[10px] text-zinc-400 font-mono">
                                                    ({formatQuantityWithGrouping(it.qtyAdded)} ق)
                                                  </span>
                                                </div>
                                              ) : (
                                                <span className="font-bold text-zinc-900 dark:text-white">
                                                  {formatQuantityWithGrouping(it.qtyAdded)} قطعة
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2.5 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300">
                                              {!showFinancials ? '••••••' : formatCurrency(it.price, settings.currency, language)}
                                            </td>
                                            <td className="py-2.5 text-left pl-2 font-mono font-black text-zinc-900 dark:text-white">
                                              {!showFinancials ? '••••••' : formatCurrency(it.amount, settings.currency, language)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr className="border-t-2 border-zinc-200 dark:border-zinc-800 font-black text-xs text-zinc-900 dark:text-white">
                                          <td className="pt-2 pr-2">الإجمالي ({inv.itemsCount} صنف):</td>
                                          <td className="pt-2 text-center text-brand-600 dark:text-brand-400">
                                            {formatQuantityWithGrouping(inv.totalPieces)} قطعة
                                          </td>
                                          <td className="pt-2 text-center text-zinc-400">-</td>
                                          <td className="pt-2 text-left pl-2 text-brand-600 dark:text-brand-400">
                                            {!showFinancials ? '••••••' : formatCurrency(inv.totalAmount, settings.currency, language)}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
              <History size={24} />
            </div>
            <h4 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">لا توجد عمليات مشتريات مسجلة بعد</h4>
            <p className="text-xs text-zinc-400 mt-1">عند تسجيل فواتير شراء من الموردين، ستظهر مجاميعها اليومية هنا تلقائياً.</p>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { TrendingDown, AlertCircle, AlertTriangle, Eye } from 'lucide-react';
import { PriceHikeSummary } from '../../types';
import { formatCurrency, formatQuantity } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import { PriceHikeDetailsModal } from '../dashboard/PriceHikeDetailsModal';

interface PriceHikeReportCardProps {
  summary?: PriceHikeSummary | null;
}

export const PriceHikeReportCard: React.FC<PriceHikeReportCardProps> = ({ summary }) => {
  const { settings } = useAppContext();
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const currency = settings.currency || 'د.ت';
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  if (!summary) return null;

  const {
    totalBookProfit = 0,
    totalPriceHikeLoss = 0,
    realProfit = 0,
    priceHikeSinceLastJard = 0,
    topImpactedItems = [],
    isEstimatedOpening = false,
  } = summary;

  const isRealProfitNegative = realProfit < 0;

  const fmt = (val: number) =>
    !showFinancials ? '••••••' : formatCurrency(val, currency, language);

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800/80 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2">
            <TrendingDown size={18} className="text-rose-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              تحليل أثر ارتفاع الأسعار على الأرباح (الدفعات الفعلية)
            </h3>
          </div>
          {isEstimatedOpening && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <AlertCircle size={13} />
              تكلفة افتتاحية تقديرية
            </span>
          )}
        </div>

        {/* Supplier Price Hike Impact Banner */}
        {priceHikeSinceLastJard > 0 && (
          <div className="bg-rose-50/90 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-200/70 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs">
                -
              </div>
              <div>
                <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                  إجمالي ارتفاع أسعار الشراء من الموردين (فوارق كلفة التوريد)
                </p>
                <p className="text-[11px] text-rose-700/80 dark:text-rose-400">
                  فوارق تكلفة إضافية من جيب التاجر لا يمكن تعويضها بسبب قيود سعر السوق
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="font-mono text-base font-black text-rose-700 dark:text-rose-300">
                -{fmt(priceHikeSinceLastJard)}
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(true)}
                className="flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 text-xs font-bold transition-all shadow-xs"
              >
                <Eye size={13} />
                <span>عرض المنتجات</span>
              </button>
            </div>
          </div>
        )}

      {totalBookProfit === 0 && totalPriceHikeLoss === 0 && (
        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-amber-600" />
          <span>
            لم تُسجل مبيعات خروج في هذا الجرد بعد (كامل البضاعة في المخزن). الخسارة المباشرة الحالية هي فوارق كلفة الشراء المدفوعة للموردين <strong>({priceHikeSinceLastJard > 0 ? fmt(priceHikeSinceLastJard) : fmt(0)})</strong> والتي ستقتطع من أرباحك عند بيعها بسعر السوق الحالي.
          </span>
        </div>
      )}

      {/* 3-Line Financial Summary */}
      <div className="grid grid-cols-1 divide-y divide-zinc-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse dark:divide-zinc-800">
        {/* Line 1: Book Profit */}
        <div className="p-4 text-center sm:text-right">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            الربح الدفتري
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-zinc-900 dark:text-white">
            {fmt(totalBookProfit)}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            الإيراد المحسوب − تكلفة الدفعات المباعة
          </p>
        </div>

        {/* Line 2: Price Hike Loss */}
        <div className="p-4 text-center sm:text-right">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
            خسارة الغلاء
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {totalPriceHikeLoss > 0 ? `- ${fmt(totalPriceHikeLoss)}` : fmt(0)}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            مجموع المباع × (سعر آخر دفعة − سعر الدفعة المباعة)
          </p>
        </div>

        {/* Line 3: Real Profit */}
        <div
          className={`p-4 text-center sm:text-right transition-colors ${
            isRealProfitNegative
              ? 'bg-rose-50/60 dark:bg-rose-950/20'
              : 'bg-emerald-50/40 dark:bg-emerald-950/20'
          }`}
        >
          <p
            className={`text-xs font-semibold ${
              isRealProfitNegative
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            الربح الحقيقي
          </p>
          <p
            className={`mt-1 font-mono text-xl font-extrabold tabular-nums ${
              isRealProfitNegative
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {fmt(realProfit)}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            الربح الدفتري − خسارة الغلاء (القدرة الفعلية على إعادة التموين)
          </p>
        </div>
      </div>

      {/* Top 10 Price-Hiked Items Table */}
      {topImpactedItems && topImpactedItems.length > 0 && (
        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              أعلى {topImpactedItems.length} أصناف تضرراً من ارتفاع سعر الشراء
            </h4>
            <span className="text-[11px] text-zinc-400">
              الأصناف ذات الخسائر الموجبة الصافية
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 dark:border-zinc-800">
                  <th className="pb-2 font-medium">الصنف</th>
                  <th className="pb-2 text-center font-medium">سعر الدفعة المباعة</th>
                  <th className="pb-2 text-center font-medium">سعر آخر دفعة</th>
                  <th className="pb-2 text-center font-medium">الكمية المباعة</th>
                  <th className="pb-2 text-left font-medium">خسارة الغلاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                {topImpactedItems.map((item, idx) => (
                  <tr
                    key={`${item.productId || item.barcode}_${idx}`}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                  >
                    <td className="py-2.5">
                      <div className="font-semibold text-zinc-900 dark:text-white">
                        {item.productName}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        {item.barcode && (
                          <span className="font-mono tabular-nums">{item.barcode}</span>
                        )}
                        {item.matchType === 'name' && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                            <AlertTriangle size={11} />
                            مطابقة بالاسم، راجعه
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 text-center font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
                      {fmt(item.batchCost)}
                    </td>
                    <td className="py-2.5 text-center font-mono tabular-nums text-rose-600 dark:text-rose-400">
                      {fmt(item.latestCost)}
                    </td>
                    <td className="py-2.5 text-center font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                      {formatQuantity(item.sold)}
                    </td>
                    <td className="py-2.5 text-left font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      -{fmt(item.loss)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>

    <PriceHikeDetailsModal
      isOpen={showDetailsModal}
      onClose={() => setShowDetailsModal(false)}
    />
  </>
);
};


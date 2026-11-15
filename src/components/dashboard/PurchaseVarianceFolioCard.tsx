import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import {
  formatBoxesAndPieces,
  PurchaseVarianceAnalysisResult,
} from '../../lib/purchaseVarianceCalculator';
import { formatCurrency } from '../../lib/utils';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';
import { useFolioTheme } from '../folio/FolioPageChrome';
import { matchesQuery } from './PurchaseVarianceModal';

interface PurchaseVarianceFolioCardProps {
  analysis: PurchaseVarianceAnalysisResult;
  currency: string;
  language: string;
  showFinancials: boolean;
  darkMode: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenModal: () => void;
  themeOverride?: FolioTheme;
  sectionIndex?: string;
}

export const PurchaseVarianceFolioCard: React.FC<
  PurchaseVarianceFolioCardProps
> = ({
  analysis,
  currency,
  language,
  showFinancials,
  darkMode,
  isCollapsed,
  onToggleCollapse,
  onOpenModal,
  themeOverride,
  sectionIndex = '04',
}) => {
  const { theme: liveTheme } = useFolioTheme(darkMode);
  const theme = themeOverride || liveTheme;

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'loss' | 'diff' | 'max'>('loss');

  const fmtVal = (val: number) => {
    if (!showFinancials) return '••••••';
    return formatCurrency(val, currency, language);
  };

  const tableGroups = useMemo(() => {
    const q = searchQuery.trim();
    const list = (analysis.productGroups || []).filter((g) => {
      if (g.totalLoss <= 0.0001 && !q) return false;
      if (!q) return true;
      return (
        matchesQuery(g.name, q) ||
        matchesQuery(g.barcode, q) ||
        g.batches.some((b) => matchesQuery(b.supplierName, q))
      );
    });

    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'diff') return b.boxPriceDifference - a.boxPriceDifference;
      if (sortBy === 'max') return b.maxBoxPrice - a.maxBoxPrice;
      return b.totalLoss - a.totalLoss;
    });

    return sorted.slice(0, q ? 12 : 6);
  }, [analysis.productGroups, searchQuery, sortBy]);

  if (isCollapsed) {
    return (
      <div
        onClick={onToggleCollapse}
        dir="rtl"
        className="cursor-pointer select-none border px-4 py-3 flex items-center justify-between gap-3 transition-colors"
        style={{
          backgroundColor: theme.surface,
          borderColor: theme.border,
          color: theme.text,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-xs font-mono font-bold tabular-nums shrink-0"
            style={{ color: theme.accent }}
          >
            {sectionIndex}
          </span>
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-black truncate block">
              إجمالي فرق الشراء بالمخزون
            </span>
            <span
              className="text-[11px] hidden sm:inline"
              style={{ color: theme.textMuted }}
            >
              (مطوي — انقر لعرض جدول فروقات الأسعار)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {analysis.affectedProductsCount > 0 && (
            <span
              className="font-mono tabular-nums text-[11px] font-bold px-2 py-0.5 border"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              {analysis.affectedProductsCount} أصناف متأثرة
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.text,
            }}
          >
            <span>إظهار</span>
            <ChevronDown size={14} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <section
      dir="rtl"
      className="border transition-colors text-right"
      style={{
        backgroundColor: theme.bg,
        borderColor: theme.border,
        color: theme.text,
      }}
    >
      {/* Editorial Entry Header + 3-Cell KPI Strip */}
      <div
        className="p-4 sm:p-5 border-b space-y-4"
        style={{
          backgroundColor: theme.surface,
          borderColor: theme.border,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span
                className="font-mono tabular-nums"
                style={{ color: theme.accent }}
              >
                {sectionIndex}
              </span>
              <span style={{ color: theme.textMuted }}>
                تباين أسعار شراء المخزون الحالي
              </span>
            </div>
            <h2
              className="text-base sm:text-xl font-black tracking-tight leading-snug"
              style={{ color: theme.text }}
            >
              إجمالي فرق الشراء بالمخزون
            </h2>
            <p className="text-[11px]" style={{ color: theme.textMuted }}>
              مقارنة أرخص دفعة مرجعية بأغلى سعر شراء للكميات المتوفرة الآن
              بالمتجر.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenModal}
              className="px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: theme.text,
                color: theme.surface,
                borderColor: theme.text,
              }}
            >
              التفاصيل الكاملة
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              title="طي البطاقة"
              aria-label="طي البطاقة"
              className="p-1.5 border transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.textMuted,
              }}
            >
              <ChevronUp size={15} />
            </button>
          </div>
        </div>

        {/* 3 Folio KPIs */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 border divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse"
          style={{
            backgroundColor: theme.bg,
            borderColor: theme.border,
          }}
        >
          <div className="p-3.5 sm:p-4 space-y-1" style={{ borderColor: theme.border }}>
            <div
              className="text-[11px] font-bold"
              style={{ color: theme.textMuted }}
            >
              إجمالي فرق الشراء (الخسارة)
            </div>
            <div
              className="text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight"
              style={{
                color:
                  analysis.totalPurchasesLoss > 0.0001
                    ? theme.negative
                    : theme.text,
              }}
            >
              {fmtVal(analysis.totalPurchasesLoss)}
            </div>
          </div>

          <div className="p-3.5 sm:p-4 space-y-1" style={{ borderColor: theme.border }}>
            <div
              className="text-[11px] font-bold"
              style={{ color: theme.textMuted }}
            >
              توفير الدفعة الأرخص (للعلم)
            </div>
            <div
              className="text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight"
              style={{ color: theme.positive }}
            >
              {fmtVal(analysis.totalCheapestBatchSavings)}
            </div>
          </div>

          <div className="p-3.5 sm:p-4 space-y-1" style={{ borderColor: theme.border }}>
            <div
              className="text-[11px] font-bold"
              style={{ color: theme.textMuted }}
            >
              الأصناف المتأثرة
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight"
                style={{ color: theme.text }}
              >
                {analysis.affectedProductsCount}
              </span>
              <span
                className="text-[11px] font-mono tabular-nums"
                style={{ color: theme.textMuted }}
              >
                عبر {analysis.lossMakingSuppliers.length} مورد
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Sort + Direct Folio Table */}
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div
            className="flex items-center gap-2 px-3 py-1.5 border flex-1 max-w-xs"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
            }}
          >
            <Search size={13} style={{ color: theme.textMuted }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالصنف، الباركود، أو المورد..."
              className="bg-transparent text-xs w-full focus:outline-none"
              style={{ color: theme.text }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="مسح البحث"
                className="cursor-pointer"
                style={{ color: theme.textMuted }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'loss', label: 'الأكبر خسارة' },
              { id: 'diff', label: 'أعلى فرق كرتونة' },
              { id: 'max', label: 'الأغلى سعراً' },
            ].map((s) => {
              const active = sortBy === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSortBy(s.id as any)}
                  className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: active ? theme.text : theme.surface,
                    color: active ? theme.surface : theme.text,
                    borderColor: active ? theme.text : theme.border,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {tableGroups.length === 0 ? (
          <div
            className="border p-6 text-center text-xs font-bold"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.textMuted,
            }}
          >
            {searchQuery
              ? 'لا توجد أصناف مطابقة لبحثك في فروقات الشراء.'
              : 'ممتاز! جميع دفعات المخزون المتوفرة حالياً مشتراة بأدنى سعر دون أي فروقات سلبية.'}
          </div>
        ) : (
          <div
            className="border overflow-x-auto"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
            }}
          >
            <table className="w-full text-right text-xs">
              <thead>
                <tr
                  className="border-b font-bold"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceMuted,
                    color: theme.textMuted,
                  }}
                >
                  <th className="py-2.5 px-3">الصنف</th>
                  <th className="py-2.5 px-3">أرخص كرتونة</th>
                  <th className="py-2.5 px-3">أغلى كرتونة</th>
                  <th className="py-2.5 px-3">فرق الكرتونة</th>
                  <th className="py-2.5 px-3">الخسارة الإجمالية</th>
                </tr>
              </thead>
              <tbody>
                {tableGroups.map((g) => (
                  <tr
                    key={g.groupKey}
                    onClick={onOpenModal}
                    className="border-b last:border-b-0 transition-colors cursor-pointer"
                    style={{ borderColor: theme.border, color: theme.text }}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-bold leading-snug">{g.name}</div>
                      <div
                        className="text-[10px] font-mono tabular-nums"
                        style={{ color: theme.textMuted }}
                      >
                        {g.batches.length} دفعة ·{' '}
                        {formatBoxesAndPieces(g.totalQuantity, g.piecesPerBox)}
                      </div>
                    </td>
                    <td
                      className="py-2.5 px-3 font-mono tabular-nums font-bold"
                      style={{ color: theme.positive }}
                    >
                      {fmtVal(g.minBoxPrice)}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">
                      {fmtVal(g.maxBoxPrice)}
                    </td>
                    <td
                      className="py-2.5 px-3 font-mono tabular-nums font-bold"
                      style={{
                        color:
                          g.boxPriceDifference > 0.0001
                            ? theme.negative
                            : theme.textMuted,
                      }}
                    >
                      {g.boxPriceDifference > 0.0001
                        ? `+${fmtVal(g.boxPriceDifference)}`
                        : fmtVal(0)}
                    </td>
                    <td
                      className="py-2.5 px-3 font-mono tabular-nums font-black"
                      style={{
                        color:
                          g.totalLoss > 0.0001
                            ? theme.negative
                            : theme.positive,
                      }}
                    >
                      {fmtVal(g.totalLoss)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Package,
  Palette,
  Search,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import {
  formatBoxesAndPieces,
  PurchaseVarianceAnalysisResult,
} from '../../lib/purchaseVarianceCalculator';
import { formatCurrency } from '../../lib/utils';
import { FOLIO_THEMES } from '../inventory/analytics/folio/folioThemes';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';

interface PurchaseVarianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: PurchaseVarianceAnalysisResult;
  currency: string;
  language?: string;
  darkMode?: boolean;
  showFinancials?: boolean;
}

export const normalizeArabic = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[يى]/g, 'ي')
    .replace(/ة/g, 'ه');
};

export const matchesQuery = (
  text: string | undefined | null,
  query: string,
): boolean => {
  if (!text) return false;
  if (!query || !query.trim()) return true;
  const normText = normalizeArabic(text);
  const normQuery = normalizeArabic(query);
  return normText.includes(normQuery);
};

export const createArabicHighlightRegex = (query: string): RegExp | null => {
  if (!query || !query.trim()) return null;
  const q = query.trim();
  let pattern = '';
  for (const ch of q) {
    if (/[اأإآٱ]/.test(ch)) {
      pattern += '[اأإآٱ]';
    } else if (/[هة]/.test(ch)) {
      pattern += '[هة]';
    } else if (/[يى]/.test(ch)) {
      pattern += '[يى]';
    } else if (/[.*+?^${}()|[\]\\]/.test(ch)) {
      pattern += '\\' + ch;
    } else {
      pattern += ch;
    }
  }
  try {
    return new RegExp(`(${pattern})`, 'gi');
  } catch {
    return null;
  }
};

const highlightMatch = (
  text: string,
  query: string,
  accentColor: string,
) => {
  if (!text || !query || !query.trim()) return text;
  const regex = createArabicHighlightRegex(query);
  if (!regex) return text;
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  return (
    <span>
      {parts.map((part, i) =>
        matchesQuery(part, query) && part.length > 0 ? (
          <mark
            key={i}
            className="px-1 font-black underline"
            style={{
              backgroundColor: 'transparent',
              color: accentColor,
            }}
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
};

export const PurchaseVarianceModal: React.FC<PurchaseVarianceModalProps> = ({
  isOpen,
  onClose,
  analysis,
  currency,
  language = 'ar',
  darkMode = false,
  showFinancials = true,
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'suppliers'>(
    'products',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyLossItems, setOnlyLossItems] = useState(true);
  const [expandedProductKeys, setExpandedProductKeys] = useState<
    Record<string, boolean>
  >({});
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<
    Record<string, boolean>
  >({});
  const [showAllSupplierBatches, setShowAllSupplierBatches] = useState<
    Record<string, boolean>
  >({});

  const [themeId, setThemeId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('folio_theme_id');
      if (saved && FOLIO_THEMES.some((t) => t.id === saved)) return saved;
    } catch {}
    return darkMode ? 'folio-night' : 'folio-editorial';
  });
  const [showThemePicker, setShowThemePicker] = useState(false);

  const theme: FolioTheme = useMemo(
    () => FOLIO_THEMES.find((t) => t.id === themeId) || FOLIO_THEMES[0],
    [themeId],
  );

  const handleSelectTheme = (id: string) => {
    setThemeId(id);
    setShowThemePicker(false);
    try {
      localStorage.setItem('folio_theme_id', id);
    } catch {}
  };

  const fmtVal = (val: number) => {
    if (!showFinancials) return '••••••';
    return formatCurrency(val, currency, language);
  };

  const toggleShowAllSupplierBatches = (
    supKey: string,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    setShowAllSupplierBatches((prev) => ({ ...prev, [supKey]: !prev[supKey] }));
  };

  const toggleProduct = (key: string) => {
    setExpandedProductKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSupplier = (key: string) => {
    setExpandedSupplierIds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const productGroups = analysis?.productGroups || [];
  const lossMakingSuppliers = analysis?.lossMakingSuppliers || [];

  const filteredProducts = productGroups.filter((group) => {
    if (onlyLossItems && group.totalLoss <= 0.0001) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim();
    const nameMatch = matchesQuery(group.name, q);
    const barcodeMatch = matchesQuery(group.barcode, q);
    const supplierMatch = group.batches.some((b) =>
      matchesQuery(b.supplierName, q),
    );
    return nameMatch || barcodeMatch || supplierMatch;
  });

  const filteredSuppliers = lossMakingSuppliers.filter((sup) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim();
    const nameMatch = matchesQuery(sup.supplierName, q);
    const prodMatch = sup.affectedBatches.some(
      (b) => matchesQuery(b.productName, q) || matchesQuery(b.barcode, q),
    );
    return nameMatch || prodMatch;
  });

  const maxSupplierLoss = useMemo(
    () => Math.max(1, ...filteredSuppliers.map((s) => s.totalLoss)),
    [filteredSuppliers],
  );

  const bestSuppliersForQuery = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];

    const matchingGroups = (analysis?.productGroups || []).filter(
      (g) => matchesQuery(g.name, q) || matchesQuery(g.barcode, q),
    );

    const results: Array<{
      productName: string;
      barcode?: string;
      supplierName: string;
      boxPrice: number;
      piecesPerBox: number;
      quantity: number;
      maxDifference: number;
    }> = [];

    for (const group of matchingGroups) {
      const refBatch =
        group.batches.find((b) => b.isReference) ||
        group.batches[group.batches.length - 1];
      if (refBatch) {
        results.push({
          productName: group.name,
          barcode: group.barcode,
          supplierName: refBatch.supplierName || 'دفعة مسجلة بدون مورد',
          boxPrice: refBatch.boxPurchasePrice,
          piecesPerBox: refBatch.piecesPerBox,
          quantity: refBatch.quantity,
          maxDifference: group.boxPriceDifference,
        });
      }
    }
    return results;
  }, [analysis?.productGroups, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs overflow-hidden"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl border flex flex-col h-full sm:h-auto sm:max-h-[92vh] shadow-2xl overflow-hidden transition-colors"
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
          color: theme.text,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* FOLIO EDITORIAL MODAL HEADER */}
        <div
          className="px-4 py-3.5 sm:px-6 sm:py-4 border-b flex items-start justify-between gap-3 shrink-0"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
          }}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span
                className="font-mono tabular-nums"
                style={{ color: theme.accent }}
              >
                01
              </span>
              <span style={{ color: theme.textMuted }}>
                تباين أسعار شراء المخزون الحالي
              </span>
            </div>
            <h2
              className="text-base sm:text-xl font-black tracking-tight leading-tight"
              style={{ color: theme.text }}
            >
              تحليل فروقات وخسائر شراء المخزون
            </h2>
            <p
              className="text-[11px] hidden sm:block"
              style={{ color: theme.textMuted }}
            >
              مقارنة أرخص دفعة مرجعية (الدائرة المفرغة) مقابل الدفعات الأعلى سعراً
              (الدائرة الملونة) لكل صنف ومورد.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowThemePicker((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold border transition-colors cursor-pointer"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text,
                }}
                title="تغيير ثيم العرض"
              >
                <Palette size={13} style={{ color: theme.accent }} />
                <span className="hidden sm:inline">{theme.name}</span>
              </button>

              {showThemePicker && (
                <div
                  className="absolute left-0 mt-1.5 w-48 border shadow-xl z-50 p-1 space-y-0.5"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  }}
                >
                  {FOLIO_THEMES.map((th) => {
                    const selected = th.id === theme.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => handleSelectTheme(th.id)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-bold cursor-pointer"
                        style={{
                          backgroundColor: selected
                            ? theme.surfaceMuted
                            : 'transparent',
                          color: theme.text,
                        }}
                      >
                        <span>{th.name}</span>
                        <span className="flex items-center gap-0.5">
                          {th.series.slice(0, 3).map((col, idx) => (
                            <span
                              key={idx}
                              className="w-2 h-2 inline-block"
                              style={{ backgroundColor: col }}
                            />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="p-1.5 border transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="overflow-y-auto flex-1 flex flex-col">
          {/* FOLIO 3-CELL KPI STRIP */}
          <div
            className="p-3 sm:px-6 sm:py-4 border-b shrink-0"
            style={{ borderColor: theme.border }}
          >
            <div
              className="grid grid-cols-3 border divide-x divide-x-reverse"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
              }}
            >
              <div
                className="p-2.5 sm:p-4 space-y-1"
                style={{ borderColor: theme.border }}
              >
                <div
                  className="text-[10px] sm:text-xs font-bold leading-tight"
                  style={{ color: theme.textMuted }}
                >
                  إجمالي الخسارة
                </div>
                <div
                  className="text-sm sm:text-2xl font-black font-mono tabular-nums tracking-tight"
                  style={{
                    color:
                      analysis.totalPurchasesLoss > 0.0001
                        ? theme.negative
                        : theme.text,
                  }}
                >
                  {fmtVal(analysis.totalPurchasesLoss)}
                </div>
                <div
                  className="text-[10px] hidden sm:block"
                  style={{ color: theme.textMuted }}
                >
                  مقارنةً بالأرخص
                </div>
              </div>

              <div
                className="p-2.5 sm:p-4 space-y-1"
                style={{ borderColor: theme.border }}
              >
                <div
                  className="text-[10px] sm:text-xs font-bold leading-tight"
                  style={{ color: theme.textMuted }}
                >
                  توفير الأرخص
                </div>
                <div
                  className="text-sm sm:text-2xl font-black font-mono tabular-nums tracking-tight"
                  style={{ color: theme.positive }}
                >
                  {fmtVal(analysis.totalCheapestBatchSavings)}
                </div>
                <div
                  className="text-[10px] hidden sm:block"
                  style={{ color: theme.textMuted }}
                >
                  مقارنةً بالأغلى (للعلم)
                </div>
              </div>

              <div
                className="p-2.5 sm:p-4 space-y-1"
                style={{ borderColor: theme.border }}
              >
                <div
                  className="text-[10px] sm:text-xs font-bold leading-tight"
                  style={{ color: theme.textMuted }}
                >
                  الأصناف المتأثرة
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-sm sm:text-2xl font-black font-mono tabular-nums tracking-tight"
                    style={{ color: theme.text }}
                  >
                    {analysis.affectedProductsCount}
                  </span>
                  <span
                    className="text-[10px] font-mono tabular-nums"
                    style={{ color: theme.textMuted }}
                  >
                    / {analysis.totalProductsAnalyzed}
                  </span>
                </div>
                <div
                  className="text-[10px] hidden sm:block"
                  style={{ color: theme.textMuted }}
                >
                  دفعات متفاوتة السعر
                </div>
              </div>
            </div>
          </div>

          {/* STICKY FOLIO CONTROL BAR (TABS + SEARCH + FILTER) */}
          <div
            className="sticky top-0 z-20 px-3 py-2.5 sm:px-6 sm:py-3 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
            }}
          >
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor:
                    activeTab === 'products' ? theme.text : theme.surfaceMuted,
                  color:
                    activeTab === 'products' ? theme.surface : theme.textMuted,
                  borderColor:
                    activeTab === 'products' ? theme.text : theme.border,
                }}
              >
                <Package size={13} />
                <span>01 · حسب الأصناف</span>
                <span
                  className="font-mono tabular-nums text-[10px] px-1"
                  style={{
                    color:
                      activeTab === 'products' ? theme.surface : theme.accent,
                  }}
                >
                  ({analysis.affectedProductsCount})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('suppliers')}
                className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor:
                    activeTab === 'suppliers' ? theme.text : theme.surfaceMuted,
                  color:
                    activeTab === 'suppliers' ? theme.surface : theme.textMuted,
                  borderColor:
                    activeTab === 'suppliers' ? theme.text : theme.border,
                }}
              >
                <Truck size={13} />
                <span>02 · حسب الموردين</span>
                <span
                  className="font-mono tabular-nums text-[10px] px-1"
                  style={{
                    color:
                      activeTab === 'suppliers' ? theme.surface : theme.accent,
                  }}
                >
                  ({analysis.lossMakingSuppliers.length})
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:max-w-md justify-end">
              <div
                className="flex items-center gap-2 px-3 py-1.5 border flex-1"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                }}
              >
                <Search size={13} style={{ color: theme.textMuted }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'products'
                      ? 'بحث بالاسم، الباركود، المورد...'
                      : 'بحث باسم المورد أو الصنف...'
                  }
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

              {activeTab === 'products' && (
                <button
                  type="button"
                  onClick={() => setOnlyLossItems(!onlyLossItems)}
                  className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: onlyLossItems
                      ? theme.accent
                      : theme.surfaceMuted,
                    color: onlyLossItems ? theme.accentText : theme.text,
                    borderColor: onlyLossItems ? theme.accent : theme.border,
                  }}
                  title="عرض الأصناف التي تحتوي فروقات خسارة فقط"
                >
                  {onlyLossItems ? 'المتأثرة فقط' : 'الكل'}
                </button>
              )}
            </div>
          </div>

          {/* LIST CONTENT */}
          <div className="p-3 sm:p-6 space-y-3 flex-1">
            {activeTab === 'products' ? (
              filteredProducts.length === 0 ? (
                <div
                  className="border p-10 text-center space-y-2"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  }}
                >
                  <CheckCircle2
                    size={26}
                    className="mx-auto"
                    style={{ color: theme.positive }}
                  />
                  <p
                    className="text-xs sm:text-sm font-black"
                    style={{ color: theme.text }}
                  >
                    لا توجد فروقات أسعار سلبية في المخزون
                  </p>
                  <p className="text-[11px]" style={{ color: theme.textMuted }}>
                    جميع الأصناف المطابقة تم شراؤها بنفس السعر أو بدفعة واحدة.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredProducts.map((item, idx) => {
                    const isExpanded =
                      expandedProductKeys[item.groupKey] ?? false;
                    const hasLoss = item.totalLoss > 0.0001;
                    const diffPct =
                      item.minBoxPrice > 0
                        ? Number(
                            (
                              (item.boxPriceDifference / item.minBoxPrice) *
                              100
                            ).toFixed(1),
                          )
                        : 0;

                    return (
                      <div
                        key={item.groupKey}
                        className="border transition-colors overflow-hidden text-right"
                        style={{
                          backgroundColor: theme.surface,
                          borderColor: isExpanded ? theme.accent : theme.border,
                        }}
                      >
                        <div
                          onClick={() => toggleProduct(item.groupKey)}
                          className="p-3.5 sm:p-4 cursor-pointer select-none space-y-3"
                        >
                          {/* Top Editorial Row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-[11px] font-mono font-bold tabular-nums"
                                  style={{ color: theme.accent }}
                                >
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                                <h3
                                  className="text-xs sm:text-sm font-black leading-snug"
                                  style={{ color: theme.text }}
                                >
                                  {highlightMatch(
                                    item.name,
                                    searchQuery,
                                    theme.accent,
                                  )}
                                </h3>
                                {item.barcode && (
                                  <span
                                    className="font-mono tabular-nums text-[10px] px-1.5 py-0.5 border"
                                    style={{
                                      backgroundColor: theme.surfaceMuted,
                                      borderColor: theme.border,
                                      color: theme.textMuted,
                                    }}
                                  >
                                    {item.barcode}
                                  </span>
                                )}
                                {item.matchedByName && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 border inline-flex items-center gap-1"
                                    style={{
                                      borderColor: theme.neutral,
                                      color: theme.neutral,
                                    }}
                                  >
                                    <AlertCircle size={10} />
                                    <span>مطابقة بالاسم</span>
                                  </span>
                                )}
                              </div>
                              <div
                                className="text-[11px] flex items-center gap-2 flex-wrap"
                                style={{ color: theme.textMuted }}
                              >
                                <span>
                                  المخزون:{' '}
                                  <strong style={{ color: theme.text }}>
                                    {formatBoxesAndPieces(
                                      item.totalQuantity,
                                      item.piecesPerBox,
                                    )}
                                  </strong>
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {item.batches.length} دفعة
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <div className="text-left">
                                <div
                                  className="text-[10px] font-bold"
                                  style={{ color: theme.textMuted }}
                                >
                                  الخسارة {diffPct > 0 ? `(+${diffPct}%)` : ''}
                                </div>
                                <div
                                  className="text-sm sm:text-base font-black font-mono tabular-nums leading-tight"
                                  style={{
                                    color: hasLoss
                                      ? theme.negative
                                      : theme.positive,
                                  }}
                                >
                                  {fmtVal(item.totalLoss)}
                                </div>
                              </div>
                              <div
                                className="p-1 border"
                                style={{
                                  backgroundColor: theme.surfaceMuted,
                                  borderColor: theme.border,
                                  color: theme.textMuted,
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronUp size={14} />
                                ) : (
                                  <ChevronDown size={14} />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 4-Column Tabular Metrics Strip */}
                          <div
                            className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t text-[11px]"
                            style={{ borderColor: theme.border }}
                          >
                            <div>
                              <span style={{ color: theme.textMuted }}>
                                أرخص كرتونة:
                              </span>
                              <div
                                className="font-mono tabular-nums font-bold"
                                style={{ color: theme.positive }}
                              >
                                {fmtVal(item.minBoxPrice)}
                              </div>
                            </div>
                            <div>
                              <span style={{ color: theme.textMuted }}>
                                أغلى كرتونة:
                              </span>
                              <div
                                className="font-mono tabular-nums font-bold"
                                style={{ color: theme.text }}
                              >
                                {fmtVal(item.maxBoxPrice)}
                              </div>
                            </div>
                            <div>
                              <span style={{ color: theme.textMuted }}>
                                فرق الكرتونة:
                              </span>
                              <div
                                className="font-mono tabular-nums font-bold"
                                style={{ color: theme.negative }}
                              >
                                {item.boxPriceDifference > 0.0001
                                  ? `+${fmtVal(item.boxPriceDifference)}`
                                  : fmtVal(0)}
                              </div>
                            </div>
                            <div>
                              <span style={{ color: theme.textMuted }}>
                                توفير الأرخص:
                              </span>
                              <div
                                className="font-mono tabular-nums font-bold"
                                style={{ color: theme.positive }}
                              >
                                {fmtVal(item.cheapestBatchSaving)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Batches in Folio Table */}
                        {isExpanded && (
                          <div
                            className="border-t p-3 sm:p-4 space-y-2"
                            style={{
                              borderColor: theme.border,
                              backgroundColor: theme.bg,
                            }}
                          >
                            <div
                              className="text-[11px] font-bold"
                              style={{ color: theme.textMuted }}
                            >
                              تفاصيل دفعات المخزون المتوفرة:
                            </div>
                            <div
                              className="border divide-y"
                              style={{
                                backgroundColor: theme.surface,
                                borderColor: theme.border,
                              }}
                            >
                              {item.batches.map((batch, bIdx) => (
                                <div
                                  key={`${batch.productId}-${bIdx}`}
                                  className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                  style={{
                                    borderColor: theme.border,
                                    borderRight: batch.isReference
                                      ? `3px solid ${theme.positive}`
                                      : undefined,
                                  }}
                                >
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className="font-bold"
                                        style={{ color: theme.text }}
                                      >
                                        {formatBoxesAndPieces(
                                          batch.quantity,
                                          batch.piecesPerBox,
                                        )}
                                      </span>
                                      {batch.isReference && (
                                        <span
                                          className="text-[10px] font-bold px-1.5 py-0.5 border"
                                          style={{
                                            borderColor: theme.positive,
                                            color: theme.positive,
                                          }}
                                        >
                                          الأرخص (مرجع)
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className="text-[11px] flex items-center gap-1.5"
                                      style={{ color: theme.textMuted }}
                                    >
                                      <Truck size={11} />
                                      <span>المورد:</span>
                                      <strong style={{ color: theme.text }}>
                                        {batch.supplierName}
                                      </strong>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-5 justify-between sm:justify-end text-left">
                                    <div>
                                      <div
                                        className="text-[10px]"
                                        style={{ color: theme.textMuted }}
                                      >
                                        سعر الشراء
                                      </div>
                                      <div
                                        className="font-mono tabular-nums font-bold text-xs"
                                        style={{ color: theme.text }}
                                      >
                                        {fmtVal(batch.boxPurchasePrice)}{' '}
                                        <span
                                          className="text-[10px] font-normal"
                                          style={{ color: theme.textMuted }}
                                        >
                                          ({fmtVal(batch.piecePrice)}/ق)
                                        </span>
                                      </div>
                                    </div>

                                    <div>
                                      <div
                                        className="text-[10px]"
                                        style={{ color: theme.textMuted }}
                                      >
                                        فرق الخسارة
                                      </div>
                                      <div
                                        className="font-mono tabular-nums font-black text-xs"
                                        style={{
                                          color:
                                            batch.batchLoss > 0.0001
                                              ? theme.negative
                                              : theme.positive,
                                        }}
                                      >
                                        {batch.batchLoss > 0.0001
                                          ? `+${fmtVal(batch.batchLoss)}`
                                          : fmtVal(0)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : filteredSuppliers.length === 0 ? (
              <div
                className="border p-10 text-center space-y-2"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                }}
              >
                <CheckCircle2
                  size={26}
                  className="mx-auto"
                  style={{ color: theme.positive }}
                />
                <p
                  className="text-xs sm:text-sm font-black"
                  style={{ color: theme.text }}
                >
                  لا يوجد موردون تسببوا في زيادة بالأسعار
                </p>
                <p className="text-[11px]" style={{ color: theme.textMuted }}>
                  جميع مشتريات المخزون الحالي تمت بأدنى سعر.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className="p-3 border text-[11px] flex items-center gap-2"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }}
                >
                  <Info size={14} className="shrink-0" />
                  <span>
                    الموردون الذين تسببوا في فرق زيادة بالأسعار مقارنةً بأرخص
                    سعر شراء لنفس الأصناف.
                  </span>
                </div>

                {/* Best Supplier Reference Highlight */}
                {bestSuppliersForQuery.length > 0 && (
                  <div className="space-y-2">
                    {bestSuppliersForQuery.map((best, bIdx) => (
                      <div
                        key={`best-${bIdx}`}
                        className="border p-3.5 sm:p-4 text-right space-y-1.5"
                        style={{
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                          borderRight: `4px solid ${theme.positive}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Award
                                size={15}
                                style={{ color: theme.positive }}
                              />
                              <span
                                className="text-xs font-black"
                                style={{ color: theme.positive }}
                              >
                                صاحب السعر الأفضل (الأرخص):
                              </span>
                              <span
                                className="text-xs sm:text-sm font-black px-2 py-0.5 border"
                                style={{
                                  backgroundColor: theme.surfaceMuted,
                                  borderColor: theme.border,
                                  color: theme.text,
                                }}
                              >
                                {best.supplierName}
                              </span>
                            </div>
                            <div
                              className="text-[11px] flex items-center gap-2 flex-wrap"
                              style={{ color: theme.textMuted }}
                            >
                              <span>
                                المنتج:{' '}
                                <strong style={{ color: theme.text }}>
                                  {highlightMatch(
                                    best.productName,
                                    searchQuery,
                                    theme.accent,
                                  )}
                                </strong>
                              </span>
                              {best.barcode && (
                                <span
                                  className="font-mono text-[10px] px-1 border"
                                  style={{ borderColor: theme.border }}
                                >
                                  {best.barcode}
                                </span>
                              )}
                              <span>·</span>
                              <span>
                                الكمية بالسعر الأرخص:{' '}
                                <strong style={{ color: theme.text }}>
                                  {formatBoxesAndPieces(
                                    best.quantity,
                                    best.piecesPerBox,
                                  )}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div className="text-left shrink-0">
                            <div
                              className="text-[10px] font-bold"
                              style={{ color: theme.positive }}
                            >
                              أفضل سعر كرتونة
                            </div>
                            <div
                              className="text-sm sm:text-base font-black font-mono tabular-nums"
                              style={{ color: theme.positive }}
                            >
                              {fmtVal(best.boxPrice)}
                            </div>
                            {best.maxDifference > 0.0001 && (
                              <div
                                className="text-[10px] font-bold"
                                style={{ color: theme.positive }}
                              >
                                يوفر {fmtVal(best.maxDifference)} / كرتونة
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filteredSuppliers.map((supplier, sIdx) => {
                  const supKey = supplier.supplierId || supplier.supplierName;
                  const q = searchQuery.trim();
                  const isSupplierNameMatch = q
                    ? matchesQuery(supplier.supplierName, q)
                    : false;
                  const matchingBatches = q
                    ? supplier.affectedBatches.filter(
                        (b) =>
                          matchesQuery(b.productName, q) ||
                          matchesQuery(b.barcode, q),
                      )
                    : supplier.affectedBatches;
                  const matchingBatchesCount = matchingBatches.length;

                  const isShowingAll =
                    showAllSupplierBatches[supKey] === true;
                  const displayedBatches =
                    q && matchingBatchesCount > 0 && !isShowingAll
                      ? matchingBatches
                      : q && !isSupplierNameMatch && matchingBatchesCount === 0
                        ? []
                        : supplier.affectedBatches;

                  const hiddenBatchesCount =
                    supplier.affectedBatches.length - displayedBatches.length;

                  const isExpanded =
                    expandedSupplierIds[supKey] ??
                    (q.length > 0 &&
                      (matchingBatchesCount > 0 || isSupplierNameMatch));

                  const displayedLoss =
                    q && matchingBatchesCount > 0 && !isShowingAll
                      ? matchingBatches.reduce((sum, b) => sum + b.batchLoss, 0)
                      : supplier.totalLoss;

                  const barPct = Math.max(
                    3,
                    Math.round((displayedLoss / maxSupplierLoss) * 100),
                  );

                  return (
                    <div
                      key={supKey}
                      className="border transition-colors overflow-hidden text-right"
                      style={{
                        backgroundColor: theme.surface,
                        borderColor: isExpanded ? theme.accent : theme.border,
                      }}
                    >
                      <div
                        onClick={() => toggleSupplier(supKey)}
                        className="p-3.5 sm:p-4 cursor-pointer select-none space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-[11px] font-mono font-bold tabular-nums"
                                style={{ color: theme.accent }}
                              >
                                {String(sIdx + 1).padStart(2, '0')}
                              </span>
                              <h3
                                className="text-xs sm:text-sm font-black"
                                style={{ color: theme.text }}
                              >
                                {highlightMatch(
                                  supplier.supplierName,
                                  searchQuery,
                                  theme.accent,
                                )}
                              </h3>
                              {q && matchingBatchesCount > 0 && (
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 border inline-flex items-center gap-1"
                                  style={{
                                    backgroundColor: theme.surfaceMuted,
                                    borderColor: theme.border,
                                    color: theme.text,
                                  }}
                                >
                                  <Sparkles
                                    size={11}
                                    style={{ color: theme.accent }}
                                  />
                                  <span>
                                    {matchingBatchesCount === 1
                                      ? 'المنتج المطلوب وحده'
                                      : `${matchingBatchesCount} أصناف مطابقة`}
                                  </span>
                                </span>
                              )}
                            </div>
                            <p
                              className="text-[11px]"
                              style={{ color: theme.textMuted }}
                            >
                              {q && matchingBatchesCount > 0 && !isShowingAll ? (
                                <span>
                                  يظهر المنتج وحده (مخفي{' '}
                                  <strong style={{ color: theme.text }}>
                                    {hiddenBatchesCount}
                                  </strong>{' '}
                                  أصناف أخرى لهذا المورد)
                                </span>
                              ) : (
                                <span>
                                  تسبب بزيادة على{' '}
                                  <strong style={{ color: theme.text }}>
                                    {supplier.affectedProductsCount}
                                  </strong>{' '}
                                  صنف
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-left">
                              <div
                                className="text-[10px] font-bold"
                                style={{ color: theme.textMuted }}
                              >
                                {q && matchingBatchesCount > 0 && !isShowingAll
                                  ? 'الزيادة على المنتج'
                                  : 'إجمالي الزيادة'}
                              </div>
                              <div
                                className="text-sm sm:text-base font-black font-mono tabular-nums"
                                style={{ color: theme.negative }}
                              >
                                {fmtVal(displayedLoss)}
                              </div>
                            </div>
                            <div
                              className="p-1 border"
                              style={{
                                backgroundColor: theme.surfaceMuted,
                                borderColor: theme.border,
                                color: theme.textMuted,
                              }}
                            >
                              {isExpanded ? (
                                <ChevronUp size={14} />
                              ) : (
                                <ChevronDown size={14} />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Folio Horizontal Variance Bar */}
                        <div
                          className="w-full h-1.5 overflow-hidden"
                          style={{ backgroundColor: theme.surfaceMuted }}
                        >
                          <div
                            className="h-full"
                            style={{
                              width: `${barPct}%`,
                              backgroundColor: theme.negative,
                            }}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div
                          className="border-t p-3 sm:p-4 space-y-2"
                          style={{
                            borderColor: theme.border,
                            backgroundColor: theme.bg,
                          }}
                        >
                          <div
                            className="text-[11px] font-bold flex items-center justify-between"
                            style={{ color: theme.textMuted }}
                          >
                            <span>
                              {hiddenBatchesCount > 0
                                ? `المنتج المطلوب وحده (${displayedBatches.length}):`
                                : 'الأصناف المشتراة بأسعار أعلى من السعر الأرخص:'}
                            </span>
                            {hiddenBatchesCount > 0 && (
                              <span className="text-[10px] font-normal">
                                (تم إخفاء {hiddenBatchesCount} أصناف غير مطابقة)
                              </span>
                            )}
                          </div>

                          <div
                            className="border divide-y"
                            style={{
                              backgroundColor: theme.surface,
                              borderColor: theme.border,
                            }}
                          >
                            {displayedBatches.map((b, idx) => (
                              <div
                                key={`${b.productName}-${idx}`}
                                className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                style={{ borderColor: theme.border }}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <div
                                      className="font-bold text-xs"
                                      style={{ color: theme.text }}
                                    >
                                      {highlightMatch(
                                        b.productName,
                                        searchQuery,
                                        theme.accent,
                                      )}
                                    </div>
                                    {b.barcode && (
                                      <span
                                        className="font-mono tabular-nums text-[10px] px-1 border"
                                        style={{
                                          borderColor: theme.border,
                                          color: theme.textMuted,
                                        }}
                                      >
                                        {highlightMatch(
                                          b.barcode,
                                          searchQuery,
                                          theme.accent,
                                        )}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className="text-[11px]"
                                    style={{ color: theme.textMuted }}
                                  >
                                    الكمية المتبقية:{' '}
                                    <strong style={{ color: theme.text }}>
                                      {formatBoxesAndPieces(
                                        b.quantity,
                                        b.piecesPerBox,
                                      )}
                                    </strong>
                                  </div>
                                </div>

                                <div className="flex items-center gap-5 justify-between sm:justify-end text-left">
                                  <div>
                                    <div
                                      className="text-[10px]"
                                      style={{ color: theme.textMuted }}
                                    >
                                      سعر المورد / الأرخص
                                    </div>
                                    <div
                                      className="font-mono tabular-nums font-bold text-xs"
                                      style={{ color: theme.text }}
                                    >
                                      {fmtVal(b.boxPrice)}{' '}
                                      <span
                                        className="text-[10px]"
                                        style={{ color: theme.positive }}
                                      >
                                        (
                                        {fmtVal(
                                          b.minPiecePrice *
                                            (b.piecesPerBox || 1),
                                        )}
                                        )
                                      </span>
                                    </div>
                                  </div>

                                  <div>
                                    <div
                                      className="text-[10px]"
                                      style={{ color: theme.textMuted }}
                                    >
                                      الزيادة
                                    </div>
                                    <div
                                      className="font-mono tabular-nums font-black text-xs"
                                      style={{ color: theme.negative }}
                                    >
                                      +{fmtVal(b.batchLoss)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {hiddenBatchesCount > 0 && (
                            <button
                              type="button"
                              onClick={(e) =>
                                toggleShowAllSupplierBatches(supKey, e)
                              }
                              className="w-full py-2 px-3 text-center text-xs font-bold border border-dashed flex items-center justify-center gap-1.5 cursor-pointer"
                              style={{
                                backgroundColor: theme.surface,
                                borderColor: theme.border,
                                color: theme.text,
                              }}
                            >
                              <ChevronDown size={14} />
                              <span>
                                عرض باقي أصناف هذا المورد ({hiddenBatchesCount}{' '}
                                صنف إضافي)
                              </span>
                            </button>
                          )}

                          {isShowingAll &&
                            supplier.affectedBatches.length >
                              displayedBatches.length && (
                              <button
                                type="button"
                                onClick={(e) =>
                                  toggleShowAllSupplierBatches(supKey, e)
                                }
                                className="w-full py-2 px-3 text-center text-xs font-bold border border-dashed flex items-center justify-center gap-1.5 cursor-pointer"
                                style={{
                                  backgroundColor: theme.surface,
                                  borderColor: theme.border,
                                  color: theme.text,
                                }}
                              >
                                <ChevronUp size={14} />
                                <span>
                                  إخفاء باقي الأصناف (عرض المنتج المطلوب وحده)
                                </span>
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FOLIO FOOTER */}
        <div
          className="px-4 py-3 sm:px-6 border-t flex items-center justify-between text-[11px] shrink-0"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.textMuted,
          }}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Info size={13} className="shrink-0" />
            <span className="truncate">
              الحسابات مبنية على دفعات المخزون المتوفرة حالياً بالمتجر
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-bold text-xs border transition-colors shrink-0 cursor-pointer"
            style={{
              backgroundColor: theme.text,
              color: theme.surface,
              borderColor: theme.text,
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

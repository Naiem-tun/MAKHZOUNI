import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingDown,
  Package,
  Layers,
  Search,
  FileSpreadsheet,
  RefreshCw,
  Info,
  Calendar,
  ChevronDown,
  ChevronUp,
  Tag,
  Clock,
  ArrowDownRight
} from 'lucide-react';
import * as xlsx from 'xlsx';
import { useAppContext } from '../../AppContext';
import { formatCurrency, formatQuantity, formatAppDate, safeParseDate } from '../../lib/utils';
import {
  getPriceHikeBreakdown,
  PriceHikeBreakdownResult,
  PriceHikePeriod
} from '../../lib/priceHikeTracker';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface PriceHikeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PriceHikeDetailsModal: React.FC<PriceHikeDetailsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PriceHikeBreakdownResult | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PriceHikePeriod>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'products' | 'batches'>('products');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const currency = settings.currency || 'د.ت';
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  const loadData = async (periodToLoad: PriceHikePeriod = selectedPeriod) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await getPriceHikeBreakdown(user.uid, periodToLoad);
      setData(res);
      // Expand all products by default for convenience
      const allKeys = new Set(res.products.map((p) => p.key));
      setExpandedKeys(allKeys);
    } catch (err) {
      console.error('Failed to load price hike breakdown:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData(selectedPeriod);
    }
  }, [isOpen, user, selectedPeriod]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fmt = (val: number) =>
    !showFinancials ? '••••••' : formatCurrency(val, currency, language);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredProducts = (data?.products || []).filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.productName.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  });

  const filteredBatches = (data?.allBatches || []).filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      b.productName.toLowerCase().includes(q) ||
      (b.barcode && b.barcode.toLowerCase().includes(q)) ||
      (b.supplierName && b.supplierName.toLowerCase().includes(q))
    );
  });

  const handleExportExcel = () => {
    if (!data || data.products.length === 0) return;

    const wsData: any[][] = [];
    wsData.push(['تقرير تفاصيل المنتجات المسببة لارتفاع أسعار الشراء']);
    wsData.push([`تاريخ الاستخراج: ${formatAppDate(new Date(), language)}`]);
    if (data.lastResetDate) {
      wsData.push([`فترة الحساب: منذ آخر جرد بتاريخ ${formatAppDate(safeParseDate(data.lastResetDate), language)}`]);
    }
    wsData.push([]);
    wsData.push(['إجمالي خسارة الغلاء:', data.totalHike]);
    wsData.push(['عدد المنتجات المتأثرة:', data.totalProductsCount]);
    wsData.push(['عدد الدفعات المتأثرة:', data.totalBatchesCount]);
    wsData.push([]);

    // Table 1: Products
    wsData.push(['ملخص الأصناف المتأثرة:']);
    wsData.push([
      'اسم المنتج',
      'الباركود',
      'سعر الشراء الأساسي',
      'سعر الشراء الجديد',
      'فارق التكلفة للقطعة',
      'إجمالي الكمية المشتراة بالسعر المرتفع',
      'إجمالي خسارة الغلاء (د.ت)'
    ]);

    data.products.forEach((p) => {
      wsData.push([
        p.productName,
        p.barcode || '',
        p.initialPrice,
        p.latestPrice,
        p.unitHike,
        p.totalHikedQty,
        p.totalLoss
      ]);
    });

    wsData.push([]);
    wsData.push(['سجل الدفعات والفواتير التفصيلي:']);
    wsData.push([
      'التاريخ',
      'اسم المنتج',
      'الباركود',
      'المورد',
      'السعر السابق',
      'السعر الجديد',
      'فارق التكلفة',
      'الكمية',
      'الخسارة الناتجة (د.ت)'
    ]);

    data.allBatches.forEach((b) => {
      wsData.push([
        formatAppDate(safeParseDate(b.date), language),
        b.productName,
        b.barcode || '',
        b.supplierName || '',
        b.previousPrice,
        b.newPrice,
        b.unitDiff,
        b.qty,
        b.impact
      ]);
    });

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    if (language === 'ar') {
      ws['!dir'] = 'rtl';
    }
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Price Hike Details');

    const dateStr = new Date().toISOString().split('T')[0];
    xlsx.writeFile(wb, `price_hike_breakdown_${dateStr}.xlsx`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="relative flex flex-col max-h-[92vh] w-full max-w-4xl border shadow-2xl overflow-hidden transition-colors"
        style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between border-b px-4 py-3.5 sm:px-6 sm:py-4 gap-3 shrink-0"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.negative }}>01</span>
              <span style={{ color: theme.textMuted }}>تآكل الهامش الناتج عن ارتفاع أسعار الموردين</span>
            </div>
            <h2 className="text-base sm:text-xl font-black tracking-tight flex items-center gap-2" style={{ color: theme.text }}>
              <TrendingDown size={18} style={{ color: theme.negative }} className="shrink-0" />
              <span>تفاصيل المنتجات المسببة لغلاء أسعار الشراء</span>
            </h2>
            <p className="text-[11px] hidden sm:block" style={{ color: theme.textMuted }}>
              الأصناف التي ارتفعت أسعار شرائها من الموردين مقارنة بالشراء السابق وسببت تآكل هامش الربح
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => loadData(selectedPeriod)}
              disabled={loading}
              className="p-1.5 border cursor-pointer transition-colors"
              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
              title="إعادة تحميل البيانات"
              aria-label="إعادة تحميل"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} style={loading ? { color: theme.accent } : undefined} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 border cursor-pointer transition-colors"
              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
              aria-label="إغلاق"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Period Selector Tabs Bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b px-4 sm:px-6 py-2.5 shrink-0"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: theme.textMuted }}>
            <Calendar size={14} style={{ color: theme.accent }} />
            <span>نطاق الحساب:</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { id: 'all', label: 'شامل كافة المشتريات (تراكمي)' },
              {
                id: 'since_last_jard',
                label: `منذ آخر جرد ${data?.lastResetDate ? `(${formatAppDate(safeParseDate(data.lastResetDate), language)})` : ''}`
              },
              { id: 'this_month', label: 'هذا الشهر' }
            ].map((pOpt) => {
              const active = selectedPeriod === pOpt.id;
              return (
                <button
                  key={pOpt.id}
                  type="button"
                  onClick={() => setSelectedPeriod(pOpt.id as PriceHikePeriod)}
                  className="px-2.5 py-1 border text-xs font-bold cursor-pointer transition-colors"
                  style={{
                    backgroundColor: active ? theme.accent : theme.surfaceMuted,
                    borderColor: active ? theme.accent : theme.border,
                    color: active ? theme.accentText : theme.textMuted,
                  }}
                >
                  {pOpt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="min-h-0 overflow-y-auto flex flex-col">
          {/* Top Summary Cards */}
          <div className="p-3 sm:px-6 sm:py-4 border-b space-y-3" style={{ borderColor: theme.border }}>
            <div
              className="grid grid-cols-1 sm:grid-cols-3 border divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="p-3 sm:p-4 space-y-1" style={{ borderColor: theme.border }}>
                <span className="text-[11px] font-bold block" style={{ color: theme.negative }}>
                  إجمالي خسارة الغلاء {selectedPeriod === 'all' ? '(كافة المشتريات)' : selectedPeriod === 'since_last_jard' ? '(منذ آخر جرد)' : '(هذا الشهر)'}
                </span>
                <div className="font-mono tabular-nums text-xl sm:text-2xl font-black" style={{ color: theme.negative }}>
                  {loading ? '...' : (data?.totalHike && data.totalHike > 0 ? `-${fmt(data.totalHike)}` : fmt(0))}
                </div>
                <p className="text-[10px]" style={{ color: theme.textMuted }}>
                  فارق كلفة الشراء المدفوعة من جيب التاجر
                </p>
              </div>

              <div className="p-3 sm:p-4 space-y-1" style={{ borderColor: theme.border }}>
                <span className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>
                  عدد الأصناف المتأثرة
                </span>
                <div className="font-mono tabular-nums text-xl sm:text-2xl font-black" style={{ color: theme.text }}>
                  {loading ? '...' : `${data?.totalProductsCount || 0} صنف`}
                </div>
                <p className="text-[10px]" style={{ color: theme.textMuted }}>
                  منتجات ارتفع سعر توريدها
                </p>
              </div>

              <div className="p-3 sm:p-4 space-y-1" style={{ borderColor: theme.border }}>
                <span className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>
                  دفعات الشراء المتأثرة
                </span>
                <div className="font-mono tabular-nums text-xl sm:text-2xl font-black" style={{ color: theme.text }}>
                  {loading ? '...' : `${data?.totalBatchesCount || 0} دفعة`}
                </div>
                <p className="text-[10px]" style={{ color: theme.textMuted }}>
                  {selectedPeriod === 'all'
                    ? 'شامل كامل سجل المشتريات'
                    : selectedPeriod === 'since_last_jard' && data?.lastResetDate
                      ? `منذ آخر جرد: ${formatAppDate(safeParseDate(data.lastResetDate), language)}`
                      : 'خلال الشهر الحالي'}
                </p>
              </div>
            </div>

            <div
              className="flex items-start gap-2 border p-2.5 text-xs"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderRight: `3px solid ${theme.neutral}`,
                color: theme.textMuted,
              }}
            >
              <Info size={14} className="shrink-0 mt-0.5" style={{ color: theme.neutral }} />
              <div className="leading-relaxed text-[11px]">
                <strong style={{ color: theme.text }}>معادلة احتساب الخسارة لكل دفعة:</strong>{' '}
                <code className="font-mono">(سعر الشراء الجديد − سعر الشراء السابق) × الكمية المشتراة</code>.{' '}
                نظراً لأن سعر البيع محكوم بالسوق والمنافسة، فإن كل مليم زيادة يفرضه المورد يُخصم مباشرة من أرباحك الصافية.
              </div>
            </div>
          </div>

          {/* Sticky Toolbar: Search, Tabs, Export */}
          <div
            className="sticky top-0 z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b px-4 sm:px-6 py-2.5"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 border flex-1 max-w-sm"
              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
            >
              <Search size={14} style={{ color: theme.textMuted }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم المنتج أو الباركود..."
                className="w-full bg-transparent text-xs outline-none"
                style={{ color: theme.text }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-bold cursor-pointer"
                  style={{ color: theme.textMuted }}
                >
                  مسح
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className="flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold cursor-pointer transition-colors"
                style={{
                  backgroundColor: activeTab === 'products' ? theme.text : theme.surfaceMuted,
                  borderColor: activeTab === 'products' ? theme.text : theme.border,
                  color: activeTab === 'products' ? theme.surface : theme.textMuted,
                }}
              >
                <Package size={13} />
                <span>حسب الأصناف ({data?.products.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('batches')}
                className="flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold cursor-pointer transition-colors"
                style={{
                  backgroundColor: activeTab === 'batches' ? theme.text : theme.surfaceMuted,
                  borderColor: activeTab === 'batches' ? theme.text : theme.border,
                  color: activeTab === 'batches' ? theme.surface : theme.textMuted,
                }}
              >
                <Layers size={13} />
                <span>سجل الفواتير ({data?.allBatches.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={!data || data.products.length === 0}
                className="flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold disabled:opacity-45 cursor-pointer transition-colors"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.positive }}
                title="تصدير جدول المنتجات إلى ملف Excel"
              >
                <FileSpreadsheet size={14} />
                <span className="hidden sm:inline">تصدير Excel</span>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-3 sm:p-6 space-y-3 flex-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16" style={{ color: theme.textMuted }}>
                <RefreshCw size={24} className="animate-spin mb-3" style={{ color: theme.accent }} />
                <p className="text-xs font-bold">جاري فحص المشتريات واستخراج تفاصيل الأصناف...</p>
              </div>
            ) : !data || data.products.length === 0 ? (
              <div
                className="border p-12 flex flex-col items-center justify-center text-center space-y-2"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <Package size={28} style={{ color: theme.textMuted }} />
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  لا توجد منتجات مسجلة بارتفاع في أسعار الشراء حالياً
                </h3>
                <p className="text-xs max-w-sm" style={{ color: theme.textMuted }}>
                  كافة عمليات الشراء المسجلة منذ آخر جرد تمت بأسعار مستقرة، أو لم تسجل أي فوارق تكلفة إضافية بعد.
                </p>
              </div>
            ) : activeTab === 'products' ? (
              <div className="space-y-3">
                {filteredProducts.length === 0 ? (
                  <div className="py-8 text-center text-xs" style={{ color: theme.textMuted }}>
                    لا توجد نتائج تطابق بحثك: &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isExpanded = expandedKeys.has(p.key);
                    return (
                      <div
                        key={p.key}
                        className="overflow-hidden border transition-colors"
                        style={{
                          backgroundColor: theme.surface,
                          borderColor: isExpanded ? theme.accent : theme.border,
                        }}
                      >
                        <div
                          onClick={() => toggleExpand(p.key)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 cursor-pointer select-none"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center border mt-0.5 sm:mt-0"
                              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.negative }}
                            >
                              <Tag size={15} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-black" style={{ color: theme.text }}>
                                  {p.productName}
                                </h4>
                                {p.barcode && (
                                  <span
                                    className="border px-1.5 py-0.5 font-mono tabular-nums text-[11px]"
                                    style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
                                  >
                                    {p.barcode}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs flex-wrap" style={{ color: theme.textMuted }}>
                                <span>السعر القديم: <strong className="font-mono tabular-nums" style={{ color: theme.text }}>{fmt(p.initialPrice)}</strong></span>
                                <span>←</span>
                                <span>السعر الجديد: <strong className="font-mono tabular-nums" style={{ color: theme.negative }}>{fmt(p.latestPrice)}</strong></span>
                                <span
                                  className="inline-flex items-center gap-0.5 border px-1.5 py-0.5 text-[11px] font-bold font-mono tabular-nums"
                                  style={{ borderColor: theme.negative, color: theme.negative, backgroundColor: theme.surfaceMuted }}
                                >
                                  <ArrowDownRight size={11} className="rotate-180" />
                                  +{fmt(p.unitHike)} / قطعة
                                </span>
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0"
                            style={{ borderColor: theme.border }}
                          >
                            <div className="text-right sm:text-left">
                              <div className="text-[11px]" style={{ color: theme.textMuted }}>
                                الكمية المشتراة بالزيادة: <strong className="font-mono tabular-nums" style={{ color: theme.text }}>{formatQuantity(p.totalHikedQty)}</strong>
                              </div>
                              <div className="font-mono tabular-nums text-base font-black" style={{ color: theme.negative }}>
                                -{fmt(p.totalLoss)}
                              </div>
                            </div>
                            <div
                              className="p-1 border"
                              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div
                            className="border-t p-3"
                            style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                          >
                            <div className="mb-2 flex items-center justify-between text-[11px] font-bold" style={{ color: theme.textMuted }}>
                              <span>دفعات الشراء المسجلة لهذا المنتج ({p.batches.length}):</span>
                              <span className="text-[10px]">مرتبة تاريخياً</span>
                            </div>
                            <div className="overflow-x-auto border" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                              <table className="w-full text-right text-xs">
                                <thead>
                                  <tr className="border-b text-[11px]" style={{ borderColor: theme.border, backgroundColor: theme.surfaceMuted, color: theme.textMuted }}>
                                    <th className="p-2 font-bold">تاريخ الدفعة</th>
                                    <th className="p-2 font-bold">المورد</th>
                                    <th className="p-2 text-center font-bold">سعر الشراء</th>
                                    <th className="p-2 text-center font-bold">السعر السابق</th>
                                    <th className="p-2 text-center font-bold">الزيادة / قطعة</th>
                                    <th className="p-2 text-center font-bold">الكمية</th>
                                    <th className="p-2 text-left font-bold">الخسارة الصافية</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y font-mono tabular-nums text-[11px]" style={{ borderColor: theme.border }}>
                                  {p.batches.map((b) => (
                                    <tr key={b.id} style={{ borderColor: theme.border }}>
                                      <td className="p-2 font-sans" style={{ color: theme.textMuted }}>
                                        <div className="flex items-center gap-1">
                                          <Calendar size={11} />
                                          <span>{formatAppDate(safeParseDate(b.date), language)}</span>
                                        </div>
                                      </td>
                                      <td className="p-2 font-sans" style={{ color: theme.text }}>
                                        {b.supplierName || '—'}
                                      </td>
                                      <td className="p-2 text-center font-bold" style={{ color: theme.negative }}>
                                        {fmt(b.newPrice)}
                                      </td>
                                      <td className="p-2 text-center" style={{ color: theme.textMuted }}>
                                        {fmt(b.previousPrice)}
                                      </td>
                                      <td className="p-2 text-center" style={{ color: theme.negative }}>
                                        +{fmt(b.unitDiff)}
                                      </td>
                                      <td className="p-2 text-center font-bold" style={{ color: theme.text }}>
                                        {formatQuantity(b.qty)}
                                      </td>
                                      <td className="p-2 text-left font-bold" style={{ color: theme.negative }}>
                                        -{fmt(b.impact)}
                                        <span className="block text-[9px] font-normal" style={{ color: theme.textMuted }}>
                                          ({fmt(b.unitDiff)} × {formatQuantity(b.qty)})
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                {filteredBatches.length === 0 ? (
                  <div className="py-8 text-center text-xs" style={{ color: theme.textMuted }}>
                    لا توجد فواتير تطابق بحثك: &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b" style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}>
                        <th className="p-3 font-bold">التاريخ</th>
                        <th className="p-3 font-bold">اسم المنتج</th>
                        <th className="p-3 font-bold">المورد</th>
                        <th className="p-3 text-center font-bold">السعر السابق</th>
                        <th className="p-3 text-center font-bold">السعر الجديد</th>
                        <th className="p-3 text-center font-bold">الزيادة / قطعة</th>
                        <th className="p-3 text-center font-bold">الكمية</th>
                        <th className="p-3 text-left font-bold">الخسارة الناتجة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono tabular-nums text-xs" style={{ borderColor: theme.border }}>
                      {filteredBatches.map((b) => (
                        <tr key={b.id} style={{ borderColor: theme.border }}>
                          <td className="p-3 font-sans whitespace-nowrap" style={{ color: theme.textMuted }}>
                            {formatAppDate(safeParseDate(b.date), language)}
                          </td>
                          <td className="p-3 font-sans">
                            <div className="font-bold" style={{ color: theme.text }}>
                              {b.productName}
                            </div>
                            {b.barcode && (
                              <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>{b.barcode}</div>
                            )}
                          </td>
                          <td className="p-3 font-sans whitespace-nowrap" style={{ color: theme.text }}>
                            {b.supplierName || '—'}
                          </td>
                          <td className="p-3 text-center" style={{ color: theme.textMuted }}>
                            {fmt(b.previousPrice)}
                          </td>
                          <td className="p-3 text-center font-bold" style={{ color: theme.negative }}>
                            {fmt(b.newPrice)}
                          </td>
                          <td className="p-3 text-center" style={{ color: theme.negative }}>
                            +{fmt(b.unitDiff)}
                          </td>
                          <td className="p-3 text-center font-bold" style={{ color: theme.text }}>
                            {formatQuantity(b.qty)}
                          </td>
                          <td className="p-3 text-left font-bold whitespace-nowrap" style={{ color: theme.negative }}>
                            -{fmt(b.impact)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t px-4 sm:px-6 py-3 shrink-0"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: theme.textMuted }}>
            <Clock size={13} />
            <span>يتم تصفير هذا العداد وإغلاق دورته تلقائياً عند إتمام وحفظ الجرد الدوري القادم.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border px-4 py-1.5 text-xs font-black cursor-pointer"
            style={{ backgroundColor: theme.text, borderColor: theme.text, color: theme.surface }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

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
  AlertTriangle,
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
  PriceHikeProductBreakdown, 
  PriceHikeBatchDetail,
  PriceHikePeriod
} from '../../lib/priceHikeTracker';

interface PriceHikeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PriceHikeDetailsModal: React.FC<PriceHikeDetailsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, settings } = useAppContext();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
      dir="rtl"
    >
      <div 
        className="relative flex flex-col max-h-[92vh] w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <TrendingDown size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                تفاصيل المنتجات المسببة لغلاء أسعار الشراء
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                الأصناف التي ارتفعت أسعار شرائها من الموردين مقارنة بالشراء السابق وسببت تآكل هامش الربح
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadData(selectedPeriod)}
              disabled={loading}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
              title="إعادة تحميل البيانات"
              aria-label="إعادة تحميل"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin text-rose-600' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Period Selector Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-100/70 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-800/60">
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <Calendar size={14} className="text-rose-500" />
            <span className="font-semibold">نطاق الحساب:</span>
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setSelectedPeriod('all')}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                selectedPeriod === 'all'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              شامل كافة المشتريات (تراكمي)
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('since_last_jard')}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                selectedPeriod === 'since_last_jard'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              منذ آخر جرد {data?.lastResetDate ? `(${formatAppDate(safeParseDate(data.lastResetDate), language)})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('this_month')}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                selectedPeriod === 'this_month'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              هذا الشهر
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="border-b border-zinc-100 bg-gradient-to-r from-rose-50/40 via-white to-zinc-50/40 p-4 dark:border-zinc-800 dark:from-rose-950/20 dark:via-zinc-900 dark:to-zinc-900">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Metric 1: Total Loss */}
            <div className="rounded-xl border border-rose-200/70 bg-white/90 p-3 shadow-xs dark:border-rose-900/40 dark:bg-zinc-800/80">
              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                إجمالي خسارة الغلاء {selectedPeriod === 'all' ? '(كافة المشتريات)' : selectedPeriod === 'since_last_jard' ? '(منذ آخر جرد)' : '(هذا الشهر)'}
              </span>
              <div className="mt-1 font-mono text-2xl font-black text-rose-600 dark:text-rose-400">
                {loading ? '...' : (data?.totalHike && data.totalHike > 0 ? `-${fmt(data.totalHike)}` : fmt(0))}
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400">
                فارق كلفة الشراء المدفوعة من جيب التاجر
              </p>
            </div>

            {/* Metric 2: Affected Products */}
            <div className="rounded-xl border border-zinc-200/70 bg-white/90 p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-800/80">
              <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                عدد الأصناف المتأثرة
              </span>
              <div className="mt-1 font-mono text-2xl font-black text-zinc-900 dark:text-white">
                {loading ? '...' : `${data?.totalProductsCount || 0} صنف`}
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400">
                منتجات ارتفع سعر توريدها
              </p>
            </div>

            {/* Metric 3: Affected Batches */}
            <div className="rounded-xl border border-zinc-200/70 bg-white/90 p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-800/80">
              <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                دفعات الشراء المتأثرة
              </span>
              <div className="mt-1 font-mono text-2xl font-black text-zinc-900 dark:text-white">
                {loading ? '...' : `${data?.totalBatchesCount || 0} دفعة`}
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400">
                {selectedPeriod === 'all' ? (
                  <span>شامل كامل سجل المشتريات</span>
                ) : selectedPeriod === 'since_last_jard' && data?.lastResetDate ? (
                  <span>منذ آخر جرد: {formatAppDate(safeParseDate(data.lastResetDate), language)}</span>
                ) : (
                  <span>خلال الشهر الحالي</span>
                )}
              </p>
            </div>
          </div>

          {/* Formula clarification callout */}
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50/70 p-2.5 text-xs text-amber-900 border border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40">
            <Info size={15} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="leading-relaxed text-[11px]">
              <strong>معادلة احتساب الخسارة لكل دفعة:</strong> <code>(سعر الشراء الجديد − سعر الشراء السابق) × الكمية المشتراة</code>. 
              نظراً لأن سعر البيع محكوم بالسوق والمنافسة، فإن كل مليم زيادة يفرضه المورد يُخصم مباشرة من أرباحك الصافية.
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Tabs, Export */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/30">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم المنتج أو الباركود..."
              className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pr-9 pl-3 text-xs text-zinc-900 placeholder-zinc-400 focus:border-rose-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
              >
                مسح
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View tabs */}
            <div className="flex rounded-lg bg-zinc-200/70 p-0.5 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                  activeTab === 'products'
                    ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Package size={13} />
                <span>حسب الأصناف ({data?.products.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('batches')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                  activeTab === 'batches'
                    ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Layers size={13} />
                <span>سجل الفواتير ({data?.allBatches.length || 0})</span>
              </button>
            </div>

            {/* Export button */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!data || data.products.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-xs"
              title="تصدير جدول المنتجات إلى ملف Excel"
            >
              <FileSpreadsheet size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">تصدير Excel</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[55vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
              <RefreshCw size={28} className="animate-spin text-rose-500 mb-3" />
              <p className="text-sm">جاري فحص المشتريات واستخراج تفاصيل الأصناف...</p>
            </div>
          ) : !data || data.products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-3 text-zinc-500">
                <Package size={28} />
              </div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                لا توجد منتجات مسجلة بارتفاع في أسعار الشراء حالياً
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                كافة عمليات الشراء المسجلة منذ آخر جرد تمت بأسعار مستقرة، أو لم تسجل أي فوارق تكلفة إضافية بعد.
              </p>
            </div>
          ) : activeTab === 'products' ? (
            /* TAB 1: GROUPED BY PRODUCT */
            <div className="space-y-3">
              {filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400">
                  لا توجد نتائج تطابق بحثك: "{searchQuery}"
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isExpanded = expandedKeys.has(p.key);
                  return (
                    <div
                      key={p.key}
                      className="overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      {/* Product Row Header */}
                      <div
                        onClick={() => toggleExpand(p.key)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 select-none transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 mt-0.5 sm:mt-0 font-bold text-xs">
                            <Tag size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                                {p.productName}
                              </h4>
                              {p.barcode && (
                                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  {p.barcode}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 flex-wrap">
                              <span>السعر القديم: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{fmt(p.initialPrice)}</strong></span>
                              <span>←</span>
                              <span>السعر الجديد: <strong className="font-mono text-rose-600 dark:text-rose-400">{fmt(p.latestPrice)}</strong></span>
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                                <ArrowDownRight size={12} className="rotate-180" />
                                +{fmt(p.unitHike)} / قطعة
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100 dark:border-zinc-800">
                          <div className="text-right sm:text-left">
                            <div className="text-xs text-zinc-400">
                              الكمية المشتراة بالزيادة: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{formatQuantity(p.totalHikedQty)}</strong>
                            </div>
                            <div className="font-mono text-base font-black text-rose-600 dark:text-rose-400">
                              -{fmt(p.totalLoss)}
                            </div>
                          </div>
                          <div className="text-zinc-400">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>
                      </div>

                      {/* Batches Table Dropdown */}
                      {isExpanded && (
                        <div className="border-t border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                            <span>دفعات الشراء المسجلة لهذا المنتج ({p.batches.length}):</span>
                            <span className="text-[10px] text-zinc-400">مرتبة تاريخياً</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                              <thead>
                                <tr className="border-b border-zinc-200/80 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                  <th className="pb-1.5 font-medium">تاريخ الدفعة</th>
                                  <th className="pb-1.5 font-medium">المورد</th>
                                  <th className="pb-1.5 text-center font-medium">سعر الشراء</th>
                                  <th className="pb-1.5 text-center font-medium">السعر السابق</th>
                                  <th className="pb-1.5 text-center font-medium">الزيادة / قطعة</th>
                                  <th className="pb-1.5 text-center font-medium">الكمية</th>
                                  <th className="pb-1.5 text-left font-medium">الخسارة الصافية</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono text-[11px]">
                                {p.batches.map((b) => (
                                  <tr key={b.id} className="hover:bg-white/80 dark:hover:bg-zinc-800/50">
                                    <td className="py-2 text-zinc-600 dark:text-zinc-400 font-sans">
                                      <div className="flex items-center gap-1">
                                        <Calendar size={12} className="text-zinc-400" />
                                        <span>{formatAppDate(safeParseDate(b.date), language)}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 text-zinc-600 dark:text-zinc-300 font-sans">
                                      {b.supplierName || '—'}
                                    </td>
                                    <td className="py-2 text-center text-rose-600 dark:text-rose-400 font-bold">
                                      {fmt(b.newPrice)}
                                    </td>
                                    <td className="py-2 text-center text-zinc-500 dark:text-zinc-400">
                                      {fmt(b.previousPrice)}
                                    </td>
                                    <td className="py-2 text-center text-rose-600 dark:text-rose-400">
                                      +{fmt(b.unitDiff)}
                                    </td>
                                    <td className="py-2 text-center text-zinc-800 dark:text-zinc-200 font-bold">
                                      {formatQuantity(b.qty)}
                                    </td>
                                    <td className="py-2 text-left font-bold text-rose-600 dark:text-rose-400">
                                      -{fmt(b.impact)}
                                      <span className="block text-[9px] font-normal text-zinc-400">
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
            /* TAB 2: ALL BATCHES CHRONOLOGICAL TABLE */
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {filteredBatches.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400">
                  لا توجد فواتير تطابق بحثك: "{searchQuery}"
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/80 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
                      <th className="p-3 font-medium">التاريخ</th>
                      <th className="p-3 font-medium">اسم المنتج</th>
                      <th className="p-3 font-medium">المورد</th>
                      <th className="p-3 text-center font-medium">السعر السابق</th>
                      <th className="p-3 text-center font-medium">السعر الجديد</th>
                      <th className="p-3 text-center font-medium">الزيادة / قطعة</th>
                      <th className="p-3 text-center font-medium">الكمية</th>
                      <th className="p-3 text-left font-medium">الخسارة الناتجة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60 font-mono text-xs">
                    {filteredBatches.map((b) => (
                      <tr key={b.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="p-3 text-zinc-500 font-sans whitespace-nowrap">
                          {formatAppDate(safeParseDate(b.date), language)}
                        </td>
                        <td className="p-3 font-sans">
                          <div className="font-bold text-zinc-900 dark:text-white">
                            {b.productName}
                          </div>
                          {b.barcode && (
                            <div className="text-[10px] text-zinc-400 font-mono">{b.barcode}</div>
                          )}
                        </td>
                        <td className="p-3 text-zinc-600 dark:text-zinc-300 font-sans whitespace-nowrap">
                          {b.supplierName || '—'}
                        </td>
                        <td className="p-3 text-center text-zinc-500">
                          {fmt(b.previousPrice)}
                        </td>
                        <td className="p-3 text-center font-bold text-rose-600 dark:text-rose-400">
                          {fmt(b.newPrice)}
                        </td>
                        <td className="p-3 text-center text-rose-600 dark:text-rose-400">
                          +{fmt(b.unitDiff)}
                        </td>
                        <td className="p-3 text-center font-bold text-zinc-800 dark:text-zinc-200">
                          {formatQuantity(b.qty)}
                        </td>
                        <td className="p-3 text-left font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
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

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/80 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Clock size={13} />
            <span>يتم تصفير هذا العداد وإغلاق دورته تلقائياً عند إتمام وحفظ الجرد الدوري القادم.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-200/80 px-4 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

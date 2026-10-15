import React, { useState } from 'react';
import { 
  X, 
  TrendingDown, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Truck, 
  Package, 
  Info,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { 
  PurchaseVarianceAnalysisResult, 
  formatBoxesAndPieces 
} from '../../lib/purchaseVarianceCalculator';
import { formatCurrency, cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

interface PurchaseVarianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: PurchaseVarianceAnalysisResult;
  currency: string;
  language?: string;
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

export const matchesQuery = (text: string | undefined | null, query: string): boolean => {
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

const highlightMatch = (text: string, query: string) => {
  if (!text || !query || !query.trim()) return text;
  const regex = createArabicHighlightRegex(query);
  if (!regex) return text;
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  return (
    <span>
      {parts.map((part, i) =>
        matchesQuery(part, query) && part.length > 0 ? (
          <mark key={i} className="bg-amber-300 dark:bg-amber-500/50 text-amber-950 dark:text-amber-100 px-1 py-0.5 rounded font-black">
            {part}
          </mark>
        ) : (
          part
        )
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
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'products' | 'suppliers'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyLossItems, setOnlyLossItems] = useState(true);
  const [expandedProductKeys, setExpandedProductKeys] = useState<Record<string, boolean>>({});
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Record<string, boolean>>({});
  const [showAllSupplierBatches, setShowAllSupplierBatches] = useState<Record<string, boolean>>({});

  const toggleShowAllSupplierBatches = (supKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowAllSupplierBatches(prev => ({ ...prev, [supKey]: !prev[supKey] }));
  };

  if (!isOpen) return null;

  const toggleProduct = (key: string) => {
    setExpandedProductKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSupplier = (key: string) => {
    setExpandedSupplierIds(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // تصفية الأصناف بالبحث وحالة الخسارة مع دعم التوافق العربي الكامل
  const filteredProducts = analysis.productGroups.filter(group => {
    if (onlyLossItems && group.totalLoss <= 0.0001) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim();
    const nameMatch = matchesQuery(group.name, q);
    const barcodeMatch = matchesQuery(group.barcode, q);
    const supplierMatch = group.batches.some(b => matchesQuery(b.supplierName, q));
    return nameMatch || barcodeMatch || supplierMatch;
  });

  // تصفية الموردين بالبحث
  const filteredSuppliers = analysis.lossMakingSuppliers.filter(sup => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim();
    const nameMatch = matchesQuery(sup.supplierName, q);
    const prodMatch = sup.affectedBatches.some(b => 
      matchesQuery(b.productName, q) || 
      matchesQuery(b.barcode, q)
    );
    return nameMatch || prodMatch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/60 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200" dir="rtl">
      <div 
        className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col h-[94vh] sm:max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ترويسة المودال (مضغوطة وأنيقة لعدم شغل مساحة الهاتف) */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-3 bg-zinc-50/70 dark:bg-zinc-900/70 shrink-0">
          <div className="flex items-center gap-2.5 text-right">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <TrendingDown size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
                تحليل فروقات وخسائر شراء المخزون
              </h2>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                مقارنة أسعار شراء المخزون الحالي مع أدنى سعر شراء مسجل لكل صنف
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 sm:p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* جسم المودال القابل للتمرير كاملاً (يشمل البطاقات وقائمة الأصناف معاً) */}
        <div className="overflow-y-auto flex-1 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/60">
          
          {/* شريط الإحصائيات (أفقي ومضغوط في سطر واحد حتى على شاشة الهاتف، ويتحرك مع التمرير) */}
          <div className="p-3 sm:p-4 bg-zinc-50/40 dark:bg-zinc-900/40 shrink-0">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-right">
              {/* بطاقة الخسارة */}
              <div className="bg-rose-50/50 dark:bg-rose-950/20 p-2.5 sm:p-3.5 rounded-xl border border-rose-100/80 dark:border-rose-900/40 shadow-xs flex flex-col justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-rose-700 dark:text-rose-400 leading-tight">
                  إجمالي الخسارة
                </span>
                <span className="text-sm sm:text-xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400 tracking-tight mt-1">
                  {formatCurrency(analysis.totalPurchasesLoss, currency, language)}
                </span>
                <span className="text-[9px] text-rose-400/80 hidden sm:block mt-0.5">
                  مقارنةً بالأرخص
                </span>
              </div>

              {/* بطاقة توفير الأرخص */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 sm:p-3.5 rounded-xl border border-emerald-100/80 dark:border-emerald-900/40 shadow-xs flex flex-col justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 leading-tight">
                  توفير الأرخص
                </span>
                <span className="text-sm sm:text-xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">
                  {formatCurrency(analysis.totalCheapestBatchSavings, currency, language)}
                </span>
                <span className="text-[9px] text-emerald-500/80 hidden sm:block mt-0.5">
                  للعلم (مقارنةً بالأعلى)
                </span>
              </div>

              {/* بطاقة الأصناف المتأثرة */}
              <div className="bg-zinc-100/70 dark:bg-zinc-800/60 p-2.5 sm:p-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 shadow-xs flex flex-col justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-zinc-600 dark:text-zinc-300 leading-tight">
                  الأصناف المتأثرة
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-sm sm:text-xl font-black font-mono tabular-nums text-zinc-900 dark:text-white tracking-tight">
                    {analysis.affectedProductsCount}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    من {analysis.totalProductsAnalyzed}
                  </span>
                </div>
                <span className="text-[9px] text-zinc-400 hidden sm:block mt-0.5">
                  دفعات متفاوتة السعر
                </span>
              </div>
            </div>
          </div>

          {/* شريط التحكم المثبت (Sticky) التبويبات والبحث */}
          <div className="sticky top-0 z-20 px-3 py-2.5 sm:px-6 sm:py-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 shadow-xs">
            {/* محدد التبويب */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl shrink-0">
              <button
                onClick={() => setActiveTab('products')}
                className={cn(
                  "flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-1.5",
                  activeTab === 'products'
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                <Package size={13} />
                <span>حسب الأصناف</span>
                <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-600 rounded-md">
                  {analysis.affectedProductsCount}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('suppliers')}
                className={cn(
                  "flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-1.5",
                  activeTab === 'suppliers'
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                <Truck size={13} />
                <span>حسب الموردين</span>
                <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-600 rounded-md">
                  {analysis.lossMakingSuppliers.length}
                </span>
              </button>
            </div>

            {/* محرك البحث والفلاتر */}
            <div className="flex items-center gap-2 flex-1 sm:max-w-md justify-end">
              <div className="relative w-full">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === 'products' ? 'بحث بالاسم، الباركود، المورد...' : 'بحث باسم المورد أو الصنف...'}
                  className="w-full pl-3 pr-8 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                />
              </div>
              {activeTab === 'products' && (
                <button
                  onClick={() => setOnlyLossItems(!onlyLossItems)}
                  className={cn(
                    "px-2.5 py-1.5 text-[11px] font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0",
                    onlyLossItems 
                      ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300 font-bold" 
                      : "bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                  )}
                  title="عرض الأصناف التي تحتوي فروقات خسارة فقط"
                >
                  {onlyLossItems ? 'المتأثرة فقط' : 'الكل'}
                </button>
              )}
            </div>
          </div>

          {/* محتوى القائمة (الأصناف أو الموردين) */}
          <div className="p-3 sm:p-5 space-y-2.5 flex-1">
            {activeTab === 'products' ? (
              /* تبويب الأصناف */
              filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center space-y-2">
                  <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                    <CheckCircle2 size={22} className="text-emerald-500" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    لا توجد فروقات أسعار سلبية في المخزون
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    جميع الأصناف تم شراؤها بنفس السعر أو بدفعة واحدة
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredProducts.map((item) => {
                    const isExpanded = expandedProductKeys[item.groupKey] ?? false;
                    const hasLoss = item.totalLoss > 0.0001;

                    return (
                      <div 
                        key={item.groupKey}
                        className={cn(
                          "rounded-xl border transition-all duration-150 overflow-hidden text-right",
                          hasLoss
                            ? "bg-white dark:bg-zinc-800/90 border-zinc-200 dark:border-zinc-700/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-600"
                            : "bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-800"
                        )}
                      >
                        {/* السطر الرئيسي للصنف */}
                        <div 
                          onClick={() => toggleProduct(item.groupKey)}
                          className="p-3 sm:p-4 cursor-pointer select-none space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                                  {highlightMatch(item.name, searchQuery)}
                                </h3>
                                {item.barcode && (
                                  <span className="font-mono tabular-nums text-[10px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
                                    {item.barcode}
                                  </span>
                                )}
                                {item.matchedByName && (
                                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded flex items-center gap-1 border border-amber-200/60 dark:border-amber-900/40">
                                    <AlertCircle size={10} />
                                    <span>مطابقة بالاسم</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                                <span>المخزون:</span>
                                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                  {formatBoxesAndPieces(item.totalQuantity, item.piecesPerBox)}
                                </span>
                                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                                <span>{item.batches.length} دفعة</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <div className="text-left">
                                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">
                                  الخسارة
                                </div>
                                <div className={cn(
                                  "text-sm sm:text-base font-black font-mono tabular-nums leading-tight",
                                  hasLoss ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                                )}>
                                  {formatCurrency(item.totalLoss, currency, language)}
                                </div>
                              </div>
                              <div className="h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-500">
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </div>
                            </div>
                          </div>

                          {/* شريط مقارنة الأسعار السريعة */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-700/50 text-[10px] sm:text-[11px]">
                            <div className="space-y-0.2">
                              <span className="text-zinc-400 font-medium">أرخص كرتونة:</span>
                              <div className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                                {formatCurrency(item.minBoxPrice, currency, language)}
                              </div>
                            </div>
                            <div className="space-y-0.2">
                              <span className="text-zinc-400 font-medium">أغلى كرتونة:</span>
                              <div className="font-mono tabular-nums font-bold text-zinc-800 dark:text-zinc-200">
                                {formatCurrency(item.maxBoxPrice, currency, language)}
                              </div>
                            </div>
                            <div className="space-y-0.2">
                              <span className="text-zinc-400 font-medium">فرق الكرتونة:</span>
                              <div className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                                {item.boxPriceDifference > 0.0001 ? `+${formatCurrency(item.boxPriceDifference, currency, language)}` : '0.000'}
                              </div>
                            </div>
                            <div className="space-y-0.2">
                              <span className="text-zinc-400 font-medium">توفير الأرخص:</span>
                              <div className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(item.cheapestBatchSaving, currency, language)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* قائمة الدفعات التفصيلية عند التوسيع */}
                        {isExpanded && (
                          <div className="border-t border-zinc-100 dark:border-zinc-700/60 bg-zinc-50/70 dark:bg-zinc-900/60 p-3 space-y-1.5">
                            <div className="text-[10px] font-bold text-zinc-500 mb-1">
                              تفاصيل دفعات المخزون المتوفرة:
                            </div>
                            <div className="space-y-1.5">
                              {item.batches.map((batch, bIdx) => (
                                <div 
                                  key={`${batch.productId}-${bIdx}`}
                                  className={cn(
                                    "p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs",
                                    batch.isReference
                                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40"
                                      : "bg-white dark:bg-zinc-800 border-zinc-200/80 dark:border-zinc-700/80"
                                  )}
                                >
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-zinc-900 dark:text-white text-[11px] sm:text-xs">
                                        {formatBoxesAndPieces(batch.quantity, batch.piecesPerBox)}
                                      </span>
                                      {batch.isReference && (
                                        <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.2 rounded">
                                          الأرخص (مرجع)
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                                      <Truck size={11} className="text-zinc-400" />
                                      <span>المورد:</span>
                                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                        {batch.supplierName}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4 justify-between sm:justify-end text-left pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-700/40">
                                    <div>
                                      <div className="text-[9px] text-zinc-400">سعر الشراء</div>
                                      <div className="font-mono tabular-nums font-bold text-zinc-800 dark:text-zinc-200 text-[11px]">
                                        {formatCurrency(batch.boxPurchasePrice, currency, language)}
                                        <span className="text-[9px] text-zinc-400 font-normal mr-1">
                                          ({formatCurrency(batch.piecePrice, currency, language)}/ق)
                                        </span>
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-[9px] text-zinc-400">فرق الخسارة</div>
                                      <div className={cn(
                                        "font-mono tabular-nums font-black text-xs",
                                        batch.batchLoss > 0.0001 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                                      )}>
                                        {batch.batchLoss > 0.0001 ? `+${formatCurrency(batch.batchLoss, currency, language)}` : '0.000'}
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
            ) : (
              /* تبويب الموردين */
              filteredSuppliers.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center space-y-2">
                  <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                    <CheckCircle2 size={22} className="text-emerald-500" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    لا يوجد موردون تسببوا في زيادة بالأسعار
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    جميع مشتريات المخزون الحالي تمت بأدنى سعر
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/30 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <Info size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      الموردون الذين تسببوا في فرق زيادة بالأسعار مقارنةً بأرخص سعر شراء لنفس الأصناف
                    </span>
                  </div>

                  {filteredSuppliers.map((supplier) => {
                    const supKey = supplier.supplierId || supplier.supplierName;
                    const q = searchQuery.trim();
                    const isSupplierNameMatch = q ? matchesQuery(supplier.supplierName, q) : false;
                    const matchingBatches = q 
                      ? supplier.affectedBatches.filter(b => 
                          matchesQuery(b.productName, q) || 
                          matchesQuery(b.barcode, q)
                        ) 
                      : supplier.affectedBatches;
                    const matchingBatchesCount = matchingBatches.length;

                    // إذا بحث المستخدم ووجد أصنافاً مطابقة:
                    // نعرض حصراً تلك الأصناف المطابقة فقط (المنتج وحده) لاختصار القائمة الطويلة
                    const isShowingAll = showAllSupplierBatches[supKey] === true;
                    const displayedBatches = (q && matchingBatchesCount > 0 && !isShowingAll)
                      ? matchingBatches
                      : (q && !isSupplierNameMatch && matchingBatchesCount === 0)
                        ? []
                        : supplier.affectedBatches;

                    const hiddenBatchesCount = supplier.affectedBatches.length - displayedBatches.length;

                    // فتح المورد تلقائياً إذا كان يحتوي على صنف مطابق للبحث
                    const isExpanded = expandedSupplierIds[supKey] ?? (q.length > 0 && (matchingBatchesCount > 0 || isSupplierNameMatch));

                    const displayedLoss = (q && matchingBatchesCount > 0 && !isShowingAll)
                      ? matchingBatches.reduce((sum, b) => sum + b.batchLoss, 0)
                      : supplier.totalLoss;

                    return (
                      <div 
                        key={supKey}
                        className={cn(
                          "rounded-xl border transition-all overflow-hidden text-right",
                          matchingBatchesCount > 0 && q
                            ? "border-amber-300 dark:border-amber-700/80 bg-white dark:bg-zinc-800/95 shadow-sm ring-1 ring-amber-400/20"
                            : "border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/90 shadow-xs"
                        )}
                      >
                        <div 
                          onClick={() => toggleSupplier(supKey)}
                          className="p-3 sm:p-4 cursor-pointer select-none flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="h-7 w-7 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
                                <Truck size={14} />
                              </div>
                              <h3 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white">
                                {highlightMatch(supplier.supplierName, searchQuery)}
                              </h3>
                              {q && matchingBatchesCount > 0 && (
                                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                                  <Sparkles size={11} className="text-amber-600" />
                                  <span>
                                    {matchingBatchesCount === 1 ? 'المنتج المطلوب وحده' : `${matchingBatchesCount} أصناف مطابقة`}
                                  </span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pr-9">
                              {q && matchingBatchesCount > 0 && !isShowingAll ? (
                                <span>
                                  يظهر المنتج وحده (مخفي <strong className="text-zinc-700 dark:text-zinc-300">{hiddenBatchesCount}</strong> أصناف أخرى لهذا المورد)
                                </span>
                              ) : (
                                <span>
                                  تسبب بزيادة على <span className="font-bold text-zinc-800 dark:text-zinc-200">{supplier.affectedProductsCount}</span> صنف
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-left">
                              <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">
                                {q && matchingBatchesCount > 0 && !isShowingAll ? 'الزيادة على المنتج' : 'إجمالي الزيادة'}
                              </div>
                              <div className="text-sm sm:text-base font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
                                {formatCurrency(displayedLoss, currency, language)}
                              </div>
                            </div>
                            <div className="h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-500">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </div>
                        </div>

                        {/* قائمة الأصناف المتأثرة من هذا المورد */}
                        {isExpanded && (
                          <div className="border-t border-zinc-100 dark:border-zinc-700/60 bg-zinc-50/70 dark:bg-zinc-900/60 p-3 space-y-1.5">
                            <div className="text-[10px] font-bold text-zinc-500 mb-1 flex items-center justify-between">
                              <span>
                                {hiddenBatchesCount > 0 
                                  ? `المنتج المطلوب وحده (${displayedBatches.length}):`
                                  : 'الأصناف المشتراة بأسعار أعلى من السعر الأرخص:'}
                              </span>
                              {hiddenBatchesCount > 0 && (
                                <span className="text-amber-700 dark:text-amber-400 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/50">
                                  تم اختصار القائمة لإظهار المنتج وحده
                                </span>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              {displayedBatches.map((b, idx) => {
                                const isBatchMatch = q 
                                  ? matchesQuery(b.productName, q) || matchesQuery(b.barcode, q)
                                  : false;

                                return (
                                  <div 
                                    key={`${b.productName}-${idx}`}
                                    className={cn(
                                      "p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all",
                                      isBatchMatch
                                        ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/90 ring-2 ring-amber-400/50 shadow-xs"
                                        : "bg-white dark:bg-zinc-800 border-zinc-200/80 dark:border-zinc-700/80"
                                    )}
                                  >
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <div className="font-bold text-zinc-900 dark:text-white text-[11px] sm:text-xs">
                                          {highlightMatch(b.productName, searchQuery)}
                                        </div>
                                        {b.barcode && (
                                          <span className="font-mono tabular-nums text-[9px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded">
                                            {highlightMatch(b.barcode, searchQuery)}
                                          </span>
                                        )}
                                        {isBatchMatch && (
                                          <span className="text-[9px] font-bold text-amber-800 dark:text-amber-200 bg-amber-200/90 dark:bg-amber-900/80 px-1.5 py-0.2 rounded-md flex items-center gap-1 shrink-0">
                                            <Sparkles size={10} /> المنتج المطلوب
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-zinc-500">
                                        الكمية المتبقية: <span className="font-bold text-zinc-700 dark:text-zinc-300">{formatBoxesAndPieces(b.quantity, b.piecesPerBox)}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-4 justify-between sm:justify-end text-left pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-700/40">
                                      <div>
                                        <div className="text-[9px] text-zinc-400">سعر المورد / الأرخص</div>
                                        <div className="font-mono tabular-nums font-bold text-zinc-800 dark:text-zinc-200 text-[11px]">
                                          {formatCurrency(b.boxPrice, currency, language)}
                                          <span className="text-emerald-600 dark:text-emerald-400 text-[9px] mr-1">
                                            ({formatCurrency(b.minPiecePrice * (b.piecesPerBox || 1), currency, language)})
                                          </span>
                                        </div>
                                      </div>

                                      <div>
                                        <div className="text-[9px] text-zinc-400">الزيادة</div>
                                        <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400 text-xs">
                                          +{formatCurrency(b.batchLoss, currency, language)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* زر إظهار باقي الأصناف إذا رغب المستخدم في استعراض كل قائمة المورد */}
                              {hiddenBatchesCount > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => toggleShowAllSupplierBatches(supKey, e)}
                                  className="w-full py-2 px-3 text-center text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center gap-1.5 mt-2"
                                >
                                  <ChevronDown size={14} />
                                  <span>عرض باقي أصناف هذا المورد ({hiddenBatchesCount} صنف إضافي)</span>
                                </button>
                              )}
                              {isShowingAll && supplier.affectedBatches.length > displayedBatches.length && (
                                <button
                                  type="button"
                                  onClick={(e) => toggleShowAllSupplierBatches(supKey, e)}
                                  className="w-full py-2 px-3 text-center text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center gap-1.5 mt-2"
                                >
                                  <ChevronUp size={14} />
                                  <span>إخفاء باقي الأصناف (عرض المنتج المطلوب وحده)</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {/* ذيل المودال (مضغوط) */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Info size={13} className="text-zinc-400 shrink-0" />
            <span className="truncate">الحسابات تقديرية للمخزون الحالي فقط</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-bold text-xs text-zinc-700 dark:text-zinc-200 bg-zinc-200/80 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-lg transition-colors shrink-0"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

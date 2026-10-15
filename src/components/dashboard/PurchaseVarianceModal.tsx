import React, { useState, useMemo } from 'react';
import { 
  X, 
  TrendingDown, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Truck, 
  Package, 
  Sparkles,
  Info,
  CheckCircle2
} from 'lucide-react';
import { 
  PurchaseVarianceAnalysisResult, 
  VarianceProductGroup, 
  SupplierVarianceSummary,
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

  if (!isOpen) return null;

  const toggleProduct = (key: string) => {
    setExpandedProductKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSupplier = (key: string) => {
    setExpandedSupplierIds(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // تصفية الأصناف بالبحث وحالة الخسارة
  const filteredProducts = analysis.productGroups.filter(group => {
    if (onlyLossItems && group.totalLoss <= 0.0001) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = group.name.toLowerCase().includes(q);
    const barcodeMatch = group.barcode?.toLowerCase().includes(q);
    const supplierMatch = group.batches.some(b => b.supplierName.toLowerCase().includes(q));
    return nameMatch || barcodeMatch || supplierMatch;
  });

  // تصفية الموردين بالبحث
  const filteredSuppliers = analysis.lossMakingSuppliers.filter(sup => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = sup.supplierName.toLowerCase().includes(q);
    const prodMatch = sup.affectedBatches.some(b => b.productName.toLowerCase().includes(q));
    return nameMatch || prodMatch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200" dir="rtl">
      <div 
        className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ترويسة المودال */}
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-start justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="space-y-1 text-right">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <TrendingDown size={18} />
              </div>
              <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                تحليل فروقات وخسائر شراء المخزون
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed pr-10">
              مقارنة تكلفة شراء المخزون الحالي مع أدنى سعر شراء مسجل لكل صنف لمعرفة الفروقات الإضافية
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        {/* شريط الإحصائيات الرئيسي في الترويسة */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-zinc-100/50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800/80 text-right">
          <div className="bg-white dark:bg-zinc-800/80 p-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 shadow-sm flex flex-col">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              إجمالي خسارة الشراء بالمخزون
            </span>
            <span className="text-xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400 tracking-tight">
              {formatCurrency(analysis.totalPurchasesLoss, currency, language)}
            </span>
            <span className="text-[10px] text-zinc-400 mt-1">
              مقارنةً بأرخص سعر شراء لنفس الصنف
            </span>
          </div>

          <div className="bg-white dark:bg-zinc-800/80 p-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 shadow-sm flex flex-col">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              توفير الدفعة الأرخص (للعلم)
            </span>
            <span className="text-xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatCurrency(analysis.totalCheapestBatchSavings, currency, language)}
            </span>
            <span className="text-[10px] text-zinc-400 mt-1">
              مبلغ تم توفيره مقارنةً بأعلى سعر شراء
            </span>
          </div>

          <div className="bg-white dark:bg-zinc-800/80 p-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 shadow-sm flex flex-col">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              الأصناف ذات الفروقات
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black font-mono tabular-nums text-zinc-900 dark:text-white tracking-tight">
                {analysis.affectedProductsCount}
              </span>
              <span className="text-xs text-zinc-500">
                من إجمالي {analysis.totalProductsAnalyzed} صنف
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1">
              أصناف موجودة بدفعات متفاوتة السعر
            </span>
          </div>
        </div>

        {/* شريط التحكم: التبويبات والبحث */}
        <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900">
          {/* محدد التبويب (Segmented control) */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl shrink-0">
            <button
              onClick={() => setActiveTab('products')}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5",
                activeTab === 'products'
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              <Package size={14} />
              <span>حسب الأصناف</span>
              <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-600 rounded-md">
                {analysis.affectedProductsCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5",
                activeTab === 'suppliers'
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              <Truck size={14} />
              <span>حسب الموردين</span>
              <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-600 rounded-md">
                {analysis.lossMakingSuppliers.length}
              </span>
            </button>
          </div>

          {/* محرك البحث والفلاتر */}
          <div className="flex items-center gap-2 flex-1 sm:max-w-md justify-end">
            <div className="relative w-full">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'products' ? 'بحث بالاسم أو الباركود أو المورد...' : 'بحث باسم المورد أو الصنف...'}
                className="w-full pl-3 pr-9 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-white"
              />
            </div>
            {activeTab === 'products' && (
              <button
                onClick={() => setOnlyLossItems(!onlyLossItems)}
                className={cn(
                  "px-3 py-2 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0",
                  onlyLossItems 
                    ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                )}
                title="عرض الأصناف التي تحتوي فروقات خسارة فقط"
              >
                {onlyLossItems ? 'المتأثرة فقط' : 'الكل'}
              </button>
            )}
          </div>
        </div>

        {/* محتوى التبويبات التفاعلي القابل للتمرير */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'products' ? (
            /* تبويب الأصناف */
            filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 flex flex-col items-center justify-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    لا توجد فروقات أسعار سلبية في المخزون الحالي
                  </p>
                  <p className="text-xs text-zinc-400">
                    جميع الأصناف تم شراؤها بنفس السعر أو بدفعة واحدة
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((item) => {
                  const isExpanded = expandedProductKeys[item.groupKey] ?? false;
                  const hasLoss = item.totalLoss > 0.0001;

                  return (
                    <div 
                      key={item.groupKey}
                      className={cn(
                        "rounded-xl border transition-all duration-150 overflow-hidden text-right",
                        hasLoss
                          ? "bg-white dark:bg-zinc-800/90 border-zinc-200 dark:border-zinc-700/80 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-600"
                          : "bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-800"
                      )}
                    >
                      {/* السطر الرئيسي للصنف */}
                      <div 
                        onClick={() => toggleProduct(item.groupKey)}
                        className="p-4 cursor-pointer select-none space-y-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                                {item.name}
                              </h3>
                              {item.barcode && (
                                <span className="font-mono tabular-nums text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                                  {item.barcode}
                                </span>
                              )}
                              {item.matchedByName && (
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200/60 dark:border-amber-900/40">
                                  <AlertCircle size={12} />
                                  <span>مطابقة بالاسم، راجعه</span>
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 font-medium">
                              <span>المخزون المتوفر:</span>
                              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                {formatBoxesAndPieces(item.totalQuantity, item.piecesPerBox)}
                              </span>
                              <span className="text-zinc-300 dark:text-zinc-600">·</span>
                              <span>{item.batches.length} دفعة</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-left">
                              <div className="text-xs font-bold text-zinc-400 uppercase tracking-tight">
                                إجمالي الخسارة
                              </div>
                              <div className={cn(
                                "text-base font-black font-mono tabular-nums",
                                hasLoss ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                              )}>
                                {formatCurrency(item.totalLoss, currency, language)}
                              </div>
                            </div>
                            <div className="h-7 w-7 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-500">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>
                        </div>

                        {/* شريط مقارنة الأسعار السريعة */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50 text-[11px]">
                          <div className="space-y-0.5">
                            <span className="text-zinc-400 font-medium">أرخص سعر كرتونة:</span>
                            <div className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(item.minBoxPrice, currency, language)}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-zinc-400 font-medium">أغلى سعر كرتونة:</span>
                            <div className="font-mono tabular-nums font-bold text-zinc-800 dark:text-zinc-200">
                              {formatCurrency(item.maxBoxPrice, currency, language)}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-zinc-400 font-medium">فرق الكرتونة:</span>
                            <div className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                              {item.boxPriceDifference > 0.0001 ? `+${formatCurrency(item.boxPriceDifference, currency, language)}` : '0.000'}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-zinc-400 font-medium">توفير الأرخص (للعلم):</span>
                            <div className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(item.cheapestBatchSaving, currency, language)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* قائمة الدفعات التفصيلية عند التوسيع */}
                      {isExpanded && (
                        <div className="border-t border-zinc-100 dark:border-zinc-700/60 bg-zinc-50/70 dark:bg-zinc-900/60 p-4 space-y-2">
                          <div className="text-[11px] font-bold text-zinc-500 mb-2">
                            تفاصيل الدفعات المكونة للمخزون الحالي:
                          </div>
                          <div className="space-y-2">
                            {item.batches.map((batch, bIdx) => (
                              <div 
                                key={`${batch.productId}-${bIdx}`}
                                className={cn(
                                  "p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs",
                                  batch.isReference
                                    ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40"
                                    : "bg-white dark:bg-zinc-800 border-zinc-200/80 dark:border-zinc-700/80"
                                )}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-zinc-900 dark:text-white">
                                      {formatBoxesAndPieces(batch.quantity, batch.piecesPerBox)}
                                    </span>
                                    {batch.isReference && (
                                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                                        الدفعة الأرخص (المرجع)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                                    <Truck size={12} className="text-zinc-400" />
                                    <span>المورد:</span>
                                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                      {batch.supplierName}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-6 justify-between sm:justify-end text-left">
                                  <div>
                                    <div className="text-[10px] text-zinc-400">سعر الشراء للكرتونة / القطعة</div>
                                    <div className="font-mono tabular-nums font-bold text-zinc-800 dark:text-zinc-200">
                                      {formatCurrency(batch.boxPurchasePrice, currency, language)}
                                      <span className="text-[10px] text-zinc-400 font-normal mr-1">
                                        ({formatCurrency(batch.piecePrice, currency, language)} / قطعة)
                                      </span>
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[10px] text-zinc-400">فرق الخسارة بالدفعة</div>
                                    <div className={cn(
                                      "font-mono tabular-nums font-black text-sm",
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
              <div className="py-16 text-center text-zinc-400 flex flex-col items-center justify-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    لا يوجد موردون تسببوا في زيادة بالأسعار
                  </p>
                  <p className="text-xs text-zinc-400">
                    جميع مشتريات المخزون الحالي تمت بأسعار متطابقة مع أدنى سعر
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/30 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <Info size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    يتم هنا إظهار الموردين الذين تسببوا في فرق زيادة بالأسعار مقارنةً بأرخص سعر شراء لنفس الأصناف، مرتبين من الأكثر تسبباً بالفرق إلى الأقل.
                  </span>
                </div>

                {filteredSuppliers.map((supplier) => {
                  const isExpanded = expandedSupplierIds[supplier.supplierId || supplier.supplierName] ?? false;

                  return (
                    <div 
                      key={supplier.supplierId || supplier.supplierName}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/90 shadow-sm overflow-hidden text-right"
                    >
                      <div 
                        onClick={() => toggleSupplier(supplier.supplierId || supplier.supplierName)}
                        className="p-4 cursor-pointer select-none flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400">
                              <Truck size={16} />
                            </div>
                            <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                              {supplier.supplierName}
                            </h3>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 pr-10">
                            تسبب بفروقات زيادة على <span className="font-bold text-zinc-800 dark:text-zinc-200">{supplier.affectedProductsCount}</span> صنف
                          </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-left">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">
                              إجمالي الزيادة المتسبب بها
                            </div>
                            <div className="text-base font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
                              {formatCurrency(supplier.totalLoss, currency, language)}
                            </div>
                          </div>
                          <div className="h-7 w-7 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-500">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                      </div>

                      {/* قائمة الأصناف المتأثرة من هذا المورد */}
                      {isExpanded && (
                        <div className="border-t border-zinc-100 dark:border-zinc-700/60 bg-zinc-50/70 dark:bg-zinc-900/60 p-4 space-y-2">
                          <div className="text-[11px] font-bold text-zinc-500 mb-2">
                            الأصناف والدفعات المشتراة من هذا المورد بأسعار أعلى من السعر الأرخص:
                          </div>
                          <div className="space-y-2">
                            {supplier.affectedBatches.map((b, idx) => (
                              <div 
                                key={`${b.productName}-${idx}`}
                                className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="space-y-1">
                                  <div className="font-bold text-zinc-900 dark:text-white">
                                    {b.productName}
                                  </div>
                                  <div className="text-[11px] text-zinc-500">
                                    الكمية المتبقية: <span className="font-bold text-zinc-700 dark:text-zinc-300">{formatBoxesAndPieces(b.quantity, b.piecesPerBox)}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-6 justify-between sm:justify-end text-left">
                                  <div>
                                    <div className="text-[10px] text-zinc-400">سعر شراء المورد / السعر الأرخص</div>
                                    <div className="font-mono tabular-nums font-bold text-zinc-800 dark:text-zinc-200">
                                      {formatCurrency(b.boxPrice, currency, language)}
                                      <span className="text-emerald-600 dark:text-emerald-400 text-[10px] mr-1.5">
                                        (الأرخص: {formatCurrency(b.minPiecePrice * (b.piecesPerBox || 1), currency, language)})
                                      </span>
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[10px] text-zinc-400">فرق الزيادة (الخسارة)</div>
                                    <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400 text-sm">
                                      +{formatCurrency(b.batchLoss, currency, language)}
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
          )}
        </div>

        {/* ذيل المودال */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Info size={14} className="text-zinc-400" />
            <span>الحسابات تقديرية للمخزون الحالي فقط ولا تعدل أي أسعار أو بيانات</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 font-bold text-zinc-700 dark:text-zinc-200 bg-zinc-200/80 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-xl transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

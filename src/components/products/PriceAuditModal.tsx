import React, { useState, useMemo } from 'react';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  Layers, 
  Package, 
  Sparkles, 
  Search, 
  Save, 
  Edit3, 
  HelpCircle, 
  ArrowRightLeft,
  Check,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Product, OperationType } from '../../types';
import { useAppContext } from '../../AppContext';
import { auditAllProducts, auditProduct, ProductPriceAudit, SuggestedFix, PriceIssueType } from '../../lib/priceAuditor';
import { formatCurrency, formatQuantity, roundMoney, cn, handleFirestoreError } from '../../lib/utils';
import { doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/auditLogger';

interface PriceAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onOpenProductEdit?: (product: Product) => void;
}

export const PriceAuditModal: React.FC<PriceAuditModalProps> = ({
  isOpen,
  onClose,
  products,
  onOpenProductEdit
}) => {
  const { t, i18n } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const language = i18n.language;

  const [activeTab, setActiveTab] = useState<'all_issues' | 'loss' | 'box_confusion' | 'mismatch' | 'zero' | 'verified' | 'all'>('all_issues');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRows, setEditingRows] = useState<Record<string, {
    purchasePrice: string;
    sellingPrice: string;
    boxPurchasePrice: string;
    piecesPerBox: string;
  }>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  // Audit all products
  const auditedList = useMemo(() => {
    return auditAllProducts(products);
  }, [products]);

  // Statistics counters
  const stats = useMemo(() => {
    let totalWithIssues = 0;
    let lossCount = 0;
    let boxConfusionCount = 0;
    let mismatchCount = 0;
    let zeroCount = 0;
    let verifiedCount = 0;

    auditedList.forEach(item => {
      if (item.isVerified) {
        verifiedCount++;
      }
      if (item.hasIssues) {
        totalWithIssues++;
        const types = item.issues.map(i => i.type);
        if (types.includes('loss_making') || types.includes('box_entered_as_piece')) {
          lossCount++;
        }
        if (types.includes('excessive_margin') || types.includes('box_entered_as_piece')) {
          boxConfusionCount++;
        }
        if (types.includes('box_piece_mismatch')) {
          mismatchCount++;
        }
        if (types.includes('zero_missing')) {
          zeroCount++;
        }
      }
    });

    return {
      totalWithIssues,
      lossCount,
      boxConfusionCount,
      mismatchCount,
      zeroCount,
      verifiedCount,
      cleanCount: products.length - totalWithIssues
    };
  }, [auditedList, products.length]);

  // Filtered list
  const filteredAudits = useMemo(() => {
    return auditedList.filter(item => {
      // Search
      const matchesSearch = !searchQuery.trim() || 
        item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.product.barcode?.includes(searchQuery) ||
        item.product.barcode2?.includes(searchQuery) ||
        item.product.category?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Tab filter
      if (activeTab === 'all') return true;
      if (activeTab === 'all_issues') return item.hasIssues;
      if (activeTab === 'verified') return item.isVerified;
      
      if (!item.hasIssues) return false;

      const types = item.issues.map(i => i.type);
      if (activeTab === 'loss') return types.includes('loss_making') || types.includes('box_entered_as_piece');
      if (activeTab === 'box_confusion') return types.includes('excessive_margin') || types.includes('box_entered_as_piece');
      if (activeTab === 'mismatch') return types.includes('box_piece_mismatch');
      if (activeTab === 'zero') return types.includes('zero_missing');

      return true;
    });
  }, [auditedList, searchQuery, activeTab]);

  if (!isOpen) return null;

  const handleVerifyProduct = async (product: Product, verified: boolean) => {
    if (!user || !product.id) return;
    setSavingIds(prev => ({ ...prev, [product.id!]: true }));

    try {
      const path = `users/${user.uid}/products/${product.id}`;
      await updateDoc(doc(db, path), {
        priceVerified: verified,
        priceVerifiedAt: verified ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });

      logAudit(
        'update',
        'product',
        product.id,
        product.name,
        verified ? 'تأكيد صحة الأسعار وتجاوز التنبيه' : 'إلغاء تأكيد الأسعار وإعادة التدقيق'
      );

      showToast(
        verified 
          ? `تم اعتماد صحة أسعار ${product.name} وإزالته من التنبيهات` 
          : `تم إلغاء اعتماد أسعار ${product.name} وإعادته للتدقيق`, 
        'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/products/${product.id}`);
      showToast('حدث خطأ أثناء تعديل حالة التدقيق', 'error');
    } finally {
      setSavingIds(prev => ({ ...prev, [product.id!]: false }));
    }
  };

  const handleApplyFix = async (product: Product, fix: SuggestedFix) => {
    if (!user || !product.id) return;
    setSavingIds(prev => ({ ...prev, [product.id!]: true }));

    try {
      const path = `users/${user.uid}/products/${product.id}`;
      await updateDoc(doc(db, path), {
        ...fix.patch,
        priceVerified: false,
        updatedAt: serverTimestamp(),
      });

      logAudit(
        'update', 
        'product', 
        product.id, 
        product.name, 
        `تصحيح تدقيق الأسعار: ${fix.label}`
      );

      showToast(`تم تطبيق التصحيح بنجاح على ${product.name}`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/products/${product.id}`);
      showToast('حدث خطأ أثناء حفظ التعديل', 'error');
    } finally {
      setSavingIds(prev => ({ ...prev, [product.id!]: false }));
    }
  };

  const handleInlineChange = (productId: string, field: 'purchasePrice' | 'sellingPrice' | 'boxPurchasePrice' | 'piecesPerBox', value: string) => {
    setEditingRows(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {
          purchasePrice: String(products.find(p => p.id === productId)?.purchasePrice || ''),
          sellingPrice: String(products.find(p => p.id === productId)?.sellingPrice || ''),
          boxPurchasePrice: String(products.find(p => p.id === productId)?.boxPurchasePrice || ''),
          piecesPerBox: String(products.find(p => p.id === productId)?.piecesPerBox || '1'),
        }),
        [field]: value
      }
    }));
  };

  const handleSaveInline = async (product: Product) => {
    if (!user || !product.id) return;
    const row = editingRows[product.id];
    if (!row) return;

    const purchase = roundMoney(row.purchasePrice);
    const selling = roundMoney(row.sellingPrice);
    const boxPurchase = roundMoney(row.boxPurchasePrice);
    const piecesBox = Math.max(1, parseInt(row.piecesPerBox) || 1);

    if (selling > 0 && purchase > 0 && selling <= purchase) {
      showToast(`تنبيه: سعر البيع (${selling}) يجب أن يكون أكبر من سعر الشراء (${purchase})`, 'error');
      return;
    }

    setSavingIds(prev => ({ ...prev, [product.id!]: true }));

    try {
      const path = `users/${user.uid}/products/${product.id}`;
      const updates: any = {
        purchasePrice: purchase,
        sellingPrice: selling,
        piecesPerBox: piecesBox,
        updatedAt: serverTimestamp(),
      };

      if (boxPurchase > 0) {
        updates.boxPurchasePrice = boxPurchase;
      }

      await updateDoc(doc(db, path), updates);

      logAudit(
        'update',
        'product',
        product.id,
        product.name,
        `تعديل أسعار يدوي: شراء ${purchase}، بيع ${selling}، كرتونة ${boxPurchase}`
      );

      showToast(`تم تحديث أسعار ${product.name} بنجاح`, 'success');

      // Clear row edit
      setEditingRows(prev => {
        const next = { ...prev };
        delete next[product.id!];
        return next;
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/products/${product.id}`);
      showToast('حدث خطأ أثناء حفظ التعديل', 'error');
    } finally {
      setSavingIds(prev => ({ ...prev, [product.id!]: false }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <span>أداة التدقيق الذكي للأسعار وتصحيح التجزئة</span>
                {stats.totalWithIssues > 0 ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800">
                    {stats.totalWithIssues} منتج يحتاج مراجعة
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    جميع الأسعار مضبوطة 100%
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                كشف فوري لأخطاء وضع سعر العلبة للقطعة الواحدة، البيع بخسارة، وعدم تطابق كرتونة الجملة والتجزئة.
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Statistics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 px-4 sm:px-6 py-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shrink-0">
          <button
            onClick={() => setActiveTab('all_issues')}
            className={cn(
              "flex flex-col p-2.5 rounded-xl border text-right transition-all",
              activeTab === 'all_issues'
                ? "bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200 shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">تنبيهات نشطة</span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">{stats.totalWithIssues}</span>
          </button>

          <button
            onClick={() => setActiveTab('loss')}
            className={cn(
              "flex flex-col p-2.5 rounded-xl border text-right transition-all",
              activeTab === 'loss'
                ? "bg-red-500/10 border-red-500/40 text-red-900 dark:text-red-200 shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">🔴 بيع بخسارة</span>
            <span className="text-lg font-black text-red-600 dark:text-red-400 font-mono">{stats.lossCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('box_confusion')}
            className={cn(
              "flex flex-col p-2.5 rounded-xl border text-right transition-all",
              activeTab === 'box_confusion'
                ? "bg-purple-500/10 border-purple-500/40 text-purple-900 dark:text-purple-200 shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">🟡 سعر العلبة</span>
            <span className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">{stats.boxConfusionCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('mismatch')}
            className={cn(
              "flex flex-col p-2.5 rounded-xl border text-right transition-all",
              activeTab === 'mismatch'
                ? "bg-blue-500/10 border-blue-500/40 text-blue-900 dark:text-blue-200 shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">🔵 عدم تطابق</span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">{stats.mismatchCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('verified')}
            className={cn(
              "flex flex-col p-2.5 rounded-xl border text-right transition-all",
              activeTab === 'verified'
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-200 shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">✅ مؤكدة يدوياً</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{stats.verifiedCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "flex flex-col p-2.5 rounded-xl border text-right transition-all",
              activeTab === 'all'
                ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 text-white dark:text-zinc-900 shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <span className="text-[11px] font-medium opacity-80">جميع المنتجات</span>
            <span className="text-lg font-black font-mono">{products.length}</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              name="audit_search"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-protonpass-ignore="true"
              data-form-type="other"
              placeholder="ابحث بالاسم أو الباركود أو الفئة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9.5 pr-10 pl-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            />
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 self-end sm:self-auto">
            <span>النتائج المعروضة:</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200 font-mono">{filteredAudits.length}</span>
          </div>
        </div>

        {/* Content Body / Audited Products List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredAudits.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                لا توجد منتجات ضمن هذا التصنيف
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                {activeTab === 'all_issues' 
                  ? 'رائع! لا توجد أي أخطاء تسعير مسجلة في منتجاتك الحالية.'
                  : 'لا توجد منتجات تطابق شرط البحث أو الفلتر المحدد.'}
              </p>
            </div>
          ) : (
            filteredAudits.map((audit) => {
              const { product, issues, profitMarginPercent, profitPerPiece, suggestedFixes } = audit;
              const isSaving = savingIds[product.id || ''] || false;
              const rowEdit = editingRows[product.id || ''];
              const piecesBox = product.piecesPerBox || 1;

              const currentPurchase = rowEdit ? rowEdit.purchasePrice : String(product.purchasePrice || 0);
              const currentSelling = rowEdit ? rowEdit.sellingPrice : String(product.sellingPrice || 0);
              const currentBoxPurchase = rowEdit ? rowEdit.boxPurchasePrice : String(product.boxPurchasePrice || '');
              const currentPiecesPerBox = rowEdit ? rowEdit.piecesPerBox : String(piecesBox);

              const hasUnsavedChanges = !!rowEdit;

              return (
                <div 
                  key={product.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-200",
                    audit.hasIssues 
                      ? "bg-white dark:bg-zinc-900 border-amber-200 dark:border-amber-900/60 shadow-sm hover:border-amber-300"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                  )}
                >
                  {/* Top Bar: Title & Category & Issue Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-zinc-600 dark:text-zinc-300 text-xs">
                        <Package size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white leading-tight truncate">
                          {product.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                          <span>{product.category || 'بدون فئة'}</span>
                          {product.barcode && <span>• باركود: <span className="font-mono">{product.barcode}</span></span>}
                          {piecesBox > 1 && (
                            <span className="text-brand-600 dark:text-brand-400 font-bold">
                              • ({piecesBox} قطع/علبة)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      {audit.isVerified ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>معتمد ومؤكد يدوياً</span>
                        </span>
                      ) : (
                        issues.map((iss, idx) => (
                          <span 
                            key={idx}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border",
                              iss.severity === 'error'
                                ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800"
                                : iss.severity === 'warning'
                                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            )}
                          >
                            <AlertTriangle size={12} />
                            <span>{iss.title}</span>
                          </span>
                        ))
                      )}

                      {!audit.isVerified && issues.length === 0 && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                          <Check size={12} />
                          <span>سليم ومطابق</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Issues Detailed Explanations */}
                  {!audit.isVerified && issues.length > 0 && (
                    <div className="my-3 space-y-1.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 p-3 rounded-xl">
                      {issues.map((iss, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                          <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                          <p className="leading-relaxed">{iss.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pricing Inputs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 my-3 pt-1">
                    {/* Purchase Price */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                         سعر شراء القطعة
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.001"
                          inputMode="decimal"
                          autoComplete="one-time-code"
                          autoCorrect="off"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-protonpass-ignore="true"
                          data-form-type="other"
                          value={currentPurchase}
                          onChange={(e) => handleInlineChange(product.id!, 'purchasePrice', e.target.value)}
                          className="w-full h-8 px-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-xs font-mono font-bold text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <span className="text-[10px] text-zinc-400 shrink-0">{settings.currency}</span>
                      </div>
                    </div>

                    {/* Selling Price */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                        سعر بيع القطعة
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.001"
                          inputMode="decimal"
                          autoComplete="one-time-code"
                          autoCorrect="off"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-protonpass-ignore="true"
                          data-form-type="other"
                          value={currentSelling}
                          onChange={(e) => handleInlineChange(product.id!, 'sellingPrice', e.target.value)}
                          className="w-full h-8 px-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-xs font-mono font-bold text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <span className="text-[10px] text-zinc-400 shrink-0">{settings.currency}</span>
                      </div>
                    </div>

                    {/* Pieces Per Box */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                        عدد القطع بالعلبة
                      </label>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoCorrect="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-protonpass-ignore="true"
                        data-form-type="other"
                        value={currentPiecesPerBox}
                        onChange={(e) => handleInlineChange(product.id!, 'piecesPerBox', e.target.value)}
                        className="w-full h-8 px-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-xs font-mono font-bold text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    {/* Box Purchase Price */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                        سعر شراء العلبة
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.001"
                          placeholder="تلقائي"
                          inputMode="decimal"
                          autoComplete="one-time-code"
                          autoCorrect="off"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-protonpass-ignore="true"
                          data-form-type="other"
                          value={currentBoxPurchase}
                          onChange={(e) => handleInlineChange(product.id!, 'boxPurchasePrice', e.target.value)}
                          className="w-full h-8 px-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-xs font-mono font-bold text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <span className="text-[10px] text-zinc-400 shrink-0">{settings.currency}</span>
                      </div>
                    </div>

                    {/* Profit Margin Indicator */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 flex flex-col justify-between col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                        هامش الربح المحسوب
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-mono font-black text-zinc-900 dark:text-white">
                          {formatCurrency(profitPerPiece, settings.currency, language)}
                        </span>
                        <span className={cn(
                          "text-[10px] font-black px-1.5 py-0.5 rounded font-mono",
                          profitMarginPercent < 0 
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            : profitMarginPercent > 200
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        )}>
                          {profitMarginPercent}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Strip: Suggested One-Click Fixes & Verification & Manual Save */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 flex-wrap flex-1">
                      {/* Suggested Fixes (only when not verified) */}
                      {!audit.isVerified && suggestedFixes.map((fix) => (
                        <button
                          key={fix.id}
                          disabled={isSaving}
                          onClick={() => handleApplyFix(product, fix)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-sm text-right"
                          title={fix.description}
                        >
                          <Sparkles size={14} className="text-amber-500 shrink-0" />
                          <span>{fix.label}</span>
                        </button>
                      ))}

                      {/* Confirm & Dismiss Alert Button */}
                      {!audit.isVerified && audit.unfilteredHasIssues && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleVerifyProduct(product, true)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                          title="تأكيد أن الأسعار الحالية صحيحة ومقصودة وإزالة المنتج من قائمة التنبيهات"
                        >
                          <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>تأكيد صحة الأسعار (تجاهل التنبيه)</span>
                        </button>
                      )}

                      {/* Un-verify Button if already verified */}
                      {audit.isVerified && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleVerifyProduct(product, false)}
                          className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-all flex items-center gap-1.5"
                          title="إلغاء اعتماد الأسعار وإعادة تدقيق المنتج"
                        >
                          <RefreshCw size={13} />
                          <span>إلغاء الاعتماد وإعادة التدقيق</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 justify-end shrink-0">
                      {onOpenProductEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenProductEdit(product);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <Edit3 size={13} />
                          <span>تعديل شامل</span>
                        </button>
                      )}

                      {hasUnsavedChanges && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveInline(product)}
                          className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all active:scale-95 shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isSaving ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            <Save size={13} />
                          )}
                          <span>حفظ التعديل</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/90 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            <span>إجمالي المنتجات المدققة: </span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">{products.length}</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs hover:bg-zinc-800 dark:hover:bg-white transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};

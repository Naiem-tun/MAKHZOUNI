import React, { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Package,
  Sparkles,
  Search,
  Save,
  Edit3,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Product, OperationType } from '../../types';
import { useAppContext } from '../../AppContext';
import { auditAllProducts, SuggestedFix } from '../../lib/priceAuditor';
import { formatCurrency, roundMoney, handleFirestoreError } from '../../lib/utils';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/auditLogger';
import { useFolioTheme } from '../folio/FolioPageChrome';

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
  const { i18n } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
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
        (item.product.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.product.barcode?.includes(searchQuery) ||
        item.product.barcode2?.includes(searchQuery) ||
        (item.product.category || "").toLowerCase().includes(searchQuery.toLowerCase());

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

  const auditTabs: Array<{
    key: 'all_issues' | 'loss' | 'box_confusion' | 'mismatch' | 'verified' | 'all';
    label: string;
    count: number;
    color: string;
  }> = [
    { key: 'all_issues', label: 'تنبيهات نشطة', count: stats.totalWithIssues, color: theme.neutral },
    { key: 'loss', label: 'بيع بخسارة', count: stats.lossCount, color: theme.negative },
    { key: 'box_confusion', label: 'سعر العلبة', count: stats.boxConfusionCount, color: theme.accent },
    { key: 'mismatch', label: 'عدم تطابق', count: stats.mismatchCount, color: theme.accent },
    { key: 'verified', label: 'مؤكدة يدوياً', count: stats.verifiedCount, color: theme.positive },
    { key: 'all', label: 'جميع المنتجات', count: products.length, color: theme.text },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-hidden"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] border flex flex-col shadow-2xl overflow-hidden transition-colors"
        style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="px-4 py-3.5 sm:px-6 sm:py-4 border-b flex items-start justify-between gap-3 shrink-0"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold flex-wrap">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>01</span>
              <span style={{ color: theme.textMuted }}>التدقيق الذكي للأسعار وتصحيح التجزئة</span>
              <span
                className="px-1.5 py-0.5 border font-mono tabular-nums"
                style={{
                  borderColor: stats.totalWithIssues > 0 ? theme.negative : theme.positive,
                  color: stats.totalWithIssues > 0 ? theme.negative : theme.positive,
                  backgroundColor: theme.surfaceMuted,
                }}
              >
                {stats.totalWithIssues > 0
                  ? `${stats.totalWithIssues} منتج يحتاج مراجعة`
                  : 'جميع الأسعار مضبوطة 100%'}
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-black tracking-tight" style={{ color: theme.text }}>
              أداة التدقيق الذكي للأسعار وتصحيح التجزئة
            </h2>
            <p className="text-[11px] hidden sm:block" style={{ color: theme.textMuted }}>
              كشف فوري لأخطاء وضع سعر العلبة للقطعة الواحدة، البيع بخسارة، وعدم تطابق كرتونة الجملة والتجزئة.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 border cursor-pointer shrink-0"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick Statistics Strip */}
        <div
          className="grid grid-cols-3 sm:grid-cols-6 border-b divide-x divide-x-reverse shrink-0"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          {auditTabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="flex flex-col p-2.5 sm:p-3 text-right transition-colors cursor-pointer border-b-2"
                style={{
                  backgroundColor: active ? theme.surfaceMuted : theme.surface,
                  borderColor: theme.border,
                  borderBottomColor: active ? tab.color : 'transparent',
                }}
              >
                <span className="text-[10px] sm:text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
                  {tab.label}
                </span>
                <span className="text-base sm:text-lg font-black font-mono tabular-nums" style={{ color: tab.color }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div
          className="px-4 sm:px-6 py-2.5 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 border w-full sm:w-80"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
          >
            <Search size={14} style={{ color: theme.textMuted }} />
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
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: theme.text }}
            />
          </div>

          <div className="text-xs flex items-center gap-1.5 self-end sm:self-auto" style={{ color: theme.textMuted }}>
            <span>النتائج المعروضة:</span>
            <span className="font-black font-mono tabular-nums" style={{ color: theme.text }}>{filteredAudits.length}</span>
          </div>
        </div>

        {/* Content Body / Audited Products List */}
        <div className="min-h-0 overflow-y-auto p-3 sm:p-6 space-y-3">
          {filteredAudits.length === 0 ? (
            <div
              className="py-14 border text-center flex flex-col items-center justify-center space-y-2"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <CheckCircle2 size={28} style={{ color: theme.positive }} />
              <h3 className="text-sm sm:text-base font-black" style={{ color: theme.text }}>
                لا توجد منتجات ضمن هذا التصنيف
              </h3>
              <p className="text-xs max-w-sm" style={{ color: theme.textMuted }}>
                {activeTab === 'all_issues'
                  ? 'لا توجد أي أخطاء تسعير مسجلة في منتجاتك الحالية.'
                  : 'لا توجد منتجات تطابق شرط البحث أو الفلتر المحدد.'}
              </p>
            </div>
          ) : (
            filteredAudits.map((audit, idx) => {
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
                  className="p-3.5 sm:p-4 border transition-colors"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: audit.hasIssues ? theme.neutral : theme.border,
                    borderRight: audit.hasIssues ? `3px solid ${theme.negative}` : undefined,
                  }}
                >
                  {/* Top Bar */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b"
                    style={{ borderColor: theme.border }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-mono font-bold tabular-nums shrink-0" style={{ color: theme.accent }}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-base font-black leading-tight truncate" style={{ color: theme.text }}>
                          {product.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] flex-wrap mt-0.5" style={{ color: theme.textMuted }}>
                          <span>{product.category || 'بدون فئة'}</span>
                          {product.barcode && (
                            <span className="font-mono tabular-nums">· باركود: {product.barcode}</span>
                          )}
                          {piecesBox > 1 && (
                            <span className="font-bold font-mono tabular-nums" style={{ color: theme.accent }}>
                              · ({piecesBox} قطع/علبة)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      {audit.isVerified ? (
                        <span
                          className="px-2 py-0.5 border text-[10px] font-bold flex items-center gap-1"
                          style={{ borderColor: theme.positive, color: theme.positive, backgroundColor: theme.surfaceMuted }}
                        >
                          <CheckCircle2 size={11} />
                          <span>معتمد ومؤكد يدوياً</span>
                        </span>
                      ) : (
                        issues.map((iss, iIdx) => {
                          const issColor = iss.severity === 'error' ? theme.negative : iss.severity === 'warning' ? theme.neutral : theme.accent;
                          return (
                            <span
                              key={iIdx}
                              className="px-2 py-0.5 border text-[10px] font-bold flex items-center gap-1"
                              style={{ borderColor: issColor, color: issColor, backgroundColor: theme.surfaceMuted }}
                            >
                              <AlertTriangle size={11} />
                              <span>{iss.title}</span>
                            </span>
                          );
                        })
                      )}

                      {!audit.isVerified && issues.length === 0 && (
                        <span
                          className="px-2 py-0.5 border text-[10px] font-bold flex items-center gap-1"
                          style={{ borderColor: theme.positive, color: theme.positive, backgroundColor: theme.surfaceMuted }}
                        >
                          <Check size={11} />
                          <span>سليم ومطابق</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Issues Detailed Explanations */}
                  {!audit.isVerified && issues.length > 0 && (
                    <div
                      className="my-3 space-y-1.5 border p-3"
                      style={{ backgroundColor: theme.bg, borderColor: theme.border, borderRight: `3px solid ${theme.neutral}` }}
                    >
                      {issues.map((iss, iIdx) => (
                        <div key={iIdx} className="flex items-start gap-2 text-xs" style={{ color: theme.text }}>
                          <span className="font-black shrink-0" style={{ color: theme.neutral }}>·</span>
                          <p className="leading-relaxed">{iss.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pricing Inputs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 my-3 pt-1">
                    <div className="p-2.5 border" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                      <label className="text-[10px] font-bold block mb-1" style={{ color: theme.textMuted }}>
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
                          className="w-full h-8 px-2 border text-xs font-mono font-bold tabular-nums outline-none"
                          style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                        />
                        <span className="text-[10px] shrink-0" style={{ color: theme.textMuted }}>{settings.currency}</span>
                      </div>
                    </div>

                    <div className="p-2.5 border" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                      <label className="text-[10px] font-bold block mb-1" style={{ color: theme.textMuted }}>
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
                          className="w-full h-8 px-2 border text-xs font-mono font-bold tabular-nums outline-none"
                          style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                        />
                        <span className="text-[10px] shrink-0" style={{ color: theme.textMuted }}>{settings.currency}</span>
                      </div>
                    </div>

                    <div className="p-2.5 border" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                      <label className="text-[10px] font-bold block mb-1" style={{ color: theme.textMuted }}>
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
                        className="w-full h-8 px-2 border text-xs font-mono font-bold tabular-nums outline-none"
                        style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                      />
                    </div>

                    <div className="p-2.5 border" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                      <label className="text-[10px] font-bold block mb-1" style={{ color: theme.textMuted }}>
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
                          className="w-full h-8 px-2 border text-xs font-mono font-bold tabular-nums outline-none"
                          style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                        />
                        <span className="text-[10px] shrink-0" style={{ color: theme.textMuted }}>{settings.currency}</span>
                      </div>
                    </div>

                    <div
                      className="p-2.5 border flex flex-col justify-between col-span-2 sm:col-span-1"
                      style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                    >
                      <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>
                        هامش الربح المحسوب
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-mono font-black tabular-nums" style={{ color: theme.text }}>
                          {formatCurrency(profitPerPiece, settings.currency, language)}
                        </span>
                        <span
                          className="text-[10px] font-black px-1.5 py-0.5 border font-mono tabular-nums"
                          style={{
                            borderColor: profitMarginPercent < 0 ? theme.negative : profitMarginPercent > 200 ? theme.neutral : theme.positive,
                            color: profitMarginPercent < 0 ? theme.negative : profitMarginPercent > 200 ? theme.neutral : theme.positive,
                            backgroundColor: theme.surface,
                          }}
                        >
                          {profitMarginPercent}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Strip */}
                  <div
                    className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 border-t"
                    style={{ borderColor: theme.border }}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap flex-1">
                      {!audit.isVerified && suggestedFixes.map((fix) => (
                        <button
                          key={fix.id}
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleApplyFix(product, fix)}
                          className="px-3 py-1.5 border text-xs font-bold transition-colors flex items-center gap-1.5 text-right cursor-pointer"
                          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.neutral, color: theme.text }}
                          title={fix.description}
                        >
                          <Sparkles size={13} style={{ color: theme.neutral }} className="shrink-0" />
                          <span>{fix.label}</span>
                        </button>
                      ))}

                      {!audit.isVerified && audit.unfilteredHasIssues && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleVerifyProduct(product, true)}
                          className="px-3 py-1.5 border text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.positive, color: theme.positive }}
                          title="تأكيد أن الأسعار الحالية صحيحة ومقصودة وإزالة المنتج من قائمة التنبيهات"
                        >
                          <CheckCircle2 size={13} className="shrink-0" />
                          <span>تأكيد صحة الأسعار (تجاهل التنبيه)</span>
                        </button>
                      )}

                      {audit.isVerified && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleVerifyProduct(product, false)}
                          className="px-3 py-1.5 border text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
                          title="إلغاء اعتماد الأسعار وإعادة تدقيق المنتج"
                        >
                          <RefreshCw size={12} />
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
                          className="px-3 py-1.5 border text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
                        >
                          <Edit3 size={12} />
                          <span>تعديل شامل</span>
                        </button>
                      )}

                      {hasUnsavedChanges && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveInline(product)}
                          className="px-4 py-1.5 border text-xs font-black transition-opacity hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          style={{ backgroundColor: theme.accent, borderColor: theme.accent, color: theme.accentText }}
                        >
                          {isSaving ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <Save size={12} />
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
        <div
          className="px-4 sm:px-6 py-3.5 border-t flex items-center justify-between shrink-0"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="text-xs" style={{ color: theme.textMuted }}>
            <span>إجمالي المنتجات المدققة: </span>
            <span className="font-black font-mono tabular-nums" style={{ color: theme.text }}>{products.length}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border font-black text-xs cursor-pointer"
            style={{ backgroundColor: theme.text, borderColor: theme.text, color: theme.surface }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

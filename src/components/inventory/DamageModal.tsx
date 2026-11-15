import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, AlertTriangle, Search, CheckCircle2, ScanBarcode, 
  Trash2, History, PlusCircle, Calendar, DollarSign, 
  AlertCircle, Package, ArrowRight, Clock
} from 'lucide-react';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  getDoc, serverTimestamp, query, orderBy, onSnapshot 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../AppContext';
import { 
  handleFirestoreError, cleanQuantity, formatCurrency, 
  formatAppDate, safeParseDate, cn, roundMoney 
} from '../../lib/utils';
import { OperationType } from '../../types';
import { logAudit } from '../../lib/auditLogger';
import { useTranslation } from 'react-i18next';
import { BarcodeScanner } from '../common/BarcodeScanner';
import { CustomConfirmModal } from '../common/CustomConfirmModal';

import { useFolioTheme } from '../folio/FolioPageChrome';

interface DamageModalProps {
  show: boolean;
  onClose: () => void;
  products: any[];
}

export function DamageModal({ show, onClose, products }: DamageModalProps) {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
  
  // Tab state: 'record' (new damage) | 'logs' (view records)
  const [activeTab, setActiveTab] = useState<'record' | 'logs'>('record');

  // New damage record state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [damageQty, setDamageQty] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Damage logs state
  const [damageLogs, setDamageLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsFilter, setLogsFilter] = useState<'pending' | 'all'>('pending');

  // Deletion confirm state
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset or initialize state when modal opens
  useEffect(() => {
    if (show) {
      setSearchTerm('');
      setSelectedProduct(null);
      setDamageQty('');
      setNote('');
      setIsScannerOpen(false);
    }
  }, [show]);

  // Real-time listener for damage logs
  useEffect(() => {
    if (!show || !user) return;
    setLoadingLogs(true);
    const damageLogsPath = `users/${user.uid}/damage_logs`;
    const q = query(
      collection(db, damageLogsPath),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDamageLogs(logs);
      setLoadingLogs(false);
    }, (error) => {
      console.error("Error loading damage logs:", error);
      setLoadingLogs(false);
    });

    return () => unsubscribe();
  }, [show, user]);

  // Filtered products for selection
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const s = searchTerm.trim().toLowerCase();
    return products.filter(p => 
      (p.name || "").toLowerCase().includes(s) || 
      (p.barcode && p.barcode.toLowerCase().includes(s)) || 
      (p.barcode2 && p.barcode2.toLowerCase().includes(s))
    ).slice(0, 6);
  }, [searchTerm, products]);

  // Handle Barcode Scan from camera
  const handleBarcodeScanned = (code: string) => {
    setIsScannerOpen(false);
    if (!code) return;
    const cleanCode = code.trim();
    const matched = products.find(p => 
      (p.barcode && p.barcode.trim() === cleanCode) || 
      (p.barcode2 && p.barcode2.trim() === cleanCode)
    );

    if (matched) {
      setSelectedProduct(matched);
      setSearchTerm('');
      showToast(`تم تحديد الصنف: ${matched.name}`, 'success');
    } else {
      setSearchTerm(cleanCode);
      showToast('لم يتم العثور على منتج بهذا الباركود', 'error');
    }
  };

  // Handle typing / external laser scanner Enter key
  const handleKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cleanTerm = searchTerm.trim();
      if (!cleanTerm) return;

      const exactMatch = products.find(p => 
        (p.barcode && p.barcode.trim() === cleanTerm) || 
        (p.barcode2 && p.barcode2.trim() === cleanTerm) ||
        (p.name && p.name.trim().toLowerCase() === cleanTerm.toLowerCase())
      );

      if (exactMatch) {
        setSelectedProduct(exactMatch);
        setSearchTerm('');
        showToast(`تم تحديد: ${exactMatch.name}`, 'success');
      } else if (filteredProducts.length === 1) {
        setSelectedProduct(filteredProducts[0]);
        setSearchTerm('');
      }
    }
  };

  // Submit new damage
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProduct) return;
    
    const qty = cleanQuantity(Number(damageQty));
    if (qty <= 0) {
      showToast(t('invalid_quantity') || 'الرجاء إدخال كمية صالحة أكبر من صفر', 'error');
      return;
    }

    if (qty > (selectedProduct.quantity || 0)) {
      showToast(t('quantity_exceeds_stock') || 'الكمية المدخلة تتجاوز الرصيد الحالي المتوفر', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const productRef = doc(db, `users/${user.uid}/products`, selectedProduct.id);
      const newQty = cleanQuantity((selectedProduct.quantity || 0) - qty);
      
      const cost = Number(selectedProduct.purchasePrice || selectedProduct.costPrice || 0);
      const lossAmount = roundMoney(cost * qty);

      // 1. Update Product Stock (both main quantity and POS quantity)
      await updateDoc(productRef, {
        quantity: newQty,
        posQuantity: newQty,
        updatedAt: serverTimestamp()
      });

      // 2. Save in damage_logs
      const damageLogsPath = `users/${user.uid}/damage_logs`;
      await addDoc(collection(db, damageLogsPath), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        barcode: selectedProduct.barcode || selectedProduct.barcode2 || '',
        quantity: qty,
        unitCost: cost,
        totalLoss: lossAmount,
        date: serverTimestamp(),
        audited: false,
        reason: note.trim() || '',
      });

      // 3. Log Audit / Movement
      logAudit(
        'update',
        'product',
        selectedProduct.id,
        `تسجيل تالف: ${selectedProduct.name}`,
        `تم خصم ${qty} ككمية تالفة. الرصيد السابق: ${selectedProduct.quantity || 0}، الرصيد الجديد: ${newQty}.${note.trim() ? ` السبب: ${note.trim()}` : ''} بقيمة خسارة: ${lossAmount}`
      );

      showToast(t('damage_registered_successfully') || 'تم تسجيل التالف وخصم المخزون بنجاح', 'success');
      
      // Reset form and switch to logs tab so the user can immediately view what was recorded!
      setSelectedProduct(null);
      setDamageQty('');
      setNote('');
      setSearchTerm('');
      setActiveTab('logs');
    } catch (error) {
      console.error("Error registering damage:", error);
      handleFirestoreError(error, OperationType.WRITE, 'products/damage');
      showToast(t('error_saving_changes') || 'حدث خطأ أثناء حفظ التالف', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel / Delete a damage entry and restore stock
  const handleConfirmDelete = async () => {
    if (!user || !itemToDelete) return;
    setIsDeleting(true);

    try {
      const productRef = doc(db, `users/${user.uid}/products`, itemToDelete.productId);
      const productSnap = await getDoc(productRef);

      if (productSnap.exists()) {
        const pData = productSnap.data();
        const currentQty = cleanQuantity(pData.quantity || 0);
        const restoredQty = cleanQuantity(currentQty + Number(itemToDelete.quantity || 0));
        const currentPosQty = cleanQuantity(pData.posQuantity || 0);
        const restoredPosQty = cleanQuantity(currentPosQty + Number(itemToDelete.quantity || 0));

        await updateDoc(productRef, {
          quantity: restoredQty,
          posQuantity: restoredPosQty,
          updatedAt: serverTimestamp()
        });
      }

      // Delete from damage_logs
      await deleteDoc(doc(db, `users/${user.uid}/damage_logs`, itemToDelete.id));

      // Audit log
      logAudit(
        'delete',
        'product',
        itemToDelete.productId,
        `إلغاء تالف: ${itemToDelete.productName || itemToDelete.name || 'منتج'}`,
        `تم إلغاء تسجيل التالف واسترجاع كمية (${itemToDelete.quantity}) إلى رصيد المنتج.`
      );

      showToast('تم إلغاء التالف واسترجاع الكمية إلى المخزون بنجاح', 'success');
      setItemToDelete(null);
    } catch (err) {
      console.error("Error deleting damage log:", err);
      showToast('حدث خطأ أثناء إلغاء التالف', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter logs based on selection
  const displayedLogs = useMemo(() => {
    if (logsFilter === 'pending') {
      return damageLogs.filter(log => !log.audited);
    }
    return damageLogs;
  }, [damageLogs, logsFilter]);

  // Statistics for the displayed logs
  const pendingLogsCount = useMemo(() => {
    return damageLogs.filter(log => !log.audited).length;
  }, [damageLogs]);

  const totalLossDisplayed = useMemo(() => {
    return roundMoney(displayedLogs.reduce((acc, log) => acc + (log.totalLoss || 0), 0));
  }, [displayedLogs]);

  const totalPiecesDisplayed = useMemo(() => {
    return cleanQuantity(displayedLogs.reduce((acc, log) => acc + (log.quantity || 0), 0));
  }, [displayedLogs]);

  if (!show) return null;

  return (
    <>
      <AnimatePresence>
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
          dir="rtl"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col border shadow-2xl"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
          >
            {/* Header */}
            <div
              className="p-4 border-b sticky top-0 z-20 shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 border shrink-0"
                    style={{
                      color: theme.negative,
                      borderColor: `${theme.negative}50`,
                      backgroundColor: `${theme.negative}10`
                    }}
                  >
                    01
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-black truncate" style={{ color: theme.text }}>
                      نظام إدارة التالف والمفقودات
                    </h2>
                    <p className="text-[11px] truncate" style={{ color: theme.textMuted }}>
                      خصم الكميات التالفة وتوثيق الخسائر قبل إغلاق الجرد
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 border transition-colors cursor-pointer shrink-0"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div
                className="grid grid-cols-2 border p-1 text-xs font-bold gap-1"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('record')}
                  className="py-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  style={
                    activeTab === 'record'
                      ? { backgroundColor: theme.negative, color: '#FFFFFF' }
                      : { backgroundColor: 'transparent', color: theme.textMuted }
                  }
                >
                  <PlusCircle size={15} />
                  <span>تسجيل تالف جديد</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className="py-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  style={
                    activeTab === 'logs'
                      ? { backgroundColor: theme.negative, color: '#FFFFFF' }
                      : { backgroundColor: 'transparent', color: theme.textMuted }
                  }
                >
                  <History size={15} />
                  <span>سجل التالف</span>
                  {pendingLogsCount > 0 && (
                    <span
                      className="px-1.5 py-0.5 text-[10px] font-mono font-black tabular-nums border"
                      style={
                        activeTab === 'logs'
                          ? { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.35)', color: '#FFFFFF' }
                          : { backgroundColor: theme.negative, borderColor: theme.negative, color: '#FFFFFF' }
                      }
                    >
                      {pendingLogsCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 min-h-0 overflow-y-auto space-y-4">
              {activeTab === 'record' ? (
                /* TAB 1: RECORD NEW DAMAGE */
                <div className="space-y-4">
                  {!selectedProduct ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: theme.text }}>
                          ابحث عن المنتج التالف بالاسم أو امسح الباركود
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="اكتب الاسم أو الباركود أو امسح بالكاميرا..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDownSearch}
                            className="w-full h-11 pr-10 pl-24 border outline-none text-sm font-medium transition-colors"
                            style={{
                              backgroundColor: theme.surface,
                              borderColor: theme.border,
                              color: theme.text
                            }}
                            autoFocus
                          />
                          <Search className="absolute right-3" size={17} style={{ color: theme.textMuted }} />

                          {/* Scanner Button inside input */}
                          <div className="absolute left-1.5 flex items-center gap-1">
                            {searchTerm && (
                              <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="p-1.5 transition-colors cursor-pointer"
                                style={{ color: theme.textMuted }}
                                title="مسح النص"
                              >
                                <X size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsScannerOpen(true)}
                              className="flex items-center gap-1 px-2.5 py-1.5 border font-bold text-xs cursor-pointer transition-colors"
                              style={{
                                backgroundColor: `${theme.negative}14`,
                                borderColor: `${theme.negative}45`,
                                color: theme.negative
                              }}
                              title="مسح الباركود بالكاميرا"
                            >
                              <ScanBarcode size={15} />
                              <span className="hidden sm:inline">مسح</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick tip */}
                      <div
                        className="flex items-center gap-2 p-2.5 border text-xs"
                        style={{
                          backgroundColor: `${theme.neutral}12`,
                          borderColor: `${theme.neutral}45`,
                          color: theme.text
                        }}
                      >
                        <AlertCircle size={15} className="shrink-0" style={{ color: theme.neutral }} />
                        <span>يمكنك استخدام كاميرا الهاتف بمسح الباركود مباشرة، أو الكتابة والضغط على Enter.</span>
                      </div>

                      {/* Filtered suggestions list */}
                      {filteredProducts.length > 0 && (
                        <div
                          className="space-y-1.5 border p-2"
                          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                        >
                          <div className="text-[11px] font-bold px-2 py-0.5" style={{ color: theme.textMuted }}>
                            المنتجات المطابقة ({filteredProducts.length}):
                          </div>
                          {filteredProducts.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedProduct(p);
                                setSearchTerm('');
                              }}
                              className="w-full text-right p-3 border transition-colors flex items-center justify-between cursor-pointer"
                              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                            >
                              <div className="min-w-0 flex-1 pl-2">
                                <div className="font-bold text-sm truncate" style={{ color: theme.text }}>
                                  {p.name}
                                </div>
                                <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: theme.textMuted }}>
                                  <span>
                                    الرصيد:{' '}
                                    <strong className="font-mono tabular-nums" style={{ color: theme.text }}>
                                      {p.quantity || 0}
                                    </strong>
                                  </span>
                                  {p.barcode && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono tabular-nums text-[11px]">{p.barcode}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div
                                className="text-xs font-bold px-2.5 py-1 border shrink-0"
                                style={{
                                  backgroundColor: `${theme.negative}14`,
                                  borderColor: `${theme.negative}45`,
                                  color: theme.negative
                                }}
                              >
                                اختيار
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchTerm && filteredProducts.length === 0 && (
                        <div
                          className="text-center py-8 text-sm border border-dashed"
                          style={{ borderColor: theme.border, color: theme.textMuted }}
                        >
                          لا توجد منتجات مطابقة لـ "{searchTerm}"
                        </div>
                      )}
                    </div>
                  ) : (
                    /* PRODUCT SELECTED FORM */
                    <form id="damage-form" onSubmit={handleSubmit} className="space-y-4">
                      {/* Product Overview Card */}
                      <div
                        className="flex items-start justify-between p-3.5 border"
                        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>
                            المنتج المحدد
                          </div>
                          <div className="font-black text-sm sm:text-base truncate" style={{ color: theme.text }}>
                            {selectedProduct.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs pt-1" style={{ color: theme.textMuted }}>
                            <span
                              className="px-2 py-0.5 border"
                              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                            >
                              الرصيد المتوفر:{' '}
                              <strong className="font-mono tabular-nums font-bold" style={{ color: theme.text }}>
                                {selectedProduct.quantity || 0}
                              </strong>
                            </span>
                            <span
                              className="px-2 py-0.5 border"
                              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                            >
                              سعر التكلفة:{' '}
                              <strong className="font-mono tabular-nums font-bold" style={{ color: theme.negative }}>
                                {formatCurrency(selectedProduct.purchasePrice || selectedProduct.costPrice || 0, settings.currency, settings.language)}
                              </strong>
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(null)}
                          className="text-xs font-bold px-2.5 py-1.5 border transition-colors cursor-pointer shrink-0"
                          style={{
                            backgroundColor: `${theme.accent}12`,
                            borderColor: `${theme.accent}45`,
                            color: theme.accent
                          }}
                        >
                          تغيير الصنف
                        </button>
                      </div>

                      {/* Quantity Input */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-xs font-bold" style={{ color: theme.text }}>
                            الكمية التالفة المخصومة <span style={{ color: theme.negative }}>*</span>
                          </label>
                          <span className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                            الحد الأقصى: {selectedProduct.quantity || 0}
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            required
                            min="0.01"
                            max={selectedProduct.quantity || 0}
                            value={damageQty}
                            onChange={(e) => setDamageQty(e.target.value)}
                            className="w-full h-11 px-4 border outline-none text-base font-mono font-black tabular-nums transition-colors"
                            style={{
                              backgroundColor: theme.surface,
                              borderColor: theme.border,
                              color: theme.text
                            }}
                            placeholder="مثال: 1"
                            autoFocus
                          />
                        </div>

                        {/* Calculated Loss Notice */}
                        {damageQty && Number(damageQty) > 0 && (
                          <div
                            className="mt-2 p-3 border flex items-center justify-between text-xs font-bold"
                            style={{
                              backgroundColor: `${theme.negative}10`,
                              borderColor: `${theme.negative}45`
                            }}
                          >
                            <span style={{ color: theme.negative }}>
                              إجمالي الخسارة المالية:
                            </span>
                            <span className="text-sm font-mono font-black tabular-nums" style={{ color: theme.negative }} dir="ltr">
                              {formatCurrency(
                                roundMoney((selectedProduct.purchasePrice || selectedProduct.costPrice || 0) * Number(damageQty)),
                                settings.currency,
                                settings.language
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Notes / Reason */}
                      <div>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: theme.text }}>
                          سبب التلف أو الملاحظات (اختياري)
                        </label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="w-full p-3 border outline-none text-sm transition-colors resize-none min-h-[75px]"
                          style={{
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                            color: theme.text
                          }}
                          placeholder="مثلاً: كسر أثناء النقل، انتهاء صلاحية، عيب مصنعي..."
                        />
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                /* TAB 2: DAMAGE LOGS (VIEW REGISTERED DAMAGES) */
                <div className="space-y-4">
                  {/* Filter Bar */}
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="flex items-center border p-1 text-xs font-bold gap-1"
                      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                    >
                      <button
                        type="button"
                        onClick={() => setLogsFilter('pending')}
                        className="px-3 py-1.5 transition-colors cursor-pointer"
                        style={
                          logsFilter === 'pending'
                            ? { backgroundColor: theme.surface, color: theme.negative, fontWeight: 900 }
                            : { backgroundColor: 'transparent', color: theme.textMuted }
                        }
                      >
                        المعلق بالجرد الحالي ({pendingLogsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogsFilter('all')}
                        className="px-3 py-1.5 transition-colors cursor-pointer"
                        style={
                          logsFilter === 'all'
                            ? { backgroundColor: theme.surface, color: theme.negative, fontWeight: 900 }
                            : { backgroundColor: 'transparent', color: theme.textMuted }
                        }
                      >
                        جميع السجلات ({damageLogs.length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('record')}
                      className="text-xs font-bold hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                      style={{ color: theme.negative }}
                    >
                      <PlusCircle size={14} />
                      <span>إضافة تالف</span>
                    </button>
                  </div>

                  {/* Summary Metric Strip */}
                  <div
                    className="grid grid-cols-2 border divide-x divide-x-reverse"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="p-3" style={{ borderColor: theme.border }}>
                      <div className="text-[10px] font-bold" style={{ color: theme.negative }}>إجمالي خسائر التالف</div>
                      <div className="text-base sm:text-lg font-mono font-black tabular-nums mt-0.5" style={{ color: theme.negative }}>
                        {formatCurrency(totalLossDisplayed, settings.currency, settings.language)}
                      </div>
                    </div>
                    <div className="p-3" style={{ borderColor: theme.border }}>
                      <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>إجمالي القطع التالفة</div>
                      <div className="text-base sm:text-lg font-mono font-black tabular-nums mt-0.5" style={{ color: theme.text }}>
                        {totalPiecesDisplayed}{' '}
                        <span className="text-xs font-sans font-normal" style={{ color: theme.textMuted }}>
                          قطعة ({displayedLogs.length} عملية)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Damage Logs List */}
                  {loadingLogs ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2">
                      <div
                        className="w-7 h-7 border-2 border-t-transparent animate-spin rounded-full"
                        style={{ borderColor: `${theme.negative} transparent ${theme.negative} ${theme.negative}` }}
                      />
                      <span className="text-xs font-bold" style={{ color: theme.textMuted }}>جاري تحميل سجلات التالف...</span>
                    </div>
                  ) : displayedLogs.length === 0 ? (
                    <div
                      className="py-12 text-center border border-dashed p-6"
                      style={{ borderColor: theme.border, backgroundColor: theme.surface }}
                    >
                      <div
                        className="w-12 h-12 border flex items-center justify-center mx-auto mb-2"
                        style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
                      >
                        <CheckCircle2 size={22} />
                      </div>
                      <div className="text-sm font-bold" style={{ color: theme.text }}>
                        {logsFilter === 'pending' ? 'لا توجد تسجيلات تالف معلقة حالياً' : 'سجل التالف فارغ'}
                      </div>
                      <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: theme.textMuted }}>
                        {logsFilter === 'pending'
                          ? 'أي تالف تسجله سيظهر هنا بانتظار إغلاق الجرد القادم، ويمكنك إلغاؤه واسترجاع رصيده في أي وقت.'
                          : 'لم يتم تسجيل أي منتجات تالفة بعد.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('record')}
                        className="mt-4 px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        style={{ backgroundColor: theme.negative, color: '#FFFFFF' }}
                      >
                        <PlusCircle size={15} />
                        <span>تسجيل منتج تالف الآن</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {displayedLogs.map((item) => {
                        const itemDate = safeParseDate(item.date);
                        return (
                          <div
                            key={item.id}
                            className="p-3.5 border space-y-2 transition-colors"
                            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-sm" style={{ color: theme.text }}>
                                    {item.productName}
                                  </span>
                                  {item.audited ? (
                                    <span
                                      className="text-[10px] font-bold px-2 py-0.5 border"
                                      style={{
                                        backgroundColor: `${theme.positive}14`,
                                        borderColor: `${theme.positive}45`,
                                        color: theme.positive
                                      }}
                                    >
                                      مُدرج في جرد سابق {item.auditedAt ? `(${formatAppDate(safeParseDate(item.auditedAt), settings.language, t, { day: 'numeric', month: 'short' })})` : ''}
                                    </span>
                                  ) : (
                                    <span
                                      className="text-[10px] font-bold px-2 py-0.5 border"
                                      style={{
                                        backgroundColor: `${theme.neutral}14`,
                                        borderColor: `${theme.neutral}45`,
                                        color: theme.neutral
                                      }}
                                    >
                                      معلق للجرد القادم
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] mt-1" style={{ color: theme.textMuted }}>
                                  <Clock size={12} />
                                  <span className="font-mono tabular-nums">
                                    {formatAppDate(itemDate, settings.language, t, { day: 'numeric', month: 'short', year: 'numeric' })}
                                    {' '}
                                    {itemDate.toLocaleTimeString(settings.language === 'ar' ? 'ar-TN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {item.barcode && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono tabular-nums text-[10px]">{item.barcode}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Delete button (only for unaudited damage) */}
                              {!item.audited && (
                                <button
                                  type="button"
                                  onClick={() => setItemToDelete(item)}
                                  className="p-2 border transition-colors shrink-0 cursor-pointer"
                                  style={{
                                    backgroundColor: `${theme.negative}10`,
                                    borderColor: `${theme.negative}35`,
                                    color: theme.negative
                                  }}
                                  title="إلغاء التالف واسترجاع الكمية للمخزون"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>

                            {/* Details Grid */}
                            <div
                              className="grid grid-cols-3 gap-2 p-2.5 border text-xs"
                              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                            >
                              <div>
                                <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>الكمية التالفة</div>
                                <div className="font-mono font-black tabular-nums" style={{ color: theme.negative }}>
                                  {item.quantity}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>تكلفة الوحدة</div>
                                <div className="font-mono font-bold tabular-nums" style={{ color: theme.text }}>
                                  {formatCurrency(item.unitCost || 0, settings.currency, settings.language)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>إجمالي الخسارة</div>
                                <div className="font-mono font-black tabular-nums" style={{ color: theme.negative }}>
                                  {formatCurrency(item.totalLoss || 0, settings.currency, settings.language)}
                                </div>
                              </div>
                            </div>

                            {/* Reason note if any */}
                            {item.reason && (
                              <div
                                className="text-xs px-2.5 py-1.5 border"
                                style={{
                                  backgroundColor: theme.surfaceMuted,
                                  borderColor: theme.border,
                                  color: theme.textMuted
                                }}
                              >
                                <span className="font-bold" style={{ color: theme.text }}>السبب: </span>
                                {item.reason}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="p-4 border-t flex items-center justify-between gap-3 shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              {activeTab === 'record' ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 h-11 border text-xs font-bold transition-colors cursor-pointer"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text
                    }}
                  >
                    إلغاء
                  </button>
                  <button
                    form="damage-form"
                    type="submit"
                    disabled={!selectedProduct || !damageQty || isSubmitting}
                    className="flex-1 h-11 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    style={{ backgroundColor: theme.negative, color: '#FFFFFF' }}
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>تأكيد الخصم وتسجيل التالف</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full h-11 border font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text
                  }}
                >
                  إغلاق النافذة
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="مسح باركود المنتج التالف"
      />

      {/* Confirm deletion / stock restoration modal */}
      <CustomConfirmModal
        show={!!itemToDelete}
        message={
          itemToDelete 
            ? `هل أنت متأكد من إلغاء تسجيل هذا التالف؟\nسيتم إعادة كمية (${itemToDelete.quantity}) إلى رصيد المنتج (${itemToDelete.productName}) في المخزن فوراً.`
            : ''
        }
        type="confirm"
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </>
  );
}

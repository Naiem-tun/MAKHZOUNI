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

interface DamageModalProps {
  show: boolean;
  onClose: () => void;
  products: any[];
}

export function DamageModal({ show, onClose, products }: DamageModalProps) {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  
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

      showToast(t('damage_registered_successfully') || 'تم تسجيل التالف وخصم المخزون بنجاح ✅', 'success');
      
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
        `إلغاء تالف: ${itemToDelete.productName}`,
        `تم إلغاء تسجيل التالف واسترجاع كمية (${itemToDelete.quantity}) إلى رصيد المنتج.`
      );

      showToast('تم إلغاء التالف واسترجاع الكمية إلى المخزون بنجاح ✅', 'success');
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border border-zinc-100 dark:border-zinc-800"
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 text-[#B34C36]">
                  <div className="w-10 h-10 rounded-xl bg-[#B34C36]/10 flex items-center justify-center text-[#B34C36]">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100">
                      نظام إدارة التالف والمفقودات
                    </h2>
                    <p className="text-xs text-zinc-500">
                      خصم الكميات التالفة وتوثيق الخسائر قبل إغلاق الجرد
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl bg-zinc-100 dark:bg-zinc-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl text-xs font-bold gap-1">
                <button
                  onClick={() => setActiveTab('record')}
                  className={cn(
                    "flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all",
                    activeTab === 'record'
                      ? "bg-white dark:bg-zinc-900 text-[#B34C36] shadow-sm font-black"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  )}
                >
                  <PlusCircle size={15} />
                  <span>تسجيل تالف جديد</span>
                </button>

                <button
                  onClick={() => setActiveTab('logs')}
                  className={cn(
                    "flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all",
                    activeTab === 'logs'
                      ? "bg-white dark:bg-zinc-900 text-[#B34C36] shadow-sm font-black"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  )}
                >
                  <History size={15} />
                  <span>سجل التالف</span>
                  {pendingLogsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#B34C36] text-white">
                      {pendingLogsCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {activeTab === 'record' ? (
                /* TAB 1: RECORD NEW DAMAGE */
                <div className="space-y-4">
                  {!selectedProduct ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                          ابحث عن المنتج التالف بالاسم أو امسح الباركود
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="اكتب الاسم أو الباركود أو امسح بالكاميرا..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDownSearch}
                            className="w-full h-12 pr-10 pl-24 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-2 focus:ring-[#B34C36]/30 focus:border-[#B34C36] outline-none text-sm font-medium transition-all"
                            autoFocus
                          />
                          <Search className="absolute right-3.5 text-zinc-400" size={18} />

                          {/* Scanner Button inside input */}
                          <div className="absolute left-2 flex items-center gap-1">
                            {searchTerm && (
                              <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
                                title="مسح النص"
                              >
                                <X size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsScannerOpen(true)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#B34C36]/10 hover:bg-[#B34C36]/20 text-[#B34C36] rounded-lg transition-colors font-bold text-xs"
                              title="مسح الباركود بالكاميرا"
                            >
                              <ScanBarcode size={16} />
                              <span className="hidden sm:inline">مسح</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick tip */}
                      <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>يمكنك استخدام كاميرا الهاتف بمسح الباركود مباشرة، أو الكتابة والضغط على Enter.</span>
                      </div>

                      {/* Filtered suggestions list */}
                      {filteredProducts.length > 0 && (
                        <div className="space-y-1.5 border border-zinc-100 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50/70 dark:bg-zinc-800/40">
                          <div className="text-[11px] font-bold text-zinc-400 px-2 py-0.5">
                            المنتجات المطابقة ({filteredProducts.length}):
                          </div>
                          {filteredProducts.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setSelectedProduct(p);
                                setSearchTerm('');
                              }}
                              className="w-full text-right p-3 rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all flex items-center justify-between border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 shadow-sm group"
                            >
                              <div className="min-w-0 flex-1 pl-2">
                                <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:text-[#B34C36] transition-colors">
                                  {p.name}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                                  <span>الرصيد: <strong className="text-zinc-700 dark:text-zinc-300">{p.quantity || 0}</strong></span>
                                  {p.barcode && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono text-[11px]">{p.barcode}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs font-bold text-[#B34C36] bg-[#B34C36]/10 px-2.5 py-1 rounded-lg shrink-0">
                                اختيار
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchTerm && filteredProducts.length === 0 && (
                        <div className="text-center py-8 text-sm text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                          لا توجد منتجات مطابقة لـ "{searchTerm}"
                        </div>
                      )}
                    </div>
                  ) : (
                    /* PRODUCT SELECTED FORM */
                    <form id="damage-form" onSubmit={handleSubmit} className="space-y-4">
                      {/* Product Overview Card */}
                      <div className="flex items-start justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">المنتج المحدد</div>
                          <div className="font-black text-sm sm:text-base text-zinc-900 dark:text-white">
                            {selectedProduct.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400 pt-1">
                            <span className="bg-zinc-200/60 dark:bg-zinc-700/60 px-2 py-0.5 rounded-md">
                              الرصيد المتوفر: <strong className="text-zinc-900 dark:text-white font-bold">{selectedProduct.quantity || 0}</strong>
                            </span>
                            <span className="bg-zinc-200/60 dark:bg-zinc-700/60 px-2 py-0.5 rounded-md">
                              سعر التكلفة: <strong className="text-[#B34C36] font-bold">{formatCurrency(selectedProduct.purchasePrice || selectedProduct.costPrice || 0, settings.currency, settings.language)}</strong>
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(null)}
                          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-200 dark:border-blue-900/50"
                        >
                          تغيير الصنف
                        </button>
                      </div>

                      {/* Quantity Input */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            الكمية التالفة المخصومة <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[11px] text-zinc-400">
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
                            className="w-full h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[#B34C36]/30 focus:border-[#B34C36] outline-none text-base font-black transition-all"
                            placeholder="مثال: 1"
                            autoFocus
                          />
                        </div>

                        {/* Calculated Loss Notice */}
                        {damageQty && Number(damageQty) > 0 && (
                          <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-xl flex items-center justify-between text-xs font-bold">
                            <span className="text-red-700 dark:text-red-300">
                              إجمالي الخسارة المالية:
                            </span>
                            <span className="text-red-600 dark:text-red-400 text-sm font-black" dir="ltr">
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
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                          سبب التلف أو الملاحظات (اختياري)
                        </label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[#B34C36]/30 focus:border-[#B34C36] outline-none text-sm transition-all resize-none min-h-[75px]"
                          placeholder="مثلاً: كسر أثناء النقل، انتهاء صلاحية، عيب مصنعي..."
                        />
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                /* TAB 2: DAMAGE LOGS (VIEW REGISTERED DAMAGES) */
                <div className="space-y-4">
                  {/* Filter Pills */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-bold">
                      <button
                        onClick={() => setLogsFilter('pending')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all",
                          logsFilter === 'pending'
                            ? "bg-white dark:bg-zinc-900 text-[#B34C36] shadow-sm font-black"
                            : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        )}
                      >
                        المعلق بالجرد الحالي ({pendingLogsCount})
                      </button>
                      <button
                        onClick={() => setLogsFilter('all')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all",
                          logsFilter === 'all'
                            ? "bg-white dark:bg-zinc-900 text-[#B34C36] shadow-sm font-black"
                            : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        )}
                      >
                        جميع السجلات ({damageLogs.length})
                      </button>
                    </div>

                    <button
                      onClick={() => setActiveTab('record')}
                      className="text-xs font-bold text-[#B34C36] hover:underline flex items-center gap-1 shrink-0"
                    >
                      <PlusCircle size={14} />
                      <span>إضافة تالف</span>
                    </button>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-red-50/70 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl">
                      <div className="text-[10px] font-bold text-red-600 dark:text-red-400">إجمالي خسائر التالف</div>
                      <div className="text-base sm:text-lg font-black text-red-700 dark:text-red-300 mt-0.5">
                        {formatCurrency(totalLossDisplayed, settings.currency, settings.language)}
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/50 rounded-xl">
                      <div className="text-[10px] font-bold text-zinc-500">إجمالي القطع التالفة</div>
                      <div className="text-base sm:text-lg font-black text-zinc-900 dark:text-white mt-0.5">
                        {totalPiecesDisplayed} <span className="text-xs font-normal text-zinc-400">قطعة ({displayedLogs.length} عملية)</span>
                      </div>
                    </div>
                  </div>

                  {/* Damage Logs List */}
                  {loadingLogs ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2">
                      <div className="w-7 h-7 border-2 border-[#B34C36] border-t-transparent animate-spin rounded-full" />
                      <span className="text-xs text-zinc-400 font-bold">جاري تحميل سجلات التالف...</span>
                    </div>
                  ) : displayedLogs.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                      <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-2">
                        <CheckCircle2 size={24} />
                      </div>
                      <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        {logsFilter === 'pending' ? 'لا توجد تسجيلات تالف معلقة حالياً' : 'سجل التالف فارغ'}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                        {logsFilter === 'pending'
                          ? 'أي تالف تسجله سيظهر هنا بانتظار إغلاق الجرد القادم، ويمكنك إلغاؤه واسترجاع رصيده في أي وقت.'
                          : 'لم يتم تسجيل أي منتجات تالفة بعد.'}
                      </p>
                      <button
                        onClick={() => setActiveTab('record')}
                        className="mt-4 px-4 py-2 bg-[#B34C36] text-white text-xs font-bold rounded-xl shadow hover:brightness-110 transition-all inline-flex items-center gap-1.5"
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
                            className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/70 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-sm text-zinc-900 dark:text-white">
                                    {item.productName}
                                  </span>
                                  {item.audited ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-md">
                                      مُدرج في جرد سابق {item.auditedAt ? `(${formatAppDate(safeParseDate(item.auditedAt), settings.language, t, { day: 'numeric', month: 'short' })})` : ''}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded-md">
                                      معلق للجرد القادم
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
                                  <Clock size={12} />
                                  <span>
                                    {formatAppDate(itemDate, settings.language, t, { day: 'numeric', month: 'short', year: 'numeric' })}
                                    {' '}
                                    {itemDate.toLocaleTimeString(settings.language === 'ar' ? 'ar-TN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {item.barcode && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono text-[10px]">{item.barcode}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Delete button (only for unaudited damage) */}
                              {!item.audited && (
                                <button
                                  type="button"
                                  onClick={() => setItemToDelete(item)}
                                  className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors shrink-0"
                                  title="إلغاء التالف واسترجاع الكمية للمخزون"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-3 gap-2 p-2 bg-white dark:bg-zinc-900 rounded-lg text-xs border border-zinc-100 dark:border-zinc-800">
                              <div>
                                <div className="text-[10px] text-zinc-400 font-bold">الكمية التالفة</div>
                                <div className="font-black text-red-600 dark:text-red-400">{item.quantity}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-zinc-400 font-bold">تكلفة الوحدة</div>
                                <div className="font-bold text-zinc-700 dark:text-zinc-300">
                                  {formatCurrency(item.unitCost || 0, settings.currency, settings.language)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-zinc-400 font-bold">إجمالي الخسارة</div>
                                <div className="font-black text-[#B34C36]">
                                  {formatCurrency(item.totalLoss || 0, settings.currency, settings.language)}
                                </div>
                              </div>
                            </div>

                            {/* Reason note if any */}
                            {item.reason && (
                              <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100/70 dark:bg-zinc-800/80 px-2.5 py-1.5 rounded-lg">
                                <span className="font-bold text-zinc-500">السبب: </span>
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
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-3">
              {activeTab === 'record' ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 h-11 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-xl text-xs font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    form="damage-form"
                    type="submit"
                    disabled={!selectedProduct || !damageQty || isSubmitting}
                    className="flex-1 h-11 flex items-center justify-center gap-2 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                    style={{ backgroundColor: '#B34C36', boxShadow: '0 8px 16px -4px rgba(179, 76, 54, 0.25)' }}
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
                  className="w-full h-11 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors"
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

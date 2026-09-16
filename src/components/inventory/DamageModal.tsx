import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Search, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../AppContext';
import { handleFirestoreError, cleanQuantity, formatCurrency } from '../../lib/utils';
import { OperationType } from '../../types';
import { logAudit } from '../../lib/auditLogger';
import { useTranslation } from 'react-i18next';

interface DamageModalProps {
  show: boolean;
  onClose: () => void;
  products: any[];
}

export function DamageModal({ show, onClose, products }: DamageModalProps) {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [damageQty, setDamageQty] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (show) {
      setSearchTerm('');
      setSelectedProduct(null);
      setDamageQty('');
      setNote('');
    }
  }, [show]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    const s = searchTerm.toLowerCase();
    return products.filter(p => 
      (p.name || "").toLowerCase().includes(s) || 
      p.barcode?.includes(s) || 
      p.barcode2?.includes(s)
    ).slice(0, 5); // show top 5
  }, [searchTerm, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProduct) return;
    
    const qty = cleanQuantity(Number(damageQty));
    if (qty <= 0) {
      showToast(t('invalid_quantity') || 'كمية غير صالحة', 'error');
      return;
    }

    if (qty > (selectedProduct.quantity || 0)) {
      showToast(t('quantity_exceeds_stock') || 'الكمية تتجاوز الرصيد الحالي', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const productRef = doc(db, `users/${user.uid}/products`, selectedProduct.id);
      const newQty = cleanQuantity((selectedProduct.quantity || 0) - qty);
      
      const cost = Number(selectedProduct.purchasePrice || selectedProduct.costPrice || 0);
      const lossAmount = cost * qty;

      // 1. Update Product Quantity
      await updateDoc(productRef, {
        quantity: newQty,
        posQuantity: newQty, // keeping pos in sync if they use it
        updatedAt: serverTimestamp()
      });

      // 2. Add to Damage Logs instead of Expenses
      if (lossAmount > 0) {
        const damageLogsPath = `users/${user.uid}/damage_logs`;
        await addDoc(collection(db, damageLogsPath), {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity: qty,
          unitCost: cost,
          totalLoss: lossAmount,
          date: serverTimestamp(),
          audited: false,
          reason: note || '',
        });
      }

      // 3. Log Audit / Movement
      logAudit(
        'update',
        'product',
        selectedProduct.id,
        `تسجيل تالف: ${selectedProduct.name}`,
        `تم خصم ${qty} ككمية تالفة. الرصيد السابق: ${selectedProduct.quantity || 0}، الرصيد الحالي: ${newQty}.${note ? ` السبب: ${note}` : ''} بقيمة خسارة: ${lossAmount}`
      );

      showToast(t('damage_registered_successfully') || 'تم تسجيل التالف بنجاح ✅', 'success');
      onClose();
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, OperationType.WRITE, 'products/damage');
      showToast(t('error_saving_changes') || 'حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b dark:border-zinc-800">
            <div className="flex items-center gap-2 text-[#B34C36]">
              <AlertTriangle size={24} />
              <h2 className="text-lg font-bold">تسجيل منتج تالف</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-xl bg-zinc-50 dark:bg-zinc-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto">
            {!selectedProduct ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    ابحث عن المنتج التالف
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="الاسم أو الباركود..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-12 pl-4 pr-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-black dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                      autoFocus
                    />
                    <Search className="absolute right-3 top-3.5 text-zinc-400" size={18} />
                  </div>
                </div>

                {filteredProducts.length > 0 && (
                  <div className="space-y-2 border border-zinc-100 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-800/50">
                    {filteredProducts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProduct(p)}
                        className="w-full text-right p-3 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors flex items-center justify-between border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 shadow-sm"
                      >
                        <div>
                          <div className="font-bold text-sm text-black dark:text-white">{p.name}</div>
                          <div className="text-xs text-zinc-500">الرصيد الحالي: {p.quantity || 0}</div>
                        </div>
                        <div className="text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded-md">
                          اختيار
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchTerm && filteredProducts.length === 0 && (
                  <div className="text-center py-8 text-sm text-zinc-500">
                    لم يتم العثور على منتجات مطابقة.
                  </div>
                )}
              </div>
            ) : (
              <form id="damage-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-start justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div>
                    <div className="text-xs text-zinc-500 mb-0.5">المنتج المحدد</div>
                    <div className="font-bold text-black dark:text-white">{selectedProduct.name}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                      سعر التكلفة: <span className="font-semibold text-brand-600">{formatCurrency(selectedProduct.purchasePrice || selectedProduct.costPrice || 0, settings.currency, settings.language)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    تغيير
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    الكمية التالفة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.01"
                    max={selectedProduct.quantity || 0}
                    value={damageQty}
                    onChange={(e) => setDamageQty(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all font-bold"
                    placeholder="مثال: 2"
                  />
                  <div className="text-xs text-zinc-500 mt-1.5 flex justify-between">
                    <span>الرصيد المتوفر: {selectedProduct.quantity || 0}</span>
                    {damageQty && Number(damageQty) > 0 && (
                      <span className="text-red-600 dark:text-red-400 font-bold">
                        إجمالي الخسارة: {formatCurrency((selectedProduct.purchasePrice || selectedProduct.costPrice || 0) * Number(damageQty), settings.currency, settings.language)}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    السبب أو الملاحظات (اختياري)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all resize-none min-h-[80px]"
                    placeholder="سبب التلف، كسر، انتهاء صلاحية..."
                  />
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <button
              form="damage-form"
              type="submit"
              disabled={!selectedProduct || !damageQty || isSubmitting}
              className="w-full h-12 flex items-center justify-center gap-2 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
              style={{ backgroundColor: '#B34C36', boxShadow: '0 10px 15px -3px rgba(179, 76, 54, 0.2)' }}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  <span>تأكيد الخصم وتسجيل التالف</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

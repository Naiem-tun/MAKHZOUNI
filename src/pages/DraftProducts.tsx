import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, writeBatch, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { Product } from '../types';
import { syncTracker } from '../lib/syncTracker';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Trash2, Save, BookOpen, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { CustomConfirmModal } from '../components/common/CustomConfirmModal';
import { useFolioTheme } from '../components/folio/FolioPageChrome';

export default function DraftProducts() {
  const { user, settings, activeSupplier, setActiveSupplier, showToast } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

  const [draftProducts, setDraftProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [editingDraft, setEditingDraft] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, `users/${user.uid}/draft_products`);

    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
      setDraftProducts(items);
      setLoading(false);
    });
  }, [user]);

  const filteredProducts = draftProducts.filter(
    (p) =>
      (p.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm)),
  );

  const confirmDelete = async () => {
    if (!user || !productToDelete) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/draft_products/${productToDelete}`));
      showToast('تم حذف المسودة بنجاح', 'success');
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء الحذف', 'error');
    } finally {
      setProductToDelete(null);
    }
  };

  const handleSaveToMain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingDraft || !editingDraft.id) return;

    const pPrice = Number(editingDraft.purchasePrice) || 0;
    const sPrice = Number(editingDraft.sellingPrice) || 0;

    if (sPrice <= pPrice) {
      showToast(
        `شرط التحقق: يجب أن يكون سعر البيع (${sPrice}) أكبر دائمًا من سعر الشراء (${pPrice})`,
        'error',
      );
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(db);

      const draftRef = doc(db, `users/${user.uid}/draft_products/${editingDraft.id}`);
      const mainRef = doc(collection(db, `users/${user.uid}/products`));

      const { id, isDraft, ...productData } = editingDraft;

      batch.set(mainRef, {
        ...productData,
        updatedAt: new Date().toISOString(),
      });
      batch.delete(draftRef);

      if (productData.quantity && productData.quantity > 0) {
        const purchaseAmount = Number((productData.quantity * (productData.purchasePrice || 0)).toFixed(3));
        const purchaseRef = doc(collection(db, `users/${user.uid}/purchases`));
        batch.set(purchaseRef, {
          productId: mainRef.id,
          productName: productData.name,
          qtyAdded: productData.quantity,
          amount: purchaseAmount,
          supplierId: activeSupplier?.id || null,
          supplierName: activeSupplier?.name || null,
          date: Timestamp.now(),
        });

        if (activeSupplier) {
          setActiveSupplier((prev) =>
            prev ? { ...prev, sessionTotal: (prev.sessionTotal || 0) + purchaseAmount } : null,
          );
        }
      }

      syncTracker.track(batch.commit()).catch((err) => console.error('Sync deferred or failed:', err));

      showToast('تم حفظ ونقل المنتج للمخزون الرئيسي', 'success');
      setEditingDraft(null);
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="-mx-2.5 sm:mx-0 max-w-7xl mx-auto space-y-4 pb-24 pt-1" style={{ color: theme.text }}>
      {/* Editorial Header */}
      <header className="pb-4 border-b space-y-1" style={{ borderColor: theme.border }}>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
            01
          </span>
          <span style={{ color: theme.textMuted }}>
            المسودة · قائمة النقل
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          قائمة المنتجات المنقولة (المسودة)
        </h1>
        <p className="text-xs sm:text-sm font-mono tabular-nums" style={{ color: theme.textMuted }}>
          يوجد {draftProducts.length} منتج بانتظار تحديد أسعارها وإضافتها للمخزون الرئيسي.
        </p>
      </header>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute right-3.5 top-1/2 -translate-y-1/2"
          size={17}
          style={{ color: theme.textMuted }}
        />
        <input
          type="search"
          name="draft_search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-form-type="other"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ابحث بالاسم أو الباركود..."
          className="w-full h-11 pl-4 pr-10 border text-sm outline-none"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.text,
          }}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs font-bold" style={{ color: theme.textMuted }}>
          جاري التحميل...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div
          className="text-center py-16 px-4 border"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <CheckCircle2 size={36} className="mx-auto mb-3 opacity-35" style={{ color: theme.positive }} />
          <h3 className="text-base font-black mb-1">المسودة فارغة</h3>
          <p className="text-xs" style={{ color: theme.textMuted }}>
            لا توجد منتجات معلقة. يمكنك استيراد المزيد من المنتجات من الإعدادات.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              key={product.id}
              className="border px-2.5 sm:px-3.5 py-3 flex flex-col justify-between gap-4"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="space-y-1.5">
                <h3 className="font-semibold text-sm sm:text-base line-clamp-1">{product.name}</h3>
                <div className="text-[11px] font-mono" style={{ color: theme.textMuted }}>
                  <span>{product.category || 'عام'}</span>
                  <span className="mx-1.5">·</span>
                  <span>باركود: {product.barcode || '-'}</span>
                  {product.piecesPerBox && product.piecesPerBox > 1 && (
                    <>
                      <span className="mx-1.5">·</span>
                      <span style={{ color: theme.accent }}>{product.piecesPerBox} بالكرتونة</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: theme.border }}>
                <button
                  type="button"
                  onClick={() => setEditingDraft({ ...product })}
                  className="flex-1 h-10 border font-bold flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.accent,
                  }}
                >
                  <BookOpen size={15} />
                  <span>تحديد الأسعار والنقل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductToDelete(product.id!)}
                  className="w-10 h-10 text-white flex shrink-0 items-center justify-center cursor-pointer"
                  style={{ backgroundColor: theme.negative }}
                  title="حذف"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit/Pricing Modal */}
      <AnimatePresence>
        {editingDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setEditingDraft(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-lg border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <div
                className="p-4 border-b flex items-start justify-between gap-2"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
              >
                <div>
                  <h2 className="text-base font-black">إعداد منتج جديد</h2>
                  <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                    {editingDraft.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDraft(null)}
                  className="p-1.5 border cursor-pointer"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto hidden-scrollbar">
                <form
                  id="draft-form"
                  onSubmit={handleSaveToMain}
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-protonpass-ignore="true"
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold" style={{ color: theme.textMuted }}>
                      اسم المنتج
                    </label>
                    <input
                      type="text"
                      name="draft_product_name"
                      autoComplete="one-time-code"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-protonpass-ignore="true"
                      data-form-type="other"
                      required
                      value={editingDraft.name}
                      onChange={(e) => setEditingDraft({ ...editingDraft, name: e.target.value })}
                      className="w-full border h-11 px-3.5 outline-none font-bold text-sm"
                      style={{
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold" style={{ color: theme.textMuted }}>
                        سعر الشراء
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        inputMode="decimal"
                        autoComplete="one-time-code"
                        autoCorrect="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-protonpass-ignore="true"
                        data-form-type="other"
                        value={editingDraft.purchasePrice || ''}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            purchasePrice: parseFloat(e.target.value.replace(',', '.')) || 0,
                          })
                        }
                        className="w-full border h-11 px-3.5 outline-none text-left font-mono font-bold text-sm"
                        style={{
                          backgroundColor: theme.bg,
                          borderColor: theme.border,
                          color: theme.text,
                        }}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold" style={{ color: theme.textMuted }}>
                        سعر البيع
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        inputMode="decimal"
                        autoComplete="one-time-code"
                        autoCorrect="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-protonpass-ignore="true"
                        data-form-type="other"
                        value={editingDraft.sellingPrice || ''}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            sellingPrice: parseFloat(e.target.value.replace(',', '.')) || 0,
                          })
                        }
                        className="w-full border h-11 px-3.5 outline-none text-left font-mono font-bold text-sm"
                        style={{
                          backgroundColor: theme.bg,
                          borderColor: theme.border,
                          color: theme.accent,
                        }}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold" style={{ color: theme.textMuted }}>
                      الكمية الحالية المتوفرة (اختياري)
                    </label>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      autoComplete="one-time-code"
                      autoCorrect="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-protonpass-ignore="true"
                      data-form-type="other"
                      value={editingDraft.quantity || ''}
                      onChange={(e) =>
                        setEditingDraft({
                          ...editingDraft,
                          quantity: parseFloat(e.target.value.replace(',', '.')) || 0,
                        })
                      }
                      className="w-full border h-11 px-3.5 outline-none font-mono font-bold text-sm"
                      style={{
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                    />
                  </div>

                  {editingDraft.piecesPerBox && editingDraft.piecesPerBox > 1 && (
                    <div
                      className="p-3.5 border flex items-start gap-2.5 text-xs"
                      style={{
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                    >
                      <AlertCircle className="shrink-0 mt-0.5" size={16} style={{ color: theme.accent }} />
                      <div>
                        <p className="font-bold">
                          هذا المنتج يحتوي على {editingDraft.piecesPerBox} قطعة في الكرتونة.
                        </p>
                        <p className="mt-0.5" style={{ color: theme.textMuted }}>
                          يرجى التأكد من أن أسعار الشراء والبيع تخص القطعة الواحدة وليس الكرتونة.
                        </p>
                      </div>
                    </div>
                  )}
                </form>
              </div>

              <div
                className="p-4 border-t flex gap-2.5"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
              >
                <button
                  type="button"
                  onClick={() => setEditingDraft(null)}
                  className="flex-1 py-2.5 border text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  إلغاء
                </button>
                <button
                  form="draft-form"
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] py-2.5 text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: theme.accent }}
                >
                  {isSaving ? (
                    <span>جاري الحفظ...</span>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>حفظ ونقل للمخزون</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CustomConfirmModal
        show={!!productToDelete}
        message="هل أنت متأكد من حذف هذا المنتج من المسودة؟"
        type="confirm"
        onConfirm={confirmDelete}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
}

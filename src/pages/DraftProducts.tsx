import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, writeBatch, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { Product } from '../types';
import { syncTracker } from '../lib/syncTracker';
import { motion, AnimatePresence } from 'motion/react';
import { Search, PackagePlus, Trash2, ArrowRight, Save, Receipt, Calculator, Store, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CustomConfirmModal } from '../components/common/CustomConfirmModal';

export default function DraftProducts() {
  const { user, settings, activeSupplier, setActiveSupplier } = useAppContext();
  const { t } = useTranslation();
  
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
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setDraftProducts(items);
      setLoading(false);
    });
  }, [user]);

  const filteredProducts = draftProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const confirmDelete = async () => {
    if (!user || !productToDelete) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/draft_products/${productToDelete}`));
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحذف');
    } finally {
      setProductToDelete(null);
    }
  };

  const handleSaveToMain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingDraft || !editingDraft.id) return;
    
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      const draftRef = doc(db, `users/${user.uid}/draft_products/${editingDraft.id}`);
      const mainRef = doc(collection(db, `users/${user.uid}/products`)); // new ID
      
      const { id, isDraft, ...productData } = editingDraft;
      
      batch.set(mainRef, {
        ...productData,
        updatedAt: new Date().toISOString()
      });
      batch.delete(draftRef);
      
      // Record purchase transaction if there is initial quantity
      if (productData.quantity && productData.quantity > 0) {
        const purchaseAmount = productData.quantity * (productData.purchasePrice || 0);
        const purchaseRef = doc(collection(db, `users/${user.uid}/purchases`));
        batch.set(purchaseRef, {
          productId: mainRef.id,
          productName: productData.name,
          qtyAdded: productData.quantity,
          amount: purchaseAmount,
          supplierId: activeSupplier?.id || null,
          supplierName: activeSupplier?.name || null,
          date: serverTimestamp(),
        });

        if (activeSupplier) {
          setActiveSupplier(prev => prev ? { ...prev, sessionTotal: (prev.sessionTotal || 0) + purchaseAmount } : null);
        }
      }

      // Fire and forget offline sync
      syncTracker.track(batch.commit()).catch(err => console.error("Sync deferred or failed:", err));
      
      setEditingDraft(null);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <header>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
          <PackagePlus className="text-brand-600" />
          قائمة المنتجات المنقولة (المسودة)
        </h1>
        <p className="text-zinc-500 mt-2">
          يوجد {draftProducts.length} منتج بانتظار تحديد أسعارها وإضافتها للمخزون الرئيسي.
        </p>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
        <input 
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ابحث بالاسم أو الباركود..."
          className="w-full h-14 pl-4 pr-12 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-500">جاري التحميل...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 px-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl">
          <div className="mx-auto w-20 h-20 bg-brand-50 dark:bg-brand-900/20 rounded-full flex items-center justify-center text-brand-500 mb-4">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">المسودة فارغة</h3>
          <p className="text-zinc-500 mt-2">لا توجد منتجات معلقة. يمكنك استيراد المزيد من المنتجات من الإعدادات.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(product => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={product.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-brand-300 dark:hover:border-brand-800 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white line-clamp-1">{product.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{product.category} • باركود: {product.barcode || '-'}</p>
                </div>
                {product.piecesPerBox && product.piecesPerBox > 1 && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full whitespace-nowrap">
                    {product.piecesPerBox} بالكرتونة
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-6">
                <button
                  onClick={() => setEditingDraft({ ...product })}
                  className="flex-1 h-11 bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:hover:bg-brand-900/40 dark:text-brand-400 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  <BookOpen size={18} />
                  تحديد الأسعار والنقل
                </button>
                <button
                  onClick={() => setProductToDelete(product.id!)}
                  className="w-11 h-11 text-white rounded-xl flex shrink-0 items-center justify-center transition-colors hover:brightness-110"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  <Trash2 size={18} />
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditingDraft(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#121A2F] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-brand-50/50 dark:bg-brand-900/10">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">إعداد منتج جديد</h2>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">{editingDraft.name}</p>
              </div>

              <div className="p-6 overflow-y-auto hidden-scrollbar">
                <form id="draft-form" onSubmit={handleSaveToMain} className="space-y-6">
                  {/* Prices */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">سعر الشراء</label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        value={editingDraft.purchasePrice || ''}
                        onChange={e => setEditingDraft({ ...editingDraft, purchasePrice: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl h-12 px-4 focus:border-brand-500 outline-none text-left cursor-text"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">سعر البيع</label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        value={editingDraft.sellingPrice || ''}
                        onChange={e => setEditingDraft({ ...editingDraft, sellingPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl h-12 px-4 focus:border-brand-500 outline-none text-left cursor-text text-brand-600 dark:text-brand-400 font-bold"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">الكمية الحالية المتوفرة (اختياري)</label>
                    <input
                      type="number"
                      step="1"
                      value={editingDraft.quantity || ''}
                      onChange={e => setEditingDraft({ ...editingDraft, quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl h-12 px-4 outline-none focus:border-brand-500"
                    />
                  </div>

                  {editingDraft.piecesPerBox && editingDraft.piecesPerBox > 1 && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-start gap-3">
                      <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                      <div className="text-sm text-amber-800 dark:text-amber-300">
                        <p className="font-bold">هذا المنتج يحتوي على {editingDraft.piecesPerBox} قطعة في الكرتونة.</p>
                        <p className="mt-1">يرجى التأكد من أن أسعار الشراء والبيع تخص القطعة الواحدة وليس الكرتونة.</p>
                      </div>
                    </div>
                  )}

                </form>
              </div>

              <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#1A233A] flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingDraft(null)}
                  className="flex-1 py-3 rounded-xl font-bold bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                >
                  إلغاء
                </button>
                <button
                  form="draft-form"
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] py-3 rounded-xl font-bold bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'جاري الحفظ...' : (
                    <>
                      <Save size={20} />
                      حفظ ونقل للمخزون
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

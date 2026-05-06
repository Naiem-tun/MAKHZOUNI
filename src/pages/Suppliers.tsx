import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Supplier } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, Plus, Phone, Trash2, Edit2, X, RotateCcw, UserPlus } from 'lucide-react';

export default function Suppliers() {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, `users/${user.uid}/suppliers`);
    return onSnapshot(q, (snap) => {
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });
  }, [user]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      typeOfGoods: formData.get('typeOfGoods') as string,
      transactionCount: editingSupplier ? editingSupplier.transactionCount : 0,
      updatedAt: serverTimestamp(),
    };

    if (editingSupplier) {
      await updateDoc(doc(db, `users/${user.uid}/suppliers`, editingSupplier.id!), data);
    } else {
      await addDoc(collection(db, `users/${user.uid}/suppliers`), data);
    }
    setIsModalOpen(false);
  };

  useEffect(() => {
    const handler = () => {
      setEditingSupplier(null);
      setIsModalOpen(true);
    };
    window.addEventListener('open-supplier-modal', handler);
    return () => window.removeEventListener('open-supplier-modal', handler);
  }, []);

  return (
    <div className="space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">مدونة الموردين</h1>
          <p className="text-zinc-500 dark:text-zinc-400">سجل الإنفاق اليدوي والموردين</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingSupplier(null); setIsModalOpen(true); }} className="flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-500/20">
            <UserPlus size={20} />
            إضافة مورد
          </button>
          <button className="p-3 rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800"><RotateCcw size={20}/></button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {suppliers.map((s) => (
          <motion.div key={s.id} className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 h-18">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 dark:bg-brand-950/20 shrink-0">
                <Truck size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">{s.name}</h3>
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 shrink-0">{s.typeOfGoods}</span>
                </div>
                <p className="text-xs text-zinc-500">{s.transactionCount || 0} عمليات</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a href={`tel:${s.phone}`} className="p-2 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100"><Phone size={16}/></a>
              <button onClick={() => { setEditingSupplier(s); setIsModalOpen(true); }} className="p-2 rounded-lg bg-zinc-50 text-zinc-600 hover:bg-zinc-100"><Edit2 size={16}/></button>
              <button onClick={() => deleteDoc(doc(db, `users/${user!.uid}/suppliers`, s.id!))} className="p-2 rounded-lg text-zinc-300 hover:text-rose-500"><Trash2 size={16}/></button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md rounded-3xl bg-white p-8 dark:bg-zinc-900">
              <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">إضافة مورد جديد</h2>
              <form onSubmit={handleSave} className="space-y-4 text-right">
                <input name="name" placeholder="اسم المورد" defaultValue={editingSupplier?.name} required className="w-full rounded-2xl border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800" />
                <input name="phone" placeholder="رقم الهاتف" defaultValue={editingSupplier?.phone} required className="w-full rounded-2xl border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800" />
                <input name="typeOfGoods" placeholder="نوع السلعة" defaultValue={editingSupplier?.typeOfGoods} className="w-full rounded-2xl border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800" />
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-2xl bg-zinc-100 py-3 font-semibold text-zinc-600">إلغاء</button>
                  <button type="submit" className="flex-1 rounded-2xl bg-brand-600 py-3 font-semibold text-white">حفظ</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

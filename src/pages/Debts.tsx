import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Debt } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, UserPlus, Trash2, Eye, Plus, Minus, X, CheckCircle2, History } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

export default function Debts() {
  const { t } = useTranslation();
  const { user, settings } = useAppContext();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeDebt, setActiveDebt] = useState<Debt | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, `users/${user.uid}/debts`);
    return onSnapshot(q, (snap) => {
      setDebts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt)));
    });
  }, [user]);

  const handleAddDebt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      customerName: formData.get('customerName') as string,
      totalAmount: parseFloat(formData.get('amount') as string),
      status: 'unpaid' as const,
      payments: [],
      updatedAt: serverTimestamp(),
    };
    await addDoc(collection(db, `users/${user.uid}/debts`), data);
    setIsModalOpen(false);
  };

  const addPayment = async (debt: Debt, amount: number) => {
    if (!user) return;
    const newTotal = debt.totalAmount - amount;
    const newStatus = newTotal <= 0 ? 'paid' : 'unpaid';
    const newPayments = [...(debt.payments || []), { amount, date: new Date().toISOString() }];
    
    await updateDoc(doc(db, `users/${user.uid}/debts`, debt.id!), {
      totalAmount: newTotal,
      status: newStatus,
      payments: newPayments,
      updatedAt: serverTimestamp(),
    });
  };

  useEffect(() => {
    const handler = () => setIsModalOpen(true);
    window.addEventListener('open-debt-modal', handler);
    return () => window.removeEventListener('open-debt-modal', handler);
  }, []);

  return (
    <div className="space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">دفتر الديون</h1>
          <p className="text-zinc-500 dark:text-zinc-400">إدارة الكريدي والديون</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-500/20">
          <UserPlus size={20} />
          إضافة شخص
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {debts.map((d) => (
          <motion.div key={d.id} className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 h-18">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 shrink-0">
                <BookOpen size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">{d.customerName}</h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`h-1.5 w-1.5 rounded-full ${d.status === 'paid' ? 'bg-brand-500' : 'bg-rose-500'}`} />
                  <span className={d.status === 'paid' ? 'text-brand-600' : 'text-rose-600'}>
                    {d.status === 'paid' ? t('paid') : t('over_due')}
                  </span>
                  <span className="text-zinc-300">•</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{formatCurrency(d.totalAmount, settings.currency, settings.language)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {d.status === 'unpaid' && (
                  <button 
                    onClick={() => {
                      const amount = parseFloat(prompt('أدخل المبلغ المدفوع:') || '0');
                      if (amount > 0) addPayment(d, amount);
                    }}
                    className="p-2 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100"
                  >
                    <Plus size={16}/>
                  </button>
              )}
              <button onClick={() => setActiveDebt(d)} className="p-2 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100">
                <Eye size={16}/>
              </button>
              <button onClick={() => deleteDoc(doc(db, `users/${user!.uid}/debts`, d.id!))} className="p-2 rounded-lg text-zinc-300 hover:text-rose-500">
                <Trash2 size={16}/>
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md rounded-3xl bg-white p-8 dark:bg-zinc-900 text-right">
              <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">إضافة دين جديد</h2>
              <form onSubmit={handleAddDebt} className="space-y-4">
                <input name="customerName" placeholder="اسم العميل" required className="w-full rounded-2xl border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800" />
                <input name="amount" type="number" step="0.001" placeholder="إجمالي المبلغ" required className="w-full rounded-2xl border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800" />
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-2xl bg-zinc-100 py-3 font-semibold text-zinc-600">إلغاء</button>
                  <button type="submit" className="flex-1 rounded-2xl bg-brand-600 py-3 font-semibold text-white">إضافة</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Debt details modal */}
      <AnimatePresence>
        {activeDebt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveDebt(null)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="relative w-full max-w-xl rounded-3xl bg-white p-8 dark:bg-zinc-900 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <button onClick={() => setActiveDebt(null)}><X size={24} className="text-zinc-500" /></button>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">سجل دفعات {activeDebt.customerName}</h2>
              </div>
              <div className="space-y-4">
                {(activeDebt.payments || []).length === 0 ? (
                  <p className="text-center text-zinc-500 py-8">لا توجد دفعات مسجلة بعد</p>
                ) : (
                  activeDebt.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                          <CheckCircle2 size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-brand-600">+{formatCurrency(p.amount, settings.currency, settings.language)}</p>
                          <p className="text-xs text-zinc-500">{new Date(p.date).toLocaleString()}</p>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400">دفعة رقم {i+1}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

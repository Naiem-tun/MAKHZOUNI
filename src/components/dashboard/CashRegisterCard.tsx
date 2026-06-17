import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../AppContext';
import { CashTransaction, OperationType } from '../../types';
import { handleFirestoreError, formatCurrency, formatAppDate } from '../../lib/utils';
import { Coins, Plus, Minus, FileText, Trash2, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../UI';
import { CustomConfirmModal } from '../common/CustomConfirmModal';

export function CashRegisterCard() {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  const [modalConfig, setModalConfig] = useState<{
    show: boolean;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({ show: false, message: '', type: 'alert' });

  const showConfirm = (message: string, onConfirm: () => void) => {
    setModalConfig({ show: true, message, type: 'confirm', onConfirm });
  };

  useEffect(() => {
    if (!user) return;

    const txPath = `users/${user.uid}/cash_transactions`;
    const txQuery = query(collection(db, txPath), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(txQuery, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashTransaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, txPath);
    });

    return () => unsubscribe();
  }, [user]);

  const balance = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      if (tx.type === 'in' || tx.type === 'sale') return acc + (Number(tx.amount) || 0);
      return acc - (Number(tx.amount) || 0);
    }, 0);
  }, [transactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || Number(amount) <= 0) return;

    setLoading(true);
    try {
      await addDoc(collection(db, `users/${user.uid}/cash_transactions`), {
        type: transactionType,
        amount: Number(amount),
        description: description || (transactionType === 'in' ? 'مقبوضات أخرى' : 'مصاريف أخرى'),
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setAmount('');
      setDescription('');
      showToast('تم حفظ العملية النقديّة بنجاح', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'cash_transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    showConfirm('هل أنت متأكد من حذف هذه العملية النقدية؟', async () => {
      try {
        await deleteDoc(doc(db, `users/${user!.uid}/cash_transactions`, id));
        showToast('تم حذف العملية بنجاح', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `cash_transactions/${id}`);
      }
    });
  };

  return (
    <>
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 rounded-lg flex items-center justify-center">
              <Wallet size={18} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">الصندوق والإيرادات</h2>
              <p className="text-sm text-zinc-500">حركة الأموال في الكاسة</p>
            </div>
          </div>
          <p className="text-2xl font-black text-brand-600 dark:text-brand-400">
            {formatCurrency(balance, settings.currency, settings.language)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button 
            onClick={() => { setTransactionType('in'); setIsModalOpen(true); }}
            className="flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-lg bg-[#4A6FA5] text-sm font-bold text-white transition-all hover:bg-[#4A6FA5]/90 shadow-lg shadow-[#4A6FA5]/20 active:scale-95 whitespace-nowrap"
          >
            <Plus size={18} strokeWidth={3} />
            تسجيل مقبوضات
          </button>
          <button 
            onClick={() => { setTransactionType('out'); setIsModalOpen(true); }}
            className="flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-white transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 whitespace-nowrap border border-zinc-200 dark:border-zinc-700"
          >
            <Minus size={18} strokeWidth={3} />
            سحب / مصاريف
          </button>
        </div>

        <div className="flex items-center justify-between mt-4 mb-3">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">أحدث العمليات</h3>
          <button 
             onClick={() => setShowTransactions(!showTransactions)}
             className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline transition-colors dark:text-brand-400"
          >
             {showTransactions ? 'إخفاء العمليات' : 'عرض العمليات'}
          </button>
        </div>

        {showTransactions && (
          <>
            {transactions.length > 0 ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                {transactions.slice(0, 5).map((tx) => (
                   <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                     <div className="flex items-center gap-3">
                       <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                         tx.type === 'in' || tx.type === 'sale' ? 'bg-emerald-100 text-emerald-600' : 'bg-[#B34C36]/10 text-[#B34C36]'
                       }`}>
                         {tx.type === 'in' || tx.type === 'sale' ? <Plus size={16} /> : <Minus size={16} />}
                       </div>
                       <div>
                         <p className="font-bold text-sm text-zinc-900 dark:text-white">{tx.description}</p>
                         <p className="text-xs text-zinc-500">
                           {tx.date ? formatAppDate(new Date(tx.date), settings.language, t) : ''}
                         </p>
                       </div>
                     </div>
                     <div className="flex items-center gap-3">
                       <span className={`font-bold ${tx.type === 'in' || tx.type === 'sale' ? 'text-emerald-600' : 'text-[#B34C36]'}`}>
                         {tx.type === 'in' || tx.type === 'sale' ? '+' : '-'}{formatCurrency(tx.amount, settings.currency, settings.language)}
                       </span>
                       {tx.type === 'in' || tx.type === 'out' ? (
                         <button onClick={() => tx.id && handleDelete(tx.id)} className="text-zinc-400 hover:text-red-500 transition-colors">
                           <Trash2 size={16} />
                         </button>
                       ) : <div className="w-4"></div>}
                     </div>
                   </div>
                ))}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-center py-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                 <p className="text-sm text-zinc-500 gap-2 flex items-center justify-center">
                   <FileText size={16} />
                   لا توجد حركات في الصندوق
                 </p>
              </motion.div>
            )}
          </>
        )}
      </Card>

      {/* Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm rounded-2xl border border-zinc-100 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-xl font-bold dark:text-white">
                {transactionType === 'in' ? 'تسجيل مقبوضات (إيداع)' : 'تسجيل سحب (مصاريف)'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">المبلغ</label>
                    <input 
                      type="number" step="0.001" min="0" required
                      value={amount} onChange={e => setAmount(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                      placeholder="0.000"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">الوصف (اختياري)</label>
                    <input 
                      type="text"
                      value={description} onChange={e => setDescription(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                      placeholder={transactionType === 'in' ? 'مثال: مبيعات آخر اليوم' : 'مثال: مصاريف نقل'}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                    إلغاء
                  </button>
                  <button type="submit" disabled={loading} className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:opacity-90">
                    حفظ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CustomConfirmModal 
        show={modalConfig.show}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig({ ...modalConfig, show: false })}
      />
    </>
  );
}

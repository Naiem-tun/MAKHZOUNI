import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, doc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Expense } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Plus, Trash2, X, ReceiptText, Calendar, Tag, CheckCheck, Clock } from 'lucide-react';
import { formatCurrency, cn, safeParseDate, formatAppDate } from '../lib/utils';
import { useModalBackButton } from '../hooks/useModalBackButton';

export default function Expenses() {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'audited' | 'all'>('pending');

  useModalBackButton(isModalOpen, () => setIsModalOpen(false));

  useEffect(() => {
    if (!user) return;
    const expensesPath = `users/${user.uid}/expenses`;
    const q = query(
      collection(db, expensesPath),
      orderBy('date', 'desc')
    );
    
    return onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
      setLoading(false);
    });
  }, [user]);

  const handleAddExpense = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string);
    const description = (formData.get('description') as string).trim() || t('expense');
    const category = formData.get('category') as string;

    if (isNaN(amount) || amount <= 0) return;

    // UI Feedback
    showToast(t('expense_added_success'));
    setIsModalOpen(false);

    try {
      addDoc(collection(db, `users/${user.uid}/expenses`), {
        description,
        amount,
        category,
        date: serverTimestamp(),
        audited: false
      }).catch(err => {
        console.error("Async expense add failed:", err);
      });
    } catch (err) {
      console.error("Failed to add expense:", err);
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !exp.audited;
    if (filter === 'audited') return exp.audited;
    return true;
  });

  const totalThisMonth = expenses.reduce((acc, curr) => {
    if (curr.audited) return acc;
    const expenseDate = safeParseDate(curr.date);
    const now = new Date();
    if (expenseDate && expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear()) {
      return acc + curr.amount;
    }
    return acc;
  }, 0);

  return (
    <div className="space-y-5 pb-24" dir="rtl">
      <header className="flex items-center justify-between px-1">
        <div className="text-right">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('expenses')}</h1>
          <p className="text-zinc-400 text-[11px] font-bold">{t('store_budget')}</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-black text-white shadow-lg shadow-[#B34C36]/20 active:scale-95 transition-transform"
          style={{ backgroundColor: '#B34C36' }}
        >
          <Plus size={16} />
          {t('add_expense')}
        </button>
      </header>

      {/* Summary Card */}
      <div className="px-1">
        <div className="p-5 bg-amber-50/50 dark:bg-amber-950/10 rounded-lg border border-amber-100/50 dark:border-amber-900/20 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[9px] font-black text-amber-600/70 uppercase tracking-widest">{t('pending_expenses')}</span>
            <div className="text-2xl font-black text-zinc-900 dark:text-white">
              {formatCurrency(totalThisMonth, settings.currency, settings.language)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-white dark:bg-amber-900/40 text-amber-600 flex items-center justify-center shadow-sm">
            <Wallet size={20} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('operation_history')}</h2>
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button 
              onClick={() => setFilter('pending')}
              className={cn(
                "px-3 py-1 text-[9px] font-black rounded-lg transition-all",
                filter === 'pending' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-400"
              )}
            >
              {t('current')}
            </button>
            <button 
              onClick={() => setFilter('audited')}
              className={cn(
                "px-3 py-1 text-[9px] font-black rounded-md transition-all",
                filter === 'audited' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-400"
              )}
            >
              {t('audited')}
            </button>
            <button 
              onClick={() => setFilter('all')}
              className={cn(
                "px-3 py-1 text-[9px] font-black rounded-md transition-all",
                filter === 'all' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-400"
              )}
            >
              {t('all')}
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent animate-spin rounded-full" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-10 text-center text-zinc-400 text-xs font-bold bg-white dark:bg-zinc-900 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
            {filter === 'pending' ? t('no_expenses_match') : t('no_data_available')}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredExpenses.map((expense) => (
              <motion.div 
                layout
                key={expense.id} 
                className={cn(
                  "flex items-center justify-between rounded-lg bg-white p-3 shadow-sm border transition-opacity",
                  expense.audited ? "opacity-60 border-zinc-50 dark:bg-zinc-900/50 dark:border-zinc-800" : "border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                    <ReceiptText size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-black text-zinc-900 dark:text-white truncate">
                        {expense.description}
                      </h3>
                      {expense.audited && (
                        <div className="text-[7px] font-black text-blue-500 flex items-center gap-0.5 bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded">
                          <CheckCheck size={8} />
                          {t('audited_label')}
                        </div>
                      )}
                      {!expense.audited && (
                        <div className="text-[7px] font-black text-amber-500 flex items-center gap-0.5 bg-amber-50 dark:bg-amber-900/20 px-1 py-0.5 rounded">
                          <Clock size={8} />
                          {t('waiting_label')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-1 text-[9px] text-zinc-400 font-bold">
                        <Calendar size={9} />
                        {formatAppDate(safeParseDate(expense.date), settings.language, t)}
                      </div>
                      {expense.category && (
                        <div className="text-[8px] text-amber-600 font-black bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-md">
                          {expense.category === 'عام' ? t('general_cat') : 
                           expense.category === 'فواتير' ? t('bills_cat') : 
                           expense.category === 'كراء' ? t('rent_cat') : 
                           expense.category === 'سلع' ? t('goods_transport_cat') : 
                           expense.category === 'أخرى' ? t('other_cat') : 
                           expense.category}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div { ... (expense.audited ? { className: "text-[15px] font-black text-zinc-300" } : { className: "text-[15px] font-black text-[#B34C36]" })}>
                    -{formatCurrency(expense.amount, settings.currency, settings.language)}
                  </div>
                  {!expense.audited && (
                    <button 
                      onClick={() => deleteDoc(doc(db, `users/${user!.uid}/expenses`, expense.id!))} 
                      className="p-1.5 rounded-lg text-zinc-300 hover:text-[#B34C36] transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsModalOpen(false)} 
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative w-full max-w-sm rounded-lg bg-white p-6 dark:bg-zinc-900 text-right shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 bg-zinc-50 dark:bg-zinc-800 p-1.5 rounded-lg">
                  <X size={18} />
                </button>
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">{t('add_expense_title')}</h2>
              </div>
              
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2">{t('amount_required')}</label>
                  <div className="relative">
                    <input 
                      name="amount" 
                      type="number" 
                      step="0.001" 
                      placeholder="0.000" 
                      required 
                      autoFocus
                      className="w-full rounded-lg border border-zinc-100 p-3 text-right outline-none dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-amber-500/20 transition-all font-black text-2xl text-amber-600" 
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-300">{settings.currency}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2">{t('description_optional')}</label>
                  <input 
                    name="description" 
                    placeholder={t('expense_placeholder')} 
                    className="w-full rounded-lg border border-zinc-100 p-3 text-right outline-none dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-amber-500/20 transition-all font-bold text-sm" 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-2">{t('category')}</label>
                  <select 
                    name="category"
                    className="w-full rounded-lg border border-zinc-100 p-3 text-right outline-none dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-amber-500/20 transition-all font-bold text-sm appearance-none bg-white dark:bg-zinc-800"
                  >
                    <option value="عام">{t('general_cat')}</option>
                    <option value="فواتير">{t('bills_cat')}</option>
                    <option value="كراء">{t('rent_cat')}</option>
                    <option value="سلع">{t('goods_transport_cat')}</option>
                    <option value="أخرى">{t('other_cat')}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2 pt-4">
                  <button type="submit" className="w-full rounded-lg py-3.5 font-black text-white shadow-lg shadow-[#B34C36]/20 active:scale-95 transition-all text-sm" style={{ backgroundColor: '#B34C36' }}>
                    {t('confirm_expense')}
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="w-full rounded-lg bg-zinc-50 dark:bg-zinc-800 py-3 text-xs font-bold text-zinc-500 active:scale-95 transition-all">
                    {t('cancel')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

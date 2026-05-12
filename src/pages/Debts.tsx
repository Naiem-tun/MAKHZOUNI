import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Debt, Supplier, OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, UserPlus, Trash2, Eye, Plus, Minus, X, CheckCircle2, History, Edit2, ArrowRightLeft, Truck } from 'lucide-react';
import { formatCurrency, cn, handleFirestoreError } from '../lib/utils';

export default function Debts() {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtType, setDebtType] = useState<'receivable' | 'payable'>('receivable');
  const [activeDebt, setActiveDebt] = useState<Debt | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  
  // New action modal states
  const [actionDebt, setActionDebt] = useState<Debt | null>(null);
  const [actionType, setActionType] = useState<'debt' | 'payment' | 'select'>('select');
  const [actionAmount, setActionAmount] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = collection(db, `users/${user.uid}/debts`);
    const unsubDebts = onSnapshot(q, (snap) => {
      setDebts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt)));
    });

    const suppliersQ = collection(db, `users/${user.uid}/suppliers`);
    const unsubSuppliers = onSnapshot(suppliersQ, (snap) => {
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });

    return () => {
      unsubDebts();
      unsubSuppliers();
    };
  }, [user]);

  const handleSaveDebt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isSaving) return;
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      customerName: formData.get('customerName') as string,
      phone: formData.get('phone') as string,
      type: editingDebt ? (editingDebt.type || 'receivable') : debtType,
      totalAmount: editingDebt ? editingDebt.totalAmount : 0,
      status: editingDebt ? editingDebt.status : 'paid' as const,
      payments: editingDebt ? editingDebt.payments : [],
      history: editingDebt ? editingDebt.history : [],
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingDebt) {
        await updateDoc(doc(db, `users/${user.uid}/debts`, editingDebt.id!), data);
        showToast(t('debt_updated_success'));
      } else {
        await addDoc(collection(db, `users/${user.uid}/debts`), data);
        showToast(t('debt_added_success'));
      }
      setIsModalOpen(false);
      setEditingDebt(null);
    } catch (err) {
      console.error("Failed to save debt:", err);
      handleFirestoreError(err, editingDebt ? OperationType.UPDATE : OperationType.CREATE, `users/${user.uid}/debts`);
    } finally {
      setIsSaving(false);
    }
  };

  const addPayment = (debt: Debt, amount: number) => {
    if (!user) return;
    const newTotal = debt.totalAmount - amount;
    const newStatus = newTotal <= 0 ? 'paid' : 'unpaid';
    const timestamp = new Date().toISOString();
    const newPayments = [...(debt.payments || []), { amount, date: timestamp }];
    const newHistory = [...(debt.history || []), { type: 'payment' as const, amount, date: timestamp }];
    
    // UI Feedback
    showToast(t('payment_recorded_success'));

    updateDoc(doc(db, `users/${user.uid}/debts`, debt.id!), {
      totalAmount: newTotal,
      status: newStatus,
      payments: newPayments,
      history: newHistory,
      updatedAt: serverTimestamp(),
    }).catch(err => {
      console.error("Async payment update failed:", err);
    });
  };

  const addDebtAmount = (debt: Debt, amount: number) => {
    if (!user) return;
    const newTotal = debt.totalAmount + amount;
    const timestamp = new Date().toISOString();
    const newHistory = [...(debt.history || []), { type: 'debt' as const, amount, date: timestamp }];
    
    showToast(t('debt_amount_added_success'));

    updateDoc(doc(db, `users/${user.uid}/debts`, debt.id!), {
      totalAmount: newTotal,
      status: 'unpaid',
      history: newHistory,
      updatedAt: serverTimestamp(),
    }).catch(err => {
      console.error("Async debt update failed:", err);
    });
  };

  const handleDeleteDebt = async () => {
    if (!user || !deleteConfirmId) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, `users/${user.uid}/debts`, deleteConfirmId));
      showToast(t('debt_deleted_success'));
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/debts/${deleteConfirmId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDebt(null);
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
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('debts_book')}</h1>
          <p className="text-zinc-500 dark:text-zinc-400">{t('debts_subtitle')}</p>
        </div>
        <button onClick={() => { setEditingDebt(null); setIsModalOpen(true); }} className="flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-500/20">
          <UserPlus size={20} />
          {t('add_person')}
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {debts.map((d) => (
          <div key={d.id} className="relative group overflow-hidden rounded-2xl">
            {/* Hidden Actions Layer */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-1 gap-1 z-0">
              <button 
                onClick={() => { setEditingDebt(d); setIsModalOpen(true); }}
                className="h-[calc(100%-8px)] w-16 bg-edit-bg border border-edit-border rounded-2xl flex flex-col items-center justify-center gap-1 text-edit-text"
              >
                <Edit2 size={18} />
                <span className="text-[10px] font-bold">{t('edit')}</span>
              </button>
              <button 
                onClick={() => { setDeleteConfirmId(d.id!); setDeleteConfirmName(d.customerName || ''); }}
                className="h-[calc(100%-8px)] w-16 bg-delete-bg border border-delete-border flex flex-col items-center justify-center gap-1 text-delete-text rounded-2xl"
              >
                <Trash2 size={18} />
                <span className="text-[10px] font-bold">{t('delete')}</span>
              </button>
            </div>

            {/* Swipable Front Layer */}
            <motion.div 
              drag="x"
              dragConstraints={{ left: -140, right: 0 }}
              dragElastic={0.1}
              onClick={() => setActiveDebt(d)}
              className="relative z-10 flex cursor-pointer items-center justify-between rounded-2xl bg-white p-3 shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800"
            >
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 shrink-0`}>
                  {d.type === 'payable' ? <Truck size={20} /> : <BookOpen size={20} />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">{d.customerName}</h3>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full ${d.status === 'paid' ? 'bg-brand-500' : 'bg-[#B34C36]'}`} />
                    <span className={d.status === 'paid' ? 'text-brand-600' : 'text-[#B34C36]'}>
                      {d.status === 'paid' ? t('paid') : (d.type === 'payable' ? t('payable_owed') : t('over_due'))}
                    </span>
                    <span className="text-zinc-300">•</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{formatCurrency(d.totalAmount, settings.currency, settings.language)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActionDebt(d);
                    setActionType('select');
                    setActionAmount('');
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-2xl bg-zinc-50 text-brand-600 border border-zinc-100 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-brand-400 dark:hover:bg-zinc-700 transition-colors"
                >
                  <ArrowRightLeft size={18}/>
                </button>
              </div>
            </motion.div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div key={editingDebt?.id || 'new'} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md rounded-2xl bg-white p-8 dark:bg-zinc-900 text-right">
              <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
                {editingDebt ? t('edit_debt_data') : t('add_new_debt')}
              </h2>
              <form onSubmit={handleSaveDebt} className="space-y-4">
                {!editingDebt && (
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl mb-4">
                    <button 
                      type="button" 
                      onClick={() => setDebtType('receivable')} 
                      className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all ${debtType === 'receivable' ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                      {t('receivable_debt')}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setDebtType('payable')} 
                      className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all ${debtType === 'payable' ? 'bg-[#B34C36] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                      {t('payable_debt')}
                    </button>
                  </div>
                )}
                
                <input 
                  name="customerName" 
                  list={debtType === 'payable' ? 'suppliers-list' : undefined}
                  autoComplete="off"
                  placeholder={
                    editingDebt 
                      ? t('customer_name_placeholder') 
                      : (debtType === 'payable' ? t('supplier_name_or_person') : t('customer_name_placeholder'))
                  } 
                  defaultValue={editingDebt?.customerName} 
                  required 
                  className="w-full rounded-2xl border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800" 
                />
                
                {debtType === 'payable' && !editingDebt && (
                  <datalist id="suppliers-list">
                    {suppliers.map(s => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                )}

                <input name="phone" type="tel" placeholder={t('phone_optional_placeholder')} defaultValue={editingDebt?.phone} className="w-full rounded-2xl border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800 text-left dir-ltr" style={{ direction: 'ltr' }} />
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 rounded-2xl bg-zinc-100 py-3 font-semibold text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">{t('cancel')}</button>
                  <button type="submit" disabled={isSaving} className="flex-1 rounded-2xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-50">
                    {isSaving ? t('saving') : (editingDebt ? t('update') : t('add'))}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Action selection / Amount input Modal */}
      <AnimatePresence>
        {actionDebt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:items-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActionDebt(null)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="relative w-full max-w-md rounded-2xl bg-white p-6 dark:bg-zinc-900 text-right">
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setActionDebt(null)} className="p-2 -ml-2 text-zinc-500 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={20} /></button>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {actionType === 'select' ? t('select_operation') : (actionType === 'debt' ? t('record_new_debt') : t('record_payment'))}
                </h2>
              </div>
              
              {actionType === 'select' && (
                <div className="space-y-3">
                  <button 
                    onClick={() => setActionType('payment')}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 transition-colors"
                  >
                    <Plus size={24} />
                    <span className="font-bold text-lg">{t('record_payment')}</span>
                  </button>
                  <button 
                    onClick={() => setActionType('debt')}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#B34C36]/5 text-[#B34C36] border border-[#B34C36]/10 dark:bg-[#B34C36]/10 dark:border-[#B34C36]/20 transition-colors"
                  >
                    <Minus size={24} />
                    <span className="font-bold text-lg">{t('record_new_debt')}</span>
                  </button>
                </div>
              )}

              {(actionType === 'debt' || actionType === 'payment') && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const amount = parseFloat(actionAmount);
                  if (amount > 0) {
                    if (actionType === 'payment') addPayment(actionDebt, amount);
                    else addDebtAmount(actionDebt, amount);
                  }
                  setActionDebt(null);
                  setActionAmount('');
                  setActionType('select');
                }} className="space-y-4">
                  <input 
                    type="number" 
                    step="0.001" 
                    value={actionAmount}
                    onChange={(e) => setActionAmount(e.target.value)}
                    placeholder={t('enter_amount_placeholder')} 
                    autoFocus
                    required 
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-right text-xl font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={!actionAmount || isSaving} className={`flex-1 rounded-2xl py-3 font-semibold text-white transition-opacity ${actionType === 'payment' ? 'bg-emerald-500' : 'bg-[#B34C36]'} disabled:opacity-50`}>
                      {t('confirm')}
                    </button>
                    <button type="button" onClick={() => setActionType('select')} className="flex-1 rounded-2xl bg-zinc-100 py-3 font-semibold text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">{t('cancel')}</button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Debt details modal */}
      <AnimatePresence>
        {activeDebt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveDebt(null)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="relative w-full max-w-xl rounded-2xl bg-white p-8 dark:bg-zinc-900 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <button onClick={() => setActiveDebt(null)}><X size={24} className="text-zinc-500" /></button>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('operations_log')} {t('debts')} {activeDebt.customerName}</h2>
              </div>
              <div className="space-y-4">
                {(() => {
                  const displayHistory = activeDebt.history || (activeDebt.payments || []).map(p => ({ type: 'payment' as const, amount: p.amount, date: p.date }));
                  const sortedHistory = [...displayHistory].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  
                  if (sortedHistory.length === 0) {
                    return <p className="text-center text-zinc-500 py-8">{t('no_expenses_waiting')}</p>;
                  }
                  
                  return sortedHistory.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${item.type === 'payment' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' : 'bg-[#B34C36]/10 text-[#B34C36] dark:bg-[#B34C36]/20'}`}>
                          {item.type === 'payment' ? <Plus size={20} /> : <Minus size={20} />}
                        </div>
                        <div>
                          <p className={`font-bold ${item.type === 'payment' ? 'text-emerald-600' : 'text-[#B34C36]'}`}>
                            {item.type === 'payment' ? '+' : '-'}{formatCurrency(item.amount, settings.currency, settings.language)}
                          </p>
                          <p className="text-xs text-zinc-500">{new Date(item.date).toLocaleString()}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-zinc-400">{item.type === 'payment' ? t('payment_type') : t('debt_type')}</span>
                    </div>
                  ));
                })()}
              </div>
            </motion.div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmId(null)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-[280px] rounded-2xl bg-white p-6 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {t('confirm_delete_debt_desc')} <span className="text-[#B34C36]">"{deleteConfirmName}"</span> {settings.language === 'ar' ? '؟' : '?'}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={handleDeleteDebt}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-2xl font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px] disabled:opacity-50"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  {t('confirm')}
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[12px] font-bold active:scale-95 transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Supplier, SupplierTransaction, Debt, OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, Plus, Phone, Trash2, Edit2, X, RotateCcw, UserPlus, Eye, Receipt, History, CirclePlus, Calendar, Search, Play, Square } from 'lucide-react';
import { formatCurrency, handleFirestoreError, safeParseDate, formatAppDate } from '../lib/utils';

export default function Suppliers() {
  const { t } = useTranslation();
  const { user, showToast, settings, activeSupplier, setActiveSupplier, setIsSessionSummaryOpen } = useAppContext();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedVisitDays, setSelectedVisitDays] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const [isTotalModalOpen, setIsTotalModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const days = [
    { id: 0, name: t('sunday') },
    { id: 1, name: t('monday') },
    { id: 2, name: t('tuesday') },
    { id: 3, name: t('wednesday') },
    { id: 4, name: t('thursday') },
    { id: 5, name: t('friday') },
    { id: 6, name: t('saturday') },
  ];

  const today = new Date().getDay();

  useEffect(() => {
    if (!user) return;
    const q = collection(db, `users/${user.uid}/suppliers`);
    const unsubSuppliers = onSnapshot(q, (snap) => {
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/suppliers`);
    });

    const txQ = collection(db, `users/${user.uid}/supplierTransactions`);
    const unsubTx = onSnapshot(txQ, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierTransaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/supplierTransactions`);
    });

    const debtsQ = collection(db, `users/${user.uid}/debts`);
    const unsubDebts = onSnapshot(debtsQ, (snap) => {
      setDebts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt)));
    });

    return () => {
      unsubSuppliers();
      unsubTx();
      unsubDebts();
    };
  }, [user]);

  const suppliersWithTotals = suppliers.map(s => {
    const supplierTx = transactions.filter(t => t.supplierId === s.id);
    const totalPaid = supplierTx.reduce((acc, t) => acc + (t.amount || 0), 0);
    const txCount = supplierTx.length;
    
    // Check for missed visit
    // A visit is considered "missed" if today > visitDay AND no transaction exists for THIS specific week's visitDay
    const isMissed = s.visitDays?.some(day => {
      if (day >= today) return false; // Not passed yet or is today

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - today);
      startOfWeek.setHours(0, 0, 0, 0);

      const targetDate = new Date(startOfWeek);
      targetDate.setDate(targetDate.getDate() + day);

      const hasTxForDay = transactions.some(t => {
        if (t.supplierId !== s.id) return false;
        const txDate = safeParseDate(t.date);
        return txDate.toDateString() === targetDate.toDateString();
      });

      return !hasTxForDay;
    });

    return { ...s, totalPaid, txCount, isMissed };
  }).sort((a, b) => {
    const aIsToday = !!a.visitDays?.includes(today);
    const bIsToday = !!b.visitDays?.includes(today);
    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;
    return a.name.localeCompare(b.name, 'ar');
  });

  const grandTotal = transactions.reduce((acc, t) => acc + (t.amount || 0), 0);

  const filteredSuppliers = suppliersWithTotals.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery) ||
    s.typeOfGoods?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isSaving) return;
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const data: any = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      typeOfGoods: formData.get('typeOfGoods') as string,
      visitDays: selectedVisitDays,
      updatedAt: serverTimestamp(),
    };

    // Only include transactionCount if it exists to avoid Firestore errors
    if (editingSupplier && 'transactionCount' in editingSupplier) {
      data.transactionCount = editingSupplier.transactionCount || 0;
    } else if (!editingSupplier) {
      data.transactionCount = 0;
    }

    setIsModalOpen(false);

    if (editingSupplier) {
      showToast(t('supplier_updated_success'));
      updateDoc(doc(db, `users/${user.uid}/suppliers`, editingSupplier.id!), data).catch(err => {
        console.error("Failed to update supplier:", err);
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/suppliers/${editingSupplier.id}`);
      });
    } else {
      showToast(t('supplier_added_success'));
      addDoc(collection(db, `users/${user.uid}/suppliers`), data).catch(err => {
        console.error("Failed to append supplier:", err);
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/suppliers`);
      });
    }
    
    setEditingSupplier(null);
    setIsSaving(false);
  };

  const handleDeleteSupplier = async () => {
    if (!user || !deleteConfirmId) return;
    
    // Optimistic UI update
    const targetId = deleteConfirmId;
    setDeleteConfirmId(null);
    showToast(t('supplier_deleted_success'));
    
    try {
      deleteDoc(doc(db, `users/${user.uid}/suppliers`, targetId)).catch(err => {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/suppliers/${targetId}`);
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAllTransactions = async () => {
    if (!user || transactions.length === 0) return;
    setIsSaving(true);
    try {
      const deletePromises = transactions.map(t => 
        deleteDoc(doc(db, `users/${user.uid}/supplierTransactions`, t.id!))
      );
      await Promise.all(deletePromises);
      showToast(t('all_supplier_transactions_cleared_success'));
      setIsClearAllConfirmOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/supplierTransactions`);
    } finally {
      setIsSaving(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
    setSelectedVisitDays([]);
  };

  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedSupplier || isSaving) return;
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string) || 0;
    const dateInput = formData.get('date') as string;
    const date = dateInput ? new Date(dateInput) : new Date();
    
    const data = {
      supplierId: selectedSupplier.id,
      amount,
      date: Timestamp.fromDate(date),
      note: formData.get('note') as string,
      updatedAt: serverTimestamp(),
    };

    setIsAddTxModalOpen(false);
    showToast(t('supplier_transaction_added_success'));
    
    addDoc(collection(db, `users/${user.uid}/supplierTransactions`), data).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/supplierTransactions`);
    }).finally(() => {
      setIsSaving(false);
    });
  };

  const [deleteTxConfirmId, setDeleteTxConfirmId] = useState<string | null>(null);

  const handleDeleteTransaction = async () => {
    if (!user || !deleteTxConfirmId) return;

    // Optimistic UI updates
    const targetId = deleteTxConfirmId;
    setDeleteTxConfirmId(null);
    showToast(t('supplier_transaction_deleted_success'));

    try {
      deleteDoc(doc(db, `users/${user.uid}/supplierTransactions`, targetId)).catch(err => {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/supplierTransactions`);
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('suppliers_book')}</h1>
          <p className="text-zinc-500 dark:text-zinc-400">{t('suppliers_subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingSupplier(null); setSelectedVisitDays([]); setIsModalOpen(true); }} className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-500/20">
            <UserPlus size={20} />
            {t('add_supplier')}
          </button>
          <button 
            onClick={() => setIsClearAllConfirmOpen(true)}
            className="p-3 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-[#B34C36]/5 hover:text-[#B34C36] transition-all dark:bg-zinc-800"
            title={t('clear_all_transactions')}
          >
            <RotateCcw size={20}/>
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="relative group">
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('search')} 
          className="w-full rounded-lg border border-zinc-100 bg-white py-3 pr-12 pl-4 outline-none focus:ring-2 focus:ring-brand-500 transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
          dir="rtl"
        />
        <div className="absolute inset-y-0 right-4 flex items-center pr-3 pointer-events-none text-zinc-400 group-focus-within:text-brand-500 transition-colors">
          <Search size={20} className="opacity-50" />
        </div>
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 left-4 flex items-center pl-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 pb-40">
        {filteredSuppliers.map((s) => {
          const isToday = s.visitDays?.includes(today);
          return (
            <div key={s.id} className="relative group overflow-hidden rounded-lg">
              {/* Hidden Actions Layer (Behind) */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-1 gap-1 z-0">
                <button 
                  onClick={() => { setEditingSupplier(s); setSelectedVisitDays(s.visitDays || []); setIsModalOpen(true); }}
                  className="h-[calc(100%-8px)] w-16 bg-edit-bg border border-edit-border rounded-lg flex flex-col items-center justify-center gap-1 text-edit-text"
                >
                  <Edit2 size={18} />
                  <span className="text-[10px] font-bold">{t('edit')}</span>
                </button>
                <button 
                  onClick={() => { setDeleteConfirmId(s.id!); setDeleteConfirmName(s.name || ''); }}
                  className="h-[calc(100%-8px)] w-16 bg-delete-bg border border-delete-border flex flex-col items-center justify-center gap-1 text-delete-text rounded-lg"
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
                onClick={() => { setSelectedSupplier(s); setIsHistoryModalOpen(true); }}
                className={`relative z-10 flex cursor-pointer items-center justify-between rounded-lg bg-white p-3 shadow-sm border transition-all ${
                  isToday 
                    ? 'border-brand-500 ring-4 ring-brand-500/5 dark:bg-zinc-900' 
                    : s.isMissed
                    ? 'border-[#B34C36] ring-4 ring-[#B34C36]/5 dark:bg-zinc-900'
                    : 'border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">{s.name}</h3>
                          {debts.some(d => d.customerName === s.name && d.status === 'unpaid') && (
                            <span className="text-[#B34C36] font-bold">-</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded-lg text-[10px] font-bold border border-zinc-200 dark:border-zinc-700">
                            {s.txCount || 0} {t('operations')}
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 shrink-0">{s.typeOfGoods}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isToday && <span className="text-[10px] font-bold text-brand-600">{t('visits_today')}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 pl-1">
                  {s.phone && (
                    <a 
                      href={`tel:${s.phone}`} 
                      onClick={(e) => e.stopPropagation()}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-50 text-brand-600 border border-zinc-100 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <Phone size={18}/>
                    </a>
                  )}
                  {(settings.showSupplierSessionButton ?? true) && (
                    activeSupplier?.id === s.id ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsSessionSummaryOpen(true); }} 
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition-all font-bold shadow-sm"
                        title={t('end_supplier_session')}
                      >
                        <Square size={16} fill="currentColor" />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveSupplier({ id: s.id!, name: s.name }); }} 
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-all font-bold shadow-sm"
                        title={t('start_supplier_session')}
                      >
                        <Play size={16} fill="currentColor" />
                      </button>
                    )
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedSupplier(s); setIsAddTxModalOpen(true); }} 
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-brand-600 text-white hover:opacity-90 transition-all font-bold shadow-sm"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Total Summary */}
      <div className="fixed bottom-28 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-fit bg-brand-50 dark:bg-zinc-900 border border-brand-200/60 dark:border-zinc-800 px-8 py-3 rounded-xl shadow-lg shadow-brand-500/10 pointer-events-auto relative cursor-pointer"
          onClick={() => setIsTotalModalOpen(true)}
        >
          {/* Decorative handle at top */}
          <div className="absolute -top-1.5 w-10 h-2 bg-brand-50 dark:bg-zinc-900 left-1/2 -translate-x-1/2 rounded-t-md border-t border-x border-brand-200/60 dark:border-zinc-800" />
          
          <div className="flex items-center justify-center gap-3">
            <span className="text-[1.35rem] font-black text-brand-900 dark:text-white tracking-tight">
              {!(settings.showFinancials ?? true) ? '••••••' : grandTotal.toLocaleString(settings.language === 'ar' ? 'ar-TN' : 'en-US', { 
                minimumFractionDigits: settings.currency === 'TND' || settings.currency === 'د.ت' ? 3 : 2, 
                maximumFractionDigits: settings.currency === 'TND' || settings.currency === 'د.ت' ? 3 : 2 
              })}
            </span>
            <span className="text-base font-bold text-brand-600 dark:text-zinc-500 mt-1">{settings.currency}</span>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div key={editingSupplier?.id || 'new'} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md rounded-lg bg-white p-8 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
              <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">{editingSupplier ? t('edit_supplier_data') : t('add_new_supplier')}</h2>
              <form onSubmit={handleSave} className="space-y-4 text-right">
                <div>
                  <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('name')}</label>
                  <input name="name" placeholder={t('supplier_name_placeholder')} defaultValue={editingSupplier?.name} required className="w-full rounded-lg border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 font-bold" />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('phone_number')}</label>
                  <input name="phone" placeholder={t('supplier_phone_placeholder')} defaultValue={editingSupplier?.phone} className="w-full rounded-lg border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700" />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('category')}</label>
                  <input name="typeOfGoods" placeholder={t('supplier_goods_placeholder')} defaultValue={editingSupplier?.typeOfGoods} className="w-full rounded-lg border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700" />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 mb-3 block">{t('weekly_visit_days')}</label>
                  <div className="space-y-2">
                    {/* Row 1: Sun-Wed */}
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map((id) => {
                        const day = days.find(d => d.id === id);
                        if (!day) return null;
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => {
                              if (selectedVisitDays.includes(day.id)) {
                                setSelectedVisitDays(selectedVisitDays.filter(d => d !== id));
                              } else {
                                setSelectedVisitDays([...selectedVisitDays, id]);
                              }
                            }}
                            className={`py-3 rounded-lg text-[11px] font-black transition-all ${
                              selectedVisitDays.includes(day.id)
                                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20'
                                : 'bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800'
                            }`}
                          >
                            {day.name}
                          </button>
                        );
                      })}
                    </div>
                    {/* Row 2: Thu-Sat */}
                    <div className="grid grid-cols-3 gap-2">
                      {[4, 5, 6].map((id) => {
                        const day = days.find(d => d.id === id);
                        if (!day) return null;
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => {
                              if (selectedVisitDays.includes(day.id)) {
                                setSelectedVisitDays(selectedVisitDays.filter(d => d !== id));
                              } else {
                                setSelectedVisitDays([...selectedVisitDays, id]);
                              }
                            }}
                            className={`py-3 rounded-lg text-[11px] font-black transition-all ${
                              selectedVisitDays.includes(day.id)
                                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20'
                                : 'bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800'
                            }`}
                          >
                            {day.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 rounded-lg bg-zinc-100 py-3 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">{t('cancel')}</button>
                  <button type="submit" disabled={isSaving} className="flex-1 rounded-lg bg-brand-600 py-3 font-semibold text-white shadow-lg shadow-brand-500/20 disabled:opacity-50">
                    {isSaving ? t('saving') : t('save_data')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddTxModalOpen && selectedSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddTxModalOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md rounded-lg bg-white p-8 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600">
                  <CirclePlus size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t('record_payment')}</h2>
                  <p className="text-xs text-zinc-500">{t('suppliers')}: {selectedSupplier.name}</p>
                </div>
              </div>
              <form onSubmit={handleAddTransaction} className="space-y-4 text-right">
                <div>
                  <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('purchase_price')}</label>
                  <div className="relative">
                    <input name="amount" type="number" step="0.001" placeholder="0.000" required className="w-full rounded-lg border bg-zinc-50 p-4 pr-12 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 font-mono text-lg" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">{settings.currency}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('date')}</label>
                  <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-lg border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700" />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('notes')}</label>
                  <input name="note" placeholder={t('record_payment_note_placeholder')} className="w-full rounded-lg border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsAddTxModalOpen(false)} className="flex-1 rounded-lg bg-zinc-100 py-3 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">{t('cancel')}</button>
                  <button type="submit" disabled={isSaving} className="flex-1 rounded-lg py-3 font-semibold text-white shadow-lg shadow-[#B34C36]/20 disabled:opacity-50" style={{ backgroundColor: '#B34C36' }}>
                    {isSaving ? t('saving') : t('confirm_payment')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isHistoryModalOpen && selectedSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryModalOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg rounded-lg bg-white p-8 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                    <History size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t('operations_log')}</h2>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-zinc-500">{selectedSupplier.name}</p>
                      <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-lg text-zinc-500 font-bold">
                        {transactions.filter(t => t.supplierId === selectedSupplier.id).length} {t('operations')}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                {transactions
                  .filter(t => t.supplierId === selectedSupplier.id)
                  .sort((a, b) => {
                    const dateA = safeParseDate(a.date);
                    const dateB = safeParseDate(b.date);
                    return dateB.getTime() - dateA.getTime();
                  })
                  .map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center text-brand-600 shadow-sm border border-zinc-100 dark:border-zinc-700">
                          <Calendar size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-white">{formatCurrency(tx.amount, settings.currency, settings.language)}</div>
                    <div className="text-[10px] text-zinc-400 capitalize">
                      {formatAppDate(safeParseDate(tx.date), settings.language, t, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                          {tx.note && <div className="text-[10px] text-zinc-500 mt-0.5">{tx.note === 'session_purchases_total' ? t('session_purchases_total') : tx.note}</div>}
                        </div>
                      </div>
                      <button 
                        onClick={() => setDeleteTxConfirmId(tx.id!)}
                        className="p-2 rounded-lg text-[#B34C36] hover:bg-[#B34C36]/5 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                {transactions.filter(t => t.supplierId === selectedSupplier.id).length === 0 && (
                  <div className="text-center py-12 text-zinc-400">
                    <p className="text-sm">{t('no_expenses_waiting')}</p>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <span className="text-base font-bold text-zinc-500">{t('total_expenses')}</span>
                <span className="text-xl font-black text-zinc-900 dark:text-white">
                  {formatCurrency(
                    transactions.filter(t => t.supplierId === selectedSupplier.id).reduce((acc, t) => acc + (t.amount || 0), 0),
                    settings.currency, settings.language
                  )}
                </span>
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
              className="relative w-full max-w-[280px] rounded-lg bg-white p-6 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {t('confirm_delete_supplier_desc')} <span className="text-[#B34C36]">"{deleteConfirmName}"</span> {settings.language === 'ar' ? '؟' : '?'} {t('confirm_delete_supplier_warning')}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={handleDeleteSupplier}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-lg font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px] disabled:opacity-50"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  {t('confirm')}
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[12px] font-bold active:scale-95 transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Delete Transaction Confirmation Modal */}
        {deleteTxConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteTxConfirmId(null)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-[280px] rounded-lg bg-white p-6 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {t('confirm_delete_operation')}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={handleDeleteTransaction}
                  className="flex-1 py-2.5 rounded-lg font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px]"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  {t('confirm')}
                </button>
                <button 
                  onClick={() => setDeleteTxConfirmId(null)}
                  className="flex-1 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[12px] font-bold active:scale-95 transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Clear All Transactions Confirmation Modal */}
        {isClearAllConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsClearAllConfirmOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-[280px] rounded-lg bg-white p-6 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {t('confirm_delete_all_operations')}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={handleClearAllTransactions}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-lg font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px] disabled:opacity-50"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  {t('confirm')}
                </button>
                <button 
                  onClick={() => setIsClearAllConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[12px] font-bold active:scale-95 transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Total Modal */}
        {isTotalModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTotalModalOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-[320px] rounded-lg bg-white p-8 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <h2 className="text-zinc-500 dark:text-zinc-400 font-bold mb-2">{t('total_expenses')}</h2>
              <div className="flex items-center justify-center gap-2 mb-8">
                <span className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">
                  {grandTotal.toLocaleString(settings.language === 'ar' ? 'ar-TN' : 'en-US', { 
                    minimumFractionDigits: settings.currency === 'TND' || settings.currency === 'د.ت' ? 3 : 2, 
                    maximumFractionDigits: settings.currency === 'TND' || settings.currency === 'د.ت' ? 3 : 2 
                  })}
                </span>
                <span className="text-sm font-bold text-zinc-400 mt-2">{settings.currency}</span>
              </div>
              <button 
                onClick={() => setIsTotalModalOpen(false)}
                className="w-full py-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold active:scale-95 transition-all border border-zinc-200 dark:border-zinc-700"
              >
                {t('close')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

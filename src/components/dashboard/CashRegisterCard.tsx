import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../AppContext';
import { CashTransaction, OperationType } from '../../types';
import { handleFirestoreError, formatCurrency, formatAppDate } from '../../lib/utils';
import { Coins, Plus, Minus, FileText, Trash2, Wallet, Scale, Calculator, RotateCcw, Check, History, ChevronDown, ChevronUp, Calendar, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../UI';
import { CustomConfirmModal } from '../common/CustomConfirmModal';

interface CashAudit {
  id?: string;
  date: string;
  expectedAmount: number;
  actualAmount: number;
  discrepancy: number;
  auditTab: 'direct' | 'calc';
  denominations?: { [key: string]: number } | null;
  createdAt?: any;
}

export function CashRegisterCard() {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [audits, setAudits] = useState<CashAudit[]>([]);
  const [activeTab, setActiveTab] = useState<'transactions' | 'audits'>('transactions');
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  // States for Audit (جرد الصندوق)
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditTab, setAuditTab] = useState<'direct' | 'calc'>('direct');
  const [directActualAmount, setDirectActualAmount] = useState('');
  const [denoCounts, setDenoCounts] = useState<{ [key: string]: number }>({
    '0.500': 0, '1': 0, '2': 0, '5': 0, '10': 0, '20': 0, '50': 0
  });

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

    const unsubscribeTx = onSnapshot(txQuery, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashTransaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, txPath);
    });

    const auditsPath = `users/${user.uid}/cash_audits`;
    const auditsQuery = query(collection(db, auditsPath), orderBy('date', 'desc'));

    const unsubscribeAudits = onSnapshot(auditsQuery, (snap) => {
      setAudits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashAudit)));
    }, (error) => {
      console.error("Error subscribing to cash_audits:", error);
    });

    return () => {
      unsubscribeTx();
      unsubscribeAudits();
    };
  }, [user]);

  const balance = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      if (tx.type === 'in' || tx.type === 'sale') return acc + (Number(tx.amount) || 0);
      return acc - (Number(tx.amount) || 0);
    }, 0);
  }, [transactions]);

  const calculateDenoTotal = () => {
    return Object.entries(denoCounts).reduce((sum: number, [denom, count]) => {
      const value = parseFloat(denom);
      const qty = Number(count) || 0;
      return sum + (value * qty);
    }, 0);
  };

  const resetAudit = () => {
    setDirectActualAmount('');
    setDenoCounts({
      '0.500': 0, '1': 0, '2': 0, '5': 0, '10': 0, '20': 0, '50': 0
    });
  };

  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const actualAmount = auditTab === 'calc' ? calculateDenoTotal() : (parseFloat(directActualAmount) || 0);
    const discrepancy = actualAmount - balance;

    setLoading(true);
    try {
      // Save detailed audit record first
      await addDoc(collection(db, `users/${user.uid}/cash_audits`), {
        date: new Date().toISOString(),
        expectedAmount: balance,
        actualAmount: actualAmount,
        discrepancy: discrepancy,
        auditTab: auditTab,
        denominations: auditTab === 'calc' ? denoCounts : null,
        createdAt: serverTimestamp()
      });

      if (Math.abs(discrepancy) > 0.001) {
        const isSurplus = discrepancy > 0;
        await addDoc(collection(db, `users/${user.uid}/cash_transactions`), {
          type: isSurplus ? 'in' : 'out',
          amount: Math.abs(discrepancy),
          description: isSurplus ? 'تسوية جرد الصندوق (زيادة)' : 'تسوية جرد الصندوق (عجز)',
          date: new Date().toISOString(),
          createdAt: serverTimestamp(),
          isAuditAdjustment: true
        });
        showToast(`تمت المطابقة بنجاح وتسجيل تسوية بمبلغ ${formatCurrency(Math.abs(discrepancy), settings.currency, settings.language)}`, 'success');
      } else {
        showToast('جرد مطابق تماماً! تم تسجيل المطابقة بنجاح لحفظها في السجلات.', 'success');
      }
      setIsAuditOpen(false);
      resetAudit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'cash_transactions');
    } finally {
      setLoading(false);
    }
  };

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

        <div className="grid grid-cols-2 gap-4 mb-4">
          <button 
            onClick={() => { setTransactionType('in'); setIsModalOpen(true); }}
            className="flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-lg bg-brand-600 text-sm font-bold text-white transition-all hover:bg-brand-700 shadow-lg shadow-brand-500/20 active:scale-95 whitespace-nowrap"
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

        <button 
          onClick={() => { resetAudit(); setIsAuditOpen(true); }}
          className="w-full flex items-center justify-center gap-2 h-11 mb-6 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-bold text-sm hover:opacity-90 active:scale-95 transition-all border border-emerald-200 dark:border-emerald-500/20"
        >
          <Scale size={18} />
          جرد ومطابقة الكاسة
        </button>

        <div className="flex items-center justify-between mt-4 mb-3">
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg">
            <button
              onClick={() => { setActiveTab('transactions'); setShowTransactions(true); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                showTransactions && activeTab === 'transactions'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-200'
              }`}
            >
              العمليات الأخيرة
            </button>
            <button
              onClick={() => { setActiveTab('audits'); setShowTransactions(true); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                showTransactions && activeTab === 'audits'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-200'
              }`}
            >
              سجلات الجرد المطابقة
            </button>
          </div>
          <button 
             onClick={() => setShowTransactions(!showTransactions)}
             className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline transition-colors dark:text-brand-400"
          >
             {showTransactions ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
          </button>
        </div>

        {showTransactions && (
          <div className="mt-4">
            {activeTab === 'transactions' ? (
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
            ) : (
              /* Audits Tab */
              <>
                {audits.length > 0 ? (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                    {audits.slice(0, 7).map((audit) => {
                      const isExact = Math.abs(audit.discrepancy) < 0.001;
                      const isSurplus = audit.discrepancy > 0.001;
                      const isDeficit = audit.discrepancy < -0.001;
                      const isExpanded = expandedAuditId === audit.id;

                      return (
                        <div key={audit.id} className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isExact && (
                                <div className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 flex items-center justify-center">
                                  <Check size={14} strokeWidth={3} />
                                </div>
                              )}
                              {isSurplus && (
                                <div className="h-6 w-6 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 flex items-center justify-center">
                                  <TrendingUp size={14} strokeWidth={3} />
                                </div>
                              )}
                              {isDeficit && (
                                <div className="h-6 w-6 rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 flex items-center justify-center">
                                  <TrendingDown size={14} strokeWidth={3} />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-xs text-zinc-900 dark:text-white">
                                  {isExact && 'جرد كاسة مطابق تماماً'}
                                  {isSurplus && 'جرد كاسة (زيادة مضافة)'}
                                  {isDeficit && 'جرد كاسة (عجز مُقيد)'}
                                </p>
                                <p className="text-[10px] text-zinc-400 font-medium">
                                  {audit.date ? formatAppDate(new Date(audit.date), settings.language, t) : ''}
                                </p>
                              </div>
                            </div>

                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                              isExact ? 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                              isSurplus ? 'bg-amber-100/50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                              'bg-red-100/50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                            }`}>
                              {isExact ? 'مطابق' : 
                               (isSurplus ? `+${formatCurrency(audit.discrepancy, settings.currency, settings.language)}` : 
                                `-${formatCurrency(Math.abs(audit.discrepancy), settings.currency, settings.language)}`)
                              }
                            </span>
                          </div>

                          {/* Data Details row */}
                          <div className="grid grid-cols-3 gap-2 py-1.5 px-2 bg-white dark:bg-zinc-800/80 rounded-md border border-zinc-100/60 dark:border-zinc-700/50 text-center text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                            <div>
                              <span className="block text-[9px] text-zinc-400 mb-0.5 font-medium">الرصيد المتوقع</span>
                              <span className="text-zinc-800 dark:text-zinc-300">
                                {formatCurrency(audit.expectedAmount, settings.currency, settings.language)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-zinc-400 mb-0.5 font-medium">الرصيد الفعلي</span>
                              <span className="text-zinc-800 dark:text-zinc-300">
                                {formatCurrency(audit.actualAmount, settings.currency, settings.language)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-zinc-400 mb-0.5 font-medium">الفارق (العجز/الزيادة)</span>
                              <span className={isExact ? 'text-emerald-600' : isSurplus ? 'text-amber-600' : 'text-red-600'}>
                                {isExact ? '0.00' : 
                                 (isSurplus ? `+${formatCurrency(audit.discrepancy, settings.currency, settings.language)}` : 
                                  `-${formatCurrency(Math.abs(audit.discrepancy), settings.currency, settings.language)}`)
                                }
                              </span>
                            </div>
                          </div>

                          {/* Denominations counted drawer, if available and was used */}
                          {audit.denominations && Object.values(audit.denominations).some(count => (Number(count) || 0) > 0) && (
                            <div>
                              <button
                                onClick={() => setExpandedAuditId(isExpanded ? null : (audit.id || null))}
                                className="w-full flex items-center justify-between text-[10px] text-brand-600 dark:text-brand-400 font-bold hover:underline py-1"
                              >
                                <span>تفاصيل الفئات النقدية المعدودة</span>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>

                              {isExpanded && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }} 
                                  animate={{ opacity: 1, height: 'auto' }} 
                                  className="mt-1 border-t border-zinc-100 dark:border-zinc-700/50 pt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900/40 p-2 rounded"
                                >
                                  {Object.entries(audit.denominations)
                                    .filter(([_, count]) => (Number(count) || 0) > 0)
                                    .map(([denom, count]) => {
                                      const label = denom === '50' ? 'ورقة 50 د.ت' :
                                                    denom === '20' ? 'ورقة 20 د.ت' :
                                                    denom === '10' ? 'ورقة 10 د.ت' :
                                                    denom === '5'  ? 'ورقة 5 د.ت' :
                                                    denom === '2'  ? 'ورقة / قطعة 2 د.ت' :
                                                    denom === '1'  ? 'قطعة 1 د.ت' :
                                                    denom === '0.500' ? 'قطعة 500 م' :
                                                    denom === '0.200' ? 'قطعة 200 م' :
                                                    denom === '0.100' ? 'قطعة 100 م' :
                                                    denom === '0.050' ? 'قطعة 50 م' :
                                                    denom === '0.020' ? 'قطعة 20 م' : 'قطعة 10 م';
                                      const totalValue = parseFloat(denom) * (Number(count) || 0);
                                      return (
                                        <div key={denom} className="flex justify-between py-0.5 border-b border-zinc-50 dark:border-zinc-800/50">
                                          <span>{label} ✕ {count}</span>
                                          <span className="font-bold text-zinc-800 dark:text-zinc-300">
                                            {formatCurrency(totalValue, settings.currency, settings.language)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                </motion.div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-center py-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                     <p className="text-sm text-zinc-500 gap-2 flex items-center justify-center">
                       <History size={16} />
                       لا توجد عمليات جرد مسجلة حتى الآن
                     </p>
                  </motion.div>
                )}
              </>
            )}
          </div>
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

      {/* Audit Modal (جرد الصندوق) */}
      <AnimatePresence>
        {isAuditOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAuditOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md rounded-2xl border border-zinc-100 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Scale size={18} className="text-emerald-500" />
                    جرد ومطابقة الصندوق
                  </h2>
                  <p className="text-xs text-zinc-500">حساب ومطابقة المبالغ الفعلية مع رصيد النظام</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg mb-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAuditTab('direct')}
                  className={`py-2 px-3 rounded-md transition-all ${auditTab === 'direct' ? 'bg-white dark:bg-zinc-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-zinc-600 dark:text-zinc-400'}`}
                >
                  إدخال مباشر
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTab('calc')}
                  className={`py-2 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${auditTab === 'calc' ? 'bg-white dark:bg-zinc-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-zinc-600 dark:text-zinc-400'}`}
                >
                  <Calculator size={14} />
                  حاسبة الفئات (د.ت)
                </button>
              </div>

              <form onSubmit={handleAuditSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-4">
                  {auditTab === 'direct' ? (
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">إجمالي المبلغ الفعلي في الصندوق</label>
                      <div className="relative">
                        <input 
                          type="number" step="0.001" min="0" required
                          value={directActualAmount} onChange={e => setDirectActualAmount(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 bg-white p-3 pr-12 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white font-black text-lg text-center"
                          placeholder="0.000"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <span className="text-sm font-bold text-zinc-400">د.ت</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-400">الفئة المالية</span>
                        <span className="text-xs font-bold text-zinc-400">العدد والفرعي</span>
                      </div>
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {Object.entries({
                          '0.500': 'قطعة 500 ملّيم',
                          '1': 'قطعة 1 د.ت',
                          '2': 'قطعة 2 د.ت',
                          '5': 'ورقة 5 د.ت',
                          '10': 'ورقة 10 د.ت',
                          '20': 'ورقة 20 د.ت',
                          '50': 'ورقة 50 د.ت'
                        }).map(([denom, label]) => {
                          const val = parseFloat(denom);
                          const count = denoCounts[denom] || 0;
                          return (
                            <div key={denom} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/40 text-xs">
                              <span className="font-bold text-zinc-700 dark:text-zinc-300">{label}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDenoCounts(p => ({ ...p, [denom]: Math.max(0, count - 1) }))}
                                  className="h-7 w-7 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center font-bold"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={count === 0 ? '' : count}
                                  onChange={e => {
                                    const num = parseInt(e.target.value) || 0;
                                    setDenoCounts(p => ({ ...p, [denom]: num }));
                                  }}
                                  placeholder="0"
                                  className="w-12 h-7 text-center rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-bold dark:text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => setDenoCounts(p => ({ ...p, [denom]: count + 1 }))}
                                  className="h-7 w-7 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center font-bold"
                                >
                                  +
                                </button>
                                <span className="w-16 text-left font-mono font-bold text-zinc-500 dark:text-zinc-400">
                                  {(val * count).toFixed(3)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => resetAudit()}
                          className="text-[10px] text-zinc-400 hover:text-zinc-600 flex items-center gap-1 font-bold"
                        >
                          <RotateCcw size={10} />
                          تصفير الآلة الحاسبة
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Summary Comparison */}
                  <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/50 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-600 dark:text-zinc-400">
                      <span>الرصيد الحالي بالنظام (الدفتري):</span>
                      <span className="font-mono text-zinc-900 dark:text-white">{formatCurrency(balance, settings.currency, settings.language)}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-zinc-600 dark:text-zinc-400 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                      <span>الرصيد الفعلي (المحصي):</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        {formatCurrency(
                          auditTab === 'calc' ? calculateDenoTotal() : (parseFloat(directActualAmount) || 0),
                          settings.currency,
                          settings.language
                        )}
                      </span>
                    </div>

                    {/* Variance Helper details */}
                    {(() => {
                      const isUntouched = auditTab === 'direct' ? (directActualAmount === '') : (calculateDenoTotal() === 0);
                      
                      if (isUntouched) {
                        return (
                          <div className="flex items-center justify-center p-3 text-xs bg-brand-500/10 text-brand-700 dark:text-brand-400 rounded-lg font-bold border border-brand-500/20 text-center">
                            يرجى كتابة رصيد الصندوق الفعلي لبدء المطابقة
                          </div>
                        );
                      }

                      const actual = auditTab === 'calc' ? calculateDenoTotal() : (parseFloat(directActualAmount) || 0);
                      const diff = actual - balance;
                      const hasDiscrepancy = Math.abs(diff) > 0.001;

                      if (!hasDiscrepancy) {
                        return (
                          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-lg font-bold">
                            <span className="flex items-center gap-1">
                              <Check size={14} strokeWidth={3} />
                              الصندوق مطابق تماماً
                            </span>
                            <span>0.000 د.ت</span>
                          </div>
                        );
                      }

                      return (
                        <div className={`flex items-center justify-between text-xs p-2 rounded-lg font-bold ${diff < 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                          <span>{diff < 0 ? 'عجز في الصندوق (نقص):' : 'زيادة في الصندوق:'}</span>
                          <span className="font-mono">{diff < 0 ? '-' : '+'}{formatCurrency(Math.abs(diff), settings.currency, settings.language)}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 mt-auto bg-white dark:bg-zinc-900">
                  <button type="button" onClick={() => setIsAuditOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                    إلغاء
                  </button>
                  <button type="submit" disabled={loading} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:opacity-90 flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
                    {loading ? <div className="animate-spin w-4 h-4 border-2 border-white rounded-full border-t-transparent"></div> : 'اعتماد وتصحيح الكاسة'}
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

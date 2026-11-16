import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Debt, Supplier, OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  UserPlus,
  Trash2,
  Plus,
  Minus,
  X,
  Edit2,
  ArrowRightLeft,
  Truck,
  Search,
  Phone,
} from 'lucide-react';
import { formatCurrency, handleFirestoreError, roundMoney, safeParseDate, formatAppDate } from '../lib/utils';
import { logAudit } from '../lib/auditLogger';
import { useFolioTheme } from '../components/folio/FolioPageChrome';
import { matchesQuery } from '../components/dashboard/PurchaseVarianceModal';

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
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Debt Form states
  const [debtCustomerName, setDebtCustomerName] = useState('');
  const [debtPhone, setDebtPhone] = useState('');

  // Action modal states
  const [actionDebt, setActionDebt] = useState<Debt | null>(null);
  const [actionType, setActionType] = useState<'debt' | 'payment' | 'select'>('select');
  const [actionAmount, setActionAmount] = useState('');
  const [actionNote, setActionNote] = useState('');

  const { theme } = useFolioTheme(
    Boolean(settings.darkMode),
    settings.folioThemeId,
  );
  const showFinancials = settings.showFinancials ?? true;
  const language = settings.language || 'ar';
  const formatPrivateValue = (val: number) =>
    !showFinancials ? '••••••' : formatCurrency(val, settings.currency, language);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, `users/${user.uid}/debts`);
    const unsubDebts = onSnapshot(q, (snap) => {
      setDebts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Debt)));
    });

    const suppliersQ = collection(db, `users/${user.uid}/suppliers`);
    const unsubSuppliers = onSnapshot(suppliersQ, (snap) => {
      setSuppliers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Supplier)));
    });

    return () => {
      unsubDebts();
      unsubSuppliers();
    };
  }, [user]);

  const handleSaveDebt = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!user || isSaving) return;
    const customerName = debtCustomerName.trim();
    if (!customerName) return;

    setIsSaving(true);
    const data = {
      customerName,
      phone: debtPhone.trim(),
      type: editingDebt ? editingDebt.type || 'receivable' : debtType,
      totalAmount: editingDebt ? editingDebt.totalAmount : 0,
      status: editingDebt ? editingDebt.status : ('paid' as const),
      payments: editingDebt ? editingDebt.payments : [],
      history: editingDebt ? editingDebt.history : [],
      updatedAt: serverTimestamp(),
    };

    setIsModalOpen(false);
    setDebtCustomerName('');
    setDebtPhone('');

    if (editingDebt) {
      showToast(t('debt_updated_success'));
      updateDoc(doc(db, `users/${user.uid}/debts`, editingDebt.id!), data)
        .then(() => {
          const changes: string[] = [];
          if (editingDebt.customerName !== data.customerName) changes.push('الاسم');
          if (editingDebt.phone !== data.phone) changes.push('الهاتف');

          let detailsStr = 'تعديل بيانات الدين';
          if (changes.length > 0) {
            detailsStr += ` (${changes.join('، ')})`;
          }
          logAudit('update', 'debt', editingDebt.id!, data.customerName, detailsStr);
        })
        .catch((err) => {
          console.error('Failed to update debt:', err);
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/debts`);
        });
    } else {
      showToast(t('debt_added_success'));
      addDoc(collection(db, `users/${user.uid}/debts`), data)
        .then((docRef) => {
          logAudit('create', 'debt', docRef.id, data.customerName, 'إضافة دين جديد');
        })
        .catch((err) => {
          console.error('Failed to save debt:', err);
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/debts`);
        });
    }

    setEditingDebt(null);
    setIsSaving(false);
  };

  const addPayment = (debt: Debt, amount: number, note: string = '') => {
    if (!user) return;
    const newTotal = roundMoney(debt.totalAmount - roundMoney(amount));
    const newStatus = newTotal <= 0 ? 'paid' : 'unpaid';
    const timestamp = new Date().toISOString();
    const cleanAmount = roundMoney(amount);
    const newPayments = [...(debt.payments || []), { amount: cleanAmount, date: timestamp, note }];
    const newHistory = [
      ...(debt.history || []),
      { type: 'payment' as const, amount: cleanAmount, date: timestamp, note },
    ];

    showToast(t('payment_recorded_success'));

    updateDoc(doc(db, `users/${user.uid}/debts`, debt.id!), {
      totalAmount: newTotal,
      status: newStatus,
      payments: newPayments,
      history: newHistory,
      updatedAt: serverTimestamp(),
    })
      .then(() => {
        logAudit('update', 'debt', debt.id!, debt.customerName, `تسديد مبلغ: ${cleanAmount}`);
      })
      .catch((err) => {
        console.error('Async payment update failed:', err);
      });
  };

  const addDebtAmount = (debt: Debt, amount: number, note: string = '') => {
    if (!user) return;
    const cleanAmount = roundMoney(amount);
    const newTotal = roundMoney(debt.totalAmount + cleanAmount);
    const timestamp = new Date().toISOString();
    const newHistory = [
      ...(debt.history || []),
      { type: 'debt' as const, amount: cleanAmount, date: timestamp, note },
    ];

    showToast(t('debt_amount_added_success'));

    updateDoc(doc(db, `users/${user.uid}/debts`, debt.id!), {
      totalAmount: newTotal,
      status: 'unpaid',
      history: newHistory,
      updatedAt: serverTimestamp(),
    })
      .then(() => {
        logAudit('update', 'debt', debt.id!, debt.customerName, `إضافة مبلغ: ${cleanAmount}`);
      })
      .catch((err) => {
        console.error('Async debt update failed:', err);
      });
  };

  const handleDeleteDebt = async () => {
    if (!user || !deleteConfirmId) return;

    const targetId = deleteConfirmId;
    setDeleteConfirmId(null);
    showToast(t('debt_deleted_success'));

    try {
      const debtToDelete = debts.find((d) => d.id === targetId);
      deleteDoc(doc(db, `users/${user.uid}/debts`, targetId))
        .then(() => {
          if (debtToDelete) {
            logAudit('delete', 'debt', targetId, debtToDelete.customerName, 'حذف دين');
          }
        })
        .catch((err) => {
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/debts/${targetId}`);
        });
    } catch (err) {
      console.error(err);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDebt(null);
    setDebtCustomerName('');
    setDebtPhone('');
  };

  useEffect(() => {
    const handler = () => {
      setEditingDebt(null);
      setDebtCustomerName('');
      setDebtPhone('');
      setIsModalOpen(true);
    };
    window.addEventListener('open-debt-modal', handler);
    return () => window.removeEventListener('open-debt-modal', handler);
  }, []);

  const summary = useMemo(() => {
    const receivableList = debts.filter((d) => !d.type || d.type === 'receivable');
    const payableList = debts.filter((d) => d.type === 'payable');
    const receivableTotal = receivableList.reduce(
      (sum, d) => sum + Math.max(0, d.totalAmount || 0),
      0,
    );
    const payableTotal = payableList.reduce(
      (sum, d) => sum + Math.max(0, d.totalAmount || 0),
      0,
    );
    const receivableUnpaid = receivableList.filter((d) => d.status !== 'paid' && d.totalAmount > 0).length;
    const payableUnpaid = payableList.filter((d) => d.status !== 'paid' && d.totalAmount > 0).length;
    const totalUnpaid = debts.filter((d) => d.status !== 'paid' && d.totalAmount > 0).length;

    return {
      receivableTotal,
      payableTotal,
      receivableCount: receivableList.length,
      payableCount: payableList.length,
      receivableUnpaid,
      payableUnpaid,
      totalUnpaid,
      totalCount: debts.length,
    };
  }, [debts]);

  const filteredDebts = useMemo(() => {
    const q = searchQuery.trim();
    return debts
      .filter((d) => d.type === activeTab || (activeTab === 'receivable' && !d.type))
      .filter((d) => {
        if (statusFilter === 'unpaid') return d.status !== 'paid' && d.totalAmount > 0;
        if (statusFilter === 'paid') return d.status === 'paid' || d.totalAmount <= 0;
        return true;
      })
      .filter((d) => {
        if (!q) return true;
        return (
          matchesQuery(d.customerName || '', q) ||
          (d.phone || '').toLowerCase().includes(q.toLowerCase())
        );
      })
      .sort((a, b) => {
        const aUnpaid = a.status !== 'paid' && a.totalAmount > 0 ? 1 : 0;
        const bUnpaid = b.status !== 'paid' && b.totalAmount > 0 ? 1 : 0;
        if (aUnpaid !== bUnpaid) return bUnpaid - aUnpaid;
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      });
  }, [debts, activeTab, statusFilter, searchQuery]);

  const submitActionModal = () => {
    const amount = parseFloat(actionAmount.replace(',', '.'));
    if (amount > 0 && actionDebt) {
      if (actionType === 'payment') addPayment(actionDebt, amount, actionNote);
      else addDebtAmount(actionDebt, amount, actionNote);
      setActionDebt(null);
      setActionAmount('');
      setActionNote('');
      setActionType('select');
    }
  };

  return (
    <div
      className="min-h-screen px-2.5 sm:px-5 pt-3 pb-24 transition-colors"
      style={{ backgroundColor: theme.bg, color: theme.text }}
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto space-y-5">
        {/* FOLIO HEADER */}
        <header
          className="border-b pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-right"
          style={{ borderColor: theme.border }}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: theme.textMuted }}>
              <span className="truncate">{t('debts_subtitle')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: theme.text }}>
              {t('debts_book')}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingDebt(null);
                setDebtCustomerName('');
                setDebtPhone('');
                setDebtType(activeTab);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: theme.text,
                color: theme.surface,
                borderColor: theme.text,
              }}
            >
              <UserPlus size={14} />
              <span>{t('add_person')}</span>
            </button>
          </div>
        </header>

        {/* SECTION 01: 3-CELL DEBTS SUMMARY STRIP */}
        <section
          className="border text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="px-4 py-2.5 border-b flex items-center justify-between"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                01
              </span>
              <span>ملخص الذمم والالتزامات</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
              {summary.totalCount} حساب مسجل
            </span>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse"
            style={{ borderColor: theme.border }}
          >
            <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                إجمالي ديون العملاء (لنا)
              </div>
              <div
                className="text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-tight"
                style={{ color: theme.accent }}
              >
                {formatPrivateValue(summary.receivableTotal)}
              </div>
              <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                {summary.receivableUnpaid} غير مسدد · {summary.receivableCount} عميل
              </div>
            </div>

            <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                إجمالي ديون الموردين (علينا)
              </div>
              <div
                className="text-xl sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.negative }}
              >
                {formatPrivateValue(summary.payableTotal)}
              </div>
              <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                {summary.payableUnpaid} غير مسدد · {summary.payableCount} مورد
              </div>
            </div>

            <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                الحسابات غير المسددة
              </div>
              <div
                className="text-xl sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.text }}
              >
                {summary.totalUnpaid} / {summary.totalCount}
              </div>
              <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                نسبة التسوية {summary.totalCount > 0 ? Math.round(((summary.totalCount - summary.totalUnpaid) / summary.totalCount) * 100) : 100}%
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 02: CONTROLS (TABS + SEARCH + STATUS FILTER) */}
        <section
          className="border p-3 sm:p-4 space-y-3 text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Bordered Segmented Tabs */}
            <div className="grid grid-cols-2 sm:w-80 border" style={{ borderColor: theme.border }}>
              <button
                type="button"
                onClick={() => setActiveTab('receivable')}
                className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold transition-colors cursor-pointer"
                style={{
                  backgroundColor: activeTab === 'receivable' ? theme.text : theme.surfaceMuted,
                  color: activeTab === 'receivable' ? theme.surface : theme.text,
                }}
              >
                <BookOpen size={14} />
                <span>{t('receivable_debt')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('payable')}
                className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold border-r transition-colors cursor-pointer"
                style={{
                  borderColor: theme.border,
                  backgroundColor: activeTab === 'payable' ? theme.text : theme.surfaceMuted,
                  color: activeTab === 'payable' ? theme.surface : theme.text,
                }}
              >
                <Truck size={14} />
                <span>{t('payable_debt')}</span>
              </button>
            </div>

            {/* Search & Status Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 md:justify-end">
              <div
                className="flex items-center gap-2 px-2.5 py-2 border sm:w-64"
                style={{ backgroundColor: theme.bg, borderColor: theme.border }}
              >
                <Search size={14} style={{ color: theme.textMuted }} />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو الهاتف..."
                  className="bg-transparent text-xs w-full focus:outline-none"
                  style={{ color: theme.text }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="مسح البحث"
                    className="cursor-pointer"
                    style={{ color: theme.textMuted }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'unpaid', label: 'غير مسدد' },
                  { id: 'paid', label: 'مسدد' },
                ].map((opt) => {
                  const active = statusFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setStatusFilter(opt.id as 'all' | 'unpaid' | 'paid')}
                      className="px-3 py-2 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      style={{
                        backgroundColor: active ? theme.accent : theme.surfaceMuted,
                        color: active ? theme.accentText : theme.text,
                        borderColor: active ? theme.accent : theme.border,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 03: DEBTS LEDGER LIST (PRESERVING SWIPE-TO-EDIT/DELETE) */}
        <section
          className="border text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="px-4 py-2.5 border-b flex items-center justify-between"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                02
              </span>
              <span>
                {activeTab === 'receivable' ? t('receivable_debt') : t('payable_debt')}
              </span>
            </div>
            <span className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
              {filteredDebts.length} سجل ظاهر · اسحب يساراً للتعديل أو الحذف
            </span>
          </div>

          {filteredDebts.length === 0 ? (
            <div className="py-12 px-4 text-center text-xs font-bold" style={{ color: theme.textMuted }}>
              {searchQuery ? 'لا توجد حسابات مطابقة لبحثك.' : 'لا توجد حسابات مسجلة في هذا التصنيف.'}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: theme.border }}>
              {filteredDebts.map((d) => {
                const isPaid = d.status === 'paid' || d.totalAmount <= 0;
                const historyCount = (d.history?.length || d.payments?.length || 0);
                return (
                  <div
                    key={d.id}
                    className="relative group overflow-hidden"
                    style={{ borderColor: theme.border }}
                  >
                    {/* Hidden Actions Layer (Behind) */}
                    <div className="absolute inset-y-0 right-0 flex items-center pr-1 gap-1 z-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDebt(d);
                          setDebtCustomerName(d.customerName || '');
                          setDebtPhone(d.phone || '');
                          setIsModalOpen(true);
                        }}
                        className="h-[calc(100%-8px)] w-16 bg-edit-bg border border-edit-border flex flex-col items-center justify-center gap-1 text-edit-text cursor-pointer"
                      >
                        <Edit2 size={16} />
                        <span className="text-[10px] font-bold">{t('edit')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmId(d.id!);
                          setDeleteConfirmName(d.customerName || '');
                        }}
                        className="h-[calc(100%-8px)] w-16 bg-delete-bg border border-delete-border flex flex-col items-center justify-center gap-1 text-delete-text cursor-pointer"
                      >
                        <Trash2 size={16} />
                        <span className="text-[10px] font-bold">{t('delete')}</span>
                      </button>
                    </div>

                    {/* Swipable Front Layer */}
                    <motion.div
                      drag="x"
                      dragConstraints={{ left: -140, right: 0 }}
                      dragElastic={0.1}
                      onClick={() => setActiveDebt(d)}
                      className="relative z-10 flex cursor-pointer items-center justify-between gap-3 px-3.5 py-3 transition-colors"
                      style={{
                        backgroundColor: theme.surface,
                        borderRightWidth: '3px',
                        borderRightStyle: 'solid',
                        borderRightColor: isPaid
                          ? theme.border
                          : d.type === 'payable'
                            ? theme.negative
                            : theme.accent,
                      }}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span style={{ color: theme.textMuted }} className="shrink-0">
                            {d.type === 'payable' ? <Truck size={15} /> : <BookOpen size={15} />}
                          </span>
                          <h3
                            className="text-sm sm:text-base font-black truncate"
                            style={{ color: theme.text }}
                          >
                            {d.customerName}
                          </h3>
                        </div>

                        <div
                          className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
                          style={{ color: theme.textMuted }}
                        >
                          <span
                            className="font-bold"
                            style={{
                              color: isPaid
                                ? theme.positive
                                : d.type === 'payable'
                                  ? theme.negative
                                  : theme.accent,
                            }}
                          >
                            {isPaid
                              ? t('paid')
                              : d.type === 'payable'
                                ? t('payable_owed')
                                : t('over_due')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{historyCount} حركة</span>
                          {d.phone && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums" dir="ltr">
                                {d.phone}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-left">
                          <div
                            className="text-sm sm:text-base font-black font-mono tabular-nums"
                            style={{
                              color: isPaid
                                ? theme.textMuted
                                : d.type === 'payable'
                                  ? theme.negative
                                  : theme.text,
                            }}
                          >
                            {formatPrivateValue(d.totalAmount)}
                          </div>
                        </div>

                        {d.phone && (
                          <a
                            href={`tel:${d.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-9 h-9 flex items-center justify-center border transition-colors"
                            style={{
                              backgroundColor: theme.surfaceMuted,
                              borderColor: theme.border,
                              color: theme.text,
                            }}
                            title="اتصال"
                          >
                            <Phone size={15} />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionDebt(d);
                            setActionType('select');
                            setActionAmount('');
                            setActionNote('');
                          }}
                          className="h-9 px-2.5 flex items-center justify-center gap-1.5 border font-bold text-xs transition-colors cursor-pointer"
                          style={{
                            backgroundColor: theme.surfaceMuted,
                            borderColor: theme.border,
                            color: theme.accent,
                          }}
                          title={t('select_operation')}
                        >
                          <ArrowRightLeft size={15} />
                          <span className="hidden sm:inline">حركة</span>
                        </button>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Add/Edit Person Modal (Folio Styled) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xs"
            />
            <motion.div
              key={editingDebt?.id || 'new'}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-md border p-5 sm:p-6 text-right shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
              dir="rtl"
            >
              <div
                className="flex items-center justify-between pb-3 mb-4 border-b"
                style={{ borderColor: theme.border }}
              >
                <h2 className="text-lg font-black">
                  {editingDebt ? t('edit_debt_data') : t('add_new_debt')}
                </h2>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1.5 border cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {!editingDebt && (
                  <div className="grid grid-cols-2 border" style={{ borderColor: theme.border }}>
                    <button
                      type="button"
                      onClick={() => setDebtType('receivable')}
                      className="py-2.5 text-xs font-bold transition-colors cursor-pointer"
                      style={{
                        backgroundColor: debtType === 'receivable' ? theme.accent : theme.surfaceMuted,
                        color: debtType === 'receivable' ? theme.accentText : theme.text,
                      }}
                    >
                      {t('receivable_debt')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDebtType('payable')}
                      className="py-2.5 text-xs font-bold border-r transition-colors cursor-pointer"
                      style={{
                        borderColor: theme.border,
                        backgroundColor: debtType === 'payable' ? theme.negative : theme.surfaceMuted,
                        color: debtType === 'payable' ? '#FFFFFF' : theme.text,
                      }}
                    >
                      {t('payable_debt')}
                    </button>
                  </div>
                )}

                <input
                  type="search"
                  list={debtType === 'payable' ? 'suppliers-list' : undefined}
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-protonpass-ignore="true"
                  data-form-type="other"
                  placeholder={
                    editingDebt
                      ? t('customer_name_placeholder')
                      : debtType === 'payable'
                        ? t('supplier_name_or_person')
                        : t('customer_name_placeholder')
                  }
                  value={debtCustomerName}
                  onChange={(e) => setDebtCustomerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveDebt(e);
                  }}
                  required
                  className="w-full border p-3 text-right outline-none font-bold text-sm"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                />

                {debtType === 'payable' && !editingDebt && (
                  <datalist id="suppliers-list">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                )}

                <input
                  type="search"
                  inputMode="numeric"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-protonpass-ignore="true"
                  data-form-type="other"
                  placeholder={t('phone_optional_placeholder')}
                  value={debtPhone}
                  onChange={(e) => setDebtPhone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveDebt(e);
                  }}
                  className="w-full border p-3 outline-none font-mono text-sm text-left"
                  style={{
                    direction: 'ltr',
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                />

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveDebt()}
                    disabled={isSaving || !debtCustomerName.trim()}
                    className="flex-1 py-2.5 text-xs font-black border disabled:opacity-50 cursor-pointer"
                    style={{
                      backgroundColor: theme.text,
                      color: theme.surface,
                      borderColor: theme.text,
                    }}
                  >
                    {isSaving ? t('saving') : editingDebt ? t('update') : t('add')}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-2.5 text-xs font-bold border cursor-pointer"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Action Selection / Amount Input Modal (Folio Styled) */}
      <AnimatePresence>
        {actionDebt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:items-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionDebt(null)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              className="relative w-full max-w-md border p-5 sm:p-6 text-right shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
              dir="rtl"
            >
              <div
                className="flex items-center justify-between pb-3 mb-4 border-b"
                style={{ borderColor: theme.border }}
              >
                <div>
                  <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                    {actionDebt.customerName}
                  </div>
                  <h2 className="text-lg font-black">
                    {actionType === 'select'
                      ? t('select_operation')
                      : actionType === 'debt'
                        ? t('record_new_debt')
                        : t('record_payment')}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActionDebt(null)}
                  className="p-1.5 border cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {actionType === 'select' && (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setActionType('payment')}
                    className="w-full flex items-center justify-between p-4 border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.positive,
                    }}
                  >
                    <span className="font-black text-sm">{t('record_payment')}</span>
                    <Plus size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('debt')}
                    className="w-full flex items-center justify-between p-4 border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.negative,
                    }}
                  >
                    <span className="font-black text-sm">{t('record_new_debt')}</span>
                    <Minus size={18} />
                  </button>
                </div>
              )}

              {(actionType === 'debt' || actionType === 'payment') && (
                <div className="space-y-4">
                  <div>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-protonpass-ignore="true"
                      data-form-type="other"
                      value={actionAmount}
                      onChange={(e) => setActionAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitActionModal();
                      }}
                      placeholder={t('enter_amount_placeholder')}
                      autoFocus
                      required
                      className="w-full border p-3.5 text-right text-2xl font-black font-mono tabular-nums outline-none"
                      style={{
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                        color: actionType === 'payment' ? theme.positive : theme.negative,
                      }}
                    />
                    {actionType === 'payment' && actionDebt && actionDebt.totalAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setActionAmount(actionDebt.totalAmount.toString())}
                        className="mt-2 text-xs font-bold hover:underline cursor-pointer"
                        style={{ color: theme.accent }}
                      >
                        {t('settle_full_amount', 'تسديد كامل الدين')} (
                        {formatPrivateValue(actionDebt.totalAmount)})
                      </button>
                    )}
                  </div>

                  <input
                    type="search"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
                    data-form-type="other"
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitActionModal();
                    }}
                    placeholder={t('note_optional', 'ملاحظة (اختياري)')}
                    className="w-full border p-3 text-right text-sm outline-none"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  />

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={submitActionModal}
                      disabled={!actionAmount || isSaving}
                      className="flex-1 py-2.5 text-xs font-black text-white border disabled:opacity-50 cursor-pointer"
                      style={{
                        backgroundColor:
                          actionType === 'payment' ? theme.accent : theme.negative,
                        borderColor: actionType === 'payment' ? theme.accent : theme.negative,
                      }}
                    >
                      {t('confirm')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionType('select')}
                      className="flex-1 py-2.5 text-xs font-bold border cursor-pointer"
                      style={{
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Debt Details / Operations Log Modal (Folio Styled) */}
      <AnimatePresence>
        {activeDebt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDebt(null)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              className="relative w-full max-w-xl border p-5 sm:p-6 max-h-[82vh] overflow-y-auto text-right shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
              dir="rtl"
            >
              <div
                className="flex items-center justify-between pb-3 mb-4 border-b"
                style={{ borderColor: theme.border }}
              >
                <div>
                  <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                    {t('operations_log')}
                  </div>
                  <h2 className="text-lg sm:text-xl font-black">{activeDebt.customerName}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDebt(null)}
                  className="p-1.5 border cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {(() => {
                const displayHistory =
                  activeDebt.history ||
                  (activeDebt.payments || []).map((p) => ({
                    type: 'payment' as const,
                    amount: p.amount,
                    date: p.date,
                    note: p.note,
                  }));
                const sortedHistory = [...displayHistory].sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
                );

                if (sortedHistory.length === 0) {
                  return (
                    <p
                      className="text-center text-xs font-bold py-10"
                      style={{ color: theme.textMuted }}
                    >
                      {t('no_expenses_waiting')}
                    </p>
                  );
                }

                return (
                  <div className="border divide-y" style={{ borderColor: theme.border }}>
                    {sortedHistory.map((item, i) => (
                      <div
                        key={i}
                        className="p-3.5 flex items-start justify-between gap-3"
                        style={{ borderColor: theme.border }}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className="p-1.5 border mt-0.5 shrink-0"
                            style={{
                              backgroundColor: theme.bg,
                              borderColor: theme.border,
                              color: item.type === 'payment' ? theme.positive : theme.negative,
                            }}
                          >
                            {item.type === 'payment' ? <Plus size={14} /> : <Minus size={14} />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold" style={{ color: theme.text }}>
                              {item.type === 'payment' ? t('payment_type') : t('debt_type')}
                            </div>
                            <div
                              className="text-[11px] font-mono tabular-nums"
                              style={{ color: theme.textMuted }}
                            >
                              {formatAppDate(safeParseDate(item.date), language, t)}
                            </div>
                            {item.note && (
                              <p
                                className="text-xs mt-1 break-words"
                                style={{ color: theme.textMuted }}
                              >
                                {item.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          className="text-sm font-black font-mono tabular-nums shrink-0"
                          style={{
                            color: item.type === 'payment' ? theme.positive : theme.negative,
                          }}
                        >
                          {item.type === 'payment' ? '+' : '-'}
                          {formatPrivateValue(item.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal (Folio Styled) */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-xs border p-5 text-center shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
              dir="rtl"
            >
              <p className="text-xs font-bold mb-5 leading-relaxed">
                {t('confirm_delete_debt_desc')}{' '}
                <span className="font-black" style={{ color: theme.negative }}>
                  "{deleteConfirmName}"
                </span>{' '}
                {language === 'ar' ? '؟' : '?'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDeleteDebt}
                  disabled={isSaving}
                  className="flex-1 py-2 text-xs font-black text-white border disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: theme.negative,
                    borderColor: theme.negative,
                  }}
                >
                  {t('confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2 text-xs font-bold border cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
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

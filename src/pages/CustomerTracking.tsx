import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  getDoc,
  deleteField,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Check,
  Search,
  Plus,
  X,
  Trash2,
  Lock,
  Unlock,
} from 'lucide-react';
import { formatCurrency, handleFirestoreError } from '../lib/utils';
import { useFolioTheme } from '../components/folio/FolioPageChrome';

export interface LedgerCustomer {
  id: string;
  name: string;
}

export interface MonthlyRecord {
  account: number;
  payment: number;
}

export interface MonthlyData {
  status: 'open' | 'closed';
  records: Record<string, MonthlyRecord>;
}

const CustomerRow = ({
  customer,
  record,
  isClosed,
  showDeleteMode,
  deletingCustomerId,
  setDeletingCustomerId,
  onUpdateName,
  onUpdateRecord,
  onDelete,
  settings,
  theme,
}: {
  customer: LedgerCustomer;
  record: MonthlyRecord;
  isClosed: boolean;
  showDeleteMode: boolean;
  deletingCustomerId: string | null;
  setDeletingCustomerId: (id: string | null) => void;
  onUpdateName: (id: string, name: string) => void;
  onUpdateRecord: (id: string, field: 'account' | 'payment', val: number) => void;
  onDelete: (id: string) => void;
  settings: any;
  theme: any;
}) => {
  const [nameVal, setNameVal] = useState(customer.name);
  const [accountVal, setAccountVal] = useState(record.account ? record.account.toString() : '');
  const [paymentVal, setPaymentVal] = useState(record.payment ? record.payment.toString() : '');

  useEffect(() => {
    setNameVal(customer.name);
  }, [customer.name]);

  useEffect(() => {
    setAccountVal(record.account ? record.account.toString() : '');
    setPaymentVal(record.payment ? record.payment.toString() : '');
  }, [record.account, record.payment]);

  const handleNameBlur = () => {
    if (nameVal.trim() !== customer.name && nameVal.trim() !== '') {
      onUpdateName(customer.id, nameVal.trim());
    } else {
      setNameVal(customer.name);
    }
  };

  const handleAccountBlur = () => {
    const num = parseFloat(accountVal) || 0;
    if (num !== record.account) {
      onUpdateRecord(customer.id, 'account', num);
    }
    setAccountVal(num > 0 ? num.toString() : '');
  };

  const handlePaymentBlur = () => {
    const num = parseFloat(paymentVal) || 0;
    if (num !== record.payment) {
      onUpdateRecord(customer.id, 'payment', num);
    }
    setPaymentVal(num > 0 ? num.toString() : '');
  };

  const difference = (record.account || 0) - (record.payment || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="border px-2.5 sm:px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-3.5 transition-colors"
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
        opacity: isClosed ? 0.85 : 1,
      }}
    >
      <div className="flex items-center justify-between sm:w-1/4">
        <div className="flex items-center gap-2.5 w-full">
          {showDeleteMode && !isClosed ? (
            <div className="shrink-0 flex items-center">
              {deletingCustomerId === customer.id ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(customer.id);
                  }}
                  className="px-2 py-1 border font-bold text-xs flex items-center gap-1 cursor-pointer"
                  style={{
                    borderColor: theme.negative,
                    backgroundColor: theme.negative,
                    color: '#FFFFFF',
                  }}
                >
                  <Check size={14} />
                  <span>تأكيد</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingCustomerId(customer.id);
                  }}
                  className="p-2 border transition-colors shrink-0 cursor-pointer"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceMuted,
                    color: theme.negative,
                  }}
                  title="حذف"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ) : (
            <div
              className="p-2 border shrink-0"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.accent,
              }}
            >
              <UserCheck size={16} />
            </div>
          )}
          <input
            type="text"
            name="customer_name_track"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={handleNameBlur}
            disabled={isClosed}
            className="w-full bg-transparent border-none text-sm sm:text-base font-semibold outline-none p-0 focus:ring-0 disabled:opacity-100"
            style={{ color: theme.text }}
            placeholder="اسم الحريف"
          />
        </div>
      </div>

      <div
        className="grid grid-cols-3 gap-2.5 sm:w-3/4 sm:pr-4 sm:border-r"
        style={{ borderColor: theme.border }}
      >
        <div
          className="p-2.5 border"
          style={{ backgroundColor: theme.bg, borderColor: theme.border }}
        >
          <span className="block text-[10px] font-bold mb-1" style={{ color: theme.textMuted }}>
            الحساب
          </span>
          <input
            type="number"
            step="0.001"
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            value={accountVal}
            onChange={(e) => setAccountVal(e.target.value)}
            onBlur={handleAccountBlur}
            disabled={isClosed}
            className="w-full bg-transparent border-none text-sm sm:text-base font-mono font-black outline-none p-0 focus:ring-0 disabled:opacity-100"
            style={{ color: theme.text }}
            placeholder="0.000"
            dir="ltr"
          />
        </div>

        <div
          className="p-2.5 border"
          style={{ backgroundColor: theme.bg, borderColor: theme.border }}
        >
          <span className="block text-[10px] font-bold mb-1" style={{ color: theme.textMuted }}>
            الدفع
          </span>
          <input
            type="number"
            step="0.001"
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            value={paymentVal}
            onChange={(e) => setPaymentVal(e.target.value)}
            onBlur={handlePaymentBlur}
            disabled={isClosed}
            className="w-full bg-transparent border-none text-sm sm:text-base font-mono font-black outline-none p-0 focus:ring-0 disabled:opacity-100"
            style={{ color: theme.positive }}
            placeholder="0.000"
            dir="ltr"
          />
        </div>

        <div
          className="p-2.5 border"
          style={{
            backgroundColor: theme.surfaceMuted,
            borderColor: theme.border,
          }}
        >
          <span className="block text-[10px] font-bold mb-1" style={{ color: theme.textMuted }}>
            الفرق
          </span>
          <div
            className="w-full text-sm sm:text-base font-mono font-black tabular-nums truncate h-6 flex items-center"
            style={{
              color:
                difference > 0
                  ? theme.negative
                  : difference < 0
                  ? theme.positive
                  : theme.textMuted,
            }}
            dir="ltr"
          >
            {formatCurrency(difference, settings.currency, settings.language)}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function CustomerTracking() {
  const { user, settings, showToast } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

  const cycleStartDay = settings.cycleStartDay || 18;
  const cycleEndDay = settings.cycleEndDay || 18;
  const [customers, setCustomers] = useState<LedgerCustomer[]>([]);
  const [monthData, setMonthData] = useState<MonthlyData>({ status: 'open', records: {} });

  const getInitialCycleDate = () => {
    const now = new Date();
    if (now.getDate() < cycleStartDay) {
      return new Date(now.getFullYear(), now.getMonth() - 1, cycleStartDay);
    }
    return new Date(now.getFullYear(), now.getMonth(), cycleStartDay);
  };

  const [currentDate, setCurrentDate] = useState(getInitialCycleDate);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'remaining' | 'fully_paid'>('all');

  const [showDeleteMode, setShowDeleteMode] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; isClosing: boolean }>({
    isOpen: false,
    isClosing: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingMonth, setIsLoadingMonth] = useState(true);

  useEffect(() => {
    const migrateOldData = async () => {
      if (!user) return;
      try {
        const monthsSnap = await getDocs(collection(db, `users/${user.uid}/monthly_ledgers`));
        for (const monthDoc of monthsSnap.docs) {
          const data = monthDoc.data();
          if (data.customers && Array.isArray(data.customers) && !data.records) {
            const newRecords: Record<string, MonthlyRecord> = {};
            for (const cust of data.customers) {
              const custId = cust.id;
              const custRef = doc(db, `users/${user.uid}/ledger_customers`, custId);
              const custSnap = await getDoc(custRef);
              if (!custSnap.exists()) {
                await setDoc(custRef, { name: cust.name, createdAt: serverTimestamp() });
              }
              newRecords[custId] = { account: cust.account || 0, payment: cust.payment || 0 };
            }
            await updateDoc(monthDoc.ref, {
              records: newRecords,
              customers: deleteField(),
            });
          }
        }
      } catch (err) {
        console.error('Migration error:', err);
      }
    };
    migrateOldData();
  }, [user]);

  const monthNames = [
    'جانفي',
    'فيفري',
    'مارس',
    'أفريل',
    'ماي',
    'جوان',
    'جويلية',
    'أوت',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ];

  const startYear = currentDate.getFullYear();
  const startMonthIndex = currentDate.getMonth();
  const endMonthIndex = (startMonthIndex + 1) % 12;
  const endYear = startMonthIndex === 11 ? startYear + 1 : startYear;

  const currentMonthKey = `${startYear}-${String(startMonthIndex + 1).padStart(2, '0')}`;

  const startMonthName = monthNames[startMonthIndex];
  const endMonthName = monthNames[endMonthIndex];

  const formattedCycleRange =
    startYear === endYear
      ? `${cycleStartDay} ${startMonthName} - ${cycleEndDay} ${endMonthName} ${startYear}`
      : `${cycleStartDay} ${startMonthName} ${startYear} - ${cycleEndDay} ${endMonthName} ${endYear}`;

  useEffect(() => {
    if (!user) return;
    setIsLoadingCustomers(true);
    const unsub = onSnapshot(
      collection(db, `users/${user.uid}/ledger_customers`),
      (snap) => {
        const fetched = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as LedgerCustomer));
        fetched.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        setCustomers(fetched);
        setIsLoadingCustomers(false);
      },
      (error) => {
        console.error('Error fetching ledger customers:', error);
        setIsLoadingCustomers(false);
      },
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setIsLoadingMonth(true);
    const unsub = onSnapshot(
      doc(db, `users/${user.uid}/monthly_ledgers`, currentMonthKey),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as MonthlyData;
          setMonthData({
            status: data.status || 'open',
            records: data.records || {},
          });
        } else {
          setMonthData({ status: 'open', records: {} });
        }
        setIsLoadingMonth(false);
      },
      (error) => {
        console.error('Error fetching ledger month:', error);
        setIsLoadingMonth(false);
      },
    );
    return () => unsub();
  }, [user, currentMonthKey]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSaving || !newCustomerName.trim()) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, `users/${user.uid}/ledger_customers`), {
        name: newCustomerName.trim(),
        createdAt: serverTimestamp(),
      });
      showToast('تمت إضافة الحريف بنجاح');
      setIsModalOpen(false);
      setNewCustomerName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/ledger_customers`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateName = async (id: string, name: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/ledger_customers`, id), { name });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/ledger_customers`, id));
      const monthRef = doc(db, `users/${user.uid}/monthly_ledgers`, currentMonthKey);
      await updateDoc(monthRef, {
        [`records.${id}`]: deleteField(),
      }).catch(() => {});
      showToast('تم حذف الحريف');
      setDeletingCustomerId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateRecord = async (customerId: string, field: 'account' | 'payment', val: number) => {
    if (!user || monthData.status === 'closed') return;

    const currentRecord = monthData.records[customerId] || { account: 0, payment: 0 };
    const newRecord = { ...currentRecord, [field]: val };

    if (newRecord.account === 0 && newRecord.payment === 0) {
      const newRecords = { ...monthData.records };
      delete newRecords[customerId];

      await setDoc(doc(db, `users/${user.uid}/monthly_ledgers`, currentMonthKey), {
        status: monthData.status,
        records: newRecords,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        doc(db, `users/${user.uid}/monthly_ledgers`, currentMonthKey),
        {
          status: monthData.status,
          records: {
            ...monthData.records,
            [customerId]: newRecord,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
  };

  const handleToggleStatus = () => {
    const isClosing = monthData.status === 'open';
    setConfirmModal({ isOpen: true, isClosing });
  };

  const confirmToggleStatus = async () => {
    if (!user) return;
    const newStatus = confirmModal.isClosing ? 'closed' : 'open';

    await setDoc(
      doc(db, `users/${user.uid}/monthly_ledgers`, currentMonthKey),
      {
        status: newStatus,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    showToast(confirmModal.isClosing ? 'تم إغلاق الدورة المالية بنجاح' : 'تم إعادة فتح الدورة المالية');
    setConfirmModal({ isOpen: false, isClosing: false });

    if (confirmModal.isClosing) {
      nextMonth();
    }
  };

  const filterCounts = useMemo(() => {
    let unpaid = 0;
    let remaining = 0;
    let fullyPaid = 0;

    customers.forEach((c) => {
      const rec = monthData.records[c.id] || { account: 0, payment: 0 };
      const account = rec.account || 0;
      const payment = rec.payment || 0;
      const diff = account - payment;

      if (payment === 0) unpaid++;
      if (diff > 0) remaining++;
      if (account > 0 && payment >= account) fullyPaid++;
    });

    return {
      all: customers.length,
      unpaid,
      remaining,
      fullyPaid,
    };
  }, [customers, monthData.records]);

  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (searchQuery.trim()) {
      result = result.filter((c) =>
        (c.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()),
      );
    }
    if (filterStatus !== 'all') {
      result = result.filter((c) => {
        const rec = monthData.records[c.id] || { account: 0, payment: 0 };
        const account = rec.account || 0;
        const payment = rec.payment || 0;
        const diff = account - payment;

        if (filterStatus === 'unpaid') return payment === 0;
        if (filterStatus === 'remaining') return diff > 0;
        if (filterStatus === 'fully_paid') return account > 0 && payment >= account;
        return true;
      });
    }
    return result;
  }, [customers, searchQuery, filterStatus, monthData.records]);

  let totalAccount = 0;
  let totalPayment = 0;
  let activeCustomersCount = 0;

  customers.forEach((customer) => {
    const record = monthData.records[customer.id];
    if (record && (record.account > 0 || record.payment > 0)) {
      totalAccount += record.account || 0;
      totalPayment += record.payment || 0;
      activeCustomersCount++;
    }
  });

  const totalDifference = totalAccount - totalPayment;

  const prevMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, cycleStartDay));
  const nextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, cycleStartDay));

  const isClosed = monthData.status === 'closed';
  const isLoading = isLoadingCustomers || isLoadingMonth;

  return (
    <div className="-mx-2.5 sm:mx-0 max-w-7xl mx-auto space-y-4 pb-24 pt-1" style={{ color: theme.text }}>
      {/* Editorial Header */}
      <header
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b"
        style={{ borderColor: theme.border }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
              01
            </span>
            <span style={{ color: theme.textMuted }}>
              الدفتر · الدورات المالية
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">حساب الحرفاء</h1>
          <p className="text-xs sm:text-sm" style={{ color: theme.textMuted }}>
            دفتر إلكتروني لتسجيل حسابات الحرفاء بنظام الدورات المالية (من {cycleStartDay} إلى {cycleEndDay})
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isClosed && customers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowDeleteMode(!showDeleteMode);
                setDeletingCustomerId(null);
              }}
              className="p-2.5 border transition-colors cursor-pointer"
              style={{
                backgroundColor: showDeleteMode ? theme.negative : theme.surface,
                borderColor: showDeleteMode ? theme.negative : theme.border,
                color: showDeleteMode ? '#FFFFFF' : theme.textMuted,
              }}
              title="وضع الحذف"
            >
              <Trash2 size={18} />
            </button>
          )}

          {customers.length > 0 && (
            <button
              type="button"
              onClick={handleToggleStatus}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 border text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              {isClosed ? <Unlock size={16} /> : <Lock size={16} />}
              <span>{isClosed ? 'إعادة فتح الدورة' : 'إغلاق الدورة'}</span>
            </button>
          )}

          {!isClosed && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold text-white cursor-pointer"
              style={{ backgroundColor: theme.accent }}
            >
              <Plus size={16} />
              <span>إضافة حريف</span>
            </button>
          )}
        </div>
      </header>

      {/* Cycle Navigator */}
      <div
        className="border p-4 flex items-center justify-between"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <button
          type="button"
          onClick={prevMonth}
          className="p-3 border transition-colors cursor-pointer"
          style={{
            backgroundColor: theme.surfaceMuted,
            borderColor: theme.border,
            color: theme.text,
          }}
          title="الدورة السابقة"
        >
          <ChevronRight size={20} />
        </button>

        <div className="text-center space-y-1">
          <span
            className="text-[11px] font-bold uppercase tracking-wider block"
            style={{ color: theme.textMuted }}
          >
            الدورة المالية المحددة
          </span>
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <span className="text-lg sm:text-2xl font-black" style={{ color: theme.accent }}>
              {formattedCycleRange}
            </span>
            {isClosed && (
              <span
                className="px-2 py-0.5 border text-[11px] font-bold flex items-center gap-1"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.textMuted,
                }}
              >
                <Lock size={12} />
                <span>مغلقة</span>
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={nextMonth}
          className="p-3 border transition-colors cursor-pointer"
          style={{
            backgroundColor: theme.surfaceMuted,
            borderColor: theme.border,
            color: theme.text,
          }}
          title="الدورة التالية"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* 4-Cell Editorial Summary */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 border divide-y md:divide-y-0 divide-x divide-x-reverse"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
          <span className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>
            إجمالي الحساب
          </span>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums" dir="ltr">
            {formatCurrency(totalAccount, settings.currency, settings.language)}
          </div>
        </div>

        <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
          <span className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>
            إجمالي الدفع
          </span>
          <div
            className="text-lg sm:text-xl font-black font-mono tabular-nums"
            dir="ltr"
            style={{ color: theme.positive }}
          >
            {formatCurrency(totalPayment, settings.currency, settings.language)}
          </div>
        </div>

        <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
          <span className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>
            إجمالي الفرق
          </span>
          <div
            className="text-lg sm:text-xl font-black font-mono tabular-nums"
            dir="ltr"
            style={{ color: totalDifference > 0 ? theme.negative : theme.text }}
          >
            {formatCurrency(totalDifference, settings.currency, settings.language)}
          </div>
        </div>

        <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
          <span className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>
            حرفاء هذه الدورة
          </span>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums">
            {activeCustomersCount}
          </div>
        </div>
      </div>

      {/* Search & Filter Strip */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch">
        <div className="relative flex-1">
          <Search
            className="absolute right-3.5 top-1/2 -translate-y-1/2"
            size={17}
            style={{ color: theme.textMuted }}
          />
          <input
            type="search"
            name="customer_search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن اسم الحريف..."
            className="w-full h-11 border pr-10 pl-4 text-sm text-right outline-none"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text,
            }}
          />
        </div>

        <div
          className="flex items-center gap-1.5 overflow-x-auto p-1 border scrollbar-none shrink-0"
          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
        >
          {[
            { id: 'all', label: 'الكل', count: filterCounts.all, accent: theme.text },
            { id: 'remaining', label: 'متبقي عليهم دين', count: filterCounts.remaining, accent: theme.accent },
            { id: 'unpaid', label: 'لم يدفعوا', count: filterCounts.unpaid, accent: theme.negative },
            { id: 'fully_paid', label: 'دفعوا بالكامل', count: filterCounts.fullyPaid, accent: theme.positive },
          ].map((tab) => {
            const active = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id as any)}
                className="px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 border cursor-pointer"
                style={{
                  backgroundColor: active ? theme.text : theme.surface,
                  borderColor: active ? theme.text : theme.border,
                  color: active ? theme.surface : theme.text,
                }}
              >
                <span>{tab.label}</span>
                <span
                  className="font-mono tabular-nums text-[11px]"
                  style={{ color: active ? theme.surface : tab.accent }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Customer Rows */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <div
            className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent"
            style={{ borderColor: theme.accent, borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.length === 0 ? (
            <div
              className="text-center py-14 border"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <Users className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <h3 className="text-base font-black mb-1">الدفتر فارغ</h3>
              <p className="text-xs max-w-md mx-auto mb-5" style={{ color: theme.textMuted }}>
                لم تقم بإضافة أي حرفاء إلى الدفتر حتى الآن.
              </p>
              {!isClosed && (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 text-white px-5 py-2.5 text-xs font-bold cursor-pointer"
                  style={{ backgroundColor: theme.accent }}
                >
                  <Plus size={16} />
                  <span>إضافة أول حريف</span>
                </button>
              )}
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <CustomerRow
                key={customer.id}
                customer={customer}
                record={monthData.records[customer.id] || { account: 0, payment: 0 }}
                isClosed={isClosed}
                showDeleteMode={showDeleteMode}
                deletingCustomerId={deletingCustomerId}
                setDeletingCustomerId={setDeletingCustomerId}
                onUpdateName={handleUpdateName}
                onUpdateRecord={handleUpdateRecord}
                onDelete={handleDeleteCustomer}
                settings={settings}
                theme={theme}
              />
            ))
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal({ isOpen: false, isClosing: false })}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-sm border p-6 text-center shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <div
                className="w-12 h-12 mx-auto mb-4 flex items-center justify-center border"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.accent }}
              >
                {confirmModal.isClosing ? <Lock size={22} /> : <Unlock size={22} />}
              </div>
              <h3 className="text-lg font-black mb-2">
                {confirmModal.isClosing ? 'إغلاق الدورة المالية' : 'إعادة فتح الدورة المالية'}
              </h3>
              <p className="text-xs mb-6 leading-relaxed" style={{ color: theme.textMuted }}>
                {confirmModal.isClosing
                  ? `هل أنت متأكد من إغلاق الدورة المالية (${formattedCycleRange})؟ ستبدأ بعدها الدورة الجديدة تلقائياً.`
                  : `هل أنت متأكد من إعادة فتح الدورة المالية (${formattedCycleRange})؟`}
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: false, isClosing: false })}
                  className="flex-1 px-4 py-2.5 border text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmToggleStatus}
                  className="flex-1 px-4 py-2.5 text-white text-xs font-bold cursor-pointer"
                  style={{ backgroundColor: theme.accent }}
                >
                  تأكيد
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-md border overflow-hidden shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <div
                className="flex items-center justify-between p-4 border-b"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
              >
                <h3 className="text-base font-black">إضافة حريف للدفتر</h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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

              <form
                onSubmit={handleAddCustomer}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                className="p-5 space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: theme.textMuted }}>
                    اسم الحريف
                  </label>
                  <input
                    type="text"
                    name="new_customer_name"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full border px-3.5 py-3 text-base font-bold outline-none"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                    placeholder="مثال: أحمد"
                    autoFocus
                  />
                </div>

                <div className="pt-2 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 border text-xs font-bold cursor-pointer"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !newCustomerName.trim()}
                    className="flex-1 px-4 py-3 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                    style={{ backgroundColor: theme.accent }}
                  >
                    {isSaving ? 'جاري الإضافة...' : 'إضافة'}
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

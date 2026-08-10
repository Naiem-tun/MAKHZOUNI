import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, getDoc, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, ChevronLeft, ChevronRight, UserCheck, Check, 
  Search, Plus, X, Trash2, Wallet, FileText, 
  Lock, Unlock, Calculator, Receipt, Filter
} from 'lucide-react';
import { formatCurrency, cn, handleFirestoreError } from '../lib/utils';
import { logAudit } from '../lib/auditLogger';

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
  settings 
}: { 
  customer: LedgerCustomer,
  record: MonthlyRecord,
  isClosed: boolean,
  showDeleteMode: boolean,
  deletingCustomerId: string | null,
  setDeletingCustomerId: (id: string | null) => void,
  onUpdateName: (id: string, name: string) => void,
  onUpdateRecord: (id: string, field: 'account' | 'payment', val: number) => void, 
  onDelete: (id: string) => void,
  settings: any
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white dark:bg-zinc-900 rounded-2xl p-4 border shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 transition-colors",
        isClosed ? "border-zinc-100 dark:border-zinc-800 opacity-80" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 group"
      )}
    >
      <div className="flex items-center justify-between sm:w-1/4">
        <div className="flex items-center gap-3 w-full">
          {showDeleteMode && !isClosed ? (
            <div className="shrink-0 flex items-center">
              {deletingCustomerId === customer.id ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(customer.id);
                  }}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-bold text-xs flex items-center gap-1"
                >
                  <Check size={16} />
                  <span>تأكيد</span>
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingCustomerId(customer.id);
                  }}
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                  title="حذف"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
              <UserCheck size={18} />
            </div>
          )}
          <input 
            type="text"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={handleNameBlur}
            disabled={isClosed}
            className="w-full bg-transparent border-none text-lg font-bold text-zinc-900 dark:text-white outline-none p-0 focus:ring-0 disabled:opacity-100"
            placeholder="اسم الحريف"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:w-3/4 sm:pr-4 sm:border-r border-zinc-100 dark:border-zinc-800">
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-700">
          <span className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">الحساب</span>
          <input 
             type="number"
             value={accountVal}
             onChange={(e) => setAccountVal(e.target.value)}
             onBlur={handleAccountBlur}
             disabled={isClosed}
             className="w-full bg-transparent border-none text-lg font-black text-zinc-800 dark:text-zinc-200 outline-none p-0 focus:ring-0 disabled:opacity-100"
             placeholder="0.000"
             dir="ltr"
          />
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-700">
          <span className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">الدفع</span>
          <input 
             type="number"
             value={paymentVal}
             onChange={(e) => setPaymentVal(e.target.value)}
             onBlur={handlePaymentBlur}
             disabled={isClosed}
             className="w-full bg-transparent border-none text-lg font-black text-zinc-800 dark:text-zinc-200 outline-none p-0 focus:ring-0 disabled:opacity-100"
             placeholder="0.000"
             dir="ltr"
          />
        </div>

        <div className={cn(
          "rounded-xl p-3 border",
          difference !== 0 
            ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600" 
            : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-700"
        )}>
          <span className="block text-[11px] font-bold mb-1 text-zinc-500 dark:text-zinc-400">الفرق</span>
          <div className={cn(
            "w-full text-lg font-black truncate h-7 flex items-center",
            difference !== 0 
              ? "text-zinc-900 dark:text-white" 
              : "text-zinc-400 dark:text-zinc-500"
          )} dir="ltr">
            {formatCurrency(difference, settings.currency, settings.language)}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function CustomerTracking() {
  const { user, settings, showToast } = useAppContext();
  const cycleStartDay = settings.cycleStartDay || 18;
  const cycleEndDay = settings.cycleEndDay || 18;
  const [customers, setCustomers] = useState<LedgerCustomer[]>([]);
  const [monthData, setMonthData] = useState<MonthlyData>({ status: 'open', records: {} });
  
  // Helper to determine initial cycle base date
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
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, isClosing: boolean}>({isOpen: false, isClosing: false});
  const [isSaving, setIsSaving] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingMonth, setIsLoadingMonth] = useState(true);

  // Migration for old data structure
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
               customers: deleteField()
             });
          }
        }
      } catch (err) {
        console.error("Migration error:", err);
      }
    };
    migrateOldData();
  }, [user]);

  const monthNames = [
    'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
    'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  
  const startYear = currentDate.getFullYear();
  const startMonthIndex = currentDate.getMonth();
  const endMonthIndex = (startMonthIndex + 1) % 12;
  const endYear = startMonthIndex === 11 ? startYear + 1 : startYear;

  const currentMonthKey = `${startYear}-${String(startMonthIndex + 1).padStart(2, '0')}`;
  
  const startMonthName = monthNames[startMonthIndex];
  const endMonthName = monthNames[endMonthIndex];

  const formattedCycleRange = startYear === endYear
    ? `${cycleStartDay} ${startMonthName} - ${cycleEndDay} ${endMonthName} ${startYear}`
    : `${cycleStartDay} ${startMonthName} ${startYear} - ${cycleEndDay} ${endMonthName} ${endYear}`;
  
  // Load Customers
  useEffect(() => {
    if (!user) return;
    setIsLoadingCustomers(true);
    const unsub = onSnapshot(collection(db, `users/${user.uid}/ledger_customers`), (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerCustomer));
      // Sort alphabetically
      fetched.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      setCustomers(fetched);
      setIsLoadingCustomers(false);
    }, (error) => {
      console.error("Error fetching ledger customers:", error);
      setIsLoadingCustomers(false);
    });
    return () => unsub();
  }, [user]);

  // Load Month Data
  useEffect(() => {
    if (!user) return;
    setIsLoadingMonth(true);
    const unsub = onSnapshot(doc(db, `users/${user.uid}/monthly_ledgers`, currentMonthKey), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as MonthlyData;
        setMonthData({
          status: data.status || 'open',
          records: data.records || {}
        });
      } else {
        setMonthData({ status: 'open', records: {} });
      }
      setIsLoadingMonth(false);
    }, (error) => {
      console.error("Error fetching ledger month:", error);
      setIsLoadingMonth(false);
    });
    return () => unsub();
  }, [user, currentMonthKey]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSaving || !newCustomerName.trim()) return;
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, `users/${user.uid}/ledger_customers`), {
        name: newCustomerName.trim(),
        createdAt: serverTimestamp()
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
      // Remove record from current month's ledger doc as well
      const monthRef = doc(db, `users/${user.uid}/monthly_ledgers`, currentMonthKey);
      await updateDoc(monthRef, {
        [`records.${id}`]: deleteField()
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
    
    // Cleanup empty records if both 0
    if (newRecord.account === 0 && newRecord.payment === 0) {
      const newRecords = { ...monthData.records };
      delete newRecords[customerId];
      
      await setDoc(doc(db, `users/${user.uid}/monthly_ledgers`, currentMonthKey), {
        status: monthData.status,
        records: newRecords,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(doc(db, `users/${user.uid}/monthly_ledgers`, currentMonthKey), {
        status: monthData.status,
        records: {
          ...monthData.records,
          [customerId]: newRecord
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  };

  const handleToggleStatus = () => {
    const isClosing = monthData.status === 'open';
    setConfirmModal({ isOpen: true, isClosing });
  };

  const confirmToggleStatus = async () => {
    if (!user) return;
    const newStatus = confirmModal.isClosing ? 'closed' : 'open';
    
    await setDoc(doc(db, `users/${user.uid}/monthly_ledgers`, currentMonthKey), {
      status: newStatus,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
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

    customers.forEach(c => {
      const rec = monthData.records[c.id] || { account: 0, payment: 0 };
      const account = rec.account || 0;
      const payment = rec.payment || 0;
      const diff = account - payment;

      if (account > 0 && payment === 0) unpaid++;
      if (diff > 0) remaining++;
      if (account > 0 && payment >= account) fullyPaid++;
    });

    return {
      all: customers.length,
      unpaid,
      remaining,
      fullyPaid
    };
  }, [customers, monthData.records]);

  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (searchQuery.trim()) {
      result = result.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (filterStatus !== 'all') {
      result = result.filter(c => {
        const rec = monthData.records[c.id] || { account: 0, payment: 0 };
        const account = rec.account || 0;
        const payment = rec.payment || 0;
        const diff = account - payment;

        if (filterStatus === 'unpaid') {
          return account > 0 && payment === 0;
        }
        if (filterStatus === 'remaining') {
          return diff > 0;
        }
        if (filterStatus === 'fully_paid') {
          return account > 0 && payment >= account;
        }
        return true;
      });
    }
    return result;
  }, [customers, searchQuery, filterStatus, monthData.records]);

  // Summaries (only count customers that currently exist in the ledger)
  let totalAccount = 0;
  let totalPayment = 0;
  let activeCustomersCount = 0;

  customers.forEach(customer => {
    const record = monthData.records[customer.id];
    if (record && (record.account > 0 || record.payment > 0)) {
      totalAccount += (record.account || 0);
      totalPayment += (record.payment || 0);
      activeCustomersCount++;
    }
  });

  const totalDifference = totalAccount - totalPayment;

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, cycleStartDay));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, cycleStartDay));

  const isClosed = monthData.status === 'closed';
  const isLoading = isLoadingCustomers || isLoadingMonth;

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <FileText className="text-brand-900 dark:text-brand-300" size={32} />
            حساب الحرفاء
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            دفتر إلكتروني لتسجيل حسابات الحرفاء بنظام الدورات المالية (من {cycleStartDay} إلى {cycleEndDay})
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isClosed && customers.length > 0 && (
            <button
              onClick={() => {
                setShowDeleteMode(!showDeleteMode);
                setDeletingCustomerId(null);
              }}
              className={cn(
                "p-3 rounded-2xl transition-colors border shadow-sm",
                showDeleteMode 
                  ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50" 
                  : "bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border-zinc-200 dark:border-zinc-700"
              )}
              title="تعديل الحرفاء"
            >
              <Trash2 size={20} />
            </button>
          )}

          {customers.length > 0 && (
            <button
              onClick={handleToggleStatus}
              className={cn(
                "flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all border",
                isClosed 
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700" 
                  : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              )}
            >
              {isClosed ? <Unlock size={20} /> : <Lock size={20} />}
              {isClosed ? 'إعادة فتح الدورة' : 'إغلاق الدورة'}
            </button>
          )}

          {!isClosed && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 rounded-2xl transition-colors font-bold shadow-lg shadow-brand-500/20"
            >
              <Plus size={20} />
              إضافة حريف
            </button>
          )}
        </div>
      </header>

      {/* Cycle Navigation */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors border border-zinc-200 dark:border-zinc-700" title="الدورة السابقة">
            <ChevronRight size={24} />
          </button>
          <div className="text-center">
            <span className="text-sm font-bold text-zinc-500 uppercase tracking-wider block mb-2">الدورة المالية المحددة</span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl sm:text-3xl font-black text-brand-700 dark:text-brand-400">{formattedCycleRange}</span>
              {isClosed && (
                <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1 border border-zinc-200 dark:border-zinc-700">
                  <Lock size={14} />
                  مغلقة
                </div>
              )}
            </div>
          </div>
          <button onClick={nextMonth} className="p-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors border border-zinc-200 dark:border-zinc-700" title="الدورة التالية">
            <ChevronLeft size={24} />
          </button>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/30 rounded-lg text-brand-900 dark:text-brand-300">
              <FileText size={20} />
            </div>
            <span className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">إجمالي الحساب</span>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white" dir="ltr">
            {formatCurrency(totalAccount, settings.currency, settings.language)}
          </div>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400">
              <Wallet size={20} />
            </div>
            <span className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">إجمالي الدفع</span>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white" dir="ltr">
            {formatCurrency(totalPayment, settings.currency, settings.language)}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400">
              <Calculator size={20} />
            </div>
            <span className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">إجمالي الفرق</span>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white" dir="ltr">
            {formatCurrency(totalDifference, settings.currency, settings.language)}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400">
              <Users size={20} />
            </div>
            <span className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">حرفاء هذه الدورة</span>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white">
            {activeCustomersCount}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 items-stretch">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن اسم الحريف..."
            className="w-full rounded-2xl border border-zinc-200 bg-white dark:bg-zinc-900 p-4 pr-12 text-right outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-zinc-700 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none bg-zinc-100 dark:bg-zinc-800/80 p-1.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 shrink-0">
          <button
            onClick={() => setFilterStatus('all')}
            className={cn(
              "px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-1.5",
              filterStatus === 'all'
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            <span>الكل</span>
            <span className="px-2 py-0.5 rounded-md text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold">
              {filterCounts.all}
            </span>
          </button>

          <button
            onClick={() => setFilterStatus('remaining')}
            className={cn(
              "px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-1.5",
              filterStatus === 'remaining'
                ? "bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400"
            )}
          >
            <span>متبقي عليهم دين</span>
            {filterCounts.remaining > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[11px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold">
                {filterCounts.remaining}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilterStatus('unpaid')}
            className={cn(
              "px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-1.5",
              filterStatus === 'unpaid'
                ? "bg-white dark:bg-zinc-900 text-[#B34C36] dark:text-rose-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-[#B34C36] dark:hover:text-rose-400"
            )}
          >
            <span>لم يدفعوا</span>
            {filterCounts.unpaid > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[11px] bg-[#FCF5F4] dark:bg-rose-950/60 text-[#B34C36] dark:text-rose-300 font-bold border border-[#F8E6E3] dark:border-rose-900/50">
                {filterCounts.unpaid}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilterStatus('fully_paid')}
            className={cn(
              "px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-1.5",
              filterStatus === 'fully_paid'
                ? "bg-white dark:bg-zinc-900 text-[#166534] dark:text-emerald-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-[#166534] dark:hover:text-emerald-400"
            )}
          >
            <span>دفعوا بالكامل</span>
            {filterCounts.fullyPaid > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[11px] bg-emerald-100/80 dark:bg-emerald-950/60 text-[#166534] dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-900/50">
                {filterCounts.fullyPaid}
              </span>
            )}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
              <Users className="mx-auto h-16 w-16 text-zinc-300 dark:text-zinc-700 mb-4" />
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">الدفتر فارغ</h3>
              <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
                لم تقم بإضافة أي حرفاء إلى الدفتر حتى الآن.
              </p>
              {!isClosed && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl transition-colors font-bold shadow-lg shadow-brand-500/20"
                >
                  <Plus size={20} />
                  إضافة أول حريف
                </button>
              )}
            </div>
          ) : (
            filteredCustomers.map(customer => (
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
              />
            ))
          )}
        </div>
      )}

      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal({ isOpen: false, isClosing: false })}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 text-center"
            >
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {confirmModal.isClosing ? <Lock size={32} /> : <Unlock size={32} />}
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                {confirmModal.isClosing ? 'إغلاق الدورة المالية' : 'إعادة فتح الدورة المالية'}
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                {confirmModal.isClosing 
                  ? `هل أنت متأكد من إغلاق الدورة المالية (${formattedCycleRange})؟ ستبدأ بعدها الدورة الجديدة تلقائياً.` 
                  : `هل أنت متأكد من إعادة فتح الدورة المالية (${formattedCycleRange})؟`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal({ isOpen: false, isClosing: false })}
                  className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmToggleStatus}
                  className="flex-1 px-4 py-3 rounded-xl text-white font-bold transition-colors bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-500/20"
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                  إضافة حريف للدفتر
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddCustomer} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                    اسم الحريف
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-4 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors text-lg"
                    placeholder="مثال: أحمد"
                    autoFocus
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !newCustomerName.trim()}
                    className="flex-1 px-4 py-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition-colors shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
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

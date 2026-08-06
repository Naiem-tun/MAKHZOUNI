import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Supplier, SupplierTransaction, Debt, OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { syncTracker } from '../lib/syncTracker';
import { Truck, Plus, Phone, Trash2, Edit2, X, RotateCcw, UserPlus, Eye, Receipt, History, CirclePlus, Calendar, Search, Play, Square, Printer, FileSpreadsheet, Activity } from 'lucide-react';
import { formatCurrency, handleFirestoreError, safeParseDate, formatAppDate } from '../lib/utils';
import { logAudit } from '../lib/auditLogger';
import { PrintSupplierTxModal } from '../components/suppliers/PrintSupplierTxModal';
import { SupplierFormModal } from '../components/suppliers/SupplierFormModal';
import { SupplierTransactionModal } from '../components/suppliers/SupplierTransactionModal';
import { SupplierHistoryModal } from '../components/suppliers/SupplierHistoryModal';
import { SupplierConfirmModals } from '../components/suppliers/SupplierConfirmModals';
import { SupplierCard } from '../components/suppliers/SupplierCard';
import { SupplierHeader } from '../components/suppliers/SupplierHeader';
import { SupplierToolbar } from '../components/suppliers/SupplierToolbar';
import { SupplierSearchBar } from '../components/suppliers/SupplierSearchBar';
import * as xlsx from 'xlsx';
import { Download, FileText } from 'lucide-react';

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
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadedReports, setUploadedReports] = useState<{ id: string; name: string; data: Record<string, number> }[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB, 'ar');
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
      updateDoc(doc(db, `users/${user.uid}/suppliers`, editingSupplier.id!), data).then(() => {
        const changes: string[] = [];
        if (editingSupplier.name !== data.name) changes.push(`الاسم (من ${editingSupplier.name} إلى ${data.name})`);
        if (editingSupplier.phone !== data.phone) changes.push(`الهاتف (من ${editingSupplier.phone} إلى ${data.phone})`);
        if (editingSupplier.typeOfGoods !== data.typeOfGoods) changes.push(`نوع البضاعة (من ${editingSupplier.typeOfGoods} إلى ${data.typeOfGoods})`);

        let detailsStr = 'تحديث بيانات المورد';
        if (changes.length > 0) {
           detailsStr += ` - ${changes.join('، ')}`;
        }
        logAudit('update', 'supplier', editingSupplier.id!, data.name, detailsStr);
      }).catch(err => {
        console.error("Failed to update supplier:", err);
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/suppliers/${editingSupplier.id}`);
      });
    } else {
      showToast(t('supplier_added_success'));
      addDoc(collection(db, `users/${user.uid}/suppliers`), data).then((docRef) => {
        logAudit('create', 'supplier', docRef.id, data.name, 'إضافة مورد جديد');
      }).catch(err => {
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
      const supplierToDelete = suppliers.find(s => s.id === targetId);
      deleteDoc(doc(db, `users/${user.uid}/suppliers`, targetId)).then(() => {
        if (supplierToDelete) {
           logAudit('delete', 'supplier', targetId, supplierToDelete.name, 'حذف مورد');
        }
      }).catch(err => {
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
      logAudit('delete', 'purchase', 'all', 'جميع الموردين', `حذف جميع المعاملات (${transactions.length} معاملة)`);
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
    setIsSaving(false); // Enable UI immediately for offline sync
    
    syncTracker.track(addDoc(collection(db, `users/${user.uid}/supplierTransactions`), data)
      .then((docRef) => {
        logAudit('create', 'purchase', docRef.id, selectedSupplier.name, `تسجيل فاتورة مورد بقيمة: ${amount}`);
      })
      .catch(err => {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/supplierTransactions`);
      }));
  };

  const [deleteTxConfirmId, setDeleteTxConfirmId] = useState<string | null>(null);

  const handleDeleteTransaction = async () => {
    if (!user || !deleteTxConfirmId) return;

    // Optimistic UI updates
    const targetId = deleteTxConfirmId;
    setDeleteTxConfirmId(null);
    showToast(t('supplier_transaction_deleted_success'));

    try {
      const txToDelete = transactions.find(t => t.id === targetId);
      const supplierName = txToDelete && suppliers.find(s => s.id === txToDelete.supplierId)?.name || 'مورد غير معروف';
      
      deleteDoc(doc(db, `users/${user.uid}/supplierTransactions`, targetId)).then(() => {
        if (txToDelete) {
           logAudit('delete', 'purchase', targetId, supplierName, `حذف معاملة بقيمة: ${txToDelete.amount}`);
        }
      }).catch(err => {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/supplierTransactions`);
      });
    } catch (err) {
      console.error(err);
    }
  };

  const exportToExcel = () => {
    if (!filteredSuppliers || filteredSuppliers.length === 0) {
      showToast(t('no_data'), 'error');
      return;
    }
    
    // Define headers
    const headers = [
      'المورد',
      'إجمالي المشتريات'
    ];

    // Create rows
    const wsData = [];
    wsData.push(headers);
    
    filteredSuppliers.forEach((s) => {
      wsData.push([
        s.name || '',
        s.totalPaid || 0
      ]);
    });

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    
    if (settings.language === 'ar') {
      ws['!dir'] = 'rtl';
    }

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Suppliers");
    
    const exportDate = new Date().toISOString().split('T')[0];
    xlsx.writeFile(wb, `suppliers_list_${exportDate}.xlsx`);
    
    showToast('تم تصدير Excel بنجاح', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json<string[]>(ws, { header: 1 });

        if (data.length < 2) {
          showToast('الملف فارغ أو لا يحتوي على بيانات صحيحة', 'error');
          return;
        }
        const normalizeName = (name: string) => name.trim().replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ي/g, "ى").replace(/\s+/g, " ");
        const parseNumber = (val: string) => {
          let str = val.replace(/\s/g, "");
          if (str.includes(",") && !str.includes(".")) {
            str = str.replace(",", ".");
          } else if (str.includes(",") && str.includes(".")) {
            str = str.replace(/,/g, "");
          }
          return parseFloat(str) || 0;
        };
        const reportData: Record<string, number> = {};
        
        // Skip header row
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 2) continue;
          
          let col0 = row[0]?.toString() || "";
          let col1 = row[1]?.toString() || "";
          
          const isNumber = (str: string) => /^[\d\s.,-]+$/.test(str.trim()) && str.trim().length > 0;
          
          let supplierName = "";
          let amount = 0;
          
          if (isNumber(col1) && !isNumber(col0)) {
            supplierName = col0;
            amount = parseNumber(col1);
          } else if (isNumber(col0) && !isNumber(col1)) {
            supplierName = col1;
            amount = parseNumber(col0);
          } else {
            supplierName = col0;
            amount = parseNumber(col1);
          }
          
          if (supplierName.trim()) {
            reportData[supplierName.trim()] = amount;
            reportData[normalizeName(supplierName)] = amount;
          }
        }
        const newReport = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          name: file.name.replace('.xlsx', '').replace('.csv', ''),
          data: reportData
        };

        if (uploadedReports.length >= 3) {
           showToast('يمكنك مقارنة 3 تقارير كحد أقصى', 'error');
           return;
        }

        setUploadedReports(prev => [...prev, newReport]);
        showToast('تم رفع التقرير بنجاح', 'success');
      } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء قراءة الملف', 'error');
      }
    };
    reader.readAsBinaryString(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeUploadedReport = (id: string) => {
    setUploadedReports(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-6 pb-24">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />
      
      <SupplierHeader 
        setEditingSupplier={setEditingSupplier}
        setSelectedVisitDays={setSelectedVisitDays}
        setIsModalOpen={setIsModalOpen}
      />

      <SupplierToolbar
        showExportMenu={showExportMenu}
        setShowExportMenu={setShowExportMenu}
        settings={settings}
        setIsPrintModalOpen={setIsPrintModalOpen}
        exportToExcel={exportToExcel}
        fileInputRef={fileInputRef}
        setIsClearAllConfirmOpen={setIsClearAllConfirmOpen}
      />

      <SupplierSearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        uploadedReports={uploadedReports}
        removeUploadedReport={removeUploadedReport}
      />

      <div className="grid grid-cols-1 gap-4 pb-40">
        {filteredSuppliers.map((s) => (
          <SupplierCard
            key={s.id}
            supplier={s}
            debts={debts}
            isToday={!!s.visitDays?.includes(today)}
            uploadedReports={uploadedReports}
            settings={settings}
            activeSupplier={activeSupplier}
            setEditingSupplier={setEditingSupplier}
            setSelectedVisitDays={setSelectedVisitDays}
            setIsModalOpen={setIsModalOpen}
            setDeleteConfirmId={setDeleteConfirmId}
            setDeleteConfirmName={setDeleteConfirmName}
            setSelectedSupplier={setSelectedSupplier}
            setIsHistoryModalOpen={setIsHistoryModalOpen}
            setIsSessionSummaryOpen={setIsSessionSummaryOpen}
            setActiveSupplier={setActiveSupplier}
            setIsAddTxModalOpen={setIsAddTxModalOpen}
          />
        ))}
      </div>

      {/* Total Summary */}
      {(settings.showFloatingTotals ?? true) && (
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
      )}

      <SupplierFormModal
        isModalOpen={isModalOpen}
        closeModal={() => { setIsModalOpen(false); setEditingSupplier(null); }}
        editingSupplier={editingSupplier}
        handleSave={handleSave}
        isSaving={isSaving}
        selectedVisitDays={selectedVisitDays}
        setSelectedVisitDays={setSelectedVisitDays}
      />

      <SupplierTransactionModal
        isAddTxModalOpen={isAddTxModalOpen}
        setIsAddTxModalOpen={setIsAddTxModalOpen}
        selectedSupplier={selectedSupplier}
        handleAddTransaction={handleAddTransaction}
        isSaving={isSaving}
        currency={settings.currency}
      />

      <SupplierHistoryModal
        isHistoryModalOpen={isHistoryModalOpen}
        setIsHistoryModalOpen={setIsHistoryModalOpen}
        selectedSupplier={selectedSupplier}
        transactions={transactions}
        settings={settings}
        setDeleteTxConfirmId={setDeleteTxConfirmId}
      />
      <SupplierConfirmModals
        deleteConfirmId={deleteConfirmId}
        setDeleteConfirmId={setDeleteConfirmId}
        deleteConfirmName={deleteConfirmName}
        handleDeleteSupplier={handleDeleteSupplier}
        deleteTxConfirmId={deleteTxConfirmId}
        setDeleteTxConfirmId={setDeleteTxConfirmId}
        handleDeleteTransaction={handleDeleteTransaction}
        isClearAllConfirmOpen={isClearAllConfirmOpen}
        setIsClearAllConfirmOpen={setIsClearAllConfirmOpen}
        handleClearAllTransactions={handleClearAllTransactions}
        isTotalModalOpen={isTotalModalOpen}
        setIsTotalModalOpen={setIsTotalModalOpen}
        grandTotal={grandTotal}
        isSaving={isSaving}
        settings={settings}
      />

      <PrintSupplierTxModal 
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        storeName={settings.storeName || 'مخزوني'}
      />
    </div>
  );
}

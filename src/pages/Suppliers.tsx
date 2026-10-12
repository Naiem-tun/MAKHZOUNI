import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Supplier, SupplierTransaction, Debt, OperationType, SupplierCycle } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { syncTracker } from '../lib/syncTracker';
import { Truck, Plus, Phone, Trash2, Edit2, X, RotateCcw, UserPlus, Eye, Receipt, History, CirclePlus, Calendar, Search, Play, Square, Printer, FileSpreadsheet, Activity, BrainCircuit, Archive, ArrowLeftRight, ShoppingCart, Layers, Handshake } from 'lucide-react';
import { formatCurrency, handleFirestoreError, safeParseDate, formatAppDate, roundMoney } from '../lib/utils';
import { logAudit } from '../lib/auditLogger';
import { PrintSupplierTxModal } from '../components/suppliers/PrintSupplierTxModal';
import { SupplierFormModal } from '../components/suppliers/SupplierFormModal';
import { SupplierTransactionModal } from '../components/suppliers/SupplierTransactionModal';
import { SupplierHistoryModal } from '../components/suppliers/SupplierHistoryModal';
import { SupplierConfirmModals } from '../components/suppliers/SupplierConfirmModals';
import { SupplierActiveCycleDetailsModal } from '../components/suppliers/SupplierActiveCycleDetailsModal';
import { SupplierCard } from '../components/suppliers/SupplierCard';
import { SupplierHeader } from '../components/suppliers/SupplierHeader';
import { SupplierToolbar } from '../components/suppliers/SupplierToolbar';
import { SupplierSearchBar } from '../components/suppliers/SupplierSearchBar';
import { SmartDealAdvisorModal } from '../components/suppliers/SmartDealAdvisorModal';
import { SupplierCyclesModal } from '../components/suppliers/SupplierCyclesModal';
import * as xlsx from 'xlsx';
import { Download, FileText } from 'lucide-react';

export default function Suppliers() {
  const { t } = useTranslation();
  const { user, showToast, settings, updateSettings, activeSupplier, setActiveSupplier, setIsSessionSummaryOpen } = useAppContext();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [cycles, setCycles] = useState<SupplierCycle[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isCyclesModalOpen, setIsCyclesModalOpen] = useState(false);
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
  const [isTrackingMode, setIsTrackingMode] = useState(false);
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

    const cyclesQ = collection(db, `users/${user.uid}/supplierCycles`);
    const unsubCycles = onSnapshot(cyclesQ, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierCycle));
      items.sort((a, b) => {
        const timeA = safeParseDate(a.createdAt).getTime();
        const timeB = safeParseDate(b.createdAt).getTime();
        return timeB - timeA;
      });
      setCycles(items);
    }, (error) => {
      console.warn("Could not load cycles:", error);
    });

    return () => {
      unsubSuppliers();
      unsubTx();
      unsubDebts();
      unsubCycles();
    };
  }, [user]);

  const trackingStartDate = settings.lastSuppliersClearDate 
    ? new Date(settings.lastSuppliersClearDate)
    : (transactions.length > 0 
        ? new Date(Math.min(...transactions.map(t => safeParseDate(t.date).getTime()))) 
        : new Date());
  const trackingEndDate = new Date();

  // Active transactions for current open cycle
  const activeTransactions = React.useMemo(() => {
    return transactions.filter(t => {
      // 1. If explicitly marked as archived, it belongs to an archived cycle
      if (t.archived === true) return false;

      // 2. If explicitly marked as not archived, it belongs to the active cycle
      if (t.archived === false) return true;

      // 3. For legacy records without boolean `archived` field:
      const txTime = safeParseDate(t.date).getTime();
      const updatedTime = t.updatedAt ? safeParseDate(t.updatedAt).getTime() : 0;
      const createdTime = t.createdAt ? safeParseDate(t.createdAt).getTime() : 0;

      // If created/updated on or after trackingStartDate:
      if (updatedTime >= trackingStartDate.getTime() || createdTime >= trackingStartDate.getTime()) {
        return true;
      }

      // Or compare normalized day
      const startOfDayTracking = new Date(trackingStartDate);
      startOfDayTracking.setHours(0, 0, 0, 0);
      return txTime >= startOfDayTracking.getTime();
    });
  }, [transactions, trackingStartDate]);

  const suppliersWithTotals = suppliers.map(s => {
    const supplierTx = activeTransactions.filter(t => t.supplierId === s.id);
    const totalPaid = supplierTx.reduce((acc, t) => acc + (t.amount || 0), 0);
    const txCount = supplierTx.length;
    
    let visitHistory: { status: 'attended' | 'absent' | 'pending' | 'unknown', date: string }[] = [];
    
    if (s.visitDays && s.visitDays.length > 0) {
      const current = new Date(trackingStartDate);
      current.setHours(0, 0, 0, 0);
      const end = new Date(trackingEndDate);
      end.setHours(23, 59, 59, 999);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      while (current <= end) {
        if (s.visitDays.includes(current.getDay())) {
          const txsForDay = supplierTx.filter(t => {
            const d = safeParseDate(t.date);
            return d.getFullYear() === current.getFullYear() &&
                   d.getMonth() === current.getMonth() &&
                   d.getDate() === current.getDate();
          });
          
          if (txsForDay.length > 0) {
            const isConfirmedAbsent = txsForDay.some(t => t.amount === 0 && t.note === 'غياب');
            if (isConfirmedAbsent) {
              visitHistory.push({ status: 'absent', date: current.toISOString() });
            } else {
              visitHistory.push({ status: 'attended', date: current.toISOString() });
            }
          } else if (current.getTime() === todayDate.getTime()) {
             visitHistory.push({ status: 'pending', date: current.toISOString() });
          } else {
             visitHistory.push({ status: 'unknown', date: current.toISOString() });
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }
    
    // Check for missed visit
    // A visit is considered "missed" if today > visitDay AND no transaction exists for THIS specific week's visitDay
    // AND targetDate is on or after the trackingStartDate (to avoid marking days before clear date / inventory reset as missed)
    const isMissed = s.visitDays?.some(day => {
      if (day >= today) return false; // Not passed yet or is today

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - today);
      startOfWeek.setHours(0, 0, 0, 0);

      const targetDate = new Date(startOfWeek);
      targetDate.setDate(targetDate.getDate() + day);

      // If the scheduled visit day for this week was BEFORE the reset/clear date, don't count it as missed
      if (targetDate.getTime() < trackingStartDate.getTime()) {
        return false;
      }

      const hasTxForDay = activeTransactions.some(t => {
        if (t.supplierId !== s.id) return false;
        const txDate = safeParseDate(t.date);
        return txDate.toDateString() === targetDate.toDateString();
      });

      return !hasTxForDay;
    });

    return { ...s, totalPaid, txCount, isMissed, visitHistory };
  }).sort((a, b) => {
    const aIsToday = !!a.visitDays?.includes(today);
    const bIsToday = !!b.visitDays?.includes(today);
    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;
    
    const aIsMissed = !!a.isMissed;
    const bIsMissed = !!b.isMissed;
    if (aIsMissed && !bIsMissed) return -1;
    if (!aIsMissed && bIsMissed) return 1;

    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB, 'ar');
  });

  const grandTotal = activeTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
  const activeSuppliersInCycleCount = new Set(activeTransactions.filter(t => t.supplierId && (t.amount || 0) > 0).map(t => t.supplierId)).size;

  const filteredSuppliers = suppliersWithTotals.filter(s => 
    (s.name || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
    s.phone?.includes(searchQuery) ||
    (s.typeOfGoods || "").toLowerCase().includes((searchQuery || "").toLowerCase())
  );

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isSaving) return;
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const data: any = {
      name: ((formData.get('supplier_name') || formData.get('name')) as string || '').trim(),
      phone: ((formData.get('supplier_phone') || formData.get('phone')) as string || '').trim(),
      typeOfGoods: ((formData.get('supplier_goods') || formData.get('typeOfGoods')) as string || '').trim(),
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

  const handleArchiveCycle = async () => {
    if (!user || activeTransactions.length === 0) return;
    setIsSaving(true);
    try {
      const now = new Date();
      const cycleName = `دورة ${formatAppDate(now)}`;
      
      const supplierBreakdown = suppliers.map(s => {
        const sTxs = activeTransactions.filter(t => t.supplierId === s.id);
        const amount = sTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
        return {
          supplierId: s.id || '',
          supplierName: s.name,
          typeOfGoods: s.typeOfGoods || '',
          amount: roundMoney(amount),
          count: sTxs.length
        };
      }).filter(item => item.amount > 0 || item.count > 0);

      const totalAmount = roundMoney(activeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0));

      const cycleData = {
        name: cycleName,
        startDate: trackingStartDate.toISOString(),
        endDate: now.toISOString(),
        totalAmount,
        transactionCount: activeTransactions.length,
        supplierCount: supplierBreakdown.length,
        supplierBreakdown,
        createdAt: serverTimestamp()
      };

      const cycleRef = await addDoc(collection(db, `users/${user.uid}/supplierCycles`), cycleData);

      // Mark all current unarchived transactions as archived
      const transactionsToArchive = transactions.filter(t => !t.archived);
      const updatePromises = transactionsToArchive.map(t => {
        if (!t.id) return Promise.resolve();
        return updateDoc(doc(db, `users/${user.uid}/supplierTransactions`, t.id), {
          archived: true,
          cycleId: cycleRef.id,
          cycleName,
          archivedAt: serverTimestamp()
        });
      });
      await Promise.all(updatePromises);

      // Automatically trigger excel export so user has the phone download
      exportToExcel();

      // Reset tracking start date
      await updateSettings({ lastSuppliersClearDate: now.toISOString() });

      logAudit('create', 'purchase', cycleRef.id, cycleName, `أرشفة دورة الموردين بإجمالي: ${totalAmount} (${activeTransactions.length} معاملة)`);
      showToast('تمت أرشفة الدورة وتنزيل التقرير، وبدأت دورة جديدة بصفحة بيضاء!', 'success');
      setIsClearAllConfirmOpen(false);
    } catch (err) {
      console.error("Archive cycle error:", err);
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/supplierCycles`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAllTransactions = async () => {
    if (!user || activeTransactions.length === 0) return;
    setIsSaving(true);
    try {
      const deletePromises = activeTransactions.map(t => 
        deleteDoc(doc(db, `users/${user.uid}/supplierTransactions`, t.id!))
      );
      await Promise.all(deletePromises);
      await updateSettings({ lastSuppliersClearDate: new Date().toISOString() });
      logAudit('delete', 'purchase', 'all', 'جميع الموردين', `حذف جميع معاملات الدورة (${activeTransactions.length} معاملة)`);
      showToast(t('all_supplier_transactions_cleared_success'));
      setIsClearAllConfirmOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/supplierTransactions`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportCycleFromExcel = async (file: File) => {
    if (!user) return;
    try {
      const bstr = await file.arrayBuffer();
      const wb = xlsx.read(bstr, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1 });

      if (!data || data.length < 2) {
        showToast('الملف لا يحتوي على بيانات صالحة', 'error');
        return;
      }

      const breakdown: { supplierId: string; supplierName: string; amount: number; count: number; typeOfGoods?: string }[] = [];
      let totalAmount = 0;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        const name = String(row[0] || '').trim();
        const rawAmount = String(row[1] || row[3] || '0').replace(/[^\d.-]/g, '');
        const amount = parseFloat(rawAmount) || 0;
        if (name && amount > 0) {
          totalAmount += amount;
          breakdown.push({
            supplierId: '',
            supplierName: name,
            amount: roundMoney(amount),
            count: 1,
            typeOfGoods: row[1] && isNaN(Number(row[1])) ? String(row[1]) : 'بضاعة عامة'
          });
        }
      }

      if (breakdown.length === 0) {
        showToast('لم يتم العثور على موردين بمبالغ صالحة في الملف', 'error');
        return;
      }

      const cycleData = {
        name: file.name.replace(/\.(xlsx|xls|csv)$/i, ''),
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        totalAmount: roundMoney(totalAmount),
        transactionCount: breakdown.length,
        supplierCount: breakdown.length,
        supplierBreakdown: breakdown,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, `users/${user.uid}/supplierCycles`), cycleData);
      showToast('تم استيراد الدورة وتغذية ذاكرة الوكيل التجاري بنجاح!', 'success');
    } catch (err) {
      console.error("Import cycle error:", err);
      showToast('حدث خطأ أثناء قراءة ملف Excel', 'error');
    }
  };

  const handleDeleteCycle = async (cycleId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/supplierCycles`, cycleId));
      showToast('تم حذف الدورة من الأرشيف', 'success');
    } catch (err) {
      console.error("Delete cycle error:", err);
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/supplierCycles`);
    }
  };

  const handleMarkAbsent = async (supplierId: string, dateIso: string) => {
    if (!user) return;
    try {
      const date = new Date(dateIso);
      date.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
      await addDoc(collection(db, `users/${user.uid}/supplierTransactions`), {
        supplierId,
        amount: 0,
        date: date.toISOString(),
        note: 'غياب',
        updatedAt: serverTimestamp()
      });
      showToast('تم تسجيل الغياب');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/supplierTransactions`);
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
    const amount = roundMoney(parseFloat(formData.get('amount') as string) || 0);
    const dateInput = formData.get('date') as string;
    
    let finalDate: Date;
    if (dateInput) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (dateInput === todayStr) {
        // Today - preserve exact current timestamp so it is strictly after any archive timestamp
        finalDate = new Date();
      } else {
        // Past or future date - noon local time
        const parts = dateInput.split('-').map(Number);
        finalDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      }
    } else {
      finalDate = new Date();
    }
    
    const data = {
      supplierId: selectedSupplier.id,
      amount,
      date: Timestamp.fromDate(finalDate),
      note: ((formData.get('note') as string) || '').trim(),
      archived: false,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    setIsAddTxModalOpen(false);
    showToast(t('supplier_transaction_added_success'));
    setIsSaving(false); // Enable UI immediately for offline sync
    
    syncTracker.track(addDoc(collection(db, `users/${user.uid}/supplierTransactions`), data)
      .then((docRef) => {
        logAudit('create', 'purchase', docRef.id, selectedSupplier.name, `تسجيل فاتورة مورد بقيمة: ${roundMoney(amount)}`);
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
           logAudit('delete', 'purchase', targetId, supplierName, `حذف معاملة بقيمة: ${roundMoney(txToDelete.amount)}`);
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
        isTrackingMode={isTrackingMode}
        setIsTrackingMode={setIsTrackingMode}
        setIsAdvisorOpen={setIsAdvisorOpen}
        setIsCyclesModalOpen={setIsCyclesModalOpen}
        archivedCyclesCount={cycles.length}
      />

      {/* Compact Purchases Summary - Dashboard-inspired & matching app curvature */}
      {(settings.showFloatingTotals ?? true) && (
        <div 
          onClick={() => setIsTotalModalOpen(true)}
          className="relative p-3 sm:p-3.5 rounded-lg bg-brand-800 dark:bg-zinc-900 text-white shadow-sm border border-brand-700/40 dark:border-zinc-800 cursor-pointer transition-all hover:bg-brand-900 active:scale-[0.99] overflow-hidden group"
        >
          {/* Subtle ambient light */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5">
            {/* Right side: Icon + Label + Value */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-white/10 dark:bg-white/5 flex items-center justify-center text-emerald-300">
                <ArrowLeftRight size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-brand-200 dark:text-zinc-400 leading-tight">
                  إجمالي المعاملات مع الموردين
                </div>
                <div className="text-lg sm:text-xl font-black tracking-tight text-white leading-none mt-0.5">
                  {!(settings.showFinancials ?? true) ? '••••••' : formatCurrency(grandTotal, settings.currency, settings.language || 'ar')}
                </div>
              </div>
            </div>

            {/* Left side (in RTL): Metrics + Details Button */}
            <div className="flex items-center gap-1.5 mr-auto sm:mr-0 flex-wrap">
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 dark:bg-white/5 text-[11px] font-bold text-brand-100">
                <Layers size={12} className="text-brand-300" />
                <span>{activeTransactions.length}</span>
                <span className="text-[10px] font-normal text-brand-200 opacity-80">{t('operations') || 'عملية'}</span>
              </div>

              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 dark:bg-white/5 text-[11px] font-bold text-emerald-200">
                <Truck size={12} className="text-emerald-300" />
                <span>{activeSuppliersInCycleCount}</span>
                <span className="text-[10px] font-normal text-brand-200 opacity-80">/ {suppliers.length} مورد</span>
              </div>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsTotalModalOpen(true); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/20 active:bg-white/25 text-white text-[11px] font-bold transition-colors"
              >
                <span>التفاصيل</span>
                <Eye size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      <SupplierSearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        uploadedReports={uploadedReports}
        removeUploadedReport={removeUploadedReport}
      />

      <div className="grid grid-cols-1 gap-4 pb-24">
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
            isTrackingMode={isTrackingMode}
            onMarkAbsent={handleMarkAbsent}
          />
        ))}
      </div>

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
        activeTransactions={activeTransactions}
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
        handleArchiveCycle={handleArchiveCycle}
        txCount={activeTransactions.length}
        isSaving={isSaving}
        settings={settings}
      />

      <SupplierActiveCycleDetailsModal
        isOpen={isTotalModalOpen}
        onClose={() => setIsTotalModalOpen(false)}
        grandTotal={grandTotal}
        activeTransactions={activeTransactions}
        suppliers={suppliers}
        settings={settings}
      />

      <SmartDealAdvisorModal
        isOpen={isAdvisorOpen}
        onClose={() => setIsAdvisorOpen(false)}
        suppliers={suppliers}
        activeTransactions={activeTransactions}
        archivedCycles={cycles}
        allTransactions={transactions}
        settings={settings}
      />

      <SupplierCyclesModal
        isOpen={isCyclesModalOpen}
        onClose={() => setIsCyclesModalOpen(false)}
        cycles={cycles}
        suppliers={suppliers}
        settings={settings}
        onDeleteCycle={handleDeleteCycle}
        onImportCycleFromExcel={handleImportCycleFromExcel}
        onArchiveCurrentCycle={() => setIsClearAllConfirmOpen(true)}
        currentCycleCount={activeTransactions.length}
      />

      <PrintSupplierTxModal 
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        storeName={settings.storeName || 'مخزوني'}
      />
    </div>
  );
}

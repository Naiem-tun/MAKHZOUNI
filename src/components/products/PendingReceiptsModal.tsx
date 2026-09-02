import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Eye, 
  Package, 
  UserCheck, 
  Building2, 
  Calendar, 
  RefreshCw,
  Check,
  CheckCheck,
  Edit3,
  ChevronDown,
  ChevronUp,
  Layers,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoodsReceipt, GoodsReceiptItem } from '../../types';
import { useAppContext } from '../../AppContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { formatCurrency, formatAppDate, safeParseDate } from '../../lib/utils';
import { doc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, writeBatch, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/auditLogger';
import { syncSupplierFinancialsForReceipt } from '../../lib/supplierFinanceSync';

interface PendingReceiptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: GoodsReceipt[];
  onReviewReceipt: (receipt: GoodsReceipt) => void;
  onOpenNewReceipt?: () => void;
}

export function PendingReceiptsModal({
  isOpen,
  onClose,
  receipts: propReceipts,
  onReviewReceipt,
  onOpenNewReceipt
}: PendingReceiptsModalProps) {
  const { t } = useTranslation();
  const { user, showToast, settings } = useAppContext();
  const { currentStaff } = useStaffAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localReceipts, setLocalReceipts] = useState<GoodsReceipt[] | null>(null);
  const [expandedReceipts, setExpandedReceipts] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedReceipts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const receipts = localReceipts || propReceipts;

  const pendingSupplierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    receipts.filter(r => r.status === 'pending' || !r.status).forEach(r => {
      const sName = r.supplierName || 'مورد غير محدد';
      counts[sName] = (counts[sName] || 0) + 1;
    });
    return counts;
  }, [receipts]);

  const handleForceRefresh = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      const snap = await getDocs(collection(db, `users/${user.uid}/goodsReceipts`));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as GoodsReceipt));
      docs.sort((a, b) => {
        const getT = (item: GoodsReceipt) => {
          if (!item) return 0;
          if (item.createdAt?.toMillis) return item.createdAt.toMillis();
          if (item.createdAt?.seconds) return item.createdAt.seconds * 1000;
          if (typeof item.createdAt === 'string') return new Date(item.createdAt).getTime() || 0;
          if ((item as any).createdAtTimestamp) return (item as any).createdAtTimestamp;
          return 0;
        };
        return getT(b) - getT(a);
      });
      setLocalReceipts(docs);
      localStorage.setItem(`cached_goods_receipts_${user.uid}`, JSON.stringify(docs));
      showToast(`تم تحديث البيانات (${docs.length} إذن مسجل)`, 'success');
    } catch (err: any) {
      console.error('Error refreshing receipts:', err);
      showToast('حدث خطأ أثناء التحديث: ' + err.message, 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleApproveSingleReceipt = async (receipt: GoodsReceipt) => {
    if (!user || !receipt.id) return;
    const isMulti = (receipt.items?.length || 0) > 1;
    const titleName = isMulti 
      ? `فاتورة ${receipt.supplierName || 'المورد'} (${receipt.items.length} أصناف)`
      : (receipt.items?.[0]?.name || 'المنتج');

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const receiptRef = doc(db, `users/${user.uid}/goodsReceipts`, receipt.id);
      
      for (const item of (receipt.items || [])) {
        const targetProdId = item.matchedProductId || item.id;
        if (targetProdId) {
          const prodRef = doc(db, `users/${user.uid}/products`, targetProdId);
          const ppb = (item.piecesPerBox && Number(item.piecesPerBox) > 1) ? Number(item.piecesPerBox) : 1;
          const isCarton = item.unitType === 'carton';
          const addedPieces = isCarton 
            ? (Number(item.quantity) || 0) * ppb
            : (Number(item.quantity) || 0);

          const updateData: any = {
            quantity: increment(addedPieces),
            updatedAt: serverTimestamp()
          };

          if (item.costPrice && Number(item.costPrice) > 0) {
            if (isCarton) {
              const boxCost = Number(item.costPrice);
              const pieceCost = parseFloat((boxCost / ppb).toFixed(3));
              updateData.boxPurchasePrice = boxCost;
              updateData.purchasePrice = pieceCost;
            } else {
              const pieceCost = Number(item.costPrice);
              const boxCost = parseFloat((pieceCost * ppb).toFixed(3));
              updateData.purchasePrice = pieceCost;
              if (ppb > 1) {
                updateData.boxPurchasePrice = boxCost;
              }
            }
          }
          if (item.sellingPrice && Number(item.sellingPrice) > 0) {
            if (isCarton) {
              const boxSelling = Number(item.sellingPrice);
              const pieceSelling = parseFloat((boxSelling / ppb).toFixed(3));
              updateData.boxSellingPrice = boxSelling;
              updateData.sellingPrice = pieceSelling;
            } else {
              const pieceSelling = Number(item.sellingPrice);
              const boxSelling = parseFloat((pieceSelling * ppb).toFixed(3));
              updateData.sellingPrice = pieceSelling;
              if (ppb > 1) {
                updateData.boxSellingPrice = boxSelling;
              }
            }
          }

          batch.update(prodRef, updateData);

          const purchaseRef = doc(collection(db, `users/${user.uid}/purchases`));
          const purchaseAmount = Number(item.total) > 0 
            ? Number(item.total) 
            : (isCarton ? ((Number(item.quantity) || 0) * Number(item.costPrice || 0)) : (addedPieces * Number(item.costPrice || 0)));

          batch.set(purchaseRef, {
            productId: targetProdId,
            productName: item.name,
            qtyAdded: addedPieces,
            amount: parseFloat(purchaseAmount.toFixed(3)),
            price: isCarton ? parseFloat((Number(item.costPrice || 0) / ppb).toFixed(3)) : (Number(item.costPrice) || 0),
            boxPrice: isCarton ? (Number(item.costPrice) || 0) : parseFloat(((Number(item.costPrice) || 0) * ppb).toFixed(3)),
            unitType: item.unitType,
            quantity: item.quantity,
            piecesPerBox: ppb,
            supplierId: receipt.supplierId || null,
            supplierName: receipt.supplierName || 'مورد غير محدد',
            receiptId: receipt.id,
            receiptNumber: receipt.receiptNumber,
            date: serverTimestamp(),
            submittedBy: receipt.submittedBy || null,
            approvedBy: currentStaff ? { staffId: currentStaff.id, staffName: currentStaff.name, role: currentStaff.role } : { staffId: 'admin', staffName: 'المدير العام', role: 'admin' }
          });
        }
      }

      batch.update(receiptRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: currentStaff ? {
          staffId: currentStaff.id,
          staffName: currentStaff.name,
          role: currentStaff.role
        } : {
          staffId: 'admin',
          staffName: 'المدير العام',
          role: 'admin'
        }
      });

      await batch.commit();

      // مزامنة حسابات ومدفوعات المورد بدقة وتحديث الرصيد والدين
      try {
        await syncSupplierFinancialsForReceipt(db, user.uid, receipt, {
          status: 'approved',
          action: 'approve'
        });
      } catch (finErr) {
        console.warn("Failed to sync supplier financials on approve:", finErr);
      }

      await logAudit(
        'update',
        'purchase',
        receipt.id,
        receipt.receiptNumber || 'Goods Receipt',
        `اعتماد فاتورة استلام بضاعة للمدير العام: ${titleName}`
      );

      showToast(`تم اعتماد (${titleName}) وترحيلها للمخزون بنجاح ✅`, 'success');
      await handleForceRefresh();
    } catch (err: any) {
      console.error('Error approving receipt:', err);
      showToast('حدث خطأ أثناء اعتماد الفاتورة: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveAllPending = async () => {
    const pendingList = receipts.filter(r => r.status === 'pending' || !r.status);
    if (!user || pendingList.length === 0) return;

    if (!window.confirm(`هل أنت متأكد من اعتماد جميع فواتير وأذونات الاستلام المعلقة (${pendingList.length} إذن/فاتورة) وترحيلها فوراً للمخزن؟`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);

      for (const receipt of pendingList) {
        if (!receipt.id) continue;
        const receiptRef = doc(db, `users/${user.uid}/goodsReceipts`, receipt.id);
        
        for (const item of (receipt.items || [])) {
          const targetProdId = item.matchedProductId || item.id;
          if (targetProdId) {
            const prodRef = doc(db, `users/${user.uid}/products`, targetProdId);
            const ppb = (item.piecesPerBox && Number(item.piecesPerBox) > 1) ? Number(item.piecesPerBox) : 1;
            const isCarton = item.unitType === 'carton';
            const addedPieces = isCarton 
              ? (Number(item.quantity) || 0) * ppb
              : (Number(item.quantity) || 0);

            const updateData: any = {
              quantity: increment(addedPieces),
              updatedAt: serverTimestamp()
            };

            if (item.costPrice && Number(item.costPrice) > 0) {
              if (isCarton) {
                const boxCost = Number(item.costPrice);
                const pieceCost = parseFloat((boxCost / ppb).toFixed(3));
                updateData.boxPurchasePrice = boxCost;
                updateData.purchasePrice = pieceCost;
              } else {
                const pieceCost = Number(item.costPrice);
                const boxCost = parseFloat((pieceCost * ppb).toFixed(3));
                updateData.purchasePrice = pieceCost;
                if (ppb > 1) {
                  updateData.boxPurchasePrice = boxCost;
                }
              }
            }
            if (item.sellingPrice && Number(item.sellingPrice) > 0) {
              if (isCarton) {
                const boxSelling = Number(item.sellingPrice);
                const pieceSelling = parseFloat((boxSelling / ppb).toFixed(3));
                updateData.boxSellingPrice = boxSelling;
                updateData.sellingPrice = pieceSelling;
              } else {
                const pieceSelling = Number(item.sellingPrice);
                const boxSelling = parseFloat((pieceSelling * ppb).toFixed(3));
                updateData.sellingPrice = pieceSelling;
                if (ppb > 1) {
                  updateData.boxSellingPrice = boxSelling;
                }
              }
            }

            batch.update(prodRef, updateData);

            const purchaseRef = doc(collection(db, `users/${user.uid}/purchases`));
            const purchaseAmount = Number(item.total) > 0 
              ? Number(item.total) 
              : (isCarton ? ((Number(item.quantity) || 0) * Number(item.costPrice || 0)) : (addedPieces * Number(item.costPrice || 0)));

            batch.set(purchaseRef, {
              productId: targetProdId,
              productName: item.name,
              qtyAdded: addedPieces,
              amount: parseFloat(purchaseAmount.toFixed(3)),
              price: isCarton ? parseFloat((Number(item.costPrice || 0) / ppb).toFixed(3)) : (Number(item.costPrice) || 0),
              boxPrice: isCarton ? (Number(item.costPrice) || 0) : parseFloat(((Number(item.costPrice) || 0) * ppb).toFixed(3)),
              unitType: item.unitType,
              quantity: item.quantity,
              piecesPerBox: ppb,
              supplierId: receipt.supplierId || null,
              supplierName: receipt.supplierName || 'مورد غير محدد',
              receiptId: receipt.id,
              receiptNumber: receipt.receiptNumber,
              date: serverTimestamp(),
              submittedBy: receipt.submittedBy || null,
              approvedBy: currentStaff ? { staffId: currentStaff.id, staffName: currentStaff.name, role: currentStaff.role } : { staffId: 'admin', staffName: 'المدير العام', role: 'admin' }
            });
          }
        }

        batch.update(receiptRef, {
          status: 'approved',
          approvedAt: serverTimestamp(),
          approvedBy: currentStaff ? {
            staffId: currentStaff.id,
            staffName: currentStaff.name,
            role: currentStaff.role
          } : {
            staffId: 'admin',
            staffName: 'المدير العام',
            role: 'admin'
          }
        });
      }

      await batch.commit();

      // مزامنة حسابات ومدفوعات الموردين لجميع الفواتير المعتمدة
      for (const receipt of pendingList) {
        try {
          await syncSupplierFinancialsForReceipt(db, user.uid, receipt, {
            status: 'approved',
            action: 'approve'
          });
        } catch (finErr) {
          console.warn("Failed to sync supplier financials in batch approve:", finErr);
        }
      }

      showToast(`تم اعتماد جميع الفواتير والأذونات (${pendingList.length}) وترحيلها للمخزون بنجاح ✅`, 'success');
      await handleForceRefresh();
    } catch (err: any) {
      console.error('Error approving all receipts:', err);
      showToast('حدث خطأ أثناء الاعتماد الجماعي: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMergeSupplierReceipts = async (supplierName: string) => {
    if (!user) return;
    const toMerge = receipts.filter(r => (r.status === 'pending' || !r.status) && (r.supplierName === supplierName || (!r.supplierName && !supplierName)));
    if (toMerge.length <= 1) return;

    if (!window.confirm(`هل تريد دمج جميع أذونات المورد (${supplierName || 'غير محدد'}) البالغ عددها ${toMerge.length} أذونات في فاتورة واحدة مجمعة؟`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const mergedItems: GoodsReceiptItem[] = [];
      for (const r of toMerge) {
        for (const it of (r.items || [])) {
          const existIdx = mergedItems.findIndex(m => 
            (m.matchedProductId === it.matchedProductId || m.name === it.name) &&
            m.unitType === it.unitType
          );
          if (existIdx >= 0) {
            const cur = mergedItems[existIdx];
            const newQty = (Number(cur.quantity) || 0) + (Number(it.quantity) || 0);
            const unitCost = Number(cur.costPrice) || Number(it.costPrice) || 0;
            mergedItems[existIdx] = {
              ...cur,
              quantity: newQty,
              total: parseFloat((newQty * unitCost).toFixed(3))
            };
          } else {
            mergedItems.push(it);
          }
        }
      }

      const totalAmount = parseFloat(mergedItems.reduce((sum, it) => sum + (Number(it.total) || 0), 0).toFixed(3));
      const totalUnitsCount = mergedItems.reduce((sum, it) => {
        const q = Number(it.quantity) || 0;
        return sum + (it.unitType === 'carton' ? (q * (Number(it.piecesPerBox) || 1)) : q);
      }, 0);

      const primaryReceipt = toMerge[0];
      const otherReceipts = toMerge.slice(1);

      const batch = writeBatch(db);
      const primaryRef = doc(db, `users/${user.uid}/goodsReceipts`, primaryReceipt.id!);
      batch.update(primaryRef, {
        items: mergedItems,
        totalAmount,
        totalUnitsCount,
        totalItemsCount: mergedItems.length,
        updatedAt: serverTimestamp()
      });

      for (const other of otherReceipts) {
        if (other.id) {
          batch.delete(doc(db, `users/${user.uid}/goodsReceipts`, other.id));
        }
      }

      await batch.commit();

      // مزامنة المعاملات المالية للمورد: حذف معاملات الأذونات المدمجة وتحديث المعاملة الرئيسية بالمجموع الجديد
      try {
        for (const other of otherReceipts) {
          await syncSupplierFinancialsForReceipt(db, user.uid, other, { action: 'delete' });
        }
        await syncSupplierFinancialsForReceipt(db, user.uid, {
          ...primaryReceipt,
          items: mergedItems,
          totalAmount
        }, {
          status: 'pending',
          finalTotal: totalAmount,
          action: 'update'
        });
      } catch (mergeFinErr) {
        console.warn("Failed to sync financials on merge:", mergeFinErr);
      }

      showToast(`تم دمج ${toMerge.length} أذونات في فاتورة موحدة بنجاح 📋`, 'success');
      await handleForceRefresh();
    } catch (err: any) {
      console.error('Error merging receipts:', err);
      showToast('حدث خطأ أثناء دمج الأذونات: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const filteredReceipts = receipts.filter(r => {
    if (activeTab === 'pending') return r.status === 'pending' || !r.status;
    return r.status === activeTab;
  });

  const pendingCount = receipts.filter(r => r.status === 'pending' || !r.status).length;
  const approvedCount = receipts.filter(r => r.status === 'approved').length;
  const rejectedCount = receipts.filter(r => r.status === 'rejected').length;

  const handleDeleteReceipt = async (receiptId: string, receiptNumber?: string) => {
    if (!user || !receiptId) return;
    if (!window.confirm(`هل أنت متأكد من حذف إذن الاستلام ${receiptNumber || ''} نهائيًا؟`)) return;

    setIsProcessing(true);
    try {
      const targetReceipt = receipts.find(r => r.id === receiptId);
      await deleteDoc(doc(db, `users/${user.uid}/goodsReceipts`, receiptId));

      // حذف أي معاملة مالية أو دين مسجل في حساب المورد لهذا الإذن
      if (targetReceipt) {
        try {
          await syncSupplierFinancialsForReceipt(db, user.uid, targetReceipt, { action: 'delete' });
        } catch (delFinErr) {
          console.warn("Failed to delete supplier financials:", delFinErr);
        }
      }

      await logAudit(
        'delete',
        'purchase',
        receiptId,
        receiptNumber || 'Goods Receipt',
        'حذف إذن استلام بضاعة'
      );
      showToast('تم حذف إذن الاستلام بنجاح', 'success');
      await handleForceRefresh();
    } catch (err: any) {
      console.error('Error deleting receipt:', err);
      showToast('حدث خطأ أثناء الحذف: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectReceipt = async (receiptId: string) => {
    if (!user || !receiptId) return;
    const reason = window.prompt('يرجى كتابة سبب رفض إذن الاستلام (اختياري):', 'أصناف غير مطابقة أو أسعار غير معتمدة');
    if (reason === null) return;

    setIsProcessing(true);
    try {
      const targetReceipt = receipts.find(r => r.id === receiptId);
      await updateDoc(doc(db, `users/${user.uid}/goodsReceipts`, receiptId), {
        status: 'rejected',
        rejectedReason: reason,
        rejectedAt: serverTimestamp()
      });

      // إلغاء أي معاملة مالية أو دين مرتبط في حساب المورد
      if (targetReceipt) {
        try {
          await syncSupplierFinancialsForReceipt(db, user.uid, targetReceipt, {
            status: 'rejected',
            action: 'reject'
          });
        } catch (rejFinErr) {
          console.warn("Failed to reject supplier financials:", rejFinErr);
        }
      }

      await logAudit(
        'update',
        'purchase',
        receiptId,
        'Goods Receipt',
        `رفض إذن استلام بضاعة - السبب: ${reason}`
      );
      showToast('تم رفض إذن الاستلام', 'info');
      await handleForceRefresh();
    } catch (err: any) {
      console.error('Error rejecting receipt:', err);
      showToast('حدث خطأ أثناء تحديث الإذن: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md shrink-0">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black">أذونات استلام البضائع المعلقة</h2>
                {pendingCount > 0 && (
                  <span className="bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded-full animate-bounce">
                    {pendingCount} منتج بانتظار الاعتماد
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-100 font-medium">كل منتج يصل وحده يُراجع ويعتمد مباشرة من المدير العام لترحيله للمخزون</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'pending' && pendingCount > 1 && (
              <button
                onClick={handleApproveAllPending}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                title="اعتماد كل المنتجات المعلقة بضغطة واحدة"
              >
                <CheckCheck size={16} strokeWidth={2.5} />
                <span>اعتماد الكل ({pendingCount})</span>
              </button>
            )}
            <button
              onClick={handleForceRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl backdrop-blur-sm transition-all"
              title="تحديث ومزامنة الأذونات"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">تحديث</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 shrink-0 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'
              }`}
            >
              <Clock size={16} />
              <span>فواتير بانتظار الاعتماد ({pendingCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('approved')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'approved'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'
              }`}
            >
              <CheckCircle2 size={16} />
              <span>المعتمدة ({approvedCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('rejected')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'rejected'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'
              }`}
            >
              <XCircle size={16} />
              <span>المرفوضة ({rejectedCount})</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {filteredReceipts.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-500">
                <Package size={32} />
              </div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                {activeTab === 'pending'
                  ? 'لا توجد فواتير استلام بانتظار الاعتماد حالياً'
                  : activeTab === 'approved'
                  ? 'لا توجد أذونات استلام معتمدة بعد'
                  : 'لا توجد أذونات استلام مرفوضة'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
                {activeTab === 'pending'
                  ? 'عند وصول بضائع الجلسة من أمين المخزن، تتجمع في فاتورة موحدة هنا للمدير العام لتدقيق أسعار الشراء والبيع واعتمادها وترحيلها بضغطة زر.'
                  : ''}
              </p>

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  onClick={handleForceRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all"
                >
                  <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                  <span>تحديث البيانات والمزامنة</span>
                </button>
              </div>
            </div>
          ) : (
            filteredReceipts.map((receipt) => {
              const dateStr = receipt.createdAt
                ? formatAppDate(safeParseDate(receipt.createdAt?.toDate ? receipt.createdAt.toDate() : receipt.createdAt), settings.language, t)
                : 'الآن';

              const items = receipt.items || [];
              const isMulti = items.length > 1;
              const firstItem = items[0];
              const isExpanded = !!expandedReceipts[receipt.id || ''];
              const supplierName = receipt.supplierName || 'مورد غير محدد';
              const multipleFromSupplier = (pendingSupplierCounts[supplierName] || 0) > 1 && (receipt.status === 'pending' || !receipt.status);

              return (
                <div
                  key={receipt.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 transition-all hover:border-amber-400 dark:hover:border-amber-600 shadow-sm"
                >
                  <div className="flex flex-col gap-3">
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                          isMulti 
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                        }`}>
                          {isMulti ? <FileText size={24} /> : <Package size={24} />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-black text-base text-zinc-900 dark:text-white truncate">
                              {isMulti ? `فاتورة استلام: ${supplierName}` : (firstItem?.name || receipt.receiptNumber || 'منتج مستلم')}
                            </h3>
                            <span className="font-mono text-xs text-zinc-400">
                              #{receipt.receiptNumber || receipt.id?.slice(-5)}
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              receipt.status === 'approved' 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' 
                                : receipt.status === 'rejected'
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            }`}>
                              {receipt.status === 'approved' ? 'معتمد ومرحل' : receipt.status === 'rejected' ? 'مرفوض' : 'بانتظار اعتماد المدير'}
                            </span>
                            {isMulti && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 flex items-center gap-1">
                                <Layers size={11} />
                                <span>فاتورة مجمعة ({items.length} أصناف)</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 size={13} className="text-zinc-400" />
                              <span>المورد: <strong className="text-zinc-800 dark:text-zinc-200">{supplierName}</strong></span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <UserCheck size={13} className="text-zinc-400" />
                              <span>المستلم: <strong className="text-zinc-800 dark:text-zinc-200">{receipt.submittedBy?.staffName || 'الموظف'}</strong></span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar size={13} className="text-zinc-400" />
                              <span>{dateStr}</span>
                            </span>
                            {receipt.totalAmount ? (
                              <>
                                <span>•</span>
                                <span className="font-bold text-amber-600 dark:text-amber-400">
                                  الإجمالي: {formatCurrency(receipt.totalAmount, settings.currency)}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                        {multipleFromSupplier && (
                          <button
                            onClick={() => handleMergeSupplierReceipts(receipt.supplierName || '')}
                            disabled={isProcessing}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 transition-all"
                            title="دمج كل أذونات هذا المورد في فاتورة واحدة"
                          >
                            <Layers size={13} />
                            <span>دمج أذونات المورد ({pendingSupplierCounts[supplierName]})</span>
                          </button>
                        )}

                        {receipt.status === 'pending' || !receipt.status ? (
                          <>
                            <button
                              onClick={() => handleApproveSingleReceipt(receipt)}
                              disabled={isProcessing}
                              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                              title="اعتماد الفاتورة بالكامل وترحيل الكميات للمخزون"
                            >
                              <Check size={16} strokeWidth={3} />
                              <span>{isMulti ? 'اعتماد الفاتورة' : 'اعتماد المنتج'}</span>
                            </button>

                            <button
                              onClick={() => onReviewReceipt(receipt)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
                              title="تعديل الأسعار أو الكمية قبل الاعتماد"
                            >
                              <Edit3 size={15} />
                              <span>تدقيق وتعديل</span>
                            </button>

                            <button
                              onClick={() => receipt.id && handleRejectReceipt(receipt.id)}
                              disabled={isProcessing}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                              title="رفض"
                            >
                              <XCircle size={18} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onReviewReceipt(receipt)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                          >
                            <Eye size={14} />
                            <span>عرض التفاصيل</span>
                          </button>
                        )}

                        <button
                          onClick={() => receipt.id && handleDeleteReceipt(receipt.id, receipt.receiptNumber)}
                          disabled={isProcessing}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Single Item Summary Grid OR Multi-Items Accordion */}
                    {!isMulti && firstItem ? (
                      (() => {
                        const isCarton = firstItem.unitType === 'carton';
                        const ppb = (firstItem.piecesPerBox && Number(firstItem.piecesPerBox) > 1) ? Number(firstItem.piecesPerBox) : 1;
                        const qtyDisplay = isCarton
                          ? `${firstItem.quantity || 0} كرتونة (${(Number(firstItem.quantity || 0) * ppb)} قطعة)`
                          : `${firstItem.quantity || 0} قطعة`;

                        const costDisplay = isCarton
                          ? `${formatCurrency(firstItem.costPrice || 0, settings.currency)} / كرتونة (${formatCurrency((Number(firstItem.costPrice || 0) / ppb), settings.currency)} / قطعة)`
                          : `${formatCurrency(firstItem.costPrice || 0, settings.currency)} / قطعة`;

                        const sellDisplay = isCarton && firstItem.sellingPrice
                          ? `${formatCurrency(firstItem.sellingPrice, settings.currency)} / كرتونة (${formatCurrency((Number(firstItem.sellingPrice) / ppb), settings.currency)} / قطعة)`
                          : firstItem.sellingPrice
                          ? `${formatCurrency(firstItem.sellingPrice, settings.currency)} / قطعة`
                          : '—';

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <div>
                              <span className="text-zinc-400 block text-[10px]">الكمية الواصلة:</span>
                              <strong className="text-amber-600 dark:text-amber-400 font-bold">{qtyDisplay}</strong>
                            </div>
                            <div>
                              <span className="text-zinc-400 block text-[10px]">سعر الشراء:</span>
                              <strong className="text-zinc-800 dark:text-zinc-200 font-mono text-[11px] block truncate" title={costDisplay}>
                                {costDisplay}
                              </strong>
                            </div>
                            <div>
                              <span className="text-zinc-400 block text-[10px]">سعر البيع:</span>
                              <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] block truncate" title={sellDisplay}>
                                {sellDisplay}
                              </strong>
                            </div>
                            <div>
                              <span className="text-zinc-400 block text-[10px]">إجمالي الصنف:</span>
                              <strong className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                                {formatCurrency(firstItem.total || ((Number(firstItem.quantity) || 0) * (Number(firstItem.costPrice) || 0)), settings.currency)}
                              </strong>
                            </div>
                          </div>
                        );
                      })()
                    ) : isMulti ? (
                      <div className="mt-1 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => receipt.id && toggleExpand(receipt.id)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Layers size={14} className="text-amber-500" />
                            <span>أصناف الفاتورة ({items.length} أصناف • {receipt.totalUnitsCount || items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)} وحدة)</span>
                          </span>
                          <span className="flex items-center gap-1 text-zinc-400">
                            <span>{isExpanded ? 'إخفاء الأصناف' : 'عرض تفاصيل الأصناف'}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="p-2 divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950 overflow-x-auto">
                            <table className="w-full text-xs text-right">
                              <thead>
                                <tr className="text-[10px] text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-1">
                                  <th className="py-1 px-2 font-medium">المنتج</th>
                                  <th className="py-1 px-2 font-medium">الكمية</th>
                                  <th className="py-1 px-2 font-medium">سعر الشراء</th>
                                  <th className="py-1 px-2 font-medium">سعر البيع</th>
                                  <th className="py-1 px-2 font-medium">الإجمالي</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                {items.map((item, idx) => {
                                  const isCarton = item.unitType === 'carton';
                                  const ppb = (item.piecesPerBox && Number(item.piecesPerBox) > 1) ? Number(item.piecesPerBox) : 1;
                                  return (
                                    <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                                      <td className="py-2 px-2 font-bold text-zinc-900 dark:text-white">
                                        {item.name}
                                      </td>
                                      <td className="py-2 px-2 text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">
                                        {isCarton 
                                          ? `${item.quantity} كرتونة (${(Number(item.quantity || 0) * ppb)} ق)` 
                                          : `${item.quantity} قطعة`}
                                      </td>
                                      <td className="py-2 px-2 font-mono whitespace-nowrap">
                                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                          {formatCurrency(item.costPrice || 0, settings.currency)}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 block">
                                          {isCarton ? `للكرتونة (${formatCurrency((Number(item.costPrice || 0) / ppb), settings.currency)}/ق)` : 'للقطعة'}
                                        </span>
                                      </td>
                                      <td className="py-2 px-2 font-mono whitespace-nowrap">
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                          {item.sellingPrice ? formatCurrency(item.sellingPrice, settings.currency) : '—'}
                                        </span>
                                        {item.sellingPrice && isCarton ? (
                                          <span className="text-[10px] text-zinc-400 block">
                                            للكرتونة ({formatCurrency((Number(item.sellingPrice) / ppb), settings.currency)}/ق)
                                          </span>
                                        ) : null}
                                      </td>
                                      <td className="py-2 px-2 font-mono font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                                        {formatCurrency(item.total || ((Number(item.quantity) || 0) * (Number(item.costPrice) || 0)), settings.currency)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            يمكن للمدير العام اعتماد كل منتج واصل بضغطة زر، أو تعديل أسعار الشراء والبيع والكميات قبل الترحيل.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-colors"
          >
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  );
}

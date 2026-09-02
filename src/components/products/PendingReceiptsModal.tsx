import React, { useState } from 'react';
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
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoodsReceipt } from '../../types';
import { useAppContext } from '../../AppContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { formatCurrency, formatAppDate, safeParseDate } from '../../lib/utils';
import { doc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, writeBatch, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/auditLogger';

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

  const receipts = localReceipts || propReceipts;

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
    const firstItem = receipt.items?.[0];
    const productName = firstItem?.name || 'المنتج';

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const receiptRef = doc(db, `users/${user.uid}/goodsReceipts`, receipt.id);
      
      for (const item of (receipt.items || [])) {
        const targetProdId = item.matchedProductId || item.id;
        if (targetProdId) {
          const prodRef = doc(db, `users/${user.uid}/products`, targetProdId);
          const addedPieces = item.unitType === 'carton' 
            ? (Number(item.quantity) || 0) * (Number(item.piecesPerBox) || 1)
            : (Number(item.quantity) || 0);

          const updateData: any = {
            quantity: increment(addedPieces),
            updatedAt: serverTimestamp()
          };

          if (item.costPrice && item.costPrice > 0) {
            updateData.purchasePrice = item.costPrice;
            if (item.piecesPerBox && item.piecesPerBox > 1) {
              updateData.boxPurchasePrice = item.costPrice * item.piecesPerBox;
            }
          }
          if (item.sellingPrice && item.sellingPrice > 0) {
            updateData.sellingPrice = item.sellingPrice;
          }

          batch.update(prodRef, updateData);

          const purchaseRef = doc(collection(db, `users/${user.uid}/purchases`));
          batch.set(purchaseRef, {
            productId: targetProdId,
            productName: item.name,
            qtyAdded: addedPieces,
            amount: Number(item.total) || (Number(item.costPrice || 0) * addedPieces),
            price: item.costPrice || 0,
            unitType: item.unitType,
            quantity: item.quantity,
            piecesPerBox: item.piecesPerBox || 1,
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

      await logAudit(
        'update',
        'purchase',
        receipt.id,
        receipt.receiptNumber || 'Goods Receipt',
        `اعتماد استلام منتج للمدير العام: ${productName}`
      );

      showToast(`تم اعتماد (${productName}) وإضافته للمخزون بنجاح ✅`, 'success');
      await handleForceRefresh();
    } catch (err: any) {
      console.error('Error approving receipt:', err);
      showToast('حدث خطأ أثناء اعتماد المنتج: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveAllPending = async () => {
    const pendingList = receipts.filter(r => r.status === 'pending' || !r.status);
    if (!user || pendingList.length === 0) return;

    if (!window.confirm(`هل أنت متأكد من اعتماد جميع أذونات الاستلام المعلقة (${pendingList.length} إذن منتج) وترحيلها فوراً للمخزن؟`)) {
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
            const addedPieces = item.unitType === 'carton' 
              ? (Number(item.quantity) || 0) * (Number(item.piecesPerBox) || 1)
              : (Number(item.quantity) || 0);

            const updateData: any = {
              quantity: increment(addedPieces),
              updatedAt: serverTimestamp()
            };

            if (item.costPrice && item.costPrice > 0) {
              updateData.purchasePrice = item.costPrice;
              if (item.piecesPerBox && item.piecesPerBox > 1) {
                updateData.boxPurchasePrice = item.costPrice * item.piecesPerBox;
              }
            }
            if (item.sellingPrice && item.sellingPrice > 0) {
              updateData.sellingPrice = item.sellingPrice;
            }

            batch.update(prodRef, updateData);

            const purchaseRef = doc(collection(db, `users/${user.uid}/purchases`));
            batch.set(purchaseRef, {
              productId: targetProdId,
              productName: item.name,
              qtyAdded: addedPieces,
              amount: Number(item.total) || (Number(item.costPrice || 0) * addedPieces),
              price: item.costPrice || 0,
              unitType: item.unitType,
              quantity: item.quantity,
              piecesPerBox: item.piecesPerBox || 1,
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

      showToast(`تم اعتماد جميع الأذونات (${pendingList.length} منتج) وترحيلها للمخزون بنجاح ✅`, 'success');
      await handleForceRefresh();
    } catch (err: any) {
      console.error('Error approving all receipts:', err);
      showToast('حدث خطأ أثناء الاعتماد الجماعي: ' + err.message, 'error');
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
      await deleteDoc(doc(db, `users/${user.uid}/goodsReceipts`, receiptId));
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
      await updateDoc(doc(db, `users/${user.uid}/goodsReceipts`, receiptId), {
        status: 'rejected',
        rejectedReason: reason,
        rejectedAt: serverTimestamp()
      });
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
        <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'
              }`}
            >
              <Clock size={16} />
              <span>بانتظار الاعتماد ({pendingCount})</span>
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
                  ? 'لا توجد منتجات بانتظار الاعتماد حالياً'
                  : activeTab === 'approved'
                  ? 'لا توجد أذونات استلام معتمدة بعد'
                  : 'لا توجد أذونات استلام مرفوضة'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
                {activeTab === 'pending'
                  ? 'عندما يسجل العامل أو أمين المخزن وصول منتج، يظهر المنتج هنا مباشرة للمدير العام لتدقيق سعر الشراء وسعر البيع واعتماده بضغطة واحدة.'
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

              const firstItem = receipt.items?.[0];
              const productName = firstItem?.name || receipt.receiptNumber || 'منتج مستلم';
              const isCarton = firstItem?.unitType === 'carton';
              const qtyDisplay = isCarton
                ? `${firstItem?.quantity || 0} كرتونة (${(Number(firstItem?.quantity || 0) * Number(firstItem?.piecesPerBox || 1))} قطعة)`
                : `${firstItem?.quantity || 0} قطعة`;

              return (
                <div
                  key={receipt.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 transition-all hover:border-amber-400 dark:hover:border-amber-600 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
                        <Package size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-black text-base text-zinc-900 dark:text-white truncate">
                            {productName}
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
                        </div>

                        {/* Product Arrival Specs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-2 bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                          <div>
                            <span className="text-zinc-400 block text-[10px]">الكمية الواصلة:</span>
                            <strong className="text-amber-600 dark:text-amber-400 font-bold">{qtyDisplay}</strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 block text-[10px]">سعر الشراء:</span>
                            <strong className="text-zinc-800 dark:text-zinc-200 font-mono">
                              {firstItem?.costPrice ? formatCurrency(firstItem.costPrice, settings.currency) : '—'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 block text-[10px]">سعر البيع:</span>
                            <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                              {firstItem?.sellingPrice ? formatCurrency(firstItem.sellingPrice, settings.currency) : '—'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 block text-[10px]">المورد:</span>
                            <strong className="text-zinc-700 dark:text-zinc-300 truncate block">
                              {receipt.supplierName || 'غير محدد'}
                            </strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <UserCheck size={13} className="text-zinc-400" />
                            <span>المستلم: <strong className="text-zinc-700 dark:text-zinc-300">{receipt.submittedBy?.staffName || 'الموظف'}</strong></span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar size={13} className="text-zinc-400" />
                            <span>{dateStr}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                      {receipt.status === 'pending' || !receipt.status ? (
                        <>
                          <button
                            onClick={() => handleApproveSingleReceipt(receipt)}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                            title="اعتماد هذا المنتج وترحيله فوراً للمخزون"
                          >
                            <Check size={16} strokeWidth={3} />
                            <span>اعتماد المنتج</span>
                          </button>

                          <button
                            onClick={() => onReviewReceipt(receipt)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
                            title="تعديل الأسعار أو الكمية قبل الاعتماد"
                          >
                            <Edit3 size={15} />
                            <span>فحص وتعديل</span>
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

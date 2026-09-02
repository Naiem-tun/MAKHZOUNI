import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp, 
  Timestamp, 
  Firestore 
} from 'firebase/firestore';
import { GoodsReceipt } from '../types';

export interface SyncSupplierFinancialsOptions {
  status?: 'approved' | 'rejected' | 'pending';
  finalTotal?: number;
  paymentMethod?: 'cash' | 'credit';
  supplierId?: string;
  supplierName?: string;
  invoiceNumber?: string;
  action?: 'approve' | 'reject' | 'delete' | 'update';
}

/**
 * دالة مركزية لمزامنة مدفوعات وحسابات المورد (supplierTransactions و debts)
 * مع أي تعديل أو اعتماد أو رفض أو حذف يجريه المدير العام على فاتورة الاستلام.
 */
export async function syncSupplierFinancialsForReceipt(
  db: Firestore,
  userId: string,
  receipt: Partial<GoodsReceipt>,
  options?: SyncSupplierFinancialsOptions
) {
  if (!db || !userId || !receipt) return;

  const targetStatus = options?.status || receipt.status || 'pending';
  const action = options?.action || (targetStatus === 'approved' ? 'approve' : targetStatus === 'rejected' ? 'reject' : 'update');
  const targetSupplierId = options?.supplierId || receipt.supplierId;
  const targetSupplierName = options?.supplierName || receipt.supplierName || 'مورد غير محدد';
  const targetPaymentMethod = options?.paymentMethod || receipt.paymentMethod || 'cash';
  const targetInvoiceNumber = options?.invoiceNumber || receipt.invoiceNumber || receipt.receiptNumber || 'آلية';

  // حساب الإجمالي النهائي الفعلي للأصناف إذا لم يُمرر صراحة
  let finalAmount = options?.finalTotal;
  if (finalAmount === undefined || finalAmount === null) {
    if (receipt.totalAmount !== undefined && receipt.totalAmount !== null && Number(receipt.totalAmount) > 0) {
      finalAmount = Number(receipt.totalAmount);
    } else {
      finalAmount = (receipt.items || []).reduce((sum, it) => {
        const itemTotal = Number(it.total) > 0 
          ? Number(it.total) 
          : ((Number(it.quantity) || 0) * (Number(it.costPrice) || 0));
        return sum + itemTotal;
      }, 0);
    }
  }
  finalAmount = parseFloat((Number(finalAmount) || 0).toFixed(3));

  const txCol = collection(db, `users/${userId}/supplierTransactions`);
  const debtsCol = collection(db, `users/${userId}/debts`);

  try {
    // 1. البحث عن أي معاملات مالية للمورد مرتبطة بهذا الإذن / الجلسة
    const matchingTxDocs: any[] = [];
    const seenTxIds = new Set<string>();

    if (receipt.id) {
      const qReceipt = query(txCol, where('receiptId', '==', receipt.id));
      const snapReceipt = await getDocs(qReceipt);
      snapReceipt.docs.forEach(d => {
        if (!seenTxIds.has(d.id)) {
          seenTxIds.add(d.id);
          matchingTxDocs.push(d);
        }
      });
    }

    if (receipt.sessionId) {
      const qSession = query(txCol, where('sessionId', '==', receipt.sessionId));
      const snapSession = await getDocs(qSession);
      snapSession.docs.forEach(d => {
        if (!seenTxIds.has(d.id)) {
          seenTxIds.add(d.id);
          matchingTxDocs.push(d);
        }
      });
    }

    if (receipt.supplierTransactionId && !seenTxIds.has(receipt.supplierTransactionId)) {
      try {
        const directDoc = doc(db, `users/${userId}/supplierTransactions`, receipt.supplierTransactionId);
        const snapDirect = await getDocs(query(txCol, where('__name__', '==', receipt.supplierTransactionId)));
        snapDirect.docs.forEach(d => {
          if (!seenTxIds.has(d.id)) {
            seenTxIds.add(d.id);
            matchingTxDocs.push(d);
          }
        });
      } catch (e) {
        // ignore
      }
    }

    // 2. البحث عن أي ديون (آجل) مرتبطة بهذا الإذن
    const matchingDebts: any[] = [];
    const seenDebtIds = new Set<string>();

    if (receipt.id) {
      const qDebt = query(debtsCol, where('receiptId', '==', receipt.id));
      const snapDebt = await getDocs(qDebt);
      snapDebt.docs.forEach(d => {
        if (!seenDebtIds.has(d.id)) {
          seenDebtIds.add(d.id);
          matchingDebts.push(d);
        }
      });
    }

    if (receipt.debtId && !seenDebtIds.has(receipt.debtId)) {
      try {
        const snapDirectDebt = await getDocs(query(debtsCol, where('__name__', '==', receipt.debtId)));
        snapDirectDebt.docs.forEach(d => {
          if (!seenDebtIds.has(d.id)) {
            seenDebtIds.add(d.id);
            matchingDebts.push(d);
          }
        });
      } catch (e) {
        // ignore
      }
    }

    // 3. حالة الرفض أو الحذف (Reject / Delete): إلغاء أو حذف المعاملات والدين المرتبط فوراً
    if (action === 'delete' || action === 'reject' || targetStatus === 'rejected') {
      for (const txDoc of matchingTxDocs) {
        await deleteDoc(txDoc.ref);
      }
      for (const debtDoc of matchingDebts) {
        await deleteDoc(debtDoc.ref);
      }
      return;
    }

    // 4. حالة الاعتماد أو التعديل (Approve / Update): تحديث المبلغ الدقيق في حساب المورد
    const txNote = targetStatus === 'approved'
      ? `فاتورة توريد معتمدة من المدير العام رقم #${targetInvoiceNumber} بقيمة ${finalAmount} د.ت (${targetPaymentMethod === 'cash' ? 'كاش' : 'آجل'})`
      : `فاتورة استلام بضائع رقم #${targetInvoiceNumber} بقيمة ${finalAmount} د.ت (بانتظار تدقيق المدير العام)`;

    if (matchingTxDocs.length > 0) {
      // تحديث المعاملة الأولى وحذف أي معاملات مكررة إن وُجدت
      const primaryTx = matchingTxDocs[0];
      await updateDoc(primaryTx.ref, {
        supplierId: targetSupplierId || primaryTx.data().supplierId,
        amount: finalAmount,
        note: txNote,
        status: targetStatus,
        receiptId: receipt.id || primaryTx.data().receiptId || null,
        sessionId: receipt.sessionId || primaryTx.data().sessionId || null,
        invoiceNumber: targetInvoiceNumber,
        paymentMethod: targetPaymentMethod,
        updatedAt: serverTimestamp()
      });

      // تنظيف أي معاملات مكررة ارتبطت بالخطأ
      for (let i = 1; i < matchingTxDocs.length; i++) {
        await deleteDoc(matchingTxDocs[i].ref);
      }
    } else if (targetSupplierId && finalAmount > 0) {
      // إذا لم تكن المعاملة مسجلة بعد، ننشئها مرتبطة بالإذن
      const newTxRef = await addDoc(txCol, {
        supplierId: targetSupplierId,
        amount: finalAmount,
        date: receipt.invoiceDate ? Timestamp.fromDate(new Date(receipt.invoiceDate)) : serverTimestamp(),
        note: txNote,
        status: targetStatus,
        receiptId: receipt.id || null,
        sessionId: receipt.sessionId || null,
        invoiceNumber: targetInvoiceNumber,
        paymentMethod: targetPaymentMethod,
        updatedAt: serverTimestamp()
      });

      // حفظ معرّف المعاملة في إذن الاستلام
      if (receipt.id) {
        try {
          await updateDoc(doc(db, `users/${userId}/goodsReceipts`, receipt.id), {
            supplierTransactionId: newTxRef.id,
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          // ignore
        }
      }
    }

    // 5. مزامنة قسم الديون (Debts) للمورد إذا كانت الفاتورة بالآجل (credit)
    if (targetPaymentMethod === 'credit' && finalAmount > 0 && targetStatus === 'approved') {
      if (matchingDebts.length > 0) {
        const primaryDebt = matchingDebts[0];
        await updateDoc(primaryDebt.ref, {
          totalAmount: finalAmount,
          customerName: `المورد: ${targetSupplierName}`,
          supplierId: targetSupplierId || null,
          history: [{
            type: 'debt',
            amount: finalAmount,
            date: new Date().toISOString(),
            note: `فاتورة شراء معتمدة رقم #${targetInvoiceNumber}`
          }],
          updatedAt: serverTimestamp()
        });

        for (let i = 1; i < matchingDebts.length; i++) {
          await deleteDoc(matchingDebts[i].ref);
        }
      } else {
        const newDebtRef = await addDoc(debtsCol, {
          customerName: `المورد: ${targetSupplierName}`,
          supplierId: targetSupplierId || null,
          receiptId: receipt.id || null,
          phone: '',
          totalAmount: finalAmount,
          status: 'unpaid',
          type: 'payable',
          history: [{
            type: 'debt',
            amount: finalAmount,
            date: new Date().toISOString(),
            note: `فاتورة شراء معتمدة رقم #${targetInvoiceNumber}`
          }],
          updatedAt: serverTimestamp()
        });

        if (receipt.id) {
          try {
            await updateDoc(doc(db, `users/${userId}/goodsReceipts`, receipt.id), {
              debtId: newDebtRef.id,
              updatedAt: serverTimestamp()
            });
          } catch (err) {
            // ignore
          }
        }
      }
    } else if (targetPaymentMethod === 'cash') {
      // إذا كانت كاش وتم تحويلها من آجل، نحذف أي دين كان مسجلاً عليها
      for (const debtDoc of matchingDebts) {
        await deleteDoc(debtDoc.ref);
      }
    }
  } catch (err) {
    console.error("Error in syncSupplierFinancialsForReceipt:", err);
  }
}

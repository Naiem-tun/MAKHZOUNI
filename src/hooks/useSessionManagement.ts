import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError } from '../lib/utils';
import { OperationType } from '../types';

export function useSessionManagement(user: any, activeSupplier: any, setActiveSupplier: any, isSessionSummaryOpen: boolean, setIsSessionSummaryOpen: any, showToast: any, t: any, settings?: any) {
  const [sessionFinalTotal, setSessionFinalTotal] = useState<string>('');
  const [sessionDifference, setSessionDifference] = useState<string>('');
  const [isSavingSession, setIsSavingSession] = useState(false);

  useEffect(() => {
    if (isSessionSummaryOpen && activeSupplier) {
      setSessionFinalTotal((activeSupplier.sessionTotal || 0).toFixed(3));
      setSessionDifference((0).toFixed(3));
    }
  }, [isSessionSummaryOpen, activeSupplier]);

  const handleEndSessionConfirm = async () => {
    if (!user || !activeSupplier || isSavingSession) return;
    
    setIsSavingSession(true);
    
    try {
      const supplierId = activeSupplier.id;
      const amount = Number(sessionFinalTotal) || 0;
      
      // ✅ 1. أغلق الـ modal أولاً للحصول على استجابة فورية فائقة السرعة
      setIsSessionSummaryOpen(false);
      
      if (amount > 0) {
        const txPath = `users/${user.uid}/supplierTransactions`;
        
        const docRef = await addDoc(collection(db, txPath), {
          supplierId: supplierId,
          amount: amount,
          date: Timestamp.now(),
          note: t('session_purchases_total') || 'إجمالي مشتريات الجلسة',
          updatedAt: serverTimestamp(),
        });

        // Record a single consolidated entry in the cash register
        if (settings?.enableCashRegister) {
          await addDoc(collection(db, `users/${user.uid}/cash_transactions`), {
            type: 'purchase',
            amount: amount,
            description: `${t('session_purchases_total') || 'إجمالي مشتريات الجلسة'}: ${activeSupplier.name}`,
            date: new Date().toISOString(),
            createdAt: serverTimestamp(),
            referenceId: docRef.id
          }).catch(err => {
            console.error("Error creating cash transaction for session total:", err);
          });
        }
      }
      
      showToast(t('session_saved_success') || 'تم حفظ الجلسة بنجاح ✅', 'success');
      setActiveSupplier(null);
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, "supplierTransactions");
      showToast(t('error_saving_session') || 'حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setIsSavingSession(false);
    }
  };

  return {
    sessionFinalTotal,
    setSessionFinalTotal,
    sessionDifference,
    setSessionDifference,
    isSavingSession,
    handleEndSessionConfirm
  };
}

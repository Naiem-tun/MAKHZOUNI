import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError } from '../lib/utils';
import { OperationType } from '../types';
import { syncTracker } from '../lib/syncTracker';
import { logAudit } from '../lib/auditLogger';

export function useSessionManagement(user: any, activeSupplier: any, setActiveSupplier: any, isSessionSummaryOpen: boolean, setIsSessionSummaryOpen: any, showToast: any, t: any, settings?: any) {
  const [sessionFinalTotal, setSessionFinalTotal] = useState<string>('');
  const [sessionDifference, setSessionDifference] = useState<string>('');
  const [recordAsExpense, setRecordAsExpense] = useState<boolean>(true);
  const [isSavingSession, setIsSavingSession] = useState(false);

  useEffect(() => {
    if (isSessionSummaryOpen && activeSupplier) {
      setSessionFinalTotal((activeSupplier.sessionTotal || 0).toFixed(3));
      setSessionDifference('');
      setRecordAsExpense(true);
    }
  }, [isSessionSummaryOpen, activeSupplier]);

  const handleEndSessionConfirm = async () => {
    if (!user || !activeSupplier || isSavingSession) return;
    
    setIsSavingSession(true);
    
    try {
      const supplierId = activeSupplier.id;
      const amount = Number(sessionFinalTotal) || 0;
      const extraTax = Number(sessionDifference) || 0;
      
      // ✅ 1. أغلق الـ modal أولاً للحصول على استجابة فورية فائقة السرعة
      setIsSessionSummaryOpen(false);
      
      if (amount > 0) {
        const txPath = `users/${user.uid}/supplierTransactions`;
        
        syncTracker.track(addDoc(collection(db, txPath), {
          supplierId: supplierId,
          amount: amount,
          date: Timestamp.now(),
          note: t('session_purchases_total') || 'إجمالي مشتريات الجلسة',
          updatedAt: serverTimestamp(),
        }).then(docRef => {
          // Do nothing
        })).catch(err => {
           console.error("Error saving session transaction:", err);
        });
      }

      // ✅ 2. ربط مبلغ الأداءات/الضرائب المضاف بقسم المصاريف إذا كان الخيار مفّعلاً (recordAsExpense)
      if (extraTax > 0 && recordAsExpense) {
        const expensesPath = `users/${user.uid}/expenses`;
        const supplierName = activeSupplier.name || t('supplier') || 'مورد';
        const expenseDesc = `TVA (${supplierName})`;

        syncTracker.track(addDoc(collection(db, expensesPath), {
          description: expenseDesc,
          amount: extraTax,
          category: t('taxes_and_fees') || 'ضرائب ورسوم',
          date: Timestamp.now(),
          audited: false
        }).then(docRef => {
          logAudit('create', 'expense', docRef.id, expenseDesc, `تسجيل مصروف تلقائي (أداءة/ضريبة) من حصة المورد بقيمة: ${extraTax}`);
        })).catch(err => {
          console.error("Error saving supplier tax expense:", err);
        });
      }
      
      if (extraTax > 0 && recordAsExpense) {
        showToast(t('session_saved_with_expense_success') || 'تم حفظ الجلسة وتسجيل الأداءات كمصروف بنجاح ✅', 'success');
      } else {
        showToast(t('session_saved_success') || 'تم حفظ الجلسة بنجاح ✅', 'success');
      }
      setActiveSupplier(null);
    } catch (err: any) {
      console.error(err);
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
    recordAsExpense,
    setRecordAsExpense,
    isSavingSession,
    handleEndSessionConfirm
  };
}

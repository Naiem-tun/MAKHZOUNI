import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, Timestamp, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, safeParseDate } from '../lib/utils';
import { OperationType } from '../types';
import { syncTracker } from '../lib/syncTracker';
import { logAudit } from '../lib/auditLogger';

export interface MissedVisitDay {
  dayIndex: number;
  date: Date;
  dayName: string;
  formattedDate: string;
}

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function useSessionManagement(
  user: any, 
  activeSupplier: any, 
  setActiveSupplier: any, 
  isSessionSummaryOpen: boolean, 
  setIsSessionSummaryOpen: any, 
  showToast: any, 
  t: any, 
  settings?: any
) {
  const [sessionFinalTotal, setSessionFinalTotal] = useState<string>('');
  const [sessionDifference, setSessionDifference] = useState<string>('');
  const [recordAsExpense, setRecordAsExpense] = useState<boolean>(true);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [missedVisitDays, setMissedVisitDays] = useState<MissedVisitDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const todayDate = new Date();
  const todayDayIndex = todayDate.getDay();
  const todayDayName = ARABIC_DAYS[todayDayIndex];

  useEffect(() => {
    if (isSessionSummaryOpen && activeSupplier && user) {
      setSessionFinalTotal((activeSupplier.sessionTotal || 0).toFixed(3));
      setSessionDifference('');
      setRecordAsExpense(true);

      const fetchMissedVisits = async () => {
        try {
          let visitDays: number[] = activeSupplier.visitDays || [];
          
          if (!visitDays || visitDays.length === 0) {
            const suppDocRef = doc(db, `users/${user.uid}/suppliers/${activeSupplier.id}`);
            const suppSnap = await getDoc(suppDocRef);
            if (suppSnap.exists()) {
              visitDays = suppSnap.data().visitDays || [];
            }
          }

          if (!visitDays || visitDays.length === 0) {
            setMissedVisitDays([]);
            setSelectedDate(new Date());
            return;
          }

          const now = new Date();
          const currentDay = now.getDay();
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - currentDay);
          startOfWeek.setHours(0, 0, 0, 0);

          const trackingStartDate = settings?.lastSuppliersClearDate 
            ? safeParseDate(settings.lastSuppliersClearDate) 
            : new Date(0);

          const txRef = collection(db, `users/${user.uid}/supplierTransactions`);
          const q = query(txRef, where('supplierId', '==', activeSupplier.id));
          const txSnap = await getDocs(q);
          const txList = txSnap.docs.map(d => d.data());

          const missed: MissedVisitDay[] = [];

          visitDays.forEach(day => {
            if (day < currentDay) {
              const targetDate = new Date(startOfWeek);
              targetDate.setDate(targetDate.getDate() + day);
              targetDate.setHours(12, 0, 0, 0);

              if (targetDate.getTime() >= trackingStartDate.getTime()) {
                const hasTx = txList.some(t => {
                  const txDate = safeParseDate(t.date);
                  return txDate.toDateString() === targetDate.toDateString();
                });

                if (!hasTx) {
                  missed.push({
                    dayIndex: day,
                    date: targetDate,
                    dayName: ARABIC_DAYS[day],
                    formattedDate: `${ARABIC_DAYS[day]} (${targetDate.toLocaleDateString('ar-TN', { day: 'numeric', month: 'numeric' })})`
                  });
                }
              }
            }
          });

          setMissedVisitDays(missed);
          if (missed.length > 0) {
            setSelectedDate(missed[missed.length - 1].date);
          } else {
            setSelectedDate(new Date());
          }
        } catch (err) {
          console.error("Error calculating missed visits for session:", err);
          setSelectedDate(new Date());
        }
      };

      fetchMissedVisits();
    }
  }, [isSessionSummaryOpen, activeSupplier, user, settings]);

  const handleEndSessionConfirm = async () => {
    if (!user || !activeSupplier || isSavingSession) return;
    
    setIsSavingSession(true);
    
    try {
      const supplierId = activeSupplier.id;
      const amount = Number(sessionFinalTotal) || 0;
      const extraTax = Number(sessionDifference) || 0;
      
      // ✅ 1. أغلق الـ modal أولاً للحصول على استجابة فورية فائقة السرعة
      setIsSessionSummaryOpen(false);
      
      const saveTimestamp = Timestamp.fromDate(selectedDate);

      if (amount > 0) {
        const txPath = `users/${user.uid}/supplierTransactions`;
        
        syncTracker.track(addDoc(collection(db, txPath), {
          supplierId: supplierId,
          amount: amount,
          date: saveTimestamp,
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
          date: saveTimestamp,
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
    handleEndSessionConfirm,
    selectedDate,
    setSelectedDate,
    missedVisitDays,
    todayDate,
    todayDayName
  };
}

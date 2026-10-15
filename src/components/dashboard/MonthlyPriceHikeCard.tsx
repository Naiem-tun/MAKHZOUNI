import React, { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { TrendingUp, Clock, Info, RefreshCw, Eye, ChevronLeft } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../AppContext';
import { formatCurrency, formatAppDate, safeParseDate } from '../../lib/utils';
import { PRICE_HIKE_COUNTER_DOC_PATH, syncAndRecalculatePriceHikes } from '../../lib/priceHikeTracker';
import { PriceHikeDetailsModal } from './PriceHikeDetailsModal';

export const MonthlyPriceHikeCard: React.FC = () => {
  const { user, settings } = useAppContext();
  const [currentAmount, setCurrentAmount] = useState<number>(0);
  const [lastResetDate, setLastResetDate] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const hasAutoSynced = useRef(false);

  const currency = settings.currency || 'د.ت';
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  useEffect(() => {
    if (!user) {
      setCurrentAmount(0);
      setLoading(false);
      return;
    }

    const docRef = doc(db, PRICE_HIKE_COUNTER_DOC_PATH(user.uid));
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const amt = Number(data.currentAmount) || 0;
          setCurrentAmount(amt);
          setLastResetDate(data.lastResetDate || null);

          // If counter is 0 on load and hasn't auto-synced yet, check past purchases once
          if (amt === 0 && !hasAutoSynced.current) {
            hasAutoSynced.current = true;
            syncAndRecalculatePriceHikes(user.uid).catch(console.error);
          }
        } else {
          setCurrentAmount(0);
          setLastResetDate(null);
          if (!hasAutoSynced.current) {
            hasAutoSynced.current = true;
            syncAndRecalculatePriceHikes(user.uid).catch(console.error);
          }
        }
        setLoading(false);
      },
      (error) => {
        console.error('Price hike counter listener error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncAndRecalculatePriceHikes(user.uid);
      setCurrentAmount(res);
    } catch (err) {
      console.error('Failed to sync price hike counter:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const formattedAmount = !showFinancials
    ? '••••••'
    : formatCurrency(currentAmount, currency, language);

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-rose-200/60 bg-gradient-to-br from-rose-50/70 via-white to-white p-4 shadow-sm dark:border-rose-900/30 dark:from-rose-950/20 dark:via-zinc-900 dark:to-zinc-900 transition-all">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100/80 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
              <TrendingUp size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  خسارة غلاء أسعار الشراء (تآكل الأرباح)
                </h3>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="text-zinc-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors p-0.5 rounded active:scale-95"
                  title="إعادة فحص كافة المشتريات واحتساب الفوارق"
                  aria-label="إعادة فحص المشتريات"
                >
                  <RefreshCw size={13} className={isSyncing ? 'animate-spin text-rose-600' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowInfo((prev) => !prev)}
                  className="text-zinc-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors p-0.5 rounded"
                  title="شرح العداد وكيفية حسابه"
                  aria-label="شرح العداد"
                >
                  <Info size={14} />
                </button>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                تراكم فوارق التكلفة على فواتير الشراء (السعر الجديد − السابق × الكمية)
              </p>
            </div>
          </div>

          <div className="text-left font-mono text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            {loading || isSyncing ? (
              <span className="text-sm font-normal text-zinc-400 flex items-center gap-1">
                <RefreshCw size={14} className="animate-spin" /> جاري الحساب...
              </span>
            ) : (
              <span>{currentAmount > 0 ? `-${formattedAmount}` : formattedAmount}</span>
            )}
          </div>
        </div>

        {/* Action Button: View Products that caused this price hike */}
        <div className="mt-3 pt-2.5 border-t border-rose-100/70 dark:border-rose-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowDetailsModal(true)}
            className="flex items-center justify-between sm:justify-start gap-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:hover:bg-rose-500/25 dark:text-rose-300 px-3 py-1.5 text-xs font-bold transition-all border border-rose-200/80 dark:border-rose-800/40 group w-full sm:w-auto"
          >
            <div className="flex items-center gap-1.5">
              <Eye size={14} className="group-hover:scale-110 transition-transform" />
              <span>كيف وصلت لهذا الرقم؟ تفاصيل المنتجات المسببة</span>
            </div>
            <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform shrink-0" />
          </button>

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
            <span className="rounded-md bg-rose-100/80 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-medium">
              شامل كافة المشتريات
            </span>
            {lastResetDate && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 hidden sm:inline">
                (آخر جرد: {formatAppDate(safeParseDate(lastResetDate), language)})
              </span>
            )}
          </div>
        </div>

        {showInfo && (
          <div className="mt-3 rounded-lg bg-white/90 p-3 text-xs leading-relaxed text-zinc-600 border border-rose-100 dark:bg-zinc-800/90 dark:text-zinc-300 dark:border-rose-900/40 shadow-xs animate-in fade-in duration-150">
            <p className="font-semibold text-rose-700 dark:text-rose-300 mb-1">
              كيف يحميك هذا العداد عند ثبات سعر البيع في السوق؟
            </p>
            <ul className="space-y-1 list-disc list-inside text-[11px] text-zinc-600 dark:text-zinc-400">
              <li>لا ينطلق الحساب من آخر جرد فقط، بل يحتسب التراكم الشامل لفوارق أسعار الشراء لكافة الفواتير المسجلة في حسابك.</li>
              <li>عندما يرفع المورد سعر التكلفة ولا تستطيع رفع سعر البيع التزاماً بالسوق، فإن كل مليم زيادة يدفعه التاجر يُخصم مباشرة من أرباحه.</li>
              <li>العداد يجمع تلقائياً: <strong>(السعر الجديد − السعر السابق) × الكمية المشتراة</strong> لكل دفعة.</li>
              <li>اضغط على زر <strong>«كيف وصلت لهذا الرقم؟»</strong> لرؤية قائمة المنتجات والكميات وفوارق الأسعار، مع إمكانية التصفية بين كافة المشتريات، أو ما بعد آخر جرد، أو هذا الشهر.</li>
              <li>يمكنك الضغط على زر التحديث <RefreshCw size={11} className="inline mx-0.5" /> في أي وقت لإعادة فحص كل المشتريات وتحديث التراكم فوراً.</li>
            </ul>
          </div>
        )}
      </div>

      {/* Details Breakdown Modal */}
      <PriceHikeDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
      />
    </>
  );
};


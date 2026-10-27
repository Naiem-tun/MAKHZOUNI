import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  X, 
  Calendar, 
  RotateCcw, 
  ShieldCheck, 
  Sparkles 
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  deleteDoc, 
  query, 
  orderBy, 
  Timestamp, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { PersonalExpense } from '../../types';
import { useAppContext } from '../../AppContext';
import { formatCurrency, cn, safeParseDate, formatAppDate, roundMoney } from '../../lib/utils';
import { CustomConfirmModal } from '../common/CustomConfirmModal';

interface PersonalExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_CHIPS = [
  'مصروف شخصي',
  'مصروف البيت'
];

export const PersonalExpensesModal: React.FC<PersonalExpensesModalProps> = ({
  isOpen,
  onClose
}) => {
  const { user, settings, showToast } = useAppContext();
  const [personalExpenses, setPersonalExpenses] = useState<PersonalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !isOpen) return;
    setLoading(true);
    const colRef = collection(db, `users/${user.uid}/personal_expenses`);
    const q = query(colRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        })) as PersonalExpense[];
        setPersonalExpenses(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching personal expenses:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isOpen]);

  const handleAddExpense = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || isSubmitting) return;

    const parsedAmount = roundMoney(parseFloat(amount.replace(',', '.')));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
      return;
    }

    const desc = description.trim() || 'مصروف شخصي';

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, `users/${user.uid}/personal_expenses`), {
        description: desc,
        amount: parsedAmount,
        date: Timestamp.now(),
        createdAt: Timestamp.now()
      });

      setAmount('');
      setDescription('');
      showToast('تم تسجيل المصروف بنجاح');
    } catch (err) {
      console.error('Failed to add personal expense:', err);
      showToast('فشل في تسجيل المصروف', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (item: PersonalExpense) => {
    if (!user || !item.id) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/personal_expenses`, item.id));
      showToast('تم حذف العملية');
    } catch (err) {
      console.error('Failed to delete personal expense:', err);
      showToast('حدث خطأ أثناء الحذف', 'error');
    }
  };

  const handleClearAllConfirm = async () => {
    if (!user || personalExpenses.length === 0) return;
    try {
      const batch = writeBatch(db);
      personalExpenses.forEach((item) => {
        if (item.id) {
          batch.delete(doc(db, `users/${user.uid}/personal_expenses`, item.id));
        }
      });
      await batch.commit();
      setShowClearConfirm(false);
      showToast('تم تصفير جميع العمليات بنجاح');
    } catch (err) {
      console.error('Error clearing personal expenses:', err);
      showToast('حدث خطأ أثناء تصفير العمليات', 'error');
    }
  };

  const totalAmount = personalExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" dir="rtl">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 text-right shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/90 flex items-center justify-between shrink-0">
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 bg-white dark:bg-zinc-800 p-2 rounded-xl shadow-sm border border-zinc-200/50 dark:border-zinc-700 active:scale-95 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <h2 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>دفتر المصروف الشخصي</span>
                  <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
                    <Wallet size={16} />
                  </div>
                </h2>
              </div>
              <div className="flex items-center gap-1.5 justify-end text-[10px] font-bold text-brand-600 dark:text-brand-400 mt-0.5">
                <ShieldCheck size={12} />
                <span>سجل مستقل تماماً — لا يتدخل في أرباح المحل ولا في الجرد</span>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Total Balance Card with Reset Button */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-brand-500/10 via-brand-500/5 to-transparent dark:from-brand-950/30 dark:via-zinc-900 dark:to-zinc-900 border border-brand-200/60 dark:border-brand-800/30">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-brand-700 dark:text-brand-400 uppercase tracking-wider block">
                    مجموع المصروف الشخصي المسجل
                  </span>
                  <div className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
                    {formatCurrency(totalAmount, settings.currency, settings.language)}
                  </div>
                  <div className="text-[10px] font-bold text-zinc-400">
                    {personalExpenses.length === 0 ? 'لا توجد عمليات مسجلة' : `${personalExpenses.length} عملية مسجلة`}
                  </div>
                </div>

                {personalExpenses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 active:scale-95 transition-all shadow-sm cursor-pointer"
                    title="تصفير وحذف جميع العمليات المسجلة"
                  >
                    <RotateCcw size={14} />
                    <span>تصفير العمليات</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mindful Budgeting Wisdom Banner */}
            <div className="p-3.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900/40 text-center shadow-xs">
              <p className="text-xs font-black text-brand-800 dark:text-brand-200 leading-relaxed">
                « الرغبات لا تنتهي، والميزانية لها حدود ، ميّز بين ما تحتاجه وما تشتهيه »
              </p>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddExpense} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                  <Plus size={14} className="text-brand-600 dark:text-brand-400" />
                  تسجيل مصروف شخصي جديد
                </span>
                <span className="text-[10px] font-bold text-zinc-400">سحب من الصندوق</span>
              </div>

              {/* Amount Input */}
              <div>
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">
                  المبلغ المطلوب سحبه
                </label>
                <div className="relative">
                  <input
                    type="search"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 text-right outline-none dark:bg-zinc-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 font-black text-xl text-brand-600 dark:text-brand-400 transition-all"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400 pointer-events-none">
                    {settings.currency}
                  </div>
                </div>
              </div>

              {/* Description Input */}
              <div>
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">
                  بيان المصروف (اختياري)
                </label>
                <input
                  type="search"
                  autoComplete="off"
                  placeholder="مثال: مصروف البيت، مصروف شخصي..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 p-2.5 text-right outline-none dark:bg-zinc-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 font-bold text-xs text-zinc-800 dark:text-zinc-100 transition-all"
                />
              </div>

              {/* Quick Suggestion Chips (Exactly 2 options as requested) */}
              <div className="flex gap-2 pt-1">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setDescription(chip)}
                    className={cn(
                      "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer",
                      description === chip
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-brand-50 dark:hover:bg-zinc-700"
                    )}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !amount.trim()}
                className="w-full mt-2 py-3 rounded-xl font-black text-xs text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.98] transition-all shadow-md shadow-brand-600/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} />
                <span>تسجيل المصروف الشخصي</span>
              </button>
            </form>

            {/* List of Registered Personal Expenses */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  سجل العمليات السابقة
                </span>
                <span className="text-[10px] font-bold text-zinc-400">
                  {personalExpenses.length} عملية
                </span>
              </div>

              {loading ? (
                <div className="py-8 flex justify-center">
                  <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent animate-spin rounded-full" />
                </div>
              ) : personalExpenses.length === 0 ? (
                <div className="py-8 text-center bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-2 px-4">
                  <div className="w-10 h-10 mx-auto rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-600 flex items-center justify-center">
                    <Wallet size={18} />
                  </div>
                  <p className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                    لا يوجد أي مصروف شخصي مسجل حالياً
                  </p>
                  <p className="text-[10px] font-medium text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    سجّل هنا أي مبالغ تسحبها لنفسك أو لمنزلك لتظل حسابات وأرباح متجرك دقيقة ونقية 100%.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-0.5">
                  {personalExpenses.map((item) => (
                    <motion.div
                      layout
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-800/90 border border-zinc-200/70 dark:border-zinc-800 shadow-sm"
                    >
                      {/* Clean title and date with NO icon in front */}
                      <div className="min-w-0 pr-1">
                        <div className="text-xs font-black text-zinc-900 dark:text-white truncate">
                          {item.description || 'مصروف شخصي'}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-zinc-400 font-bold mt-0.5">
                          <Calendar size={9} />
                          <span>{formatAppDate(safeParseDate(item.date), settings.language)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-black text-brand-600 dark:text-brand-400">
                          -{formatCurrency(item.amount, settings.currency, settings.language)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="p-1.5 rounded-lg text-zinc-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="حذف هذا المصروف"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 text-center shrink-0">
            <span className="text-[10px] font-bold text-zinc-400 flex items-center justify-center gap-1">
              <Sparkles size={11} className="text-brand-500" />
              تلميح: هذه البيانات لا تُخصم من أرباح المتجر في الجرد الدوري.
            </span>
          </div>
        </motion.div>
      </div>

      {/* Confirmation Modal for Resetting All Operations */}
      <CustomConfirmModal
        show={showClearConfirm}
        type="confirm"
        message="هل أنت متأكد من رغبتك في تصفير وحذف جميع عمليات المصروف الشخصي؟ لن يمكنك استرجاعها بعد التصفير."
        onConfirm={handleClearAllConfirm}
        onCancel={() => setShowClearConfirm(false)}
      />
    </>
  );
};
export default PersonalExpensesModal;

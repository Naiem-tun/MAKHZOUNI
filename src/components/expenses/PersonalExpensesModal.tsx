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
import { formatCurrency, safeParseDate, formatAppDate, roundMoney } from '../../lib/utils';
import { CustomConfirmModal } from '../common/CustomConfirmModal';
import { useFolioTheme } from '../folio/FolioPageChrome';

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
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" dir="rtl">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="relative w-full max-w-lg max-h-[92vh] flex flex-col border text-right shadow-2xl overflow-hidden transition-colors"
          style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
        >
          {/* Header */}
          <div
            className="px-4 py-3.5 sm:px-5 sm:py-4 border-b flex items-center justify-between gap-3 shrink-0"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="font-mono tabular-nums" style={{ color: theme.accent }}>01</span>
                <span style={{ color: theme.textMuted }}>سجل مستقل عن أرباح المحل والجرد</span>
              </div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2" style={{ color: theme.text }}>
                <Wallet size={16} style={{ color: theme.accent }} />
                <span>دفتر المصروف الشخصي</span>
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="p-1.5 border cursor-pointer shrink-0"
              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Total Balance Card with Reset Button */}
            <div
              className="p-4 border"
              style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRight: `4px solid ${theme.accent}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold block" style={{ color: theme.accent }}>
                    مجموع المصروف الشخصي المسجل
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-tight" style={{ color: theme.text }}>
                    {formatCurrency(totalAmount, settings.currency, settings.language)}
                  </div>
                  <div className="text-[11px] font-bold font-mono tabular-nums" style={{ color: theme.textMuted }}>
                    {personalExpenses.length === 0 ? 'لا توجد عمليات مسجلة' : `${personalExpenses.length} عملية مسجلة`}
                  </div>
                </div>

                {personalExpenses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 border text-xs font-black cursor-pointer transition-colors"
                    style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.negative, color: theme.negative }}
                    title="تصفير وحذف جميع العمليات المسجلة"
                  >
                    <RotateCcw size={13} />
                    <span>تصفير العمليات</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mindful Budgeting Wisdom Banner */}
            <div
              className="p-3 border text-center"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <p className="text-xs font-bold leading-relaxed" style={{ color: theme.textMuted }}>
                « الرغبات لا تنتهي، والميزانية لها حدود ، ميّز بين ما تحتاجه وما تشتهيه »
              </p>
            </div>

            {/* Quick Add Form */}
            <form
              onSubmit={handleAddExpense}
              className="p-4 border space-y-3"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black flex items-center gap-1.5" style={{ color: theme.text }}>
                  <Plus size={14} style={{ color: theme.accent }} />
                  <span>تسجيل مصروف شخصي جديد</span>
                </span>
                <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>سحب من الصندوق</span>
              </div>

              <div>
                <label className="text-[10px] font-bold block mb-1" style={{ color: theme.textMuted }}>
                  المبلغ المطلوب سحبه
                </label>
                <div className="relative flex items-center">
                  <input
                    type="search"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border p-3 text-right outline-none font-mono font-black text-xl tabular-nums"
                    style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.accent }}
                  />
                  <div className="absolute left-3 text-xs font-black pointer-events-none" style={{ color: theme.textMuted }}>
                    {settings.currency}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold block mb-1" style={{ color: theme.textMuted }}>
                  بيان المصروف (اختياري)
                </label>
                <input
                  type="search"
                  autoComplete="off"
                  placeholder="مثال: مصروف البيت، مصروف شخصي..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border p-2.5 text-right outline-none font-bold text-xs"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div className="flex gap-2 pt-1">
                {QUICK_CHIPS.map((chip) => {
                  const active = description === chip;
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setDescription(chip)}
                      className="flex-1 py-1.5 px-3 border text-xs font-bold text-center cursor-pointer transition-colors"
                      style={{
                        backgroundColor: active ? theme.accent : theme.surfaceMuted,
                        borderColor: active ? theme.accent : theme.border,
                        color: active ? theme.accentText : theme.text,
                      }}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !amount.trim()}
                className="w-full mt-2 py-3 border font-black text-xs disabled:opacity-45 disabled:pointer-events-none flex items-center justify-center gap-1.5 cursor-pointer transition-opacity hover:opacity-90"
                style={{ backgroundColor: theme.accent, borderColor: theme.accent, color: theme.accentText }}
              >
                <Plus size={15} />
                <span>تسجيل المصروف الشخصي</span>
              </button>
            </form>

            {/* List of Registered Personal Expenses */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-black" style={{ color: theme.textMuted }}>
                  سجل العمليات السابقة
                </span>
                <span className="text-[11px] font-mono tabular-nums font-bold" style={{ color: theme.textMuted }}>
                  {personalExpenses.length} عملية
                </span>
              </div>

              {loading ? (
                <div className="py-8 flex justify-center">
                  <div className="w-5 h-5 border-2 border-t-transparent animate-spin rounded-full" style={{ borderColor: theme.accent, borderTopColor: 'transparent' }} />
                </div>
              ) : personalExpenses.length === 0 ? (
                <div
                  className="py-8 text-center border border-dashed space-y-2 px-4"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <Wallet size={20} className="mx-auto" style={{ color: theme.accent }} />
                  <p className="text-xs font-black" style={{ color: theme.text }}>
                    لا يوجد أي مصروف شخصي مسجل حالياً
                  </p>
                  <p className="text-[11px] max-w-xs mx-auto leading-relaxed" style={{ color: theme.textMuted }}>
                    سجّل هنا أي مبالغ تسحبها لنفسك أو لمنزلك لتظل حسابات وأرباح متجرك دقيقة ونقية 100%.
                  </p>
                </div>
              ) : (
                <div
                  className="border divide-y max-h-[280px] overflow-y-auto"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  {personalExpenses.map((item) => (
                    <motion.div
                      layout
                      key={item.id}
                      className="flex items-center justify-between p-3"
                      style={{ borderColor: theme.border }}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="text-xs font-black truncate" style={{ color: theme.text }}>
                          {item.description || 'مصروف شخصي'}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold mt-0.5" style={{ color: theme.textMuted }}>
                          <Calendar size={10} />
                          <span>{formatAppDate(safeParseDate(item.date), settings.language)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-black font-mono tabular-nums" style={{ color: theme.negative }}>
                          -{formatCurrency(item.amount, settings.currency, settings.language)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="p-1.5 border cursor-pointer transition-colors"
                          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.negative }}
                          title="حذف هذا المصروف"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div
            className="p-3 border-t text-center shrink-0"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <span className="text-[10px] font-bold flex items-center justify-center gap-1.5" style={{ color: theme.textMuted }}>
              <ShieldCheck size={12} style={{ color: theme.accent }} />
              <span>تلميح: هذه البيانات لا تُخصم من أرباح المتجر في الجرد الدوري.</span>
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

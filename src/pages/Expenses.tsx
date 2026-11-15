import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, doc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Expense } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Plus, Trash2, X, Search } from 'lucide-react';
import { formatCurrency, safeParseDate, formatAppDate, roundMoney } from '../lib/utils';
import { logAudit } from '../lib/auditLogger';
import { PersonalExpensesModal } from '../components/expenses/PersonalExpensesModal';
import { FolioSmoothTrendCard, useFolioTheme } from '../components/folio/FolioPageChrome';
import { matchesQuery } from '../components/dashboard/PurchaseVarianceModal';

export default function Expenses() {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPersonalModalOpen, setIsPersonalModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'audited' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('عام');

  const { theme } = useFolioTheme(
    Boolean(settings.darkMode),
    settings.folioThemeId,
  );
  const showFinancials = settings.showFinancials ?? true;
  const language = settings.language || 'ar';
  const formatPrivateValue = (val: number) =>
    !showFinancials ? '••••••' : formatCurrency(val, settings.currency, language);

  useEffect(() => {
    if (!user) return;
    const expensesPath = `users/${user.uid}/expenses`;
    const q = query(
      collection(db, expensesPath),
      orderBy('date', 'desc')
    );

    return onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
      setLoading(false);
    });
  }, [user]);

  const handleAddExpense = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!user) return;
    const amount = roundMoney(parseFloat(expenseAmount.replace(',', '.')));
    const description = expenseDescription.trim() || t('expense');
    const category = expenseCategory || 'عام';

    if (isNaN(amount) || amount <= 0) return;

    showToast(t('expense_added_success'));
    setIsModalOpen(false);
    setExpenseAmount('');
    setExpenseDescription('');
    setExpenseCategory('عام');

    try {
      addDoc(collection(db, `users/${user.uid}/expenses`), {
        description,
        amount,
        category,
        date: Timestamp.now(),
        audited: false
      }).then((docRef) => {
        logAudit('create', 'expense', docRef.id, description, `تسجيل مصروف جديد بقيمة: ${roundMoney(amount)}`);
      }).catch(err => {
        console.error("Async expense add failed:", err);
      });
    } catch (err) {
      console.error("Failed to add expense:", err);
    }
  };

  const handleDeleteExpense = (expense: Expense) => {
    if (!user || !expense.id) return;
    deleteDoc(doc(db, `users/${user.uid}/expenses`, expense.id)).then(() => {
      logAudit('delete', 'expense', expense.id!, expense.description, `حذف مصروف بقيمة: ${roundMoney(expense.amount)}`);
    }).catch(console.error);
  };

  const getCategoryLabel = (cat?: string) => {
    if (!cat || cat === 'عام') return t('general_cat');
    if (cat === 'فواتير') return t('bills_cat');
    if (cat === 'كراء') return t('rent_cat');
    if (cat === 'سلع') return t('goods_transport_cat');
    if (cat === 'أخرى') return t('other_cat');
    return cat;
  };

  const summary = useMemo(() => {
    const pendingTotal = expenses.filter(e => !e.audited).reduce((s, e) => s + (e.amount || 0), 0);
    const auditedTotal = expenses.filter(e => e.audited).reduce((s, e) => s + (e.amount || 0), 0);
    const pendingCount = expenses.filter(e => !e.audited).length;
    const auditedCount = expenses.filter(e => e.audited).length;
    return { pendingTotal, auditedTotal, pendingCount, auditedCount };
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim();
    return expenses.filter(exp => {
      if (filter === 'pending' && exp.audited) return false;
      if (filter === 'audited' && !exp.audited) return false;
      if (q) {
        return (
          matchesQuery(exp.description, q) ||
          matchesQuery(getCategoryLabel(exp.category), q)
        );
      }
      return true;
    });
  }, [expenses, filter, searchQuery]);

  const displayTotal = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; amount: number; count: number }>();
    filteredExpenses.forEach((exp) => {
      const label = getCategoryLabel(exp.category);
      const cur = map.get(label) || { label, amount: 0, count: 0 };
      cur.amount += exp.amount || 0;
      cur.count += 1;
      map.set(label, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  const displayLabel = filter === 'pending'
    ? t('pending_expenses')
    : filter === 'audited'
      ? t('audited_expenses')
      : t('all_expenses');

  return (
    <div
      className="min-h-screen px-2.5 sm:px-5 pt-3 pb-24 transition-colors"
      style={{ backgroundColor: theme.bg, color: theme.text }}
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto space-y-5">
        {/* FOLIO HEADER */}
        <header
          className="border-b pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-right"
          style={{ borderColor: theme.border }}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: theme.textMuted }}>
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                FOLIO
              </span>
              <span aria-hidden="true">·</span>
              <span>{t('store_budget')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: theme.text }}>
              {t('expenses')}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: theme.text,
                color: theme.surface,
                borderColor: theme.text,
              }}
            >
              <Plus size={14} />
              <span>{t('add_expense')}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPersonalModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <Wallet size={14} style={{ color: theme.accent }} />
              <span>المصروف الشخصي</span>
            </button>
          </div>
        </header>

        {/* SECTION 01: 3-CELL EXPENSES KPI STRIP */}
        <section
          className="border"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="px-4 py-2.5 border-b flex items-center justify-between"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                01
              </span>
              <span>ملخص المصاريف والتصفية</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
              {expenses.length} سجل إجمالاً
            </span>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse"
            style={{ borderColor: theme.border }}
          >
            <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                {displayLabel} (الفلتر النشط)
              </div>
              <div
                className="text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-tight"
                style={{ color: theme.negative }}
              >
                {formatPrivateValue(displayTotal)}
              </div>
              <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                {filteredExpenses.length} عملية مطابقة
              </div>
            </div>

            <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                معلق بانتظار الجرد
              </div>
              <div
                className="text-xl sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.text }}
              >
                {formatPrivateValue(summary.pendingTotal)}
              </div>
              <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                {summary.pendingCount} مصروف حالي
              </div>
            </div>

            <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                تمت تسويته في الجرد
              </div>
              <div
                className="text-xl sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.positive }}
              >
                {formatPrivateValue(summary.auditedTotal)}
              </div>
              <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                {summary.auditedCount} مصروف مجرود
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 02: SMOOTH CURVE + CATEGORY BREAKDOWN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-7">
            <FolioSmoothTrendCard
              sectionIndex="02.أ"
              kicker="المسار الزمني"
              title="منحنى المصاريف اليومية"
              items={filteredExpenses}
              theme={theme}
              language={language}
              formatValue={formatPrivateValue}
              t={t}
              unitLabel="مصروف"
              emptyMessage="لا توجد مصاريف مسجلة في هذه الفترة لعرض المنحنى."
              gradientId="folioExpensesAreaGrad"
            />
          </div>

          <section
            className="lg:col-span-5 border flex flex-col text-right"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div
              className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: theme.border }}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                    02.ب
                  </span>
                  <span style={{ color: theme.textMuted }}>التصنيف</span>
                </div>
                <h2 className="text-sm sm:text-base font-black">توزيع المصاريف حسب الفئة</h2>
              </div>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="p-8 text-center text-xs font-bold flex-1 flex items-center justify-center" style={{ color: theme.textMuted }}>
                {t('no_data_available')}
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr
                      className="border-b font-bold"
                      style={{
                        borderColor: theme.border,
                        backgroundColor: theme.surfaceMuted,
                        color: theme.textMuted,
                      }}
                    >
                      <th className="py-2.5 px-3">الفئة</th>
                      <th className="py-2.5 px-3">العدد</th>
                      <th className="py-2.5 px-3">الحصة</th>
                      <th className="py-2.5 px-3">المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBreakdown.map((cat, idx) => {
                      const pct = displayTotal > 0 ? Math.round((cat.amount / displayTotal) * 100) : 0;
                      return (
                        <tr
                          key={cat.label}
                          className="border-b last:border-b-0"
                          style={{ borderColor: theme.border }}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-bold">{cat.label}</div>
                            <div
                              className="w-full h-1 mt-1.5 overflow-hidden"
                              style={{ backgroundColor: theme.surfaceMuted }}
                            >
                              <div
                                className="h-full"
                                style={{
                                  width: `${Math.max(4, pct)}%`,
                                  backgroundColor: theme.series[idx % theme.series.length],
                                }}
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums">{cat.count}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums" style={{ color: theme.textMuted }}>
                            {pct}%
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums font-black">
                            {formatPrivateValue(cat.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* SECTION 03: EXPENSES LEDGER TABLE */}
        <section
          className="border text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ borderColor: theme.border }}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                  03
                </span>
                <span style={{ color: theme.textMuted }}>السجل التفصيلي</span>
              </div>
              <h2 className="text-base font-black">{t('operation_history')}</h2>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 border sm:w-56"
                style={{ backgroundColor: theme.bg, borderColor: theme.border }}
              >
                <Search size={13} style={{ color: theme.textMuted }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالوصف أو الفئة..."
                  className="bg-transparent text-xs w-full focus:outline-none"
                  style={{ color: theme.text }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="مسح البحث"
                    className="cursor-pointer"
                    style={{ color: theme.textMuted }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                {[
                  { id: 'pending', label: t('current') },
                  { id: 'audited', label: t('audited') },
                  { id: 'all', label: t('all') },
                ].map((opt) => {
                  const active = filter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFilter(opt.id as any)}
                      className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      style={{
                        backgroundColor: active ? theme.text : theme.surfaceMuted,
                        color: active ? theme.surface : theme.text,
                        borderColor: active ? theme.text : theme.border,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <div
                className="w-6 h-6 border-2 border-t-transparent animate-spin rounded-full"
                style={{ borderColor: theme.accent, borderTopColor: 'transparent' }}
              />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold" style={{ color: theme.textMuted }}>
              {filter === 'pending' ? t('no_expenses_match') : t('no_data_available')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr
                    className="border-b font-bold"
                    style={{
                      borderColor: theme.border,
                      backgroundColor: theme.surfaceMuted,
                      color: theme.textMuted,
                    }}
                  >
                    <th className="py-2.5 px-3">البيان والفئة</th>
                    <th className="py-2.5 px-3">التاريخ</th>
                    <th className="py-2.5 px-3">الحالة</th>
                    <th className="py-2.5 px-3">المبلغ</th>
                    <th className="py-2.5 px-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b last:border-b-0 transition-opacity"
                      style={{
                        borderColor: theme.border,
                        opacity: expense.audited ? 0.72 : 1,
                      }}
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-xs sm:text-sm" style={{ color: theme.text }}>
                          {expense.description}
                        </div>
                        {expense.category && (
                          <div className="text-[11px]" style={{ color: theme.textMuted }}>
                            {getCategoryLabel(expense.category)}
                          </div>
                        )}
                      </td>
                      <td
                        className="py-3 px-3 font-mono tabular-nums whitespace-nowrap"
                        style={{ color: theme.textMuted }}
                      >
                        {formatAppDate(safeParseDate(expense.date), language, t)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-bold">
                        <span
                          style={{
                            color: expense.audited ? theme.positive : theme.accent,
                          }}
                        >
                          {expense.audited ? t('audited_label') : t('waiting_label')}
                        </span>
                      </td>
                      <td
                        className="py-3 px-3 font-mono tabular-nums font-black whitespace-nowrap"
                        style={{
                          color: expense.audited ? theme.textMuted : theme.negative,
                        }}
                      >
                        -{formatPrivateValue(expense.amount)}
                      </td>
                      <td className="py-3 px-3 text-left">
                        {!expense.audited && (
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(expense)}
                            className="p-1.5 border cursor-pointer transition-colors"
                            style={{
                              borderColor: theme.border,
                              color: theme.negative,
                            }}
                            title={t('delete')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Add Expense Modal (Folio Styled) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-sm border p-5 sm:p-6 text-right shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
              dir="rtl"
            >
              <div
                className="flex items-center justify-between pb-3 mb-4 border-b"
                style={{ borderColor: theme.border }}
              >
                <h2 className="text-lg font-black">{t('add_expense_title')}</h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 border cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block" style={{ color: theme.textMuted }}>
                    {t('amount_required')}
                  </label>
                  <div className="relative">
                    <input
                      type="search"
                      name="app_expense_amt"
                      inputMode="decimal"
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-protonpass-ignore="true"
                      data-form-type="other"
                      placeholder="0.000"
                      required
                      autoFocus
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddExpense(e);
                      }}
                      className="w-full border p-3 text-right outline-none font-mono font-black text-2xl tabular-nums"
                      style={{
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                        color: theme.accent,
                      }}
                    />
                    <div
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold"
                      style={{ color: theme.textMuted }}
                    >
                      {settings.currency}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold block" style={{ color: theme.textMuted }}>
                    {t('description_optional')}
                  </label>
                  <input
                    type="search"
                    name="app_expense_desc"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
                    data-form-type="other"
                    placeholder={t('expense_placeholder')}
                    value={expenseDescription}
                    onChange={(e) => setExpenseDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddExpense(e);
                    }}
                    className="w-full border p-3 text-right outline-none font-bold text-sm"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold block" style={{ color: theme.textMuted }}>
                    {t('category')}
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full border p-3 text-right outline-none font-bold text-sm"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  >
                    <option value="عام">{t('general_cat')}</option>
                    <option value="فواتير">{t('bills_cat')}</option>
                    <option value="كراء">{t('rent_cat')}</option>
                    <option value="سلع">{t('goods_transport_cat')}</option>
                    <option value="أخرى">{t('other_cat')}</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleAddExpense()}
                    className="flex-1 py-2.5 text-xs font-black text-white border cursor-pointer"
                    style={{
                      backgroundColor: theme.negative,
                      borderColor: theme.negative,
                    }}
                  >
                    {t('confirm_expense')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 text-xs font-bold border cursor-pointer"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dedicated Personal Expenses Modal */}
      <PersonalExpensesModal
        isOpen={isPersonalModalOpen}
        onClose={() => setIsPersonalModalOpen(false)}
      />
    </div>
  );
}

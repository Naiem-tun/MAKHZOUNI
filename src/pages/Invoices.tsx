import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  Coins,
  Search,
  X,
  Filter,
  Trash2,
  FileText,
  RotateCcw,
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { formatCurrency, safeParseDate, cleanQuantity } from '../lib/utils';
import { CustomConfirmModal } from '../components/common/CustomConfirmModal';
import { useFolioTheme } from '../components/folio/FolioPageChrome';

export default function Invoices() {
  const { t } = useTranslation();
  const { settings, user } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);

  // Advanced Filtering & Sorting States
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'yesterday' | 'last7days' | 'custom'>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'profit_desc' | 'profit_asc'>('date_desc');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showDeleteInvoices, setShowDeleteInvoices] = useState(false);
  const [invoicesLimit, setInvoicesLimit] = useState(100);

  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    let unsubInvoices: any;
    let unsubProducts: any;

    try {
      const productsPath = `users/${uid}/products`;
      unsubProducts = onSnapshot(collection(db, productsPath), (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });

      const invoicesPath = `users/${uid}/invoices`;
      const invoicesQuery = query(collection(db, invoicesPath), orderBy('createdAt', 'desc'), limit(invoicesLimit));
      unsubInvoices = onSnapshot(invoicesQuery, (snap) => {
        setInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }

    return () => {
      if (unsubInvoices) unsubInvoices();
      if (unsubProducts) unsubProducts();
    };
  }, [user, invoicesLimit]);

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete || !user) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, `users/${user.uid}/invoices`, invoiceToDelete.id));

      if (invoiceToDelete.deductedFrom !== 'none') {
        const mode = invoiceToDelete.deductedFrom;
        const isCashierOnly = mode === 'cashier' || (mode === undefined && settings.posDeductInventory === false);

        (invoiceToDelete.items || []).forEach((item: any) => {
          const p = products.find((prod) => prod.id === item.productId);
          if (p) {
            const productRef = doc(db, `users/${user.uid}/products`, item.productId);

            let restoreQty = item.deductedQuantity;
            if (restoreQty === undefined || restoreQty === null) {
              const isKgProduct = p.unit === 'kg';
              const subItems = p.subItemsPerPiece || 1;
              if (item.saleMode === 'box' && p.piecesPerBox) {
                restoreQty = cleanQuantity((Number(item.quantity) || 0) * p.piecesPerBox);
              } else if (item.saleMode === 'subpiece') {
                restoreQty = cleanQuantity((Number(item.quantity) || 0) / subItems);
              } else if (item.saleMode === 'gram') {
                if (isKgProduct && subItems > 1) {
                  restoreQty = cleanQuantity(((Number(item.quantity) || 0) / subItems) / 100);
                } else {
                  restoreQty = cleanQuantity((Number(item.quantity) || 0) / 1000);
                }
              } else if (item.saleMode === 'kg') {
                if (isKgProduct && subItems > 1) {
                  restoreQty = cleanQuantity(((Number(item.quantity) || 0) / subItems) * 10);
                } else {
                  restoreQty = cleanQuantity(Number(item.quantity) || 0);
                }
              } else {
                restoreQty = cleanQuantity(Number(item.quantity) || 0);
              }
            } else {
              restoreQty = cleanQuantity(restoreQty);
            }

            const currentPosQty = cleanQuantity(p.posQuantity !== undefined ? p.posQuantity : p.quantity);
            const currentQty = cleanQuantity(p.quantity || 0);

            if (isCashierOnly) {
              batch.update(productRef, {
                posQuantity: cleanQuantity(currentPosQty + restoreQty),
                updatedAt: serverTimestamp(),
              });
            } else {
              batch.update(productRef, {
                quantity: cleanQuantity(currentQty + restoreQty),
                posQuantity: cleanQuantity(currentPosQty + restoreQty),
                updatedAt: serverTimestamp(),
              });
            }
          }
        });
      }

      await batch.commit();
      setDeleteConfirmOpen(false);
      setInvoiceToDelete(null);
    } catch (error) {
      console.error('Error deleting invoice: ', error);
    }
  };

  const filteredInvoices = useMemo(() => {
    let result = [...invoices];

    if (searchTerm.trim()) {
      const term = (searchTerm || '').toLowerCase();
      result = result.filter((inv) => {
        const matchesNum = (inv.invoiceNumber?.toString() || '').toLowerCase().includes(term);
        const matchesProduct = (inv.items || []).some((item: any) =>
          (item.name || '').toLowerCase().includes(term),
        );
        return matchesNum || matchesProduct;
      });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    if (dateRange === 'today') {
      result = result.filter((inv) => safeParseDate(inv.createdAt) >= startOfToday);
    } else if (dateRange === 'yesterday') {
      result = result.filter((inv) => {
        const d = safeParseDate(inv.createdAt);
        return d >= startOfYesterday && d < startOfToday;
      });
    } else if (dateRange === 'last7days') {
      result = result.filter((inv) => safeParseDate(inv.createdAt) >= sevenDaysAgo);
    } else if (dateRange === 'custom') {
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        result = result.filter((inv) => safeParseDate(inv.createdAt) >= sDate);
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        result = result.filter((inv) => safeParseDate(inv.createdAt) <= eDate);
      }
    }

    result.sort((a, b) => {
      const dateA = safeParseDate(a.createdAt).getTime();
      const dateB = safeParseDate(b.createdAt).getTime();
      const amtA = a.totalAmount || 0;
      const amtB = b.totalAmount || 0;
      const prfA = a.totalProfit || 0;
      const prfB = b.totalProfit || 0;

      if (sortBy === 'date_desc') return dateB - dateA;
      if (sortBy === 'date_asc') return dateA - dateB;
      if (sortBy === 'amount_desc') return amtB - amtA;
      if (sortBy === 'amount_asc') return amtA - amtB;
      if (sortBy === 'profit_desc') return prfB - prfA;
      if (sortBy === 'profit_asc') return prfA - prfB;
      return 0;
    });

    return result;
  }, [invoices, searchTerm, dateRange, startDate, endDate, sortBy]);

  const filteredStats = useMemo(() => {
    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalProfit = filteredInvoices.reduce((sum, inv) => sum + (inv.totalProfit || 0), 0);
    const count = filteredInvoices.length;
    const averageTicket = count > 0 ? totalAmount / count : 0;
    return { totalAmount, totalProfit, count, averageTicket };
  }, [filteredInvoices]);

  const resetFilters = () => {
    setSearchTerm('');
    setDateRange('today');
    setStartDate('');
    setEndDate('');
    setSortBy('date_desc');
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: theme.accent, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div
      className="-mx-2.5 sm:mx-0 max-w-7xl mx-auto pb-24 pt-1 animate-fade-in space-y-4"
      style={{ color: theme.text }}
    >
      {/* Editorial Header */}
      <header
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b"
        style={{ borderColor: theme.border }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
              01
            </span>
            <span style={{ color: theme.textMuted }}>
              المبيعات · التقارير
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            {t('sales_reports') || 'تقارير المبيعات'}
          </h1>
          <p className="text-xs sm:text-sm" style={{ color: theme.textMuted }}>
            تابع وإدارة سجل الفواتير والمبيعات بدقة مع الفلاتر المتقدمة
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(searchTerm || dateRange !== 'today' || sortBy !== 'date_desc') && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-2 text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.textMuted,
              }}
            >
              <RotateCcw size={14} />
              <span>إعادة ضبط</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowDeleteInvoices(!showDeleteInvoices)}
            className="p-2.5 border transition-colors cursor-pointer"
            style={{
              backgroundColor: showDeleteInvoices ? theme.negative : theme.surface,
              borderColor: showDeleteInvoices ? theme.negative : theme.border,
              color: showDeleteInvoices ? '#FFFFFF' : theme.textMuted,
            }}
            title="وضع الحذف"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      {/* 4-Cell Editorial KPI Strip */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 border divide-y lg:divide-y-0 divide-x divide-x-reverse"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
          <span className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>
            إجمالي المبيعات
          </span>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums" dir="ltr" style={{ color: theme.accent }}>
            {showFinancials ? formatCurrency(filteredStats.totalAmount, settings.currency, language) : '••••••'}
          </div>
        </div>

        <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
          <span className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>
            صافي الربح
          </span>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums" dir="ltr" style={{ color: theme.positive }}>
            {showFinancials ? formatCurrency(filteredStats.totalProfit, settings.currency, language) : '••••••'}
          </div>
        </div>

        <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
          <span className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>
            عدد الفواتير
          </span>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums">
            {filteredStats.count}
          </div>
        </div>

        <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
          <span className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>
            متوسط الفاتورة
          </span>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums" dir="ltr">
            {showFinancials ? formatCurrency(filteredStats.averageTicket, settings.currency, language) : '••••••'}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {/* Search & Advanced Filters Strip */}
        {invoices.length > 0 && (
          <div
            className="p-3 border space-y-3"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: theme.textMuted }}
                />
                <input
                  type="search"
                  name="invoices_search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  placeholder="البحث برقم الفاتورة أو اسم منتج..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-8 pr-9 border text-sm font-medium outline-none transition-colors text-right"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    style={{ color: theme.textMuted }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className="h-10 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border transition-colors cursor-pointer"
                style={{
                  backgroundColor:
                    showFiltersPanel || dateRange !== 'today' || sortBy !== 'date_desc'
                      ? theme.text
                      : theme.surfaceMuted,
                  borderColor:
                    showFiltersPanel || dateRange !== 'today' || sortBy !== 'date_desc'
                      ? theme.text
                      : theme.border,
                  color:
                    showFiltersPanel || dateRange !== 'today' || sortBy !== 'date_desc'
                      ? theme.surface
                      : theme.text,
                }}
              >
                <Filter size={15} />
                <span>تصفية</span>
              </button>
            </div>

            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: showFiltersPanel ? 'auto' : 0,
                opacity: showFiltersPanel ? 1 : 0,
                marginTop: showFiltersPanel ? 12 : 0,
                paddingTop: showFiltersPanel ? 12 : 0,
              }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden space-y-4 border-t"
              style={{ borderColor: theme.border }}
            >
              <div className="space-y-2">
                <label className="block text-xs font-black" style={{ color: theme.textMuted }}>
                  نطاق تاريخ الفاتورة
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'today', label: 'اليوم' },
                    { id: 'yesterday', label: 'الأمس' },
                    { id: 'last7days', label: 'آخر 7 أيام' },
                    { id: 'custom', label: 'تاريخ مخصص' },
                  ].map((btn) => {
                    const active = dateRange === btn.id;
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => {
                          setDateRange(btn.id as any);
                          if (btn.id !== 'custom') {
                            setStartDate('');
                            setEndDate('');
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer"
                        style={{
                          backgroundColor: active ? theme.text : theme.bg,
                          color: active ? theme.surface : theme.text,
                          borderColor: active ? theme.text : theme.border,
                        }}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pt-1 text-right">
                  <div>
                    <label className="block text-[11px] font-bold mb-1" style={{ color: theme.textMuted }}>
                      من تاريخ
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 border text-xs outline-none"
                      style={{
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1" style={{ color: theme.textMuted }}>
                      إلى تاريخ
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 border text-xs outline-none"
                      style={{
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-black" style={{ color: theme.textMuted }}>
                  ترتيب النتائج حسب
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'date_desc', label: 'الأحدث أولاً' },
                    { id: 'date_asc', label: 'الأقدم أولاً' },
                    { id: 'amount_desc', label: 'المبيعات: الأعلى' },
                    { id: 'amount_asc', label: 'المبيعات: الأقل' },
                    { id: 'profit_desc', label: 'الأرباح: الأعلى' },
                    { id: 'profit_asc', label: 'الأرباح: الأقل' },
                  ].map((btn) => {
                    const active = sortBy === btn.id;
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => setSortBy(btn.id as any)}
                        className="px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer"
                        style={{
                          backgroundColor: active ? theme.accent : theme.bg,
                          color: active ? '#FFFFFF' : theme.text,
                          borderColor: active ? theme.accent : theme.border,
                        }}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Invoices Grid / Empty States */}
        {invoices.length === 0 ? (
          <div
            className="text-center py-16 border"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <Coins size={40} className="mx-auto mb-3 opacity-35" strokeWidth={1.2} />
            <p className="font-bold text-sm" style={{ color: theme.textMuted }}>
              لا توجد مبيعات مسجلة حتى الآن
            </p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div
            className="text-center py-16 border space-y-4"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <Filter size={28} className="mx-auto opacity-40" />
            <div>
              <p className="font-bold text-sm">لا توجد فواتير تطابق التصفية الحالية</p>
              <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
                يرجى تعديل نطاق البحث أو خيارات التصفية المعروضة
              </p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-bold px-4 py-2 text-white cursor-pointer"
              style={{ backgroundColor: theme.accent }}
            >
              إعادة ضبط جميع الفلاتر
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInvoices.map((inv) => {
              const dateObj = safeParseDate(inv.createdAt);
              const itemsCount = (inv.items || []).length;
              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className="border relative flex flex-col transition-colors cursor-pointer hover:opacity-95"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <div
                    className="px-4 py-3 border-b flex items-center justify-between"
                    style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                  >
                    <span className="font-mono font-black text-sm tabular-nums" dir="ltr">
                      #{inv.invoiceNumber}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] font-mono" style={{ color: theme.textMuted }}>
                      <span>{itemsCount} أصناف</span>
                      <span>·</span>
                      <span>
                        {dateObj.toLocaleTimeString(language === 'ar' ? 'ar-TN' : 'en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span style={{ color: theme.textMuted }}>التاريخ</span>
                        <span className="font-bold">
                          {dateObj.toLocaleDateString(language === 'ar' ? 'ar-TN' : 'en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      {inv.totalProfit !== undefined && (
                        <div className="flex justify-between items-center">
                          <span style={{ color: theme.textMuted }}>الربح</span>
                          <span
                            className="font-mono font-bold tabular-nums"
                            dir="ltr"
                            style={{ color: theme.positive }}
                          >
                            {showFinancials
                              ? formatCurrency(inv.totalProfit || 0, settings.currency, language)
                              : '••••••'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div
                      className="pt-3 border-t flex items-center justify-between"
                      style={{ borderColor: theme.border }}
                    >
                      <span className="text-xs font-bold" style={{ color: theme.textMuted }}>
                        المجموع الكلي
                      </span>
                      <span
                        className="text-lg font-black font-mono tabular-nums"
                        dir="ltr"
                        style={{ color: theme.accent }}
                      >
                        {showFinancials
                          ? formatCurrency(inv.totalAmount, settings.currency, language)
                          : '••••••'}
                      </span>
                    </div>
                  </div>

                  {showDeleteInvoices && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInvoiceToDelete(inv);
                        setDeleteConfirmOpen(true);
                      }}
                      className="w-full py-2 border-t text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      style={{
                        borderColor: theme.border,
                        backgroundColor: theme.surfaceMuted,
                        color: theme.negative,
                      }}
                    >
                      <Trash2 size={14} />
                      <span>حذف الفاتورة</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {invoices.length >= invoicesLimit && (
          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={() => setInvoicesLimit((prev) => prev + 100)}
              className="px-6 py-2.5 border font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.accent,
              }}
            >
              <span>{t('load_more', 'تحميل المزيد من الفواتير')}</span>
              <span className="text-[10px] font-mono" style={{ color: theme.textMuted }}>
                (+100)
              </span>
            </button>
          </div>
        )}
      </section>

      {/* Invoice Details Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setSelectedInvoice(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md border overflow-hidden flex flex-col max-h-[85vh]"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <div
                className="p-4 border-b flex justify-between items-center"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
              >
                <div className="flex items-center gap-2">
                  <FileText size={18} style={{ color: theme.accent }} />
                  <h3 className="font-black text-base">تفاصيل الفاتورة</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1.5 border transition-colors cursor-pointer"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto text-sm">
                <div
                  className="flex justify-between items-start pb-4 mb-4 border-b"
                  style={{ borderColor: theme.border }}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold" style={{ color: theme.textMuted }}>
                      رقم الفاتورة
                    </div>
                    <div className="text-lg font-black font-mono tabular-nums" dir="ltr">
                      #{selectedInvoice.invoiceNumber}
                    </div>
                  </div>
                  <div className="text-left space-y-0.5 font-mono text-xs">
                    <div style={{ color: theme.textMuted }}>التاريخ والوقت</div>
                    <div className="font-bold">
                      {safeParseDate(selectedInvoice.createdAt).toLocaleDateString(
                        language === 'ar' ? 'ar-TN' : 'en-US',
                        { day: 'numeric', month: 'long', year: 'numeric' },
                      )}
                    </div>
                    <div style={{ color: theme.textMuted }}>
                      {safeParseDate(selectedInvoice.createdAt).toLocaleTimeString(
                        language === 'ar' ? 'ar-TN' : 'en-US',
                        { hour: '2-digit', minute: '2-digit' },
                      )}
                    </div>
                  </div>
                </div>

                {/* Editorial Line Table */}
                <div
                  className="grid grid-cols-12 gap-2 text-[11px] font-bold pb-2 border-b"
                  style={{ borderColor: theme.border, color: theme.textMuted }}
                >
                  <div className="col-span-6 text-right">المنتج</div>
                  <div className="col-span-3 text-center">الكمية</div>
                  <div className="col-span-3 text-left">المجموع</div>
                </div>

                <div className="divide-y mb-5" style={{ borderColor: theme.border }}>
                  {(selectedInvoice.items || []).map((item: any, i: number) => {
                    const modeLabel =
                      item.saleMode === 'box'
                        ? 'كرتونة'
                        : item.saleMode === 'gram'
                        ? 'غرام'
                        : item.saleMode === 'kg'
                        ? 'كغ'
                        : item.saleMode === 'subpiece'
                        ? 'حبة'
                        : 'قطعة';
                    const itemTotal = item.total !== undefined ? item.total : item.price * item.quantity;
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-12 gap-2 items-center py-2.5 text-xs"
                        style={{ borderColor: theme.border }}
                      >
                        <div className="col-span-6 text-right font-bold line-clamp-2" title={item.name}>
                          {item.name}
                        </div>
                        <div className="col-span-3 text-center font-mono tabular-nums" style={{ color: theme.textMuted }}>
                          {item.quantity} {item.saleMode ? modeLabel : item.unit || ''}
                        </div>
                        <div className="col-span-3 text-left font-black font-mono tabular-nums" dir="ltr">
                          {formatCurrency(itemTotal, settings.currency, language)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="flex justify-between items-center p-4 border"
                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                >
                  <span className="text-sm font-black">المجموع الكلي</span>
                  <span
                    className="text-xl font-black font-mono tabular-nums"
                    dir="ltr"
                    style={{ color: theme.accent }}
                  >
                    {formatCurrency(selectedInvoice.totalAmount, settings.currency, language)}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CustomConfirmModal
        show={deleteConfirmOpen}
        message={`هل أنت متأكد من حذف الفاتورة ${invoiceToDelete?.invoiceNumber || ''} نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`}
        type="confirm"
        onConfirm={handleDeleteInvoice}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setInvoiceToDelete(null);
        }}
      />
    </div>
  );
}

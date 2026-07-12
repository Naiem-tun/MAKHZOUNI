import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  Coins, Search, X, Filter, Trash2, ChevronUp, ChevronDown
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { formatCurrency, safeParseDate, formatAppDate } from '../lib/utils';
import { CustomConfirmModal } from '../components/common/CustomConfirmModal';

export default function Invoices() {
  const { t } = useTranslation();
  const { settings, user } = useAppContext();
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
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});
  const [showDeleteInvoices, setShowDeleteInvoices] = useState(false);

  const toggleInvoice = (invoiceId: string) => {
    setExpandedInvoices(prev => ({ ...prev, [invoiceId]: !prev[invoiceId] }));
  };

  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    let unsubInvoices: any;
    let unsubProducts: any;

    try {
      // Products Listener for restoring quantity
      const productsPath = `users/${uid}/products`;
      unsubProducts = onSnapshot(collection(db, productsPath), (snap) => {
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // Invoices Listener
      const invoicesPath = `users/${uid}/invoices`;
      const invoicesQuery = query(collection(db, invoicesPath), orderBy('createdAt', 'desc'), limit(100));
      unsubInvoices = onSnapshot(invoicesQuery, (snap) => {
        setInvoices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      });
    } catch(err) {
      console.error(err);
      setLoading(false);
    }

    return () => {
      if (unsubInvoices) unsubInvoices();
      if (unsubProducts) unsubProducts();
    };
  }, [user]);

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete || !user) return;
    try {
      const batch = writeBatch(db);
      
      // Delete invoice
      batch.delete(doc(db, `users/${user.uid}/invoices`, invoiceToDelete.id));
      
      // Restore products quantity
      if (settings.posDeductInventory !== false) {
        (invoiceToDelete.items || []).forEach((item: any) => {
          const p = products.find(prod => prod.id === item.productId);
          if (p) {
            const productRef = doc(db, `users/${user.uid}/products`, item.productId);
            batch.update(productRef, {
              quantity: (p.quantity || 0) + item.quantity
            });
          }
        });
      }
      
      await batch.commit();
      setDeleteConfirmOpen(false);
      setInvoiceToDelete(null);
    } catch (error) {
      console.error("Error deleting invoice: ", error);
    }
  };

  // 1.1 Calculate Filtered and Sorted Invoices
  const filteredInvoices = useMemo(() => {
    let result = [...invoices];

    // Search Filter (by invoice number or items inside invoice)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(inv => {
        const matchesNum = inv.invoiceNumber?.toString().toLowerCase().includes(term);
        const matchesProduct = (inv.items || []).some((item: any) => 
          item.name?.toLowerCase().includes(term)
        );
        return matchesNum || matchesProduct;
      });
    }

    // Date Filter
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    if (dateRange === 'today') {
      result = result.filter(inv => {
        const d = safeParseDate(inv.createdAt);
        return d >= startOfToday;
      });
    } else if (dateRange === 'yesterday') {
      result = result.filter(inv => {
        const d = safeParseDate(inv.createdAt);
        return d >= startOfYesterday && d < startOfToday;
      });
    } else if (dateRange === 'last7days') {
      result = result.filter(inv => {
        const d = safeParseDate(inv.createdAt);
        return d >= sevenDaysAgo;
      });
    } else if (dateRange === 'custom') {
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        result = result.filter(inv => safeParseDate(inv.createdAt) >= sDate);
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        result = result.filter(inv => safeParseDate(inv.createdAt) <= eDate);
      }
    }

    // Sorting
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

  // Derived stats for the active filter
  const filteredStats = useMemo(() => {
    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalProfit = filteredInvoices.reduce((sum, inv) => sum + (inv.totalProfit || 0), 0);
    const count = filteredInvoices.length;
    const averageTicket = count > 0 ? totalAmount / count : 0;
    return { totalAmount, totalProfit, count, averageTicket };
  }, [filteredInvoices]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="pb-24 pt-4 md:pt-6 animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
            {t('sales_reports') || 'تقارير المبيعات'}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">تابع وإدار سجل الفواتير والمبيعات بدقة مع الفلاتر المتقدمة</p>
        </div>
        <button 
          onClick={() => setShowDeleteInvoices(!showDeleteInvoices)}
          className={`p-2 rounded-lg transition-colors ${
            showDeleteInvoices 
              ? "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400" 
              : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          }`}
          title="تعديل الفواتير"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <section className="space-y-4">
        {/* Reset/Refresh indicator if filters are active */}
        {(searchTerm || dateRange !== 'today' || sortBy !== 'date_desc') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setDateRange('today');
              setStartDate('');
              setEndDate('');
              setSortBy('date_desc');
            }}
            className="self-start md:self-auto text-xs font-bold text-zinc-500 hover:text-brand-600 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <X size={14} />
            إعادة ضبط التصفية
          </button>
        )}

        {/* Invoices Filtering & Searching Controls */}
        {invoices.length > 0 && (
          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
            {/* Search and Advanced Filters Toggle */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="البحث برقم الفاتورة أو اسم منتج..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-right"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className={`h-10 px-4 rounded-lg text-sm font-bold flex items-center gap-2 border transition-all ${
                  showFiltersPanel || dateRange !== 'today' || sortBy !== 'date_desc'
                    ? 'bg-brand-50 border-brand-200 dark:border-brand-900/30 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <Filter size={16} />
                <span>تصفية</span>
                {(dateRange !== 'today' || sortBy !== 'date_desc') && (
                  <span className="h-2 w-2 rounded-full bg-brand-500" />
                )}
              </button>
            </div>

            {/* Collapsible Advanced Filters Panel */}
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ 
                height: showFiltersPanel ? 'auto' : 0, 
                opacity: showFiltersPanel ? 1 : 0,
                marginTop: showFiltersPanel ? 12 : 0,
                paddingTop: showFiltersPanel ? 12 : 0
              }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden space-y-4 border-t border-zinc-200/60 dark:border-zinc-700/60"
            >
              {/* Date Filters Option */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-zinc-500">نطاق تاريخ الفاتورة</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'today', label: 'اليوم' },
                    { id: 'yesterday', label: 'الأمس' },
                    { id: 'last7days', label: 'آخر 7 أيام' },
                    { id: 'custom', label: 'تاريخ مخصص' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => {
                        setDateRange(btn.id as any);
                        if (btn.id !== 'custom') {
                          setStartDate('');
                          setEndDate('');
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        dateRange === btn.id
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 border border-zinc-200/50 dark:border-zinc-800/50'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Picker Inputs */}
              {dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-fade-in text-right">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1">من تاريخ</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1">إلى تاريخ</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Sorting Options */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-zinc-500">ترتيب النتائج حسب</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'date_desc', label: 'الأحدث أولاً' },
                    { id: 'date_asc', label: 'الأقدم أولاً' },
                    { id: 'amount_desc', label: 'المبيعات: الأعلى' },
                    { id: 'amount_asc', label: 'المبيعات: الأقل' },
                    { id: 'profit_desc', label: 'الأرباح: الأعلى' },
                    { id: 'profit_asc', label: 'الأرباح: الأقل' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => setSortBy(btn.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        sortBy === btn.id
                          ? 'bg-brand-500 text-white'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 border border-zinc-200/50 dark:border-zinc-800/50'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Invoices List / No Results messages */}
        {invoices.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <Coins size={48} className="mx-auto text-zinc-300 mb-4" strokeWidth={1} />
            <p className="text-zinc-500 font-medium">لا توجد مبيعات مسجلة حتى الآن</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800 space-y-4">
            <div className="h-14 w-14 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <Filter size={24} />
            </div>
            <div>
              <p className="text-zinc-500 font-bold">لا توجد فواتير تطابق التصفية الحالية</p>
              <p className="text-xs text-zinc-400 mt-1">يرجى تعديل نطاق البحث أو خيارات التصفية المعروضة</p>
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setDateRange('today');
                setStartDate('');
                setEndDate('');
                setSortBy('date_desc');
              }}
              className="text-xs font-black bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              إعادة ضبط جميع الفلاتر
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvoices.map((inv) => {
              const isExpanded = expandedInvoices[inv.id];
              return (
              <div 
                key={inv.id} 
                className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 relative flex flex-col font-mono text-sm max-w-md mx-auto w-full transition-shadow hover:shadow-md cursor-pointer"
                onClick={() => toggleInvoice(inv.id)}
              >
                <div className="p-5 flex-1 flex flex-col">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2 w-full">
                       <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-zinc-500 font-sans">رقم الفاتورة :</span>
                         <span className="font-bold text-zinc-900 dark:text-white">#{inv.invoiceNumber}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-zinc-500 font-sans">التاريخ :</span>
                         <span className="font-bold text-zinc-900 dark:text-white">
                           {safeParseDate(inv.createdAt).toLocaleDateString(language === 'ar' ? 'ar-TN' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                         </span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-zinc-500 font-sans">الوقت :</span>
                         <span className="font-bold text-zinc-900 dark:text-white">
                           {safeParseDate(inv.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-TN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                         </span>
                       </div>
                    </div>
                    {showDeleteInvoices && (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setInvoiceToDelete(inv); 
                          setDeleteConfirmOpen(true); 
                        }}
                        className="absolute top-4 left-4 text-red-500 hover:text-white hover:bg-red-500 p-2 rounded-full transition-colors bg-red-50 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <>
                      <div className="border-t-2 border-dashed border-zinc-200 dark:border-zinc-700 w-full mb-3"></div>

                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-2 text-[11px] font-black font-sans text-zinc-900 dark:text-white pb-2 text-center">
                        <div className="col-span-6 text-right">المنتج</div>
                        <div className="col-span-3 text-center">الكمية</div>
                        <div className="col-span-3 text-left">المجموع</div>
                      </div>

                      {/* Table Body */}
                      <div className="space-y-3 mb-4 flex-1 text-sm">
                        {(inv.items || []).map((item: any, i: number) => (
                          <div key={i} className="grid grid-cols-12 gap-2 items-center text-center">
                            <div className="col-span-6 text-right font-bold text-zinc-800 dark:text-zinc-200 line-clamp-2" title={item.name}>{item.name}</div>
                            <div className="col-span-3 text-center font-bold text-zinc-600 dark:text-zinc-400">
                              {item.quantity} {item.unit || ''}
                            </div>
                            <div className="col-span-3 text-left font-black text-zinc-900 dark:text-white" dir="ltr">
                              {(item.price * item.quantity).toFixed(3)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="border-t-2 border-dashed border-zinc-200 dark:border-zinc-700 w-full mb-3 mt-auto"></div>

                  {/* Footer */}
                  <div className="flex justify-between items-center text-lg font-black font-sans">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-900 dark:text-white">المجموع الكلي :</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-900 dark:text-white" dir="ltr">
                        {formatCurrency(inv.totalAmount, settings.currency, language)}
                      </span>
                      <div className="text-zinc-400">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </section>

      <CustomConfirmModal
        show={deleteConfirmOpen}
        message={`هل أنت متأكد من حذف الفاتورة ${invoiceToDelete?.invoiceNumber || ''} نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`}
        type="confirm"
        onConfirm={handleDeleteInvoice}
        onCancel={() => { setDeleteConfirmOpen(false); setInvoiceToDelete(null); }}
      />
    </div>
  );
}

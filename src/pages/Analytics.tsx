import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  TrendingUp, Coins, Package, ShoppingCart, 
  ArrowUpRight, ArrowDownRight, Calendar, 
  BarChart3, LineChart, Activity,
  Info, ChevronDown, Filter, History, PieChart as PieChartIcon
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, 
  Cell, PieChart, Pie, Legend
} from 'recharts';
import { collection, query, getDocs, orderBy, limit, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { formatCurrency, safeParseDate, formatAppDate } from '../lib/utils';

export default function Analytics() {
  const { t } = useTranslation();
  const { settings, user } = useAppContext();
  const [products, setProducts] = useState<any[]>([]);
  const [inventoryReports, setInventoryReports] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'menu' | 'financial' | 'rankings' | 'purchases' | 'categories'>('menu');

  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    let unsubProducts: any;
    let unsubReports: any;
    let unsubPurchases: any;

    try {
      // Products Listener
      const productsPath = `users/${uid}/products`;
      unsubProducts = onSnapshot(collection(db, productsPath), (snap) => {
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // Reports Listener
      const reportsPath = `users/${uid}/reports`;
      const reportsQuery = query(collection(db, reportsPath), where('type', '==', 'inventory'), orderBy('date', 'desc'), limit(15));
      unsubReports = onSnapshot(reportsQuery, (snap) => {
        setInventoryReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // Purchases Listener
      const purchasesPath = `users/${uid}/purchases`;
      const purchasesQuery = query(collection(db, purchasesPath), orderBy('date', 'desc'), limit(100));
      unsubPurchases = onSnapshot(purchasesQuery, (snap) => {
        setPurchases(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      });
    } catch(err) {
      console.error(err);
      setLoading(false);
    }

    return () => {
      if (unsubProducts) unsubProducts();
      if (unsubReports) unsubReports();
      if (unsubPurchases) unsubPurchases();
    };
  }, [user]);

  // Group purchases by Day
  const dailyPurchases = useMemo(() => {
    const groups: Record<string, { date: Date, total: number }> = {};
    
    purchases.forEach(p => {
      const date = safeParseDate(p.date);
      const dateKey = date.toLocaleDateString('en-GB'); // Use DD/MM/YYYY for consistent keying
      
      if (!groups[dateKey]) {
        groups[dateKey] = { date, total: 0 };
      }
      groups[dateKey].total += (p.amount || 0);
    });

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [purchases]);

  const categoryAnalysis = useMemo(() => {
    const cats: Record<string, { count: number, totalPurchase: number, totalSales: number, totalQuantity: number }> = {};
    
    products.forEach(p => {
      const cat = p.category || 'other_cat';
      if (!cats[cat]) {
        cats[cat] = { count: 0, totalPurchase: 0, totalSales: 0, totalQuantity: 0 };
      }
      const q = Number(p.quantity) || 0;
      const pp = Number(p.purchasePrice) || 0;
      const sp = Number(p.sellingPrice) || 0;
      
      cats[cat].count += 1;
      cats[cat].totalQuantity += q;
      cats[cat].totalPurchase += q * pp;
      cats[cat].totalSales += q * sp;
    });

    return Object.entries(cats).map(([name, data]) => {
      const expectedProfit = data.totalSales - data.totalPurchase;
      const calcMethod = settings.profitCalculationMethod || 'markup';
      const profitMargin = calcMethod === 'margin'
        ? (data.totalSales > 0 ? (expectedProfit / data.totalSales) * 100 : 0)
        : (data.totalPurchase > 0 ? (expectedProfit / data.totalPurchase) * 100 : 0);
      
      return {
        name,
        ...data,
        expectedProfit,
        profitMargin
      };
    }).sort((a, b) => b.totalPurchase - a.totalPurchase);
  }, [products]);

  // 1. Financial Stats Calculation
  const totalPurchaseValue = (products || []).reduce((acc, p) => acc + (Number(p.purchasePrice || 0) * Number(p.quantity || 0)), 0);
  const totalSalesValue = (products || []).reduce((acc, p) => acc + (Number(p.sellingPrice || 0) * Number(p.quantity || 0)), 0);
  const expectedProfit = totalSalesValue - totalPurchaseValue;

  // 2. Top Products (Mock calculation based on latest inventory reports if available)
  const topProfitableProducts = inventoryReports.length > 0 
    ? (inventoryReports[0].items || [])
        .sort((a: any, b: any) => b.profit - a.profit)
        .slice(0, 5)
    : [];

  const topSellingProducts = inventoryReports.length > 0
    ? (inventoryReports[0].items || [])
        .sort((a: any, b: any) => b.salesCalculated - a.salesCalculated)
        .slice(0, 5)
    : [];

  // 3. Purchase Activity (Recently added products)
  const recentPurchases = [...(products || [])]
    .sort((a, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
    .slice(0, 5);

  // 4. Chart Data (Analysis of Profit/Revenue/Expenses)
  const chartData = inventoryReports.slice().reverse().map((report, i) => ({
    name: formatAppDate(safeParseDate(report.date), 'ar', t, { day: 'numeric', month: 'short' }),
    revenues: Number((report.totalRevenue || 0).toFixed(3)),
    profit: Number((report.netProfit || 0).toFixed(3)),
    expenses: Number((report.totalExpenses || 0).toFixed(3)),
  }));

  if (loading) {
    return <div className="flex h-96 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
    </div>;
  }

  const menuItems = [
    { id: 'financial', label: t('financial_stats'), icon: BarChart3, color: 'text-zinc-500', bg: 'bg-zinc-50 dark:bg-zinc-800/50', desc: t('revenue_profit_cost') },
    { id: 'rankings', label: t('best_products'), icon: TrendingUp, color: 'text-zinc-500', bg: 'bg-zinc-50 dark:bg-zinc-800/50', desc: t('most_profitable_sold') },
    { id: 'categories', label: t('category_analysis'), icon: PieChartIcon, color: 'text-zinc-500', bg: 'bg-zinc-50 dark:bg-zinc-800/50', desc: t('stock_value_by_category') },
    { id: 'purchases', label: t('purchase_movement'), icon: History, color: 'text-zinc-500', bg: 'bg-zinc-50 dark:bg-zinc-800/50', desc: t('recent_purchases_log') },
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {activeTab !== 'menu' && (
            <button 
              onClick={() => setActiveTab('menu')}
              className="h-10 w-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
            >
              <ArrowDownRight className="rotate-180" size={20} />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('reports')}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {activeTab === 'menu' ? t('choose_section') : menuItems.find(i => i.id === activeTab)?.label}
            </p>
          </div>
        </div>
      </header>

      {/* Conditional Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {activeTab === 'menu' && (
          <div className="grid grid-cols-1 gap-4">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className="group flex items-center gap-4 p-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-right transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
              >
                <div className={`h-14 w-14 rounded-2xl ${item.bg} flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                  <item.icon size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-lg text-zinc-900 dark:text-white">{item.label}</h3>
                  <p className="text-xs text-zinc-500">{item.desc}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-300 group-hover:text-brand-500 transform group-hover:translate-x-[-4px] transition-all">
                  {language === 'ar' ? <ArrowDownRight className="rotate-180" size={20} /> : <ArrowUpRight size={20} />}
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'financial' && (
          <>
            {/* Main Chart */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">{t('reports')}</div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-white">{t('revenues_and_profits')}</h2>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
                  <BarChart3 size={20} />
                </div>
              </div>

              <div className="flex items-center gap-6 mb-8">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-brand-500" />
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{t('revenues')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{t('net_profit')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500" />
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{t('expenses')}</span>
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#004eff" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#004eff" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} hide />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        textAlign: 'right' 
                      }}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value, settings.currency, language), 
                        t(name)
                      ]}
                    />
                    <Area type="monotone" dataKey="revenues" stroke="#004eff" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Financial Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: t('capital_purchase_price'), value: totalPurchaseValue, icon: BarChart3, color: 'text-zinc-600', bg: 'bg-zinc-100 dark:bg-zinc-800' },
                { label: t('inventory_value_selling_price'), value: totalSalesValue, icon: Package, color: 'text-zinc-600', bg: 'bg-zinc-100 dark:bg-zinc-800' },
                { label: t('expected_profit'), value: expectedProfit, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
              ].map((stat, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-8 w-8 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                      <stat.icon size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500">{stat.label}</span>
                  </div>
                  <div className="text-lg font-black text-zinc-900 dark:text-white">
                    {!showFinancials ? '••••••' : formatCurrency(stat.value, settings.currency, language)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'rankings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-xl text-zinc-900 dark:text-white flex items-center gap-2">
                  <TrendingUp size={22} className="text-emerald-500" />
                  {t('most_profitable_products')}
                </h3>
              </div>
              <div className="space-y-4">
                {topProfitableProducts.length > 0 ? topProfitableProducts.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-sm font-black text-zinc-500 shadow-sm">
                        {i + 1}
                      </div>
                      <span className="font-bold text-zinc-900 dark:text-white leading-none">{item.productName}</span>
                    </div>
                    <div className="text-lg font-black text-zinc-900 dark:text-white">
                      {formatCurrency(item.profit, settings.currency, language)}
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-sm text-zinc-400 py-10">{t('no_data_available')}</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-xl text-zinc-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart size={22} className="text-brand-500" />
                  {t('most_sold_products')}
                </h3>
              </div>
              <div className="space-y-4">
                {topSellingProducts.length > 0 ? topSellingProducts.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-sm font-black text-zinc-500 shadow-sm">
                        {i + 1}
                      </div>
                      <span className="font-bold text-zinc-900 dark:text-white leading-none">{item.productName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-black text-zinc-900 dark:text-white">{item.salesCalculated}</span>
                      <span className="text-sm font-bold text-zinc-400">{t('piece')}</span>
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-sm text-zinc-400 py-10">{t('no_data_available')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'purchases' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-xl text-zinc-900 dark:text-white">{t('last_purchases_log')}</h3>
                <p className="text-[10px] font-bold text-zinc-400">{t('daily_purchases_total')}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {dailyPurchases.length > 0 ? dailyPurchases.map((day, i) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={i}
                  className="flex items-center justify-between p-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm transition-all hover:scale-[1.01] active:scale-95 group"
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-lg font-black text-zinc-900 dark:text-white">
                      {formatCurrency(day.total, settings.currency, language)}
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black text-zinc-700 dark:text-zinc-300">
                      {day.date.toLocaleDateString(language === 'ar' ? 'ar-TN' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div className="text-[10px] font-bold text-zinc-400">
                      {day.date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                </motion.div>
              )) : (
                <div className="py-20 text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center mx-auto text-zinc-300">
                    <BarChart3 size={32} />
                  </div>
                  <p className="text-sm text-zinc-400 font-bold">{t('no_purchases_waiting')}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'categories' && (
          <section className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-black text-xl text-zinc-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon size={22} className="text-brand-500" />
                    {t('category_analysis')}
                  </h3>
                  <p className="text-[10px] font-bold text-zinc-400 mt-1">{t('stock_value_by_category')}</p>
                </div>
              </div>

              {categoryAnalysis.length > 0 ? (
                <div className="space-y-4">
                  <div className="h-[320px] mb-8 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryAnalysis}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={5}
                          cornerRadius={8}
                          dataKey="totalPurchase"
                          nameKey="name"
                          stroke="none"
                        >
                          {categoryAnalysis.map((entry, index) => {
                            const COLORS = ['#54ACBF', '#7ABD87', '#26658C', '#AADCB6', '#023859', '#3E7E55', '#A7EBF2', '#CADEC8', '#011C40', '#EAEEE5'];
                            return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                          })}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            formatCurrency(value, settings.currency, language), 
                            name === 'other_cat' ? t('other') : t(String(name))
                          ]}
                          contentStyle={{ 
                            borderRadius: '16px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            textAlign: 'right'
                          }}
                          itemStyle={{ fontWeight: 'bold' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-4">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">
                        {t('capital_purchase_price')}
                      </span>
                      <span className="text-xl font-black text-zinc-900 dark:text-white">
                        {formatCurrency(categoryAnalysis.reduce((total, cat) => total + cat.totalPurchase, 0), settings.currency, language)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryAnalysis.map((cat, i) => {
                    const COLORS = ['#54ACBF', '#7ABD87', '#26658C', '#AADCB6', '#023859', '#3E7E55', '#A7EBF2', '#CADEC8', '#011C40', '#EAEEE5'];
                    const catColor = COLORS[i % COLORS.length];
                    
                    return (
                    <div key={i} className="flex flex-col p-5 bg-zinc-50 dark:bg-zinc-800/40 rounded-3xl border border-zinc-100 dark:border-zinc-800 transition-colors">
                      <div className="flex justify-between items-center mb-5 pb-4 border-b border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="flex items-center gap-3">
                           <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: catColor }} />
                           <span className="font-bold text-base text-zinc-900 dark:text-white">
                             {cat.name === 'other_cat' ? t('other') : t(cat.name)}
                           </span>
                        </div>
                        <div className="text-left">
                          <span className="block text-[10px] font-bold text-zinc-400 mb-0.5">{t('piece')}</span>
                          <span className="text-xs font-black text-zinc-600 dark:text-zinc-300 bg-zinc-200/50 dark:bg-zinc-700/50 px-2 py-0.5 rounded-lg">
                            {cat.totalQuantity}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-zinc-500">{t('capital_purchase_price')}</span>
                          <span className="text-sm font-black text-zinc-900 dark:text-white">
                            {formatCurrency(cat.totalPurchase, settings.currency, language)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-zinc-500">{t('inventory_value_sell')}</span>
                          <span className="text-sm font-black text-zinc-900 dark:text-white">
                            {formatCurrency(cat.totalSales, settings.currency, language)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs font-medium text-zinc-500">{t('expected_profit')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black bg-brand-100 dark:bg-brand-900/30 text-brand-600 px-1.5 py-0.5 rounded-md">
                              {cat.profitMargin.toFixed(1)}%
                            </span>
                            <span className="text-sm font-black text-brand-600 dark:text-brand-400">
                               {formatCurrency(cat.expectedProfit, settings.currency, language)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )})}
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center mx-auto text-zinc-300">
                    <PieChartIcon size={32} />
                  </div>
                  <p className="text-sm text-zinc-400 font-bold">{t('no_data_available')}</p>
                </div>
              )}
            </div>
          </section>
        )}
      </motion.div>
    </div>
  );
}

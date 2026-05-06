import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Transaction } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, Wallet, ChevronLeft, BarChart3 } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

const COLORS = ['#021024', '#004eff', '#3b82f6', '#1e40af', '#60a5fa', '#1e3a8a'];

export default function Reports() {
  const { t } = useTranslation();
  const { user, settings } = useAppContext();
  const [products, setProducts] = useState<Product[]>([]);
  
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, `users/${user.uid}/products`), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
  }, [user]);

  const categoryData = products.reduce((acc, p) => {
    const found = acc.find(item => item.name === p.category);
    if (found) {
      found.value += p.quantity * p.purchasePrice;
    } else {
      acc.push({ name: p.category || 'متنوع', value: p.quantity * p.purchasePrice });
    }
    return acc;
  }, [] as { name: string, value: number }[]);

  const profitData = products.slice(0, 5).map(p => ({
    name: p.name.substring(0, 10),
    buying: p.purchasePrice,
    selling: p.sellingPrice,
    profit: p.sellingPrice - p.purchasePrice
  }));

  const menuItems = [
    { label: t('profits_revenue'), subtitle: 'الأرباح والإيرادات', icon: TrendingUp, color: 'text-brand-600' },
    { label: 'تحليل الفئات الاستراتيجي', subtitle: 'توزيع المخزون (بالقيمة)', icon: BarChart3, color: 'text-brand-500' },
    { label: 'إحصائيات المال', subtitle: 'عرض رأس المال والأرباح المتوقعة', icon: Wallet, color: 'text-zinc-500' },
  ];

  const showFinancials = settings.showFinancials ?? true;
  const formatPrivateValue = (val: number) => !showFinancials ? '••••••' : formatCurrency(val, settings.currency, settings.language);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">التقارير المالية</h1>
        <p className="text-zinc-500 dark:text-zinc-400">تحليل معمق لأداء المتجر والمخزون</p>
      </header>

      {!showFinancials ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
          <Wallet size={48} className="mx-auto text-zinc-300 mb-4" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">الإحصائيات المالية مخفية</h2>
          <p className="text-sm text-zinc-500 mt-1">قم بتفعيل "إحصائيات المال" من القائمة لرؤية البيانات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Category Share Chart */}
          <section className="rounded-3xl bg-white p-6 shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 dark:bg-brand-950/20">
                <PieChartIcon size={20} />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">قيمة المخزون حسب الفئة</h2>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0)" />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categoryData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2 text-xs text-zinc-500">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span>{item.name}: {formatCurrency(item.value, settings.currency, settings.language)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Profit Analysis */}
          <section className="rounded-3xl bg-white p-6 shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 dark:bg-brand-950/20">
                <TrendingUp size={20} />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">تحليل الربح (أمثلة)</h2>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitData}>
                  <XAxis dataKey="name" fontSize={10} hide />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="profit" fill="#004eff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="buying" fill="#021024" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-center text-zinc-400">مقارنة بين تكلفة الشراء وصافي الربح للمنتجات الأعلى قيمة</p>
          </section>
        </div>
      )}

      {/* Report Menu list */}
      <div className="space-y-4">
        {menuItems.map((item) => (
          <button key={item.label} className="group w-full flex items-center justify-between p-6 rounded-3xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 transition-all hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center ${item.color}`}>
                <item.icon size={24} />
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400">{item.subtitle}</p>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{item.label}</h3>
              </div>
            </div>
            <ChevronLeft className="text-zinc-400 group-hover:text-brand-500 transition-transform group-hover:-translate-x-1" />
          </button>
        ))}
      </div>
    </div>
  );
}

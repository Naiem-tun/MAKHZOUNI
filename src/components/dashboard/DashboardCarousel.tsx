import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { History, TrendingUp, Layers, Info, Truck } from 'lucide-react';
import { cn, formatAppDate } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import { ResponsiveContainer, BarChart, Bar, Cell, Tooltip, XAxis } from 'recharts';

interface DashboardCarouselProps {
  stats: {
    movementHistory: any[];
    todayPurchasesTotal: number;
    categoryAnalysis: any[];
    totalSalesValue: number;
    expectedProfit: number;
    totalExpenses: number;
    totalCustomerDebts: number;
    totalSupplierDebts: number;
    lowStock: number;
    topSuppliers: { name: string, debt: number, purchaseVolume: number }[];
  };
  formatPrivateValue: (val: number) => string;
}

export const DashboardCarousel: React.FC<DashboardCarouselProps> = ({ stats, formatPrivateValue }) => {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const width = scrollRef.current.clientWidth;
    const index = Math.round(Math.abs(scrollLeft) / width);
    setActiveIndex(index);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const slideTo = (index: number) => {
    if (!scrollRef.current) return;
    const width = scrollRef.current.clientWidth;
    scrollRef.current.scrollTo({
      left: document.dir === 'rtl' ? -(width * index) : width * index,
      behavior: 'smooth'
    });
  };

  // Prepare chart data (last 7 days, oldest to newest for the chart flow)
  const chartData = [...stats.movementHistory]
    .slice(0, 7)
    .reverse()
    .map(day => ({
      name: formatAppDate(new Date(day.date), settings.language, t, { day: 'numeric', month: 'short' }),
      total: day.total
    }));

  return (
    <div className="mt-8 relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white pr-2">
          {activeIndex === 0 ? t('purchase_movement', 'حركة المشتريات') : 
           activeIndex === 1 ? t('category_breakdown', 'تقسيم الفئات') : 
           activeIndex === 2 ? t('inventory_results', 'نتائج الجرد') :
           t('top_suppliers', 'أهم الموردين')}
        </h2>
        
        {/* Pagination Dots */}
        <div className="flex items-center gap-2" dir="ltr">
          {[0, 1, 2, 3].map((idx) => (
            <button
              key={idx}
              onClick={() => slideTo(idx)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                activeIndex === idx ? "w-6 bg-brand-600 dark:bg-brand-400" : "w-2 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400"
              )}
            />
          ))}
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 pb-4" 
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth' }}
      >
        {/* SLIDE 1: Purchase Movement (Chart) */}
        <div className="min-w-full w-full flex-shrink-0 snap-center">
          {stats.movementHistory.length === 0 ? (
            <div className="w-full py-10 text-center text-zinc-400 font-bold bg-white dark:bg-zinc-800/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 shadow-sm">
              {t('no_data_available')}
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-100 dark:border-zinc-700 h-full flex flex-col justify-center">
              <div className="h-[130px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <Tooltip 
                      cursor={{ fill: 'rgba(161, 161, 170, 0.1)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs py-1.5 px-3 rounded-lg shadow-xl font-sans font-black tracking-wide">
                              {formatPrivateValue(payload[0].value as number)}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }} 
                      dy={10}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} className="fill-brand-500 hover:fill-brand-600 dark:fill-brand-400 dark:hover:fill-brand-300 transition-all duration-300" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* SLIDE 2: Category Breakdown */}
        <div className="min-w-full w-full flex-shrink-0 snap-center">
          <div className="grid grid-cols-2 gap-3">
            {stats.categoryAnalysis.length === 0 ? (
              <div className="col-span-2 py-10 text-center text-zinc-400 font-bold bg-white dark:bg-zinc-800/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 shadow-sm">
                {t('no_data_available')}
              </div>
            ) : (
              stats.categoryAnalysis.map((cat, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-100 dark:border-zinc-700 flex flex-col justify-between group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Layers size={40} />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 truncate">
                    {cat.name === 'other_cat' ? t('other_categories', 'فئات أخرى') : cat.name}
                  </h3>
                  <div className="relative z-10">
                    <p className="text-lg font-black text-brand-700 dark:text-brand-400 font-sans leading-none mb-1">
                      {formatPrivateValue(cat.totalPurchase)}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-500">
                      {cat.totalQuantity} {t('pieces', 'قطعة')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SLIDE 3: Inventory Results */}
        <div className="min-w-full w-full flex-shrink-0 snap-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
             <div className="p-5 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-100 dark:border-zinc-700 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-5 text-brand-600">
                  <TrendingUp size={100} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <TrendingUp size={16} />
                  </div>
                  <h3 className="text-xs font-bold text-zinc-500 uppercase">{t('expected_profit', 'الربح المتوقع')}</h3>
                </div>
                <p className="text-2xl font-black text-zinc-900 dark:text-white font-sans mb-1">
                  {formatPrivateValue(stats.expectedProfit)}
                </p>
                <p className="text-xs font-medium text-zinc-400">
                  {t('expected_profit_desc', 'إجمالي الربح لو تم بيع كامل المخزون')}
                </p>
             </div>
             
             <div className="p-5 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-100 dark:border-zinc-700 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Info size={16} />
                  </div>
                  <h3 className="text-xs font-bold text-zinc-500 uppercase">{t('total_expected_sales', 'إجمالي المبيعات المتوقعة')}</h3>
                </div>
                <p className="text-2xl font-black text-zinc-900 dark:text-white font-sans mb-1">
                  {formatPrivateValue(stats.totalSalesValue)}
                </p>
                <p className="text-xs font-medium text-zinc-400">
                  {t('sales_value_desc', 'قيمة المخزون بسعر البيع')}
                </p>
             </div>
          </div>
        </div>

        {/* SLIDE 4: Top Suppliers */}
        <div className="min-w-full w-full flex-shrink-0 snap-center">
          <div className="grid grid-cols-2 gap-3 h-full">
            {stats.topSuppliers.length === 0 ? (
              <div className="col-span-2 py-10 text-center text-zinc-400 font-bold bg-white dark:bg-zinc-800/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 shadow-sm">
                {t('no_data_available', 'لا توجد بيانات')}
              </div>
            ) : (
              stats.topSuppliers.map((supplier, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-100 dark:border-zinc-700 flex flex-col justify-between group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-5 text-brand-600">
                    <Truck size={40} />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 truncate relative z-10">
                    {supplier.name}
                  </h3>
                  <div className="relative z-10 space-y-1">
                    <p className="text-sm font-black text-brand-700 dark:text-brand-400 font-sans leading-none">
                      {formatPrivateValue(supplier.purchaseVolume)}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-500 flex justify-between">
                      <span>{t('purchases_volume', 'مشتريات')}</span>
                      {supplier.debt > 0 && <span className="text-red-500">{t('debt', 'ديون')}: {formatPrivateValue(supplier.debt).split(' ')[0]}</span>}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

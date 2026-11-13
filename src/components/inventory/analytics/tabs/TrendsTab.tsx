import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../../../lib/utils';
import { UserSettings } from '../../../../types';
import { MultiInventoryTrendItem } from '../types';

interface TrendsTabProps {
  multiInventoryTrends: MultiInventoryTrendItem[];
  settings: UserSettings;
}

export const TrendsTab: React.FC<TrendsTabProps> = ({ multiInventoryTrends, settings }) => {
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-black text-lg text-zinc-900 dark:text-white">
              مسار تطور المحل عبر الجرود المتعاقبة
            </h3>
            <p className="text-xs text-zinc-500">
              مقارنة المبيعات والأرباح وقيمة رأس المال المخزون عبر الزمن
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-brand-500" />
              <span className="text-zinc-600 dark:text-zinc-400">المبيعات / الاستهلاك</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-zinc-600 dark:text-zinc-400">صافي الربح</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-zinc-600 dark:text-zinc-400">قيمة المخزون المتبقي</span>
            </div>
          </div>
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={multiInventoryTrends}>
              <defs>
                <linearGradient id="trendRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#004eff" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#004eff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="trendProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="shortName" fontSize={11} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} hide />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                  textAlign: 'right' 
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    revenue: 'المبيعات المستهلكة',
                    profit: 'الربح الإجمالي',
                    netProfit: 'صافي الربح',
                    stockValue: 'قيمة المخزون المتبقي',
                    expenses: 'المصاريف',
                  };
                  return [formatCurrency(value, settings.currency, language), labels[name] || name];
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#004eff" strokeWidth={3} fillOpacity={1} fill="url(#trendRevenue)" />
              <Area type="monotone" dataKey="netProfit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#trendProfit)" />
              <Area type="monotone" dataKey="stockValue" stroke="#60a5fa" strokeWidth={2} strokeDasharray="4 4" fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Table of all inventories side-by-side */}
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400">
                <th className="pb-3 font-bold">الجرد</th>
                <th className="pb-3 font-bold">التاريخ</th>
                <th className="pb-3 font-bold">المبيعات المستهلكة</th>
                <th className="pb-3 font-bold">الربح الإجمالي</th>
                <th className="pb-3 font-bold">المصاريف المقيدة</th>
                <th className="pb-3 font-bold">صافي الربح</th>
                <th className="pb-3 font-bold">قيمة المخزون المتبقي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {multiInventoryTrends.map((tItem, i) => (
                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="py-3 font-black text-brand-600 dark:text-brand-400">{tItem.name}</td>
                  <td className="py-3 text-zinc-500">دورة جرد</td>
                  <td className="py-3 font-bold text-zinc-900 dark:text-white">
                    {!showFinancials ? '••••••' : formatCurrency(tItem.revenue, settings.currency, language)}
                  </td>
                  <td className="py-3 font-bold text-emerald-600">
                    {!showFinancials ? '••••••' : formatCurrency(tItem.profit, settings.currency, language)}
                  </td>
                  <td className="py-3 text-rose-500">
                    {!showFinancials ? '••••••' : formatCurrency(tItem.expenses, settings.currency, language)}
                  </td>
                  <td className="py-3 font-black text-emerald-700 dark:text-emerald-400">
                    {!showFinancials ? '••••••' : formatCurrency(tItem.netProfit, settings.currency, language)}
                  </td>
                  <td className="py-3 text-zinc-600 dark:text-zinc-300">
                    {!showFinancials ? '••••••' : formatCurrency(tItem.stockValue, settings.currency, language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatQuantityWithGrouping } from '../../../../lib/utils';
import { UserSettings } from '../../../../types';
import { AnalyzedItem, SummaryMetrics } from '../types';

interface ShrinkageTabProps {
  currentReport: any;
  analyzedItems: AnalyzedItem[];
  summaryMetrics: SummaryMetrics;
  settings: UserSettings;
}

export const ShrinkageTab: React.FC<ShrinkageTabProps> = ({
  currentReport,
  analyzedItems,
  summaryMetrics,
  settings,
}) => {
  const language = settings.language || 'ar';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Surplus & Discrepancies */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <ShieldAlert className="text-amber-500" size={20} />
            <div>
              <h3 className="font-black text-zinc-900 dark:text-white">الفوارق والزيادات غير المفسرة</h3>
              <p className="text-[11px] text-zinc-500">حالات وجد فيها بالعد الفعلي كمية أكبر من المسجل بالنظام</p>
            </div>
          </div>

          {currentReport?.surplusItemsCount > 0 ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                <strong>تنبيه فني:</strong> وجود زيادة فعلية عن المسجل يعني عادة: فاتورة شراء بضاعة لم يتم إدخالها للنظام، أو خطأ في العد أثناء الجرد السابق.
              </div>

              <div className="space-y-2">
                {analyzedItems.filter(it => it.isSurplus).map((item, i) => (
                  <div key={i} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-zinc-900 dark:text-white">{item.name}</div>
                      <div className="text-[11px] text-zinc-400">
                        الزيادة: +{formatQuantityWithGrouping(item.surplusQuantity)} قطعة
                      </div>
                    </div>
                    <div className="text-left font-black text-amber-600 dark:text-amber-400">
                      {formatCurrency(item.surplusCostValue, settings.currency, language)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">أرقام الجرد متطابقة بالكامل</p>
              <p className="text-xs">لم تسجل أي زيادات عشوائية غير مفسرة في هذا الجرد.</p>
            </div>
          )}
        </div>

        {/* Damages and Losses */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <AlertTriangle className="text-rose-500" size={20} />
            <div>
              <h3 className="font-black text-zinc-900 dark:text-white">سجل التوالف والأضرار المعتمدة</h3>
              <p className="text-[11px] text-zinc-500">البضائع التي أتلفت أو انتهت صلاحيتها خلال دورة الجرد</p>
            </div>
          </div>

          {currentReport?.damageItems && currentReport.damageItems.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300">إجمالي خسائر التوالف</span>
                <span className="text-base font-black text-rose-600">
                  {formatCurrency(summaryMetrics.damageLoss, settings.currency, language)}
                </span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {currentReport.damageItems.map((dmg: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-white">{dmg.productName}</div>
                      <div className="text-zinc-400 mt-0.5">
                        الكمية التالفة: {dmg.quantity} • السبب: {dmg.reason || 'تلف / كسر'}
                      </div>
                    </div>
                    <div className="font-black text-rose-600">
                      {formatCurrency(dmg.totalLoss, settings.currency, language)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">لا توجد توالف مسجلة في هذه الدورة</p>
              <p className="text-xs">سجل الهدر والتوالف نظيف بنسبة 100%.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

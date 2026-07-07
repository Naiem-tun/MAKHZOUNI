import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Phone, Square, Play, Plus, Edit2, Trash2 } from 'lucide-react';
import { Supplier, Debt } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface SupplierCardProps {
  supplier: Supplier & { txCount?: number, totalPaid?: number, isMissed?: boolean };
  debts: Debt[];
  isToday: boolean;
  uploadedReports: any[];
  settings: any;
  activeSupplier: any;
  setEditingSupplier: (supplier: Supplier) => void;
  setSelectedVisitDays: (days: number[]) => void;
  setIsModalOpen: (open: boolean) => void;
  setDeleteConfirmId: (id: string) => void;
  setDeleteConfirmName: (name: string) => void;
  setSelectedSupplier: (supplier: Supplier) => void;
  setIsHistoryModalOpen: (open: boolean) => void;
  setIsSessionSummaryOpen: (open: boolean) => void;
  setActiveSupplier: (supplier: any) => void;
  setIsAddTxModalOpen: (open: boolean) => void;
}

export function SupplierCard({
  supplier: s,
  debts,
  isToday,
  uploadedReports,
  settings,
  activeSupplier,
  setEditingSupplier,
  setSelectedVisitDays,
  setIsModalOpen,
  setDeleteConfirmId,
  setDeleteConfirmName,
  setSelectedSupplier,
  setIsHistoryModalOpen,
  setIsSessionSummaryOpen,
  setActiveSupplier,
  setIsAddTxModalOpen
}: SupplierCardProps) {
  const { t } = useTranslation();

  return (
    <div className="relative group overflow-hidden rounded-lg">
      {/* Hidden Actions Layer (Behind) */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-1 gap-1 z-0">
        <button 
          onClick={() => { setEditingSupplier(s); setSelectedVisitDays(s.visitDays || []); setIsModalOpen(true); }}
          className="h-[calc(100%-8px)] w-16 bg-edit-bg border border-edit-border rounded-lg flex flex-col items-center justify-center gap-1 text-edit-text"
        >
          <Edit2 size={18} />
          <span className="text-[10px] font-bold">{t('edit')}</span>
        </button>
        <button 
          onClick={() => { setDeleteConfirmId(s.id!); setDeleteConfirmName(s.name || ''); }}
          className="h-[calc(100%-8px)] w-16 bg-delete-bg border border-delete-border flex flex-col items-center justify-center gap-1 text-delete-text rounded-lg"
        >
          <Trash2 size={18} />
          <span className="text-[10px] font-bold">{t('delete')}</span>
        </button>
      </div>

      {/* Swipable Front Layer */}
      <motion.div 
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.1}
        onClick={() => { setSelectedSupplier(s); setIsHistoryModalOpen(true); }}
        className={`relative z-10 flex cursor-pointer items-center justify-between rounded-lg bg-white p-3 shadow-sm border transition-all ${
          isToday 
            ? 'border-brand-500 ring-4 ring-brand-500/5 dark:bg-zinc-900' 
            : s.isMissed
            ? 'border-[#B34C36] ring-4 ring-[#B34C36]/5 dark:bg-zinc-900'
            : 'border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">{s.name}</h3>
                  {debts.some(d => d.customerName === s.name && d.status === 'unpaid') && (
                    <span className="text-[#B34C36] font-bold">-</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="inline-flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded-lg text-[10px] font-bold border border-zinc-200 dark:border-zinc-700">
                    {s.txCount || 0} {t('operations')}
                  </span>
                  
                  {uploadedReports.map((report, idx) => {
                    const val = report.data[s.name] || 0;
                    const diff = (s.totalPaid || 0) - val;
                    const match = report.name.match(/\((\d+)\)/);
                    const shortName = match ? match[0] : `(${idx + 1})`;
                    return (
                      <span key={report.id} className="inline-flex items-center justify-center bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 px-1.5 py-0.5 rounded-lg text-[10px] font-bold border border-brand-200 dark:border-brand-800" title={report.name}>
                        {shortName}: {formatCurrency(val, settings.currency, settings.language)}
                        {diff !== 0 && (
                          <span className={`mr-1 ${diff > 0 ? 'text-[#107C41]' : 'text-[#B34C36]'}`} dir="ltr">
                            ({diff > 0 ? '+' : ''}{formatCurrency(diff, settings.currency, settings.language)})
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 shrink-0">{s.typeOfGoods}</span>
            </div>
            <div className="flex items-center gap-2">
              {isToday && <span className="text-[10px] font-bold text-brand-600">{t('visits_today')}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          {s.phone && (
            <a 
              href={`tel:${s.phone}`} 
              onClick={(e) => e.stopPropagation()}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-50 text-brand-600 border border-zinc-100 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700 transition-colors"
            >
              <Phone size={18}/>
            </a>
          )}
          {(settings.showSupplierSessionButton ?? true) && (
            activeSupplier?.id === s.id ? (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsSessionSummaryOpen(true); }} 
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition-all font-bold shadow-sm"
                title={t('end_supplier_session')}
              >
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveSupplier({ id: s.id!, name: s.name }); }} 
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-all font-bold shadow-sm"
                title={t('start_supplier_session')}
              >
                <Play size={16} fill="currentColor" />
              </button>
            )
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); setSelectedSupplier(s); setIsAddTxModalOpen(true); }} 
            className="flex items-center justify-center gap-1.5 px-3 h-[34px] bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/30 transition-all active:scale-95 shrink-0"
          >
            <span className="font-bold text-sm tracking-wide">{t('record_payment', 'تسديد')}</span>
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

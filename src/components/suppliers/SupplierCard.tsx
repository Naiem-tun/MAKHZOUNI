import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Phone, Square, Play, Plus, Edit2, Trash2, Clock } from 'lucide-react';
import { Supplier, Debt } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';
import { resolveFolioTheme } from '../folio/FolioPageChrome';

interface SupplierCardProps {
  supplier: Supplier & {
    txCount?: number;
    totalPaid?: number;
    isMissed?: boolean;
    visitHistory?: { status: 'attended' | 'absent' | 'pending' | 'unknown'; date: string }[];
  };
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
  isTrackingMode?: boolean;
  onMarkAbsent: (supplierId: string, dateIso: string) => void;
  theme?: FolioTheme;
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
  setIsAddTxModalOpen,
  isTrackingMode,
  onMarkAbsent,
  theme,
}: SupplierCardProps) {
  const { t } = useTranslation();
  const activeTheme = theme || resolveFolioTheme(Boolean(settings?.darkMode));
  const showFinancials = settings?.showFinancials ?? true;
  const language = settings?.language || 'ar';
  const formatPrivateValue = (val: number) =>
    !showFinancials ? '••••••' : formatCurrency(val, settings.currency, language);

  const hasUnpaidDebt = debts.some((d) => d.customerName === s.name && d.status === 'unpaid');

  return (
    <div
      className="relative group overflow-hidden"
      style={{ borderColor: activeTheme.border }}
    >
      {/* Hidden Actions Layer (Behind) */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-1 gap-1 z-0">
        <button
          type="button"
          onClick={() => {
            setEditingSupplier(s);
            setSelectedVisitDays(s.visitDays || []);
            setIsModalOpen(true);
          }}
          className="h-[calc(100%-8px)] w-16 bg-edit-bg border border-edit-border flex flex-col items-center justify-center gap-1 text-edit-text cursor-pointer"
        >
          <Edit2 size={16} />
          <span className="text-[10px] font-bold">{t('edit')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setDeleteConfirmId(s.id!);
            setDeleteConfirmName(s.name || '');
          }}
          className="h-[calc(100%-8px)] w-16 bg-delete-bg border border-delete-border flex flex-col items-center justify-center gap-1 text-delete-text cursor-pointer"
        >
          <Trash2 size={16} />
          <span className="text-[10px] font-bold">{t('delete')}</span>
        </button>
      </div>

      {/* Swipable Front Layer */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.1}
        onClick={() => {
          setSelectedSupplier(s);
          setIsHistoryModalOpen(true);
        }}
        className="relative z-10 flex cursor-pointer items-center justify-between gap-2.5 p-3 sm:px-4 transition-colors"
        style={{
          backgroundColor: activeTheme.surface,
          borderRightWidth: '3px',
          borderRightStyle: 'solid',
          borderRightColor: isToday
            ? activeTheme.accent
            : s.isMissed
              ? activeTheme.negative
              : activeTheme.border,
        }}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <h3
              className="text-sm sm:text-base font-black truncate"
              style={{ color: activeTheme.text }}
            >
              {s.name}
            </h3>
            {hasUnpaidDebt && (
              <span
                className="text-xs font-black"
                style={{ color: activeTheme.negative }}
                title="يوجد دين غير مسدد"
              >
                (دين)
              </span>
            )}
            {s.typeOfGoods && (
              <>
                <span aria-hidden="true" style={{ color: activeTheme.textMuted }}>
                  ·
                </span>
                <span className="text-[11px] font-bold truncate" style={{ color: activeTheme.textMuted }}>
                  {s.typeOfGoods}
                </span>
              </>
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"
            style={{ color: activeTheme.textMuted }}
          >
            <span className="font-mono tabular-nums font-bold" style={{ color: activeTheme.text }}>
              {formatPrivateValue(s.totalPaid || 0)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {s.txCount || 0} {t('operations')}
            </span>

            {isToday && !isTrackingMode && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-bold" style={{ color: activeTheme.accent }}>
                  {t('visits_today')}
                </span>
              </>
            )}
            {s.isMissed && !isToday && !isTrackingMode && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-bold" style={{ color: activeTheme.negative }}>
                  {t('missed_visit')}
                </span>
              </>
            )}

            {uploadedReports.map((report, idx) => {
              const normalizeName = (name: string) =>
                (name || '')
                  .trim()
                  .toLowerCase()
                  .replace(/[أإآٱ]/g, 'ا')
                  .replace(/ة/g, 'ه')
                  .replace(/ي/g, 'ى')
                  .replace(/[\u064B-\u065F]/g, '')
                  .replace(/\s+/g, ' ');
              const sNorm = normalizeName(s.name);
              let val =
                report.data[s.name] ??
                report.data[s.name?.trim()] ??
                report.data[sNorm] ??
                report.data[s.name?.toLowerCase()?.trim()];
              if (val === undefined && report.data) {
                const matchedKey = Object.keys(report.data).find((k) => normalizeName(k) === sNorm);
                if (matchedKey) {
                  val = report.data[matchedKey];
                }
              }
              val = val ?? 0;
              const diff = (s.totalPaid || 0) - val;
              const match = report.name.match(/\((\d+)\)/);
              const shortName = match ? match[0] : `(${idx + 1})`;
              return (
                <span
                  key={report.id}
                  className="inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-bold"
                  style={{
                    backgroundColor: activeTheme.bg,
                    borderColor: activeTheme.border,
                    color: activeTheme.accent,
                  }}
                  title={report.name}
                >
                  {shortName}: {formatPrivateValue(val)}
                  {diff !== 0 && (
                    <span
                      style={{ color: diff > 0 ? activeTheme.positive : activeTheme.negative }}
                      dir="ltr"
                    >
                      ({diff > 0 ? '+' : ''}
                      {formatPrivateValue(diff)})
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          {isTrackingMode && s.visitHistory && s.visitHistory.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 text-[14px] font-bold tracking-widest" dir="ltr">
              {[...s.visitHistory]
                .reverse()
                .slice(0, 5)
                .map((visit, idx) => {
                  if (visit.status === 'attended') {
                    return (
                      <span key={idx} style={{ color: activeTheme.positive }} title="حضر">
                        ✓
                      </span>
                    );
                  }
                  if (visit.status === 'absent') {
                    return (
                      <span key={idx} style={{ color: activeTheme.negative }} title="غياب مؤكد">
                        ×
                      </span>
                    );
                  }
                  if (visit.status === 'pending') {
                    return (
                      <span key={idx} title="في الانتظار اليوم">
                        <Clock className="w-3.5 h-3.5" style={{ color: activeTheme.accent }} />
                      </span>
                    );
                  }
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkAbsent(s.id!, visit.date);
                      }}
                      className="cursor-pointer text-[12px] transition-opacity hover:opacity-75"
                      style={{ color: activeTheme.textMuted }}
                      title="اضغط لتسجيل غياب مؤكد"
                    >
                      ؟
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          {s.phone && (
            <a
              href={`tel:${s.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="w-9 h-9 flex items-center justify-center border transition-colors"
              style={{
                backgroundColor: activeTheme.surfaceMuted,
                borderColor: activeTheme.border,
                color: activeTheme.text,
              }}
              title="اتصال"
            >
              <Phone size={15} />
            </a>
          )}

          {(settings.showSupplierSessionButton ?? true) &&
            (activeSupplier?.id === s.id ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSessionSummaryOpen(true);
                }}
                className="w-9 h-9 flex items-center justify-center border transition-colors cursor-pointer"
                style={{
                  backgroundColor: activeTheme.text,
                  borderColor: activeTheme.text,
                  color: activeTheme.surface,
                }}
                title={t('end_supplier_session')}
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSupplier({ id: s.id!, name: s.name, visitDays: s.visitDays });
                }}
                className="w-9 h-9 flex items-center justify-center border transition-colors cursor-pointer"
                style={{
                  backgroundColor: activeTheme.surfaceMuted,
                  borderColor: activeTheme.border,
                  color: activeTheme.accent,
                }}
                title={t('start_supplier_session')}
              >
                <Play size={14} fill="currentColor" />
              </button>
            ))}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSupplier(s);
              setIsAddTxModalOpen(true);
            }}
            className="h-9 px-2.5 flex items-center justify-center gap-1 border text-xs font-bold transition-colors cursor-pointer shrink-0"
            style={{
              backgroundColor: activeTheme.accent,
              borderColor: activeTheme.accent,
              color: activeTheme.accentText,
            }}
          >
            <span>{t('record_payment', 'تسديد')}</span>
            <Plus size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

import React, { useMemo, useRef, useState } from 'react';
import { ArrowUpLeft, ChevronLeft, ChevronRight, Layers, Truck } from 'lucide-react';
import { formatAppDate, safeParseDate } from '../../lib/utils';
import { Transaction } from '../../types';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';
import { resolveFolioTheme } from '../folio/FolioPageChrome';

export const resolveDashboardFolioTheme = (
  darkMode: boolean,
  preferredId?: string,
): FolioTheme => resolveFolioTheme(darkMode, preferredId);

// Build smooth SVG cubic Bezier path (Catmull-Rom -> Cubic Bezier with vertical clamping)
const buildSmoothCurvePath = (
  points: { x: number; y: number }[],
  minY: number,
  maxY: number,
): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const clampY = (y: number) => Math.max(minY, Math.min(maxY, y));
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = clampY(p2.y - (p3.y - p1.y) / 6);

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
};

interface FolioPurchaseCurveChartProps {
  purchases: Transaction[];
  theme: FolioTheme;
  language: string;
  formatPrivateValue: (val: number) => string;
  t: any;
}

export const FolioPurchaseCurveChart: React.FC<FolioPurchaseCurveChartProps> = ({
  purchases,
  theme,
  language,
  formatPrivateValue,
  t,
}) => {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const series = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Map YYYY-MM-DD -> { total, count }
    const dayMap = new Map<string, { total: number; count: number }>();
    purchases.forEach((p: any) => {
      const dt = safeParseDate(p.date || p.createdAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const existing = dayMap.get(key) || { total: 0, count: 0 };
      existing.total += Number(p.amount) || 0;
      existing.count += 1;
      dayMap.set(key, existing);
    });

    const days: {
      key: string;
      date: Date;
      shortLabel: string;
      fullLabel: string;
      total: number;
      count: number;
    }[] = [];

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const info = dayMap.get(key) || { total: 0, count: 0 };
      days.push({
        key,
        date: d,
        shortLabel: `${d.getDate()}/${d.getMonth() + 1}`,
        fullLabel: formatAppDate(d, language, t),
        total: info.total,
        count: info.count,
      });
    }

    return days;
  }, [purchases, rangeDays, language, t]);

  const periodStats = useMemo(() => {
    const totalSpend = series.reduce((sum, d) => sum + d.total, 0);
    const activeDays = series.filter((d) => d.total > 0).length;
    const peakDay = series.reduce(
      (best, cur) => (cur.total > best.total ? cur : best),
      series[0] || { total: 0, fullLabel: '-', shortLabel: '-' },
    );
    const avgPerActiveDay = activeDays > 0 ? totalSpend / activeDays : 0;
    return { totalSpend, activeDays, peakDay, avgPerActiveDay };
  }, [series]);

  const activePoint =
    selectedIdx !== null && series[selectedIdx]
      ? series[selectedIdx]
      : series[series.length - 1];

  const chartGeometry = useMemo(() => {
    const w = 680;
    const h = 210;
    const padL = 16;
    const padR = 16;
    const padT = 18;
    const padB = 30;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const maxVal = Math.max(1, ...series.map((d) => d.total)) * 1.15;

    const pts = series.map((d, idx) => {
      const x =
        series.length <= 1
          ? padL + innerW / 2
          : padL + (idx / (series.length - 1)) * innerW;
      const y = padT + innerH - (d.total / maxVal) * innerH;
      return { x, y, day: d, idx };
    });

    const baselineY = padT + innerH;
    const linePath = buildSmoothCurvePath(pts, padT, baselineY);
    const areaPath =
      pts.length > 0
        ? `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${pts[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`
        : '';

    return { w, h, padL, padR, padT, padB, baselineY, pts, linePath, areaPath };
  }, [series]);

  const labelStep = rangeDays === 7 ? 1 : rangeDays === 14 ? 2 : 5;

  const selectIndexFromClientX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || series.length === 0) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return;

    const relX = ((clientX - rect.left) / rect.width) * chartGeometry.w;
    let closestIdx = 0;
    let minDist = Infinity;
    chartGeometry.pts.forEach((pt) => {
      const dist = Math.abs(pt.x - relX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = pt.idx;
      }
    });
    setSelectedIdx(closestIdx);
  };

  const stepDay = (delta: number) => {
    if (series.length === 0) return;
    setSelectedIdx((prev) => {
      if (prev === null) {
        // Start from the latest day when stepping backwards, or peak/first when stepping forwards
        return delta < 0 ? Math.max(0, series.length - 1) : 0;
      }
      return Math.max(0, Math.min(series.length - 1, prev + delta));
    });
  };

  return (
    <section
      className="border transition-colors text-right"
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
        color: theme.text,
      }}
    >
      {/* Header & Range Selector */}
      <div
        className="p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ borderColor: theme.border }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
              03
            </span>
            <span style={{ color: theme.textMuted }}>منحنى السيولة والمشتريات</span>
          </div>
          <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
            <span>حركة المشتريات اليومية</span>
          </h2>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {([7, 14, 30] as const).map((days) => {
            const active = rangeDays === days;
            return (
              <button
                key={days}
                type="button"
                onClick={() => {
                  setRangeDays(days);
                  setSelectedIdx(null);
                }}
                className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  backgroundColor: active ? theme.text : theme.surfaceMuted,
                  color: active ? theme.surface : theme.text,
                  borderColor: active ? theme.text : theme.border,
                }}
              >
                آخر {days} يوم
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Live Readout Strip */}
      <div
        className="grid grid-cols-3 border-b divide-x divide-x-reverse"
        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      >
        <div className="p-3 sm:p-4 space-y-0.5" style={{ borderColor: theme.border }}>
          <div className="text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
            {selectedIdx !== null ? activePoint?.fullLabel : 'مشتريات الفترة'}
          </div>
          <div
            className="text-sm sm:text-lg font-black font-mono tabular-nums"
            style={{ color: theme.accent }}
          >
            {formatPrivateValue(
              selectedIdx !== null ? activePoint?.total || 0 : periodStats.totalSpend,
            )}
          </div>
          <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
            {selectedIdx !== null
              ? `${activePoint?.count || 0} عملية شراء`
              : `${periodStats.activeDays} أيام نشطة`}
          </div>
        </div>

        <div className="p-3 sm:p-4 space-y-0.5" style={{ borderColor: theme.border }}>
          <div className="text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
            أعلى يوم شراء
          </div>
          <div
            className="text-sm sm:text-lg font-black font-mono tabular-nums"
            style={{ color: theme.text }}
          >
            {formatPrivateValue(periodStats.peakDay?.total || 0)}
          </div>
          <div className="text-[10px] font-mono tabular-nums truncate" style={{ color: theme.textMuted }}>
            {periodStats.peakDay?.total > 0 ? periodStats.peakDay.fullLabel : '—'}
          </div>
        </div>

        <div className="p-3 sm:p-4 space-y-0.5" style={{ borderColor: theme.border }}>
          <div className="text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
            متوسط اليوم النشط
          </div>
          <div
            className="text-sm sm:text-lg font-black font-mono tabular-nums"
            style={{ color: theme.text }}
          >
            {formatPrivateValue(periodStats.avgPerActiveDay)}
          </div>
          <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
            نطاق {rangeDays} يوم
          </div>
        </div>
      </div>

      {/* Smooth Curved SVG Area Chart */}
      <div className="p-3 sm:p-5">
        {periodStats.totalSpend === 0 ? (
          <div
            className="py-10 text-center text-xs font-bold border border-dashed"
            style={{ borderColor: theme.border, color: theme.textMuted }}
          >
            لا توجد مشتريات مسجلة خلال آخر {rangeDays} يوماً لرسم المنحنى.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-full" dir="ltr">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${chartGeometry.w} ${chartGeometry.h}`}
                className="w-full h-44 sm:h-52 select-none overflow-visible cursor-crosshair"
                style={{ touchAction: 'pan-y' }}
                onPointerDown={(e) => {
                  setIsDragging(true);
                  selectIndexFromClientX(e.clientX);
                }}
                onPointerMove={(e) => {
                  if (e.pointerType === 'mouse' || isDragging) {
                    selectIndexFromClientX(e.clientX);
                  }
                }}
                onPointerUp={() => setIsDragging(false)}
                onPointerCancel={() => setIsDragging(false)}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'mouse') {
                    setIsDragging(false);
                  }
                }}
              >
                <defs>
                  <linearGradient id="folioPurchaseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.accent} stopOpacity="0.26" />
                    <stop offset="100%" stopColor={theme.accent} stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines */}
                {[0, 0.33, 0.66, 1].map((ratio) => {
                  const y =
                    chartGeometry.padT +
                    (1 - ratio) * (chartGeometry.baselineY - chartGeometry.padT);
                  return (
                    <line
                      key={ratio}
                      x1={chartGeometry.padL}
                      y1={y}
                      x2={chartGeometry.w - chartGeometry.padR}
                      y2={y}
                      stroke={theme.border}
                      strokeDasharray={ratio === 0 ? undefined : '3 3'}
                      strokeWidth={1}
                    />
                  );
                })}

                {/* Smooth Area Fill */}
                <path d={chartGeometry.areaPath} fill="url(#folioPurchaseAreaGrad)" />

                {/* Smooth Curved Stroke */}
                <path
                  d={chartGeometry.linePath}
                  fill="none"
                  stroke={theme.accent}
                  strokeWidth={2.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive Points */}
                {chartGeometry.pts.map((pt) => {
                  const isActive =
                    selectedIdx !== null
                      ? selectedIdx === pt.idx
                      : pt.day.total > 0 && pt.day.total === periodStats.peakDay?.total;
                  const showXAxisLabel =
                    pt.idx % labelStep === 0 || pt.idx === chartGeometry.pts.length - 1;

                  return (
                    <g key={pt.day.key}>
                      {isActive && (
                        <>
                          <line
                            x1={pt.x}
                            y1={chartGeometry.padT}
                            x2={pt.x}
                            y2={chartGeometry.baselineY}
                            stroke={theme.accent}
                            strokeOpacity={0.45}
                            strokeDasharray="3 3"
                            strokeWidth={1.5}
                          />
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={10}
                            fill={theme.accent}
                            fillOpacity={0.14}
                          />
                        </>
                      )}

                      {(pt.day.total > 0 || isActive) && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isActive ? 5.5 : 3}
                          fill={isActive ? theme.accent : theme.surface}
                          stroke={theme.accent}
                          strokeWidth={2}
                        />
                      )}

                      {showXAxisLabel && (
                        <text
                          x={pt.x}
                          y={chartGeometry.h - 6}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={isActive ? 700 : 500}
                          fill={isActive ? theme.text : theme.textMuted}
                          className="font-mono"
                        >
                          {pt.day.shortLabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Day-to-Day Stepper Controls */}
            <div
              className="pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-[11px]"
              style={{ borderColor: theme.border, color: theme.textMuted }}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => stepDay(-1)}
                  disabled={selectedIdx !== null && selectedIdx <= 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border disabled:opacity-35 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  <ChevronRight size={13} />
                  <span>اليوم السابق</span>
                </button>
                <button
                  type="button"
                  onClick={() => stepDay(1)}
                  disabled={selectedIdx !== null && selectedIdx >= series.length - 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border disabled:opacity-35 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  <span>اليوم التالي</span>
                  <ChevronLeft size={13} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {selectedIdx !== null ? (
                  <>
                    <span className="font-mono tabular-nums font-bold" style={{ color: theme.text }}>
                      {selectedIdx + 1} / {series.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedIdx(null)}
                      className="px-2.5 py-1 text-xs font-bold border cursor-pointer"
                      style={{
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                        color: theme.accent,
                      }}
                    >
                      ملخص الفترة
                    </button>
                  </>
                ) : (
                  <span>المس المنحنى أو استخدم الأسهم للتنقل بين الأيام</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

interface FolioCategoriesAndSuppliersProps {
  categoryAnalysis: {
    name: string;
    count: number;
    totalPurchase: number;
    totalQuantity: number;
  }[];
  topSuppliers: {
    name: string;
    debt: number;
    purchaseVolume: number;
  }[];
  totalInventoryValue: number;
  theme: FolioTheme;
  formatPrivateValue: (val: number) => string;
  onNavigateTab: (tab: any) => void;
  t: any;
}

export const FolioCategoriesAndSuppliers: React.FC<
  FolioCategoriesAndSuppliersProps
> = ({
  categoryAnalysis,
  topSuppliers,
  totalInventoryValue,
  theme,
  formatPrivateValue,
  onNavigateTab,
  t,
}) => {
  const maxSupplierVol = Math.max(
    1,
    ...topSuppliers.map((s) => s.purchaseVolume || 0),
  );

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-right">
      {/* Top Categories Folio Table */}
      <div
        className="border flex flex-col"
        style={{
          backgroundColor: theme.surface,
          borderColor: theme.border,
          color: theme.text,
        }}
      >
        <div
          className="p-4 border-b flex items-center justify-between gap-2"
          style={{ borderColor: theme.border }}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                05.أ
              </span>
              <span style={{ color: theme.textMuted }}>توزيع رأس المال</span>
            </div>
            <h3 className="text-sm sm:text-base font-black flex items-center gap-1.5">
              <Layers size={15} style={{ color: theme.accent }} />
              <span>أعلى الفئات قيمة بالمخزون</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('category-analysis')}
            className="text-xs font-bold inline-flex items-center gap-1 px-2.5 py-1 border cursor-pointer whitespace-nowrap shrink-0"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.text,
            }}
          >
            <span>التفاصيل</span>
            <ArrowUpLeft size={13} />
          </button>
        </div>

        {categoryAnalysis.length === 0 ? (
          <div className="p-8 text-center text-xs font-bold" style={{ color: theme.textMuted }}>
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
                  <th className="py-2.5 px-3">الكمية</th>
                  <th className="py-2.5 px-3">الحصة</th>
                  <th className="py-2.5 px-3">القيمة</th>
                </tr>
              </thead>
              <tbody>
                {categoryAnalysis.map((cat, idx) => {
                  const label =
                    cat.name === 'other_cat'
                      ? t('other_categories', 'فئات أخرى')
                      : cat.name;
                  const sharePct =
                    totalInventoryValue > 0
                      ? Math.round((cat.totalPurchase / totalInventoryValue) * 100)
                      : 0;
                  return (
                    <tr
                      key={`${cat.name}-${idx}`}
                      className="border-b last:border-b-0"
                      style={{ borderColor: theme.border }}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-bold truncate max-w-[140px]">{label}</div>
                        <div
                          className="w-full h-1 mt-1.5 overflow-hidden"
                          style={{ backgroundColor: theme.surfaceMuted }}
                        >
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.min(100, Math.max(4, sharePct))}%`,
                              backgroundColor:
                                theme.series[idx % theme.series.length],
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {cat.totalQuantity.toLocaleString('en-US')}
                      </td>
                      <td
                        className="py-2.5 px-3 font-mono tabular-nums font-bold"
                        style={{ color: theme.textMuted }}
                      >
                        {sharePct}%
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-black">
                        {formatPrivateValue(cat.totalPurchase)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Suppliers Folio Table */}
      <div
        className="border flex flex-col"
        style={{
          backgroundColor: theme.surface,
          borderColor: theme.border,
          color: theme.text,
        }}
      >
        <div
          className="p-4 border-b flex items-center justify-between gap-2"
          style={{ borderColor: theme.border }}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                05.ب
              </span>
              <span style={{ color: theme.textMuted }}>حجم التوريد المفتوح</span>
            </div>
            <h3 className="text-sm sm:text-base font-black flex items-center gap-1.5">
              <Truck size={15} style={{ color: theme.accent }} />
              <span>أهم الموردين (الدورة الحالية)</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('suppliers')}
            className="text-xs font-bold inline-flex items-center gap-1 px-2.5 py-1 border cursor-pointer whitespace-nowrap shrink-0"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.text,
            }}
          >
            <span>الموردون</span>
            <ArrowUpLeft size={13} />
          </button>
        </div>

        {topSuppliers.length === 0 ? (
          <div className="p-8 text-center text-xs font-bold" style={{ color: theme.textMuted }}>
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
                  <th className="py-2.5 px-3">المورد</th>
                  <th className="py-2.5 px-3">المشتريات</th>
                  <th className="py-2.5 px-3">الدين المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {topSuppliers.map((sup, idx) => {
                  const barPct = Math.round(
                    ((sup.purchaseVolume || 0) / maxSupplierVol) * 100,
                  );
                  return (
                    <tr
                      key={`${sup.name}-${idx}`}
                      onClick={() => onNavigateTab('suppliers')}
                      className="border-b last:border-b-0 cursor-pointer transition-colors"
                      style={{ borderColor: theme.border }}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-bold truncate max-w-[160px]">
                          {sup.name}
                        </div>
                        <div
                          className="w-full h-1 mt-1.5 overflow-hidden"
                          style={{ backgroundColor: theme.surfaceMuted }}
                        >
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.min(100, Math.max(4, barPct))}%`,
                              backgroundColor: theme.accent,
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-black">
                        {formatPrivateValue(sup.purchaseVolume)}
                      </td>
                      <td
                        className="py-2.5 px-3 font-mono tabular-nums font-bold"
                        style={{
                          color:
                            sup.debt > 0.0001 ? theme.negative : theme.textMuted,
                        }}
                      >
                        {sup.debt > 0.0001 ? formatPrivateValue(sup.debt) : '0'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

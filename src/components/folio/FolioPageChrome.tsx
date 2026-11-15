import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatAppDate, safeParseDate } from '../../lib/utils';
import { FOLIO_THEMES } from '../inventory/analytics/folio/folioThemes';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';

export const FOLIO_THEME_STORAGE_KEY = 'folio_theme_id';
export const FOLIO_THEME_CHANGED_EVENT = 'folio-theme-changed';

export const setGlobalFolioTheme = (id: string) => {
  try {
    localStorage.setItem(FOLIO_THEME_STORAGE_KEY, id);
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(FOLIO_THEME_CHANGED_EVENT, { detail: { id } }),
    );
  }
};

export const resolveFolioTheme = (
  darkMode: boolean,
  preferredId?: string,
): FolioTheme => {
  if (preferredId) {
    const match = FOLIO_THEMES.find((t) => t.id === preferredId);
    if (match) return match;
  }
  try {
    const saved = localStorage.getItem(FOLIO_THEME_STORAGE_KEY);
    if (saved) {
      const match = FOLIO_THEMES.find((t) => t.id === saved);
      if (match) return match;
    }
  } catch {}
  return (
    FOLIO_THEMES.find(
      (t) => t.id === (darkMode ? 'folio-night' : 'folio-editorial'),
    ) || FOLIO_THEMES[0]
  );
};

export function useFolioTheme(darkMode: boolean, preferredId?: string) {
  const [themeId, setThemeId] = useState<string>(() => {
    if (preferredId && FOLIO_THEMES.some((item) => item.id === preferredId)) {
      return preferredId;
    }
    try {
      const saved = localStorage.getItem(FOLIO_THEME_STORAGE_KEY);
      if (saved && FOLIO_THEMES.some((item) => item.id === saved)) return saved;
    } catch {}
    return darkMode ? 'folio-night' : 'folio-editorial';
  });

  useEffect(() => {
    if (preferredId && FOLIO_THEMES.some((item) => item.id === preferredId)) {
      setThemeId(preferredId);
    }
  }, [preferredId]);

  useEffect(() => {
    const handleThemeEvent = (e: Event) => {
      const custom = e as CustomEvent<{ id?: string }>;
      const nextId = custom.detail?.id;
      if (nextId && FOLIO_THEMES.some((item) => item.id === nextId)) {
        setThemeId(nextId);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === FOLIO_THEME_STORAGE_KEY &&
        e.newValue &&
        FOLIO_THEMES.some((item) => item.id === e.newValue)
      ) {
        setThemeId(e.newValue);
      }
    };
    window.addEventListener(FOLIO_THEME_CHANGED_EVENT, handleThemeEvent);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(FOLIO_THEME_CHANGED_EVENT, handleThemeEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const theme = useMemo(
    () => resolveFolioTheme(darkMode, themeId),
    [darkMode, themeId],
  );

  return {
    theme,
    themeId: theme.id,
    selectTheme: setGlobalFolioTheme,
  };
}

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

export interface TrendRecordItem {
  date: any;
  amount: number;
}

interface FolioSmoothTrendCardProps {
  sectionIndex: string;
  kicker: string;
  title: string;
  items: TrendRecordItem[];
  theme: FolioTheme;
  language: string;
  formatValue: (val: number) => string;
  t: any;
  unitLabel?: string;
  emptyMessage?: string;
  gradientId?: string;
}

export const FolioSmoothTrendCard: React.FC<FolioSmoothTrendCardProps> = ({
  sectionIndex,
  kicker,
  title,
  items,
  theme,
  language,
  formatValue,
  t,
  unitLabel = 'عملية',
  emptyMessage,
  gradientId = 'folioTrendAreaGrad',
}) => {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const series = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayMap = new Map<string, { total: number; count: number }>();
    items.forEach((item) => {
      const amt = Number(item.amount) || 0;
      if (amt <= 0) return;
      const dt = safeParseDate(item.date);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const existing = dayMap.get(key) || { total: 0, count: 0 };
      existing.total += amt;
      existing.count += 1;
      dayMap.set(key, existing);
    });

    const days: {
      key: string;
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
        shortLabel: `${d.getDate()}/${d.getMonth() + 1}`,
        fullLabel: formatAppDate(d, language, t),
        total: info.total,
        count: info.count,
      });
    }

    return days;
  }, [items, rangeDays, language, t]);

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
    const h = 195;
    const padL = 16;
    const padR = 16;
    const padT = 16;
    const padB = 28;
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
      <div
        className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ borderColor: theme.border }}
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
              {sectionIndex}
            </span>
            <span style={{ color: theme.textMuted }}>{kicker}</span>
          </div>
          <h2 className="text-sm sm:text-base font-black tracking-tight">{title}</h2>
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
                className="px-2.5 py-1 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  backgroundColor: active ? theme.text : theme.surfaceMuted,
                  color: active ? theme.surface : theme.text,
                  borderColor: active ? theme.text : theme.border,
                }}
              >
                {days} يوم
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Readout Strip */}
      <div
        className="grid grid-cols-3 border-b divide-x divide-x-reverse"
        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      >
        <div className="p-3 space-y-0.5" style={{ borderColor: theme.border }}>
          <div className="text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
            {selectedIdx !== null ? activePoint?.fullLabel : 'إجمالي الفترة'}
          </div>
          <div
            className="text-sm sm:text-base font-black font-mono tabular-nums"
            style={{ color: theme.accent }}
          >
            {formatValue(selectedIdx !== null ? activePoint?.total || 0 : periodStats.totalSpend)}
          </div>
          <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
            {selectedIdx !== null
              ? `${activePoint?.count || 0} ${unitLabel}`
              : `${periodStats.activeDays} أيام نشطة`}
          </div>
        </div>

        <div className="p-3 space-y-0.5" style={{ borderColor: theme.border }}>
          <div className="text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
            الأعلى في يوم
          </div>
          <div
            className="text-sm sm:text-base font-black font-mono tabular-nums"
            style={{ color: theme.text }}
          >
            {formatValue(periodStats.peakDay?.total || 0)}
          </div>
          <div className="text-[10px] font-mono tabular-nums truncate" style={{ color: theme.textMuted }}>
            {periodStats.peakDay?.total > 0 ? periodStats.peakDay.fullLabel : '—'}
          </div>
        </div>

        <div className="p-3 space-y-0.5" style={{ borderColor: theme.border }}>
          <div className="text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
            المتوسط اليومي
          </div>
          <div
            className="text-sm sm:text-base font-black font-mono tabular-nums"
            style={{ color: theme.text }}
          >
            {formatValue(periodStats.avgPerActiveDay)}
          </div>
          <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
            نطاق {rangeDays} يوم
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {periodStats.totalSpend === 0 ? (
          <div
            className="py-8 text-center text-xs font-bold border border-dashed"
            style={{ borderColor: theme.border, color: theme.textMuted }}
          >
            {emptyMessage || `لا توجد بيانات مسجلة خلال آخر ${rangeDays} يوماً.`}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-full" dir="ltr">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${chartGeometry.w} ${chartGeometry.h}`}
                className="w-full h-40 sm:h-48 select-none overflow-visible cursor-crosshair"
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
                  if (e.pointerType === 'mouse') setIsDragging(false);
                }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.accent} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={theme.accent} stopOpacity="0.01" />
                  </linearGradient>
                </defs>

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

                <path d={chartGeometry.areaPath} fill={`url(#${gradientId})`} />
                <path
                  d={chartGeometry.linePath}
                  fill="none"
                  stroke={theme.accent}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

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
                            r={9}
                            fill={theme.accent}
                            fillOpacity={0.14}
                          />
                        </>
                      )}

                      {(pt.day.total > 0 || isActive) && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isActive ? 5 : 2.8}
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

            <div
              className="pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px]"
              style={{ borderColor: theme.border, color: theme.textMuted }}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => stepDay(-1)}
                  disabled={selectedIdx !== null && selectedIdx <= 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border disabled:opacity-35 cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  <ChevronRight size={13} />
                  <span>السابق</span>
                </button>
                <button
                  type="button"
                  onClick={() => stepDay(1)}
                  disabled={selectedIdx !== null && selectedIdx >= series.length - 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border disabled:opacity-35 cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  <span>التالي</span>
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
                      className="px-2 py-0.5 text-xs font-bold border cursor-pointer"
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
                  <span>المس المنحنى أو استخدم الأسهم للتنقل</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Search } from 'lucide-react';
import { formatCurrency } from '../../../../lib/utils';
import { UserSettings } from '../../../../types';
import { FolioSectionShell } from './FolioPrimitives';
import { FolioDataset, FolioScatterPoint, FolioTheme } from './folioTypes';

interface FolioChartsProps {
  data: FolioDataset;
  theme: FolioTheme;
  settings: UserSettings;
}

const fmtVal = (
  val: number,
  settings: UserSettings,
  showFinancials: boolean,
) => {
  if (!showFinancials) return '••••••';
  return formatCurrency(val, settings.currency, settings.language || 'ar');
};

export const FolioChartsPart2: React.FC<FolioChartsProps> = ({
  data,
  theme,
  settings,
}) => {
  const showFinancials = settings.showFinancials ?? true;

  // ---------------------------------------------------------------------------
  // 06 · Stacked Column Chart (Story Steps + Absolute vs Share)
  // ---------------------------------------------------------------------------
  const [stackedStep, setStackedStep] = useState<'01' | '02' | '03'>('03');
  const [stackedMode, setStackedMode] = useState<'absolute' | 'share'>(
    'absolute',
  );
  const [hoveredPeriodId, setHoveredPeriodId] = useState<string | null>(null);

  const visibleStackedPeriods = useMemo(() => {
    const all = data.stackedPeriods;
    if (all.length <= 2) return all;
    if (stackedStep === '01') return all.slice(0, Math.max(2, Math.ceil(all.length / 2)));
    if (stackedStep === '02') return all.slice(0, Math.max(2, Math.ceil((all.length * 3) / 4)));
    return all;
  }, [data.stackedPeriods, stackedStep]);

  const stackedMaxTotal = useMemo(() => {
    if (stackedMode === 'share') return 100;
    return Math.max(1, ...visibleStackedPeriods.map((p) => p.total)) * 1.1;
  }, [visibleStackedPeriods, stackedMode]);

  // ---------------------------------------------------------------------------
  // 07 · Sortable Heatmap Matrix + Threshold Slider
  // ---------------------------------------------------------------------------
  const [heatmapSortKey, setHeatmapSortKey] = useState<string>('overall');
  const [heatmapSortAsc, setHeatmapSortAsc] = useState<boolean>(false);
  const [heatmapThreshold, setHeatmapThreshold] = useState<number>(0);

  const sortedHeatmapRows = useMemo(() => {
    return [...data.heatmapRows].sort((a, b) => {
      const valA =
        heatmapSortKey === 'overall'
          ? a.overallScore
          : a.cells.find((c) => c.key === heatmapSortKey)?.score ?? 0;
      const valB =
        heatmapSortKey === 'overall'
          ? b.overallScore
          : b.cells.find((c) => c.key === heatmapSortKey)?.score ?? 0;
      return heatmapSortAsc ? valA - valB : valB - valA;
    });
  }, [data.heatmapRows, heatmapSortKey, heatmapSortAsc]);

  // ---------------------------------------------------------------------------
  // 08 · 10x10 Waffle Chart + Diverging Stacked Bar
  // ---------------------------------------------------------------------------
  const [waffleFilter, setWaffleFilter] = useState<
    'all' | 'excellent' | 'good' | 'risk'
  >('all');
  const [divergingSort, setDivergingSort] = useState<'original' | 'health'>(
    'original',
  );

  const waffleStats = useMemo(() => {
    const total = Math.max(1, data.products.length);
    const exc = data.products.filter((p) => p.marginPct >= 25).length;
    const good = data.products.filter(
      (p) => p.marginPct >= 12 && p.marginPct < 25,
    ).length;
    const risk = data.products.filter(
      (p) => p.marginPct < 12 || p.status === 'depleted',
    ).length;

    const excPct = Math.round((exc / total) * 100);
    const goodPct = Math.round((good / total) * 100);
    const riskPct = Math.max(0, 100 - excPct - goodPct);

    const cells: { idx: number; tier: 'excellent' | 'good' | 'risk'; color: string }[] = [];
    for (let i = 0; i < 100; i++) {
      if (i < excPct) {
        cells.push({ idx: i, tier: 'excellent', color: theme.series[0] });
      } else if (i < excPct + goodPct) {
        cells.push({ idx: i, tier: 'good', color: theme.series[3] });
      } else {
        cells.push({ idx: i, tier: 'risk', color: theme.series[1] });
      }
    }

    return { excPct, goodPct, riskPct, cells };
  }, [data.products, theme]);

  const sortedDivergingRows = useMemo(() => {
    const list = [...data.divergingRows];
    if (divergingSort === 'health') {
      list.sort((a, b) => b.healthScore - a.healthScore);
    }
    return list;
  }, [data.divergingRows, divergingSort]);

  // ---------------------------------------------------------------------------
  // 09 · Scatter Plot + OLS Regression Trend Line
  // ---------------------------------------------------------------------------
  const [hiddenScatterCats, setHiddenScatterCats] = useState<Set<string>>(
    new Set(),
  );
  const [showTrendLine, setShowTrendLine] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<FolioScatterPoint | null>(
    null,
  );

  const scatterCategories = useMemo(() => {
    return Array.from(new Set(data.scatterPoints.map((p) => p.category))).slice(
      0,
      4,
    );
  }, [data.scatterPoints]);

  const visibleScatterPoints = useMemo(() => {
    return data.scatterPoints.filter(
      (p) => !hiddenScatterCats.has(p.category),
    );
  }, [data.scatterPoints, hiddenScatterCats]);

  const scatterGeometry = useMemo(() => {
    const pts = visibleScatterPoints;
    const w = 680;
    const h = 300;
    const padL = 48;
    const padR = 24;
    const padT = 22;
    const padB = 38;

    const maxX = Math.max(5, ...pts.map((p) => p.x)) * 1.1;
    const minY = Math.min(0, ...pts.map((p) => p.y));
    const maxY = Math.max(30, ...pts.map((p) => p.y)) * 1.1;

    const scaleX = (x: number) =>
      padL + (x / Math.max(0.01, maxX)) * (w - padL - padR);
    const scaleY = (y: number) =>
      h - padB - ((y - minY) / Math.max(0.01, maxY - minY)) * (h - padT - padB);

    // OLS Linear Regression
    let slope = 0;
    let intercept = 0;
    let r2 = 0;
    if (pts.length >= 2) {
      const n = pts.length;
      const sumX = pts.reduce((s, p) => s + p.x, 0);
      const sumY = pts.reduce((s, p) => s + p.y, 0);
      const meanX = sumX / n;
      const meanY = sumY / n;
      let num = 0;
      let denX = 0;
      let denY = 0;
      pts.forEach((p) => {
        const dx = p.x - meanX;
        const dy = p.y - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      });
      slope = denX > 0 ? num / denX : 0;
      intercept = meanY - slope * meanX;
      r2 = denX > 0 && denY > 0 ? Math.pow(num, 2) / (denX * denY) : 0;
    }

    const lineStartY = intercept;
    const lineEndY = slope * maxX + intercept;

    return {
      w,
      h,
      padL,
      padR,
      padT,
      padB,
      maxX,
      minY,
      maxY,
      scaleX,
      scaleY,
      slope,
      r2,
      trendCoords: {
        x1: scaleX(0),
        y1: Math.min(h - padB, Math.max(padT, scaleY(lineStartY))),
        x2: scaleX(maxX),
        y2: Math.min(h - padB, Math.max(padT, scaleY(lineEndY))),
      },
    };
  }, [visibleScatterPoints]);

  const toggleScatterCat = (cat: string) => {
    setHiddenScatterCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // 10 · Searchable, Sortable Data Index + Sparklines + CSV Export
  // ---------------------------------------------------------------------------
  const [indexSearch, setIndexSearch] = useState('');
  const [indexCategory, setIndexCategory] = useState('all');
  const [indexSortCol, setIndexSortCol] = useState<
    'name' | 'stockQty' | 'costPrice' | 'sellPrice' | 'marginPct' | 'stockValue'
  >('stockValue');
  const [indexSortAsc, setIndexSortAsc] = useState(false);

  const filteredIndexRows = useMemo(() => {
    const q = indexSearch.trim().toLowerCase();
    return data.products
      .filter((p) => {
        if (indexCategory !== 'all' && p.category !== indexCategory)
          return false;
        if (q) {
          return (
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.barcode.toLowerCase().includes(q) ||
            p.supplierName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (indexSortCol === 'name') {
          const cmp = a.name.localeCompare(b.name, 'ar');
          return indexSortAsc ? cmp : -cmp;
        }
        const diff = a[indexSortCol] - b[indexSortCol];
        return indexSortAsc ? diff : -diff;
      });
  }, [data.products, indexSearch, indexCategory, indexSortCol, indexSortAsc]);

  const handleSortIndex = (col: typeof indexSortCol) => {
    if (indexSortCol === col) setIndexSortAsc(!indexSortAsc);
    else {
      setIndexSortCol(col);
      setIndexSortAsc(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'المنتج',
      'الباركود',
      'الفئة',
      'المورد',
      'الكمية',
      'سعر التكلفة',
      'سعر البيع',
      'هامش الربح %',
      'القيمة الإجمالية',
      'الحالة',
    ];
    const escapeCell = (v: string | number) => {
      const s = String(v ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };
    const statusLabels: Record<string, string> = {
      healthy: 'صحي',
      low: 'منخفض',
      depleted: 'نافد',
      stagnant: 'راكد',
    };

    const rows = filteredIndexRows.map((r) => [
      r.name,
      r.barcode || '-',
      r.category,
      r.supplierName,
      r.stockQty,
      showFinancials ? r.costPrice : '•••',
      showFinancials ? r.sellPrice : '•••',
      `${r.marginPct}%`,
      showFinancials ? r.stockValue : '•••',
      statusLabels[r.status] || r.status,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) => row.map(escapeCell).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `makhzouni-folio-report-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* =====================================================================
          SECTION 06 · STACKED COLUMN CHART (STORY STEPS + ABSOLUTE / SHARE)
          ===================================================================== */}
      <FolioSectionShell
        id="folio-sec-06"
        indexNumber="06"
        kicker="الأعمدة التراكمية"
        title="تطور مكونات القيمة والتكلفة عبر الفترات المتعاقبة"
        leadLeft="يتيح لك مخطط الأعمدة التراكمية قراءة تطور البنية المالية لمتجرك عبر الزمن؛ سواء كقيمة مطلقة بالعملة أو كحصة نسبية (100%) لكل فترة."
        leadRight="انتقل بين المراحل السردية الثلاث (01–03) لاستعراض التسلسل التدريجي، أو بدّل وضع العرض لملاحظة تغير الوزن النسبي بين الفئات."
        figureCaption="توزيع الأعمدة التراكمية عبر الفترات المسجلة مع وضع القيمة المطلقة والنسبة المئوية."
        theme={theme}
        tableContent={
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
                <th className="py-2.5 px-4">الفترة</th>
                {data.stackedSeriesMeta.map((s) => (
                  <th key={s.key} className="py-2.5 px-4">
                    {s.label}
                  </th>
                ))}
                <th className="py-2.5 px-4">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {visibleStackedPeriods.map((p) => (
                <tr
                  key={p.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: theme.border, color: theme.text }}
                >
                  <td className="py-2 px-4 font-bold">{p.label}</td>
                  {p.segments.map((seg) => (
                    <td key={seg.key} className="py-2 px-4 font-mono tabular-nums">
                      {stackedMode === 'share'
                        ? `${seg.pct}%`
                        : fmtVal(seg.value, settings, showFinancials)}
                    </td>
                  ))}
                  <td className="py-2 px-4 font-mono tabular-nums font-bold">
                    {stackedMode === 'share'
                      ? '100%'
                      : fmtVal(p.total, settings, showFinancials)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div
          className="border p-4 sm:p-6 space-y-5"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          {/* Controls Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: '01', label: 'المرحلة 01: التأسيس' },
                { id: '02', label: 'المرحلة 02: التوسع' },
                { id: '03', label: 'المرحلة 03: الصورة الكاملة' },
              ].map((st) => {
                const active = stackedStep === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStackedStep(st.id as any)}
                    className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: active ? theme.accent : theme.surfaceMuted,
                      color: active ? theme.accentText : theme.text,
                      borderColor: active ? theme.accent : theme.border,
                    }}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              {[
                { id: 'absolute', label: 'القيمة المطلقة' },
                { id: 'share', label: 'الحصة النسبية %' },
              ].map((m) => {
                const active = stackedMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setStackedMode(m.id as any)}
                    className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: active ? theme.text : theme.surfaceMuted,
                      color: active ? theme.surface : theme.text,
                      borderColor: active ? theme.text : theme.border,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Series Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {data.stackedSeriesMeta.map((s, idx) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 inline-block"
                  style={{
                    backgroundColor: theme.series[idx % theme.series.length],
                  }}
                />
                <span style={{ color: theme.textMuted }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Columns */}
          {visibleStackedPeriods.length === 0 ? (
            <div
              className="py-10 text-center text-xs font-bold"
              style={{ color: theme.textMuted }}
            >
              لا توجد بيانات فترات كافية لرسم الأعمدة التراكمية بعد.
            </div>
          ) : (
            <div
              className="grid gap-3 sm:gap-4 items-end h-64 pt-6 border-b pb-2"
              style={{
                borderColor: theme.border,
                gridTemplateColumns: `repeat(${visibleStackedPeriods.length}, minmax(0, 1fr))`,
              }}
            >
              {visibleStackedPeriods.map((period) => {
                const colPct =
                  stackedMode === 'share'
                    ? 100
                    : Math.max(
                        8,
                        Math.min(100, (period.total / stackedMaxTotal) * 100),
                      );
                const isHovered = hoveredPeriodId === period.id;

                return (
                  <div
                    key={period.id}
                    onMouseEnter={() => setHoveredPeriodId(period.id)}
                    onMouseLeave={() => setHoveredPeriodId(null)}
                    className="h-full flex flex-col justify-end items-center group"
                  >
                    <div
                      className="text-[10px] sm:text-[11px] font-mono tabular-nums font-bold mb-1.5 truncate max-w-full"
                      style={{ color: theme.text }}
                    >
                      {stackedMode === 'share'
                        ? '100%'
                        : showFinancials
                          ? period.total.toLocaleString('en-US', {
                              maximumFractionDigits: 0,
                            })
                          : '•••'}
                    </div>
                    <div
                      className="w-full max-w-[64px] flex flex-col-reverse overflow-hidden transition-all duration-200"
                      style={{
                        height: `${colPct}%`,
                        outline: isHovered
                          ? `2px solid ${theme.text}`
                          : 'none',
                        outlineOffset: '2px',
                      }}
                    >
                      {period.segments.map((seg, idx) => (
                        <div
                          key={seg.key}
                          style={{
                            height: `${Math.max(0, seg.pct)}%`,
                            backgroundColor:
                              theme.series[idx % theme.series.length],
                          }}
                          title={`${period.label} · ${seg.label}: ${
                            stackedMode === 'share'
                              ? `${seg.pct}%`
                              : fmtVal(seg.value, settings, showFinancials)
                          }`}
                        />
                      ))}
                    </div>
                    <div
                      className="pt-2 text-[11px] font-bold truncate max-w-full"
                      style={{ color: theme.textMuted }}
                    >
                      {period.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </FolioSectionShell>

      {/* =====================================================================
          SECTION 07 · SORTABLE HEATMAP MATRIX + THRESHOLD SLIDER
          ===================================================================== */}
      <FolioSectionShell
        id="folio-sec-07"
        indexNumber="07"
        kicker="الخريطة الحرارية"
        title="مقارنة أداء الفئات عبر 5 مؤشرات متزامنة في مصفوفة حرارية"
        leadLeft="تجمع الخريطة الحرارية أداء كل فئة عبر خمسة أبعاد أساسية (حصة رأس المال، هامش الربح، التوفر، صحة التغطية، وكثافة الحركة) في شبكة موحدة قابلة للفرز."
        leadRight="اسحب شريط عتبة التمييز لتخفيت الخلايا الضعيفة وإبراز نقاط القوة أو التركز الأعلى من النسبة التي تحددها."
        figureCaption="مصفوفة حرارية للأقسام قابلة للفرز من أي عمود مع تصفية بالعتبة المئوية."
        theme={theme}
      >
        <div
          className="border p-4 sm:p-6 space-y-5"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          {/* Threshold Slider */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label
                htmlFor="folio-heatmap-threshold"
                className="text-xs font-bold whitespace-nowrap"
                style={{ color: theme.text }}
              >
                تمييز القيم الأعلى من{' '}
                <span
                  className="font-mono tabular-nums"
                  style={{ color: theme.accent }}
                >
                  {heatmapThreshold}%
                </span>
              </label>
              <input
                id="folio-heatmap-threshold"
                type="range"
                min={0}
                max={90}
                step={5}
                value={heatmapThreshold}
                onChange={(e) => setHeatmapThreshold(Number(e.target.value))}
                className="w-36 sm:w-48 accent-current cursor-pointer"
                style={{ color: theme.accent }}
              />
            </div>

            <div className="flex items-center gap-2 text-[11px]" style={{ color: theme.textMuted }}>
              <span>أدنى</span>
              <div className="flex items-center gap-0.5">
                {[0.15, 0.35, 0.55, 0.78, 1].map((op, i) => (
                  <span
                    key={i}
                    className="w-4 h-3 inline-block"
                    style={{ backgroundColor: theme.accent, opacity: op }}
                  />
                ))}
              </div>
              <span>أعلى</span>
            </div>
          </div>

          {sortedHeatmapRows.length === 0 ? (
            <div
              className="py-10 text-center text-xs font-bold"
              style={{ color: theme.textMuted }}
            >
              لا توجد فئات كافية لبناء الخريطة الحرارية.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr
                    className="border-b font-bold"
                    style={{ borderColor: theme.border, color: theme.textMuted }}
                  >
                    <th className="py-2.5 px-3">الفئة</th>
                    {data.heatmapColumns.map((col) => (
                      <th key={col.key} className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (heatmapSortKey === col.key)
                              setHeatmapSortAsc(!heatmapSortAsc);
                            else {
                              setHeatmapSortKey(col.key);
                              setHeatmapSortAsc(false);
                            }
                          }}
                          className="inline-flex items-center justify-center gap-1 cursor-pointer hover:underline whitespace-nowrap"
                        >
                          <span>{col.label}</span>
                          {heatmapSortKey === col.key &&
                            (heatmapSortAsc ? (
                              <ArrowUp size={11} />
                            ) : (
                              <ArrowDown size={11} />
                            ))}
                        </button>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (heatmapSortKey === 'overall')
                            setHeatmapSortAsc(!heatmapSortAsc);
                          else {
                            setHeatmapSortKey('overall');
                            setHeatmapSortAsc(false);
                          }
                        }}
                        className="inline-flex items-center justify-center gap-1 cursor-pointer hover:underline whitespace-nowrap"
                      >
                        <span>المتوسط</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHeatmapRows.map((row) => (
                    <tr
                      key={row.category}
                      className="border-b last:border-b-0"
                      style={{ borderColor: theme.border }}
                    >
                      <td
                        className="py-2.5 px-3 font-bold whitespace-nowrap"
                        style={{ color: theme.text }}
                      >
                        {row.category}
                      </td>
                      {row.cells.map((cell) => {
                        const passes = cell.score >= heatmapThreshold;
                        const alpha = Math.max(0.1, cell.score / 100);
                        const isDarkFill = alpha >= 0.55;
                        return (
                          <td key={cell.key} className="p-1 text-center">
                            <div
                              className="py-2 px-2 font-mono tabular-nums font-bold transition-opacity duration-150"
                              style={{
                                backgroundColor: theme.accent,
                                opacity: passes ? Math.max(0.15, alpha) : 0.08,
                                color:
                                  passes && isDarkFill
                                    ? theme.accentText
                                    : theme.text,
                              }}
                              title={`${row.category} · ${cell.label}: ${cell.displayValue}`}
                            >
                              {cell.displayValue}
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-1 text-center">
                        <div
                          className="py-2 px-2 font-mono tabular-nums font-black border"
                          style={{
                            backgroundColor: theme.surfaceMuted,
                            borderColor: theme.border,
                            color: theme.text,
                          }}
                        >
                          {row.overallScore}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FolioSectionShell>

      {/* =====================================================================
          SECTION 08 · 10x10 WAFFLE + DIVERGING STACKED BAR
          ===================================================================== */}
      <FolioSectionShell
        id="folio-sec-08"
        indexNumber="08"
        kicker="النسبة المئوية والتوازن"
        title="مخطط الوافل (10×10) وتوزيع صحة الهوامش عبر الفئات"
        leadLeft="تترجم شبكة الوافل 10×10 بنية هوامش الربح في كامل المتجر إلى 100 خلية مئوية واضحة، لتشعر فوراً بنسبة الأصناف المربحة مقابل الأصناف الحرجة."
        leadRight="أسفل الشبكة، يكشف الشريط المتشعب توزيع شرائح الربحية داخل كل فئة من الفئات الأكثر نشاطاً لتحديد الأقسام التي تحتاج إعادة تسعير."
        figureCaption="شبكة وافل 10×10 لإجمالي الأصناف مع شريط توزيع متشعب لهوامش الربح حسب الفئة."
        theme={theme}
        tableContent={
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
                <th className="py-2.5 px-4">الفئة</th>
                <th className="py-2.5 px-4">ممتاز (25%+)</th>
                <th className="py-2.5 px-4">جيد (12–24%)</th>
                <th className="py-2.5 px-4">ضيق</th>
                <th className="py-2.5 px-4">حرج / نافد</th>
              </tr>
            </thead>
            <tbody>
              {sortedDivergingRows.map((r) => (
                <tr
                  key={r.category}
                  className="border-b last:border-b-0"
                  style={{ borderColor: theme.border, color: theme.text }}
                >
                  <td className="py-2 px-4 font-bold">{r.category}</td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {r.excellentPct}%
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {r.goodPct}%
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {r.tightPct}%
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {r.riskPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div className="space-y-6">
          {/* 10x10 Waffle Block */}
          <div
            className="border p-4 sm:p-6 space-y-6"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            {/* 3 Summary Percentages */}
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  pct: waffleStats.excPct,
                  label: 'أصناف ذات هامش ممتاز (25%+)',
                  tier: 'excellent' as const,
                },
                {
                  pct: waffleStats.goodPct,
                  label: 'أصناف بهامش متوازن (12–24%)',
                  tier: 'good' as const,
                },
                {
                  pct: waffleStats.riskPct,
                  label: 'أصناف ذات هامش ضيق أو نافدة',
                  tier: 'risk' as const,
                },
              ].map((stat) => (
                <div key={stat.tier} className="space-y-1">
                  <div
                    className="text-3xl sm:text-4xl font-black font-mono tabular-nums"
                    style={{ color: theme.text }}
                  >
                    {stat.pct}%
                  </div>
                  <div
                    className="text-xs leading-snug"
                    style={{ color: theme.textMuted }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Waffle Controls & 10x10 Grid */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all', label: 'كل الشرائح' },
                    { id: 'excellent', label: 'هامش ممتاز' },
                    { id: 'good', label: 'هامش جيد' },
                    { id: 'risk', label: 'ضيق / نافد' },
                  ].map((f) => {
                    const active = waffleFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setWaffleFilter(f.id as any)}
                        className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        style={{
                          backgroundColor: active
                            ? theme.text
                            : theme.surfaceMuted,
                          color: active ? theme.surface : theme.text,
                          borderColor: active ? theme.text : theme.border,
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                {/* 10x10 Matrix */}
                <div className="grid grid-cols-10 gap-1.5 w-fit">
                  {waffleStats.cells.map((cell) => {
                    const isDimmed =
                      waffleFilter !== 'all' && waffleFilter !== cell.tier;
                    return (
                      <div
                        key={cell.idx}
                        className="w-4 h-4 sm:w-5 sm:h-5 transition-opacity duration-150"
                        style={{
                          backgroundColor: cell.color,
                          opacity: isDimmed ? 0.16 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Giant Numeric Focus */}
              <div className="space-y-1 md:text-left">
                <div
                  className="text-5xl sm:text-6xl font-black font-mono tabular-nums"
                  style={{ color: theme.text }}
                >
                  {waffleFilter === 'excellent'
                    ? waffleStats.excPct
                    : waffleFilter === 'good'
                      ? waffleStats.goodPct
                      : waffleFilter === 'risk'
                        ? waffleStats.riskPct
                        : waffleStats.excPct + waffleStats.goodPct}
                  %
                </div>
                <div className="text-xs" style={{ color: theme.textMuted }}>
                  {waffleFilter === 'all'
                    ? 'إجمالي الأصناف ذات الربحية الإيجابية المريحة'
                    : 'نسبة الشريحة المحددة من إجمالي المتجر'}
                </div>
              </div>
            </div>
          </div>

          {/* Diverging Stacked Bar by Category */}
          <div
            className="border p-4 sm:p-6 space-y-5"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div
                className="text-sm font-black"
                style={{ color: theme.text }}
              >
                توزيع شرائح الربحية حسب الفئة
              </div>

              <div className="flex items-center gap-1.5">
                {[
                  { id: 'original', label: 'الترتيب الأصلي' },
                  { id: 'health', label: 'حسب نسبة الصحة' },
                ].map((s) => {
                  const active = divergingSort === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDivergingSort(s.id as any)}
                      className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      style={{
                        backgroundColor: active
                          ? theme.text
                          : theme.surfaceMuted,
                        color: active ? theme.surface : theme.text,
                        borderColor: active ? theme.text : theme.border,
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              {[
                { label: 'ممتاز (25%+)', color: theme.series[0] },
                { label: 'جيد (12–24%)', color: theme.series[3] },
                { label: 'هامش ضيق', color: theme.series[2] },
                { label: 'حرج / نافد', color: theme.series[1] },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 inline-block"
                    style={{ backgroundColor: l.color }}
                  />
                  <span style={{ color: theme.textMuted }}>{l.label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              {sortedDivergingRows.map((row) => (
                <div
                  key={row.category}
                  className="grid grid-cols-12 items-center gap-3"
                >
                  <div
                    className="col-span-4 sm:col-span-3 text-xs font-bold truncate"
                    style={{ color: theme.text }}
                  >
                    {row.category}
                  </div>
                  <div
                    className="col-span-8 sm:col-span-9 h-7 flex overflow-hidden border"
                    style={{ borderColor: theme.border }}
                  >
                    {[
                      { pct: row.riskPct, color: theme.series[1], label: 'حرج' },
                      { pct: row.tightPct, color: theme.series[2], label: 'ضيق' },
                      { pct: row.goodPct, color: theme.series[3], label: 'جيد' },
                      {
                        pct: row.excellentPct,
                        color: theme.series[0],
                        label: 'ممتاز',
                      },
                    ].map(
                      (seg) =>
                        seg.pct > 0 && (
                          <div
                            key={seg.label}
                            className="h-full flex items-center justify-center text-[10px] font-mono tabular-nums font-bold text-white"
                            style={{
                              width: `${seg.pct}%`,
                              backgroundColor: seg.color,
                            }}
                            title={`${row.category} · ${seg.label}: ${seg.pct}%`}
                          >
                            {seg.pct >= 12 ? `${Math.round(seg.pct)}%` : ''}
                          </div>
                        ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FolioSectionShell>

      {/* =====================================================================
          SECTION 09 · SCATTER PLOT + OLS REGRESSION TREND LINE
          ===================================================================== */}
      <FolioSectionShell
        id="folio-sec-09"
        indexNumber="09"
        kicker="العلاقة والارتباط"
        title="مخطط التشتت: علاقة الدوران أو الكمية بهامش الربح وخط الاتجاه"
        leadLeft="يرسم هذا المخطط موقع كل صنف بين محورين حاسمين: حجم الحركة أو الرصيد (أفقياً) وهامش الربح المئوي (عمودياً)، مع أشكال هندسية مميزة لأهم الفئات."
        leadRight="يحسب النظام تلقائياً معادلة خط الانحدار الخطي (OLS) ومعامل الارتباط R² لاكتشاف ما إذا كانت السلع الأكثر حركة تحقق هوامش أعلى أم تضطر لخفض هامشها."
        figureCaption={`توزع ${visibleScatterPoints.length} منتجاً (${data.scatterAxisLabels.x} مقابل ${data.scatterAxisLabels.y}).`}
        theme={theme}
      >
        <div
          className="border p-4 sm:p-6 space-y-5"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          {/* Slope & R2 KPI Header + Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-baseline gap-6">
              <div>
                <div
                  className="text-2xl sm:text-3xl font-black font-mono tabular-nums"
                  style={{ color: theme.text }}
                  dir="ltr"
                >
                  {scatterGeometry.slope >= 0 ? '+' : ''}
                  {scatterGeometry.slope.toFixed(2)} pts
                </div>
                <div className="text-[11px]" style={{ color: theme.textMuted }}>
                  ميل خط الاتجاه العام
                </div>
              </div>

              <div>
                <div
                  className="text-2xl sm:text-3xl font-black font-mono tabular-nums"
                  style={{ color: theme.accent }}
                  dir="ltr"
                >
                  R² {scatterGeometry.r2.toFixed(2)}
                </div>
                <div className="text-[11px]" style={{ color: theme.textMuted }}>
                  معامل التفسير الإحصائي
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {scatterCategories.map((cat, idx) => {
                const isHidden = hiddenScatterCats.has(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleScatterCat(cat)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                      opacity: isHidden ? 0.4 : 1,
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 inline-block"
                      style={{
                        backgroundColor:
                          theme.series[idx % theme.series.length],
                      }}
                    />
                    <span>{cat}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setShowTrendLine((v) => !v)}
                className="px-3 py-1 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  backgroundColor: showTrendLine
                    ? theme.text
                    : theme.surfaceMuted,
                  color: showTrendLine ? theme.surface : theme.text,
                  borderColor: theme.border,
                }}
              >
                {showTrendLine ? 'إخفاء خط الاتجاه' : 'إظهار خط الاتجاه'}
              </button>
            </div>
          </div>

          {/* SVG Scatter Plot */}
          {visibleScatterPoints.length === 0 ? (
            <div
              className="py-12 text-center text-xs font-bold"
              style={{ color: theme.textMuted }}
            >
              لا توجد منتجات مسعرة في الفئات المختارة لعرض مخطط التشتت.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${scatterGeometry.w} ${scatterGeometry.h}`}
                className="w-full h-64 sm:h-72 select-none"
              >
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                  const yVal =
                    scatterGeometry.minY +
                    t * (scatterGeometry.maxY - scatterGeometry.minY);
                  const py = scatterGeometry.scaleY(yVal);
                  return (
                    <g key={t}>
                      <line
                        x1={scatterGeometry.padL}
                        y1={py}
                        x2={scatterGeometry.w - scatterGeometry.padR}
                        y2={py}
                        stroke={theme.border}
                        strokeDasharray="3 3"
                      />
                      <text
                        x={scatterGeometry.padL - 8}
                        y={py + 3}
                        textAnchor="end"
                        fontSize={10}
                        fill={theme.textMuted}
                      >
                        {Math.round(yVal)}%
                      </text>
                    </g>
                  );
                })}

                {/* OLS Regression Line */}
                {showTrendLine && visibleScatterPoints.length >= 2 && (
                  <line
                    x1={scatterGeometry.trendCoords.x1}
                    y1={scatterGeometry.trendCoords.y1}
                    x2={scatterGeometry.trendCoords.x2}
                    y2={scatterGeometry.trendCoords.y2}
                    stroke={theme.text}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                )}

                {/* Scatter Shapes */}
                {visibleScatterPoints.map((pt) => {
                  const cx = scatterGeometry.scaleX(pt.x);
                  const cy = scatterGeometry.scaleY(pt.y);
                  const catIdx = Math.max(
                    0,
                    scatterCategories.indexOf(pt.category),
                  );
                  const col = theme.series[catIdx % theme.series.length];
                  const isHovered = hoveredPoint?.id === pt.id;
                  const r = isHovered ? 7 : 5;

                  return (
                    <g
                      key={pt.id}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(pt)}
                      onMouseLeave={() => setHoveredPoint(null)}
                      onClick={() => setHoveredPoint(pt)}
                    >
                      {catIdx % 4 === 0 && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={col}
                          fillOpacity={0.85}
                          stroke={theme.surface}
                          strokeWidth={1.5}
                        />
                      )}
                      {catIdx % 4 === 1 && (
                        <rect
                          x={cx - r}
                          y={cy - r}
                          width={r * 2}
                          height={r * 2}
                          fill={col}
                          fillOpacity={0.85}
                          stroke={theme.surface}
                          strokeWidth={1.5}
                        />
                      )}
                      {catIdx % 4 === 2 && (
                        <polygon
                          points={`${cx},${cy - r - 1} ${cx + r + 1},${cy + r} ${cx - r - 1},${cy + r}`}
                          fill={col}
                          fillOpacity={0.85}
                          stroke={theme.surface}
                          strokeWidth={1.5}
                        />
                      )}
                      {catIdx % 4 === 3 && (
                        <polygon
                          points={`${cx},${cy - r - 1} ${cx + r + 1},${cy} ${cx},${cy + r + 1} ${cx - r - 1},${cy}`}
                          fill={col}
                          fillOpacity={0.85}
                          stroke={theme.surface}
                          strokeWidth={1.5}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Axis labels */}
                <text
                  x={scatterGeometry.w / 2}
                  y={scatterGeometry.h - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={theme.textMuted}
                  fontWeight={600}
                >
                  {data.scatterAxisLabels.x}
                </text>
              </svg>
            </div>
          )}

          {/* Hovered Point Readout */}
          {hoveredPoint && (
            <div
              className="px-3.5 py-2 border text-xs flex flex-wrap items-center gap-3"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <span className="font-black">{hoveredPoint.name}</span>
              <span aria-hidden="true">·</span>
              <span style={{ color: theme.textMuted }}>
                {hoveredPoint.category}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {data.scatterAxisLabels.x}: {hoveredPoint.x}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className="font-mono tabular-nums font-bold"
                style={{ color: theme.accent }}
              >
                الهامش: {hoveredPoint.y}%
              </span>
            </div>
          )}
        </div>
      </FolioSectionShell>

      {/* =====================================================================
          SECTION 10 · SEARCHABLE, SORTABLE DATA INDEX + SPARKLINES + CSV EXPORT
          ===================================================================== */}
      <FolioSectionShell
        id="folio-sec-10"
        indexNumber="10"
        kicker="فهرس البيانات وتصدير CSV"
        title={`فهرس البيانات التفاعلي: استكشاف ${data.totalProducts} صنف`}
        leadLeft="جدول ختامي يجمع كل أصنافك في مكان واحد مع بحث فوري، تصفية حسب الفئة، فرز تصاعدي أو تنازلي لأي عمود، وخط مسار مصغر (Sparkline) لتطور التكلفة."
        leadRight="اضغط على زر «تصدير CSV» في أي وقت لتنزيل النسخة المفلترة الحالية كملف جداول متوافق مع اللغة العربية وبرنامج Excel."
        figureCaption={`عرض ${Math.min(50, filteredIndexRows.length)} من أصل ${filteredIndexRows.length} نتيجة مطابقة.`}
        theme={theme}
      >
        <div
          className="border p-4 sm:p-6 space-y-5"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          {/* Search + Category Pills + Export CSV Button */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
              <div
                className="flex items-center gap-2 px-3 py-2 border flex-1 max-w-sm"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                }}
              >
                <Search size={14} style={{ color: theme.textMuted }} />
                <input
                  type="text"
                  value={indexSearch}
                  onChange={(e) => setIndexSearch(e.target.value)}
                  placeholder="ابحث بالاسم، الباركود، أو المورد..."
                  className="bg-transparent text-xs w-full focus:outline-none"
                  style={{ color: theme.text }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIndexCategory('all')}
                  className="px-2.5 py-1.5 text-xs font-bold border whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    backgroundColor:
                      indexCategory === 'all' ? theme.text : theme.surfaceMuted,
                    color:
                      indexCategory === 'all' ? theme.surface : theme.text,
                    borderColor: theme.border,
                  }}
                >
                  الكل
                </button>
                {data.topCategoriesList.slice(0, 4).map((cat) => {
                  const active = indexCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setIndexCategory(cat)}
                      className="px-2.5 py-1.5 text-xs font-bold border whitespace-nowrap shrink-0 cursor-pointer"
                      style={{
                        backgroundColor: active
                          ? theme.text
                          : theme.surfaceMuted,
                        color: active ? theme.surface : theme.text,
                        borderColor: theme.border,
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: theme.accent,
                color: theme.accentText,
                borderColor: theme.accent,
              }}
            >
              <Download size={14} />
              <span>تصدير CSV</span>
            </button>
          </div>

          {/* Interactive Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr
                  className="border-b font-bold"
                  style={{ borderColor: theme.border, color: theme.textMuted }}
                >
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => handleSortIndex('name')}
                      className="inline-flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <span>المنتج</span>
                      {indexSortCol === 'name' &&
                        (indexSortAsc ? (
                          <ArrowUp size={11} />
                        ) : (
                          <ArrowDown size={11} />
                        ))}
                    </button>
                  </th>
                  <th className="py-3 px-3">الفئة</th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => handleSortIndex('stockQty')}
                      className="inline-flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <span>الكمية</span>
                      {indexSortCol === 'stockQty' &&
                        (indexSortAsc ? (
                          <ArrowUp size={11} />
                        ) : (
                          <ArrowDown size={11} />
                        ))}
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => handleSortIndex('costPrice')}
                      className="inline-flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <span>التكلفة</span>
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => handleSortIndex('sellPrice')}
                      className="inline-flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <span>البيع</span>
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => handleSortIndex('marginPct')}
                      className="inline-flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <span>الهامش %</span>
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => handleSortIndex('stockValue')}
                      className="inline-flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <span>القيمة</span>
                    </button>
                  </th>
                  <th className="py-3 px-3 text-center">المسار</th>
                </tr>
              </thead>
              <tbody>
                {filteredIndexRows.slice(0, 50).map((row) => {
                  const pts = row.sparkline;
                  const minS = Math.min(...pts);
                  const maxS = Math.max(...pts);
                  const spanS = Math.max(0.01, maxS - minS);
                  const sparkCoords =
                    pts.length > 1
                      ? pts
                          .map((v, i) => {
                            const sx = (i / (pts.length - 1)) * 56 + 2;
                            const sy = 18 - ((v - minS) / spanS) * 14 - 2;
                            return `${sx},${sy}`;
                          })
                          .join(' ')
                      : '2,10 58,10';

                  return (
                    <tr
                      key={row.id}
                      className="border-b last:border-b-0 transition-colors hover:opacity-90"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <td className="py-2.5 px-3 font-bold max-w-[180px] truncate">
                        {row.name}
                      </td>
                      <td
                        className="py-2.5 px-3 whitespace-nowrap"
                        style={{ color: theme.textMuted }}
                      >
                        {row.category}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {row.stockQty}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {fmtVal(row.costPrice, settings, showFinancials)}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {fmtVal(row.sellPrice, settings, showFinancials)}
                      </td>
                      <td
                        className="py-2.5 px-3 font-mono tabular-nums font-bold"
                        style={{
                          color:
                            row.marginPct >= 20
                              ? theme.positive
                              : row.marginPct <= 5
                                ? theme.negative
                                : theme.text,
                        }}
                      >
                        {row.marginPct}%
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-bold">
                        {fmtVal(row.stockValue, settings, showFinancials)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex justify-center">
                          <svg width="60" height="20" className="overflow-visible">
                            <polyline
                              fill="none"
                              stroke={theme.accent}
                              strokeWidth={1.75}
                              points={sparkCoords}
                            />
                          </svg>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </FolioSectionShell>
    </>
  );
};

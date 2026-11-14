import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import { formatCurrency } from '../../../../lib/utils';
import { UserSettings } from '../../../../types';
import { FolioSectionShell } from './FolioPrimitives';
import { FolioDataset, FolioProductRecord, FolioTheme } from './folioTypes';

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

const normalizeArabicText = (text: string) =>
  String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[يى]/g, 'ي')
    .replace(/ة/g, 'ه');

export const FolioChartsPart1: React.FC<FolioChartsProps> = ({
  data,
  theme,
  settings,
}) => {
  const showFinancials = settings.showFinancials ?? true;

  // ---------------------------------------------------------------------------
  // 01 · Unit Waffle / Matrix Chart State
  // ---------------------------------------------------------------------------
  const [unitGroupMode, setUnitGroupMode] = useState<
    'all' | 'status' | 'category' | 'margin'
  >('all');
  const [unitSearch, setUnitSearch] = useState<string>('');
  const [hoveredUnit, setHoveredUnit] = useState<FolioProductRecord | null>(
    null,
  );

  const unitColors = useMemo(() => {
    const statusMap: Record<FolioProductRecord['status'], string> = {
      healthy: theme.series[0],
      low: theme.series[1],
      stagnant: theme.series[2],
      depleted: theme.series[4],
    };
    return statusMap;
  }, [theme]);

  const unitLegend = useMemo(() => {
    if (unitGroupMode === 'all') {
      return [
        { label: 'صنف متوفر بالمخزن', color: theme.text, bordered: false },
        {
          label: 'صنف نافد (الكمية 0)',
          color: theme.surfaceMuted,
          bordered: true,
        },
      ];
    }
    if (unitGroupMode === 'category') {
      return data.topCategoriesList.map((c, idx) => ({
        label: c,
        color: theme.series[idx % theme.series.length],
        bordered: false,
      }));
    }
    if (unitGroupMode === 'margin') {
      return [
        { label: 'هامش ممتاز (25%+)', color: theme.series[3], bordered: false },
        {
          label: 'هامش جيد (12–24%)',
          color: theme.series[0],
          bordered: false,
        },
        {
          label: 'هامش ضيق (<12%)',
          color: theme.series[1],
          bordered: false,
        },
        {
          label: 'سلبي / بدون هامش',
          color: theme.series[2],
          bordered: false,
        },
      ];
    }
    return [
      { label: 'متوفر وصحي', color: unitColors.healthy, bordered: false },
      { label: 'أوشك على النفاد', color: unitColors.low, bordered: false },
      { label: 'راكد / فائض', color: unitColors.stagnant, bordered: false },
      { label: 'نافد', color: unitColors.depleted, bordered: false },
    ];
  }, [unitGroupMode, data.topCategoriesList, theme, unitColors]);

  const sortedUnits = useMemo(() => {
    const q = normalizeArabicText(unitSearch);
    const list = q
      ? data.products.filter(
          (p) =>
            normalizeArabicText(p.name).includes(q) ||
            normalizeArabicText(p.category).includes(q) ||
            normalizeArabicText(p.barcode).includes(q),
        )
      : [...data.products];
    if (unitGroupMode === 'status') {
      const order = { healthy: 0, low: 1, stagnant: 2, depleted: 3 };
      list.sort((a, b) => order[a.status] - order[b.status]);
    } else if (unitGroupMode === 'category') {
      list.sort((a, b) => a.category.localeCompare(b.category, 'ar'));
    } else if (unitGroupMode === 'margin') {
      list.sort((a, b) => b.marginPct - a.marginPct);
    }
    return list.slice(0, 240);
  }, [data.products, unitGroupMode, unitSearch]);

  const getUnitColor = (p: FolioProductRecord) => {
    if (unitGroupMode === 'category') {
      const idx = data.topCategoriesList.indexOf(p.category);
      return idx >= 0
        ? theme.series[idx % theme.series.length]
        : theme.textMuted;
    }
    if (unitGroupMode === 'margin') {
      if (p.marginPct >= 25) return theme.series[3];
      if (p.marginPct >= 12) return theme.series[0];
      if (p.marginPct > 0) return theme.series[1];
      return theme.series[2];
    }
    if (unitGroupMode === 'all') {
      return p.status === 'depleted' ? theme.surfaceMuted : theme.text;
    }
    return unitColors[p.status];
  };

  // ---------------------------------------------------------------------------
  // 02 · 100% Stacked Composition & Sortable Breakdown Table State
  // ---------------------------------------------------------------------------
  const [catSortBy, setCatSortBy] = useState<'totalValue' | 'count' | 'avgMarginPct'>(
    'totalValue',
  );
  const [catSortAsc, setCatSortAsc] = useState(false);
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);

  const compositionSegments = useMemo(() => {
    const top = data.categories.slice(0, 4);
    const rest = data.categories.slice(4);
    const restShare = Number(
      rest.reduce((s, r) => s + r.sharePct, 0).toFixed(1),
    );
    const restCount = rest.reduce((s, r) => s + r.count, 0);
    const restVal = rest.reduce((s, r) => s + r.totalValue, 0);
    const segments = top.map((c, idx) => ({
      category: c.category,
      sharePct: c.sharePct,
      count: c.count,
      totalValue: c.totalValue,
      color: theme.series[idx % theme.series.length],
    }));
    if (rest.length > 0 && restShare > 0) {
      segments.push({
        category: 'أخرى',
        sharePct: restShare,
        count: restCount,
        totalValue: restVal,
        color: theme.series[4],
      });
    }
    return segments;
  }, [data.categories, theme]);

  const sortedCategoriesTable = useMemo(() => {
    return [...data.categories].sort((a, b) => {
      const diff = a[catSortBy] - b[catSortBy];
      return catSortAsc ? diff : -diff;
    });
  }, [data.categories, catSortBy, catSortAsc]);

  // ---------------------------------------------------------------------------
  // 03 · Dumbbell Comparison Chart State
  // ---------------------------------------------------------------------------
  const [dumbbellSort, setDumbbellSort] = useState<
    'current' | 'change' | 'baseline'
  >('change');
  const [dumbbellSearch, setDumbbellSearch] = useState<string>('');
  const [hoveredDumbbellId, setHoveredDumbbellId] = useState<string | null>(
    null,
  );

  const sortedDumbbell = useMemo(() => {
    const q = normalizeArabicText(dumbbellSearch);
    const list = q
      ? data.dumbbellItems.filter(
          (d) =>
            normalizeArabicText(d.label).includes(q) ||
            normalizeArabicText(d.category).includes(q),
        )
      : [...data.dumbbellItems];
    if (dumbbellSort === 'current') {
      list.sort((a, b) => b.currentVal - a.currentVal);
    } else if (dumbbellSort === 'baseline') {
      list.sort((a, b) => b.baselineVal - a.baselineVal);
    } else {
      list.sort((a, b) => Math.abs(b.deltaVal) - Math.abs(a.deltaVal));
    }
    return list.slice(0, q ? 20 : 8);
  }, [data.dumbbellItems, dumbbellSort, dumbbellSearch]);

  const dumbbellMax = useMemo(() => {
    const vals = sortedDumbbell.flatMap((d) => [d.baselineVal, d.currentVal]);
    return Math.max(1, ...vals) * 1.12;
  }, [sortedDumbbell]);

  // ---------------------------------------------------------------------------
  // 04 · Animated Live KPI Bars State
  // ---------------------------------------------------------------------------
  const [kpiCategoryFilter, setKpiCategoryFilter] = useState<string>('all');
  const [activeBarIndex, setActiveBarIndex] = useState<number>(0);

  const kpiBarsData = useMemo(() => {
    const filtered =
      kpiCategoryFilter === 'all'
        ? data.products
        : data.products.filter((p) => p.category === kpiCategoryFilter);
    const total = Math.max(1, filtered.length);
    const inc = filtered.filter((p) => p.trendDirection === 'increasing').length;
    const unch = filtered.filter((p) => p.trendDirection === 'unchanged').length;
    const dec = filtered.filter((p) => p.trendDirection === 'decreasing').length;

    return {
      total: filtered.length,
      bars: [
        {
          id: 'increasing',
          label: 'مسار صاعد / مرتفع',
          count: inc,
          pct: Math.round((inc / total) * 100),
          color: theme.series[0],
        },
        {
          id: 'unchanged',
          label: 'مستقر / متوازن',
          count: unch,
          pct: Math.round((unch / total) * 100),
          color: theme.series[1],
        },
        {
          id: 'decreasing',
          label: 'متراجع / يحتاج انتباه',
          count: dec,
          pct: Math.max(
            0,
            100 - Math.round((inc / total) * 100) - Math.round((unch / total) * 100),
          ),
          color: theme.series[2],
        },
      ],
    };
  }, [data.products, kpiCategoryFilter, theme]);

  // ---------------------------------------------------------------------------
  // 05 · Trend Line + Interactive Milestone Timeline State
  // ---------------------------------------------------------------------------
  const [selectedMilestoneIdx, setSelectedMilestoneIdx] = useState<number>(
    Math.max(0, data.timelineEvents.length - 1),
  );

  const safeMilestoneIdx = Math.min(
    selectedMilestoneIdx,
    Math.max(0, data.timelineEvents.length - 1),
  );
  const activeMilestone = data.timelineEvents[safeMilestoneIdx] || null;

  const timelineGeometry = useMemo(() => {
    const evs = data.timelineEvents;
    if (evs.length === 0) return null;
    const w = 720;
    const h = 210;
    const padX = 36;
    const padY = 26;
    const maxV = Math.max(1, ...evs.map((e) => e.value)) * 1.15;
    const minV = 0;

    const pts = evs.map((e, i) => {
      const x =
        evs.length === 1
          ? w / 2
          : padX + (i / (evs.length - 1)) * (w - padX * 2);
      const y =
        h - padY - ((e.value - minV) / Math.max(1, maxV - minV)) * (h - padY * 2);
      return { x, y, event: e, index: i };
    });

    const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const areaPath =
      pts.length > 0
        ? `M ${pts[0].x},${h - padY} L ${pts
            .map((p) => `${p.x},${p.y}`)
            .join(' L ')} L ${pts[pts.length - 1].x},${h - padY} Z`
        : '';

    return { w, h, padX, padY, maxV, pts, polyline, areaPath };
  }, [data.timelineEvents]);

  return (
    <>
      {/* =====================================================================
          SECTION 01 · UNIT MATRIX / WAFFLE & 4 HERO KPIs
          ===================================================================== */}
      <FolioSectionShell
        id="folio-sec-01"
        indexNumber="01"
        kicker="نظرة عامة تفاعلية"
        title="خريطة المخزون الوحدوية: كل مربع يمثل صنفاً حقيقياً في متجرك"
        leadLeft="تمنحك مصفوفة الوحدات قراءة فورية لبنية الأصناف في متجرك؛ حيث يظهر كل منتج كوحدة مستقلة يمكنك تلوينها وفرزها حسب حالة المخزون، الفئة، أو شريحة هامش الربح."
        leadRight="مرّر المؤشر أو اضغط على أي مربع لاستعراض تفاصيل الصنف الدقيقة، واستخدم أزرار التجميع في الأعلى لاكتشاف تركز النواقص أو الأصناف عالية الربحية."
        figureCaption={`مصفوفة توزع ${sortedUnits.length} من أصل ${data.totalProducts} صنف مسجل (${data.modeLabel}).`}
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
                <th className="py-2.5 px-4">المنتج</th>
                <th className="py-2.5 px-4">الفئة</th>
                <th className="py-2.5 px-4">الكمية</th>
                <th className="py-2.5 px-4">القيمة</th>
                <th className="py-2.5 px-4">الهامش %</th>
              </tr>
            </thead>
            <tbody>
              {sortedUnits.slice(0, 15).map((u) => (
                <tr
                  key={u.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: theme.border, color: theme.text }}
                >
                  <td className="py-2 px-4 font-bold">{u.name}</td>
                  <td className="py-2 px-4" style={{ color: theme.textMuted }}>
                    {u.category}
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {u.stockQty}
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {fmtVal(u.stockValue, settings, showFinancials)}
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {u.marginPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        {/* Top Controls + Search + Legend */}
        <div
          className="border p-4 sm:p-6 space-y-5"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
              <div
                className="flex items-center gap-2 px-3 py-1.5 border flex-1 max-w-xs"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                }}
              >
                <Search size={13} style={{ color: theme.textMuted }} />
                <input
                  type="text"
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  placeholder="ابحث بالصنف، الفئة، أو الباركود..."
                  className="bg-transparent text-xs w-full focus:outline-none"
                  style={{ color: theme.text }}
                />
                {unitSearch && (
                  <button
                    type="button"
                    onClick={() => setUnitSearch('')}
                    aria-label="مسح البحث"
                    className="cursor-pointer"
                    style={{ color: theme.textMuted }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <div
                className="text-xs font-bold shrink-0"
                style={{ color: theme.textMuted }}
              >
                {sortedUnits.length} وحدة معروضة
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'status', label: 'الحالة' },
                { id: 'category', label: 'الفئة' },
                { id: 'margin', label: 'الهامش' },
              ].map((opt) => {
                const active = unitGroupMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setUnitGroupMode(opt.id as any)}
                    className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: active ? theme.text : theme.surfaceMuted,
                      color: active ? theme.surface : theme.text,
                      borderColor: active ? theme.text : theme.border,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unit Matrix Squares */}
          {sortedUnits.length === 0 ? (
            <div
              className="py-10 text-center text-xs font-bold"
              style={{ color: theme.textMuted }}
            >
              {unitSearch
                ? 'لا توجد أصناف مطابقة لبحثك في المصفوفة.'
                : 'لا توجد منتجات مسجلة لعرضها في المصفوفة بعد.'}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5" dir="rtl">
              {sortedUnits.map((unit) => {
                const isHovered = hoveredUnit?.id === unit.id;
                return (
                  <button
                    key={unit.id}
                    type="button"
                    onMouseEnter={() => setHoveredUnit(unit)}
                    onFocus={() => setHoveredUnit(unit)}
                    onClick={() => setHoveredUnit(unit)}
                    aria-label={`${unit.name} - ${unit.category}`}
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-150 cursor-pointer focus:outline-none"
                    style={{
                      backgroundColor: getUnitColor(unit),
                      transform: isHovered ? 'scale(1.35)' : 'scale(1)',
                      outline: isHovered ? `2px solid ${theme.accent}` : 'none',
                      outlineOffset: '1px',
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Legend & Selected Unit Live Readout */}
          <div
            className="pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            style={{ borderColor: theme.border }}
          >
            <div className="flex flex-wrap items-center gap-4">
              {unitLegend.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 inline-block shrink-0"
                    style={{
                      backgroundColor: item.color,
                      border: item.bordered
                        ? `1px solid ${theme.border}`
                        : undefined,
                    }}
                  />
                  <span style={{ color: theme.textMuted }}>{item.label}</span>
                </div>
              ))}
            </div>

            {hoveredUnit ? (
              <div
                className="px-3 py-1.5 border font-mono text-[11px] flex flex-wrap items-center gap-2"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text,
                }}
              >
                <span className="font-bold font-sans">{hoveredUnit.name}</span>
                <span aria-hidden="true">·</span>
                <span>{hoveredUnit.category}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  الكمية: {hoveredUnit.stockQty}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  القيمة: {fmtVal(hoveredUnit.stockValue, settings, showFinancials)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  الهامش: {hoveredUnit.marginPct}%
                </span>
              </div>
            ) : (
              <span className="text-[11px]" style={{ color: theme.textMuted }}>
                مرّر أو اضغط على أي مربع لعرض تفاصيل الصنف
              </span>
            )}
          </div>
        </div>

        {/* 4 Hero Oversized KPI Readouts */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 border divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
          }}
        >
          {[
            {
              value: data.totalProducts.toLocaleString('en-US'),
              label: 'إجمالي الأصناف المحللة',
              sub: 'أصناف نشطة في سجل المتجر',
            },
            {
              value: data.totalCategories.toLocaleString('en-US'),
              label: 'الأقسام والفئات المصنفة',
              sub: 'مجموعات بضائع مترابطة',
            },
            {
              value: fmtVal(data.totalValue, settings, showFinancials),
              label: 'إجمالي قيمة المخزون الحالي',
              sub: 'تقييم بسعر التكلفة',
            },
            {
              value: `${data.avgMarginPct}%`,
              label: 'متوسط هامش الربح',
              sub: 'عبر كافة المنتجات المسعّرة',
            },
          ].map((kpi, idx) => (
            <div
              key={idx}
              className="p-5 sm:p-6 space-y-1.5"
              style={{ borderColor: theme.border }}
            >
              <div
                className="text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-tight"
                style={{ color: theme.text }}
              >
                {kpi.value}
              </div>
              <div
                className="text-xs font-bold"
                style={{ color: theme.text }}
              >
                {kpi.label}
              </div>
              <div className="text-[11px]" style={{ color: theme.textMuted }}>
                {kpi.sub}
              </div>
            </div>
          ))}
        </div>
      </FolioSectionShell>

      {/* =====================================================================
          SECTION 02 · 100% STACKED COMPOSITION BAR + SORTABLE TABLE
          ===================================================================== */}
      <FolioSectionShell
        id="folio-sec-02"
        indexNumber="02"
        kicker="مكونات رأس المال"
        title="توزيع المحفظة حسب الفئات: حصة كل قسم من إجمالي المخزون"
        leadLeft="يوضح الشريط المئوي المتكامل الوزن الحقيقي لكل قسم داخل رأس مال متجرك، مما يكشف ما إذا كانت السيولة مركزة في فئة واحدة أو موزعة بتوازن."
        leadRight="عند تمرير المؤشر فوق أي شريحة في الشريط أو أي صف في الجدول أسفله، يتم تظليل القسم المقابل تلقائياً لتسهيل المقارنة."
        figureCaption="توزيع النسبة المئوية 100% لرأس المال المستثمر حسب الفئة مع جدول تفصيلي قابل للفرز."
        theme={theme}
      >
        <div
          className="border p-4 sm:p-6 space-y-6"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {compositionSegments.map((seg) => (
              <button
                key={seg.category}
                type="button"
                onMouseEnter={() => setHoveredCat(seg.category)}
                onMouseLeave={() => setHoveredCat(null)}
                className="flex items-center gap-2 cursor-pointer transition-opacity"
                style={{
                  opacity:
                    hoveredCat && hoveredCat !== seg.category ? 0.45 : 1,
                }}
              >
                <span
                  className="w-2.5 h-2.5 inline-block"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="font-bold" style={{ color: theme.text }}>
                  {seg.category}
                </span>
                <span
                  className="font-mono tabular-nums"
                  style={{ color: theme.textMuted }}
                >
                  {seg.sharePct}%
                </span>
              </button>
            ))}
          </div>

          {/* 100% Stacked Horizontal Bar */}
          <div
            className="w-full h-14 sm:h-16 flex overflow-hidden border"
            style={{ borderColor: theme.border }}
          >
            {compositionSegments.map((seg) => {
              const isDimmed = hoveredCat && hoveredCat !== seg.category;
              return (
                <div
                  key={seg.category}
                  onMouseEnter={() => setHoveredCat(seg.category)}
                  onMouseLeave={() => setHoveredCat(null)}
                  className="h-full flex items-center justify-center px-1.5 transition-all duration-150 cursor-pointer overflow-hidden"
                  style={{
                    width: `${Math.max(seg.sharePct, 2)}%`,
                    backgroundColor: seg.color,
                    opacity: isDimmed ? 0.35 : 1,
                  }}
                  title={`${seg.category}: ${seg.sharePct}%`}
                >
                  {seg.sharePct >= 9 && (
                    <span className="text-xs font-black font-mono tabular-nums text-white drop-shadow-xs">
                      {seg.sharePct}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sortable Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead>
                <tr
                  className="border-b text-xs font-bold"
                  style={{ borderColor: theme.border, color: theme.textMuted }}
                >
                  <th className="py-3 px-3">الفئة</th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (catSortBy === 'count') setCatSortAsc(!catSortAsc);
                        else {
                          setCatSortBy('count');
                          setCatSortAsc(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <span>الأصناف</span>
                      {catSortBy === 'count' &&
                        (catSortAsc ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        ))}
                    </button>
                  </th>
                  <th className="py-3 px-3">الحصة %</th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (catSortBy === 'totalValue')
                          setCatSortAsc(!catSortAsc);
                        else {
                          setCatSortBy('totalValue');
                          setCatSortAsc(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <span>قيمة المخزون</span>
                      {catSortBy === 'totalValue' &&
                        (catSortAsc ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        ))}
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (catSortBy === 'avgMarginPct')
                          setCatSortAsc(!catSortAsc);
                        else {
                          setCatSortBy('avgMarginPct');
                          setCatSortAsc(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <span>متوسط الهامش</span>
                      {catSortBy === 'avgMarginPct' &&
                        (catSortAsc ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        ))}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCategoriesTable.slice(0, 8).map((row) => {
                  const highlighted = hoveredCat === row.category;
                  return (
                    <tr
                      key={row.category}
                      onMouseEnter={() => setHoveredCat(row.category)}
                      onMouseLeave={() => setHoveredCat(null)}
                      className="border-b last:border-b-0 transition-colors"
                      style={{
                        borderColor: theme.border,
                        backgroundColor: highlighted
                          ? theme.surfaceMuted
                          : 'transparent',
                        color: theme.text,
                      }}
                    >
                      <td className="py-2.5 px-3 font-bold">{row.category}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {row.count}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-16 h-1.5 overflow-hidden hidden sm:block"
                            style={{ backgroundColor: theme.surfaceMuted }}
                          >
                            <div
                              className="h-full"
                              style={{
                                width: `${Math.min(100, row.sharePct)}%`,
                                backgroundColor: theme.accent,
                              }}
                            />
                          </div>
                          <span className="font-mono tabular-nums text-xs">
                            {row.sharePct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-bold">
                        {fmtVal(row.totalValue, settings, showFinancials)}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {row.avgMarginPct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </FolioSectionShell>

      {/* =====================================================================
          SECTION 03 · ANIMATED DUMBBELL COMPARISON CHART
          ===================================================================== */}
      <FolioSectionShell
        id="folio-sec-03"
        indexNumber="03"
        kicker="مقارنة التحولات السعرية"
        title={`مقارنة الفجوة السعرية: ${data.dumbbellLabels.baseline} مقابل ${data.dumbbellLabels.current}`}
        leadLeft="يعرض هذا المخطط (مخطط الدمبل) نقطتين على خط واحد لكل بند: الدائرة المفرغة تمثل نقطة البداية، والدائرة الملونة تمثل السعر الحالي، والخط الواصل يوضح اتساع الفارق بينهما."
        leadRight="كلما ابتعدت الدائرة الملونة يميناً كان السعر الحالي أعلى، ومع كل صف تظهر القيمتين بالضبط ونسبة الفارق. مرّر أو اضغط على أي صف لقراءة التفصيل الكامل."
        figureCaption={`مقارنة (${data.dumbbellLabels.baseline}) مقابل (${data.dumbbellLabels.current}).`}
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
                <th className="py-2.5 px-4">البند</th>
                <th className="py-2.5 px-4">{data.dumbbellLabels.baseline}</th>
                <th className="py-2.5 px-4">{data.dumbbellLabels.current}</th>
                <th className="py-2.5 px-4">الفارق</th>
                <th className="py-2.5 px-4">التغير %</th>
              </tr>
            </thead>
            <tbody>
              {sortedDumbbell.map((d) => (
                <tr
                  key={d.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: theme.border, color: theme.text }}
                >
                  <td className="py-2 px-4 font-bold">{d.label}</td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {fmtVal(d.baselineVal, settings, showFinancials)}
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {fmtVal(d.currentVal, settings, showFinancials)}
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {d.deltaVal >= 0 ? '+' : ''}
                    {fmtVal(d.deltaVal, settings, showFinancials)}
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {d.deltaPct >= 0 ? '+' : ''}
                    {d.deltaPct}%
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
          {/* Search + Sort Controls & Legend */}
          <div className="space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div
                className="flex items-center gap-2 px-3 py-1.5 border flex-1 max-w-xs"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                }}
              >
                <Search size={13} style={{ color: theme.textMuted }} />
                <input
                  type="text"
                  value={dumbbellSearch}
                  onChange={(e) => setDumbbellSearch(e.target.value)}
                  placeholder="ابحث عن صنف أو فئة في المقارنة..."
                  className="bg-transparent text-xs w-full focus:outline-none"
                  style={{ color: theme.text }}
                />
                {dumbbellSearch && (
                  <button
                    type="button"
                    onClick={() => setDumbbellSearch('')}
                    aria-label="مسح البحث"
                    className="cursor-pointer"
                    style={{ color: theme.textMuted }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'current', label: 'حسب الحالي' },
                  { id: 'change', label: 'حسب التغيير' },
                  { id: 'baseline', label: 'حسب الأساس' },
                ].map((s) => {
                  const active = dumbbellSort === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDumbbellSort(s.id as any)}
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

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full border-2 inline-block"
                  style={{
                    borderColor: theme.textMuted,
                    backgroundColor: theme.surface,
                  }}
                />
                <span style={{ color: theme.textMuted }}>
                  {data.dumbbellLabels.baseline} (نقطة البداية)
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: theme.positive }}
                />
                <span className="font-bold" style={{ color: theme.text }}>
                  {data.dumbbellLabels.current} (القيمة الحالية)
                </span>
              </span>
            </div>
          </div>

          {sortedDumbbell.length === 0 ? (
            <div
              className="py-10 text-center text-xs font-bold"
              style={{ color: theme.textMuted }}
            >
              {dumbbellSearch
                ? 'لا توجد نتائج مطابقة لبحثك في مقارنة الأسعار.'
                : 'تتوفر بيانات المقارنة بمجرد وجود أسعار شراء وبيع أو فواتير متعددة للمنتجات.'}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2.5" dir="ltr">
                {sortedDumbbell.map((item) => {
                  const leftPct = Math.min(
                    96,
                    Math.max(2, (item.baselineVal / dumbbellMax) * 100),
                  );
                  const rightPct = Math.min(
                    96,
                    Math.max(2, (item.currentVal / dumbbellMax) * 100),
                  );
                  const minP = Math.min(leftPct, rightPct);
                  const spanP = Math.max(1, Math.abs(rightPct - leftPct));
                  const isUp = item.deltaVal >= 0;
                  const dotColor = isUp ? theme.positive : theme.negative;
                  const isHovered = hoveredDumbbellId === item.id;

                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoveredDumbbellId(item.id)}
                      onClick={() => setHoveredDumbbellId(item.id)}
                      className="flex flex-col gap-1.5 sm:grid sm:grid-cols-12 sm:items-center sm:gap-3 py-2.5 px-2.5 transition-colors cursor-pointer"
                      style={{
                        backgroundColor: isHovered
                          ? theme.surfaceMuted
                          : 'transparent',
                      }}
                    >
                      <div
                        className="sm:col-span-3 text-right text-xs font-bold truncate"
                        dir="rtl"
                        style={{ color: theme.text }}
                        title={item.label}
                      >
                        {item.label}
                      </div>

                      <div className="sm:col-span-6 relative h-6 sm:h-7 flex items-center">
                        {/* Horizontal baseline guide */}
                        <div
                          className="absolute inset-x-0 h-px"
                          style={{ backgroundColor: theme.border }}
                        />
                        {/* Connecting bar */}
                        <div
                          className="absolute h-[2.5px] transition-all duration-200"
                          style={{
                            left: `${minP}%`,
                            width: `${spanP}%`,
                            backgroundColor: dotColor,
                          }}
                        />
                        {/* Hollow Baseline Circle */}
                        <div
                          className="absolute w-3 h-3 rounded-full border-2 -translate-x-1/2"
                          style={{
                            left: `${leftPct}%`,
                            borderColor: theme.textMuted,
                            backgroundColor: theme.surface,
                          }}
                        />
                        {/* Solid Current Circle */}
                        <div
                          className="absolute w-3.5 h-3.5 rounded-full -translate-x-1/2 transition-transform"
                          style={{
                            left: `${rightPct}%`,
                            backgroundColor: dotColor,
                            transform: `translateX(-50%) scale(${isHovered ? 1.25 : 1})`,
                          }}
                        />
                      </div>

                      <div
                        className="sm:col-span-3 flex items-center justify-between sm:block sm:text-left font-mono tabular-nums"
                        dir="rtl"
                      >
                        <div
                          className="text-xs font-black"
                          style={{ color: dotColor }}
                        >
                          {isUp ? '+' : ''}
                          {item.deltaPct}%
                        </div>
                        <div
                          className="text-[10px]"
                          style={{ color: theme.textMuted }}
                        >
                          {fmtVal(item.baselineVal, settings, showFinancials)} ←{' '}
                          {fmtVal(item.currentVal, settings, showFinancials)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Row Readout */}
              {(() => {
                const activeItem =
                  sortedDumbbell.find((d) => d.id === hoveredDumbbellId) ||
                  sortedDumbbell[0];
                if (!activeItem) return null;
                return (
                  <div
                    className="pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs"
                    style={{ borderColor: theme.border }}
                  >
                    <div className="font-bold" style={{ color: theme.text }}>
                      {activeItem.label}
                    </div>
                    <div
                      className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px]"
                      style={{ color: theme.textMuted }}
                    >
                      <span>
                        {data.dumbbellLabels.baseline}:{' '}
                        <strong style={{ color: theme.text }}>
                          {fmtVal(
                            activeItem.baselineVal,
                            settings,
                            showFinancials,
                          )}
                        </strong>
                      </span>
                      <span>
                        {data.dumbbellLabels.current}:{' '}
                        <strong style={{ color: theme.text }}>
                          {fmtVal(
                            activeItem.currentVal,
                            settings,
                            showFinancials,
                          )}
                        </strong>
                      </span>
                      <span>
                        الفارق:{' '}
                        <strong
                          style={{
                            color:
                              activeItem.deltaVal >= 0
                                ? theme.positive
                                : theme.negative,
                          }}
                        >
                          {activeItem.deltaVal >= 0 ? '+' : ''}
                          {fmtVal(
                            activeItem.deltaVal,
                            settings,
                            showFinancials,
                          )}{' '}
                          ({activeItem.deltaPct >= 0 ? '+' : ''}
                          {activeItem.deltaPct}%)
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </FolioSectionShell>

      {/* =====================================================================
          SECTION 04 · ANIMATED LIVE KPI BARS
          ===================================================================== */}
      <FolioSectionShell
        id="folio-sec-04"
        indexNumber="04"
        kicker="مؤشرات الأداء الحية"
        title="تصفية سريعة لحالة الأصناف بأعمدة النسب المتحركة"
        leadLeft="تقسم هذه الأعمدة الكبيرة أصناف متجرك إلى ثلاث شرائح واضحة: أصناف في مسار صاعد وصحي، أصناف مستقرة، وأصناف متراجعة أو تحتاج مراجعة تسعير ومخزون."
        leadRight="بدّل الفلتر بين الفئات في الأعلى لملاحظة تغيّر النسب والعنوان التحليلي تلقائياً في لحظتها."
        figureCaption={`توزيع النسب المئوية عبر ${kpiBarsData.total} صنف في الفلتر المحدد.`}
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
                <th className="py-2.5 px-4">الشريحة</th>
                <th className="py-2.5 px-4">عدد الأصناف</th>
                <th className="py-2.5 px-4">النسبة المئوية</th>
              </tr>
            </thead>
            <tbody>
              {kpiBarsData.bars.map((b) => (
                <tr
                  key={b.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: theme.border, color: theme.text }}
                >
                  <td className="py-2.5 px-4 font-bold">{b.label}</td>
                  <td className="py-2.5 px-4 font-mono tabular-nums">
                    {b.count}
                  </td>
                  <td className="py-2.5 px-4 font-mono tabular-nums">
                    {b.pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div
          className="border p-4 sm:p-6 space-y-6"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setKpiCategoryFilter('all')}
              className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor:
                  kpiCategoryFilter === 'all' ? theme.text : theme.surfaceMuted,
                color:
                  kpiCategoryFilter === 'all' ? theme.surface : theme.text,
                borderColor:
                  kpiCategoryFilter === 'all' ? theme.text : theme.border,
              }}
            >
              جميع الأقسام
            </button>
            {data.topCategoriesList.map((cat) => {
              const active = kpiCategoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setKpiCategoryFilter(cat)}
                  className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: active ? theme.text : theme.surfaceMuted,
                    color: active ? theme.surface : theme.text,
                    borderColor: active ? theme.text : theme.border,
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* 3 Tall Proportional KPI Bars */}
          <div
            className="grid grid-cols-3 gap-3 sm:gap-5 items-end h-64 sm:h-72 pt-6 border-b pb-4"
            style={{ borderColor: theme.border }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft')
                setActiveBarIndex((i) => (i + 1) % 3);
              if (e.key === 'ArrowRight')
                setActiveBarIndex((i) => (i + 2) % 3);
            }}
          >
            {kpiBarsData.bars.map((bar, idx) => {
              const barH = Math.max(18, Math.min(100, bar.pct));
              const isFocused = activeBarIndex === idx;
              return (
                <button
                  key={bar.id}
                  type="button"
                  onClick={() => setActiveBarIndex(idx)}
                  onMouseEnter={() => setActiveBarIndex(idx)}
                  className="h-full flex flex-col justify-end text-right group cursor-pointer focus:outline-none"
                >
                  <div
                    className="w-full relative flex items-end p-3 sm:p-4 transition-all duration-200"
                    style={{
                      height: `${barH}%`,
                      backgroundColor: bar.color,
                      outline: isFocused ? `2px solid ${theme.text}` : 'none',
                      outlineOffset: '2px',
                    }}
                  >
                    <span
                      className="text-2xl sm:text-4xl md:text-5xl font-black font-mono tabular-nums tracking-tight text-white"
                      style={{
                        writingMode: 'horizontal-tb',
                      }}
                    >
                      {bar.pct}%
                    </span>
                  </div>
                  <div className="pt-2.5 space-y-0.5">
                    <div
                      className="text-xs sm:text-sm font-bold truncate"
                      style={{ color: theme.text }}
                    >
                      {bar.label}
                    </div>
                    <div
                      className="text-[11px] font-mono tabular-nums"
                      style={{ color: theme.textMuted }}
                    >
                      {bar.count} صنف
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Synchronized Live Headline */}
          <div className="pt-1 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <div
                className="text-3xl sm:text-4xl font-black font-mono tabular-nums"
                style={{ color: theme.text }}
              >
                {kpiBarsData.bars[activeBarIndex]?.pct ?? 0}%
              </div>
              <p
                className="text-xs sm:text-sm mt-1"
                style={{ color: theme.textMuted }}
              >
                من أصناف{' '}
                <strong style={{ color: theme.text }}>
                  {kpiCategoryFilter === 'all'
                    ? 'المتجر بالكامل'
                    : kpiCategoryFilter}
                </strong>{' '}
                تقع حالياً ضمن شريحة «
                {kpiBarsData.bars[activeBarIndex]?.label}» بواقع{' '}
                <strong
                  className="font-mono tabular-nums"
                  style={{ color: theme.text }}
                >
                  {kpiBarsData.bars[activeBarIndex]?.count}
                </strong>{' '}
                صنف.
              </p>
            </div>
          </div>
        </div>
      </FolioSectionShell>

      {/* =====================================================================
          SECTION 05 · TREND LINE + INTERACTIVE MILESTONE TIMELINE
          ===================================================================== */}
      <FolioSectionShell
        id="folio-sec-05"
        indexNumber="05"
        kicker="المسار الزمني والمحطات"
        title="ربط خط الاتجاه المالي بمحطات الجرد والتوريد الزمنية"
        leadLeft="يتتبع هذا الرسم المسار الزمني المتواصل لقيمة المبيعات أو المشتريات عبر الدورات المتعاقبة، مع إظهار نقطة الذروة والنقطة الحالية بوضوح."
        leadRight="انقر على أي محطة في الخط الزمني أسفل الرسم (أو استخدم أسهم لوحة المفاتيح) لاستعراض ملخص تلك الفترة وتفاصيلها."
        figureCaption={`${data.timelineUnitLabel} عبر ${data.timelineEvents.length} محطة زمنية مسجلة.`}
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
                <th className="py-2.5 px-4">التاريخ</th>
                <th className="py-2.5 px-4">المحطة</th>
                <th className="py-2.5 px-4">{data.timelineUnitLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.timelineEvents.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: theme.border, color: theme.text }}
                >
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {ev.dateLabel}
                  </td>
                  <td className="py-2 px-4 font-bold">{ev.title}</td>
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {fmtVal(ev.value, settings, showFinancials)}
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
          {!timelineGeometry || data.timelineEvents.length === 0 ? (
            <div
              className="py-10 text-center text-xs font-bold"
              style={{ color: theme.textMuted }}
            >
              لا توجد محطات زمنية مسجلة بعد لعرض مسار الاتجاه.
            </div>
          ) : (
            <>
              {/* SVG Trend Line */}
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${timelineGeometry.w} ${timelineGeometry.h}`}
                  className="w-full h-48 sm:h-56 select-none"
                >
                  {/* Grid Lines */}
                  {[0.25, 0.5, 0.75].map((ratio) => {
                    const gy =
                      timelineGeometry.h -
                      timelineGeometry.padY -
                      ratio *
                        (timelineGeometry.h - timelineGeometry.padY * 2);
                    return (
                      <line
                        key={ratio}
                        x1={timelineGeometry.padX}
                        y1={gy}
                        x2={timelineGeometry.w - timelineGeometry.padX}
                        y2={gy}
                        stroke={theme.border}
                        strokeDasharray="3 3"
                      />
                    );
                  })}

                  {/* Soft Area Fill */}
                  <path
                    d={timelineGeometry.areaPath}
                    fill={theme.accent}
                    fillOpacity={0.09}
                  />

                  {/* Main Trend Line */}
                  {timelineGeometry.pts.length > 1 && (
                    <polyline
                      fill="none"
                      stroke={theme.accent}
                      strokeWidth={3}
                      points={timelineGeometry.polyline}
                    />
                  )}

                  {/* Interactive Points */}
                  {timelineGeometry.pts.map((pt) => {
                    const isSelected = pt.index === safeMilestoneIdx;
                    return (
                      <g
                        key={pt.event.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedMilestoneIdx(pt.index)}
                      >
                        {isSelected && (
                          <line
                            x1={pt.x}
                            y1={timelineGeometry.padY}
                            x2={pt.x}
                            y2={timelineGeometry.h - timelineGeometry.padY}
                            stroke={theme.accent}
                            strokeOpacity={0.35}
                            strokeWidth={1.5}
                          />
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 6.5 : 4}
                          fill={isSelected ? theme.accent : theme.surface}
                          stroke={theme.accent}
                          strokeWidth={2.5}
                        />
                        <text
                          x={pt.x}
                          y={timelineGeometry.h - 6}
                          textAnchor="middle"
                          fontSize={10}
                          fill={isSelected ? theme.text : theme.textMuted}
                          fontWeight={isSelected ? 700 : 500}
                        >
                          {pt.event.shortLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Milestone Rail & Detail Card */}
              <div
                className="pt-4 border-t space-y-4"
                style={{ borderColor: theme.border }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {data.timelineEvents.map((ev, idx) => {
                      const active = idx === safeMilestoneIdx;
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => setSelectedMilestoneIdx(idx)}
                          className="px-2.5 py-1 text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          style={{
                            backgroundColor: active
                              ? theme.accent
                              : theme.surfaceMuted,
                            color: active ? theme.accentText : theme.textMuted,
                            borderColor: active ? theme.accent : theme.border,
                          }}
                        >
                          {ev.shortLabel}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMilestoneIdx((i) => Math.max(0, i - 1))
                      }
                      disabled={safeMilestoneIdx <= 0}
                      aria-label="المحطة السابقة"
                      className="p-1.5 border disabled:opacity-35 cursor-pointer"
                      style={{
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMilestoneIdx((i) =>
                          Math.min(data.timelineEvents.length - 1, i + 1),
                        )
                      }
                      disabled={
                        safeMilestoneIdx >= data.timelineEvents.length - 1
                      }
                      aria-label="المحطة التالية"
                      className="p-1.5 border disabled:opacity-35 cursor-pointer"
                      style={{
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                  </div>
                </div>

                {activeMilestone && (
                  <div
                    className="p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                    }}
                  >
                    <div className="space-y-1">
                      <div
                        className="text-[11px] font-mono"
                        style={{ color: theme.accent }}
                      >
                        {activeMilestone.dateLabel}
                      </div>
                      <h4
                        className="text-sm font-black"
                        style={{ color: theme.text }}
                      >
                        {activeMilestone.title}
                      </h4>
                      <p
                        className="text-xs"
                        style={{ color: theme.textMuted }}
                      >
                        {activeMilestone.description}
                      </p>
                    </div>
                    <div
                      className="text-xl sm:text-2xl font-black font-mono tabular-nums shrink-0"
                      style={{ color: theme.text }}
                    >
                      {fmtVal(activeMilestone.value, settings, showFinancials)}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </FolioSectionShell>
    </>
  );
};

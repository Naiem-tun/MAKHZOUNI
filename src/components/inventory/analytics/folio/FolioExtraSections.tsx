import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  HelpCircle,
  Search,
} from 'lucide-react';
import {
  formatCurrency,
  formatQuantityWithGrouping,
} from '../../../../lib/utils';
import { UserSettings } from '../../../../types';
import { FolioSectionShell } from './FolioPrimitives';
import { FolioTheme } from './folioTypes';
import {
  AnalyzedItem,
  CycleHighlights,
  DayPurchasesGroup,
  MacroStrategicDiagnostic,
  MarginSqueezeAnalysis,
  MarketDebtsStats,
  ParetoAnalysis,
  StoreHealthDiagnostic,
  SummaryMetrics,
  SupplierPerformanceData,
  TimeHorizon,
} from '../types';

const fmtVal = (
  val: number,
  settings: UserSettings,
  showFinancials: boolean,
) => {
  if (!showFinancials) return '••••••';
  return formatCurrency(val, settings.currency, settings.language || 'ar');
};

/* ============================================================================
   1. DIAGNOSTIC, PARETO 80/20, MARGIN SQUEEZE & MARKET DEBTS (FOLIO STYLE)
   ============================================================================ */
interface FolioDiagnosticViewProps {
  theme: FolioTheme;
  settings: UserSettings;
  timeHorizon: TimeHorizon;
  storeHealthDiagnostic: StoreHealthDiagnostic | null;
  macroStrategicDiagnostic: MacroStrategicDiagnostic | null;
  cycleHighlights: CycleHighlights | null;
  marketDebtsStats: MarketDebtsStats;
  paretoProfitAnalysis: ParetoAnalysis;
  marginSqueezeAnalysis: MarginSqueezeAnalysis;
  onOpenParetoModal: () => void;
  onOpenMarginModal: () => void;
  onOpenCycleExplainer: () => void;
}

export const FolioDiagnosticView: React.FC<FolioDiagnosticViewProps> = ({
  theme,
  settings,
  timeHorizon,
  storeHealthDiagnostic,
  macroStrategicDiagnostic,
  cycleHighlights,
  marketDebtsStats,
  paretoProfitAnalysis,
  marginSqueezeAnalysis,
  onOpenParetoModal,
  onOpenMarginModal,
  onOpenCycleExplainer,
}) => {
  const showFinancials = settings.showFinancials ?? true;
  const isMacro = timeHorizon !== 'cycle' && !!macroStrategicDiagnostic;

  const scoreValue = isMacro
    ? macroStrategicDiagnostic!.macroScore
    : storeHealthDiagnostic?.score ?? null;
  const scoreTitle = isMacro
    ? macroStrategicDiagnostic!.macroTitle
    : storeHealthDiagnostic?.scoreTitle ?? 'تشخيص صحة المتجر';
  const scoreStory = isMacro
    ? macroStrategicDiagnostic!.story
    : storeHealthDiagnostic?.story ?? '';
  const indicators = isMacro
    ? macroStrategicDiagnostic!.indicators
    : storeHealthDiagnostic?.indicators ?? [];

  return (
    <div>
      {/* Section A: Health Score & Vital Indicators */}
      <FolioSectionShell
        id="folio-diag-health"
        indexNumber="01"
        kicker="التشخيص الاستراتيجي"
        title={scoreTitle}
        leadLeft={
          scoreStory ||
          'يعرض هذا القسم مؤشر صحة المتجر الإجمالي المحسوب من تطور المبيعات، صافي الأرباح، ضبط المصاريف التشغيلية، وانضباط المخزون.'
        }
        leadRight="كل مؤشر أدناه يقيس جانباً حيوياً من أداء النشاط التجاري مع توصية عملية واضحة قابلة للتنفيذ فوراً."
        figureCaption={
          isMacro
            ? `تقييم تراكمي عبر ${macroStrategicDiagnostic!.count} دورات جرد (${macroStrategicDiagnostic!.periodName}).`
            : 'تقييم تشغيلي لدورة الجرد المحددة.'
        }
        theme={theme}
      >
        {scoreValue === null ? (
          <div
            className="border p-8 text-center text-sm font-bold"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.textMuted,
            }}
          >
            أكمل جرداً واحداً على الأقل في قسم الجرد لتفعيل حساب مؤشر صحة المتجر والمقارنات الدورية.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Hero Score Strip */}
            <div
              className="border p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
              }}
            >
              <div className="md:col-span-4 space-y-2">
                <div
                  className="text-xs font-mono uppercase tracking-wider"
                  style={{ color: theme.textMuted }}
                >
                  درجة كفاءة المتجر
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-5xl sm:text-6xl font-black font-mono tabular-nums"
                    style={{ color: theme.accent }}
                  >
                    {scoreValue}
                  </span>
                  <span
                    className="text-lg font-mono"
                    style={{ color: theme.textMuted }}
                  >
                    / 100
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenCycleExplainer}
                  className="inline-flex items-center gap-1.5 text-xs font-bold underline cursor-pointer pt-1"
                  style={{ color: theme.textMuted }}
                >
                  <HelpCircle size={13} />
                  <span>كيف تُحسب المؤشرات؟</span>
                </button>
              </div>

              <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t md:border-t-0 md:border-r pt-4 md:pt-0 md:pr-6" style={{ borderColor: theme.border }}>
                {isMacro ? (
                  <>
                    <div>
                      <div className="text-[11px]" style={{ color: theme.textMuted }}>المبيعات التراكمية</div>
                      <div className="text-lg font-black font-mono tabular-nums mt-1" style={{ color: theme.text }}>
                        {fmtVal(macroStrategicDiagnostic!.totalRevenue, settings, showFinancials)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px]" style={{ color: theme.textMuted }}>صافي الأرباح</div>
                      <div className="text-lg font-black font-mono tabular-nums mt-1" style={{ color: theme.positive }}>
                        {fmtVal(macroStrategicDiagnostic!.totalNetProfit, settings, showFinancials)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px]" style={{ color: theme.textMuted }}>نمو المبيعات</div>
                      <div className="text-lg font-black font-mono tabular-nums mt-1" style={{ color: theme.text }}>
                        {macroStrategicDiagnostic!.revGrowthPct !== null
                          ? `${macroStrategicDiagnostic!.revGrowthPct >= 0 ? '+' : ''}${macroStrategicDiagnostic!.revGrowthPct.toFixed(1)}%`
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px]" style={{ color: theme.textMuted }}>متوسط الفاصل</div>
                      <div className="text-lg font-black font-mono tabular-nums mt-1" style={{ color: theme.text }}>
                        {macroStrategicDiagnostic!.avgDaysBetweenAudits} يوم
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-[11px]" style={{ color: theme.textMuted }}>مبيعات الدورة</div>
                      <div className="text-lg font-black font-mono tabular-nums mt-1" style={{ color: theme.text }}>
                        {fmtVal(storeHealthDiagnostic!.curRev, settings, showFinancials)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px]" style={{ color: theme.textMuted }}>صافي الربح</div>
                      <div className="text-lg font-black font-mono tabular-nums mt-1" style={{ color: theme.positive }}>
                        {fmtVal(storeHealthDiagnostic!.curNet, settings, showFinancials)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px]" style={{ color: theme.textMuted }}>المصاريف</div>
                      <div className="text-lg font-black font-mono tabular-nums mt-1" style={{ color: theme.text }}>
                        {fmtVal(storeHealthDiagnostic!.curExpenses, settings, showFinancials)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px]" style={{ color: theme.textMuted }}>رأس مال الرفوف</div>
                      <div className="text-lg font-black font-mono tabular-nums mt-1" style={{ color: theme.text }}>
                        {fmtVal(storeHealthDiagnostic!.curStock, settings, showFinancials)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 5 Diagnostic Indicators */}
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-px border"
              style={{
                backgroundColor: theme.border,
                borderColor: theme.border,
              }}
            >
              {indicators.map((ind) => (
                <div
                  key={ind.id}
                  className="p-5 space-y-2"
                  style={{ backgroundColor: theme.surface }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <h4
                        className="text-sm font-black"
                        style={{ color: theme.text }}
                      >
                        {ind.title}
                      </h4>
                      <div
                        className="text-[11px] font-bold"
                        style={{
                          color:
                            ind.status === 'bad'
                              ? theme.negative
                              : ind.status === 'excellent' || ind.status === 'good'
                                ? theme.positive
                                : theme.textMuted,
                        }}
                      >
                        {ind.statusLabel}
                      </div>
                    </div>
                    <div
                      className="text-base font-black font-mono tabular-nums shrink-0"
                      style={{ color: theme.text }}
                    >
                      {ind.value}
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
                    {ind.details}
                  </p>
                  <div
                    className="pt-2 border-t text-xs font-medium"
                    style={{ borderColor: theme.border, color: theme.text }}
                  >
                    التوصية: {ind.advice}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </FolioSectionShell>

      {/* Section B: Pareto 80/20 + Margin Squeeze Radar */}
      <FolioSectionShell
        id="folio-diag-pareto"
        indexNumber="02"
        kicker="الربحية وحماية الهوامش"
        title="قاعدة 80/20 للأرباح الذهبية ورادار تآكل الأسعار"
        leadLeft="تحدد قاعدة 80/20 النخبة الصغيرة من الأصناف التي تصنع السواد الأعظم من أرباحك، حتى تضمن عدم نفادها أبداً من الرفوف."
        leadRight="بالتوازي، يراقب رادار تآكل الهوامش أي زيادة في أسعار الموردين لم تنعكس بعد على سعر البيع لتجنب البيع بهامش متآكل."
        figureCaption="تحليل تركّز الأرباح ومخاطر تآكل الهامش في الدورة الحالية."
        theme={theme}
        tableContent={
          paretoProfitAnalysis.topItems.length > 0 ? (
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
                  <th className="py-2.5 px-4">الصنف الذهبي</th>
                  <th className="py-2.5 px-4">الفئة</th>
                  <th className="py-2.5 px-4">الكمية المباعة</th>
                  <th className="py-2.5 px-4">الربح المحقق</th>
                </tr>
              </thead>
              <tbody>
                {paretoProfitAnalysis.topItems.map((it, idx) => (
                  <tr
                    key={idx}
                    className="border-b last:border-b-0"
                    style={{ borderColor: theme.border, color: theme.text }}
                  >
                    <td className="py-2 px-4 font-bold">{it.name}</td>
                    <td className="py-2 px-4" style={{ color: theme.textMuted }}>
                      {it.category}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums">
                      {it.soldQty}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums font-bold">
                      {fmtVal(it.profit, settings, showFinancials)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pareto 80/20 Card */}
          <div
            className="border p-6 space-y-4 flex flex-col justify-between"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-mono font-bold"
                  style={{ color: theme.accent }}
                >
                  PARETO 80/20
                </span>
                <Crown size={18} style={{ color: theme.accent }} />
              </div>
              <div
                className="text-4xl font-black font-mono tabular-nums"
                style={{ color: theme.text }}
              >
                {paretoProfitAnalysis.profitSharePct}%
              </div>
              <p className="text-sm font-bold" style={{ color: theme.text }}>
                {paretoProfitAnalysis.topItemsCount > 0
                  ? `${paretoProfitAnalysis.topItemsCount} أصناف فقط تصنع ${paretoProfitAnalysis.profitSharePct}% من أرباح المتجر`
                  : 'لا توجد أرباح دورة مسجلة لحساب باريتو بعد'}
              </p>
              <p className="text-xs" style={{ color: theme.textMuted }}>
                أرباح هذه المجموعة:{' '}
                <strong className="font-mono tabular-nums" style={{ color: theme.text }}>
                  {fmtVal(paretoProfitAnalysis.topItemsProfit, settings, showFinancials)}
                </strong>{' '}
                (تمثل {paretoProfitAnalysis.itemsSharePct}% من إجمالي الأصناف).
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenParetoModal}
              className="self-start px-4 py-2 text-xs font-bold border transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.text,
                color: theme.surface,
                borderColor: theme.text,
              }}
            >
              استعراض قائمة النخبة الكاملة
            </button>
          </div>

          {/* Margin Squeeze Radar Card */}
          <div
            className="border p-6 space-y-4 flex flex-col justify-between"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-mono font-bold"
                  style={{
                    color:
                      marginSqueezeAnalysis.count > 0
                        ? theme.negative
                        : theme.positive,
                  }}
                >
                  MARGIN RADAR
                </span>
                {marginSqueezeAnalysis.count > 0 ? (
                  <AlertTriangle size={18} style={{ color: theme.negative }} />
                ) : (
                  <CheckCircle2 size={18} style={{ color: theme.positive }} />
                )}
              </div>
              <div
                className="text-4xl font-black font-mono tabular-nums"
                style={{ color: theme.text }}
              >
                {marginSqueezeAnalysis.count}
              </div>
              <p className="text-sm font-bold" style={{ color: theme.text }}>
                {marginSqueezeAnalysis.count > 0
                  ? `رصد ${marginSqueezeAnalysis.count} سلع تآكلت أرباحها وتحتاج تعديل السعر`
                  : 'كافة أسعار البيع متناسقة ومحمية بهامش ربح صحي'}
              </p>
              <p className="text-xs" style={{ color: theme.textMuted }}>
                {marginSqueezeAnalysis.count > 0
                  ? `فارق أرباح مهددة: ${fmtVal(marginSqueezeAnalysis.totalEstimatedLoss, settings, showFinancials)}`
                  : 'جميع زيادات الموردين تم استيعابها بنجاح.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenMarginModal}
              className="self-start px-4 py-2 text-xs font-bold border transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surfaceMuted,
                color: theme.text,
                borderColor: theme.border,
              }}
            >
              {marginSqueezeAnalysis.count > 0
                ? 'فحص وتعديل الأسعار المقترحة'
                : 'عرض تفاصيل فحص الهوامش'}
            </button>
          </div>
        </div>
      </FolioSectionShell>

      {/* Section C: Cycle Highlights & Market Debts */}
      <FolioSectionShell
        id="folio-diag-debts"
        indexNumber="03"
        kicker="الديون وأبرز النجوم"
        title="موقف الديون في السوق وأبرز الأصناف المؤثرة"
        leadLeft="مقارنة سريعة بين السيولة المستحقة لك عند الزبائن والالتزامات المستحقة للموردين، لتقييم صافي الموقف المالي الخارجي."
        leadRight="كما يستعرض القسم أبرز نجم ربحي ونجم مبيعات وأثقل صنف راكد في الدورة المختارة."
        figureCaption="ملخص الديون النشطة ونقاط الارتكاز."
        theme={theme}
      >
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
          }}
        >
          <div className="p-5 space-y-1" style={{ borderColor: theme.border }}>
            <div className="text-xs font-bold" style={{ color: theme.textMuted }}>
              ديون الحرفاء لك
            </div>
            <div
              className="text-2xl font-black font-mono tabular-nums"
              style={{ color: theme.positive }}
            >
              {fmtVal(marketDebtsStats.unpaidCustomerDebts, settings, showFinancials)}
            </div>
            <div className="text-[11px]" style={{ color: theme.textMuted }}>
              {marketDebtsStats.customerDebtCount} عميل نشط
            </div>
          </div>

          <div className="p-5 space-y-1" style={{ borderColor: theme.border }}>
            <div className="text-xs font-bold" style={{ color: theme.textMuted }}>
              ديون الموردين عليك
            </div>
            <div
              className="text-2xl font-black font-mono tabular-nums"
              style={{ color: theme.negative }}
            >
              {fmtVal(marketDebtsStats.unpaidSupplierDebts, settings, showFinancials)}
            </div>
            <div className="text-[11px]" style={{ color: theme.textMuted }}>
              {marketDebtsStats.supplierDebtCount} سجل مستحق
            </div>
          </div>

          <div className="p-5 space-y-1" style={{ borderColor: theme.border }}>
            <div className="text-xs font-bold" style={{ color: theme.textMuted }}>
              نجم الأرباح
            </div>
            <div
              className="text-sm font-black truncate"
              style={{ color: theme.text }}
            >
              {cycleHighlights?.starProfitItem?.name || 'غير متوفر بعد'}
            </div>
            <div className="text-xs font-mono tabular-nums" style={{ color: theme.accent }}>
              {cycleHighlights?.starProfitItem
                ? fmtVal(cycleHighlights.starProfitItem.profit, settings, showFinancials)
                : '—'}
            </div>
          </div>

          <div className="p-5 space-y-1" style={{ borderColor: theme.border }}>
            <div className="text-xs font-bold" style={{ color: theme.textMuted }}>
              أثقل صنف راكد
            </div>
            <div
              className="text-sm font-black truncate"
              style={{ color: theme.text }}
            >
              {cycleHighlights?.heaviestDeadStock?.name || 'لا يوجد ركود'}
            </div>
            <div className="text-xs font-mono tabular-nums" style={{ color: theme.negative }}>
              {cycleHighlights?.heaviestDeadStock
                ? fmtVal(cycleHighlights.heaviestDeadStock.deadCapital, settings, showFinancials)
                : '—'}
            </div>
          </div>
        </div>
      </FolioSectionShell>
    </div>
  );
};

/* ============================================================================
   2. VELOCITY, DEAD STOCK & STOCK RUNWAY (FOLIO STYLE)
   ============================================================================ */
interface FolioVelocityViewProps {
  theme: FolioTheme;
  settings: UserSettings;
  topMovingItems: AnalyzedItem[];
  stagnantItems: AnalyzedItem[];
  displayReplenishmentItems: AnalyzedItem[];
  replenishmentSearch: string;
  setReplenishmentSearch: (q: string) => void;
  urgentFilter: 'all' | 'critical' | 'warning';
  setUrgentFilter: (f: 'all' | 'critical' | 'warning') => void;
  products: any[];
}

export const FolioVelocityView: React.FC<FolioVelocityViewProps> = ({
  theme,
  settings,
  topMovingItems,
  stagnantItems,
  displayReplenishmentItems,
  replenishmentSearch,
  setReplenishmentSearch,
  urgentFilter,
  setUrgentFilter,
  products,
}) => {
  const showFinancials = settings.showFinancials ?? true;

  // Live fallback items when no inventory reports exist
  const liveLowStockItems = useMemo(() => {
    if (displayReplenishmentItems.length > 0) return [];
    const q = replenishmentSearch.trim().toLowerCase();
    return (products || [])
      .filter((p) => !p.isDraft)
      .filter((p) => {
        const qty = Number(p.quantity ?? 0);
        const minQ = Number(p.minQuantity ?? 5);
        if (urgentFilter === 'critical') return qty <= Math.max(1, minQ / 2);
        if (urgentFilter === 'warning') return qty <= minQ;
        return true;
      })
      .filter((p) =>
        q
          ? String(p.name || '').toLowerCase().includes(q) ||
            String(p.category || '').toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
      .slice(0, 30);
  }, [displayReplenishmentItems.length, products, replenishmentSearch, urgentFilter]);

  return (
    <div>
      {/* Section 01: Fast Moving vs Stagnant Capital */}
      <FolioSectionShell
        id="folio-vel-leaders"
        indexNumber="01"
        kicker="ديناميكية الرفوف"
        title="الأصناف الأعلى استهلاكاً مقابل رأس المال الراكد"
        leadLeft="يسلط العمود الأول الضوء على قاطرات المبيعات الأسرع خروجاً من المتجر، لتضمن بقاء مخزونها في المنطقة الآمنة دائماً."
        leadRight="بينما يكشف العمود المقابل عن الأصناف التي لم تتحرك خلال الدورة، موضحاً قيمة السيولة المجمدة في كل صنف لاتخاذ قرار تصفية أو عروض."
        figureCaption="مقارنة بين أعلى 10 أصناف حركة والأصناف ذات الاستهلاك الصفري."
        theme={theme}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Moving */}
          <div
            className="border p-5 space-y-4"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: theme.border }}>
              <h4 className="text-sm font-black" style={{ color: theme.text }}>
                الأعلى مبيعاً واستهلاكاً
              </h4>
              <span className="text-xs font-mono" style={{ color: theme.positive }}>
                TOP {topMovingItems.length}
              </span>
            </div>

            {topMovingItems.length === 0 ? (
              <p className="py-8 text-center text-xs" style={{ color: theme.textMuted }}>
                تظهر بيانات سرعة الاستهلاك بعد تسجيل جردين على الأقل.
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: theme.border }}>
                {topMovingItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    style={{ borderColor: theme.border }}
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate" style={{ color: theme.text }}>
                        {idx + 1}. {it.name}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                        {it.dailyVelocity.toFixed(1)} قطعة/يوم · متبقي: {formatQuantityWithGrouping(it.currentStock)}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="font-black font-mono tabular-nums" style={{ color: theme.positive }}>
                        {formatQuantityWithGrouping(it.soldQty)} مباع
                      </div>
                      <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                        {fmtVal(it.profit, settings, showFinancials)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stagnant / Dead Capital */}
          <div
            className="border p-5 space-y-4"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: theme.border }}>
              <h4 className="text-sm font-black" style={{ color: theme.text }}>
                الأصناف الراكدة (سيولة مجمدة)
              </h4>
              <span className="text-xs font-mono" style={{ color: theme.negative }}>
                {stagnantItems.length} صنف
              </span>
            </div>

            {stagnantItems.length === 0 ? (
              <p className="py-8 text-center text-xs" style={{ color: theme.textMuted }}>
                لا توجد أصناف راكدة مسجلة في الدورة الحالية.
              </p>
            ) : (
              <div className="divide-y max-h-[380px] overflow-y-auto" style={{ borderColor: theme.border }}>
                {stagnantItems.slice(0, 20).map((it, idx) => (
                  <div
                    key={idx}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    style={{ borderColor: theme.border }}
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate" style={{ color: theme.text }}>
                        {it.name}
                      </div>
                      <div className="text-[11px]" style={{ color: theme.textMuted }}>
                        {it.category} · الرصيد: {formatQuantityWithGrouping(it.currentStock)}
                      </div>
                    </div>
                    <div className="font-black font-mono tabular-nums shrink-0" style={{ color: theme.negative }}>
                      {fmtVal(it.deadCapital, settings, showFinancials)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </FolioSectionShell>

      {/* Section 02: Stock Runway & Replenishment Table */}
      <FolioSectionShell
        id="folio-vel-runway"
        indexNumber="02"
        kicker="إنذار النفاد المبكر"
        title="جدول أيام التغطية وتنبيهات إعادة التزويد"
        leadLeft="يرتب هذا الجدول الأصناف تصاعدياً من الأقرب للنفاد إلى الأكثر أماناً استناداً إلى معدل السحب اليومي الفعلي (أو مقارنة بالحد الأدنى في الوضع الحي)."
        leadRight="استخدم البحث السريع أو مرشحات الخطورة للوصول فوراً إلى البضائع التي تحتاج طلباً عاجلاً من الموردين."
        figureCaption="تغطية المخزون ومؤشرات الحاجة لإعادة الشراء."
        theme={theme}
      >
        <div
          className="border p-4 sm:p-6 space-y-4"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                value={replenishmentSearch}
                onChange={(e) => setReplenishmentSearch(e.target.value)}
                placeholder="ابحث عن صنف أو فئة..."
                className="bg-transparent text-xs w-full focus:outline-none"
                style={{ color: theme.text }}
              />
            </div>

            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'critical', label: 'حرج (<=5 أيام)' },
                { id: 'warning', label: 'تنبيه (<=15 يوم)' },
              ].map((f) => {
                const active = urgentFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setUrgentFilter(f.id as any)}
                    className="px-3 py-1.5 text-xs font-bold border whitespace-nowrap shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: active ? theme.text : theme.surfaceMuted,
                      color: active ? theme.surface : theme.text,
                      borderColor: theme.border,
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto">
            {displayReplenishmentItems.length > 0 ? (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr
                    className="border-b font-bold"
                    style={{ borderColor: theme.border, color: theme.textMuted }}
                  >
                    <th className="py-2.5 px-3">المنتج</th>
                    <th className="py-2.5 px-3">الفئة</th>
                    <th className="py-2.5 px-3">الرصيد الحالي</th>
                    <th className="py-2.5 px-3">السحب/يوم</th>
                    <th className="py-2.5 px-3">الأيام المتبقية</th>
                  </tr>
                </thead>
                <tbody>
                  {displayReplenishmentItems.map((it, idx) => (
                    <tr
                      key={idx}
                      className="border-b last:border-b-0"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <td className="py-2.5 px-3 font-bold">{it.name}</td>
                      <td className="py-2.5 px-3" style={{ color: theme.textMuted }}>
                        {it.category}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {formatQuantityWithGrouping(it.currentStock)}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {it.dailyVelocity.toFixed(1)}
                      </td>
                      <td
                        className="py-2.5 px-3 font-mono tabular-nums font-black"
                        style={{
                          color:
                            it.daysUntilStockout <= 5 || it.currentStock <= 0
                              ? theme.negative
                              : it.daysUntilStockout <= 15
                                ? theme.neutral
                                : theme.positive,
                        }}
                      >
                        {it.currentStock <= 0
                          ? 'نافد'
                          : it.daysUntilStockout >= 999
                            ? 'مستقر'
                            : `${it.daysUntilStockout} يوم`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr
                    className="border-b font-bold"
                    style={{ borderColor: theme.border, color: theme.textMuted }}
                  >
                    <th className="py-2.5 px-3">المنتج (مخزون حي)</th>
                    <th className="py-2.5 px-3">الفئة</th>
                    <th className="py-2.5 px-3">الرصيد</th>
                    <th className="py-2.5 px-3">الحد الأدنى</th>
                    <th className="py-2.5 px-3">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {liveLowStockItems.map((p: any, idx: number) => {
                    const qty = Number(p.quantity ?? 0);
                    const minQ = Number(p.minQuantity ?? 5);
                    const isOut = qty <= 0;
                    const isLow = qty > 0 && qty <= minQ;
                    return (
                      <tr
                        key={p.id || idx}
                        className="border-b last:border-b-0"
                        style={{ borderColor: theme.border, color: theme.text }}
                      >
                        <td className="py-2.5 px-3 font-bold">{p.name}</td>
                        <td className="py-2.5 px-3" style={{ color: theme.textMuted }}>
                          {p.category || 'عام'}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">{qty}</td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">{minQ}</td>
                        <td
                          className="py-2.5 px-3 font-bold"
                          style={{
                            color: isOut
                              ? theme.negative
                              : isLow
                                ? theme.neutral
                                : theme.positive,
                          }}
                        >
                          {isOut ? 'نافد' : isLow ? 'تحت الحد الأدنى' : 'متوفر'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </FolioSectionShell>
    </div>
  );
};

/* ============================================================================
   3. SUPPLIER PERFORMANCE ANALYSIS (100% FOLIO STYLE WITH FULL DRILL-DOWN)
   ============================================================================ */
interface FolioSuppliersViewProps {
  theme: FolioTheme;
  settings: UserSettings;
  supplierPerformanceData: SupplierPerformanceData;
}

export const FolioSuppliersView: React.FC<FolioSuppliersViewProps> = ({
  theme,
  settings,
  supplierPerformanceData,
}) => {
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  const [supSearch, setSupSearch] = useState('');
  const [supSort, setSupSort] = useState<
    'profit' | 'purchases' | 'stock_qty' | 'margin'
  >('profit');
  const [expandedSupKey, setExpandedSupKey] = useState<string | null>(null);

  const filteredSuppliers = useMemo(() => {
    const q = supSearch.trim().toLowerCase();
    return supplierPerformanceData.suppliers
      .filter((s) => {
        if (!q) return true;
        return (
          s.supplierName.toLowerCase().includes(q) ||
          (s.typeOfGoods || '').toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q))
        );
      })
      .sort((a, b) => {
        if (supSort === 'profit')
          return b.currentStockProfit - a.currentStockProfit;
        if (supSort === 'purchases')
          return b.currentStockCost - a.currentStockCost;
        if (supSort === 'stock_qty')
          return b.currentStockPieces - a.currentStockPieces;
        return b.avgMargin - a.avgMargin;
      });
  }, [supplierPerformanceData.suppliers, supSearch, supSort]);

  const maxSupProfit = Math.max(
    1,
    ...filteredSuppliers.map((s) => Math.max(0, s.currentStockProfit)),
  );

  return (
    <div>
      <FolioSectionShell
        id="folio-sup-perf"
        indexNumber="01"
        kicker="تحليل أداء الموردين"
        title="بضاعة وأرباح الموردين في المخزون الفعلي بالمحل"
        leadLeft="حساب دقيق لصافي الأرباح المتوقعة ورأس المال للسلع الموجودة فعلياً في محلك ومخزنك الآن منسوبة لكل مورد دون تكرار."
        leadRight="رتّب الموردين حسب أعلى ربح متوقع أو أعلى رأس مال أو هامش ربحية، واضغط على أي مورد لاستعراض قائمة أصنافه المتوفرة وتفاصيل تسعيرها."
        figureCaption={`تحليل ${supplierPerformanceData.suppliersWithStockCount} مورداً نشطاً بمتوسط هامش ${supplierPerformanceData.grandCurrentStockMargin}%.`}
        theme={theme}
      >
        <div className="space-y-6">
          {/* 4 Hero KPIs */}
          <div
            className="grid grid-cols-2 lg:grid-cols-4 border divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="p-5 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-xs font-bold" style={{ color: theme.textMuted }}>
                رأس مال البضاعة المتوفرة
              </div>
              <div
                className="text-xl sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.text }}
              >
                {fmtVal(
                  supplierPerformanceData.grandCurrentStockCost,
                  settings,
                  showFinancials,
                )}
              </div>
              <div className="text-[11px]" style={{ color: theme.textMuted }}>
                تكلفة السلع الموجودة بالمحل
              </div>
            </div>

            <div className="p-5 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-xs font-bold" style={{ color: theme.textMuted }}>
                إجمالي الأرباح المتوقعة
              </div>
              <div
                className="text-xl sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.positive }}
              >
                {showFinancials
                  ? `+${formatCurrency(
                      supplierPerformanceData.grandCurrentStockProfit,
                      settings.currency,
                      language,
                    )}`
                  : '••••••'}
              </div>
              <div className="text-[11px]" style={{ color: theme.textMuted }}>
                متوسط الهامش: {supplierPerformanceData.grandCurrentStockMargin}%
              </div>
            </div>

            <div className="p-5 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-xs font-bold" style={{ color: theme.textMuted }}>
                أعلى مورد في الأرباح
              </div>
              <div
                className="text-base sm:text-lg font-black truncate"
                style={{ color: theme.text }}
              >
                {supplierPerformanceData.topProfitSupplier
                  ? supplierPerformanceData.topProfitSupplier.supplierName
                  : 'لا توجد بضاعة'}
              </div>
              <div
                className="text-[11px] font-mono tabular-nums"
                style={{ color: theme.accent }}
              >
                {supplierPerformanceData.topProfitSupplier && showFinancials
                  ? `+${formatCurrency(
                      supplierPerformanceData.topProfitSupplier
                        .currentStockProfit,
                      settings.currency,
                      language,
                    )}`
                  : '—'}
              </div>
            </div>

            <div className="p-5 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-xs font-bold" style={{ color: theme.textMuted }}>
                القطع المتوفرة بالمحل
              </div>
              <div
                className="text-xl sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.text }}
              >
                {formatQuantityWithGrouping(
                  supplierPerformanceData.grandCurrentStockPieces,
                )}
              </div>
              <div className="text-[11px]" style={{ color: theme.textMuted }}>
                عبر {supplierPerformanceData.suppliersWithStockCount} مورد نشط
              </div>
            </div>
          </div>

          {/* Search & 4 Sort Modes */}
          <div
            className="border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2 border flex-1 max-w-md"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
              }}
            >
              <Search size={14} style={{ color: theme.textMuted }} />
              <input
                type="text"
                value={supSearch}
                onChange={(e) => setSupSearch(e.target.value)}
                placeholder="ابحث باسم المورد، الهاتف، أو نوع البضاعة..."
                className="bg-transparent text-xs w-full focus:outline-none"
                style={{ color: theme.text }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="text-[11px] font-bold ml-1"
                style={{ color: theme.textMuted }}
              >
                ترتيب حسب:
              </span>
              {[
                { id: 'profit', label: 'الأعلى ربحاً' },
                { id: 'purchases', label: 'رأس المال' },
                { id: 'stock_qty', label: 'القطع المتوفرة' },
                { id: 'margin', label: 'هامش الربحية %' },
              ].map((opt) => {
                const active = supSort === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSupSort(opt.id as any)}
                    className="px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: active ? theme.accent : theme.surfaceMuted,
                      color: active ? theme.accentText : theme.text,
                      borderColor: active ? theme.accent : theme.border,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Folio Visual Profit Share Bars for Top 6 Suppliers */}
          {filteredSuppliers.length > 0 && (
            <div
              className="border p-4 sm:p-6 space-y-3"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div
                className="text-xs font-bold pb-2 border-b"
                style={{ borderColor: theme.border, color: theme.textMuted }}
              >
                مقارنة الأرباح المتوقعة لأبرز الموردين بالمخزون الحالي
              </div>
              <div className="space-y-2.5">
                {filteredSuppliers.slice(0, 6).map((sup, idx) => {
                  const pct = Math.max(
                    3,
                    Math.round(
                      (Math.max(0, sup.currentStockProfit) / maxSupProfit) * 100,
                    ),
                  );
                  return (
                    <div
                      key={sup.supplierId || sup.supplierName}
                      className="grid grid-cols-12 items-center gap-3 text-xs"
                    >
                      <div
                        className="col-span-4 sm:col-span-3 font-bold truncate"
                        style={{ color: theme.text }}
                      >
                        {sup.supplierName}
                      </div>
                      <div
                        className="col-span-5 sm:col-span-7 h-5 overflow-hidden border"
                        style={{
                          backgroundColor: theme.surfaceMuted,
                          borderColor: theme.border,
                        }}
                      >
                        <div
                          className="h-full transition-all duration-200"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              theme.series[idx % theme.series.length],
                          }}
                        />
                      </div>
                      <div
                        className="col-span-3 sm:col-span-2 text-left font-mono tabular-nums font-bold"
                        style={{ color: theme.positive }}
                      >
                        {fmtVal(
                          sup.currentStockProfit,
                          settings,
                          showFinancials,
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full Supplier Table with Expandable Item Drill-down */}
          <div
            className="border overflow-x-auto"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
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
                  <th className="py-3 px-4">المورد ونوع البضاعة</th>
                  <th className="py-3 px-4">رأس المال</th>
                  <th className="py-3 px-4">القطع</th>
                  <th className="py-3 px-4">الأصناف</th>
                  <th className="py-3 px-4">الهامش %</th>
                  <th className="py-3 px-4">الربح المتوقع</th>
                  <th className="py-3 px-4">آخر توريد</th>
                  <th className="py-3 px-4">التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center font-bold"
                      style={{ color: theme.textMuted }}
                    >
                      لا توجد بضائع متوفرة بالمخزن حالياً مطابقة للبحث.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s, idx) => {
                    const rowKey = s.supplierId || s.supplierName;
                    const isExpanded = expandedSupKey === rowKey;
                    return (
                      <React.Fragment key={rowKey}>
                        <tr
                          onClick={() =>
                            setExpandedSupKey(isExpanded ? null : rowKey)
                          }
                          className="border-b transition-colors cursor-pointer"
                          style={{
                            borderColor: theme.border,
                            backgroundColor: isExpanded
                              ? theme.surfaceMuted
                              : 'transparent',
                            color: theme.text,
                          }}
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-sm">
                              {!s.isUnassigned && (
                                <span
                                  className="font-mono tabular-nums ml-1.5"
                                  style={{ color: theme.accent }}
                                >
                                  {idx + 1}.
                                </span>
                              )}
                              {s.supplierName}
                            </div>
                            <div
                              className="text-[11px]"
                              style={{ color: theme.textMuted }}
                            >
                              {s.isUnassigned
                                ? 'بضائع لم يُحدد لها مورد بعد'
                                : `${s.typeOfGoods || 'مورد عام'}${
                                    s.phone ? ` · ${s.phone}` : ''
                                  }`}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-bold">
                            {fmtVal(
                              s.currentStockCost,
                              settings,
                              showFinancials,
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums">
                            {formatQuantityWithGrouping(s.currentStockPieces)}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums">
                            {s.currentStockItemsCount}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-bold">
                            {s.avgMargin.toFixed(1)}%
                          </td>
                          <td
                            className="py-3 px-4 font-mono tabular-nums font-black"
                            style={{ color: theme.positive }}
                          >
                            {showFinancials
                              ? `+${formatCurrency(
                                  s.currentStockProfit,
                                  settings.currency,
                                  language,
                                )}`
                              : '••••••'}
                          </td>
                          <td
                            className="py-3 px-4 font-mono text-[11px]"
                            style={{ color: theme.textMuted }}
                          >
                            {s.recentTxDate
                              ? s.recentTxDate.toLocaleDateString(
                                  language === 'ar' ? 'ar-TN' : 'en-US',
                                  { day: 'numeric', month: 'short' },
                                )
                              : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold border whitespace-nowrap"
                              style={{
                                backgroundColor: isExpanded
                                  ? theme.text
                                  : theme.surfaceMuted,
                                color: isExpanded ? theme.surface : theme.text,
                                borderColor: theme.border,
                              }}
                            >
                              <span>الأصناف ({s.currentStockItemsCount})</span>
                              {isExpanded ? (
                                <ChevronUp size={12} />
                              ) : (
                                <ChevronDown size={12} />
                              )}
                            </span>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr
                            className="border-b"
                            style={{
                              borderColor: theme.border,
                              backgroundColor: theme.bg,
                            }}
                          >
                            <td colSpan={8} className="p-4">
                              {s.items.length === 0 ? (
                                <div
                                  className="py-4 text-center text-xs"
                                  style={{ color: theme.textMuted }}
                                >
                                  لا توجد كميات حالية متبقية بالمخزن لهذا المورد.
                                </div>
                              ) : (
                                <div
                                  className="border overflow-x-auto max-h-72 overflow-y-auto"
                                  style={{
                                    backgroundColor: theme.surface,
                                    borderColor: theme.border,
                                  }}
                                >
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
                                        <th className="py-2 px-3">اسم الصنف</th>
                                        <th className="py-2 px-3">الكمية</th>
                                        <th className="py-2 px-3">التكلفة</th>
                                        <th className="py-2 px-3">البيع</th>
                                        <th className="py-2 px-3">ربح القطعة</th>
                                        <th className="py-2 px-3">الهامش %</th>
                                        <th className="py-2 px-3">الربح المتوقع</th>
                                        <th className="py-2 px-3">رأس المال</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {s.items.map((item, iIdx) => (
                                        <tr
                                          key={iIdx}
                                          className="border-b last:border-b-0"
                                          style={{
                                            borderColor: theme.border,
                                            color: theme.text,
                                          }}
                                        >
                                          <td className="py-2 px-3 font-bold">
                                            {item.name}
                                          </td>
                                          <td className="py-2 px-3 font-mono tabular-nums">
                                            {formatQuantityWithGrouping(
                                              item.currentStockQty,
                                            )}
                                          </td>
                                          <td className="py-2 px-3 font-mono tabular-nums">
                                            {fmtVal(
                                              item.costPrice,
                                              settings,
                                              showFinancials,
                                            )}
                                          </td>
                                          <td className="py-2 px-3 font-mono tabular-nums">
                                            {fmtVal(
                                              item.sellPrice,
                                              settings,
                                              showFinancials,
                                            )}
                                          </td>
                                          <td
                                            className="py-2 px-3 font-mono tabular-nums font-bold"
                                            style={{ color: theme.positive }}
                                          >
                                            {showFinancials
                                              ? `+${formatCurrency(
                                                  item.unitProfit,
                                                  settings.currency,
                                                  language,
                                                )}`
                                              : '••••••'}
                                          </td>
                                          <td className="py-2 px-3 font-mono tabular-nums">
                                            {item.marginPct.toFixed(1)}%
                                          </td>
                                          <td
                                            className="py-2 px-3 font-mono tabular-nums font-bold"
                                            style={{ color: theme.positive }}
                                          >
                                            {showFinancials
                                              ? `+${formatCurrency(
                                                  item.currentStockProfit,
                                                  settings.currency,
                                                  language,
                                                )}`
                                              : '••••••'}
                                          </td>
                                          <td className="py-2 px-3 font-mono tabular-nums">
                                            {fmtVal(
                                              item.currentStockCost,
                                              settings,
                                              showFinancials,
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </FolioSectionShell>
    </div>
  );
};

/* ============================================================================
   4. DAILY PURCHASES MOVEMENT (FOLIO STYLE)
   ============================================================================ */
interface FolioPurchasesViewProps {
  theme: FolioTheme;
  settings: UserSettings;
  dailyPurchases: DayPurchasesGroup[];
}

export const FolioPurchasesView: React.FC<FolioPurchasesViewProps> = ({
  theme,
  settings,
  dailyPurchases,
}) => {
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);

  const totalPurchasesVal = useMemo(
    () => dailyPurchases.reduce((s, d) => s + d.total, 0),
    [dailyPurchases],
  );

  return (
    <div>
      <FolioSectionShell
        id="folio-pur-daily"
        indexNumber="01"
        kicker="سجل المشتريات اليومية"
        title={`حركة الفواتير والتوريدات اليومية (${fmtVal(
          totalPurchasesVal,
          settings,
          showFinancials,
        )})`}
        leadLeft="تجميع يومي لجميع فواتير المشتريات المسجلة، يوضح حجم التدفق النقدي الخارج نحو البضائع في كل يوم عمل."
        leadRight="انقر على أي يوم لاستعراض الفواتير المسجلة فيه وتوزيع الأصناف والكميات."
        figureCaption={`عرض أحدث ${Math.min(30, dailyPurchases.length)} يوماً من أيام الشراء المسجلة.`}
        theme={theme}
      >
        <div
          className="border divide-y"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          {dailyPurchases.length === 0 ? (
            <div
              className="p-8 text-center text-xs font-bold"
              style={{ color: theme.textMuted }}
            >
              لا توجد فواتير مشتريات مسجلة بعد.
            </div>
          ) : (
            dailyPurchases.slice(0, 30).map((day) => {
              const isOpen = expandedDayKey === day.key;
              return (
                <div key={day.key} style={{ borderColor: theme.border }}>
                  <button
                    type="button"
                    onClick={() => setExpandedDayKey(isOpen ? null : day.key)}
                    className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-right transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isOpen
                        ? theme.surfaceMuted
                        : 'transparent',
                    }}
                  >
                    <div>
                      <div
                        className="text-xs sm:text-sm font-black"
                        style={{ color: theme.text }}
                      >
                        {day.date.toLocaleDateString(
                          language === 'ar' ? 'ar-TN' : 'en-US',
                          {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          },
                        )}
                      </div>
                      <div
                        className="text-[11px] font-mono tabular-nums mt-0.5"
                        style={{ color: theme.textMuted }}
                      >
                        {day.invoicesCount} فاتورة · {day.totalItems} صنف ·{' '}
                        {formatQuantityWithGrouping(day.totalPieces)} قطعة
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className="text-sm font-black font-mono tabular-nums"
                        style={{ color: theme.accent }}
                      >
                        {fmtVal(day.total, settings, showFinancials)}
                      </span>
                      {isOpen ? (
                        <ChevronUp size={15} style={{ color: theme.textMuted }} />
                      ) : (
                        <ChevronDown
                          size={15}
                          style={{ color: theme.textMuted }}
                        />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div
                      className="px-5 py-3 border-t space-y-2"
                      style={{
                        borderColor: theme.border,
                        backgroundColor: theme.bg,
                      }}
                    >
                      {day.invoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="p-3 border text-xs space-y-1.5"
                          style={{
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                          }}
                        >
                          <div
                            className="flex items-center justify-between font-bold"
                            style={{ color: theme.text }}
                          >
                            <span>
                              {inv.supplierName}{' '}
                              {inv.hasExplicitInvoiceNumber
                                ? `(#${inv.invoiceNumber})`
                                : ''}
                            </span>
                            <span className="font-mono tabular-nums">
                              {fmtVal(inv.totalAmount, settings, showFinancials)}
                            </span>
                          </div>
                          <div
                            className="text-[11px]"
                            style={{ color: theme.textMuted }}
                          >
                            {inv.items
                              .map((it) => `${it.name} (×${it.qtyAdded})`)
                              .join(' · ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </FolioSectionShell>
    </div>
  );
};

/* ============================================================================
   5. SHRINKAGE, SURPLUS & DAMAGES (FOLIO STYLE)
   ============================================================================ */
interface FolioShrinkageViewProps {
  theme: FolioTheme;
  settings: UserSettings;
  currentReport: any;
  analyzedItems: AnalyzedItem[];
  summaryMetrics: SummaryMetrics;
}

export const FolioShrinkageView: React.FC<FolioShrinkageViewProps> = ({
  theme,
  settings,
  currentReport,
  analyzedItems,
  summaryMetrics,
}) => {
  const showFinancials = settings.showFinancials ?? true;
  const surplusItems = analyzedItems.filter((it) => it.isSurplus);
  const damageItems = currentReport?.damageItems || [];

  return (
    <div>
      <FolioSectionShell
        id="folio-shrink-audit"
        indexNumber="01"
        kicker="انضباط المخزون"
        title="سلامة الجرد: الفوائض غير المفسرة وسجل التوالف"
        leadLeft="يرصد هذا القسم الحالات التي اختلف فيها العد الفعلي عن الرصيد الدفتري، سواء بزيادة غير مبررة (غالباً فاتورة لم تُسجل) أو بتلف وأضرار معتمدة."
        leadRight="مراقبة هذه الفوارق تحفظ دقة رأس المال وتمنع التسرب التدريجي في الأرباح بين دورات الجرد."
        figureCaption="سجل الفوائض والتوالف في دورة الجرد المحددة."
        theme={theme}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Surplus */}
          <div
            className="border p-6 space-y-4"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: theme.border }}>
              <h4 className="text-sm font-black" style={{ color: theme.text }}>
                الفوائض والزيادات غير المفسرة
              </h4>
              <span className="text-xs font-mono tabular-nums" style={{ color: theme.neutral }}>
                {surplusItems.length} صنف
              </span>
            </div>

            {surplusItems.length === 0 ? (
              <div className="py-10 text-center space-y-1">
                <CheckCircle2 size={28} className="mx-auto" style={{ color: theme.positive }} />
                <div className="text-xs font-bold" style={{ color: theme.text }}>
                  أرقام الجرد متطابقة بالكامل
                </div>
                <div className="text-[11px]" style={{ color: theme.textMuted }}>
                  لم تُسجل زيادات غير مفسرة في هذا الجرد.
                </div>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: theme.border }}>
                {surplusItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="py-2.5 flex items-center justify-between text-xs"
                    style={{ borderColor: theme.border }}
                  >
                    <div>
                      <div className="font-bold" style={{ color: theme.text }}>{it.name}</div>
                      <div className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                        +{formatQuantityWithGrouping(it.surplusQuantity)} قطعة
                      </div>
                    </div>
                    <div className="font-mono tabular-nums font-bold" style={{ color: theme.neutral }}>
                      {fmtVal(it.surplusCostValue, settings, showFinancials)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Damages */}
          <div
            className="border p-6 space-y-4"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: theme.border }}>
              <h4 className="text-sm font-black" style={{ color: theme.text }}>
                سجل التوالف والأضرار
              </h4>
              <span className="text-xs font-mono tabular-nums font-bold" style={{ color: theme.negative }}>
                {fmtVal(summaryMetrics.damageLoss, settings, showFinancials)}
              </span>
            </div>

            {damageItems.length === 0 ? (
              <div className="py-10 text-center space-y-1">
                <CheckCircle2 size={28} className="mx-auto" style={{ color: theme.positive }} />
                <div className="text-xs font-bold" style={{ color: theme.text }}>
                  لا توجد توالف مسجلة في هذه الدورة
                </div>
                <div className="text-[11px]" style={{ color: theme.textMuted }}>
                  سجل الهدر والتوالف نظيف بنسبة 100%.
                </div>
              </div>
            ) : (
              <div className="divide-y max-h-[300px] overflow-y-auto" style={{ borderColor: theme.border }}>
                {damageItems.map((dmg: any, idx: number) => (
                  <div
                    key={idx}
                    className="py-2.5 flex items-center justify-between text-xs"
                    style={{ borderColor: theme.border }}
                  >
                    <div>
                      <div className="font-bold" style={{ color: theme.text }}>{dmg.productName}</div>
                      <div className="text-[11px]" style={{ color: theme.textMuted }}>
                        الكمية: {dmg.quantity} · {dmg.reason || 'تلف / كسر'}
                      </div>
                    </div>
                    <div className="font-mono tabular-nums font-bold" style={{ color: theme.negative }}>
                      {fmtVal(dmg.totalLoss, settings, showFinancials)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </FolioSectionShell>
    </div>
  );
};

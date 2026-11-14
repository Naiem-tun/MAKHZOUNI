import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  Calendar,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatAppDate, safeParseDate } from '../../../../lib/utils';
import { Supplier, SupplierTransaction, UserSettings } from '../../../../types';
import {
  AnalyzedItem,
  CategoryBreakdownItem,
  CycleHighlights,
  DayPurchasesGroup,
  MacroStrategicDiagnostic,
  MarginSqueezeAnalysis,
  MarketDebtsStats,
  MultiInventoryTrendItem,
  ParetoAnalysis,
  StoreHealthDiagnostic,
  SummaryMetrics,
  SupplierPerformanceData,
  TimeHorizon,
} from '../types';
import { FolioChartsPart1 } from '../folio/FolioChartsPart1';
import { FolioChartsPart2 } from '../folio/FolioChartsPart2';
import {
  FolioDiagnosticView,
  FolioPurchasesView,
  FolioShrinkageView,
  FolioSuppliersView,
  FolioVelocityView,
} from '../folio/FolioExtraSections';
import { FOLIO_THEMES } from '../folio/folioThemes';
import {
  FolioSourceMode,
  useFolioAnalyticsData,
} from '../folio/useFolioAnalyticsData';

type FolioSideView =
  | 'visual'
  | 'diagnostic'
  | 'velocity'
  | 'suppliers'
  | 'purchases'
  | 'shrinkage';

interface FolioTabProps {
  inventoryReports: any[];
  sortedReports: any[];
  products: any[];
  purchases: any[];
  suppliers?: Supplier[];
  supplierTransactions?: SupplierTransaction[];
  analyzedItems: AnalyzedItem[];
  categoryBreakdown: CategoryBreakdownItem[];
  multiInventoryTrends: MultiInventoryTrendItem[];
  timeHorizon: TimeHorizon;
  setTimeHorizon: (h: TimeHorizon) => void;
  selectedReportIndex: number;
  setSelectedReportIndex: (idx: number) => void;
  currentReport: any;
  summaryMetrics: SummaryMetrics;
  storeHealthDiagnostic: StoreHealthDiagnostic | null;
  macroStrategicDiagnostic: MacroStrategicDiagnostic | null;
  cycleHighlights: CycleHighlights | null;
  marketDebtsStats: MarketDebtsStats;
  paretoProfitAnalysis: ParetoAnalysis;
  marginSqueezeAnalysis: MarginSqueezeAnalysis;
  topMovingItems: AnalyzedItem[];
  stagnantItems: AnalyzedItem[];
  displayReplenishmentItems: AnalyzedItem[];
  replenishmentSearch: string;
  setReplenishmentSearch: (q: string) => void;
  urgentFilter: 'all' | 'critical' | 'warning';
  setUrgentFilter: (f: 'all' | 'critical' | 'warning') => void;
  dailyPurchases: DayPurchasesGroup[];
  supplierPerformanceData: SupplierPerformanceData;
  onOpenParetoModal: () => void;
  onOpenMarginModal: () => void;
  onOpenCycleExplainer: () => void;
  settings: UserSettings;
}

const SECTION_INDEX = [
  { num: '01', id: 'folio-sec-01', label: 'المصفوفة' },
  { num: '02', id: 'folio-sec-02', label: 'الفئات' },
  { num: '03', id: 'folio-sec-03', label: 'الدمبل' },
  { num: '04', id: 'folio-sec-04', label: 'الأشرطة' },
  { num: '05', id: 'folio-sec-05', label: 'المسار' },
  { num: '06', id: 'folio-sec-06', label: 'الأعمدة' },
  { num: '07', id: 'folio-sec-07', label: 'الحرارية' },
  { num: '08', id: 'folio-sec-08', label: 'الوافل' },
  { num: '09', id: 'folio-sec-09', label: 'التشتت' },
  { num: '10', id: 'folio-sec-10', label: 'الفهرس' },
];

const SIDE_VIEWS: {
  id: FolioSideView;
  num: string;
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'visual',
    num: '01',
    title: 'التقرير البصري الشامل',
    subtitle: 'المخططات العشرة التفاعلية وتصدير CSV',
  },
  {
    id: 'diagnostic',
    num: '02',
    title: 'التشخيص، 80/20 وتآكل الأرباح',
    subtitle: 'صحة المتجر، باريتو، وديون السوق',
  },
  {
    id: 'velocity',
    num: '03',
    title: 'سرعة الدوران ونفاد الرفوف',
    subtitle: 'السلع السريعة، الراكدة، وتنبيهات الطلب',
  },
  {
    id: 'suppliers',
    num: '04',
    title: 'تحليل أداء الموردين',
    subtitle: 'ربحية بضاعة كل مورد ورأس ماله بالمحل',
  },
  {
    id: 'purchases',
    num: '05',
    title: 'حركة المشتريات اليومية',
    subtitle: 'سجل الفواتير اليومي وتوزيع التوريدات',
  },
  {
    id: 'shrinkage',
    num: '06',
    title: 'سلامة الجرد والتوالف',
    subtitle: 'الفوائض غير المفسرة وخسائر التلف',
  },
];

export const FolioTab: React.FC<FolioTabProps> = ({
  inventoryReports,
  sortedReports,
  products,
  purchases,
  suppliers = [],
  supplierTransactions = [],
  analyzedItems,
  categoryBreakdown,
  multiInventoryTrends,
  timeHorizon,
  setTimeHorizon,
  selectedReportIndex,
  setSelectedReportIndex,
  currentReport,
  summaryMetrics,
  storeHealthDiagnostic,
  macroStrategicDiagnostic,
  cycleHighlights,
  marketDebtsStats,
  paretoProfitAnalysis,
  marginSqueezeAnalysis,
  topMovingItems,
  stagnantItems,
  displayReplenishmentItems,
  replenishmentSearch,
  setReplenishmentSearch,
  urgentFilter,
  setUrgentFilter,
  dailyPurchases,
  supplierPerformanceData,
  onOpenParetoModal,
  onOpenMarginModal,
  onOpenCycleExplainer,
  settings,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const [sideView, setSideView] = useState<FolioSideView>('visual');
  const [sourceMode, setSourceMode] = useState<FolioSourceMode>('live');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(false);

  const [themeId, setThemeId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('folio_theme_id');
      if (saved && FOLIO_THEMES.some((t) => t.id === saved)) return saved;
    } catch {}
    return settings.darkMode ? 'folio-night' : 'folio-editorial';
  });

  const [activeSection, setActiveSection] = useState<string>('01');
  const [showThemePicker, setShowThemePicker] = useState(false);

  const activeTheme =
    FOLIO_THEMES.find((t) => t.id === themeId) || FOLIO_THEMES[0];

  const handleSelectTheme = (id: string) => {
    setThemeId(id);
    setShowThemePicker(false);
    try {
      localStorage.setItem('folio_theme_id', id);
    } catch {}
  };

  // Observe active section on scroll when in visual view
  useEffect(() => {
    if (sideView !== 'visual') return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const match = SECTION_INDEX.find((s) => s.id === entry.target.id);
            if (match) setActiveSection(match.num);
          }
        });
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: 0.05 },
    );

    SECTION_INDEX.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sideView]);

  const folioData = useFolioAnalyticsData({
    inventoryReports,
    products,
    purchases,
    suppliers,
    supplierTransactions,
    analyzedItems,
    categoryBreakdown,
    multiInventoryTrends,
    settings,
    sourceMode,
  });

  const jumpToSection = (id: string, num: string) => {
    setActiveSection(num);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const selectSideView = (view: FolioSideView) => {
    setSideView(view);
    setIsSidePanelOpen(false);
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeViewMeta =
    SIDE_VIEWS.find((v) => v.id === sideView) || SIDE_VIEWS[0];

  return (
    <div
      ref={containerRef}
      dir="rtl"
      className="border transition-colors duration-200 relative"
      style={{
        backgroundColor: activeTheme.bg,
        borderColor: activeTheme.border,
        color: activeTheme.text,
      }}
    >
      {/* =====================================================================
          STICKY FOLIO CONTROL BAR (Side Drawer Trigger + Index 01..10 + Themes)
          ===================================================================== */}
      <div
        className="sticky top-0 z-20 border-b px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 backdrop-blur-md"
        style={{
          backgroundColor: activeTheme.isDark
            ? 'rgba(16,18,24,0.92)'
            : 'rgba(244,244,246,0.92)',
          borderColor: activeTheme.border,
        }}
      >
        {/* Start: Side Tab Drawer Trigger + Active View / 01..10 Rail */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar min-w-0">
          <button
            type="button"
            onClick={() => setIsSidePanelOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              backgroundColor: isSidePanelOpen
                ? activeTheme.accent
                : activeTheme.surface,
              borderColor: isSidePanelOpen
                ? activeTheme.accent
                : activeTheme.border,
              color: isSidePanelOpen
                ? activeTheme.accentText
                : activeTheme.text,
            }}
          >
            {isSidePanelOpen ? (
              <PanelRightClose size={14} />
            ) : (
              <PanelRightOpen size={14} />
            )}
            <span>باقي التقرير</span>
          </button>

          {sideView === 'visual' ? (
            <nav
              aria-label="فهرس الأقسام"
              className="flex items-center gap-1"
            >
              {SECTION_INDEX.map((sec) => {
                const isCurrent = activeSection === sec.num;
                return (
                  <button
                    key={sec.num}
                    type="button"
                    onClick={() => jumpToSection(sec.id, sec.num)}
                    title={sec.label}
                    className="px-2 py-1 text-[11px] font-mono tabular-nums font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: isCurrent
                        ? activeTheme.accent
                        : 'transparent',
                      color: isCurrent
                        ? activeTheme.accentText
                        : activeTheme.textMuted,
                    }}
                  >
                    {sec.num}
                  </button>
                );
              })}
            </nav>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => selectSideView('visual')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  backgroundColor: activeTheme.surfaceMuted,
                  borderColor: activeTheme.border,
                  color: activeTheme.text,
                }}
              >
                <ArrowLeft size={12} className="rotate-180" />
                <span>العودة للتقرير البصري</span>
              </button>
              <span
                className="text-xs font-bold truncate hidden sm:inline"
                style={{ color: activeTheme.textMuted }}
              >
                {activeViewMeta.num} · {activeViewMeta.title}
              </span>
            </div>
          )}
        </div>

        {/* End: Live/Report Source Mode Toggle + Theme Picker */}
        <div className="flex items-center gap-2 shrink-0">
          {sideView === 'visual' &&
            sortedReports.length > 0 &&
            analyzedItems.length > 0 && (
              <div
                className="flex items-center border p-0.5"
                style={{
                  backgroundColor: activeTheme.surfaceMuted,
                  borderColor: activeTheme.border,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSourceMode('live')}
                  className="px-2.5 py-1 text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    backgroundColor:
                      sourceMode === 'live'
                        ? activeTheme.accent
                        : 'transparent',
                    color:
                      sourceMode === 'live'
                        ? activeTheme.accentText
                        : activeTheme.textMuted,
                  }}
                >
                  المخزون الحي
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('report')}
                  className="px-2.5 py-1 text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    backgroundColor:
                      sourceMode === 'report'
                        ? activeTheme.text
                        : 'transparent',
                    color:
                      sourceMode === 'report'
                        ? activeTheme.surface
                        : activeTheme.textMuted,
                  }}
                >
                  لقطة الجرد
                </button>
              </div>
            )}

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowThemePicker((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: activeTheme.surface,
                borderColor: activeTheme.border,
                color: activeTheme.text,
              }}
            >
              <Palette size={13} style={{ color: activeTheme.accent }} />
              <span className="hidden sm:inline">{activeTheme.name}</span>
              <span className="sm:hidden">الثيم</span>
            </button>

          {showThemePicker && (
            <div
              className="absolute left-0 mt-1.5 w-52 border shadow-xl z-40 p-1.5 space-y-1"
              style={{
                backgroundColor: activeTheme.surface,
                borderColor: activeTheme.border,
              }}
            >
              {FOLIO_THEMES.map((th) => {
                const selected = th.id === activeTheme.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => handleSelectTheme(th.id)}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-bold transition-colors cursor-pointer"
                    style={{
                      backgroundColor: selected
                        ? activeTheme.surfaceMuted
                        : 'transparent',
                      color: activeTheme.text,
                    }}
                  >
                    <span>{th.name}</span>
                    <span className="flex items-center gap-0.5">
                      {th.series.slice(0, 3).map((col, idx) => (
                        <span
                          key={idx}
                          className="w-2.5 h-2.5 inline-block"
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          FOLIO SLIDE-OVER SIDE TABS DRAWER (Styled 100% in Folio Aesthetic)
          ===================================================================== */}
      {isSidePanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
          {/* Backdrop */}
          <div
            onClick={() => setIsSidePanelOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
          />

          {/* Folio Side Drawer */}
          <aside
            className="relative z-10 w-80 max-w-[88vw] h-full border-l flex flex-col justify-between overflow-y-auto shadow-2xl"
            style={{
              backgroundColor: activeTheme.surface,
              borderColor: activeTheme.border,
              color: activeTheme.text,
            }}
          >
            <div className="p-5 space-y-6">
              {/* Drawer Header */}
              <div
                className="flex items-center justify-between pb-4 border-b"
                style={{ borderColor: activeTheme.border }}
              >
                <div>
                  <div
                    className="text-[11px] font-mono uppercase tracking-wider"
                    style={{ color: activeTheme.accent }}
                  >
                    فهرس التقرير الجانبي
                  </div>
                  <h3 className="text-base font-black mt-0.5">
                    أقسام التحليلات والتشخيص
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidePanelOpen(false)}
                  aria-label="إغلاق القائمة الجانبية"
                  className="p-1.5 border cursor-pointer"
                  style={{
                    borderColor: activeTheme.border,
                    color: activeTheme.textMuted,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Side Views Navigation List */}
              <div className="space-y-2">
                {SIDE_VIEWS.map((view) => {
                  const isActive = sideView === view.id;
                  return (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => selectSideView(view.id)}
                      className="w-full text-right p-3.5 border transition-colors cursor-pointer block"
                      style={{
                        backgroundColor: isActive
                          ? activeTheme.surfaceMuted
                          : 'transparent',
                        borderColor: isActive
                          ? activeTheme.accent
                          : activeTheme.border,
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className="text-xs font-mono font-bold tabular-nums"
                          style={{
                            color: isActive
                              ? activeTheme.accent
                              : activeTheme.textMuted,
                          }}
                        >
                          {view.num}
                        </span>
                        {isActive && (
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: activeTheme.accent }}
                          >
                            مفتوح الآن
                          </span>
                        )}
                      </div>
                      <div
                        className="text-sm font-black mt-1"
                        style={{ color: activeTheme.text }}
                      >
                        {view.title}
                      </div>
                      <div
                        className="text-[11px] mt-0.5 leading-snug"
                        style={{ color: activeTheme.textMuted }}
                      >
                        {view.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Time Horizon & Inventory Report Picker (Integrated cleanly in Folio style) */}
              {sortedReports.length > 0 && (
                <div
                  className="pt-5 border-t space-y-3"
                  style={{ borderColor: activeTheme.border }}
                >
                  <div
                    className="text-xs font-mono font-bold flex items-center gap-1.5"
                    style={{ color: activeTheme.textMuted }}
                  >
                    <Calendar size={13} style={{ color: activeTheme.accent }} />
                    <span>نطاق الجرد والتحليل</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'cycle', label: 'دورة محددة' },
                      { id: '3months', label: 'آخر 3 أشهر' },
                      { id: '6months', label: 'آخر 6 أشهر' },
                      { id: 'all', label: 'كامل المسار' },
                    ].map((h) => {
                      const active = timeHorizon === h.id;
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setTimeHorizon(h.id as TimeHorizon)}
                          className="px-2.5 py-2 text-xs font-bold border transition-colors cursor-pointer"
                          style={{
                            backgroundColor: active
                              ? activeTheme.text
                              : activeTheme.bg,
                            color: active
                              ? activeTheme.surface
                              : activeTheme.text,
                            borderColor: active
                              ? activeTheme.text
                              : activeTheme.border,
                          }}
                        >
                          {h.label}
                        </button>
                      );
                    })}
                  </div>

                  {timeHorizon === 'cycle' && (
                    <select
                      value={selectedReportIndex}
                      onChange={(e) =>
                        setSelectedReportIndex(Number(e.target.value))
                      }
                      aria-label="اختر عملية الجرد"
                      className="w-full px-3 py-2 text-xs font-bold border focus:outline-none cursor-pointer"
                      style={{
                        backgroundColor: activeTheme.bg,
                        borderColor: activeTheme.border,
                        color: activeTheme.text,
                      }}
                    >
                      {sortedReports.map((rep, idx) => {
                        const dateStr = formatAppDate(
                          safeParseDate(rep.date),
                          'ar',
                          t,
                          {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          },
                        );
                        return (
                          <option key={rep.id || idx} value={idx}>
                            {idx === 0
                              ? 'الجرد الأخير: '
                              : `الجرد رقم ${sortedReports.length - idx}: `}{' '}
                            {dateStr}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div
              className="p-4 border-t text-[11px]"
              style={{
                borderColor: activeTheme.border,
                color: activeTheme.textMuted,
              }}
            >
              {settings.storeName || 'مخزوني'} · {folioData.modeLabel}
            </div>
          </aside>
        </div>
      )}

      {/* =====================================================================
          MAIN FOLIO CANVAS (DEFAULT: VISUAL 01-10 OR SELECTED SIDE VIEW)
          ===================================================================== */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-8 sm:pt-10 pb-4">
        {/* Compact Quick Side-Tabs Strip right above Hero for 1-tap switching */}
        <div
          className="pb-6 mb-8 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar"
          style={{ borderColor: activeTheme.border }}
        >
          {SIDE_VIEWS.map((view) => {
            const active = sideView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => selectSideView(view.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  backgroundColor: active
                    ? activeTheme.text
                    : activeTheme.surface,
                  color: active ? activeTheme.surface : activeTheme.textMuted,
                  borderColor: active ? activeTheme.text : activeTheme.border,
                }}
              >
                <span
                  className="font-mono tabular-nums"
                  style={{
                    color: active ? activeTheme.surface : activeTheme.accent,
                  }}
                >
                  {view.num}
                </span>
                <span>{view.title}</span>
              </button>
            );
          })}
        </div>

        {sideView === 'visual' && (
          <>
            {/* Editorial Hero Intro */}
            <div
              className="pb-10 border-b space-y-5"
              style={{ borderColor: activeTheme.border }}
            >
              <div
                className="flex flex-wrap items-center gap-2 text-xs font-medium"
                style={{ color: activeTheme.textMuted }}
              >
                <span
                  className="font-bold"
                  style={{ color: activeTheme.accent }}
                >
                  {settings.storeName || 'مخزوني'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{folioData.modeLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {folioData.totalProducts} صنف · {folioData.totalCategories}{' '}
                  فئة
                </span>
              </div>

              <h1
                className="text-3xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl [text-wrap:balance]"
                style={{ color: activeTheme.text }}
              >
                تحليلات المخزون التفاعلية بصياغة بصرية متكاملة
              </h1>

              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-10 text-sm sm:text-[15px] leading-relaxed pt-1"
                style={{ color: activeTheme.textMuted }}
              >
                <p>{folioData.modeDescription}</p>
                <p>
                  تصفح المخططات العشرة أدناه، أو افتح قائمة{' '}
                  <button
                    type="button"
                    onClick={() => setIsSidePanelOpen(true)}
                    className="font-bold underline cursor-pointer"
                    style={{ color: activeTheme.accent }}
                  >
                    «باقي التقرير»
                  </button>{' '}
                  للوصول إلى تشخيص النمو وقاعدة 80/20 وسرعة الدوران وسجل الموردين والمشتريات بنفس الأسلوب البصري.
                </p>
              </div>
            </div>

            <FolioChartsPart1
              data={folioData}
              theme={activeTheme}
              settings={settings}
            />
            <FolioChartsPart2
              data={folioData}
              theme={activeTheme}
              settings={settings}
            />
          </>
        )}

        {sideView === 'diagnostic' && (
          <FolioDiagnosticView
            theme={activeTheme}
            settings={settings}
            timeHorizon={timeHorizon}
            storeHealthDiagnostic={storeHealthDiagnostic}
            macroStrategicDiagnostic={macroStrategicDiagnostic}
            cycleHighlights={cycleHighlights}
            marketDebtsStats={marketDebtsStats}
            paretoProfitAnalysis={paretoProfitAnalysis}
            marginSqueezeAnalysis={marginSqueezeAnalysis}
            onOpenParetoModal={onOpenParetoModal}
            onOpenMarginModal={onOpenMarginModal}
            onOpenCycleExplainer={onOpenCycleExplainer}
          />
        )}

        {sideView === 'velocity' && (
          <FolioVelocityView
            theme={activeTheme}
            settings={settings}
            topMovingItems={topMovingItems}
            stagnantItems={stagnantItems}
            displayReplenishmentItems={displayReplenishmentItems}
            replenishmentSearch={replenishmentSearch}
            setReplenishmentSearch={setReplenishmentSearch}
            urgentFilter={urgentFilter}
            setUrgentFilter={setUrgentFilter}
            products={products}
          />
        )}

        {sideView === 'suppliers' && (
          <FolioSuppliersView
            theme={activeTheme}
            settings={settings}
            supplierPerformanceData={supplierPerformanceData}
          />
        )}

        {sideView === 'purchases' && (
          <FolioPurchasesView
            theme={activeTheme}
            settings={settings}
            dailyPurchases={dailyPurchases}
          />
        )}

        {sideView === 'shrinkage' && (
          <FolioShrinkageView
            theme={activeTheme}
            settings={settings}
            currentReport={currentReport}
            analyzedItems={analyzedItems}
            summaryMetrics={summaryMetrics}
          />
        )}

        {/* Editorial Footer */}
        <footer className="py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div style={{ color: activeTheme.textMuted }}>
            <span className="font-bold" style={{ color: activeTheme.text }}>
              {settings.storeName || 'مخزوني'}
            </span>
            {' · '}
            <span>{activeViewMeta.title}</span>
          </div>

          <button
            type="button"
            onClick={() =>
              containerRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              backgroundColor: activeTheme.surface,
              borderColor: activeTheme.border,
              color: activeTheme.text,
            }}
          >
            <span>العودة للأعلى</span>
            <ArrowUp size={13} />
          </button>
        </footer>
      </div>
    </div>
  );
};

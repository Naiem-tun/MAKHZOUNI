import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { InventoryAnalyticsProps, TimeHorizon, AnalyticsSubTab } from './analytics/types';
import { useInventoryAnalyticsData } from './analytics/useInventoryAnalyticsData';
import { AnalyticsTopBar } from './analytics/AnalyticsTopBar';
import { DiagnosticTab } from './analytics/tabs/DiagnosticTab';
import { OverviewTab } from './analytics/tabs/OverviewTab';
import { CategoriesTab } from './analytics/tabs/CategoriesTab';
import { VelocityTab } from './analytics/tabs/VelocityTab';
import { PurchasesTab } from './analytics/tabs/PurchasesTab';
import { SuppliersTab } from './analytics/tabs/SuppliersTab';
import { ShrinkageTab } from './analytics/tabs/ShrinkageTab';
import { TrendsTab } from './analytics/tabs/TrendsTab';
import { AnalyticsModals } from './analytics/AnalyticsModals';

export const InventoryAnalytics: React.FC<InventoryAnalyticsProps> = ({
  inventoryReports,
  products,
  purchases,
  supplierTransactions = [],
  suppliers = [],
  debts = [],
  settings,
}) => {
  // Navigation & Time Horizon State
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('cycle');
  const [selectedReportIndex, setSelectedReportIndex] = useState<number>(0);
  const [subTab, setSubTab] = useState<AnalyticsSubTab>('diagnostic');

  // Filter & Search States
  const [filterQuery, setFilterQuery] = useState('');
  const [replenishmentSearch, setReplenishmentSearch] = useState('');
  const [urgentFilter, setUrgentFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  // Expanded Accordion States
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [supplierSortBy, setSupplierSortBy] = useState<'profit' | 'purchases' | 'stock_qty' | 'margin'>('profit');
  const [expandedSupplierDetailsId, setExpandedSupplierDetailsId] = useState<string | null>(null);

  // Modals Visibility
  const [showCycleExplainer, setShowCycleExplainer] = useState(false);
  const [showParetoModal, setShowParetoModal] = useState(false);
  const [showMarginSqueezeModal, setShowMarginSqueezeModal] = useState(false);

  // Compute Analytics Data Hook
  const {
    sortedReports,
    isLatestReportSelected,
    currentReport,
    previousReport,
    elapsedDays,
    daysSinceLatestInventory,
    analyzedItems,
    summaryMetrics,
    storeHealthDiagnostic,
    cycleHighlights,
    marketDebtsStats,
    macroStrategicDiagnostic,
    topMovingItems,
    stagnantItems,
    replenishmentItems,
    displayReplenishmentItems,
    categoryBreakdown,
    topRoiProducts,
    paretoProfitAnalysis,
    marginSqueezeAnalysis,
    dailyPurchases,
    supplierPerformanceData,
    multiInventoryTrends,
  } = useInventoryAnalyticsData({
    inventoryReports,
    products,
    purchases,
    supplierTransactions,
    suppliers,
    debts,
    settings,
    timeHorizon,
    selectedReportIndex,
    replenishmentSearch,
    urgentFilter,
    itemsPerPage,
    filterQuery,
  });

  // Empty State
  if (inventoryReports.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-12 text-center shadow-sm">
        <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-brand-50 dark:bg-brand-950/40 flex items-center justify-center text-brand-500">
          <Layers size={32} />
        </div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">لا توجد عمليات جرد مسجلة بعد</h3>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          عند إتمام عمليات الجرد في قسم "الجرد"، ستظهر هنا تحليلات استهلاك المخزون، سرعة الدوران، والسلع الراكدة تلقائياً.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controller Bar & KPI Ribbons */}
      <AnalyticsTopBar
        sortedReports={sortedReports}
        timeHorizon={timeHorizon}
        setTimeHorizon={setTimeHorizon}
        selectedReportIndex={selectedReportIndex}
        setSelectedReportIndex={setSelectedReportIndex}
        currentReport={currentReport}
        previousReport={previousReport}
        elapsedDays={elapsedDays}
        setShowCycleExplainer={setShowCycleExplainer}
        setShowParetoModal={setShowParetoModal}
        setShowMarginSqueezeModal={setShowMarginSqueezeModal}
        analyzedItemsCount={analyzedItems.length}
        summaryMetrics={summaryMetrics}
        macroStrategicDiagnostic={macroStrategicDiagnostic}
        paretoProfitAnalysis={paretoProfitAnalysis}
        marginSqueezeAnalysis={marginSqueezeAnalysis}
        subTab={subTab}
        setSubTab={setSubTab}
        settings={settings}
      />

      {/* Tab 0: Store Health & Growth Diagnostic */}
      {subTab === 'diagnostic' && (
        <DiagnosticTab
          timeHorizon={timeHorizon}
          macroStrategicDiagnostic={macroStrategicDiagnostic}
          storeHealthDiagnostic={storeHealthDiagnostic}
          currentReport={currentReport}
          previousReport={previousReport}
          cycleHighlights={cycleHighlights}
          marketDebtsStats={marketDebtsStats}
          multiInventoryTrends={multiInventoryTrends}
          settings={settings}
        />
      )}

      {/* Tab 1: Financial Overview */}
      {subTab === 'overview' && (
        <OverviewTab
          summaryMetrics={summaryMetrics}
          settings={settings}
        />
      )}

      {/* Tab 2: Categories & Capital Profitability */}
      {subTab === 'categories' && (
        <CategoriesTab
          topRoiProducts={topRoiProducts}
          categoryBreakdown={categoryBreakdown}
          settings={settings}
        />
      )}

      {/* Tab 3: Velocity & Stock Runway */}
      {subTab === 'velocity' && (
        <VelocityTab
          topMovingItems={topMovingItems}
          stagnantItems={stagnantItems}
          displayReplenishmentItems={displayReplenishmentItems}
          replenishmentItems={replenishmentItems}
          replenishmentSearch={replenishmentSearch}
          setReplenishmentSearch={setReplenishmentSearch}
          urgentFilter={urgentFilter}
          setUrgentFilter={setUrgentFilter}
          itemsPerPage={itemsPerPage}
          setItemsPerPage={setItemsPerPage}
          isLatestReportSelected={isLatestReportSelected}
          daysSinceLatestInventory={daysSinceLatestInventory}
          settings={settings}
        />
      )}

      {/* Tab 4: Daily Purchases Movement */}
      {subTab === 'purchases' && (
        <PurchasesTab
          dailyPurchases={dailyPurchases}
          expandedDayKey={expandedDayKey}
          setExpandedDayKey={setExpandedDayKey}
          expandedInvoiceId={expandedInvoiceId}
          setExpandedInvoiceId={setExpandedInvoiceId}
          settings={settings}
        />
      )}

      {/* Tab 5: Supplier Performance Analysis */}
      {subTab === 'suppliers' && (
        <SuppliersTab
          supplierPerformanceData={supplierPerformanceData}
          supplierSearchQuery={supplierSearchQuery}
          setSupplierSearchQuery={setSupplierSearchQuery}
          supplierSortBy={supplierSortBy}
          setSupplierSortBy={setSupplierSortBy}
          expandedSupplierDetailsId={expandedSupplierDetailsId}
          setExpandedSupplierDetailsId={setExpandedSupplierDetailsId}
          settings={settings}
        />
      )}

      {/* Tab 6: Shrinkage & Recorded Damages */}
      {subTab === 'shrinkage' && (
        <ShrinkageTab
          currentReport={currentReport}
          analyzedItems={analyzedItems}
          summaryMetrics={summaryMetrics}
          settings={settings}
        />
      )}

      {/* Tab 7: Multi-Inventory Trends */}
      {subTab === 'trends' && (
        <TrendsTab
          multiInventoryTrends={multiInventoryTrends}
          settings={settings}
        />
      )}

      {/* Modals Container */}
      <AnalyticsModals
        showCycleExplainer={showCycleExplainer}
        setShowCycleExplainer={setShowCycleExplainer}
        showParetoModal={showParetoModal}
        setShowParetoModal={setShowParetoModal}
        showMarginSqueezeModal={showMarginSqueezeModal}
        setShowMarginSqueezeModal={setShowMarginSqueezeModal}
        elapsedDays={elapsedDays}
        currentReport={currentReport}
        previousReport={previousReport}
        paretoProfitAnalysis={paretoProfitAnalysis}
        marginSqueezeAnalysis={marginSqueezeAnalysis}
        settings={settings}
      />
    </div>
  );
};

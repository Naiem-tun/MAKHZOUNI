import React, { useState } from 'react';
import { InventoryAnalyticsProps, TimeHorizon } from './analytics/types';
import { useInventoryAnalyticsData } from './analytics/useInventoryAnalyticsData';
import { FolioTab } from './analytics/tabs/FolioTab';
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
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('cycle');
  const [selectedReportIndex, setSelectedReportIndex] = useState<number>(0);

  const [replenishmentSearch, setReplenishmentSearch] = useState('');
  const [urgentFilter, setUrgentFilter] = useState<'all' | 'critical' | 'warning'>('all');

  // Modals Visibility
  const [showCycleExplainer, setShowCycleExplainer] = useState(false);
  const [showParetoModal, setShowParetoModal] = useState(false);
  const [showMarginSqueezeModal, setShowMarginSqueezeModal] = useState(false);

  const {
    sortedReports,
    currentReport,
    previousReport,
    elapsedDays,
    analyzedItems,
    summaryMetrics,
    storeHealthDiagnostic,
    cycleHighlights,
    marketDebtsStats,
    macroStrategicDiagnostic,
    topMovingItems,
    stagnantItems,
    displayReplenishmentItems,
    categoryBreakdown,
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
    itemsPerPage: 30,
    filterQuery: '',
  });

  return (
    <div>
      <FolioTab
        inventoryReports={inventoryReports}
        sortedReports={sortedReports}
        products={products}
        purchases={purchases}
        suppliers={suppliers}
        supplierTransactions={supplierTransactions}
        analyzedItems={analyzedItems}
        categoryBreakdown={categoryBreakdown}
        multiInventoryTrends={multiInventoryTrends}
        timeHorizon={timeHorizon}
        setTimeHorizon={setTimeHorizon}
        selectedReportIndex={selectedReportIndex}
        setSelectedReportIndex={setSelectedReportIndex}
        currentReport={currentReport}
        summaryMetrics={summaryMetrics}
        storeHealthDiagnostic={storeHealthDiagnostic}
        macroStrategicDiagnostic={macroStrategicDiagnostic}
        cycleHighlights={cycleHighlights}
        marketDebtsStats={marketDebtsStats}
        paretoProfitAnalysis={paretoProfitAnalysis}
        marginSqueezeAnalysis={marginSqueezeAnalysis}
        topMovingItems={topMovingItems}
        stagnantItems={stagnantItems}
        displayReplenishmentItems={displayReplenishmentItems}
        replenishmentSearch={replenishmentSearch}
        setReplenishmentSearch={setReplenishmentSearch}
        urgentFilter={urgentFilter}
        setUrgentFilter={setUrgentFilter}
        dailyPurchases={dailyPurchases}
        supplierPerformanceData={supplierPerformanceData}
        onOpenParetoModal={() => setShowParetoModal(true)}
        onOpenMarginModal={() => setShowMarginSqueezeModal(true)}
        onOpenCycleExplainer={() => setShowCycleExplainer(true)}
        settings={settings}
      />

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

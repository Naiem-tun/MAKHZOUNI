import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  formatCurrency, 
  safeParseDate, 
  formatAppDate, 
  cleanQuantity, 
  roundMoney 
} from '../../../lib/utils';
import {
  InventoryAnalyticsProps,
  TimeHorizon,
  AnalyzedItem,
  SummaryMetrics,
  StoreHealthDiagnostic,
  MacroStrategicDiagnostic,
  CycleHighlights,
  MarketDebtsStats,
  CategoryBreakdownItem,
  ParetoAnalysis,
  MarginSqueezeAnalysis,
  MarginSqueezeItem,
  DayPurchasesGroup,
  DayInvoice,
  DayInvoiceItem,
  SupplierPerformanceData,
  CalculatedSupplier,
  SupplierPerformanceItem,
  MultiInventoryTrendItem
} from './types';

interface UseInventoryAnalyticsDataParams extends InventoryAnalyticsProps {
  timeHorizon: TimeHorizon;
  selectedReportIndex: number;
  replenishmentSearch: string;
  urgentFilter: 'all' | 'critical' | 'warning';
  itemsPerPage: number;
  filterQuery: string;
}

export function useInventoryAnalyticsData({
  inventoryReports,
  products,
  purchases,
  supplierTransactions = [],
  suppliers = [],
  debts = [],
  settings,
  timeHorizon,
  selectedReportIndex,
  replenishmentSearch,
  urgentFilter,
  itemsPerPage,
  filterQuery,
}: UseInventoryAnalyticsDataParams) {
  const { t } = useTranslation();
  const language = settings.language || 'ar';

  // Sort reports chronologically descending (0 is latest)
  const sortedReports = useMemo(() => {
    return [...inventoryReports].sort((a, b) => {
      const timeA = safeParseDate(a.date).getTime();
      const timeB = safeParseDate(b.date).getTime();
      return timeB - timeA;
    });
  }, [inventoryReports]);

  // Filtered reports according to time horizon
  const periodReports = useMemo(() => {
    if (sortedReports.length === 0) return [];
    if (timeHorizon === 'cycle' || timeHorizon === 'all') {
      return sortedReports;
    }
    const now = Date.now();
    const daysLimit = timeHorizon === '3months' ? 90 : 180;
    const msLimit = daysLimit * 24 * 60 * 60 * 1000;
    
    const filtered = sortedReports.filter(rep => {
      const repTime = safeParseDate(rep.date).getTime();
      return (now - repTime) <= msLimit;
    });

    if (filtered.length === 0) {
      return sortedReports.slice(0, timeHorizon === '3months' ? 3 : 6);
    }
    return filtered;
  }, [sortedReports, timeHorizon]);

  // Current selected report and previous report (for delta comparison)
  const isLatestReportSelected = selectedReportIndex === 0;
  const currentReport = sortedReports[selectedReportIndex] || null;
  const previousReport = sortedReports[selectedReportIndex + 1] || null;

  // Calculate elapsed days between current report and previous report
  const elapsedDays = useMemo(() => {
    if (!currentReport) return 1;
    const curDate = safeParseDate(currentReport.date).getTime();
    if (previousReport) {
      const prevDate = safeParseDate(previousReport.date).getTime();
      const diffMs = Math.abs(curDate - prevDate);
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return Math.max(days, 1);
    }
    return 14; // Default estimated cycle if only 1 report
  }, [currentReport, previousReport]);

  // Days elapsed since the latest inventory until today
  const daysSinceLatestInventory = useMemo(() => {
    if (!sortedReports[0]) return 0;
    const repDate = safeParseDate(sortedReports[0].date).getTime();
    const now = Date.now();
    const diff = Math.floor((now - repDate) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 0);
  }, [sortedReports]);

  // Group products by barcode and/or name to aggregate total live quantities across all purchase price batches!
  const groupedLiveProducts = useMemo(() => {
    const nameMap = new Map<string, {
      totalQuantity: number;
      category: string;
      latestCostPrice: number;
      sellingPrice: number;
      barcode: string;
      name: string;
      batchCount: number;
      piecesPerBox: number;
    }>();

    const barcodeMap = new Map<string, any>();

    products.forEach(p => {
      const nameKey = String(p.name || '').trim().toLowerCase();
      const barcodeKey = String(p.barcode || p.barcode2 || '').trim().toLowerCase();
      
      const primaryKey = nameKey || barcodeKey;
      if (!primaryKey) return;

      const q = Number(p.quantity ?? 0);
      const cost = Number(p.purchasePrice || p.costPrice || 0);
      const sell = Number(p.sellingPrice || 0);
      const piecesBox = Math.max(1, Number(p.piecesPerBox || 1));

      let record = nameKey ? nameMap.get(nameKey) : (barcodeKey ? barcodeMap.get(barcodeKey) : undefined);

      if (record) {
        record.totalQuantity += q;
        record.batchCount += 1;
        if (cost > 0) record.latestCostPrice = cost;
        if (sell > 0) record.sellingPrice = sell;
        if (piecesBox > 1) record.piecesPerBox = piecesBox;
        if (!record.barcode && barcodeKey) record.barcode = p.barcode || p.barcode2;
      } else {
        record = {
          totalQuantity: q,
          category: p.category || 'عام',
          latestCostPrice: cost,
          sellingPrice: sell,
          barcode: p.barcode || p.barcode2 || '',
          name: p.name || '',
          batchCount: 1,
          piecesPerBox: piecesBox,
        };
        if (nameKey) nameMap.set(nameKey, record);
      }

      if (barcodeKey) barcodeMap.set(barcodeKey, record);
    });

    return { nameMap, barcodeMap };
  }, [products]);

  // Deep analysis of items in the current report with aggregated groupings
  const analyzedItems = useMemo((): AnalyzedItem[] => {
    if (!currentReport || !currentReport.items) return [];

    const prevItemsMap = new Map<string, any>();
    if (previousReport && previousReport.items) {
      previousReport.items.forEach((it: any) => {
        const nKey = String(it.productName || '').trim().toLowerCase();
        const bKey = String(it.barcode || '').trim().toLowerCase();
        if (nKey) prevItemsMap.set(nKey, it);
        if (bKey) prevItemsMap.set(bKey, it);
      });
    }

    // Group report items by Name first (or barcode if name empty)
    const groupedReportItems = new Map<string, any>();
    currentReport.items.forEach((item: any) => {
      const nKey = String(item.productName || '').trim().toLowerCase();
      const bKey = String(item.barcode || '').trim().toLowerCase();
      const groupKey = nKey || bKey;
      if (!groupKey) return;

      const existing = groupedReportItems.get(groupKey);
      if (existing) {
        existing.quantityAfter = cleanQuantity((existing.quantityAfter || 0) + Number(item.quantityAfter || 0));
        existing.salesCalculated = cleanQuantity((existing.salesCalculated || 0) + Number(item.salesCalculated || 0));
        existing.profit = roundMoney((existing.profit || 0) + Number(item.profit || 0));
        existing.remainingValue = roundMoney((existing.remainingValue || 0) + Number(item.remainingValue || 0));
        if (item.isSurplus) {
          existing.isSurplus = true;
          existing.surplusQuantity = cleanQuantity((existing.surplusQuantity || 0) + (item.surplusQuantity || 0));
          existing.surplusCostValue = roundMoney((existing.surplusCostValue || 0) + (item.surplusCostValue || 0));
        }
      } else {
        groupedReportItems.set(groupKey, { ...item });
      }
    });

    return Array.from(groupedReportItems.values()).map((item: any): AnalyzedItem => {
      const nKey = String(item.productName || '').trim().toLowerCase();
      const bKey = String(item.barcode || '').trim().toLowerCase();
      
      const prevItem = (nKey && prevItemsMap.get(nKey)) || (bKey && prevItemsMap.get(bKey));
      const liveGroup = (nKey && groupedLiveProducts.nameMap.get(nKey)) || 
                        (bKey && groupedLiveProducts.barcodeMap.get(bKey));

      const liveSellPrice = liveGroup && liveGroup.sellingPrice > 0 ? liveGroup.sellingPrice : 0;
      const liveCostPrice = liveGroup && liveGroup.latestCostPrice > 0 ? liveGroup.latestCostPrice : 0;

      const reportSellPrice = roundMoney(Number(item.sellingPrice || 0));
      const reportCostPrice = roundMoney(Number(item.purchasePrice || 0));

      const sellPrice = roundMoney(Number(liveSellPrice > 0 ? liveSellPrice : reportSellPrice));
      const costPrice = roundMoney(Number(liveCostPrice > 0 ? liveCostPrice : reportCostPrice));

      const isDeletedFromStore = Boolean(products.length > 0 && !liveGroup);
      
      const recordedReportStock = cleanQuantity(Number(item.quantityAfter || 0));
      const liveCurrentStock = liveGroup ? cleanQuantity(liveGroup.totalQuantity) : (isDeletedFromStore ? 0 : recordedReportStock);
      
      const soldQty = cleanQuantity(Number(item.salesCalculated || 0));
      const profit = roundMoney(Number(item.profit || 0));
      const revenue = roundMoney(soldQty > 0 ? (soldQty * sellPrice) : 0);
      const cogs = roundMoney(soldQty > 0 ? (soldQty * costPrice) : 0);

      const returnPerDinar = cogs > 0 ? Number((revenue / cogs).toFixed(2)) : (costPrice > 0 && sellPrice > 0 ? Number((sellPrice / costPrice).toFixed(2)) : 0);

      const safeElapsed = Math.max(1, elapsedDays || 1);
      const dailyVelocity = soldQty > 0 ? Number((soldQty / safeElapsed).toFixed(2)) : 0;
      const weeklyVelocity = roundMoney(dailyVelocity * 7);

      const piecesPerBox = Math.max(1, Number(liveGroup?.piecesPerBox || item.piecesPerBox || 1));
      const weeklyBoxesVelocity = piecesPerBox > 1 && weeklyVelocity > 0 ? Number((weeklyVelocity / piecesPerBox).toFixed(1)) : null;
      const dailyBoxesVelocity = piecesPerBox > 1 && dailyVelocity > 0 ? Number((dailyVelocity / piecesPerBox).toFixed(2)) : null;
      const daysForOneBox = piecesPerBox > 1 && dailyVelocity > 0 ? Math.round(piecesPerBox / dailyVelocity) : null;

      const estimatedConsumedSinceInventory = isLatestReportSelected && dailyVelocity > 0
        ? cleanQuantity(Math.round(dailyVelocity * Math.max(0, daysSinceLatestInventory || 0)))
        : 0;

      const estimatedCurrentStockToday = isLatestReportSelected
        ? Math.max(0, cleanQuantity(liveCurrentStock - estimatedConsumedSinceInventory))
        : recordedReportStock;

      const currentStock = isLatestReportSelected ? estimatedCurrentStockToday : recordedReportStock;
      
      const daysUntilStockout = dailyVelocity > 0 
        ? Math.max(0, Math.floor(estimatedCurrentStockToday / dailyVelocity)) 
        : (estimatedCurrentStockToday > 0 ? 999 : 0);

      const prevStock = prevItem ? cleanQuantity(Number(prevItem.quantityAfter || 0)) : null;
      
      const isDeadStock = soldQty <= 0 && currentStock > 0;
      const deadCapital = isDeadStock ? roundMoney(currentStock * costPrice) : 0;

      let stockStatus: 'depleted' | 'critical' | 'healthy' | 'excess' | 'stagnant' = 'healthy';
      if (currentStock <= 0) stockStatus = 'depleted';
      else if (daysUntilStockout <= 5 && dailyVelocity > 0) stockStatus = 'critical';
      else if (isDeadStock) stockStatus = 'stagnant';
      else if (daysUntilStockout > 60 && dailyVelocity > 0) stockStatus = 'excess';

      return {
        name: item.productName,
        barcode: item.barcode || liveGroup?.barcode || '',
        category: item.category || liveGroup?.category || 'عام',
        costPrice,
        sellPrice,
        currentStock,
        liveCurrentStock,
        recordedReportStock,
        estimatedConsumedSinceInventory,
        soldQty,
        dailyVelocity,
        weeklyVelocity,
        piecesPerBox,
        weeklyBoxesVelocity,
        dailyBoxesVelocity,
        daysForOneBox,
        daysUntilStockout,
        revenue,
        profit,
        returnPerDinar,
        isDeadStock,
        deadCapital,
        stockStatus,
        batchCount: liveGroup?.batchCount || 1,
        isSurplus: !!item.isSurplus,
        surplusQuantity: item.surplusQuantity || 0,
        surplusCostValue: item.surplusCostValue || 0,
        prevStock,
        isDeletedFromStore,
        reportSellPrice,
        reportCostPrice,
        liveSellPrice,
        liveCostPrice,
      };
    });
  }, [currentReport, previousReport, elapsedDays, daysSinceLatestInventory, groupedLiveProducts, isLatestReportSelected, products]);

  // Overall Metrics for selected report
  const summaryMetrics = useMemo((): SummaryMetrics => {
    if (!currentReport) {
      return {
        totalRevenue: 0,
        totalProfit: 0,
        totalRemainingValue: 0,
        totalExpenses: 0,
        netProfit: 0,
        totalSoldPieces: 0,
        deadStockCount: 0,
        deadStockCapital: 0,
        criticalStockCount: 0,
        growthRevenuePct: null,
        growthProfitPct: null,
        surplusValue: 0,
        surplusCount: 0,
        damageLoss: 0,
      };
    }

    const totalRevenue = roundMoney(Number(currentReport.totalRevenue || 0));
    const totalProfit = roundMoney(Number(currentReport.totalProfit || 0));
    const totalRemainingValue = roundMoney(Number(currentReport.totalRemainingValue || 0));
    const totalExpenses = roundMoney(Number(currentReport.totalExpenses || 0));
    const netProfit = roundMoney(Number(currentReport.netProfit ?? (totalProfit - totalExpenses)));
    const surplusValue = roundMoney(Number(currentReport.surplusValueUnverified || 0));
    const surplusCount = cleanQuantity(Number(currentReport.surplusItemsCount || 0));
    const damageLoss = roundMoney(Number(currentReport.totalDamageLoss || 0));

    const totalSoldPieces = cleanQuantity(analyzedItems.reduce((acc, it) => acc + (it.soldQty > 0 ? it.soldQty : 0), 0));
    const deadStockItems = analyzedItems.filter(it => it.isDeadStock);
    const deadStockCount = deadStockItems.length;
    const deadStockCapital = roundMoney(deadStockItems.reduce((acc, it) => acc + it.deadCapital, 0));
    const criticalStockCount = analyzedItems.filter(it => it.stockStatus === 'critical').length;

    let growthRevenuePct: number | null = null;
    let growthProfitPct: number | null = null;

    if (previousReport && Number(previousReport.totalRevenue || 0) > 0) {
      const prevRev = roundMoney(Number(previousReport.totalRevenue));
      growthRevenuePct = roundMoney(((totalRevenue - prevRev) / prevRev) * 100);
    }
    if (previousReport && Number(previousReport.totalProfit || 0) > 0) {
      const prevProf = roundMoney(Number(previousReport.totalProfit));
      growthProfitPct = roundMoney(((totalProfit - prevProf) / prevProf) * 100);
    }

    return {
      totalRevenue,
      totalProfit,
      totalRemainingValue,
      totalExpenses,
      netProfit,
      totalSoldPieces,
      deadStockCount,
      deadStockCapital,
      criticalStockCount,
      growthRevenuePct,
      growthProfitPct,
      surplusValue,
      surplusCount,
      damageLoss,
    };
  }, [currentReport, previousReport, analyzedItems]);

  // Comprehensive Store Health & Growth Diagnostic Engine
  const storeHealthDiagnostic = useMemo((): StoreHealthDiagnostic | null => {
    if (!currentReport) return null;

    const curRev = Number(currentReport.totalRevenue || 0);
    const curProfit = Number(currentReport.totalProfit || 0);
    const curNet = Number(currentReport.netProfit ?? (curProfit - Number(currentReport.totalExpenses || 0)));
    const curExpenses = Number(currentReport.totalExpenses || 0);
    const curStock = Number(currentReport.totalRemainingValue || 0);
    const curSurplus = Number(currentReport.surplusValueUnverified || 0);
    const curDamage = Number(currentReport.totalDamageLoss || 0);
    const curShrinkageTotal = curDamage + curSurplus;

    const prevRev = previousReport ? Number(previousReport.totalRevenue || 0) : null;
    const prevProfit = previousReport ? Number(previousReport.totalProfit || 0) : null;
    const prevNet = previousReport ? Number(previousReport.netProfit ?? (prevProfit - Number(previousReport.totalExpenses || 0))) : null;
    const prevExpenses = previousReport ? Number(previousReport.totalExpenses || 0) : null;
    const prevStock = previousReport ? Number(previousReport.totalRemainingValue || 0) : null;

    const revPctChange = prevRev !== null && prevRev > 0 ? ((curRev - prevRev) / prevRev) * 100 : null;
    const profitPctChange = prevProfit !== null && prevProfit > 0 ? ((curProfit - prevProfit) / prevProfit) * 100 : null;
    const netPctChange = prevNet !== null && prevNet > 0 ? ((curNet - prevNet) / prevNet) * 100 : null;
    const stockPctChange = prevStock !== null && prevStock > 0 ? ((curStock - prevStock) / prevStock) * 100 : null;

    const curExpenseRatio = curProfit > 0 ? (curExpenses / curProfit) * 100 : 0;
    const prevExpenseRatio = prevProfit !== null && prevProfit > 0 ? (prevExpenses! / prevProfit) * 100 : null;
    const expenseRatioDiff = prevExpenseRatio !== null ? curExpenseRatio - prevExpenseRatio : null;

    const curShrinkageRatio = curProfit > 0 ? (curShrinkageTotal / curProfit) * 100 : 0;

    let score = 70;
    if (revPctChange !== null) {
      if (revPctChange >= 15) score += 12;
      else if (revPctChange > 0) score += 7;
      else if (revPctChange < -10) score -= 12;
      else score -= 5;
    }
    if (profitPctChange !== null) {
      if (profitPctChange >= 15) score += 12;
      else if (profitPctChange > 0) score += 8;
      else if (profitPctChange < -10) score -= 12;
      else score -= 5;
    }
    if (curExpenseRatio <= 18) score += 8;
    else if (curExpenseRatio > 35) score -= 10;

    if (curShrinkageRatio <= 1.5) score += 5;
    else if (curShrinkageRatio > 5) score -= 10;

    score = Math.min(100, Math.max(35, Math.round(score)));

    let scoreTitle = 'أداء تجاري استثنائي ومسار صاعد 🚀';
    let scoreBadge = 'ممتاز جداً';
    let scoreColor = 'text-emerald-500';
    let scoreBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300';
    let scoreRing = 'border-emerald-500';

    if (score < 55) {
      scoreTitle = 'أداء تشغيلي يحتاج تدخل ومراجعة سريعة 🔴';
      scoreBadge = 'يحتاج انتباه';
      scoreColor = 'text-rose-500';
      scoreBg = 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300';
      scoreRing = 'border-rose-500';
    } else if (score < 75) {
      scoreTitle = 'أداء مستقر ومتوازن مع فرص تحسين واضحة 🟡';
      scoreBadge = 'مستقر وجيد';
      scoreColor = 'text-amber-500';
      scoreBg = 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300';
      scoreRing = 'border-amber-500';
    }

    const indicators = [
      {
        id: 'revenue',
        title: 'مؤشر نمو المبيعات (حركة الإقبال)',
        value: revPctChange !== null ? `${revPctChange >= 0 ? '+' : ''}${revPctChange.toFixed(1)}%` : 'الجرد المرجعي',
        status: (revPctChange === null ? 'neutral' : (revPctChange >= 10 ? 'excellent' : (revPctChange >= 0 ? 'good' : 'bad'))) as any,
        statusLabel: revPctChange === null ? 'أساس أول' : (revPctChange >= 10 ? 'نمو ممتاز 🟢' : (revPctChange >= 0 ? 'نمو إيجابي 🟢' : 'تراجع مبيعات 🔴')),
        details: prevRev !== null
          ? `تطورت مبيعاتك من ${formatCurrency(prevRev, settings.currency, language)} إلى ${formatCurrency(curRev, settings.currency, language)} (${revPctChange! >= 0 ? 'زيادة إيجابية' : 'نقصان'} بمقدار ${formatCurrency(Math.abs(curRev - prevRev), settings.currency, language)})`
          : `إجمالي مبيعات دورة الجرد الحالية بلغت ${formatCurrency(curRev, settings.currency, language)}.`,
        advice: revPctChange !== null && revPctChange < 0 
          ? 'ركز على توفير الأصناف الأساسية الأكثر طلباً لإنعاش وتيرة البيع اليومية.'
          : 'نشاط بيعي قوي ومستقر، حافظ على تدفق السلع دون انقطاع.',
      },
      {
        id: 'netProfit',
        title: 'مؤشر صافي الربح الفعلي (عائد جيبك)',
        value: netPctChange !== null ? `${netPctChange >= 0 ? '+' : ''}${netPctChange.toFixed(1)}%` : 'الجرد المرجعي',
        status: (netPctChange === null ? 'neutral' : (netPctChange >= 10 ? 'excellent' : (netPctChange >= 0 ? 'good' : 'bad'))) as any,
        statusLabel: netPctChange === null ? 'أساس أول' : (netPctChange >= 10 ? 'ربحية صاعدة بقوة 🟢' : (netPctChange >= 0 ? 'ربحية متنامية 🟢' : 'انكماش أرباح 🔴')),
        details: prevNet !== null
          ? `انتقل صافي ربحك من ${formatCurrency(prevNet, settings.currency, language)} إلى ${formatCurrency(curNet, settings.currency, language)} (فارق ${netPctChange! >= 0 ? '+' : ''}${formatCurrency(curNet - prevNet, settings.currency, language)})`
          : `صافي ربح مستخلص بعد خصم المصاريف: ${formatCurrency(curNet, settings.currency, language)}.`,
        advice: netPctChange !== null && netPctChange < 0 
          ? 'راجع هوامش ربح الأصناف الأكثر مبيعاً وتحكم في المصاريف اليومية لتجنب تآكل الأرباح.'
          : 'عائد ربحي سليم يدعم نمو رأس مال متجرك.',
      },
      {
        id: 'expenses',
        title: 'مؤشر كفاءة وضبط المصاريف التشغيلية',
        value: `${curExpenseRatio.toFixed(1)}% من الأرباح`,
        status: (curExpenseRatio <= 20 ? 'excellent' : (curExpenseRatio <= 30 ? 'good' : 'bad')) as any,
        statusLabel: curExpenseRatio <= 20 ? 'كفاءة ممتازة وضبط محكم 🟢' : (curExpenseRatio <= 30 ? 'مقبول وضمن الحدود 🟡' : 'مصاريف مرتفعة تلتهم الربح 🔴'),
        details: expenseRatioDiff !== null
          ? (expenseRatioDiff < 0
              ? `تحسن مشجع: انخفض عبء المصاريف بمقدار ${Math.abs(expenseRatioDiff).toFixed(1)}% مقارنة بالجرد السابق.`
              : `تنبيه: ارتفعت نسبة التهام المصاريف من أرباحك بمقدار +${expenseRatioDiff.toFixed(1)}%.`)
          : `المصاريف التشغيلية بلغت ${formatCurrency(curExpenses, settings.currency, language)} وتستهلك ${curExpenseRatio.toFixed(1)}% من إجمالي أرباحك.`,
        advice: curExpenseRatio > 30 
          ? 'ضع حداً يومياً للمصاريف النثرية وفواتير التشغيل لتفادي التهام السيولة.'
          : 'إدارة ممتازة للمصاريف تضمن بقاء الجزء الأكبر من الأرباح في رصيدك.',
      },
      {
        id: 'stockCapital',
        title: 'مؤشر توازن رأس مال المخزون',
        value: stockPctChange !== null ? `${stockPctChange >= 0 ? '+' : ''}${stockPctChange.toFixed(1)}%` : 'قيمة متزنة',
        status: (stockPctChange === null ? 'good' : (Math.abs(stockPctChange) <= 25 ? 'good' : 'neutral')) as any,
        statusLabel: stockPctChange === null ? 'مخزون أساسي' : (stockPctChange > 30 ? 'تضخم مخزون 🟡' : (stockPctChange < -30 ? 'تراجع مخزون 🟡' : 'توازن صحي 🟢')),
        details: prevStock !== null
          ? `رأس المال المستثمر على الرفوف انتقل من ${formatCurrency(prevStock, settings.currency, language)} إلى ${formatCurrency(curStock, settings.currency, language)}`
          : `رأس المال الحالي المتبقي على الرفوف: ${formatCurrency(curStock, settings.currency, language)}.`,
        advice: stockPctChange !== null && stockPctChange > 30 
          ? 'احذر من تجميد سيولة زائدة في المخزن، ووازن بين المشتريات ومعدل البيع الفعلي.'
          : 'المخزون يدعم وتيرة البيع دون تجميد مفرط للسيولة.',
      },
      {
        id: 'shrinkage',
        title: 'مؤشر سلامة البضائع وانضباط المخزن',
        value: `${curShrinkageRatio.toFixed(1)}% فواقد`,
        status: (curShrinkageRatio <= 1.5 ? 'excellent' : (curShrinkageRatio <= 4 ? 'neutral' : 'bad')) as any,
        statusLabel: curShrinkageRatio <= 1.5 ? 'انضباط ممتاز وأمان عالٍ 🟢' : (curShrinkageRatio <= 4 ? 'فواقد متوسطة 🟡' : 'تنبيه هدر وتوالف 🔴'),
        details: `إجمالي التوالف والفوائض غير المفسرة: ${formatCurrency(curShrinkageTotal, settings.currency, language)} (${curDamage > 0 ? `توالف: ${formatCurrency(curDamage, settings.currency, language)}` : ''}${curSurplus > 0 ? ` | زيادات غير مفسرة: ${formatCurrency(curSurplus, settings.currency, language)}` : ''}).`,
        advice: curShrinkageRatio > 4 
          ? 'راجع طريقة تخزين الأصناف المعرضة للتلف وتأكد من تسجيل فواتير كل بضاعة تدخل المتجر.'
          : 'انضباط مخزني ممتاز يحمي أرباحك من التسرب.',
      }
    ];

    let story = '';
    if (prevRev !== null && revPctChange !== null && netPctChange !== null) {
      if (revPctChange >= 0 && netPctChange >= 0) {
        story = `لقد تطور أداء متجرك بشكل إيجابي ملحوظ؛ حيث زادت مبيعاتك الإجمالية بنسبة (+${revPctChange.toFixed(1)}%)، وتوازت مع نمو في صافي أرباحك بنسبة (+${netPctChange.toFixed(1)}%). هذا مؤشر صحي يبرهن على توسع ثقة الزبائن في متجرك وحسن تسعير السلع. كما أن نسبة المصاريف تشكل (${curExpenseRatio.toFixed(1)}%) من أرباحك. استمر في تعزيز الأصناف سريعة الحركة للحفاظ على هذا المنحنى التصاعدي.`;
      } else if (revPctChange >= 0 && netPctChange < 0) {
        story = `على الرغم من أن مبيعاتك الإجمالية ارتفعت بنسبة (+${revPctChange.toFixed(1)}%)، إلا أن صافي ربحك تراجع بنسبة (${netPctChange.toFixed(1)}%). هذا المؤشر ينبهك إلى أن زيادة المبيعات لم تتحول إلى أرباح كافية، ويرجع ذلك إما لارتفاع المصاريف التشغيلية أو زيادة مبيعات أصناف ذات هوامش ربح منخفضة جداً. يُنصح بمراجعة فواتير التكاليف وهوامش ربح الأصناف الأكثر بيعاً.`;
      } else if (revPctChange < 0 && netPctChange >= 0) {
        story = `حجم مبيعاتك تراجع بنسبة (${revPctChange.toFixed(1)}%)، ولكن صافي أرباحك نما بنسبة (+${netPctChange.toFixed(1)}%). هذا مؤشر ممتاز على الكفاءة التشغيلية وترشيد المصاريف وتفادي الخسائر؛ حيث حققت عائداً أعلى بمبيعات أكثر تركيزاً وربحية.`;
      } else {
        story = `تراجع حجم المبيعات بنسبة (${revPctChange.toFixed(1)}%) وتراجع صافي الأرباح بنسبة (${netPctChange.toFixed(1)}%). هذا المؤشر يتطلب وقفة لمراجعة الأسباب: قد يكون السبب موسمياً، أو تراجعاً في توفير السلع الأساسية للزبائن، أو ارتفاعاً غير مبرر في المصاريف. ننصح بالتركيز على إعادة توفير الأصناف الأساسية وإجراء عروض على البضائع الراكدة.`;
      }
    } else {
      story = `هذه هي عملية الجرد المرجعية الأولى المسجلة في النظام. بناءً على هذا الجرد، يمتلك متجرك قاعدة صلبة بمبيعات بلغت ${formatCurrency(curRev, settings.currency, language)} وصافي أرباح قدره ${formatCurrency(curNet, settings.currency, language)}. سيبدأ النظام فور تسجيل الجرد القادم بمقارنة نسب النمو والتطور التلقائي لكل ركيزة من ركائز متجرك.`;
    }

    return {
      score,
      scoreTitle,
      scoreBadge,
      scoreColor,
      scoreBg,
      scoreRing,
      indicators,
      story,
      curRev,
      prevRev,
      revPctChange,
      curNet,
      prevNet,
      netPctChange,
      curExpenses,
      curStock,
      prevStock,
      stockPctChange
    };
  }, [currentReport, previousReport, settings.currency, language]);

  // Cycle Highlights: Stars and Dead stock for this inventory cycle
  const cycleHighlights = useMemo((): CycleHighlights | null => {
    if (!analyzedItems || analyzedItems.length === 0) return null;

    const sortedByProfit = [...analyzedItems]
      .filter(it => it.profit > 0)
      .sort((a, b) => b.profit - a.profit);
    const starProfitItem = sortedByProfit[0] || null;

    const sortedBySold = [...analyzedItems]
      .filter(it => it.soldQty > 0)
      .sort((a, b) => b.soldQty - a.soldQty);
    const starVelocityItem = sortedBySold[0] || null;

    const sortedByDeadCapital = [...analyzedItems]
      .filter(it => it.isDeadStock && it.currentStock > 0)
      .sort((a, b) => b.deadCapital - a.deadCapital);
    const heaviestDeadStock = sortedByDeadCapital[0] || null;

    return {
      starProfitItem,
      starVelocityItem,
      heaviestDeadStock,
    };
  }, [analyzedItems]);

  // Market Debts & Liquidity stats
  const marketDebtsStats = useMemo((): MarketDebtsStats => {
    if (!debts || debts.length === 0) {
      return {
        unpaidCustomerDebts: 0,
        customerDebtCount: 0,
        unpaidSupplierDebts: 0,
        supplierDebtCount: 0,
      };
    }

    let unpaidCustomerDebts = 0;
    let customerDebtCount = 0;
    let unpaidSupplierDebts = 0;
    let supplierDebtCount = 0;

    debts.forEach((d: any) => {
      const isCustomer = (d.type || 'receivable') === 'receivable';
      const total = Number(d.totalAmount || 0);
      const paid = (d.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const remaining = Math.max(0, total - paid);

      if (remaining > 0) {
        if (isCustomer) {
          unpaidCustomerDebts += remaining;
          customerDebtCount += 1;
        } else {
          unpaidSupplierDebts += remaining;
          supplierDebtCount += 1;
        }
      }
    });

    return {
      unpaidCustomerDebts,
      customerDebtCount,
      unpaidSupplierDebts,
      supplierDebtCount,
    };
  }, [debts]);

  // Macro Strategic Diagnostic across the selected timeframe (3 months, 6 months, or all time)
  const macroStrategicDiagnostic = useMemo((): MacroStrategicDiagnostic | null => {
    if (periodReports.length === 0) return null;

    const count = periodReports.length;
    const latestRep = periodReports[0];
    const earliestRep = periodReports[periodReports.length - 1];

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalExpenses = 0;
    let totalNetProfit = 0;
    let totalShrinkage = 0;
    let peakCycle: any = null;
    let lowestCycle: any = null;

    periodReports.forEach(rep => {
      const rev = Number(rep.totalRevenue || 0);
      const profit = Number(rep.totalProfit || 0);
      const exp = Number(rep.totalExpenses || 0);
      const net = Number(rep.netProfit ?? (profit - exp));
      const shrinkage = Number(rep.totalDamageLoss || 0) + Number(rep.surplusValueUnverified || 0);

      totalRevenue += rev;
      totalProfit += profit;
      totalExpenses += exp;
      totalNetProfit += net;
      totalShrinkage += shrinkage;

      const currentNet = net;
      if (!peakCycle) {
        peakCycle = rep;
      } else {
        const peakNet = Number(peakCycle.netProfit ?? (Number(peakCycle.totalProfit || 0) - Number(peakCycle.totalExpenses || 0)));
        if (currentNet > peakNet) peakCycle = rep;
      }

      if (!lowestCycle) {
        lowestCycle = rep;
      } else {
        const lowNet = Number(lowestCycle.netProfit ?? (Number(lowestCycle.totalProfit || 0) - Number(lowestCycle.totalExpenses || 0)));
        if (currentNet < lowNet) lowestCycle = rep;
      }
    });

    const avgRevenuePerCycle = count > 0 ? totalRevenue / count : 0;
    const avgProfitPerCycle = count > 0 ? totalProfit / count : 0;
    const avgNetPerCycle = count > 0 ? totalNetProfit / count : 0;
    const avgExpensesPerCycle = count > 0 ? totalExpenses / count : 0;

    const startRev = Number(earliestRep.totalRevenue || 0);
    const endRev = Number(latestRep.totalRevenue || 0);
    const revGrowthPct = count > 1 && startRev > 0 ? ((endRev - startRev) / startRev) * 100 : null;

    const startNet = Number(earliestRep.netProfit ?? (Number(earliestRep.totalProfit || 0) - Number(earliestRep.totalExpenses || 0)));
    const endNet = Number(latestRep.netProfit ?? (Number(latestRep.totalProfit || 0) - Number(latestRep.totalExpenses || 0)));
    const netGrowthPct = count > 1 && startNet > 0 ? ((endNet - startNet) / startNet) * 100 : null;

    const startStock = Number(earliestRep.totalRemainingValue || 0);
    const endStock = Number(latestRep.totalRemainingValue || 0);
    const stockGrowthPct = count > 1 && startStock > 0 ? ((endStock - startStock) / startStock) * 100 : null;

    const expenseRatio = totalProfit > 0 ? (totalExpenses / totalProfit) * 100 : 0;

    let avgDaysBetweenAudits = 0;
    if (count > 1) {
      const earliestTime = safeParseDate(earliestRep.date).getTime();
      const latestTime = safeParseDate(latestRep.date).getTime();
      const totalSpanDays = Math.max(1, Math.round(Math.abs(latestTime - earliestTime) / (1000 * 60 * 60 * 24)));
      avgDaysBetweenAudits = Math.round(totalSpanDays / (count - 1));
    }

    let macroScore = 75;
    if (revGrowthPct !== null) {
      if (revGrowthPct >= 20) macroScore += 12;
      else if (revGrowthPct > 0) macroScore += 7;
      else if (revGrowthPct < -15) macroScore -= 12;
      else macroScore -= 5;
    }
    if (netGrowthPct !== null) {
      if (netGrowthPct >= 20) macroScore += 13;
      else if (netGrowthPct > 0) macroScore += 8;
      else if (netGrowthPct < -15) macroScore -= 13;
      else macroScore -= 6;
    }
    if (expenseRatio <= 20) macroScore += 8;
    else if (expenseRatio > 35) macroScore -= 10;
    if (count >= 3 && avgDaysBetweenAudits <= 25) macroScore += 5;

    macroScore = Math.min(100, Math.max(35, Math.round(macroScore)));

    let macroTitle = 'مسار توسعي متصاعد ونمو مستدام 🚀';
    let macroBadge = 'أداء استراتيجي ممتاز';
    let macroColor = 'text-emerald-500';
    let macroBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300';
    let macroRing = 'border-emerald-500';

    if (macroScore < 55) {
      macroTitle = 'مسار مالي غير مستقر يحتاج إعادة ضبط 🔴';
      macroBadge = 'تراجع يتطلب تدخلاً';
      macroColor = 'text-rose-500';
      macroBg = 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300';
      macroRing = 'border-rose-500';
    } else if (macroScore < 75) {
      macroTitle = 'أداء تجاري متزن ومستقر مع إمكانات نمو 🟡';
      macroBadge = 'مسار مستقر وجيد';
      macroColor = 'text-amber-500';
      macroBg = 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300';
      macroRing = 'border-amber-500';
    }

    const periodName = timeHorizon === '3months' ? 'آخر 3 أشهر' : (timeHorizon === '6months' ? 'آخر 6 أشهر' : 'كامل مسار المتجر');
    let story = '';
    if (count > 1 && revGrowthPct !== null && netGrowthPct !== null) {
      if (revGrowthPct >= 0 && netGrowthPct >= 0) {
        story = `خلال نطاق (${periodName})، أجرى متجرك (${count}) عمليات جرد دورية، وحقق إجمالي مبيعات تراكمية قدرها ${formatCurrency(totalRevenue, settings.currency, language)} بصافي أرباح حقيقية بلغت ${formatCurrency(totalNetProfit, settings.currency, language)}. استطاع متجرك رفع مبيعاته الدورية بنسبة (+${revGrowthPct.toFixed(1)}%) ونمت أرباحك الصافية بنسبة (+${netGrowthPct.toFixed(1)}%). هذا يبرهن على أن متجرك يسير في منحنى صاعد مستدام، وتتوسع قاعدته الربحية بثبات.`;
      } else if (revGrowthPct >= 0 && netGrowthPct < 0) {
        story = `خلال نطاق (${periodName})، ارتفع إجمالي نشاط المبيعات بنسبة (+${revGrowthPct.toFixed(1)}%)، ولكن صافي الربح التراكمي تراجع بنسبة (${netGrowthPct.toFixed(1)}%). هذا التباين التاريخي يشير إلى أن التوسع في المبيعات صاحبه ارتفاع في تكلفة التشغيل أو انخفاض في هامش ربح البضائع الموردة. يُنصح بإعادة التفاوض مع الموردين ومراجعة فواتير المصاريف الدورية.`;
      } else if (revGrowthPct < 0 && netGrowthPct >= 0) {
        story = `خلال نطاق (${periodName})، انخفضت المبيعات الإجمالية بنسبة (${Math.abs(revGrowthPct).toFixed(1)}%)، ومع ذلك نما صافي الربح بنسبة (+${netGrowthPct.toFixed(1)}%). يعكس هذا تحولاً استراتيجياً نوعياً نحو سلع أعلى جودة ومردودية ربحية مع ترشيد فعال للمصاريف.`;
      } else {
        story = `خلال نطاق (${periodName}) عبر (${count}) عمليات جرد، شهدت وتيرة المبيعات والأرباح انكماشاً بنسبة (${Math.abs(revGrowthPct).toFixed(1)}% مبيعات، و${Math.abs(netGrowthPct).toFixed(1)}% أرباح). إجمالي ما حققه متجرك في هذه الفترة بلغ ${formatCurrency(totalRevenue, settings.currency, language)}. يتطلب هذا المسار ضخ أصناف جديدة سريعة الحركة ومراجعة تسعير المنافسين.`;
      }
    } else {
      story = `تم تسجيل عملية جرد واحدة فقط في هذا النطاق الزمني (${formatCurrency(totalRevenue, settings.currency, language)} مبيعات و${formatCurrency(totalNetProfit, settings.currency, language)} صافي ربح). بمجرد إضافة عمليات جرد لاحقة، سيقوم النظام تلقائياً برسم منحنى النمو ومقارنة الفصول والشهور.`;
    }

    const indicators = [
      {
        id: 'macroRevenue',
        title: 'مسار نمو المبيعات التاريخي',
        value: revGrowthPct !== null ? `${revGrowthPct >= 0 ? '+' : ''}${revGrowthPct.toFixed(1)}%` : `${count} جرد مسجل`,
        status: (revGrowthPct === null ? 'neutral' : (revGrowthPct >= 15 ? 'excellent' : (revGrowthPct >= 0 ? 'good' : 'bad'))) as any,
        statusLabel: revGrowthPct === null ? 'أساس مرجعي' : (revGrowthPct >= 15 ? 'توسع استثنائي 🟢' : (revGrowthPct >= 0 ? 'نمو إيجابي 🟢' : 'تراجع تراكمي 🔴')),
        details: count > 1
          ? `تطورت المبيعات من ${formatCurrency(startRev, settings.currency, language)} في أول دورة إلى ${formatCurrency(endRev, settings.currency, language)} في آخر دورة (إجمالي مبيعات الفترة: ${formatCurrency(totalRevenue, settings.currency, language)}).`
          : `إجمالي مبيعات الدورة: ${formatCurrency(totalRevenue, settings.currency, language)}.`,
        advice: revGrowthPct !== null && revGrowthPct < 0 
          ? 'جدد تشكيلة السلع وركز على الأصناف الاستهلاكية اليومية لزيادة الإقبال.'
          : 'مسار مبيعات متنامٍ؛ حافظ على استقرار مصادر التوريد لمنع أي انقطاع.',
      },
      {
        id: 'macroNetProfit',
        title: 'تراكم الأرباح الصافية (عائد جيبك الكلي)',
        value: formatCurrency(totalNetProfit, settings.currency, language),
        status: (totalNetProfit > 0 ? (netGrowthPct !== null && netGrowthPct >= 0 ? 'excellent' : 'good') : 'bad') as any,
        statusLabel: totalNetProfit > 0 ? (netGrowthPct !== null && netGrowthPct >= 10 ? 'أرباح متنامية بقوة 🟢' : 'أرباح موجبة مستقرة 🟢') : 'صافي ربح منخفض 🔴',
        details: count > 1
          ? `حقق متجرك صافي أرباح تراكمية ${formatCurrency(totalNetProfit, settings.currency, language)} بمعدل ${formatCurrency(avgNetPerCycle, settings.currency, language)} لكل دورة جرد (تطور بنسبة ${netGrowthPct !== null ? `${netGrowthPct >= 0 ? '+' : ''}${netGrowthPct.toFixed(1)}%` : '—'}).`
          : `صافي ربح الدورة المسجلة: ${formatCurrency(totalNetProfit, settings.currency, language)}.`,
        advice: 'احرص على إعادة استثمار جزء من هذا الصافي في توسيع تنوع المخزون لتوليد عوائد إضافية.',
      },
      {
        id: 'macroStockCapital',
        title: 'تطور رأس مال المخزون (توسع البضائع)',
        value: stockGrowthPct !== null ? `${stockGrowthPct >= 0 ? '+' : ''}${stockGrowthPct.toFixed(1)}%` : formatCurrency(endStock, settings.currency, language),
        status: (stockGrowthPct === null ? 'good' : (stockGrowthPct >= 0 && stockGrowthPct <= 50 ? 'good' : (stockGrowthPct > 50 ? 'neutral' : 'bad'))) as any,
        statusLabel: stockGrowthPct === null ? 'رأس مال حالي' : (stockGrowthPct > 50 ? 'توسع كبير في المخزون 🟡' : (stockGrowthPct >= 0 ? 'نمو استثماري صحي 🟢' : 'انكماش حجم البضاعة 🔴')),
        details: count > 1
          ? `بدأ رأس مال بضائعك على الرفوف بـ ${formatCurrency(startStock, settings.currency, language)} ووصل حالياً إلى ${formatCurrency(endStock, settings.currency, language)}.`
          : `قيمة بضائع الرفوف الحالية: ${formatCurrency(endStock, settings.currency, language)}.`,
        advice: stockGrowthPct !== null && stockGrowthPct < -15
          ? 'المخزون ينكمش؛ احرص على إعادة شراء البضائع الأساسية حتى لا تفقد مبيعات محتملة.'
          : 'حجم المخزون متوازن، تجنب تراكم سلع بطيئة الدوران.',
      },
      {
        id: 'macroExpenses',
        title: 'انضباط المصاريف التشغيلية عبر الفترة',
        value: `${expenseRatio.toFixed(1)}% من الأرباح`,
        status: (expenseRatio <= 20 ? 'excellent' : (expenseRatio <= 32 ? 'good' : 'bad')) as any,
        statusLabel: expenseRatio <= 20 ? 'ضبط ممتاز للمصاريف 🟢' : (expenseRatio <= 32 ? 'مقبول وضمن النطاق 🟡' : 'مصاريف مرتفعة تستنزف الربح 🔴'),
        details: `إجمالي ما أُنفق على التشغيل في هذه الفترة: ${formatCurrency(totalExpenses, settings.currency, language)} بمعدل ${formatCurrency(avgExpensesPerCycle, settings.currency, language)} لكل جرد.`,
        advice: expenseRatio > 32 
          ? 'المصاريف التشغيلية تقتطع أكثر من ثلث أرباحك التراكمية، يُنصح بوضع سقف محدد للفواتير والمصروفات اليومية.'
          : 'تحكم سليم في المصاريف يضمن بقاء الجزء الأكبر من المكاسب كأرباح صافية.',
      },
      {
        id: 'macroDiscipline',
        title: 'انتظام وتيرة الجرد الدوري (دقة المتابعة)',
        value: count > 1 ? `كل ${avgDaysBetweenAudits} يوماً` : `${count} جرد`,
        status: (count > 1 && avgDaysBetweenAudits <= 25 ? 'excellent' : (count > 1 && avgDaysBetweenAudits <= 45 ? 'good' : 'neutral')) as any,
        statusLabel: count > 1 && avgDaysBetweenAudits <= 25 ? 'انضباط جرد عالي ومثالي 🟢' : (count > 1 && avgDaysBetweenAudits <= 45 ? 'انتظام معتدل 🟡' : 'تباعد في فترات الجرد 🔴'),
        details: count > 1
          ? `معدل الفاصل الزمني بين كل جرد وآخر هو ${avgDaysBetweenAudits} يوماً عبر ${count} دورات جردية مسجلة.`
          : 'سجل جروداً دورية منتظمة (كل أسبوعين أو شهر) للحفاظ على دقة الأرقام.',
        advice: count > 1 && avgDaysBetweenAudits > 35
          ? 'التباعد الطويل بين الجرود يزيد من صعوبة تتبع الفواقد والتوالف، احرص على تقريب فترات الجرد.'
          : 'انتظام ممتاز في الجرد يحمي متجرك من أي تسرب في السيولة أو البضائع.',
      }
    ];

    return {
      count,
      periodName,
      macroScore,
      macroTitle,
      macroBadge,
      macroColor,
      macroBg,
      macroRing,
      story,
      totalRevenue,
      totalProfit,
      totalExpenses,
      totalNetProfit,
      totalShrinkage,
      avgRevenuePerCycle,
      avgProfitPerCycle,
      avgNetPerCycle,
      avgExpensesPerCycle,
      startRev,
      endRev,
      revGrowthPct,
      startNet,
      endNet,
      netGrowthPct,
      startStock,
      endStock,
      stockGrowthPct,
      expenseRatio,
      avgDaysBetweenAudits,
      peakCycle,
      lowestCycle,
      indicators,
      reports: periodReports
    };
  }, [periodReports, timeHorizon, settings.currency, language]);

  // Fast-Moving Products (Top 10 highest velocity / sales)
  const topMovingItems = useMemo(() => {
    return [...analyzedItems]
      .filter(it => it.soldQty > 0)
      .sort((a, b) => b.soldQty - a.soldQty)
      .slice(0, 10);
  }, [analyzedItems]);

  // Dead / Stagnant Stock Items (Highest frozen capital)
  const stagnantItems = useMemo(() => {
    return [...analyzedItems]
      .filter(it => it.isDeadStock && it.currentStock > 0)
      .sort((a, b) => b.deadCapital - a.deadCapital);
  }, [analyzedItems]);

  // Products with runway / replenishment analysis sorted by urgency
  const replenishmentItems = useMemo(() => {
    return [...analyzedItems]
      .filter(it => (!isLatestReportSelected || !it.isDeletedFromStore) && (it.dailyVelocity > 0 || it.currentStock === 0))
      .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
  }, [analyzedItems, isLatestReportSelected]);

  // Urgent subset (<= 7 days or depleted)
  const urgentReplenishItems = useMemo(() => {
    return replenishmentItems.filter(it => it.daysUntilStockout <= 7 || it.currentStock === 0);
  }, [replenishmentItems]);

  // Items to display in the stock runway table according to search query, urgentFilter and itemsPerPage
  const displayReplenishmentItems = useMemo(() => {
    let list = replenishmentItems;
    
    if (replenishmentSearch.trim()) {
      const q = replenishmentSearch.trim().toLowerCase();
      list = list.filter(it => 
        (it.name && it.name.toLowerCase().includes(q)) ||
        (it.barcode && it.barcode.toLowerCase().includes(q)) ||
        (it.category && it.category.toLowerCase().includes(q))
      );
    }

    if (urgentFilter === 'critical') {
      list = list.filter(it => it.daysUntilStockout <= 5 || it.currentStock === 0);
    } else if (urgentFilter === 'warning') {
      list = list.filter(it => it.daysUntilStockout > 5 && it.daysUntilStockout <= 15);
    }
    if (itemsPerPage === -1) return list;
    return list.slice(0, itemsPerPage);
  }, [replenishmentItems, replenishmentSearch, urgentFilter, itemsPerPage]);

  // Category Breakdown Metrics
  const categoryBreakdown = useMemo((): CategoryBreakdownItem[] => {
    const map = new Map<string, {
      category: string;
      itemCount: number;
      revenue: number;
      profit: number;
      remainingValue: number;
      cogs: number;
    }>();

    analyzedItems.forEach(item => {
      const cat = (item.category || 'عام').trim();
      const existing = map.get(cat) || {
        category: cat,
        itemCount: 0,
        revenue: 0,
        profit: 0,
        remainingValue: 0,
        cogs: 0,
      };

      existing.itemCount += 1;
      existing.revenue = roundMoney(existing.revenue + Number(item.revenue || 0));
      existing.profit = roundMoney(existing.profit + Number(item.profit || 0));
      existing.remainingValue = roundMoney(existing.remainingValue + (Number(item.currentStock || 0) * Number(item.costPrice || 0)));
      const itemCogs = roundMoney(Number(item.soldQty || 0) * Number(item.costPrice || 0));
      existing.cogs = roundMoney(existing.cogs + itemCogs);

      map.set(cat, existing);
    });

    const totalRev = summaryMetrics.totalRevenue || 1;
    const totalProf = summaryMetrics.totalProfit || 1;

    return Array.from(map.values()).map(c => {
      const revPct = summaryMetrics.totalRevenue > 0 ? roundMoney((c.revenue / totalRev) * 100) : 0;
      const profPct = summaryMetrics.totalProfit > 0 ? roundMoney((c.profit / totalProf) * 100) : 0;
      const profitMargin = c.revenue > 0 ? roundMoney((c.profit / c.revenue) * 100) : 0;
      const returnOnDinar = c.cogs > 0 ? roundMoney(c.revenue / c.cogs) : (c.profit > 0 ? roundMoney(1 + (c.profit / (c.revenue - c.profit))) : 1);

      return {
        ...c,
        revPct,
        profPct,
        profitMargin,
        returnOnDinar,
      };
    }).sort((a, b) => b.profit - a.profit);
  }, [analyzedItems, summaryMetrics]);

  // Top Return-on-Dinar products
  const topRoiProducts = useMemo(() => {
    return [...analyzedItems]
      .filter(it => it.soldQty > 0 && it.costPrice > 0)
      .sort((a, b) => b.returnPerDinar - a.returnPerDinar)
      .slice(0, 5);
  }, [analyzedItems]);

  // Pareto 80/20 Golden Profit Drivers analysis
  const paretoProfitAnalysis = useMemo((): ParetoAnalysis => {
    const profitItems = [...analyzedItems]
      .filter(it => it.profit > 0)
      .sort((a, b) => b.profit - a.profit);

    const totalStoreProfit = profitItems.reduce((acc, it) => acc + it.profit, 0);
    if (totalStoreProfit <= 0 || profitItems.length === 0) {
      return {
        topItems: [],
        topItemsCount: 0,
        totalItemsCount: analyzedItems.length,
        topItemsProfit: 0,
        totalStoreProfit: 0,
        profitSharePct: 0,
        itemsSharePct: 0,
      };
    }

    let cumulative = 0;
    const targetThreshold = totalStoreProfit * 0.70;
    const topGoldenItems: AnalyzedItem[] = [];

    for (const item of profitItems) {
      topGoldenItems.push(item);
      cumulative += item.profit;
      if (cumulative >= targetThreshold || topGoldenItems.length >= 30) {
        break;
      }
    }

    const topItemsProfit = roundMoney(cumulative);
    const profitSharePct = Math.round((topItemsProfit / totalStoreProfit) * 100);
    const itemsSharePct = Math.max(1, Math.round((topGoldenItems.length / Math.max(1, analyzedItems.length)) * 100));

    return {
      topItems: topGoldenItems,
      topItemsCount: topGoldenItems.length,
      totalItemsCount: analyzedItems.length,
      topItemsProfit,
      totalStoreProfit: roundMoney(totalStoreProfit),
      profitSharePct,
      itemsSharePct,
    };
  }, [analyzedItems]);

  // Margin Squeeze Alert & Cost Inflation Analysis
  const marginSqueezeAnalysis = useMemo((): MarginSqueezeAnalysis => {
    const squeezedItems: MarginSqueezeItem[] = [];

    const hikesMap = new Map<string, { previousPrice: number; currentPrice: number; date: any }>();
    (purchases || []).forEach((p: any) => {
      if (!p) return;
      const prev = Number(p.previousPrice || 0);
      const curr = Number(p.price || 0);
      if (prev > 0 && curr > prev) {
        const keys = [
          p.productId !== undefined && p.productId !== null ? String(p.productId).trim().toLowerCase() : '',
          p.barcode !== undefined && p.barcode !== null ? String(p.barcode).trim().toLowerCase() : '',
          p.productName !== undefined && p.productName !== null ? String(p.productName).trim().toLowerCase() : '',
        ].filter(Boolean);

        keys.forEach(k => {
          const existing = hikesMap.get(k);
          if (!existing || safeParseDate(p.date).getTime() > safeParseDate(existing.date).getTime()) {
            hikesMap.set(k, { previousPrice: prev, currentPrice: curr, date: p.date });
          }
        });
      }
    });

    analyzedItems.forEach(it => {
      if (it.isDeletedFromStore) return;
      if (it.liveCurrentStock <= 0 && it.currentStock <= 0) return;

      const bKey = it.barcode !== undefined && it.barcode !== null ? String(it.barcode).trim().toLowerCase() : '';
      const nKey = it.name !== undefined && it.name !== null ? String(it.name).trim().toLowerCase() : '';
      const hike = (bKey ? hikesMap.get(bKey) : null) || (nKey ? hikesMap.get(nKey) : null);
      const cost = roundMoney(it.costPrice);
      const sell = roundMoney(it.sellPrice);
      if (cost <= 0 || sell <= 0) return;

      const availableShelfStock = it.liveCurrentStock > 0 ? it.liveCurrentStock : it.currentStock;

      if (sell <= cost) {
        const costDiff = roundMoney(cost - sell);
        const suggested = roundMoney(cost * 1.08);
        const unitsCount = Math.max(1, availableShelfStock);
        const estLoss = roundMoney(unitsCount * Math.max(0.01, suggested - sell));

        squeezedItems.push({
          name: it.name,
          barcode: it.barcode,
          category: it.category,
          previousCost: cost,
          currentCost: cost,
          costDiff,
          sellingPrice: sell,
          currentMarginPct: 0,
          previousMarginPct: 8,
          marginLostPct: 8,
          suggestedSellingPrice: suggested,
          unitsSoldOrStock: unitsCount,
          estimatedLoss: estLoss,
          reason: 'negative_margin',
        });
        return;
      }

      if (hike && hike.currentPrice > hike.previousPrice) {
        const oldCost = roundMoney(hike.previousPrice);
        const newCost = roundMoney(hike.currentPrice);
        const costDiff = roundMoney(newCost - oldCost);

        if (cost < newCost) {
          return;
        }

        if (costDiff > 0.005) {
          const baseSellingPrice = it.reportSellPrice > 0 ? it.reportSellPrice : sell;
          const requiredSellingPrice = roundMoney(baseSellingPrice + costDiff);

          if (sell >= requiredSellingPrice) {
            return;
          }

          const unrecoveredPerUnit = roundMoney(requiredSellingPrice - sell);
          if (unrecoveredPerUnit > 0.005) {
            const currentMargin = ((sell - cost) / sell) * 100;
            const oldMargin = ((baseSellingPrice - oldCost) / baseSellingPrice) * 100;
            const marginLost = Number(Math.max(0, oldMargin - currentMargin).toFixed(1));
            const unitsCount = Math.max(1, availableShelfStock);
            const estLoss = roundMoney(unitsCount * unrecoveredPerUnit);

            squeezedItems.push({
              name: it.name,
              barcode: it.barcode,
              category: it.category,
              previousCost: oldCost,
              currentCost: cost,
              costDiff,
              sellingPrice: sell,
              currentMarginPct: Number(currentMargin.toFixed(1)),
              previousMarginPct: Number((currentMargin + marginLost).toFixed(1)),
              marginLostPct: marginLost,
              suggestedSellingPrice: requiredSellingPrice,
              unitsSoldOrStock: unitsCount,
              estimatedLoss: estLoss,
              reason: 'supplier_hike',
            });
          }
        }
      }
    });

    squeezedItems.sort((a, b) => b.estimatedLoss - a.estimatedLoss);
    const totalEstimatedLoss = roundMoney(squeezedItems.reduce((acc, it) => acc + it.estimatedLoss, 0));
    return {
      items: squeezedItems,
      count: squeezedItems.length,
      totalEstimatedLoss,
    };
  }, [analyzedItems, purchases]);

  // Map suppliers by ID and Name for instant lookup
  const suppliersMap = useMemo(() => {
    const map = new Map<string, any>();
    (suppliers || []).forEach(s => {
      if (s.id) map.set(s.id, s);
      if (s.name) map.set(s.name.trim().toLowerCase(), s);
    });
    return map;
  }, [suppliers]);

  // Group purchases by Day & Invoices
  const dailyPurchases = useMemo((): DayPurchasesGroup[] => {
    const groups: Record<string, DayPurchasesGroup> = {};
    const records = (purchases && purchases.length > 0) ? purchases : (supplierTransactions || []);
    
    records.forEach((p: any, pIdx: number) => {
      const date = safeParseDate(p.date || p.createdAt);
      const dateKey = date.toLocaleDateString('en-GB');
      
      const supplierObj = p.supplierId ? suppliersMap.get(p.supplierId) : (p.supplierName ? suppliersMap.get(p.supplierName.trim().toLowerCase()) : null);
      const supplierName = supplierObj?.name || p.supplierName || 'مورد غير مسجل';
      const supplierId = p.supplierId || supplierObj?.id || '';
      const category = (supplierObj?.typeOfGoods || p.category || 'عام / غير محدد').trim();

      const qty = cleanQuantity(p.qtyAdded ?? p.quantity ?? 1);
      const price = roundMoney(Number(p.price ?? p.purchasePrice ?? p.costPrice ?? 0));
      const amount = roundMoney(Number(p.amount !== undefined ? p.amount : (qty * price)));

      const rawInvNum = p.invoiceNumber || p.invoiceNo || p.billNumber || '';
      const hasExplicitInv = Boolean(rawInvNum && String(rawInvNum).trim());
      const cleanInvNum = hasExplicitInv ? String(rawInvNum).trim() : '';

      const invSession = p.supplierSessionId || p.sessionId || p.cycleId || '';
      const supplierKey = (supplierId || supplierName).trim().toLowerCase();
      
      const invoiceKey = hasExplicitInv 
        ? `${dateKey}_inv_${supplierKey}_${cleanInvNum}`
        : (invSession ? `${dateKey}_sess_${supplierKey}_${invSession}` : `${dateKey}_sup_${supplierKey}`);

      if (!groups[dateKey]) {
        groups[dateKey] = { 
          key: dateKey,
          date, 
          total: 0, 
          totalPieces: 0,
          totalItems: 0,
          invoicesCount: 0,
          invoices: [],
          categoriesBreakdown: {},
          suppliersBreakdown: {}
        };
      }
      
      const day = groups[dateKey];
      day.total = roundMoney(day.total + amount);
      day.totalPieces = cleanQuantity(day.totalPieces + qty);
      day.totalItems += 1;

      if (!day.categoriesBreakdown[category]) {
        day.categoriesBreakdown[category] = { total: 0, count: 0, pieces: 0 };
      }
      day.categoriesBreakdown[category].total = roundMoney(day.categoriesBreakdown[category].total + amount);
      day.categoriesBreakdown[category].count += 1;
      day.categoriesBreakdown[category].pieces = cleanQuantity(day.categoriesBreakdown[category].pieces + qty);

      if (!day.suppliersBreakdown[supplierName]) {
        day.suppliersBreakdown[supplierName] = { total: 0, count: 0, pieces: 0, invoicesCount: 0 };
      }
      day.suppliersBreakdown[supplierName].total = roundMoney(day.suppliersBreakdown[supplierName].total + amount);
      day.suppliersBreakdown[supplierName].count += 1;
      day.suppliersBreakdown[supplierName].pieces = cleanQuantity(day.suppliersBreakdown[supplierName].pieces + qty);

      let invoice = day.invoices.find(inv => inv.id === invoiceKey);
      if (!invoice) {
        invoice = {
          id: invoiceKey,
          invoiceNumber: cleanInvNum,
          hasExplicitInvoiceNumber: hasExplicitInv,
          supplierId,
          supplierName,
          category,
          totalAmount: 0,
          totalPieces: 0,
          itemsCount: 0,
          items: [],
          date
        };
        day.invoices.push(invoice);
        day.suppliersBreakdown[supplierName].invoicesCount += 1;
      }

      invoice.totalAmount = roundMoney(invoice.totalAmount + amount);
      invoice.totalPieces = cleanQuantity(invoice.totalPieces + qty);
      invoice.itemsCount += 1;
      invoice.items.push({
        id: p.id || `${invoiceKey}_it_${pIdx}`,
        name: p.productName || p.name || 'صنف توريد',
        barcode: p.barcode || '',
        qtyAdded: qty,
        price,
        amount,
        numBoxes: p.numBoxes,
        boxPrice: p.boxPrice,
        piecesPerBox: p.piecesPerBox,
        note: p.note || ''
      });
    });

    Object.values(groups).forEach(day => {
      day.invoicesCount = day.invoices.length;
      day.invoices.sort((a, b) => b.totalAmount - a.totalAmount);
    });

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [purchases, supplierTransactions, suppliersMap]);

  // Supplier Performance Analysis
  const supplierPerformanceData = useMemo((): SupplierPerformanceData => {
    const regSuppliersMap = new Map<string, any>();
    (suppliers || []).forEach(sup => {
      if (sup.id) regSuppliersMap.set(sup.id, sup);
      if (sup.name) regSuppliersMap.set(sup.name.trim().toLowerCase(), sup);
    });

    const supplierRecentDates = new Map<string, Date>();
    (supplierTransactions || []).forEach((tx: any) => {
      const d = safeParseDate(tx.date || tx.createdAt);
      const t = d.getTime();
      if (!isNaN(t) && t > 0) {
        const key = tx.supplierId || tx.supplierName;
        if (key) {
          const curr = supplierRecentDates.get(key);
          if (!curr || t > curr.getTime()) {
            supplierRecentDates.set(key, d);
          }
        }
      }
    });

    (purchases || []).forEach((p: any) => {
      const d = safeParseDate(p.date || p.createdAt);
      const t = d.getTime();
      if (!isNaN(t) && t > 0) {
        const key = p.supplierId || p.supplierName;
        if (key) {
          const curr = supplierRecentDates.get(key);
          if (!curr || t > curr.getTime()) {
            supplierRecentDates.set(key, d);
          }
        }
      }
    });

    const purchasesByProductId = new Map<string, any[]>();
    const purchasesByProductName = new Map<string, any[]>();

    (purchases || []).forEach((p: any) => {
      const pDate = safeParseDate(p.date || p.createdAt).getTime();
      const pRecord = { ...p, timestamp: isNaN(pDate) ? 0 : pDate };

      if (p.productId) {
        if (!purchasesByProductId.has(p.productId)) purchasesByProductId.set(p.productId, []);
        purchasesByProductId.get(p.productId)!.push(pRecord);
      }
      if (p.productName) {
        const nameKey = p.productName.trim().toLowerCase();
        if (!purchasesByProductName.has(nameKey)) purchasesByProductName.set(nameKey, []);
        purchasesByProductName.get(nameKey)!.push(pRecord);
      }
    });

    purchasesByProductId.forEach(list => list.sort((a, b) => b.timestamp - a.timestamp));
    purchasesByProductName.forEach(list => list.sort((a, b) => b.timestamp - a.timestamp));

    interface SupplierStatInternal {
      supplierId: string;
      supplierName: string;
      phone: string;
      typeOfGoods: string;
      recentTxDate: Date | null;
      itemsMap: Map<string, SupplierPerformanceItem>;
    }

    const statsMap = new Map<string, SupplierStatInternal>();

    const getOrCreateSupplier = (id: string, name: string): SupplierStatInternal => {
      const cleanId = id || '';
      const cleanName = name || 'مورد غير مسجل';
      const key = cleanId || cleanName.toLowerCase();

      let entry = statsMap.get(key);
      if (!entry) {
        const reg = (cleanId ? regSuppliersMap.get(cleanId) : null) || 
                    regSuppliersMap.get(cleanName.toLowerCase());
        
        const finalName = reg?.name || cleanName;
        const phone = reg?.phone || '';
        const typeOfGoods = reg?.typeOfGoods || 'عام / بضائع متنوعة';
        const recentDate = supplierRecentDates.get(cleanId) || 
                           supplierRecentDates.get(cleanName) || 
                           (reg?.id ? supplierRecentDates.get(reg.id) : null) || null;

        entry = {
          supplierId: reg?.id || cleanId,
          supplierName: finalName,
          phone,
          typeOfGoods,
          recentTxDate: recentDate,
          itemsMap: new Map(),
        };
        statsMap.set(key, entry);
      }
      return entry;
    };

    (suppliers || []).forEach(s => {
      getOrCreateSupplier(s.id || '', s.name || '');
    });

    let grandStockCost = 0;
    let grandStockProfit = 0;
    let grandStockPieces = 0;

    (products || []).forEach((prod: any) => {
      const liveQty = Math.max(0, cleanQuantity(prod.quantity || 0));
      if (liveQty <= 0) return;

      const cost = roundMoney(prod.purchasePrice || prod.costPrice || 0);
      const sell = roundMoney(prod.sellingPrice || 0);
      const unitProfit = roundMoney(Math.max(0, sell - cost));
      const marginPct = sell > 0 ? Number(((sell - cost) / sell * 100).toFixed(1)) : 0;
      const barcode = prod.barcode || prod.barcode2 || '';
      const category = prod.category || 'عام';
      const prodName = prod.name || 'صنف بدون اسم';
      const prodId = prod.id || '';

      grandStockCost = roundMoney(grandStockCost + (cost * liveQty));
      grandStockProfit = roundMoney(grandStockProfit + (unitProfit * liveQty));
      grandStockPieces = cleanQuantity(grandStockPieces + liveQty);

      const addItemToSupplier = (supId: string, supName: string, allocatedQty: number) => {
        const cleanAlloc = cleanQuantity(allocatedQty);
        if (cleanAlloc <= 0) return;
        const supplierEntry = getOrCreateSupplier(supId, supName);
        const itemKey = prodId || prodName;

        const existing = supplierEntry.itemsMap.get(itemKey);
        if (existing) {
          existing.currentStockQty = cleanQuantity(existing.currentStockQty + cleanAlloc);
          existing.currentStockCost = roundMoney(existing.currentStockCost + (cost * cleanAlloc));
          existing.currentStockProfit = roundMoney(existing.currentStockProfit + (unitProfit * cleanAlloc));
        } else {
          supplierEntry.itemsMap.set(itemKey, {
            productId: prodId,
            name: prodName,
            barcode,
            category,
            costPrice: cost,
            sellPrice: sell,
            unitProfit,
            marginPct,
            currentStockQty: cleanAlloc,
            currentStockCost: roundMoney(cost * cleanAlloc),
            currentStockProfit: roundMoney(unitProfit * cleanAlloc),
          });
        }
      };

      const prodPurchases = (prodId ? purchasesByProductId.get(prodId) : null) || 
                            purchasesByProductName.get(prodName.trim().toLowerCase()) || [];

      const validPurchases = prodPurchases.filter(p => p.supplierId || p.supplierName);

      if (validPurchases.length > 0) {
        let remainingQty = cleanQuantity(liveQty);
        for (const p of validPurchases) {
          if (remainingQty <= 0.0001) break;
          const pQty = cleanQuantity(p.qtyAdded || p.quantity || 0);
          const chunk = pQty > 0 ? Math.min(remainingQty, pQty) : remainingQty;
          const cleanChunk = cleanQuantity(chunk);
          if (cleanChunk > 0) {
            addItemToSupplier(p.supplierId || '', p.supplierName || '', cleanChunk);
            remainingQty = cleanQuantity(remainingQty - cleanChunk);
          }
        }

        if (remainingQty > 0.0001) {
          const fallbackSupId = prod.supplierId || validPurchases[0].supplierId || '';
          const fallbackSupName = prod.supplierName || validPurchases[0].supplierName || 'أصناف بدون مورد مسجل';
          addItemToSupplier(fallbackSupId, fallbackSupName, remainingQty);
        }
      } else if (prod.supplierId || prod.supplierName) {
        addItemToSupplier(prod.supplierId || '', prod.supplierName || '', liveQty);
      } else {
        addItemToSupplier('__unassigned__', 'أصناف بدون مورد مسجل', liveQty);
      }
    });

    const calculatedSuppliers: CalculatedSupplier[] = Array.from(statsMap.values()).map(sup => {
      const itemsList = Array.from(sup.itemsMap.values()).sort((a, b) => b.currentStockProfit - a.currentStockProfit);
      const currentStockCost = roundMoney(itemsList.reduce((acc, it) => acc + it.currentStockCost, 0));
      const currentStockProfit = roundMoney(itemsList.reduce((acc, it) => acc + it.currentStockProfit, 0));
      const currentStockPieces = cleanQuantity(itemsList.reduce((acc, it) => acc + it.currentStockQty, 0));
      const currentStockItemsCount = itemsList.length;

      const totalVal = currentStockCost + currentStockProfit;
      const avgMargin = totalVal > 0 ? Number(((currentStockProfit / totalVal) * 100).toFixed(1)) : 0;

      return {
        supplierId: sup.supplierId,
        supplierName: sup.supplierName,
        phone: sup.phone,
        typeOfGoods: sup.typeOfGoods,
        recentTxDate: sup.recentTxDate,
        currentStockCost,
        currentStockProfit,
        currentStockPieces,
        currentStockItemsCount,
        avgMargin,
        items: itemsList,
        isUnassigned: sup.supplierId === '__unassigned__',
      };
    });

    const suppliersWithStock = calculatedSuppliers.filter(s => s.currentStockPieces > 0);

    const grandStockMargin = (grandStockCost + grandStockProfit) > 0
      ? Number(((grandStockProfit / (grandStockCost + grandStockProfit)) * 100).toFixed(1))
      : 0;

    const sortedByProfit = [...suppliersWithStock].sort((a, b) => b.currentStockProfit - a.currentStockProfit);
    const topProfitSupplier = sortedByProfit.length > 0 && sortedByProfit[0].currentStockProfit > 0 ? sortedByProfit[0] : null;

    const sortedByCost = [...suppliersWithStock].sort((a, b) => b.currentStockCost - a.currentStockCost);
    const topCostSupplier = sortedByCost.length > 0 && sortedByCost[0].currentStockCost > 0 ? sortedByCost[0] : null;

    const sortedByPieces = [...suppliersWithStock].sort((a, b) => b.currentStockPieces - a.currentStockPieces);
    const topPiecesSupplier = sortedByPieces.length > 0 ? sortedByPieces[0] : null;

    const sortedByMargin = [...suppliersWithStock].filter(s => s.currentStockCost >= 50).sort((a, b) => b.avgMargin - a.avgMargin);
    const topMarginSupplier = sortedByMargin.length > 0 ? sortedByMargin[0] : (suppliersWithStock[0] || null);

    return {
      suppliers: suppliersWithStock,
      allSuppliersCount: calculatedSuppliers.length,
      suppliersWithStockCount: suppliersWithStock.filter(s => !s.isUnassigned).length,
      grandCurrentStockCost: grandStockCost,
      grandCurrentStockProfit: grandStockProfit,
      grandCurrentStockPieces: grandStockPieces,
      grandCurrentStockMargin: grandStockMargin,
      topProfitSupplier,
      topCostSupplier,
      topVolumeSupplier: topCostSupplier,
      topPiecesSupplier,
      topMarginSupplier,
      totalSuppliersCount: suppliersWithStock.length,
    };
  }, [suppliers, purchases, supplierTransactions, products]);

  // Multi-Inventory Trend Chart Data
  const multiInventoryTrends = useMemo((): MultiInventoryTrendItem[] => {
    const list = timeHorizon === 'cycle' ? sortedReports : periodReports;
    return [...list].reverse().map((rep, idx) => {
      const repDate = safeParseDate(rep.date);
      const label = formatAppDate(repDate, 'ar', t, { day: 'numeric', month: 'short' });
      const fullDate = formatAppDate(repDate, 'ar', t, { day: 'numeric', month: 'short', year: 'numeric' });
      const net = Number(rep.netProfit ?? (Number(rep.totalProfit || 0) - Number(rep.totalExpenses || 0)));
      return {
        id: rep.id || idx,
        name: `جرد ${idx + 1} (${label})`,
        shortName: `جرد ${idx + 1}`,
        fullDate,
        revenue: Number((rep.totalRevenue || 0).toFixed(3)),
        profit: Number((rep.totalProfit || 0).toFixed(3)),
        netProfit: Number(net.toFixed(3)),
        stockValue: Number((rep.totalRemainingValue || 0).toFixed(3)),
        expenses: Number((rep.totalExpenses || 0).toFixed(3)),
        isPeak: macroStrategicDiagnostic?.peakCycle?.id === rep.id
      };
    });
  }, [sortedReports, periodReports, timeHorizon, macroStrategicDiagnostic, t]);

  // Filtered items for list view
  const displayItems = useMemo(() => {
    if (!filterQuery) return analyzedItems;
    const q = filterQuery.toLowerCase().trim();
    return analyzedItems.filter(it => 
      it.name.toLowerCase().includes(q) || 
      it.barcode.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q)
    );
  }, [analyzedItems, filterQuery]);

  return {
    sortedReports,
    periodReports,
    isLatestReportSelected,
    currentReport,
    previousReport,
    elapsedDays,
    daysSinceLatestInventory,
    groupedLiveProducts,
    analyzedItems,
    summaryMetrics,
    storeHealthDiagnostic,
    cycleHighlights,
    marketDebtsStats,
    macroStrategicDiagnostic,
    topMovingItems,
    stagnantItems,
    replenishmentItems,
    urgentReplenishItems,
    displayReplenishmentItems,
    categoryBreakdown,
    topRoiProducts,
    paretoProfitAnalysis,
    marginSqueezeAnalysis,
    suppliersMap,
    dailyPurchases,
    supplierPerformanceData,
    multiInventoryTrends,
    displayItems,
  };
}

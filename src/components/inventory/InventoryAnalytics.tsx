import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, 
  Hourglass, ShieldAlert, Sparkles, ArrowRight,
  Package, Calendar, CheckCircle2, ChevronDown, 
  Zap, DollarSign, Layers, Clock, RefreshCw, AlertCircle,
  Search, X, PieChart as PieChartIcon, Award, ArrowUpRight, History, Truck, ChevronUp,
  Target, Compass, Activity, ThumbsUp, ThumbsDown,
  Wallet, Users, Flame
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart as RechartsBar, 
  Bar, Cell, PieChart, Pie 
} from 'recharts';
import { formatCurrency, safeParseDate, formatAppDate } from '../../lib/utils';
import { UserSettings } from '../../types';

interface InventoryAnalyticsProps {
  inventoryReports: any[];
  products: any[];
  purchases: any[];
  suppliers?: any[];
  debts?: any[];
  settings: UserSettings;
}

export const InventoryAnalytics: React.FC<InventoryAnalyticsProps> = ({
  inventoryReports,
  products,
  purchases,
  suppliers = [],
  debts = [],
  settings
}) => {
  const { t } = useTranslation();
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  // Selected report index (0 = latest report)
  const [selectedReportIndex, setSelectedReportIndex] = useState<number>(0);
  const [subTab, setSubTab] = useState<'diagnostic' | 'overview' | 'categories' | 'velocity' | 'purchases' | 'shrinkage' | 'trends'>('diagnostic');
  const [filterQuery, setFilterQuery] = useState('');
  const [replenishmentSearch, setReplenishmentSearch] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const [urgentFilter, setUrgentFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);

  // Sort reports chronologically descending (0 is latest)
  const sortedReports = useMemo(() => {
    return [...inventoryReports].sort((a, b) => {
      const timeA = safeParseDate(a.date).getTime();
      const timeB = safeParseDate(b.date).getTime();
      return timeB - timeA;
    });
  }, [inventoryReports]);

  // Current selected report and previous report (for delta comparison)
  const isLatestReportSelected = selectedReportIndex === 0;
  const currentReport = sortedReports[selectedReportIndex] || null;
  const previousReport = sortedReports[selectedReportIndex + 1] || null;

  // Calculate elapsed days between current report and previous report (or fallback to 30 days)
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
    // We map by both barcode (if exists) and name so lookups succeed regardless of whether barcode exists
    const nameMap = new Map<string, {
      totalQuantity: number;
      category: string;
      latestCostPrice: number;
      sellingPrice: number;
      barcode: string;
      name: string;
      batchCount: number;
    }>();

    const barcodeMap = new Map<string, any>();

    products.forEach(p => {
      const nameKey = (p.name || '').trim().toLowerCase();
      const barcodeKey = (p.barcode || p.barcode2 || '').trim().toLowerCase();
      
      const primaryKey = nameKey || barcodeKey;
      if (!primaryKey) return;

      const q = Number(p.quantity ?? 0);
      const cost = Number(p.purchasePrice || p.costPrice || 0);
      const sell = Number(p.sellingPrice || 0);

      let record = nameKey ? nameMap.get(nameKey) : (barcodeKey ? barcodeMap.get(barcodeKey) : undefined);

      if (record) {
        record.totalQuantity += q;
        record.batchCount += 1;
        if (cost > 0) record.latestCostPrice = cost;
        if (sell > 0) record.sellingPrice = sell;
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
        };
        if (nameKey) nameMap.set(nameKey, record);
      }

      if (barcodeKey) barcodeMap.set(barcodeKey, record);
    });

    return { nameMap, barcodeMap };
  }, [products]);

  // Deep analysis of items in the current report with aggregated groupings
  const analyzedItems = useMemo(() => {
    if (!currentReport || !currentReport.items) return [];

    const prevItemsMap = new Map<string, any>();
    if (previousReport && previousReport.items) {
      previousReport.items.forEach((it: any) => {
        const nKey = (it.productName || '').trim().toLowerCase();
        const bKey = (it.barcode || '').trim().toLowerCase();
        if (nKey) prevItemsMap.set(nKey, it);
        if (bKey) prevItemsMap.set(bKey, it);
      });
    }

    // Group report items by Name first (or barcode if name empty)
    const groupedReportItems = new Map<string, any>();
    currentReport.items.forEach((item: any) => {
      const nKey = (item.productName || '').trim().toLowerCase();
      const bKey = (item.barcode || '').trim().toLowerCase();
      const groupKey = nKey || bKey;
      if (!groupKey) return;

      const existing = groupedReportItems.get(groupKey);
      if (existing) {
        existing.quantityAfter = (existing.quantityAfter || 0) + Number(item.quantityAfter || 0);
        existing.salesCalculated = (existing.salesCalculated || 0) + Number(item.salesCalculated || 0);
        existing.profit = (existing.profit || 0) + Number(item.profit || 0);
        existing.remainingValue = (existing.remainingValue || 0) + Number(item.remainingValue || 0);
        if (item.isSurplus) {
          existing.isSurplus = true;
          existing.surplusQuantity = (existing.surplusQuantity || 0) + (item.surplusQuantity || 0);
          existing.surplusCostValue = (existing.surplusCostValue || 0) + (item.surplusCostValue || 0);
        }
      } else {
        groupedReportItems.set(groupKey, { ...item });
      }
    });

    return Array.from(groupedReportItems.values()).map((item: any) => {
      const nKey = (item.productName || '').trim().toLowerCase();
      const bKey = (item.barcode || '').trim().toLowerCase();
      
      const prevItem = (nKey && prevItemsMap.get(nKey)) || (bKey && prevItemsMap.get(bKey));
      const liveGroup = (nKey && groupedLiveProducts.nameMap.get(nKey)) || 
                        (bKey && groupedLiveProducts.barcodeMap.get(bKey));

      const costPrice = Number(item.purchasePrice || liveGroup?.latestCostPrice || 0);
      const sellPrice = Number(item.sellingPrice || liveGroup?.sellingPrice || 0);
      
      // Stock quantity & Simulation:
      // In a periodic inventory system without POS daily sales deduction,
      // the live quantity in the app only increases when purchases are entered, but doesn't decrease daily.
      // Therefore, for the latest inventory, we compute:
      // 1. recordedReportStock: stock at the moment of the last inventory
      // 2. liveCurrentStock: current recorded stock in the app (inventory + purchases made after inventory)
      // 3. estimatedConsumedSinceInventory: (dailyVelocity * daysSinceLatestInventory)
      // 4. estimatedCurrentStockToday: liveCurrentStock - estimatedConsumedSinceInventory
      const recordedReportStock = Number(item.quantityAfter || 0);
      const liveCurrentStock = liveGroup ? liveGroup.totalQuantity : recordedReportStock;
      
      const soldQty = Number(item.salesCalculated || 0);
      const profit = Number(item.profit || 0);
      const revenue = soldQty > 0 ? (soldQty * sellPrice) : 0;
      const cogs = soldQty > 0 ? (soldQty * costPrice) : 0;

      // Return per 1 Dinar invested in sold inventory:
      // If 10 Dinars cost generated 14 Dinars revenue -> 1.40 Dinars return per 1 Dinar invested
      const returnPerDinar = cogs > 0 ? (revenue / cogs) : (costPrice > 0 && sellPrice > 0 ? (sellPrice / costPrice) : 0);

      // Daily consumption velocity based on elapsed days between inventories
      const dailyVelocity = soldQty > 0 ? (soldQty / elapsedDays) : 0;

      // Simulated estimated depletion since the last inventory until today
      const estimatedConsumedSinceInventory = isLatestReportSelected && dailyVelocity > 0
        ? Math.round(dailyVelocity * daysSinceLatestInventory)
        : 0;

      // Real estimated shelf stock today:
      // Taking what's currently in the system (base inventory + new purchases) minus estimated consumption
      const estimatedCurrentStockToday = isLatestReportSelected
        ? Math.max(0, liveCurrentStock - estimatedConsumedSinceInventory)
        : recordedReportStock;

      const currentStock = isLatestReportSelected ? estimatedCurrentStockToday : recordedReportStock;
      
      // Stock Runway (Days until stock out from today)
      // Remaining shelf days starting from TODAY:
      const daysUntilStockout = dailyVelocity > 0 
        ? Math.max(0, Math.floor(estimatedCurrentStockToday / dailyVelocity)) 
        : (estimatedCurrentStockToday > 0 ? 999 : 0);

      // Previous inventory stock
      const prevStock = prevItem ? Number(prevItem.quantityAfter || 0) : null;
      
      // Dead stock flag: item had positive stock before and sold 0
      const isDeadStock = soldQty <= 0 && currentStock > 0;
      const deadCapital = isDeadStock ? (currentStock * costPrice) : 0;

      // Status
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
        currentStock, // estimated current shelf stock today
        liveCurrentStock, // app recorded stock (inventory + new purchases)
        recordedReportStock, // stock at inventory time
        estimatedConsumedSinceInventory,
        soldQty,
        dailyVelocity,
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
      };
    });
  }, [currentReport, previousReport, elapsedDays, daysSinceLatestInventory, groupedLiveProducts, isLatestReportSelected]);

  // Overall Metrics for selected report
  const summaryMetrics = useMemo(() => {
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
        growthRevenuePct: null as number | null,
        growthProfitPct: null as number | null,
        surplusValue: 0,
        surplusCount: 0,
        damageLoss: 0,
      };
    }

    const totalRevenue = Number(currentReport.totalRevenue || 0);
    const totalProfit = Number(currentReport.totalProfit || 0);
    const totalRemainingValue = Number(currentReport.totalRemainingValue || 0);
    const totalExpenses = Number(currentReport.totalExpenses || 0);
    const netProfit = Number(currentReport.netProfit ?? (totalProfit - totalExpenses));
    const surplusValue = Number(currentReport.surplusValueUnverified || 0);
    const surplusCount = Number(currentReport.surplusItemsCount || 0);
    const damageLoss = Number(currentReport.totalDamageLoss || 0);

    const totalSoldPieces = analyzedItems.reduce((acc, it) => acc + (it.soldQty > 0 ? it.soldQty : 0), 0);
    const deadStockItems = analyzedItems.filter(it => it.isDeadStock);
    const deadStockCount = deadStockItems.length;
    const deadStockCapital = deadStockItems.reduce((acc, it) => acc + it.deadCapital, 0);
    const criticalStockCount = analyzedItems.filter(it => it.stockStatus === 'critical').length;

    let growthRevenuePct: number | null = null;
    let growthProfitPct: number | null = null;

    if (previousReport && Number(previousReport.totalRevenue || 0) > 0) {
      const prevRev = Number(previousReport.totalRevenue);
      growthRevenuePct = ((totalRevenue - prevRev) / prevRev) * 100;
    }
    if (previousReport && Number(previousReport.totalProfit || 0) > 0) {
      const prevProf = Number(previousReport.totalProfit);
      growthProfitPct = ((totalProfit - prevProf) / prevProf) * 100;
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
  const storeHealthDiagnostic = useMemo(() => {
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

    // Percent changes
    const revPctChange = prevRev !== null && prevRev > 0 ? ((curRev - prevRev) / prevRev) * 100 : null;
    const profitPctChange = prevProfit !== null && prevProfit > 0 ? ((curProfit - prevProfit) / prevProfit) * 100 : null;
    const netPctChange = prevNet !== null && prevNet > 0 ? ((curNet - prevNet) / prevNet) * 100 : null;
    const stockPctChange = prevStock !== null && prevStock > 0 ? ((curStock - prevStock) / prevStock) * 100 : null;

    // Expense burdens
    const curExpenseRatio = curProfit > 0 ? (curExpenses / curProfit) * 100 : 0;
    const prevExpenseRatio = prevProfit !== null && prevProfit > 0 ? (prevExpenses! / prevProfit) * 100 : null;
    const expenseRatioDiff = prevExpenseRatio !== null ? curExpenseRatio - prevExpenseRatio : null;

    // Shrinkage ratio
    const curShrinkageRatio = curProfit > 0 ? (curShrinkageTotal / curProfit) * 100 : 0;

    // Calculate Store Score (out of 100)
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

    // Score classification
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

    // 5 Key Evaluated Indicators
    const indicators = [
      {
        id: 'revenue',
        title: 'مؤشر نمو المبيعات (حركة الإقبال)',
        value: revPctChange !== null ? `${revPctChange >= 0 ? '+' : ''}${revPctChange.toFixed(1)}%` : 'الجرد المرجعي',
        status: revPctChange === null ? 'neutral' : (revPctChange >= 10 ? 'excellent' : (revPctChange >= 0 ? 'good' : 'bad')),
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
        status: netPctChange === null ? 'neutral' : (netPctChange >= 10 ? 'excellent' : (netPctChange >= 0 ? 'good' : 'bad')),
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
        status: curExpenseRatio <= 20 ? 'excellent' : (curExpenseRatio <= 30 ? 'good' : 'bad'),
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
        status: stockPctChange === null ? 'good' : (Math.abs(stockPctChange) <= 25 ? 'good' : 'neutral'),
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
        status: curShrinkageRatio <= 1.5 ? 'excellent' : (curShrinkageRatio <= 4 ? 'neutral' : 'bad'),
        statusLabel: curShrinkageRatio <= 1.5 ? 'انضباط ممتاز وأمان عالٍ 🟢' : (curShrinkageRatio <= 4 ? 'فواقد متوسطة 🟡' : 'تنبيه هدر وتوالف 🔴'),
        details: `إجمالي التوالف والفوائض غير المفسرة: ${formatCurrency(curShrinkageTotal, settings.currency, language)} (${curDamage > 0 ? `توالف: ${formatCurrency(curDamage, settings.currency, language)}` : ''}${curSurplus > 0 ? ` | زيادات غير مفسرة: ${formatCurrency(curSurplus, settings.currency, language)}` : ''}).`,
        advice: curShrinkageRatio > 4 
          ? 'راجع طريقة تخزين الأصناف المعرضة للتلف وتأكد من تسجيل فواتير كل بضاعة تدخل المتجر.'
          : 'انضباط مخزني ممتاز يحمي أرباحك من التسرب.',
      }
    ];

    // Executive Narrative Story Paragraph
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
  const cycleHighlights = useMemo(() => {
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
  const marketDebtsStats = useMemo(() => {
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

  // Fast-Moving Products (Top 8 highest velocity / sales)
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

  // Products with runway / replenishment analysis sorted by urgency (soonest to run out first)
  const replenishmentItems = useMemo(() => {
    return [...analyzedItems]
      .filter(it => it.dailyVelocity > 0 || it.currentStock === 0)
      .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
  }, [analyzedItems]);

  // Urgent subset (<= 7 days or depleted)
  const urgentReplenishItems = useMemo(() => {
    return replenishmentItems.filter(it => it.daysUntilStockout <= 7 || it.currentStock === 0);
  }, [replenishmentItems]);

  // Items to display in the stock runway table according to search query, urgentFilter and itemsPerPage
  const displayReplenishmentItems = useMemo(() => {
    let list = replenishmentItems;
    
    // Search query filter
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
    if (itemsPerPage === -1) return list; // all
    return list.slice(0, itemsPerPage);
  }, [replenishmentItems, replenishmentSearch, urgentFilter, itemsPerPage]);

  // Category Breakdown Metrics
  const categoryBreakdown = useMemo(() => {
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
      existing.revenue += Number(item.revenue || 0);
      existing.profit += Number(item.profit || 0);
      existing.remainingValue += Number(item.currentStock || 0) * Number(item.costPrice || 0);
      const itemCogs = Number(item.soldQty || 0) * Number(item.costPrice || 0);
      existing.cogs += itemCogs;

      map.set(cat, existing);
    });

    const totalRev = summaryMetrics.totalRevenue || 1;
    const totalProf = summaryMetrics.totalProfit || 1;

    return Array.from(map.values()).map(c => {
      const revPct = summaryMetrics.totalRevenue > 0 ? (c.revenue / totalRev) * 100 : 0;
      const profPct = summaryMetrics.totalProfit > 0 ? (c.profit / totalProf) * 100 : 0;
      const profitMargin = c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0;
      const returnOnDinar = c.cogs > 0 ? (c.revenue / c.cogs) : (c.profit > 0 ? 1 + (c.profit / (c.revenue - c.profit)) : 1);

      return {
        ...c,
        revPct,
        profPct,
        profitMargin,
        returnOnDinar,
      };
    }).sort((a, b) => b.profit - a.profit);
  }, [analyzedItems, summaryMetrics]);

  // Top Return-on-Dinar products (highest multiplier with meaningful sales)
  const topRoiProducts = useMemo(() => {
    return [...analyzedItems]
      .filter(it => it.soldQty > 0 && it.costPrice > 0)
      .sort((a, b) => b.returnPerDinar - a.returnPerDinar)
      .slice(0, 5);
  }, [analyzedItems]);

  // Map suppliers by ID for instant lookup
  const suppliersMap = useMemo(() => {
    const map = new Map<string, any>();
    (suppliers || []).forEach(s => {
      if (s.id) map.set(s.id, s);
    });
    return map;
  }, [suppliers]);

  // Group purchases by Day (Daily total purchases with breakdown by categories and suppliers)
  const dailyPurchases = useMemo(() => {
    const groups: Record<string, { 
      key: string;
      date: Date;
      total: number;
      count: number;
      txs: Array<{
        id?: string;
        amount: number;
        note?: string;
        supplierName: string;
        category: string;
      }>;
      categoriesBreakdown: Record<string, { total: number; count: number }>;
      suppliersBreakdown: Record<string, { total: number; count: number }>;
    }> = {};
    
    (purchases || []).forEach(p => {
      const date = safeParseDate(p.date || p.createdAt);
      const dateKey = date.toLocaleDateString('en-GB');
      
      const supplierObj = p.supplierId ? suppliersMap.get(p.supplierId) : null;
      const supplierName = supplierObj?.name || 'مورد غير مسجل';
      const category = (supplierObj?.typeOfGoods || 'عام / غير محدد').trim();
      const amount = Number(p.amount) || 0;

      if (!groups[dateKey]) {
        groups[dateKey] = { 
          key: dateKey,
          date, 
          total: 0, 
          count: 0,
          txs: [],
          categoriesBreakdown: {},
          suppliersBreakdown: {}
        };
      }
      
      groups[dateKey].total += amount;
      groups[dateKey].count += 1;
      groups[dateKey].txs.push({
        id: p.id,
        amount,
        note: p.note || '',
        supplierName,
        category
      });

      // Categories accumulation
      if (!groups[dateKey].categoriesBreakdown[category]) {
        groups[dateKey].categoriesBreakdown[category] = { total: 0, count: 0 };
      }
      groups[dateKey].categoriesBreakdown[category].total += amount;
      groups[dateKey].categoriesBreakdown[category].count += 1;

      // Suppliers accumulation
      if (!groups[dateKey].suppliersBreakdown[supplierName]) {
        groups[dateKey].suppliersBreakdown[supplierName] = { total: 0, count: 0 };
      }
      groups[dateKey].suppliersBreakdown[supplierName].total += amount;
      groups[dateKey].suppliersBreakdown[supplierName].count += 1;
    });

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [purchases, suppliersMap]);

  // Multi-Inventory Trend Chart Data (Chronological left-to-right)
  const multiInventoryTrends = useMemo(() => {
    return [...sortedReports].reverse().map((rep, idx) => {
      const repDate = safeParseDate(rep.date);
      const label = formatAppDate(repDate, 'ar', t, { day: 'numeric', month: 'short' });
      return {
        name: `جرد ${idx + 1} (${label})`,
        shortName: `جرد ${idx + 1}`,
        revenue: Number((rep.totalRevenue || 0).toFixed(3)),
        profit: Number((rep.totalProfit || 0).toFixed(3)),
        netProfit: Number((rep.netProfit || 0).toFixed(3)),
        stockValue: Number((rep.totalRemainingValue || 0).toFixed(3)),
        expenses: Number((rep.totalExpenses || 0).toFixed(3)),
      };
    });
  }, [sortedReports, t]);

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
      {/* Top Controller: Inventory Selector & General Delta Bar */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-850 to-zinc-900 text-white rounded-2xl p-6 shadow-md border border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold border border-brand-500/30 flex items-center gap-1">
                <Sparkles size={12} />
                نظام تحليلات الجرد الدوري
              </span>
              <span className="text-xs text-zinc-400">
                إجمالي الجرود المتاحة: {sortedReports.length}
              </span>
            </div>
            <h2 className="text-2xl font-black">ذكاء الجرد ومؤشرات الأداء</h2>
            <p className="text-xs text-zinc-400">
              تحليل الاستهلاك الحقيقي، سرعة نفاد الرفوف، ورأس المال المعطل بين الجرود.
            </p>
          </div>

          {/* Selector Dropdown */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-zinc-800/90 border border-zinc-700/80 rounded-xl p-1.5 shadow-inner">
            <Calendar size={18} className="text-zinc-400 mr-2" />
            <select
              value={selectedReportIndex}
              onChange={(e) => setSelectedReportIndex(Number(e.target.value))}
              aria-label="اختر عملية الجرد للتحليل"
              className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer pr-3 py-1"
            >
              {sortedReports.map((rep, idx) => {
                const dateStr = formatAppDate(safeParseDate(rep.date), 'ar', t, { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                });
                return (
                  <option key={rep.id || idx} value={idx} className="bg-zinc-800 text-white">
                    {idx === 0 ? '⭐ الجرد الأخير: ' : `الجرد رقم ${sortedReports.length - idx}: `} {dateStr}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Selected Inventory Key Info Ribbon */}
        {currentReport && (
          <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-[11px] text-zinc-400">تاريخ إجراء الجرد</span>
              <span className="font-bold text-zinc-200">
                {formatAppDate(safeParseDate(currentReport.date), 'ar', t, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div>
              <span className="block text-[11px] text-zinc-400">المدة المحسوبة للاستهلاك</span>
              <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                <Clock size={14} className="text-brand-400" />
                {previousReport ? `${elapsedDays} يوماً منذ الجرد السابق` : 'دورة جرد أولى'}
              </span>
            </div>

            <div>
              <span className="block text-[11px] text-zinc-400">أصناف الجرد المسجلة</span>
              <span className="font-bold text-zinc-200">
                {analyzedItems.length} صنف مسجل
              </span>
            </div>

            <div>
              <span className="block text-[11px] text-zinc-400">نسبة النمو مقارنة بالسابق</span>
              <div className="flex items-center gap-2">
                {summaryMetrics.growthRevenuePct !== null ? (
                  <span className={`font-bold flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${
                    summaryMetrics.growthRevenuePct >= 0 
                      ? 'bg-emerald-500/20 text-emerald-300' 
                      : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {summaryMetrics.growthRevenuePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {summaryMetrics.growthRevenuePct >= 0 ? '+' : ''}{summaryMetrics.growthRevenuePct.toFixed(1)}% مبيعات
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">الجرد المرجعي الأول</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-200 dark:border-zinc-800 scrollbar-none">
        {[
          { id: 'diagnostic', label: 'مسار النمو وتشخيص المتجر 🧭', icon: Award },
          { id: 'overview', label: 'الخلاصة المالية للجرد', icon: DollarSign },
          { id: 'categories', label: 'مردودية الأقسام ورأس المال', icon: PieChartIcon },
          { id: 'velocity', label: 'سرعة الدوران والأصناف الراكدة', icon: Zap },
          { id: 'purchases', label: 'حركة المشتريات اليومية', icon: History },
          { id: 'shrinkage', label: 'سلامة الجرد والهدر والتوالف', icon: ShieldAlert },
          { id: 'trends', label: 'مسار وتطور الجرود السابقة', icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 0: STORE HEALTH & GROWTH DIAGNOSTIC */}
      {subTab === 'diagnostic' && storeHealthDiagnostic && (
        <div className="space-y-6">
          {/* Executive Diagnostic Master Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm overflow-hidden relative">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              
              {/* Score Widget */}
              <div className="flex items-center gap-4 shrink-0">
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 ${storeHealthDiagnostic.scoreRing} bg-zinc-50 dark:bg-zinc-800/80 flex flex-col items-center justify-center shadow-inner`}>
                  <span className={`text-3xl sm:text-4xl font-black ${storeHealthDiagnostic.scoreColor} font-mono tracking-tight`}>
                    {storeHealthDiagnostic.score}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-bold mt-0.5">من 100</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${storeHealthDiagnostic.scoreBg}`}>
                      {storeHealthDiagnostic.scoreBadge}
                    </span>
                    <span className="text-xs text-zinc-400">تقييم الجرد الدوري</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white">
                    {storeHealthDiagnostic.scoreTitle}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-md">
                    مقياس مركب يقيس كفاءة المبيعات، ضبط المصاريف، وتوازن نمو الأرباح الحقيقية.
                  </p>
                </div>
              </div>

              {/* Quick Key Comparison Strip */}
              <div className="grid grid-cols-3 gap-3 w-full lg:w-auto shrink-0 text-center">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <span className="block text-[10px] font-bold text-zinc-400">نمو المبيعات</span>
                  <span className={`text-sm sm:text-base font-black ${
                    storeHealthDiagnostic.revPctChange !== null && storeHealthDiagnostic.revPctChange >= 0
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {storeHealthDiagnostic.revPctChange !== null 
                      ? `${storeHealthDiagnostic.revPctChange >= 0 ? '+' : ''}${storeHealthDiagnostic.revPctChange.toFixed(1)}%` 
                      : '—'}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <span className="block text-[10px] font-bold text-zinc-400">نمو صافي الربح</span>
                  <span className={`text-sm sm:text-base font-black ${
                    storeHealthDiagnostic.netPctChange !== null && storeHealthDiagnostic.netPctChange >= 0
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {storeHealthDiagnostic.netPctChange !== null 
                      ? `${storeHealthDiagnostic.netPctChange >= 0 ? '+' : ''}${storeHealthDiagnostic.netPctChange.toFixed(1)}%` 
                      : '—'}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <span className="block text-[10px] font-bold text-zinc-400">نسبة المصاريف</span>
                  <span className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                    {((storeHealthDiagnostic.curExpenses / (Number(currentReport.totalProfit || 1))) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

            </div>

            {/* Narrative Story Section */}
            <div className="pt-6">
              <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-brand-600 dark:text-brand-400">
                <Compass size={16} />
                <span>التقرير التشخيصي التنفيذي لمتجرك:</span>
              </div>
              <div className="p-4 rounded-xl bg-brand-500/5 dark:bg-brand-500/10 border border-brand-500/20 text-zinc-800 dark:text-zinc-200 text-sm leading-relaxed font-medium">
                {storeHealthDiagnostic.story}
              </div>
            </div>
          </div>

          {/* 5 Evaluated Vital Indicators */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Target size={18} className="text-brand-500" />
                المؤشرات الحيوية لتقييم المتجر (مؤشر جيد / سيء):
              </h3>
              <span className="text-xs text-zinc-400">مقارنة تحليلية مباشرة بين الجردين</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {storeHealthDiagnostic.indicators.map((ind) => (
                <div 
                  key={ind.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4.5 shadow-xs space-y-2.5 transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                        {ind.title}
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {ind.details}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="text-base font-black text-zinc-900 dark:text-white block font-mono">
                        {ind.value}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md inline-block mt-1 ${
                        ind.status === 'excellent' 
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : ind.status === 'good'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                          : ind.status === 'neutral'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                      }`}>
                        {ind.statusLabel}
                      </span>
                    </div>
                  </div>

                  {/* Operational Advice */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300 shrink-0">💡 التوجيه:</span>
                    <span className="text-[11px] leading-relaxed">{ind.advice}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cycle Stars vs Frozen Capital */}
          {cycleHighlights && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Flame size={18} className="text-amber-500" />
                  أبطال الدورة مقابل رأس المال المجمد:
                </h3>
                <span className="text-xs text-zinc-400">تحليل مساهمة الأصناف الفردية في هذا الجرد</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. Star Profit */}
                <div className="bg-white dark:bg-zinc-900 border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.03] to-transparent rounded-xl p-4 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Award size={15} />
                      بطل الأرباح (الأعلى عائداً)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20">
                      نجم الجرد 🌟
                    </span>
                  </div>
                  {cycleHighlights.starProfitItem ? (
                    <div>
                      <h4 className="text-sm font-black text-zinc-900 dark:text-white truncate">
                        {cycleHighlights.starProfitItem.name}
                      </h4>
                      <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-xs text-zinc-400">صافي ربحه:</span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatCurrency(cycleHighlights.starProfitItem.profit, settings.currency, language)}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        ساهم ببيع {cycleHighlights.starProfitItem.soldQty} قطعة. احرص على عدم نفاد مخزونه نهائياً.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400">لا توجد بيانات ربحية كافية بعد.</p>
                  )}
                </div>

                {/* 2. Star Velocity */}
                <div className="bg-white dark:bg-zinc-900 border border-blue-500/20 bg-gradient-to-b from-blue-500/[0.03] to-transparent rounded-xl p-4 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <Zap size={15} />
                      الأسرع حركة (الأكثر طلباً)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-bold border border-blue-500/20">
                      دوران سريع ⚡
                    </span>
                  </div>
                  {cycleHighlights.starVelocityItem ? (
                    <div>
                      <h4 className="text-sm font-black text-zinc-900 dark:text-white truncate">
                        {cycleHighlights.starVelocityItem.name}
                      </h4>
                      <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-xs text-zinc-400">إجمالي المبيعات:</span>
                        <span className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono">
                          {cycleHighlights.starVelocityItem.soldQty} قطعة
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        بمعدل سحب {cycleHighlights.starVelocityItem.dailyVelocity.toFixed(1)} قطعة/يوم. السلعة الأكبر جذباً للمستهلك.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400">لا توجد مبيعات مسجلة في هذا الجرد.</p>
                  )}
                </div>

                {/* 3. Heaviest Dead Stock */}
                <div className="bg-white dark:bg-zinc-900 border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.03] to-transparent rounded-xl p-4 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle size={15} />
                      أكبر سيولة معطلة (راكد)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold border border-amber-500/20">
                      رأس مال نائم 🧊
                    </span>
                  </div>
                  {cycleHighlights.heaviestDeadStock ? (
                    <div>
                      <h4 className="text-sm font-black text-zinc-900 dark:text-white truncate">
                        {cycleHighlights.heaviestDeadStock.name}
                      </h4>
                      <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-xs text-zinc-400">قيمة المحبوس:</span>
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">
                          {formatCurrency(cycleHighlights.heaviestDeadStock.deadCapital, settings.currency, language)}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        لديك {cycleHighlights.heaviestDeadStock.currentStock} قطعة لم تبع قط. يُنصح بعمل تخفيض لتسييل هذا الصنف.
                      </p>
                    </div>
                  ) : (
                    <div className="pt-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={16} />
                      ممتاز! لا يوجد صنف راكد يجمد سيولة ملحوظة.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Market Debts & Liquidity Risk Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                  <Wallet size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                    ميزان السيولة النقدية وديون السوق (Customer Debts Risk)
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    قياس أثر أموالك المعلقة عند الزبائن على أرباح ورأس مال المتجر
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="self-start sm:self-auto">
                {marketDebtsStats.unpaidCustomerDebts === 0 ? (
                  <span className="text-xs font-black px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    أمان مالي تام: لا ديون خارجية 🟢
                  </span>
                ) : storeHealthDiagnostic.curNet > 0 && (marketDebtsStats.unpaidCustomerDebts / storeHealthDiagnostic.curNet) <= 0.4 ? (
                  <span className="text-xs font-black px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    ديون منضبطة وضمن الحدود الآمنة 🟢
                  </span>
                ) : (
                  <span className="text-xs font-black px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    تنبيه: حجم الديون يحبس السيولة 🔴
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center sm:text-right">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-400 font-bold mb-1">ديون الزبائن في السوق</span>
                <span className="text-base font-black text-zinc-900 dark:text-white font-mono">
                  {formatCurrency(marketDebtsStats.unpaidCustomerDebts, settings.currency, language)}
                </span>
                <span className="block text-[10px] text-zinc-400 mt-0.5">
                  لدى {marketDebtsStats.customerDebtCount} زبون مدين
                </span>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-400 font-bold mb-1">نسبة الديون من صافي ربح الجرد</span>
                <span className={`text-base font-black font-mono ${
                  storeHealthDiagnostic.curNet > 0 && (marketDebtsStats.unpaidCustomerDebts / storeHealthDiagnostic.curNet) > 0.5
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-zinc-900 dark:text-white'
                }`}>
                  {storeHealthDiagnostic.curNet > 0 
                    ? `${((marketDebtsStats.unpaidCustomerDebts / storeHealthDiagnostic.curNet) * 100).toFixed(0)}%`
                    : '—'}
                </span>
                <span className="block text-[10px] text-zinc-400 mt-0.5">
                  من عائد جيبك الصافي
                </span>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-400 font-bold mb-1">ديون الموردين الواجب دفعها</span>
                <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                  {formatCurrency(marketDebtsStats.unpaidSupplierDebts, settings.currency, language)}
                </span>
                <span className="block text-[10px] text-zinc-400 mt-0.5">
                  مستحقات للموردين
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
              <span className="font-bold text-zinc-800 dark:text-zinc-200 shrink-0">💡 التحليل المالي:</span>
              <span>
                {marketDebtsStats.unpaidCustomerDebts === 0
                  ? 'نموذج نقدي مثالي (Cash Business) دون مخاطر تعثر سداد الزبائن، مما يمنحك سيولة فورية لإعادة تدويرها في المخزون.'
                  : storeHealthDiagnostic.curNet > 0 && (marketDebtsStats.unpaidCustomerDebts / storeHealthDiagnostic.curNet) > 0.6
                  ? `ديون الزبائن تعادل ${(marketDebtsStats.unpaidCustomerDebts / storeHealthDiagnostic.curNet * 100).toFixed(0)}% من صافي ربح دورتك؛ هذا يعني أن جزءاً كبيراً من مكاسبك لم يدخل جيبك بعد بل ما زال في السوق. ننصح بالتركيز على تحصيل الديون قبل منح تسهيلات جديدة.`
                  : 'نسبة ديون السوق متوازنة ومقبولة ولا تعطل حركة المشتريات اليومية.'}
              </span>
            </div>
          </div>

          {/* Quick Evolution Comparison (Before ➔ After) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <Activity size={16} className="text-brand-500" />
                تطور الأرقام المالية: الجرد السابق ➔ الجرد الحالي
              </h4>
              <span className="text-xs text-zinc-400">
                {previousReport ? 'مقارنة دورتين متتاليتين' : 'الدورة الأولى المرجعية'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {/* Sales */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-400 font-bold mb-1">المبيعات المحققة</span>
                <div className="text-xs text-zinc-500 line-through mb-0.5" dir="ltr">
                  {previousReport ? formatCurrency(previousReport.totalRevenue, settings.currency, language) : '—'}
                </div>
                <div className="text-base font-black text-zinc-900 dark:text-white" dir="ltr">
                  {formatCurrency(currentReport.totalRevenue, settings.currency, language)}
                </div>
              </div>

              {/* Profit */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-400 font-bold mb-1">إجمالي الأرباح</span>
                <div className="text-xs text-zinc-500 line-through mb-0.5" dir="ltr">
                  {previousReport ? formatCurrency(previousReport.totalProfit, settings.currency, language) : '—'}
                </div>
                <div className="text-base font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
                  {formatCurrency(currentReport.totalProfit, settings.currency, language)}
                </div>
              </div>

              {/* Expenses */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-400 font-bold mb-1">المصاريف التشغيلية</span>
                <div className="text-xs text-zinc-500 line-through mb-0.5" dir="ltr">
                  {previousReport ? formatCurrency(previousReport.totalExpenses, settings.currency, language) : '—'}
                </div>
                <div className="text-base font-black text-rose-600 dark:text-rose-400" dir="ltr">
                  {formatCurrency(currentReport.totalExpenses, settings.currency, language)}
                </div>
              </div>

              {/* Stock Value */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-400 font-bold mb-1">قيمة المخزون المتبقي</span>
                <div className="text-xs text-zinc-500 line-through mb-0.5" dir="ltr">
                  {previousReport ? formatCurrency(previousReport.totalRemainingValue, settings.currency, language) : '—'}
                </div>
                <div className="text-base font-black text-zinc-900 dark:text-white" dir="ltr">
                  {formatCurrency(currentReport.totalRemainingValue, settings.currency, language)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: FINANCIAL OVERVIEW */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* Main 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stock Valuation Remaining */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-bold">قيمة المخزون المتبقي (التكلفة)</span>
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600">
                  <Package size={18} />
                </div>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white">
                {!showFinancials ? '••••••' : formatCurrency(summaryMetrics.totalRemainingValue, settings.currency, language)}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                رأس المال الحقيقي المتبقي على الرفوف بعد الجرد
              </p>
            </div>

            {/* Total Consumed / Revenue */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-bold">المبيعات / الاستهلاك المحقق</span>
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white">
                {!showFinancials ? '••••••' : formatCurrency(summaryMetrics.totalRevenue, settings.currency, language)}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                تم استهلاك {summaryMetrics.totalSoldPieces.toLocaleString('en-US')} قطعة خلال الدورة
              </p>
            </div>

            {/* Total Profit */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-bold">الربح الإجمالي المحقق</span>
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600">
                  <DollarSign size={18} />
                </div>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white">
                {!showFinancials ? '••••••' : formatCurrency(summaryMetrics.totalProfit, settings.currency, language)}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
                <span>هامش الربح الإجمالي:</span>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">
                  {summaryMetrics.totalRevenue > 0 
                    ? ((summaryMetrics.totalProfit / summaryMetrics.totalRevenue) * 100).toFixed(1) + '%' 
                    : '0%'}
                </span>
              </div>
            </div>

            {/* Net Profit after expenses */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-bold">صافي الربح الفعلي</span>
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600">
                  <Sparkles size={18} />
                </div>
              </div>
              <div className={`text-2xl font-black ${
                summaryMetrics.netProfit >= 0 ? 'text-zinc-900 dark:text-white' : 'text-rose-600'
              }`}>
                {!showFinancials ? '••••••' : formatCurrency(summaryMetrics.netProfit, settings.currency, language)}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                بعد خصم المصاريف المسجلة ({formatCurrency(summaryMetrics.totalExpenses, settings.currency, language)})
              </p>
            </div>
          </div>

          {/* Quick Action Alerts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Dead stock alert card */}
            <div className="p-5 rounded-xl border border-rose-100 dark:border-rose-950/50 bg-rose-50/50 dark:bg-rose-950/20 flex items-start gap-4">
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-600 shrink-0">
                <AlertCircle size={24} />
              </div>
              <div>
                <h4 className="font-bold text-rose-950 dark:text-rose-200 text-sm">بضاعة راكدة (صفر استهلاك)</h4>
                <div className="text-lg font-black text-rose-700 dark:text-rose-400 mt-1">
                  {summaryMetrics.deadStockCount} صنف معطل
                </div>
                <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1">
                  تجمد رأس مال قدره {!showFinancials ? '••••••' : formatCurrency(summaryMetrics.deadStockCapital, settings.currency, language)} على الرفوف دون أي حركة بيع في هذه الدورة.
                </p>
              </div>
            </div>

            {/* Critical stock alert */}
            <div className="p-5 rounded-xl border border-amber-100 dark:border-amber-950/50 bg-amber-50/50 dark:bg-amber-950/20 flex items-start gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                <Hourglass size={24} />
              </div>
              <div>
                <h4 className="font-bold text-amber-950 dark:text-amber-200 text-sm">أصناف شارفت على النفاد</h4>
                <div className="text-lg font-black text-amber-700 dark:text-amber-400 mt-1">
                  {summaryMetrics.criticalStockCount} أصناف حرجة
                </div>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
                  مخزونها الحالي يكفي لأقل من 5 أيام فقط استناداً لمعدل الاستهلاك المحسوب بالجرد.
                </p>
              </div>
            </div>

            {/* Health & Discrepancy indicator */}
            <div className="p-5 rounded-xl border border-blue-100 dark:border-blue-950/50 bg-blue-50/50 dark:bg-blue-950/20 flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h4 className="font-bold text-blue-950 dark:text-blue-200 text-sm">التوالف والزيادات غير المفسرة</h4>
                <div className="text-lg font-black text-blue-700 dark:text-blue-400 mt-1">
                  {formatCurrency(summaryMetrics.damageLoss, settings.currency, language)} توالف
                </div>
                <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-1">
                  {summaryMetrics.surplusCount > 0 
                    ? `وهناك ${summaryMetrics.surplusCount} صنف بزيادة فعلية عن المسجل بقيمة ${formatCurrency(summaryMetrics.surplusValue, settings.currency, language)}.` 
                    : 'لا توجد فروقات فائض غير مبررة مسجلة.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CATEGORY & CAPITAL PROFITABILITY (مردودية الأقسام ورأس المال) */}
      {subTab === 'categories' && (
        <div className="space-y-6">
          {/* Top Multipliers Highlight Card */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-sm">
                  <Award size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-white">
                    كاشف عائد الدينار المستثمر في السلع
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    كم ديناراً يرجع لمحلك مقابل كل 1 دينار تدفعه في شراء هذا المنتج؟
                  </p>
                </div>
              </div>
            </div>

            {/* Quick badges of top return products */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
              {topRoiProducts.map((p, idx) => (
                <div key={idx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 font-bold truncate max-w-[100px]">{p.category}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200/50">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="font-bold text-xs text-zinc-900 dark:text-white truncate mt-1" title={p.name}>
                    {p.name}
                  </div>
                  <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">يرجع لك:</span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      {p.returnPerDinar.toFixed(2)} د
                      <ArrowUpRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Performance Cards Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-zinc-900 dark:text-white">
                  مقارنة أداء ومساهمة أقسام المحل
                </h3>
                <p className="text-xs text-zinc-500">
                  مرتبة حسب المساهمة الأكبر في صافي الأرباح المحققة خلال هذه الدورة
                </p>
              </div>
              <span className="text-xs text-zinc-400 font-bold">
                إجمالي الأقسام: {categoryBreakdown.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryBreakdown.map((cat, i) => (
                <div 
                  key={i}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-brand-500/50 transition-all"
                >
                  <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 font-black text-xs flex items-center justify-center">
                          {i + 1}
                        </span>
                        <h4 className="font-black text-base text-zinc-900 dark:text-white">
                          {cat.category}
                        </h4>
                      </div>
                      <span className="text-[11px] text-zinc-400 block mt-1">
                        يحتوي على {cat.itemCount} صنف مسجل
                      </span>
                    </div>

                    <div className="text-left">
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200/50 dark:border-emerald-900/40 block">
                        {cat.profPct.toFixed(1)}% من ربح المحل
                      </span>
                    </div>
                  </div>

                  {/* Profit vs Revenue Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-medium">مساهمة المبيعات:</span>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">{cat.revPct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, cat.revPct))}%` }}
                      />
                    </div>
                  </div>

                  {/* 3 Core Metrics for this category */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
                    <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
                      <span className="block text-[10px] text-zinc-400">مبيعات القسم</span>
                      <span className="font-black text-xs text-zinc-900 dark:text-white mt-0.5 block">
                        {!showFinancials ? '•••' : formatCurrency(cat.revenue, settings.currency, language)}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                      <span className="block text-[10px] text-emerald-600 dark:text-emerald-400">أرباحه الصافية</span>
                      <span className="font-black text-xs text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                        {!showFinancials ? '•••' : formatCurrency(cat.profit, settings.currency, language)}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
                      <span className="block text-[10px] text-zinc-400">المجمد على الرف</span>
                      <span className="font-black text-xs text-zinc-900 dark:text-white mt-0.5 block">
                        {!showFinancials ? '•••' : formatCurrency(cat.remainingValue, settings.currency, language)}
                      </span>
                    </div>
                  </div>

                  {/* Key takeaway note */}
                  <div className="text-[11px] bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5 flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                    <span>معدل هامش الربح بالقسم:</span>
                    <span className="font-black text-brand-600 dark:text-brand-400">
                      {cat.profitMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VELOCITY & STAGNANT STOCK */}
      {subTab === 'velocity' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fast moving */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600">
                    <Zap size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-900 dark:text-white">الأصناف الأعلى استهلاكاً (قاطرة المبيعات)</h3>
                    <p className="text-[11px] text-zinc-500">أكثر المنتجات خروجاً ومبيعاً خلال فترة الجرد</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {topMovingItems.length > 0 ? (
                  topMovingItems.map((item, i) => (
                    <div key={i} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 font-black text-xs flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-zinc-900 dark:text-white">{item.name}</span>
                            {item.batchCount > 1 && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                {item.batchCount} دفعات
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            معدل: {item.dailyVelocity.toFixed(1)} قطعة/يوم • الرصيد المجمع: {item.currentStock}
                          </div>
                        </div>
                      </div>

                      <div className="text-left">
                        <div className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                          {item.soldQty} مباع
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          ربح: {formatCurrency(item.profit, settings.currency, language)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-zinc-400 py-8">لم يتم تسجيل كميات مستهلكة في هذا الجرد</p>
                )}
              </div>
            </div>

            {/* Dead stock */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600">
                    <Hourglass size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-900 dark:text-white">الأصناف الراكدة (رأس المال المجمد)</h3>
                    <p className="text-[11px] text-zinc-500">أصناف لم تنقص حبة واحدة بين الجردين</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-500 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40">
                  {stagnantItems.length} صنف
                </span>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {stagnantItems.length > 0 ? (
                  stagnantItems.map((item, i) => (
                    <div key={i} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-zinc-900 dark:text-white">{item.name}</span>
                          {item.batchCount > 1 && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                              {item.batchCount} دفعات
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          الكمية الراكدة المجمعة: {item.currentStock} قطعة • القسم: {item.category}
                        </div>
                      </div>

                      <div className="text-left">
                        <div className="font-black text-sm text-rose-600 dark:text-rose-400">
                          {formatCurrency(item.deadCapital, settings.currency, language)}
                        </div>
                        <div className="text-[10px] text-zinc-400">تكلفة مجمدة</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-zinc-400 py-8">ممتاز! لا توجد أصناف راكدة معطلة في هذا الجرد</p>
                )}
              </div>
            </div>
          </div>

          {/* Urgent replenishment table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                <div>
                  <h3 className="font-black text-zinc-900 dark:text-white text-base">
                    جدول أيام بقاء المخزون ومقترحات الشراء
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    مرتبة تصاعدياً من الأقرب للنفاد • تم دمج النسخ المتعددة لنفس الصنف تلقائياً
                  </p>
                </div>
              </div>

              {/* Controls: Per Page Selector & Quick Filter */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto w-full md:w-auto">
                {/* Search Bar */}
                <div className="relative flex-1 md:w-56 min-w-[180px]">
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    value={replenishmentSearch}
                    onChange={(e) => setReplenishmentSearch(e.target.value)}
                    placeholder="ابحث باسم المنتج..."
                    className="w-full pr-8 pl-7 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  {replenishmentSearch && (
                    <button
                      onClick={() => setReplenishmentSearch('')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg text-xs font-bold">
                  <button
                    onClick={() => setUrgentFilter('all')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      urgentFilter === 'all'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    الكل ({replenishmentItems.length})
                  </button>
                  <button
                    onClick={() => setUrgentFilter('critical')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      urgentFilter === 'critical'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-rose-600 dark:text-rose-400 hover:opacity-80'
                    }`}
                  >
                    حرج (≤ 5 أيام)
                  </button>
                  <button
                    onClick={() => setUrgentFilter('warning')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      urgentFilter === 'warning'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-amber-600 dark:text-amber-400 hover:opacity-80'
                    }`}
                  >
                    متوسط (6-15 يوم)
                  </button>
                </div>

                {/* Per Page Buttons: 20, 30, 50, all */}
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg text-xs font-bold">
                  <span className="text-[10px] text-zinc-400 px-1.5">عرض:</span>
                  {[20, 30, 50, -1].map((count) => (
                    <button
                      key={count}
                      onClick={() => setItemsPerPage(count)}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        itemsPerPage === count
                          ? 'bg-brand-500 text-white shadow-sm'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      {count === -1 ? 'الكل' : count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
              <span>
                عرض {displayReplenishmentItems.length} من أصل {replenishmentItems.length} صنف مستهلك
              </span>
              <span className="text-[11px] text-zinc-400">
                {isLatestReportSelected 
                  ? `⚡ مرت ${daysSinceLatestInventory} أيام منذ الجرد: محسوبة بمحاكاة السحب اليومي التقديري حتى تاريخ اليوم` 
                  : 'أرشيف: محسوبة بناءً على كميات تاريخ الجرد'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400">
                    <th className="pb-2.5 font-bold">#</th>
                    <th className="pb-2.5 font-bold">المنتج (مجمع النسخ)</th>
                    <th className="pb-2.5 font-bold">القسم</th>
                    <th className="pb-2.5 font-bold">
                      {isLatestReportSelected ? 'المتبقي التقديري على الرف اليوم' : 'رصيد الجرد'}
                    </th>
                    <th className="pb-2.5 font-bold">معدل السحب اليومي</th>
                    <th className="pb-2.5 font-bold">أيام البقاء ابتداءً من اليوم</th>
                    <th className="pb-2.5 font-bold">القرار المقترح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {displayReplenishmentItems.map((item, i) => (
                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="py-2.5 font-bold text-zinc-400 text-[11px]">{i + 1}</td>
                      <td className="py-2.5 font-bold text-zinc-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{item.name}</span>
                          {item.batchCount > 1 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/40" title="تم دمج كميات عدة نسخ شراء مختلفة لهذا الصنف">
                              {item.batchCount} أسعار شراء
                            </span>
                          )}
                          {item.returnPerDinar > 1 && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" title={`كل 1 د تكلفة يعود بـ ${item.returnPerDinar.toFixed(2)} د مبيعات`}>
                              عائد {item.returnPerDinar.toFixed(2)} د
                            </span>
                          )}
                        </div>
                        {isLatestReportSelected && (
                          <div className="text-[10px] text-zinc-400 font-normal mt-0.5">
                            رصيد النظام: {item.liveCurrentStock}
                            {item.estimatedConsumedSinceInventory > 0 && (
                              <span className="text-zinc-500"> (قُدّر استهلاك ~{item.estimatedConsumedSinceInventory} في {daysSinceLatestInventory} أيام)</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-zinc-500">{item.category}</td>
                      <td className="py-2.5 font-black text-sm text-zinc-900 dark:text-zinc-100">
                        {item.currentStock} قطعة
                      </td>
                      <td className="py-2.5 text-zinc-600 dark:text-zinc-300 font-medium">
                        {item.dailyVelocity.toFixed(1)} / يوم
                      </td>
                      <td className="py-2.5">
                        <span className={`px-2.5 py-0.5 rounded-full font-black text-xs inline-flex items-center gap-1 ${
                          item.currentStock === 0
                            ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-black'
                            : item.daysUntilStockout <= 5
                            ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-200 dark:border-rose-900'
                            : item.daysUntilStockout <= 15
                            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 border border-amber-200 dark:border-amber-900'
                            : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600'
                        }`}>
                          {item.currentStock === 0 ? 'نفد تماماً 🔴' : `${item.daysUntilStockout} يوم`}
                        </span>
                      </td>
                      <td className="py-2.5">
                        {item.currentStock === 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            طلب فوري عاجل (الرف فارغ)
                          </span>
                        ) : item.daysUntilStockout <= 5 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            إدراج في أول طلبية مورد
                          </span>
                        ) : item.daysUntilStockout <= 15 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            طلب في الزيارة القادمة
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            المخزون متزن وآمن
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {displayReplenishmentItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400">
                        لا توجد أصناف تطابق الفلتر المحدد حالياً
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DAILY PURCHASES MOVEMENT (حركة المشتريات اليومية) */}
      {subTab === 'purchases' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <Truck size={24} />
              </div>
              <div>
                <h3 className="font-black text-base text-zinc-900 dark:text-white">
                  سجل حركة المشتريات اليومية
                </h3>
                <p className="text-xs text-zinc-500">
                  إجمالي المبالغ المدفوعة لشراء البضائع موزعة حسب كل يوم
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-zinc-400 block">إجمالي مشتريات السجل</span>
              <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                {!showFinancials ? '••••••' : formatCurrency(dailyPurchases.reduce((acc, d) => acc + d.total, 0), settings.currency, language)}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {dailyPurchases.length > 0 ? (
              dailyPurchases.map((day, i) => {
                const isExpanded = expandedDayKey === day.key;
                const categoriesList = Object.entries(day.categoriesBreakdown);
                const suppliersList = Object.entries(day.suppliersBreakdown);

                return (
                  <div
                    key={day.key}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-brand-500/40"
                  >
                    {/* Day Summary Card (Clickable to expand details) */}
                    <div 
                      onClick={() => setExpandedDayKey(isExpanded ? null : day.key)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0 font-black text-xs">
                          {i + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-zinc-900 dark:text-white">
                              {day.date.toLocaleDateString(language === 'ar' ? 'ar-TN' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                              {day.count} {day.count === 1 ? 'فاتورة' : 'فواتير'}
                            </span>
                          </div>
                          
                          {/* Quick categories chips summary */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {categoriesList.slice(0, 3).map(([catName, catData], cIdx) => (
                              <span 
                                key={cIdx} 
                                className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                              >
                                {catName}: <strong className="font-bold text-zinc-900 dark:text-white">{formatCurrency(catData.total, settings.currency, language)}</strong>
                              </span>
                            ))}
                            {categoriesList.length > 3 && (
                              <span className="text-[10px] text-zinc-400 font-bold">
                                +{categoriesList.length - 3} فئات أخرى
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
                        <div className="text-left">
                          <span className="text-[10px] text-zinc-400 block font-medium">إجمالي المشتريات اليومي</span>
                          <span className="text-base font-black text-zinc-900 dark:text-white">
                            {!showFinancials ? '••••••' : formatCurrency(day.total, settings.currency, language)}
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail Panel: Categories & Suppliers breakdown */}
                    {isExpanded && (
                      <div className="p-4 bg-zinc-50/70 dark:bg-zinc-950/40 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                        {/* 1. Category Breakdown */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <Layers size={14} className="text-brand-500" />
                            <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                              توزيع المشتريات حسب الفئات والسلع
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {categoriesList.map(([catName, catData], idx) => {
                              const share = day.total > 0 ? (catData.total / day.total) * 100 : 0;
                              return (
                                <div 
                                  key={idx} 
                                  className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-3 rounded-xl"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-zinc-900 dark:text-white">
                                      {catName}
                                    </span>
                                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-sm bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400">
                                      {share.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="flex items-baseline justify-between">
                                    <span className="text-[11px] text-zinc-400">{catData.count} عملية</span>
                                    <span className="text-xs font-black text-zinc-900 dark:text-white">
                                      {formatCurrency(catData.total, settings.currency, language)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Suppliers & Invoices breakdown */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <Truck size={14} className="text-blue-500" />
                            <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                              الموردون والفواتير في هذا اليوم
                            </span>
                          </div>
                          <div className="space-y-2">
                            {day.txs.map((tx, txIdx) => (
                              <div 
                                key={tx.id || txIdx}
                                className="flex items-center justify-between p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl text-xs"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                                  <div>
                                    <span className="font-bold text-zinc-900 dark:text-white block">
                                      {tx.supplierName}
                                    </span>
                                    <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                                      <span>فئة: {tx.category}</span>
                                      {tx.note && <span>• {tx.note}</span>}
                                    </div>
                                  </div>
                                </div>
                                <span className="font-black text-zinc-900 dark:text-white text-xs">
                                  {formatCurrency(tx.amount, settings.currency, language)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
                  <History size={24} />
                </div>
                <h4 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">لا توجد عمليات مشتريات مسجلة بعد</h4>
                <p className="text-xs text-zinc-400 mt-1">عند تسجيل فواتير شراء من الموردين، ستظهر مجاميعها اليومية هنا تلقائياً.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SHRINKAGE & DAMAGE */}
      {subTab === 'shrinkage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Surplus & Discrepancies */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <ShieldAlert className="text-amber-500" size={20} />
                <div>
                  <h3 className="font-black text-zinc-900 dark:text-white">الفوارق والزيادات غير المفسرة</h3>
                  <p className="text-[11px] text-zinc-500">حالات وجد فيها بالعد الفعلي كمية أكبر من المسجل بالنظام</p>
                </div>
              </div>

              {currentReport.surplusItemsCount > 0 ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                    <strong>تنبيه فني:</strong> وجود زيادة فعلية عن المسجل يعني عادة: فاتورة شراء بضاعة لم يتم إدخالها للنظام، أو خطأ في العد أثناء الجرد السابق.
                  </div>

                  <div className="space-y-2">
                    {analyzedItems.filter(it => it.isSurplus).map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm text-zinc-900 dark:text-white">{item.name}</div>
                          <div className="text-[11px] text-zinc-400">
                            الزيادة: +{item.surplusQuantity} قطعة
                          </div>
                        </div>
                        <div className="text-left font-black text-amber-600 dark:text-amber-400">
                          {formatCurrency(item.surplusCostValue, settings.currency, language)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-zinc-400 space-y-2">
                  <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">أرقام الجرد متطابقة بالكامل</p>
                  <p className="text-xs">لم تسجل أي زيادات عشوائية غير مفسرة في هذا الجرد.</p>
                </div>
              )}
            </div>

            {/* Damages and Losses */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <AlertTriangle className="text-rose-500" size={20} />
                <div>
                  <h3 className="font-black text-zinc-900 dark:text-white">سجل التوالف والأضرار المعتمدة</h3>
                  <p className="text-[11px] text-zinc-500">البضائع التي أتلفت أو انتهت صلاحيتها خلال دورة الجرد</p>
                </div>
              </div>

              {currentReport.damageItems && currentReport.damageItems.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-300">إجمالي خسائر التوالف</span>
                    <span className="text-base font-black text-rose-600">
                      {formatCurrency(summaryMetrics.damageLoss, settings.currency, language)}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {currentReport.damageItems.map((dmg: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-white">{dmg.productName}</div>
                          <div className="text-zinc-400 mt-0.5">
                            الكمية التالفة: {dmg.quantity} • السبب: {dmg.reason || 'تلف / كسر'}
                          </div>
                        </div>
                        <div className="font-black text-rose-600">
                          {formatCurrency(dmg.totalLoss, settings.currency, language)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-zinc-400 space-y-2">
                  <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">لا توجد توالف مسجلة في هذه الدورة</p>
                  <p className="text-xs">سجل الهدر والتوالف نظيف بنسبة 100%.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MULTI-INVENTORY TRENDS */}
      {subTab === 'trends' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-black text-lg text-zinc-900 dark:text-white">
                  مسار تطور المحل عبر الجرود المتعاقبة
                </h3>
                <p className="text-xs text-zinc-500">
                  مقارنة المبيعات والأرباح وقيمة رأس المال المخزون عبر الزمن
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-brand-500" />
                  <span className="text-zinc-600 dark:text-zinc-400">المبيعات / الاستهلاك</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-zinc-600 dark:text-zinc-400">صافي الربح</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-blue-400" />
                  <span className="text-zinc-600 dark:text-zinc-400">قيمة المخزون المتبقي</span>
                </div>
              </div>
            </div>

            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={multiInventoryTrends}>
                  <defs>
                    <linearGradient id="trendRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#004eff" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#004eff" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="trendProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="shortName" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} hide />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                      textAlign: 'right' 
                    }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        revenue: 'المبيعات المستهلكة',
                        profit: 'الربح الإجمالي',
                        netProfit: 'صافي الربح',
                        stockValue: 'قيمة المخزون المتبقي',
                        expenses: 'المصاريف',
                      };
                      return [formatCurrency(value, settings.currency, language), labels[name] || name];
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#004eff" strokeWidth={3} fillOpacity={1} fill="url(#trendRevenue)" />
                  <Area type="monotone" dataKey="netProfit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#trendProfit)" />
                  <Area type="monotone" dataKey="stockValue" stroke="#60a5fa" strokeWidth={2} strokeDasharray="4 4" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Table of all inventories side-by-side */}
            <div className="mt-8 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400">
                    <th className="pb-3 font-bold">الجرد</th>
                    <th className="pb-3 font-bold">التاريخ</th>
                    <th className="pb-3 font-bold">المبيعات المستهلكة</th>
                    <th className="pb-3 font-bold">الربح الإجمالي</th>
                    <th className="pb-3 font-bold">المصاريف المقيدة</th>
                    <th className="pb-3 font-bold">صافي الربح</th>
                    <th className="pb-3 font-bold">قيمة المخزون المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {multiInventoryTrends.map((tItem, i) => (
                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="py-3 font-black text-brand-600 dark:text-brand-400">{tItem.name}</td>
                      <td className="py-3 text-zinc-500">دورة جرد</td>
                      <td className="py-3 font-bold text-zinc-900 dark:text-white">
                        {!showFinancials ? '••••••' : formatCurrency(tItem.revenue, settings.currency, language)}
                      </td>
                      <td className="py-3 font-bold text-emerald-600">
                        {!showFinancials ? '••••••' : formatCurrency(tItem.profit, settings.currency, language)}
                      </td>
                      <td className="py-3 text-rose-500">
                        {!showFinancials ? '••••••' : formatCurrency(tItem.expenses, settings.currency, language)}
                      </td>
                      <td className="py-3 font-black text-emerald-700 dark:text-emerald-400">
                        {!showFinancials ? '••••••' : formatCurrency(tItem.netProfit, settings.currency, language)}
                      </td>
                      <td className="py-3 text-zinc-600 dark:text-zinc-300">
                        {!showFinancials ? '••••••' : formatCurrency(tItem.stockValue, settings.currency, language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

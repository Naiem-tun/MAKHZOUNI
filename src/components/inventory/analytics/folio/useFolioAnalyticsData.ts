import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  cleanQuantity,
  formatAppDate,
  formatCurrency,
  roundMoney,
  safeParseDate,
} from '../../../../lib/utils';
import { Supplier, SupplierTransaction, UserSettings } from '../../../../types';
import {
  AnalyzedItem,
  CategoryBreakdownItem,
  MultiInventoryTrendItem,
} from '../types';
import {
  FolioCategoryRow,
  FolioDataset,
  FolioDivergingRow,
  FolioDumbbellItem,
  FolioHeatmapRow,
  FolioProductRecord,
  FolioScatterPoint,
  FolioStackedPeriod,
  FolioTimelineEvent,
} from './folioTypes';

export type FolioSourceMode = 'live' | 'report';

interface UseFolioAnalyticsDataParams {
  inventoryReports: any[];
  products: any[];
  purchases: any[];
  suppliers?: Supplier[];
  supplierTransactions?: SupplierTransaction[];
  analyzedItems: AnalyzedItem[];
  categoryBreakdown: CategoryBreakdownItem[];
  multiInventoryTrends: MultiInventoryTrendItem[];
  settings: UserSettings;
  sourceMode?: FolioSourceMode;
}

export function useFolioAnalyticsData({
  inventoryReports,
  products,
  purchases,
  suppliers = [],
  analyzedItems,
  categoryBreakdown,
  multiInventoryTrends,
  settings,
  sourceMode = 'live',
}: UseFolioAnalyticsDataParams): FolioDataset {
  const { t } = useTranslation();
  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  return useMemo(() => {
    const canUseReportSnapshot =
      sourceMode === 'report' &&
      inventoryReports.length >= 1 &&
      analyzedItems.length > 0;
    const mode: 'comparative' | 'live' = canUseReportSnapshot
      ? 'comparative'
      : 'live';

    const modeLabel = canUseReportSnapshot
      ? `لقطة دورة الجرد (${inventoryReports.length} دورات مسجلة)`
      : 'المخزون الحي بالمتجر الآن';

    const modeDescription = canUseReportSnapshot
      ? 'تستند المصفوفة والقيم حالياً إلى لقطة دورة الجرد المختارة ومقارنتها بالدورة السابقة.'
      : 'تستند المصفوفة والبطاقات وتوزيع الفئات مباشرة إلى الأصناف والكميات الموجودة فعلياً الآن في المتجر، مع دمج سجل أسعار الشراء وحركة الدورات التاريخية.';

    // Build supplier lookup map
    const supplierNameById = new Map<string, string>();
    suppliers.forEach((s) => {
      if (s.id && s.name) supplierNameById.set(s.id, s.name);
    });

    // Build purchase price history & latest supplier per product key
    const purchaseHistoryMap = new Map<
      string,
      { prices: { date: number; price: number }[]; supplierName: string }
    >();

    const sortedPurchases = [...(purchases || [])].sort(
      (a, b) =>
        safeParseDate(a.date || a.createdAt).getTime() -
        safeParseDate(b.date || b.createdAt).getTime(),
    );

    sortedPurchases.forEach((p: any) => {
      const qty = cleanQuantity(Number(p.qtyAdded ?? p.quantityChange ?? 0));
      const unitPrice =
        Number(p.price || 0) > 0
          ? Number(p.price)
          : qty > 0 && Number(p.amount || 0) > 0
            ? Number(p.amount) / qty
            : 0;
      const dt = safeParseDate(p.date || p.createdAt).getTime();
      const supName =
        p.supplierName ||
        (p.supplierId ? supplierNameById.get(p.supplierId) : '') ||
        '';

      const keys = [
        p.productName ? String(p.productName).trim().toLowerCase() : '',
        p.barcode ? String(p.barcode).trim().toLowerCase() : '',
        p.productId ? String(p.productId).trim().toLowerCase() : '',
      ].filter(Boolean);

      keys.forEach((k) => {
        const entry = purchaseHistoryMap.get(k) || {
          prices: [],
          supplierName: supName || 'غير محدد',
        };
        if (unitPrice > 0) {
          entry.prices.push({ date: dt, price: roundMoney(unitPrice) });
        }
        if (supName) entry.supplierName = supName;
        purchaseHistoryMap.set(k, entry);
      });
    });

    // Lookup map from latest analyzedItems to enrich live products with velocity/sales context
    const analyzedLookup = new Map<string, AnalyzedItem>();
    analyzedItems.forEach((ai) => {
      const nKey = String(ai.name || '').trim().toLowerCase();
      const bKey = String(ai.barcode || '').trim().toLowerCase();
      if (nKey && !analyzedLookup.has(nKey)) analyzedLookup.set(nKey, ai);
      if (bKey && !analyzedLookup.has(bKey)) analyzedLookup.set(bKey, ai);
    });

    // Build unified product records
    const productRecords: FolioProductRecord[] = [];

    if (canUseReportSnapshot) {
      analyzedItems.forEach((item, idx) => {
        const nKey = String(item.name || '').trim().toLowerCase();
        const bKey = String(item.barcode || '').trim().toLowerCase();
        const history =
          (nKey ? purchaseHistoryMap.get(nKey) : undefined) ||
          (bKey ? purchaseHistoryMap.get(bKey) : undefined);

        const prices = history?.prices.map((h) => h.price) || [];
        const cost = roundMoney(item.costPrice);
        const sell = roundMoney(item.sellPrice);
        const prevCost =
          prices.length >= 2
            ? prices[prices.length - 2]
            : item.reportCostPrice > 0
              ? item.reportCostPrice
              : cost;

        const marginPct =
          sell > 0 ? Number((((sell - cost) / sell) * 100).toFixed(1)) : 0;

        let status: FolioProductRecord['status'] = 'healthy';
        if (item.stockStatus === 'depleted' || item.recordedReportStock <= 0)
          status = 'depleted';
        else if (item.stockStatus === 'critical') status = 'low';
        else if (item.stockStatus === 'stagnant' || item.isDeadStock)
          status = 'stagnant';

        let trendDirection: FolioProductRecord['trendDirection'] = 'unchanged';
        if (item.prevStock !== null) {
          if (item.soldQty > 0 && cost > prevCost * 1.01) {
            trendDirection = 'increasing';
          } else if (cost < prevCost * 0.99 || item.soldQty === 0) {
            trendDirection = 'decreasing';
          } else if (item.soldQty > 0) {
            trendDirection = 'increasing';
          }
        } else if (prices.length >= 2) {
          const diffPct = ((cost - prevCost) / Math.max(0.01, prevCost)) * 100;
          if (diffPct > 1) trendDirection = 'increasing';
          else if (diffPct < -1) trendDirection = 'decreasing';
        } else if (marginPct >= 20 && status === 'healthy') {
          trendDirection = 'increasing';
        } else if (status === 'depleted' || status === 'stagnant') {
          trendDirection = 'decreasing';
        }

        const spark =
          prices.length >= 2
            ? prices.slice(-8)
            : [
                prevCost || cost,
                cost || sell,
                sell || cost,
              ].filter((v) => v > 0);

        const repQty = cleanQuantity(item.recordedReportStock);
        productRecords.push({
          id: `${item.barcode || item.name}-${idx}`,
          name: item.name,
          barcode: item.barcode || '',
          category: (item.category || 'عام').trim(),
          supplierName: history?.supplierName || 'غير محدد',
          costPrice: cost,
          sellPrice: sell,
          previousCost: prevCost,
          stockQty: repQty,
          minQty: 5,
          soldQty: cleanQuantity(item.soldQty),
          stockValue: roundMoney(repQty * item.reportCostPrice || repQty * cost),
          revenueValue: roundMoney(item.revenue),
          profitValue: roundMoney(item.profit),
          marginPct,
          velocityScore: item.dailyVelocity,
          status,
          trendDirection,
          sparkline: spark.length > 0 ? spark : [0],
        });
      });
    } else {
      // Live aggregation directly from current store `products` + batch-accurate valuation
      const grouped = new Map<
        string,
        {
          id: string;
          name: string;
          barcode: string;
          category: string;
          supplierName: string;
          costPrice: number;
          sellPrice: number;
          stockQty: number;
          stockValue: number;
          potentialRevenue: number;
          minQty: number;
        }
      >();

      (products || []).forEach((p: any, idx: number) => {
        if (p.isDraft) return;
        const name = String(p.name || 'منتج بدون اسم').trim();
        const barcode = String(p.barcode || p.barcode2 || '').trim();
        const key = name.toLowerCase() || barcode.toLowerCase() || `p-${idx}`;
        const qty = cleanQuantity(Number(p.quantity ?? 0));
        const cost = roundMoney(Number(p.purchasePrice || p.costPrice || 0));
        const sell = roundMoney(Number(p.sellingPrice || 0));
        const minQ = cleanQuantity(Number(p.minQuantity ?? 5));
        const supName =
          p.supplierName ||
          (p.supplierId ? supplierNameById.get(p.supplierId) : '') ||
          '';

        const batchStockVal = qty * cost;
        const batchSellVal = qty * sell;

        const existing = grouped.get(key);
        if (existing) {
          existing.stockQty = cleanQuantity(existing.stockQty + qty);
          existing.stockValue = roundMoney(existing.stockValue + batchStockVal);
          existing.potentialRevenue = roundMoney(
            existing.potentialRevenue + batchSellVal,
          );
          if (cost > 0) existing.costPrice = cost;
          if (sell > 0) existing.sellPrice = sell;
          if (minQ > 0) existing.minQty = minQ;
          if (!existing.supplierName && supName) existing.supplierName = supName;
        } else {
          grouped.set(key, {
            id: p.id || key,
            name,
            barcode,
            category: String(p.category || 'عام').trim(),
            supplierName: supName,
            costPrice: cost,
            sellPrice: sell,
            stockQty: qty,
            stockValue: roundMoney(batchStockVal),
            potentialRevenue: roundMoney(batchSellVal),
            minQty: minQ,
          });
        }
      });

      grouped.forEach((g) => {
        const nKey = g.name.toLowerCase();
        const bKey = g.barcode.toLowerCase();
        const history =
          purchaseHistoryMap.get(nKey) ||
          (bKey ? purchaseHistoryMap.get(bKey) : undefined);
        const aiMatch =
          analyzedLookup.get(nKey) ||
          (bKey ? analyzedLookup.get(bKey) : undefined);

        const prices = history?.prices.map((h) => h.price) || [];
        const prevCost =
          prices.length >= 2 ? prices[prices.length - 2] : g.costPrice;

        const marginPct =
          g.sellPrice > 0
            ? Number(
                (((g.sellPrice - g.costPrice) / g.sellPrice) * 100).toFixed(1),
              )
            : 0;

        let status: FolioProductRecord['status'] = 'healthy';
        if (g.stockQty <= 0) status = 'depleted';
        else if (g.stockQty <= Math.max(1, g.minQty)) status = 'low';
        else if (
          aiMatch?.isDeadStock ||
          (g.stockQty > Math.max(20, g.minQty * 6) && prices.length <= 1 && !aiMatch?.soldQty)
        )
          status = 'stagnant';

        let trendDirection: FolioProductRecord['trendDirection'] = 'unchanged';
        if (prices.length >= 2) {
          const diffPct =
            ((g.costPrice - prevCost) / Math.max(0.01, prevCost)) * 100;
          if (diffPct > 1.5) trendDirection = 'increasing';
          else if (diffPct < -1.5) trendDirection = 'decreasing';
        } else if (aiMatch && aiMatch.soldQty > 0 && status === 'healthy') {
          trendDirection = 'increasing';
        } else {
          if (g.stockQty > g.minQty * 2 && marginPct >= 15)
            trendDirection = 'increasing';
          else if (g.stockQty <= g.minQty || (g.sellPrice > 0 && marginPct <= 5))
            trendDirection = 'decreasing';
        }

        const spark =
          prices.length >= 2
            ? prices.slice(-8)
            : [prevCost || g.costPrice, g.costPrice, g.sellPrice].filter(
                (v) => v > 0,
              );

        const stockValue = roundMoney(g.stockValue);
        const potentialRevenue = roundMoney(g.potentialRevenue);
        const potentialProfit = roundMoney(potentialRevenue - stockValue);

        productRecords.push({
          id: g.id,
          name: g.name,
          barcode: g.barcode,
          category: g.category,
          supplierName: g.supplierName || history?.supplierName || 'غير محدد',
          costPrice: g.costPrice,
          sellPrice: g.sellPrice,
          previousCost: prevCost,
          stockQty: g.stockQty,
          minQty: g.minQty,
          soldQty: aiMatch ? cleanQuantity(aiMatch.soldQty) : prices.length,
          stockValue,
          revenueValue: potentialRevenue,
          profitValue: potentialProfit,
          marginPct,
          velocityScore: aiMatch
            ? aiMatch.dailyVelocity
            : prices.length > 0
              ? prices.length
              : g.stockQty,
          status,
          trendDirection,
          sparkline: spark.length > 0 ? spark : [g.costPrice || 0],
        });
      });
    }

    // Aggregate categories
    const catMap = new Map<
      string,
      {
        category: string;
        count: number;
        totalValue: number;
        revenue: number;
        profit: number;
        priceSum: number;
        marginSum: number;
      }
    >();

    productRecords.forEach((p) => {
      const existing = catMap.get(p.category) || {
        category: p.category,
        count: 0,
        totalValue: 0,
        revenue: 0,
        profit: 0,
        priceSum: 0,
        marginSum: 0,
      };
      existing.count += 1;
      existing.totalValue = roundMoney(existing.totalValue + p.stockValue);
      existing.revenue = roundMoney(existing.revenue + p.revenueValue);
      existing.profit = roundMoney(existing.profit + p.profitValue);
      existing.priceSum += p.sellPrice > 0 ? p.sellPrice : p.costPrice;
      existing.marginSum += p.marginPct;
      catMap.set(p.category, existing);
    });

    const grandValue = Math.max(
      0.01,
      productRecords.reduce((acc, p) => acc + p.stockValue, 0),
    );
    const totalCount = Math.max(1, productRecords.length);

    const categories: FolioCategoryRow[] = Array.from(catMap.values())
      .map((c) => {
        const cbMatch = canUseReportSnapshot
          ? categoryBreakdown.find((cb) => cb.category.trim() === c.category)
          : undefined;
        const shareSource =
          grandValue > 1
            ? (c.totalValue / grandValue) * 100
            : (c.count / totalCount) * 100;
        return {
          category: c.category,
          count: c.count,
          sharePct: Number(shareSource.toFixed(1)),
          totalValue: c.totalValue,
          avgPrice: roundMoney(c.priceSum / Math.max(1, c.count)),
          avgMarginPct: cbMatch
            ? Number(cbMatch.profitMargin.toFixed(1))
            : Number((c.marginSum / Math.max(1, c.count)).toFixed(1)),
          revenue: cbMatch ? cbMatch.revenue : c.revenue,
          profit: cbMatch ? cbMatch.profit : c.profit,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue || b.count - a.count);

    const topCategoriesList = categories.slice(0, 5).map((c) => c.category);

    // 03 · Dumbbell Comparison Items
    const dumbbellItems: FolioDumbbellItem[] = [];
    let dumbbellLabels = {
      baseline: 'التكلفة السابقة',
      current: 'سعر الشراء الحالي',
      unit: settings.currency || '',
    };

    const itemsWithPriceShift = productRecords.filter(
      (p) => p.previousCost > 0 && p.costPrice > 0 && Math.abs(p.costPrice - p.previousCost) > 0.001,
    );

    if (itemsWithPriceShift.length >= 4) {
      itemsWithPriceShift
        .sort(
          (a, b) =>
            Math.abs(b.costPrice - b.previousCost) -
            Math.abs(a.costPrice - a.previousCost),
        )
        .forEach((p) => {
          const deltaVal = roundMoney(p.costPrice - p.previousCost);
          const deltaPct = Number(
            ((deltaVal / Math.max(0.01, p.previousCost)) * 100).toFixed(1),
          );
          dumbbellItems.push({
            id: p.id,
            label: p.name,
            category: p.category,
            baselineVal: p.previousCost,
            currentVal: p.costPrice,
            deltaVal,
            deltaPct,
          });
        });
    } else {
      // Compare Cost Price vs Selling Price across categories
      dumbbellLabels = {
        baseline: 'متوسط التكلفة',
        current: 'متوسط سعر البيع',
        unit: settings.currency || '',
      };
      categories.forEach((cat) => {
        const catItems = productRecords.filter(
          (p) => p.category === cat.category && p.sellPrice > 0,
        );
        const avgCost =
          catItems.length > 0
            ? roundMoney(
                catItems.reduce((s, x) => s + x.costPrice, 0) / catItems.length,
              )
            : 0;
        const avgSell =
          catItems.length > 0
            ? roundMoney(
                catItems.reduce((s, x) => s + x.sellPrice, 0) / catItems.length,
              )
            : 0;
        const deltaVal = roundMoney(avgSell - avgCost);
        const deltaPct =
          avgCost > 0 ? Number(((deltaVal / avgCost) * 100).toFixed(1)) : 0;
        if (avgSell > 0 || avgCost > 0) {
          dumbbellItems.push({
            id: cat.category,
            label: cat.category,
            category: cat.category,
            baselineVal: avgCost,
            currentVal: avgSell,
            deltaVal,
            deltaPct,
          });
        }
      });
    }

    // 05 · Timeline Events & Milestones
    let timelineEvents: FolioTimelineEvent[] = [];
    let timelineUnitLabel = 'الإيرادات المحققة';

    if (multiInventoryTrends.length >= 2) {
      timelineEvents = multiInventoryTrends.map((tr) => ({
        id: String(tr.id),
        dateLabel: tr.fullDate,
        shortLabel: tr.shortName,
        value: tr.revenue,
        secondaryValue: tr.netProfit,
        title: `${tr.name}`,
        description: `مبيعات الدورة: ${
          showFinancials
            ? formatCurrency(tr.revenue, settings.currency, language)
            : '••••••'
        } · صافي الربح: ${
          showFinancials
            ? formatCurrency(tr.netProfit, settings.currency, language)
            : '••••••'
        }`,
      }));
    } else {
      timelineUnitLabel = 'إجمالي المشتريات الدورية';
      const byDayMap = new Map<
        string,
        { date: Date; total: number; count: number; suppliers: Set<string> }
      >();

      sortedPurchases.forEach((p: any) => {
        const d = safeParseDate(p.date || p.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const existing = byDayMap.get(key) || {
          date: d,
          total: 0,
          count: 0,
          suppliers: new Set<string>(),
        };
        existing.total = roundMoney(existing.total + Number(p.amount || 0));
        existing.count += 1;
        if (p.supplierName) existing.suppliers.add(p.supplierName);
        byDayMap.set(key, existing);
      });

      const dayEntries = Array.from(byDayMap.values())
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(-10);

      timelineEvents = dayEntries.map((entry, idx) => {
        const shortLabel = formatAppDate(entry.date, language, t, {
          day: 'numeric',
          month: 'short',
        });
        const fullDate = formatAppDate(entry.date, language, t, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        const supList = Array.from(entry.suppliers).slice(0, 2).join('، ');
        return {
          id: `day-${idx}`,
          dateLabel: fullDate,
          shortLabel,
          value: entry.total,
          secondaryValue: entry.count,
          title: supList ? `توريدات: ${supList}` : `دفعة مشتريات (${shortLabel})`,
          description: `تم تسجيل ${entry.count} بند شراء بقيمة إجمالية ${
            showFinancials
              ? formatCurrency(entry.total, settings.currency, language)
              : '••••••'
          }.`,
        };
      });
    }

    // 06 · Stacked Column Periods
    let stackedPeriods: FolioStackedPeriod[] = [];
    let stackedSeriesMeta: { key: string; label: string }[] = [];

    if (multiInventoryTrends.length >= 2) {
      stackedSeriesMeta = [
        { key: 'stockValue', label: 'رأس مال المخزون' },
        { key: 'revenue', label: 'المبيعات' },
        { key: 'profit', label: 'الأرباح' },
        { key: 'expenses', label: 'المصاريف' },
      ];
      stackedPeriods = multiInventoryTrends.slice(-8).map((tr) => {
        const segsRaw = [
          { key: 'stockValue', label: 'رأس مال المخزون', value: Math.max(0, tr.stockValue) },
          { key: 'revenue', label: 'المبيعات', value: Math.max(0, tr.revenue) },
          { key: 'profit', label: 'الأرباح', value: Math.max(0, tr.profit) },
          { key: 'expenses', label: 'المصاريف', value: Math.max(0, tr.expenses) },
        ];
        const total = Math.max(
          0.01,
          segsRaw.reduce((s, x) => s + x.value, 0),
        );
        return {
          id: String(tr.id),
          label: tr.shortName,
          total: roundMoney(total),
          segments: segsRaw.map((s) => ({
            ...s,
            pct: Number(((s.value / total) * 100).toFixed(1)),
          })),
        };
      });
    } else {
      // Top 4 categories across purchase months or current valuation tiers
      const top4Cats = categories.slice(0, 4).map((c) => c.category);
      if (top4Cats.length > 0 && sortedPurchases.length >= 2) {
        stackedSeriesMeta = top4Cats.map((c) => ({ key: c, label: c }));
        const prodCatMap = new Map<string, string>();
        productRecords.forEach((p) => {
          prodCatMap.set(p.name.toLowerCase(), p.category);
          if (p.barcode) prodCatMap.set(p.barcode.toLowerCase(), p.category);
        });

        const monthBuckets = new Map<string, { label: string; ts: number; map: Record<string, number> }>();
        sortedPurchases.forEach((p: any) => {
          const d = safeParseDate(p.date || p.createdAt);
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const mLabel = formatAppDate(d, language, t, { month: 'short', year: '2-digit' });
          const pName = String(p.productName || '').trim().toLowerCase();
          const pBar = String(p.barcode || '').trim().toLowerCase();
          const cat = prodCatMap.get(pName) || prodCatMap.get(pBar) || top4Cats[0];
          const bucketCat = top4Cats.includes(cat) ? cat : top4Cats[top4Cats.length - 1];

          const bucket = monthBuckets.get(mKey) || { label: mLabel, ts: d.getTime(), map: {} };
          bucket.map[bucketCat] = roundMoney((bucket.map[bucketCat] || 0) + Number(p.amount || 0));
          monthBuckets.set(mKey, bucket);
        });

        stackedPeriods = Array.from(monthBuckets.values())
          .sort((a, b) => a.ts - b.ts)
          .slice(-8)
          .map((b, idx) => {
            const total = Math.max(
              0.01,
              top4Cats.reduce((s, c) => s + (b.map[c] || 0), 0),
            );
            return {
              id: `m-${idx}`,
              label: b.label,
              total: roundMoney(total),
              segments: top4Cats.map((c) => {
                const val = b.map[c] || 0;
                return {
                  key: c,
                  label: c,
                  value: val,
                  pct: Number(((val / total) * 100).toFixed(1)),
                };
              }),
            };
          });
      }
      // If still < 2 periods, synthesize breakdown by stock status across top categories
      if (stackedPeriods.length < 2 && categories.length > 0) {
        stackedSeriesMeta = [
          { key: 'healthy', label: 'مخزون صحي' },
          { key: 'low', label: 'أوشك على النفاد' },
          { key: 'stagnant', label: 'راكد / فائض' },
          { key: 'depleted', label: 'نافد' },
        ];
        stackedPeriods = categories.slice(0, 6).map((c) => {
          const items = productRecords.filter((p) => p.category === c.category);
          const counts = {
            healthy: items.filter((i) => i.status === 'healthy').length,
            low: items.filter((i) => i.status === 'low').length,
            stagnant: items.filter((i) => i.status === 'stagnant').length,
            depleted: items.filter((i) => i.status === 'depleted').length,
          };
          const total = Math.max(1, items.length);
          return {
            id: c.category,
            label: c.category,
            total: items.length,
            segments: stackedSeriesMeta.map((s) => {
              const v = counts[s.key as keyof typeof counts];
              return {
                key: s.key,
                label: s.label,
                value: v,
                pct: Number(((v / total) * 100).toFixed(1)),
              };
            }),
          };
        });
      }
    }

    // 07 · Sortable Heatmap Matrix (Categories x 5 Normalized Metrics 0-100)
    const heatmapColumns = [
      { key: 'capitalShare', label: 'حصة رأس المال' },
      { key: 'avgMargin', label: 'هامش الربح' },
      { key: 'availability', label: 'معدل التوفر' },
      { key: 'stockHealth', label: 'صحة التغطية' },
      { key: 'activityScore', label: 'كثافة الحركة' },
    ];

    const maxCatValue = Math.max(1, ...categories.map((c) => c.totalValue));
    const maxCatActivity = Math.max(
      1,
      ...categories.map((c) =>
        productRecords
          .filter((p) => p.category === c.category)
          .reduce((s, x) => s + x.soldQty, 0),
      ),
    );

    const heatmapRows: FolioHeatmapRow[] = categories.slice(0, 10).map((c) => {
      const items = productRecords.filter((p) => p.category === c.category);
      const count = Math.max(1, items.length);
      const availableCount = items.filter((i) => i.stockQty > 0).length;
      const healthyCount = items.filter((i) => i.status === 'healthy').length;
      const activitySum = items.reduce((s, x) => s + x.soldQty, 0);

      const capitalScore = Math.min(100, Math.round((c.totalValue / maxCatValue) * 100));
      const marginScore = Math.min(100, Math.max(0, Math.round(c.avgMarginPct * 2))); // 50% margin -> 100 intensity
      const availScore = Math.round((availableCount / count) * 100);
      const healthScore = Math.round((healthyCount / count) * 100);
      const actScore = Math.min(100, Math.round((activitySum / maxCatActivity) * 100));

      const cells = [
        { key: 'capitalShare', label: 'حصة رأس المال', score: capitalScore, displayValue: `${c.sharePct}%` },
        { key: 'avgMargin', label: 'هامش الربح', score: marginScore, displayValue: `${c.avgMarginPct}%` },
        { key: 'availability', label: 'معدل التوفر', score: availScore, displayValue: `${availScore}%` },
        { key: 'stockHealth', label: 'صحة التغطية', score: healthScore, displayValue: `${healthScore}%` },
        { key: 'activityScore', label: 'كثافة الحركة', score: actScore, displayValue: `${actScore}%` },
      ];
      const overallScore = Math.round(
        cells.reduce((s, x) => s + x.score, 0) / cells.length,
      );
      return {
        category: c.category,
        cells,
        overallScore,
      };
    });

    // 08 · Diverging Stacked Bar (Profit Health Tiers per Category)
    const divergingRows: FolioDivergingRow[] = categories.slice(0, 8).map((c) => {
      const items = productRecords.filter((p) => p.category === c.category);
      const n = Math.max(1, items.length);
      const exc = items.filter((i) => i.marginPct >= 25).length;
      const good = items.filter((i) => i.marginPct >= 12 && i.marginPct < 25).length;
      const tight = items.filter((i) => i.marginPct > 0 && i.marginPct < 12).length;
      const risk = items.filter((i) => i.marginPct <= 0 || i.status === 'depleted').length;

      const excellentPct = Number(((exc / n) * 100).toFixed(1));
      const goodPct = Number(((good / n) * 100).toFixed(1));
      const tightPct = Number(((tight / n) * 100).toFixed(1));
      const riskPct = Number(((risk / n) * 100).toFixed(1));

      return {
        category: c.category,
        totalCount: items.length,
        excellentPct,
        goodPct,
        tightPct,
        riskPct,
        healthScore: Number((excellentPct + goodPct).toFixed(1)),
      };
    });

    // 09 · Scatter Plot Points (Velocity/Quantity vs Margin %)
    const scatterPoints: FolioScatterPoint[] = productRecords
      .filter((p) => p.sellPrice > 0 && p.costPrice > 0)
      .slice(0, 60)
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        x: canUseReportSnapshot ? p.soldQty : p.stockQty,
        y: p.marginPct,
        value: p.stockValue,
      }));

    const scatterAxisLabels = {
      x: canUseReportSnapshot ? 'الكمية المباعة (الدوران)' : 'الرصيد المتاح بالمخزن',
      y: 'هامش الربح %',
    };

    const totalValue = roundMoney(
      productRecords.reduce((acc, p) => acc + p.stockValue, 0),
    );
    const pricedRecords = productRecords.filter((p) => p.sellPrice > 0);
    const avgMarginPct =
      pricedRecords.length > 0
        ? Number(
            (
              pricedRecords.reduce((acc, p) => acc + p.marginPct, 0) /
              pricedRecords.length
            ).toFixed(1),
          )
        : 0;

    return {
      mode,
      modeLabel,
      modeDescription,
      totalProducts: productRecords.length,
      totalCategories: categories.length,
      totalValue,
      avgMarginPct,
      products: productRecords,
      categories,
      topCategoriesList,
      dumbbellItems,
      dumbbellLabels,
      timelineEvents,
      timelineUnitLabel,
      stackedPeriods,
      stackedSeriesMeta,
      heatmapRows,
      heatmapColumns,
      divergingRows,
      scatterPoints,
      scatterAxisLabels,
    };
  }, [
    inventoryReports,
    products,
    purchases,
    suppliers,
    analyzedItems,
    categoryBreakdown,
    multiInventoryTrends,
    settings.currency,
    settings.showFinancials,
    sourceMode,
    language,
    t,
  ]);
}

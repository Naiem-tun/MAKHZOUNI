import { doc, increment, serverTimestamp, collection, getDocs, getDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { roundMoney, cleanQuantity, safeParseDate } from './utils';
import { InventoryLayer, PriceHikeItem, PriceHikeSummary } from '../types';

export const PRICE_HIKE_COUNTER_DOC_PATH = (userId: string) =>
  `users/${userId}/active_stats/price_hike_since_last_jard`;

/**
 * Recalculates and synchronizes price hike impacts across past purchases
 * and updates the live counter in active_stats.
 */
export async function syncAndRecalculatePriceHikes(userId: string): Promise<number> {
  if (!userId) return 0;

  try {
    const counterRef = doc(db, PRICE_HIKE_COUNTER_DOC_PATH(userId));
    const counterSnap = await getDoc(counterRef);
    const counterData = counterSnap.data();
    const lastResetDate = counterData?.lastResetDate ? safeParseDate(counterData.lastResetDate) : null;

    const [purchasesSnap, productsSnap] = await Promise.all([
      getDocs(collection(db, `users/${userId}/purchases`)),
      getDocs(collection(db, `users/${userId}/products`))
    ]);

    if (purchasesSnap.empty) return 0;

    const productsList = productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const purchases = purchasesSnap.docs.map(d => ({
      id: d.id,
      ref: d.ref,
      ...d.data()
    } as any));

    // Group purchases by product identifier (barcode, name, or productId)
    // We evaluate all purchases to calculate cumulative price hike impacts
    const groups = new Map<string, any[]>();
    purchases.forEach(p => {
      const pDate = safeParseDate(p.date || p.createdAt);
      const bKey = (p.barcode || '').trim().toLowerCase();
      const nKey = (p.productName || '').trim().toLowerCase();
      const groupKey = bKey || nKey || p.productId || p.id;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push({ ...p, parsedDate: pDate });
    });

    let totalCalculatedHike = 0;
    const batch = writeBatch(db);
    let batchOperations = 0;

    groups.forEach((groupPurchases, groupKey) => {
      // Sort chronologically (oldest first)
      groupPurchases.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

      // Look up corresponding product to find lowest baseline price if available
      const matchingProduct = productsList.find(p => {
        const pb = (p.barcode || '').trim().toLowerCase();
        const pb2 = (p.barcode2 || '').trim().toLowerCase();
        const pn = (p.name || '').trim().toLowerCase();
        return (groupKey && (pb === groupKey || pb2 === groupKey || pn === groupKey));
      });

      let baselinePrice = 0;
      if (matchingProduct) {
        baselinePrice = Number(matchingProduct.purchasePrice || matchingProduct.costPrice || 0);
      }

      let runningPrice = baselinePrice;

      groupPurchases.forEach((p, idx) => {
        const qty = cleanQuantity(p.qtyAdded || p.quantityChange || 0);
        let piecePrice = Number(p.price || 0);
        if (!piecePrice && p.amount && qty > 0) {
          piecePrice = Number((p.amount / qty).toFixed(3));
        }

        if (idx === 0) {
          if (runningPrice > 0 && piecePrice > runningPrice && (piecePrice - runningPrice >= 0.010)) {
            const impact = roundMoney(qty * (piecePrice - runningPrice));
            totalCalculatedHike = roundMoney(totalCalculatedHike + impact);
            if (p.priceHikeImpact !== impact || p.previousPrice !== runningPrice) {
              batch.update(p.ref, {
                priceHikeImpact: impact,
                previousPrice: runningPrice
              });
              batchOperations++;
            }
          }
          if (piecePrice > 0) {
            runningPrice = runningPrice > 0 ? Math.min(runningPrice, piecePrice) : piecePrice;
          }
        } else {
          if (runningPrice > 0 && piecePrice > runningPrice && (piecePrice - runningPrice >= 0.010)) {
            const impact = roundMoney(qty * (piecePrice - runningPrice));
            totalCalculatedHike = roundMoney(totalCalculatedHike + impact);
            if (p.priceHikeImpact !== impact || p.previousPrice !== runningPrice) {
              batch.update(p.ref, {
                priceHikeImpact: impact,
                previousPrice: runningPrice
              });
              batchOperations++;
            }
            runningPrice = piecePrice;
          } else if (piecePrice > 0) {
            if (runningPrice === 0 || piecePrice < runningPrice) {
              runningPrice = piecePrice;
            }
          }
        }
      });
    });

    batch.set(counterRef, {
      currentAmount: totalCalculatedHike,
      lastUpdated: serverTimestamp()
    }, { merge: true });

    await batch.commit();
    return totalCalculatedHike;
  } catch (err) {
    console.error('Error in syncAndRecalculatePriceHikes:', err);
    return 0;
  }
}

export interface PriceHikeBatchDetail {
  id: string;
  productId?: string;
  productName: string;
  barcode?: string;
  date: Date;
  qty: number;
  newPrice: number;
  previousPrice: number;
  unitDiff: number;
  impact: number;
  supplierName?: string;
  note?: string;
}

export interface PriceHikeProductBreakdown {
  key: string;
  productId?: string;
  productName: string;
  barcode?: string;
  initialPrice: number;
  latestPrice: number;
  unitHike: number;
  totalHikedQty: number;
  totalLoss: number;
  batches: PriceHikeBatchDetail[];
}

export type PriceHikePeriod = 'all' | 'since_last_jard' | 'this_month';

export interface PriceHikeBreakdownResult {
  totalHike: number;
  totalProductsCount: number;
  totalBatchesCount: number;
  products: PriceHikeProductBreakdown[];
  allBatches: PriceHikeBatchDetail[];
  lastResetDate: Date | null;
  period: PriceHikePeriod;
}

/**
 * Retrieves the comprehensive breakdown of all products and purchase batches
 * that contributed to the price hike loss.
 * By default (period = 'all'), evaluates across all purchases without being cut off by the last inventory.
 */
export async function getPriceHikeBreakdown(
  userId: string,
  period: PriceHikePeriod = 'all'
): Promise<PriceHikeBreakdownResult> {
  if (!userId) {
    return {
      totalHike: 0,
      totalProductsCount: 0,
      totalBatchesCount: 0,
      products: [],
      allBatches: [],
      lastResetDate: null,
      period: 'all',
    };
  }

  try {
    const counterRef = doc(db, PRICE_HIKE_COUNTER_DOC_PATH(userId));
    const counterSnap = await getDoc(counterRef);
    const counterData = counterSnap.data();
    const lastResetDate = counterData?.lastResetDate ? safeParseDate(counterData.lastResetDate) : null;

    const [purchasesSnap, productsSnap] = await Promise.all([
      getDocs(collection(db, `users/${userId}/purchases`)),
      getDocs(collection(db, `users/${userId}/products`))
    ]);

    if (purchasesSnap.empty) {
      return {
        totalHike: 0,
        totalProductsCount: 0,
        totalBatchesCount: 0,
        products: [],
        allBatches: [],
        lastResetDate,
        period,
      };
    }

    const productsList = productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const purchases = purchasesSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as any));

    // Group purchases by product identifier (barcode, name, or productId)
    // We group ALL purchases so price transitions from the beginning are correctly tracked
    const groups = new Map<string, any[]>();
    purchases.forEach(p => {
      const pDate = safeParseDate(p.date || p.createdAt);
      const bKey = (p.barcode || '').trim().toLowerCase();
      const nKey = (p.productName || '').trim().toLowerCase();
      const groupKey = bKey || nKey || p.productId || p.id;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push({ ...p, parsedDate: pDate });
    });

    const productsResult: PriceHikeProductBreakdown[] = [];
    const allBatchesResult: PriceHikeBatchDetail[] = [];

    groups.forEach((groupPurchases, groupKey) => {
      // Sort chronologically (oldest first)
      groupPurchases.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

      // Look up corresponding product to find lowest baseline price if available
      const matchingProduct = productsList.find(p => {
        const pb = (p.barcode || '').trim().toLowerCase();
        const pb2 = (p.barcode2 || '').trim().toLowerCase();
        const pn = (p.name || '').trim().toLowerCase();
        return (groupKey && (pb === groupKey || pb2 === groupKey || pn === groupKey));
      });

      let baselinePrice = 0;
      if (matchingProduct) {
        baselinePrice = Number(matchingProduct.purchasePrice || matchingProduct.costPrice || 0);
      }

      let runningPrice = baselinePrice;
      const productBatches: PriceHikeBatchDetail[] = [];

      groupPurchases.forEach((p, idx) => {
        const qty = cleanQuantity(p.qtyAdded || p.quantityChange || 0);
        let piecePrice = Number(p.price || 0);
        if (!piecePrice && p.amount && qty > 0) {
          piecePrice = Number((p.amount / qty).toFixed(3));
        }

        let recordedImpact = Number(p.priceHikeImpact || 0);
        let prevPrice = Number(p.previousPrice || runningPrice);

        // Check if there is an increase over running price
        if (runningPrice > 0 && piecePrice > runningPrice && (piecePrice - runningPrice >= 0.010)) {
          const calculatedImpact = roundMoney(qty * (piecePrice - runningPrice));
          recordedImpact = calculatedImpact;
          prevPrice = runningPrice;
          runningPrice = piecePrice;
        } else if (recordedImpact > 0 && prevPrice > 0) {
          if (piecePrice > 0) runningPrice = piecePrice;
        } else {
          if (piecePrice > 0) {
            if (runningPrice === 0 || piecePrice < runningPrice) {
              runningPrice = piecePrice;
            }
          }
        }

        if (recordedImpact > 0 && qty > 0) {
          let matchesPeriod = true;
          if (period === 'since_last_jard' && lastResetDate) {
            matchesPeriod = p.parsedDate.getTime() >= lastResetDate.getTime();
          } else if (period === 'this_month') {
            const now = new Date();
            matchesPeriod = (
              p.parsedDate.getFullYear() === now.getFullYear() &&
              p.parsedDate.getMonth() === now.getMonth()
            );
          }

          if (matchesPeriod) {
            const batchDetail: PriceHikeBatchDetail = {
              id: p.id,
              productId: p.productId || matchingProduct?.id,
              productName: p.productName || matchingProduct?.name || 'منتج غير معروف',
              barcode: p.barcode || matchingProduct?.barcode || '',
              date: p.parsedDate,
              qty,
              newPrice: piecePrice,
              previousPrice: prevPrice,
              unitDiff: roundMoney(piecePrice - prevPrice),
              impact: recordedImpact,
              supplierName: p.supplierName || '',
              note: p.note || '',
            };
            productBatches.push(batchDetail);
            allBatchesResult.push(batchDetail);
          }
        }
      });

      if (productBatches.length > 0) {
        const totalLoss = roundMoney(productBatches.reduce((acc, b) => acc + b.impact, 0));
        const totalHikedQty = productBatches.reduce((acc, b) => acc + b.qty, 0);
        const initialPrice = productBatches[0].previousPrice;
        const latestPrice = productBatches[productBatches.length - 1].newPrice;
        const unitHike = roundMoney(latestPrice - initialPrice);

        productsResult.push({
          key: groupKey,
          productId: productBatches[0].productId,
          productName: productBatches[0].productName,
          barcode: productBatches[0].barcode,
          initialPrice,
          latestPrice,
          unitHike,
          totalHikedQty,
          totalLoss,
          batches: productBatches,
        });
      }
    });

    // Sort products by total loss descending
    productsResult.sort((a, b) => b.totalLoss - a.totalLoss);

    // Sort batches by date descending (newest first)
    allBatchesResult.sort((a, b) => b.date.getTime() - a.date.getTime());

    const totalHike = roundMoney(productsResult.reduce((acc, p) => acc + p.totalLoss, 0));

    return {
      totalHike,
      totalProductsCount: productsResult.length,
      totalBatchesCount: allBatchesResult.length,
      products: productsResult,
      allBatches: allBatchesResult,
      lastResetDate,
      period,
    };
  } catch (err) {
    console.error('Error in getPriceHikeBreakdown:', err);
    return {
      totalHike: 0,
      totalProductsCount: 0,
      totalBatchesCount: 0,
      products: [],
      allBatches: [],
      lastResetDate: null,
      period,
    };
  }
}

/**
 * Calculate impact of a purchase on the price hike counter.
 * Rule: First purchase for a product with no prior cost has 0 impact.
 * Minimum price increase threshold is 0.010 TND.
 */
export function calculatePurchaseImpact(
  qtyAdded: number,
  piecePrice: number,
  previousPrice?: number | null
): number {
  const cleanQty = cleanQuantity(qtyAdded);
  if (cleanQty <= 0) return 0;
  if (previousPrice === undefined || previousPrice === null || previousPrice <= 0) {
    return 0; // First purchase of product or no prior cost has 0 impact
  }

  const diff = piecePrice - previousPrice;
  if (diff >= 0.010) {
    return roundMoney(cleanQty * diff);
  }
  return 0;
}

export interface EvaluateItemInput {
  productId: string;
  productName: string;
  barcode: string;
  openingLayers: InventoryLayer[];
  periodPurchases: any[];
  quantityBefore: number;
  quantityAfter: number;
  sellingPrice: number;
  fallbackPurchasePrice: number;
  matchType?: 'barcode' | 'id' | 'name';
}

export interface EvaluatedItemResult {
  productId: string;
  productName: string;
  barcode: string;
  sold: number;
  batchCost: number;
  latestCost: number;
  loss: number;
  bookProfit: number;
  revenue: number;
  remainingLayers: InventoryLayer[];
  matchType: 'barcode' | 'id' | 'name';
  isCountingError: boolean;
}

/**
 * Evaluates FIFO layer consumption and price hike loss for a single inventory item.
 */
export function evaluateItemPriceHike(input: EvaluateItemInput): EvaluatedItemResult {
  const {
    productId,
    productName,
    barcode,
    openingLayers = [],
    periodPurchases = [],
    quantityBefore = 0,
    quantityAfter = 0,
    sellingPrice = 0,
    fallbackPurchasePrice = 0,
    matchType = 'barcode',
  } = input;

  // Calculate purchases in this period
  const periodPurchasedQty = periodPurchases.reduce(
    (acc, p) => acc + cleanQuantity(p.qtyAdded || p.quantityChange || 0),
    0
  );

  // Sold equation: sold = quantityBefore + periodPurchases - quantityAfter
  const sold = cleanQuantity(quantityBefore + periodPurchasedQty - quantityAfter);

  // Sort period purchases chronologically
  const sortedPurchases = [...periodPurchases].sort((a, b) => {
    const timeA = safeParseDate(a.date).getTime();
    const timeB = safeParseDate(b.date).getTime();
    return timeA - timeB;
  });

  // Find latest purchase cost
  let latestCost = roundMoney(fallbackPurchasePrice || 0);
  if (sortedPurchases.length > 0) {
    const newestPurchase = sortedPurchases[sortedPurchases.length - 1];
    latestCost = roundMoney(newestPurchase.price || newestPurchase.purchasePrice || latestCost);
  } else if (openingLayers.length > 0) {
    const newestLayer = openingLayers[openingLayers.length - 1];
    latestCost = roundMoney(newestLayer.cost || latestCost);
  }

  // Construct FIFO queue: openingLayers first, then period purchases
  const fifoQueue: InventoryLayer[] = [];

  openingLayers.forEach((layer) => {
    if (layer.qty > 0) {
      fifoQueue.push({
        qty: cleanQuantity(layer.qty),
        cost: roundMoney(layer.cost),
        date: layer.date,
      });
    }
  });

  sortedPurchases.forEach((p) => {
    const pQty = cleanQuantity(p.qtyAdded || p.quantityChange || 0);
    const pCost = roundMoney(p.price || p.purchasePrice || latestCost);
    if (pQty > 0) {
      fifoQueue.push({
        qty: pQty,
        cost: pCost,
        date: p.date,
      });
    }
  });

  // If sold <= 0: no sales occurred or count surplus/error
  if (sold <= 0) {
    return {
      productId,
      productName,
      barcode,
      sold: Math.max(0, sold),
      batchCost: latestCost,
      latestCost,
      loss: 0,
      bookProfit: 0,
      revenue: 0,
      remainingLayers: fifoQueue.filter((l) => l.qty > 0),
      matchType,
      isCountingError: sold < 0,
    };
  }

  // Consume FIFO layers
  let remainingSold = sold;
  let totalBatchCostValue = 0;
  let totalItemLoss = 0;

  for (let i = 0; i < fifoQueue.length; i++) {
    if (remainingSold <= 0) break;
    const layer = fifoQueue[i];
    if (layer.qty <= 0) continue;

    const consumed = Math.min(layer.qty, remainingSold);
    const layerCost = roundMoney(layer.cost);

    // loss for this layer: consumed * (latestCost - layerCost)
    const layerLoss = roundMoney(consumed * (latestCost - layerCost));

    totalBatchCostValue = roundMoney(totalBatchCostValue + consumed * layerCost);
    totalItemLoss = roundMoney(totalItemLoss + layerLoss);

    layer.qty = cleanQuantity(layer.qty - consumed);
    remainingSold = cleanQuantity(remainingSold - consumed);
  }

  // If sold exceeded tracked layers (untracked opening stock)
  if (remainingSold > 0) {
    const fallbackCost = roundMoney(fallbackPurchasePrice || latestCost);
    const layerLoss = roundMoney(remainingSold * (latestCost - fallbackCost));

    totalBatchCostValue = roundMoney(totalBatchCostValue + remainingSold * fallbackCost);
    totalItemLoss = roundMoney(totalItemLoss + layerLoss);
    remainingSold = 0;
  }

  const revenue = roundMoney(sold * sellingPrice);
  const bookProfit = roundMoney(revenue - totalBatchCostValue);
  const effectiveBatchCost = sold > 0 ? roundMoney(totalBatchCostValue / sold) : latestCost;
  const remainingLayers = fifoQueue.filter((l) => l.qty > 0);

  return {
    productId,
    productName,
    barcode,
    sold,
    batchCost: effectiveBatchCost,
    latestCost,
    loss: totalItemLoss,
    bookProfit,
    revenue,
    remainingLayers,
    matchType,
    isCountingError: false,
  };
}

/**
 * Aggregates all items to produce the total PriceHikeSummary for the inventory report.
 */
export function calculatePriceHikeSummary(
  evaluatedItems: EvaluatedItemResult[],
  priceHikeSinceLastJard: number = 0,
  isEstimatedOpening: boolean = false
): PriceHikeSummary {
  let totalBookProfit = 0;
  let totalPriceHikeLoss = 0;

  const validItems = evaluatedItems.filter((it) => !it.isCountingError && it.sold > 0);

  validItems.forEach((it) => {
    totalBookProfit = roundMoney(totalBookProfit + it.bookProfit);
    totalPriceHikeLoss = roundMoney(totalPriceHikeLoss + it.loss);
  });

  const realProfit = roundMoney(totalBookProfit - totalPriceHikeLoss);

  // Top 10 items with positive price hike losses only, sorted descending
  const topImpactedItems: PriceHikeItem[] = validItems
    .filter((it) => it.loss > 0)
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 10)
    .map((it) => ({
      productId: it.productId,
      productName: it.productName,
      barcode: it.barcode,
      batchCost: roundMoney(it.batchCost),
      latestCost: roundMoney(it.latestCost),
      sold: it.sold,
      loss: roundMoney(it.loss),
      matchType: it.matchType,
    }));

  return {
    totalBookProfit,
    totalPriceHikeLoss,
    realProfit,
    priceHikeSinceLastJard: roundMoney(priceHikeSinceLastJard),
    topImpactedItems,
    isEstimatedOpening,
  };
}

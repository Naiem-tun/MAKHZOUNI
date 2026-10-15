import { Product, Transaction } from '../types';
import { cleanQuantity, formatQuantity } from './utils';

export interface VarianceBatchItem {
  productId: string;
  productName: string;
  quantity: number; // in pieces
  piecesPerBox: number;
  boxPurchasePrice: number;
  piecePrice: number;
  isReference: boolean;
  batchLoss: number;
  supplierName: string;
  supplierId?: string;
  barcode?: string;
}

export interface VarianceProductGroup {
  groupKey: string;
  name: string;
  barcode?: string;
  matchedByName: boolean;
  totalQuantity: number; // in pieces
  piecesPerBox: number;
  minPiecePrice: number;
  maxPiecePrice: number;
  minBoxPrice: number;
  maxBoxPrice: number;
  boxPriceDifference: number;
  totalLoss: number;
  cheapestBatchSaving: number;
  batches: VarianceBatchItem[];
}

export interface AffectedBatchSummary {
  productName: string;
  quantity: number;
  piecesPerBox: number;
  boxPrice: number;
  piecePrice: number;
  minPiecePrice: number;
  batchLoss: number;
}

export interface SupplierVarianceSummary {
  supplierId: string;
  supplierName: string;
  totalLoss: number;
  affectedProductsCount: number;
  affectedBatches: AffectedBatchSummary[];
}

export interface PurchaseVarianceAnalysisResult {
  totalPurchasesLoss: number;
  totalCheapestBatchSavings: number;
  affectedProductsCount: number;
  totalProductsAnalyzed: number;
  productGroups: VarianceProductGroup[];
  lossMakingSuppliers: SupplierVarianceSummary[];
}

/**
 * تنسيق الكمية بالكرتونة والقطع بوضوح
 * مثال: "1 كرتونة و 10 قطع" أو "3 كرتونة" أو "10 قطع"
 */
export function formatBoxesAndPieces(totalPieces: number, piecesPerBox: number = 1): string {
  const cleanTotal = cleanQuantity(totalPieces);
  const ppb = piecesPerBox > 1 ? piecesPerBox : 1;

  if (ppb <= 1) {
    return `${formatQuantity(cleanTotal)} قطعة`;
  }

  const boxes = Math.floor(cleanTotal / ppb);
  const remPieces = cleanQuantity(cleanTotal % ppb);

  if (boxes > 0 && remPieces > 0) {
    return `${boxes} كرتونة و ${formatQuantity(remPieces)} قطعة`;
  }
  if (boxes > 0 && remPieces === 0) {
    return `${boxes} كرتونة`;
  }
  if (boxes === 0 && remPieces > 0) {
    return `${formatQuantity(remPieces)} قطعة`;
  }
  return '0 قطعة';
}

/**
 * محرك تحليل خسائر وفروقات شراء المخزون الحالي
 * Purchases Price Variance Analysis Engine
 */
export function calculatePurchaseVariance(
  products: Product[],
  allPurchases: Transaction[] = []
): PurchaseVarianceAnalysisResult {
  // 1. خريطة استرجاع أحدث مورد لكل منتج
  const productSupplierMap = new Map<string, { supplierName: string; supplierId?: string }>();
  for (const purchase of allPurchases) {
    const pid = purchase.productId;
    if (pid && !productSupplierMap.has(pid)) {
      if (purchase.supplierName) {
        productSupplierMap.set(pid, {
          supplierName: purchase.supplierName,
          supplierId: purchase.supplierId,
        });
      }
    }
  }

  // 2. تجميع المنتجات مع استبعاد الكميات <= 0
  const groupsMap = new Map<string, {
    groupKey: string;
    name: string;
    barcode?: string;
    matchedByName: boolean;
    rawProducts: Product[];
  }>();

  for (const p of products) {
    const qty = cleanQuantity(p.quantity);
    if (qty <= 0) {
      continue; // استبعاد كامل لأي كمية صفريّة أو سالبة
    }

    const b1 = p.barcode?.trim();
    const b2 = p.barcode2?.trim();
    const cleanBarcode = b1 || b2;

    let groupKey: string;
    let matchedByName = false;

    if (cleanBarcode) {
      groupKey = `barcode:${cleanBarcode.toLowerCase()}`;
    } else {
      const cleanName = (p.name || 'بدون اسم').trim().toLowerCase();
      groupKey = `name:${cleanName}`;
      matchedByName = true;
    }

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        groupKey,
        name: p.name || 'بدون اسم',
        barcode: cleanBarcode || undefined,
        matchedByName,
        rawProducts: [],
      });
    }

    groupsMap.get(groupKey)!.rawProducts.push(p);
  }

  // 3. تحليل وحساب المعادلات لكل مجموعة أصناف
  const productGroups: VarianceProductGroup[] = [];
  const supplierLossMap = new Map<string, {
    supplierId: string;
    supplierName: string;
    totalLoss: number;
    affectedProductNames: Set<string>;
    affectedBatches: AffectedBatchSummary[];
  }>();

  let overallTotalLoss = 0;
  let overallTotalSavings = 0;

  for (const group of groupsMap.values()) {
    const batches: VarianceBatchItem[] = [];

    for (const p of group.rawProducts) {
      const ppb = (p.piecesPerBox && p.piecesPerBox > 0) ? p.piecesPerBox : 1;
      const boxPrice = (p.boxPurchasePrice && p.boxPurchasePrice > 0)
        ? p.boxPurchasePrice
        : (Number(p.purchasePrice || p.costPrice || 0) * ppb);
      const piecePrice = boxPrice / ppb;
      const quantityInPieces = cleanQuantity(p.quantity);

      const supplierInfo = p.id ? productSupplierMap.get(p.id) : undefined;
      const supplierName = supplierInfo?.supplierName || 'غير محدد';
      const supplierId = supplierInfo?.supplierId;

      batches.push({
        productId: p.id || '',
        productName: p.name || group.name,
        quantity: quantityInPieces,
        piecesPerBox: ppb,
        boxPurchasePrice: boxPrice,
        piecePrice,
        isReference: false,
        batchLoss: 0,
        supplierName,
        supplierId,
        barcode: p.barcode || p.barcode2,
      });
    }

    if (batches.length === 0) continue;

    // أدنى وأعلى سعر قطعة في الدفعات ذات الكمية الموجبة
    let minPiecePrice = batches[0].piecePrice;
    let maxPiecePrice = batches[0].piecePrice;
    let totalQuantity = 0;

    for (const b of batches) {
      totalQuantity += b.quantity;
      if (b.piecePrice < minPiecePrice) minPiecePrice = b.piecePrice;
      if (b.piecePrice > maxPiecePrice) maxPiecePrice = b.piecePrice;
    }

    // تمييز الدفعات المرجعية وحساب خسارة كل دفعة
    let groupTotalLoss = 0;
    let refBatchesQty = 0;

    for (const b of batches) {
      const isRef = Math.abs(b.piecePrice - minPiecePrice) < 0.00001;
      b.isReference = isRef;

      if (isRef) {
        b.batchLoss = 0;
        refBatchesQty += b.quantity;
      } else {
        // احتساب دقيق دون تقريب وسيط
        const diff = b.piecePrice - minPiecePrice;
        const loss = b.quantity * diff;
        b.batchLoss = loss > 0 ? loss : 0;
        groupTotalLoss += b.batchLoss;

        // ربط الخسارة بالمورد المتسبب بها
        const supKey = b.supplierId || b.supplierName;
        if (!supplierLossMap.has(supKey)) {
          supplierLossMap.set(supKey, {
            supplierId: b.supplierId || 'unknown',
            supplierName: b.supplierName,
            totalLoss: 0,
            affectedProductNames: new Set<string>(),
            affectedBatches: [],
          });
        }
        const supEntry = supplierLossMap.get(supKey)!;
        supEntry.totalLoss += b.batchLoss;
        supEntry.affectedProductNames.add(group.name);
        supEntry.affectedBatches.push({
          productName: group.name,
          quantity: b.quantity,
          piecesPerBox: b.piecesPerBox,
          boxPrice: b.boxPurchasePrice,
          piecePrice: b.piecePrice,
          minPiecePrice,
          batchLoss: b.batchLoss,
        });
      }
    }

    // حساب توفير الدفعة الأرخص (للعلم)
    // refBatch.quantityInPieces * (maxPiecePrice - minPiecePrice)
    const cheapestBatchSaving = (batches.length > 1 && maxPiecePrice > minPiecePrice)
      ? refBatchesQty * (maxPiecePrice - minPiecePrice)
      : 0;

    // تمثيل سعر الكرتونة بناءً على ppb المجموعة
    const representativePpb = batches[0].piecesPerBox;
    const minBoxPrice = minPiecePrice * representativePpb;
    const maxBoxPrice = maxPiecePrice * representativePpb;
    const boxPriceDifference = Math.max(0, maxBoxPrice - minBoxPrice);

    overallTotalLoss += groupTotalLoss;
    overallTotalSavings += cheapestBatchSaving;

    productGroups.push({
      groupKey: group.groupKey,
      name: group.name,
      barcode: group.barcode,
      matchedByName: group.matchedByName,
      totalQuantity,
      piecesPerBox: representativePpb,
      minPiecePrice,
      maxPiecePrice,
      minBoxPrice,
      maxBoxPrice,
      boxPriceDifference,
      totalLoss: groupTotalLoss,
      cheapestBatchSaving,
      batches: batches.sort((a, b) => b.batchLoss - a.batchLoss), // الأعلى خسارة أولاً
    });
  }

  // فرز الأصناف: الأعلى خسارة أولاً
  productGroups.sort((a, b) => b.totalLoss - a.totalLoss);

  // تصفية الموردين: الذين تسببوا في خسارة فقط (totalLoss > 0.0001) مرتبين تنازلياً
  const lossMakingSuppliers: SupplierVarianceSummary[] = Array.from(supplierLossMap.values())
    .filter(s => s.totalLoss > 0.0001)
    .map(s => ({
      supplierId: s.supplierId,
      supplierName: s.supplierName,
      totalLoss: s.totalLoss,
      affectedProductsCount: s.affectedProductNames.size,
      affectedBatches: s.affectedBatches.sort((a, b) => b.batchLoss - a.batchLoss),
    }))
    .sort((a, b) => b.totalLoss - a.totalLoss);

  const affectedProductsCount = productGroups.filter(g => g.totalLoss > 0.0001).length;

  return {
    totalPurchasesLoss: overallTotalLoss,
    totalCheapestBatchSavings: overallTotalSavings,
    affectedProductsCount,
    totalProductsAnalyzed: productGroups.length,
    productGroups,
    lossMakingSuppliers,
  };
}

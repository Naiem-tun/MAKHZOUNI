import { Product } from '../types';
import { roundMoney, cleanQuantity } from './utils';

export type PriceIssueType = 
  | 'loss_making'               // بيع بخسارة (سعر البيع <= سعر الشراء)
  | 'excessive_margin'          // هامش ربح ضخم غير منطقي (شبهة وضع سعر العلبة للقطعة)
  | 'box_entered_as_piece'      // سعر شراء العلبة وضع في سعر شراء القطعة
  | 'box_piece_mismatch'        // عدم تطابق سعر العلبة وسعر القطع
  | 'zero_missing';             // أسعار مفقودة أو صفرية

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface SuggestedFix {
  id: string;
  label: string;
  description: string;
  patch: Partial<Product>;
}

export interface ProductPriceAudit {
  product: Product;
  hasIssues: boolean;
  unfilteredHasIssues: boolean;
  isVerified: boolean;
  issues: {
    type: PriceIssueType;
    severity: IssueSeverity;
    title: string;
    description: string;
  }[];
  profitPerPiece: number;
  profitMarginPercent: number;
  suggestedFixes: SuggestedFix[];
}

export function auditProduct(product: Product): ProductPriceAudit {
  const issues: ProductPriceAudit['issues'] = [];
  const suggestedFixes: SuggestedFix[] = [];

  const piecesPerBox = Number(product.piecesPerBox) || 1;
  const purchasePrice = Number(product.purchasePrice) || 0;
  const sellingPrice = Number(product.sellingPrice) || 0;
  const boxPurchasePrice = Number(product.boxPurchasePrice) || 0;
  const boxSellingPrice = Number(product.boxSellingPrice) || 0;

  const profitPerPiece = roundMoney(sellingPrice - purchasePrice);
  const profitMarginPercent = purchasePrice > 0 
    ? roundMoney(((sellingPrice - purchasePrice) / purchasePrice) * 100) 
    : 0;

  // 1. Check for Zero or Missing Prices
  if (purchasePrice <= 0 || sellingPrice <= 0) {
    issues.push({
      type: 'zero_missing',
      severity: 'error',
      title: 'سعر مفقود أو يساوي صفر',
      description: purchasePrice <= 0 && sellingPrice <= 0
        ? 'سعر الشراء وسعر البيع كلاهما 0 أو غير محددين.'
        : purchasePrice <= 0 
          ? 'سعر الشراء غير محدد (0).' 
          : 'سعر البيع غير محدد (0).'
    });
  }

  // 2. Check for Loss Making (Selling Price <= Purchase Price)
  if (sellingPrice > 0 && purchasePrice > 0 && sellingPrice <= purchasePrice) {
    // Check if the user possibly entered the BOX purchase price in the PIECE purchase price field!
    if (piecesPerBox > 1 && (purchasePrice / piecesPerBox) < sellingPrice) {
      const pieceCostFromBox = roundMoney(purchasePrice / piecesPerBox);
      issues.push({
        type: 'box_entered_as_piece',
        severity: 'error',
        title: 'شبهة تسجيل سعر شراء العلبة كـ سعر للقطعة',
        description: `سعر الشراء الحالي (${purchasePrice}) أكبر من سعر البيع (${sellingPrice})، ولكن عند قسمته على ${piecesPerBox} قطع يصبح سعر شراء القطعة (${pieceCostFromBox}) وهو أقل من سعر البيع.`
      });

      suggestedFixes.push({
        id: 'fix-box-purchase-as-piece',
        label: `جعل سعر شراء القطعة = ${pieceCostFromBox} وسعر العلبة = ${purchasePrice}`,
        description: `توزيع سعر الشراء (${purchasePrice}) على ${piecesPerBox} قطع`,
        patch: {
          purchasePrice: pieceCostFromBox,
          boxPurchasePrice: purchasePrice,
        }
      });
    } else {
      issues.push({
        type: 'loss_making',
        severity: 'error',
        title: 'بيع بخسارة أو بدون ربح',
        description: `سعر البيع (${sellingPrice}) أقل من أو يساوي سعر الشراء (${purchasePrice}). هامش الخسارة: ${profitPerPiece}`
      });
    }
  }

  // 3. Check for Suspected Box Selling Price entered as Piece Selling Price (Excessive Margin)
  if (sellingPrice > 0 && purchasePrice > 0 && sellingPrice > purchasePrice) {
    // Condition A: Pieces per box > 1 and selling price is near or exceeds the whole box value (markup > 180%)
    if (piecesPerBox > 1 && (profitMarginPercent >= 180 || (sellingPrice / purchasePrice) >= (piecesPerBox * 0.75))) {
      const pieceSellFromBox = roundMoney(sellingPrice / piecesPerBox);
      const pieceMarginIfFixed = purchasePrice > 0 ? roundMoney(((pieceSellFromBox - purchasePrice) / purchasePrice) * 100) : 0;

      issues.push({
        type: 'excessive_margin',
        severity: 'warning',
        title: 'شبهة وضع سعر بيع العلبة كاملة كسعر للقطعة الواحدة',
        description: `هامش الربح مرتفع جداً (${profitMarginPercent}%). هل سعر البيع (${sellingPrice}) هو سعر العلبة كاملة (${piecesPerBox} قطع) بدلاً من القطعة الواحدة؟`
      });

      if (pieceSellFromBox > purchasePrice) {
        suggestedFixes.push({
          id: 'fix-box-selling-as-piece',
          label: `جعل سعر بيع القطعة = ${pieceSellFromBox} وسعر العلبة = ${sellingPrice}`,
          description: `تقسيم سعر البيع (${sellingPrice}) على ${piecesPerBox} قطع (ربح القطعة: ${roundMoney(pieceSellFromBox - purchasePrice)} [${pieceMarginIfFixed}%])`,
          patch: {
            sellingPrice: pieceSellFromBox,
            boxSellingPrice: sellingPrice,
          }
        });
      }
    } else if (profitMarginPercent >= 300) {
      // General extreme markup for products even without piecesPerBox
      issues.push({
        type: 'excessive_margin',
        severity: 'warning',
        title: 'هامش ربح مرتفع بشكل استثنائي',
        description: `هامش الربح يبلغ (${profitMarginPercent}%)، يُرجى التأكد من عدم وجود صفر إضافي أو خلط بين القطعة والكرتونة.`
      });
    }
  }

  // 4. Check for Box vs Piece Mismatch (Box purchase price vs piece purchase price * piecesPerBox)
  if (piecesPerBox > 1 && boxPurchasePrice > 0 && purchasePrice > 0) {
    const calculatedBoxPrice = roundMoney(purchasePrice * piecesPerBox);
    const diff = Math.abs(boxPurchasePrice - calculatedBoxPrice);
    const diffPercent = (diff / boxPurchasePrice) * 100;

    if (diffPercent > 5) {
      const calculatedPiecePrice = roundMoney(boxPurchasePrice / piecesPerBox);
      issues.push({
        type: 'box_piece_mismatch',
        severity: 'info',
        title: 'اختلاف بين سعر شراء العلبة وسعر شراء القطعة',
        description: `سعر العلبة المسجل (${boxPurchasePrice}) لا يطابق حاصل ضرب سعر القطعة (${purchasePrice} × ${piecesPerBox} = ${calculatedBoxPrice}).`
      });

      suggestedFixes.push({
        id: 'sync-piece-from-box',
        label: `مزامنة سعر القطعة من العلبة (${calculatedPiecePrice})`,
        description: `اعتماد سعر العلبة ${boxPurchasePrice} وتقسيمه على ${piecesPerBox} قطع`,
        patch: {
          purchasePrice: calculatedPiecePrice,
        }
      });

      suggestedFixes.push({
        id: 'sync-box-from-piece',
        label: `مزامنة سعر العلبة من القطعة (${calculatedBoxPrice})`,
        description: `اعتماد سعر القطعة ${purchasePrice} وضربه في ${piecesPerBox} قطع`,
        patch: {
          boxPurchasePrice: calculatedBoxPrice,
        }
      });
    }
  }

  const isVerified = Boolean(product.priceVerified);
  const unfilteredHasIssues = issues.length > 0;
  const hasIssues = unfilteredHasIssues && !isVerified;

  return {
    product,
    isVerified,
    hasIssues,
    unfilteredHasIssues,
    issues,
    profitPerPiece,
    profitMarginPercent,
    suggestedFixes
  };
}

export function auditAllProducts(products: Product[]): ProductPriceAudit[] {
  return products.map(auditProduct);
}

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Upload, 
  Camera, 
  Sparkles, 
  Check, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Loader2, 
  Building2, 
  DollarSign, 
  X, 
  Search, 
  RefreshCw,
  CheckCircle2,
  Calendar,
  CreditCard,
  PackageCheck,
  GitMerge,
  Link2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Copy,
  Key,
  Lock
} from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { Product, Supplier, GoodsReceipt } from '../../types';
import { collection, addDoc, updateDoc, doc, setDoc, serverTimestamp, writeBatch, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';
import { logAudit } from '../../lib/auditLogger';
import { getLocalImage, saveLocalImage } from '../../lib/localImages';
import { scanInvoiceWithGemini } from '../../lib/geminiScan';

interface ExtractedItem {
  id: string;
  name: string;
  originalInvoiceName?: string;
  barcode?: string;
  unitType: 'carton' | 'piece';
  piecesPerBox: number;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  total: number;
  matchedProductId?: string;
  matchedProductName?: string;
  isNewProduct?: boolean;
  copiedFromProductId?: string;
}

function cleanTextForMatch(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u0600-\u06FF]/gi, ' ')
    .replace(/\s+/g, ' ');
}

function findSmartSuggestions(
  itemText: string,
  itemBarcode: string | undefined,
  products: Product[],
  currentMatchedId?: string,
  limit = 2
): Array<{ product: Product; score: number; reason: string }> {
  if (!itemText && !itemBarcode) return [];

  const rawTarget = (itemText || '').trim().toLowerCase();
  const cleanTarget = cleanTextForMatch(rawTarget);
  const targetTokens = cleanTarget.split(/\s+/).filter(t => t.length >= 2);
  const cleanBc = (itemBarcode || '').trim();

  const results: Array<{ product: Product; score: number; reason: string }> = [];

  for (const p of products) {
    if (p.id === currentMatchedId) continue;
    let score = 0;
    let reason = '';

    // 1. Barcode match
    if (cleanBc && (p.barcode === cleanBc || p.barcode2 === cleanBc)) {
      score += 100;
      reason = 'تطابق باركود';
    }

    // 2. Exact or substring match in Aliases
    if (p.aliases && p.aliases.length > 0) {
      for (const a of p.aliases) {
        const cleanA = cleanTextForMatch(a);
        if (cleanA === cleanTarget) {
          score += 95;
          reason = 'اسم بديل مطابق';
          break;
        } else if (cleanA.length >= 3 && (cleanTarget.includes(cleanA) || cleanA.includes(cleanTarget))) {
          score += 80;
          reason = 'اسم بديل محفوظ';
          break;
        }
      }
    }

    // 3. Name full or substring match
    const pCleanName = cleanTextForMatch(p.name);
    if (pCleanName === cleanTarget) {
      score += 90;
      reason = reason || 'تطابق اسم كامل';
    } else if (pCleanName.includes(cleanTarget) || cleanTarget.includes(pCleanName)) {
      score += 65;
      reason = reason || 'تطابق جزئي للاسم';
    }

    // 4. Token Overlap
    const pTokens = pCleanName.split(/\s+/).filter(t => t.length >= 2);
    let matchedTokens = 0;
    for (const t of targetTokens) {
      if (pTokens.some(pt => pt === t || pt.includes(t) || t.includes(pt))) {
        matchedTokens++;
      }
    }

    if (matchedTokens > 0) {
      const tokenScore = Math.round((matchedTokens / Math.max(targetTokens.length, 1)) * 40);
      score += tokenScore;
      if (!reason && matchedTokens >= 2) {
        reason = `${matchedTokens} كلمات مشتركة`;
      }
    }

    if (score >= 35) {
      results.push({ product: p, score, reason: reason || 'تشابه بالاسم' });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function ProductPairSelector({
  item,
  products,
  onPair,
  isCardMode = false,
}: {
  item: ExtractedItem;
  products: Product[];
  onPair: (itemId: string, selectedProductId: string) => void;
  isCardMode?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const matchedProduct = item.matchedProductId
    ? products.find(p => p.id === item.matchedProductId)
    : null;

  // Smart suggestions computed for this item
  const smartSuggestions = React.useMemo(() => {
    if (matchedProduct) return [];
    return findSmartSuggestions(
      item.originalInvoiceName || item.name,
      item.barcode,
      products,
      item.matchedProductId,
      3
    );
  }, [item.originalInvoiceName, item.name, item.barcode, item.matchedProductId, matchedProduct, products]);

  const filteredProducts = searchTerm.trim()
    ? products.filter(p => {
        const q = searchTerm.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.barcode2 && p.barcode2.toLowerCase().includes(q)) ||
          p.aliases?.some(a => a.toLowerCase().includes(q))
        );
      }).slice(0, 10)
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (matchedProduct && !isOpen) {
    return (
      <div className={`mt-1.5 flex items-center justify-between gap-2 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-lg ${isCardMode ? 'text-xs' : 'text-[11px]'}`}>
        <div className="flex items-center gap-1.5 min-w-0 text-blue-700 dark:text-blue-300 font-bold">
          <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="truncate">مقترن بـ: <span className="text-slate-900 dark:text-white underline">{matchedProduct.name}</span></span>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setSearchTerm('');
          }}
          className="text-slate-400 hover:text-red-500 hover:bg-white/60 dark:hover:bg-slate-800 p-1 rounded transition-colors shrink-0 flex items-center gap-1 text-[10px] font-bold"
          title="تغيير الربط أو فك الاقتران"
        >
          <span>تغيير</span>
          <X className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative mt-1.5 space-y-1.5">
      {/* 💡 Smart Suggestion One-Tap Chips (Full, untruncated display) */}
      {!matchedProduct && smartSuggestions.length > 0 && !isOpen && (
        <div className="space-y-1 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 p-2 rounded-xl">
          <div className="flex items-center gap-1 text-[11px] font-black text-amber-800 dark:text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>اقتراحات الذكاء الاصطناعي الأقرب للربط:</span>
          </div>
          <div className="flex flex-col gap-1.5 pt-0.5">
            {smartSuggestions.map(({ product, reason }) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onPair(item.id, product.id)}
                className="w-full text-right flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-700/50 rounded-lg text-slate-800 dark:text-slate-100 transition-all shadow-xs cursor-pointer active:scale-98 group"
                title={`ربط مباشر بـ ${product.name}`}
              >
                <div className="flex flex-col min-w-0 pr-0.5">
                  <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300">
                    {product.name}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-1.5 py-0.2 rounded font-semibold text-[9px]">
                      {reason}
                    </span>
                    <span>المخزون: {product.quantity || 0} قطعة</span>
                    {product.barcode && <span className="font-mono">({product.barcode})</span>}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-[11px] font-bold shadow-xs">
                  <span>ربط</span>
                  <Check className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative flex items-center">
        <Search className="absolute right-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          type="search"
          name="invoice_search_stock"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="🔍 أو ابحث بالاسم في المخزن للربط..."
          className="w-full pr-8 pl-6 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-xs"
        />
        {isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute left-2 text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 right-0 left-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl text-xs py-1 divide-y divide-slate-100 dark:divide-slate-700/50">
          <button
            type="button"
            onClick={() => {
              onPair(item.id, '');
              setIsOpen(false);
              setSearchTerm('');
            }}
            className="w-full text-right px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>➕ إنشاء كمنتج جديد بالمخزن (بدون ربط)</span>
          </button>

          {/* Quick Smart Suggestions inside dropdown */}
          {!searchTerm.trim() && smartSuggestions.length > 0 && (
            <div className="bg-amber-50/50 dark:bg-amber-950/30 py-1.5">
              <div className="px-3 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                اقتراحات الذكاء الاصطناعي الأقرب:
              </div>
              {smartSuggestions.map(({ product, reason }) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    onPair(item.id, product.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className="w-full text-right px-3 py-2 hover:bg-amber-100/60 dark:hover:bg-amber-900/50 text-slate-800 dark:text-slate-200 flex flex-col gap-0.5 transition-colors"
                >
                  <div className="font-bold text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <span className="truncate">{product.name}</span>
                    <span className="text-[9px] bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-1.5 py-0.5 rounded font-bold">
                      {reason}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>المخزون: {product.quantity || 0}</span>
                    {product.barcode && <span>(باركود: {product.barcode})</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {filteredProducts.length > 0 ? (
            filteredProducts.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPair(item.id, p.id);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className="w-full text-right px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-slate-800 dark:text-slate-200 flex flex-col gap-0.5 transition-colors"
              >
                <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{p.name}</span>
                  {p.barcode && (
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mr-1 shrink-0">
                      {p.barcode}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>المخزون: {p.quantity || 0}</span>
                  {p.piecesPerBox && p.piecesPerBox > 1 && (
                    <span>({p.piecesPerBox} قطعة/كرتونة)</span>
                  )}
                  {p.aliases && p.aliases.length > 0 && (
                    <span className="text-indigo-500 dark:text-indigo-400 truncate max-w-[140px]">
                      مرادفات: {p.aliases.join(', ')}
                    </span>
                  )}
                </div>
              </button>
            ))
          ) : searchTerm.trim() ? (
            <div className="px-3 py-3 text-center text-slate-400 text-xs">
              لا توجد منتجات مطابقة لـ "{searchTerm}"
            </div>
          ) : smartSuggestions.length === 0 ? (
            <div className="px-3 py-3 text-center text-slate-400 text-xs">
              اكتب اسم المنتج أو الباركود للبحث...
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PriceAlertBanner({
  item,
  matchedProduct,
  currency,
  onApplySuggestedPrice,
  onDuplicateAsNew,
  canViewCostPrices = true
}: {
  item: ExtractedItem;
  matchedProduct?: Product | null;
  currency: string;
  onApplySuggestedPrice?: (suggestedPrice: number) => void;
  onDuplicateAsNew?: () => void;
  canViewCostPrices?: boolean;
}) {
  if (!matchedProduct || !canViewCostPrices) return null;

  const ppb = Number(item.piecesPerBox) > 0 ? Number(item.piecesPerBox) : 1;
  const cost = Number(item.costPrice) || 0;
  const currentPieceCost = item.unitType === 'carton' ? (cost / ppb) : cost;
  const currentPieceSelling = item.unitType === 'carton' ? (Number(item.sellingPrice) / ppb) : Number(item.sellingPrice);
  
  const prevPieceCost = Number(matchedProduct.purchasePrice || matchedProduct.costPrice || 0);

  if (currentPieceCost <= 0) return null;

  // 1. Critical Alert: Selling price is lower than or equal to the new purchase price
  if (currentPieceSelling > 0 && currentPieceSelling <= currentPieceCost) {
    const suggestedPiece = parseFloat((currentPieceCost * 1.25).toFixed(3));
    const suggestedTotal = item.unitType === 'carton' ? parseFloat((suggestedPiece * ppb).toFixed(3)) : suggestedPiece;

    return (
      <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl text-xs space-y-2 animate-pulse">
        <div className="flex items-center gap-1.5 font-black text-red-700 dark:text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>⚠️ تحذير: سعر البيع الحالي ({formatCurrency(currentPieceSelling, currency)}) أقل من أو مساوٍ لسعر الشراء الجديد ({formatCurrency(currentPieceCost, currency)})!</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-red-200 dark:border-red-900/60 text-[11px]">
          <span className="text-slate-600 dark:text-slate-300">يُفضل تعديل سعر البيع لتجنب البيع بخسارة أو فصله كصنف جديد:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {onApplySuggestedPrice && (
              <button
                type="button"
                onClick={() => onApplySuggestedPrice(suggestedTotal)}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-lg font-bold shrink-0 transition-all shadow-xs cursor-pointer"
              >
                تعديل لهامش 25% ({formatCurrency(suggestedTotal, currency)})
              </button>
            )}
            {onDuplicateAsNew && (
              <button
                type="button"
                onClick={onDuplicateAsNew}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg font-bold shrink-0 transition-all shadow-xs cursor-pointer flex items-center gap-1"
                title="إنشاء وحفظ كمنتج جديد مستقل بالأسعار الجديدة"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ كمنتج جديد</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Alert on purchase price change compared to recorded stock price
  if (prevPieceCost > 0) {
    const diff = currentPieceCost - prevPieceCost;
    const diffPct = ((diff / prevPieceCost) * 100);

    if (Math.abs(diffPct) >= 0.5) { // 0.5% or more difference
      const isIncrease = diff > 0;
      const suggestedPiece = parseFloat((currentPieceCost * 1.25).toFixed(3));
      const suggestedTotal = item.unitType === 'carton' ? parseFloat((suggestedPiece * ppb).toFixed(3)) : suggestedPiece;

      if (isIncrease) {
        return (
          <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5 font-bold text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  تنبيه: سعر الشراء ارتفع بنسبة <strong className="font-black text-amber-900 dark:text-amber-200">+{diffPct.toFixed(1)}%</strong>
                </span>
              </div>
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                (السابق: {formatCurrency(prevPieceCost, currency)} ⬅️ الجديد: {formatCurrency(currentPieceCost, currency)})
              </span>
            </div>
            
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-200/70 dark:border-amber-800/50 text-[11px]">
              <span className="text-slate-600 dark:text-slate-300">
                سعر البيع محفوظ. اختر إجراء التسعير:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {onApplySuggestedPrice && (
                  <button
                    type="button"
                    onClick={() => onApplySuggestedPrice(suggestedTotal)}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg font-bold shrink-0 transition-all shadow-xs cursor-pointer text-[11px] flex items-center gap-1"
                    title="تحديث سعر البيع على نفس المنتج الحالي"
                  >
                    <span>تحديث سعر البيع ({formatCurrency(suggestedTotal, currency)})</span>
                  </button>
                )}
                {onDuplicateAsNew && (
                  <button
                    type="button"
                    onClick={onDuplicateAsNew}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg font-bold shrink-0 transition-all shadow-xs cursor-pointer text-[11px] flex items-center gap-1"
                    title="فصل هذا الصنف كمنتج جديد في المخزن بالأسعار والكميات الجديدة دون تغيير الصنف القديم"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ كمنتج جديد بالسعر الجديد</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      } else {
        return (
          <div className="mt-1.5 p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/50 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
              <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                تنبيه: سعر الشراء انخفض بنسبة <strong className="font-black text-emerald-900 dark:text-emerald-100">{diffPct.toFixed(1)}%</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                (وفرت {formatCurrency(Math.abs(diff), currency)} للقطعة)
              </span>
              {onDuplicateAsNew && (
                <button
                  type="button"
                  onClick={onDuplicateAsNew}
                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>نسخ كمنتج جديد</span>
                </button>
              )}
            </div>
          </div>
        );
      }
    }
  }

  return null;
}

interface PurchaseInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  suppliers: Supplier[];
  initialReceipt?: GoodsReceipt | null;
  onSuccess?: () => void;
}

export function PurchaseInvoiceModal({ isOpen, onClose, products, suppliers, initialReceipt, onSuccess }: PurchaseInvoiceModalProps) {
  const { t } = useTranslation();
  const { user, showToast, settings } = useAppContext();
  const { currentStaff, checkPermission } = useStaffAuth();
  const canViewCostPrices = checkPermission('canViewCostPrices');
  const canEditProductPrices = checkPermission('canEditProductPrices');

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState<string>('');
  
  // Invoice Header Data
  const [supplierName, setSupplierName] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('credit');
  const [items, setItems] = useState<ExtractedItem[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize from initialReceipt if reviewing a pending invoice
  useEffect(() => {
    if (!isOpen) return;

    if (initialReceipt) {
      setSupplierName(initialReceipt.supplierName || '');
      setSelectedSupplierId(initialReceipt.supplierId || '');
      setInvoiceNumber(initialReceipt.invoiceNumber || '');
      setInvoiceDate(initialReceipt.invoiceDate || new Date().toISOString().split('T')[0]);
      setPaymentMethod(initialReceipt.paymentMethod || 'credit');
      
      const loadedItems: ExtractedItem[] = (initialReceipt.items || []).map((it, idx) => {
        // Find matching product in stock
        const matched = products.find(p => p.id === it.matchedProductId || (it.barcode && (p.barcode === it.barcode || p.barcode2 === it.barcode)));
        const ppb = Number(it.piecesPerBox) > 0 ? Number(it.piecesPerBox) : (matched?.piecesPerBox || 1);
        
        let costPrice = Number(it.costPrice) || 0;
        let sellingPrice = Number(it.sellingPrice) || 0;
        
        // If cost is 0 and user is manager, pre-fill from previous known cost
        if (costPrice <= 0 && matched && (matched.purchasePrice || matched.costPrice)) {
          const knownCost = matched.purchasePrice || matched.costPrice || 0;
          costPrice = it.unitType === 'carton' ? (matched.boxPurchasePrice || knownCost * ppb) : knownCost;
        }
        
        // If selling price is 0, pre-fill from matched product
        if (sellingPrice <= 0 && matched && matched.sellingPrice) {
          sellingPrice = it.unitType === 'carton' ? (matched.boxSellingPrice || matched.sellingPrice * ppb) : matched.sellingPrice;
        }
        
        const qty = Number(it.quantity) || 0;
        const total = parseFloat((qty * costPrice).toFixed(3));

        return {
          id: it.id || `item-${Date.now()}-${idx}`,
          name: it.name,
          originalInvoiceName: it.originalInvoiceName || it.name,
          barcode: it.barcode || matched?.barcode || '',
          unitType: it.unitType || 'carton',
          piecesPerBox: ppb,
          quantity: qty,
          costPrice: costPrice,
          sellingPrice: sellingPrice,
          total: total,
          matchedProductId: matched?.id || it.matchedProductId,
          matchedProductName: matched?.name || it.matchedProductName,
          isNewProduct: !matched && it.isNewProduct !== false,
          copiedFromProductId: it.copiedFromProductId
        };
      });

      setItems(loadedItems);
    } else {
      setSupplierName('');
      setSelectedSupplierId('');
      setInvoiceNumber('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('credit');
      setItems([]);
      setImagePreview(null);
    }
  }, [initialReceipt, isOpen, products]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('الرجاء اختيار صورة صالحة للفاتورة', 'error');
      return;
    }

    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const matchItemWithStock = (extractedName: string, barcode?: string) => {
    // 1. Match by exact barcode (if non-empty and length > 3)
    if (barcode && barcode.trim().length > 3) {
      const cleanBc = barcode.trim();
      const barcodeMatch = products.find(p => p.barcode === cleanBc || p.barcode2 === cleanBc);
      if (barcodeMatch) return barcodeMatch;
    }

    const cleanTarget = cleanTextForMatch(extractedName);
    if (!cleanTarget) return null;

    // 2. Match by exact product name
    const exactNameMatch = products.find(p => cleanTextForMatch(p.name) === cleanTarget);
    if (exactNameMatch) return exactNameMatch;

    // 3. Match by registered Alias (saved from previous pairings)
    const exactAliasMatch = products.find(p => 
      p.aliases?.some(a => {
        const cleanA = cleanTextForMatch(a);
        if (!cleanA) return false;
        if (cleanA === cleanTarget) return true;
        if (cleanA.length >= 4 && cleanTarget.length >= 4) {
          if (cleanTarget.startsWith(cleanA) || cleanA.startsWith(cleanTarget)) return true;
          if (cleanTarget.includes(cleanA) || cleanA.includes(cleanTarget)) return true;
        }
        return false;
      })
    );
    if (exactAliasMatch) return exactAliasMatch;

    return null;
  };

  const handleAnalyzeInvoice = async () => {
    if (!imagePreview) {
      showToast('يرجى التقاط أو اختيار صورة الفاتورة أولاً', 'error');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeStep('جاري قراءة الفاتورة واستخراج البيانات بالذكاء الاصطناعي...');

    try {
      const data = await scanInvoiceWithGemini(imagePreview, imageMime);

      // Extract Supplier Name
      if (data.supplierName) {
        setSupplierName(data.supplierName);
        // Try matching supplier in existing list
        const suppMatch = suppliers.find(s => s.name.trim().toLowerCase().includes(data.supplierName!.trim().toLowerCase()));
        if (suppMatch) {
          setSelectedSupplierId(suppMatch.id || '');
        }
      }

      if (data.invoiceNumber) {
        setInvoiceNumber(data.invoiceNumber);
      }

      if (data.invoiceDate) {
        setInvoiceDate(data.invoiceDate);
      }

      // Map Items
      if (Array.isArray(data.items)) {
        const mappedItems: ExtractedItem[] = data.items.map((item: any, idx: number) => {
          const matchedProd = matchItemWithStock(item.name || '', item.barcode);
          const costPrice = Number(item.costPrice) || 0;
          const qty = Number(item.quantity) || 1;
          
          // Determine piecesPerBox
          let ppb = matchedProd?.piecesPerBox && Number(matchedProd.piecesPerBox) > 0 
            ? Number(matchedProd.piecesPerBox) 
            : (Number(item.piecesPerBox) > 0 ? Number(item.piecesPerBox) : 1);

          const rawUnit = (item.unit || '').toString().toLowerCase();
          const isCartonUnit = rawUnit.includes('كرتون') || rawUnit.includes('صندوق') || rawUnit.includes('طرد') || rawUnit.includes('box') || rawUnit.includes('carton') || (matchedProd?.piecesPerBox && Number(matchedProd.piecesPerBox) > 1);

          const unitType: 'carton' | 'piece' = isCartonUnit && ppb > 1 ? 'carton' : (isCartonUnit ? 'carton' : 'piece');

          // Determine default selling price (matching unitType: carton or piece)
          let defaultSelling = 0;
          if (matchedProd && matchedProd.sellingPrice > 0) {
            if (unitType === 'carton') {
              defaultSelling = matchedProd.boxSellingPrice || parseFloat((matchedProd.sellingPrice * ppb).toFixed(3));
            } else {
              defaultSelling = matchedProd.sellingPrice;
            }
          } else {
            // 25% default markup based on the entered cost price for that unit
            defaultSelling = parseFloat((costPrice * 1.25).toFixed(3));
          }

          return {
            id: `item-${Date.now()}-${idx}`,
            name: item.name || (matchedProd ? matchedProd.name : 'منتج جديد'),
            originalInvoiceName: item.name || '',
            barcode: item.barcode || matchedProd?.barcode || '',
            unitType,
            piecesPerBox: ppb,
            quantity: qty,
            costPrice: costPrice,
            sellingPrice: defaultSelling,
            total: Number(item.total) || (qty * costPrice),
            matchedProductId: matchedProd?.id,
            matchedProductName: matchedProd?.name,
            isNewProduct: !matchedProd,
          };
        });

        setItems(mappedItems);
      }

      showToast('تم تحليل الفاتورة بنجاح واستخراج المنتجات!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'تعذر قراءة الفاتورة بالذكاء الاصطناعي', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePairProduct = (itemId: string, selectedProductId: string) => {
    if (!selectedProductId) {
      // Unpair - treat as new product
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          matchedProductId: undefined,
          matchedProductName: undefined,
          isNewProduct: true
        };
      }));
      return;
    }

    const matchedProd = products.find(p => p.id === selectedProductId);
    if (!matchedProd) return;

    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const ppb = matchedProd.piecesPerBox && Number(matchedProd.piecesPerBox) > 0 ? Number(matchedProd.piecesPerBox) : item.piecesPerBox;
      
      let matchedSelling = item.sellingPrice;
      if (matchedProd.sellingPrice > 0) {
        if (item.unitType === 'carton') {
          matchedSelling = matchedProd.boxSellingPrice || parseFloat((matchedProd.sellingPrice * ppb).toFixed(3));
        } else {
          matchedSelling = matchedProd.sellingPrice;
        }
      }

      return {
        ...item,
        matchedProductId: matchedProd.id,
        matchedProductName: matchedProd.name,
        // Keep the invoice name as entered or extracted, do not overwrite it with warehouse product name
        name: item.originalInvoiceName || item.name || matchedProd.name,
        originalInvoiceName: item.originalInvoiceName || item.name,
        piecesPerBox: ppb,
        sellingPrice: matchedSelling,
        isNewProduct: false,
      };
    }));
  };

  const handleDuplicateAsNewProduct = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      
      const matchedProd = products.find(p => p.id === item.matchedProductId || p.id === item.copiedFromProductId);
      const ppb = Number(item.piecesPerBox) > 0 ? Number(item.piecesPerBox) : (matchedProd?.piecesPerBox || 1);
      const cost = Number(item.costPrice) || 0;
      const pieceCost = item.unitType === 'carton' ? (cost / ppb) : cost;
      
      // Auto-calculate suggested selling price with 25% margin if selling price is lower than or equal to cost
      let newSelling = Number(item.sellingPrice) || 0;
      const currentPieceSelling = item.unitType === 'carton' ? (newSelling / ppb) : newSelling;
      if (newSelling <= 0 || currentPieceSelling <= pieceCost) {
        const suggestedPiece = parseFloat((pieceCost * 1.25).toFixed(3));
        newSelling = item.unitType === 'carton' ? parseFloat((suggestedPiece * ppb).toFixed(3)) : suggestedPiece;
      }

      return {
        ...item,
        matchedProductId: undefined,
        matchedProductName: undefined,
        copiedFromProductId: matchedProd?.id,
        isNewProduct: true,
        // Preserve the exact clean name from the app (e.g. "Donuts")
        name: matchedProd ? matchedProd.name : (item.name || item.originalInvoiceName || ''),
        barcode: item.barcode || matchedProd?.barcode || '',
        piecesPerBox: ppb,
        sellingPrice: newSelling,
      };
    }));

    showToast('تم نسخ الصنف كمنتج جديد - سيحتفظ بالاسم والصورة والتصنيف مع حفظ الأسعار والكميات الجديدة', 'success');
  };

  const handleMergeSimilarItems = () => {
    if (items.length < 2) {
      showToast('يجب وجود بندين على الأقل للدمج', 'info');
      return;
    }

    const groups: { [key: string]: ExtractedItem[] } = {};
    const unmergedItems: ExtractedItem[] = [];

    items.forEach(item => {
      if (item.matchedProductId) {
        if (!groups[item.matchedProductId]) {
          groups[item.matchedProductId] = [];
        }
        groups[item.matchedProductId].push(item);
      } else {
        unmergedItems.push(item);
      }
    });

    let mergedCount = 0;
    const finalItems: ExtractedItem[] = [...unmergedItems];

    Object.keys(groups).forEach(productId => {
      const groupItems = groups[productId];
      if (groupItems.length > 1) {
        mergedCount += groupItems.length - 1;
        const baseItem = { ...groupItems[0] };
        
        let totalQty = 0;
        let grandTotal = 0;
        const aliasesCollected: string[] = [];

        groupItems.forEach(gi => {
          totalQty += Number(gi.quantity) || 0;
          grandTotal += Number(gi.total) || 0;
          if (gi.originalInvoiceName) aliasesCollected.push(gi.originalInvoiceName);
          if (gi.name && gi.name !== baseItem.name) aliasesCollected.push(gi.name);
        });

        baseItem.quantity = totalQty;
        baseItem.total = grandTotal;
        baseItem.costPrice = totalQty > 0 ? parseFloat((grandTotal / totalQty).toFixed(3)) : baseItem.costPrice;
        if (aliasesCollected.length > 0) {
          baseItem.originalInvoiceName = Array.from(new Set(aliasesCollected)).join(' / ');
        }

        finalItems.push(baseItem);
      } else {
        finalItems.push(groupItems[0]);
      }
    });

    if (mergedCount > 0) {
      setItems(finalItems);
      showToast(`تم دمج ${mergedCount} بند أصناف ونكهات مكررة لنفس المنتج بنجاح!`, 'success');
    } else {
      showToast('قم أولاً بربط/اقتران البنود النكهات بنفس المنتج المخزن لدمجها', 'info');
    }
  };

  const handleItemChange = (id: string, field: keyof ExtractedItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      const ppb = Number(updated.piecesPerBox) > 0 ? Number(updated.piecesPerBox) : 1;

      // Handle unit type conversion
      if (field === 'unitType' && value !== item.unitType) {
        if (value === 'carton' && item.unitType === 'piece') {
          // Converted from piece to carton: quantity becomes pieces / ppb (e.g. 48 pieces -> 2 cartons)
          updated.quantity = Math.max(1, Math.round((Number(item.quantity) || 1) / ppb));
          updated.costPrice = parseFloat(((Number(item.costPrice) || 0) * ppb).toFixed(3));
          updated.sellingPrice = parseFloat(((Number(item.sellingPrice) || 0) * ppb).toFixed(3));
        } else if (value === 'piece' && item.unitType === 'carton') {
          // Converted from carton to piece: quantity becomes cartons * ppb (e.g. 2 cartons -> 48 pieces)
          updated.quantity = (Number(item.quantity) || 1) * ppb;
          updated.costPrice = parseFloat(((Number(item.costPrice) || 0) / ppb).toFixed(3));
          updated.sellingPrice = parseFloat(((Number(item.sellingPrice) || 0) / ppb).toFixed(3));
        }
      }

      if (field === 'quantity' || field === 'costPrice' || field === 'unitType') {
        updated.total = parseFloat(((Number(updated.quantity) || 0) * (Number(updated.costPrice) || 0)).toFixed(3));
      }
      return updated;
    }));
  };

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-manual-${Date.now()}`,
        name: '',
        barcode: '',
        unitType: 'piece',
        piecesPerBox: 1,
        quantity: 1,
        costPrice: 0,
        sellingPrice: 0,
        total: 0,
        isNewProduct: true
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  };

  // 1. Storekeeper / Draft submission: Save to goodsReceipts collection as 'pending' for GM review
  const handleSaveAsPendingReceipt = async () => {
    if (!user) return;
    if (items.length === 0) {
      showToast('يرجى إضافة أو استخراج منتجات بالفاتورة أولاً', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const receiptRef = initialReceipt?.id 
        ? doc(db, `users/${user.uid}/goodsReceipts`, initialReceipt.id)
        : doc(collection(db, `users/${user.uid}/goodsReceipts`));

      const nowIso = new Date().toISOString();
      const receiptPayload: any = {
        receiptNumber: initialReceipt?.receiptNumber || `RC-${Date.now().toString().slice(-6)}`,
        invoiceNumber: invoiceNumber.trim() || '',
        invoiceDate: invoiceDate || nowIso.split('T')[0],
        supplierId: selectedSupplierId || null,
        supplierName: supplierName.trim() || 'مورد غير محدد',
        paymentMethod: paymentMethod,
        status: 'pending',
        items: items.map(item => ({
          id: item.id,
          name: item.name.trim(),
          originalInvoiceName: item.originalInvoiceName || item.name,
          barcode: item.barcode || '',
          unitType: item.unitType,
          piecesPerBox: Number(item.piecesPerBox) || 1,
          quantity: Number(item.quantity) || 0,
          costPrice: Number(item.costPrice) || 0,
          sellingPrice: Number(item.sellingPrice) || 0,
          total: Number(item.total) || 0,
          matchedProductId: item.matchedProductId || null,
          matchedProductName: item.matchedProductName || null,
          copiedFromProductId: item.copiedFromProductId || null,
          isNewProduct: !!item.isNewProduct,
        })),
        totalItemsCount: items.length,
        totalUnitsCount: items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0),
        totalAmount: calculateGrandTotal(),
        submittedBy: initialReceipt?.submittedBy || {
          staffId: currentStaff?.id || 'storekeeper',
          staffName: currentStaff?.name || user.displayName || 'أمين المخزن',
          role: currentStaff?.role || 'storekeeper'
        },
        createdAt: initialReceipt?.createdAt || nowIso,
        createdAtTimestamp: Date.now(),
        updatedAt: nowIso
      };

      await setDoc(receiptRef, receiptPayload, { merge: true });

      // Immediate local cache update
      try {
        const cacheKey = `cached_goods_receipts_${user.uid}`;
        const prevCache: any[] = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        const existingIdx = prevCache.findIndex(r => r.id === receiptRef.id);
        const itemWithId = { id: receiptRef.id, ...receiptPayload };
        if (existingIdx >= 0) {
          prevCache[existingIdx] = itemWithId;
        } else {
          prevCache.unshift(itemWithId);
        }
        localStorage.setItem(cacheKey, JSON.stringify(prevCache));
      } catch (e) {
        // ignore
      }

      await logAudit(
        'create',
        'purchase',
        receiptRef.id,
        supplierName.trim() || 'مورد غير محدد',
        `إرسال إذن استلام بضاعة (${items.length} صنف) بانتظار مراجعة واعتماد المدير العام`
      );

      showToast('تم حفظ إذن الاستلام وإرساله بنجاح! سيظهر للمدير العام في قائمة الشحنات بانتظار الاعتماد والمطابقة 📋', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving pending receipt:', err);
      showToast('حدث خطأ أثناء حفظ إذن الاستلام: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 2. General Manager / Full Admin: Approve and commit to stock, accounts, suppliers, and debts
  const handleApproveAndCommitInvoice = async () => {
    if (!user) return;
    if (items.length === 0) {
      showToast('يرجى إضافة أو استخراج منتجات بالفاتورة أولاً', 'error');
      return;
    }

    // Validate that selling price is strictly greater than purchase price for all items if cost prices are visible
    if (canViewCostPrices) {
      for (const item of items) {
        if (!item.name.trim()) continue;
        const ppb = Number(item.piecesPerBox) > 0 ? Number(item.piecesPerBox) : 1;
        const cost = Number(item.costPrice) || 0;
        const pieceCostPrice = item.unitType === 'carton' ? (cost / ppb) : cost;
        const pieceSellingPrice = item.unitType === 'carton' ? (Number(item.sellingPrice) / ppb) : Number(item.sellingPrice);

        if (pieceSellingPrice > 0 && pieceSellingPrice <= pieceCostPrice) {
          showToast(`خطأ في بند "${item.name}": يجب أن يكون سعر البيع (${pieceSellingPrice.toFixed(3)}) أكبر دائمًا من سعر الشراء (${pieceCostPrice.toFixed(3)})`, 'error');
          return;
        }
      }
    }

    setIsSaving(true);

    try {
      const batch = writeBatch(db);
      const now = new Date();

      // 1. Ensure or find Supplier
      let finalSupplierId = selectedSupplierId;
      let finalSupplierName = supplierName.trim() || 'مورد غير محدد';

      if (!finalSupplierId && supplierName.trim()) {
        const suppRef = doc(collection(db, `users/${user.uid}/suppliers`));
        finalSupplierId = suppRef.id;
        batch.set(suppRef, {
          name: supplierName.trim(),
          phone: '',
          typeOfGoods: 'مشتريات فاتورة ذكية',
          transactionCount: 1,
          totalPaid: paymentMethod === 'cash' ? calculateGrandTotal() : 0,
          updatedAt: serverTimestamp()
        });
      }

      // 2. Process products
      const purchaseDate = invoiceDate ? new Date(invoiceDate) : now;

      for (const item of items) {
        if (!item.name.trim()) continue;

        const ppb = Number(item.piecesPerBox) > 0 ? Number(item.piecesPerBox) : 1;
        const qty = Number(item.quantity) || 0;
        const cost = Number(item.costPrice) || 0;

        // Calculate total pieces to add to stock
        const totalPieces = item.unitType === 'carton' ? (qty * ppb) : qty;

        // Calculate piece purchase price and box purchase price
        const pieceCostPrice = item.unitType === 'carton' ? (cost / ppb) : cost;
        const boxCostPrice = item.unitType === 'carton' ? cost : (cost * ppb);

        // Calculate piece selling price and box selling price
        const pieceSellingPrice = item.unitType === 'carton' ? (Number(item.sellingPrice) / ppb) : Number(item.sellingPrice);
        const boxSellingPrice = item.unitType === 'carton' ? Number(item.sellingPrice) : (Number(item.sellingPrice) * ppb);

        let targetProductId = item.matchedProductId;

        if (targetProductId) {
          // Update existing product quantity and cost price
          const prodRef = doc(db, `users/${user.uid}/products`, targetProductId);
          const matchedProd = products.find(p => p.id === targetProductId);
          const origName = (item.originalInvoiceName || item.name || '').trim();

          const updateData: any = {
            quantity: increment(totalPieces),
            piecesPerBox: ppb,
            updatedAt: serverTimestamp()
          };

          if (canViewCostPrices && pieceCostPrice > 0) {
            updateData.purchasePrice = parseFloat(pieceCostPrice.toFixed(3));
            updateData.boxPurchasePrice = parseFloat(boxCostPrice.toFixed(3));
            updateData.costPrice = parseFloat(pieceCostPrice.toFixed(3));
          }

          if (canEditProductPrices && pieceSellingPrice > 0) {
            updateData.sellingPrice = parseFloat(pieceSellingPrice.toFixed(3));
            updateData.boxSellingPrice = parseFloat(boxSellingPrice.toFixed(3));
          }

          // Save aliases to persist future pairing automatically
          const aliasesToAdd: string[] = [];
          if (origName && matchedProd && origName.toLowerCase() !== matchedProd.name.toLowerCase()) {
            aliasesToAdd.push(origName);
          }
          if (item.name && matchedProd && item.name.trim().toLowerCase() !== matchedProd.name.toLowerCase() && item.name.trim() !== origName) {
            aliasesToAdd.push(item.name.trim());
          }
          if (aliasesToAdd.length > 0) {
            updateData.aliases = arrayUnion(...aliasesToAdd);
          }

          // Register barcode if newly available
          if (item.barcode && item.barcode.trim().length > 3) {
            const bc = item.barcode.trim();
            if (!matchedProd?.barcode) {
              updateData.barcode = bc;
            } else if (matchedProd.barcode !== bc && !matchedProd.barcode2) {
              updateData.barcode2 = bc;
            }
          }

          batch.update(prodRef, updateData);
        } else {
          // Create new product (or duplicated copy with preserved image & category)
          const newProdRef = doc(collection(db, `users/${user.uid}/products`));
          targetProductId = newProdRef.id;

          const sourceProd = item.copiedFromProductId 
            ? products.find(p => p.id === item.copiedFromProductId) 
            : null;

          const newProductData: any = {
            name: item.name.trim(),
            barcode: item.barcode || sourceProd?.barcode || '',
            barcode2: sourceProd?.barcode2 || '',
            category: sourceProd?.category || 'مواد غذائية عامة',
            quantity: totalPieces,
            piecesPerBox: ppb,
            subItemsPerPiece: sourceProd?.subItemsPerPiece || 1,
            unit: sourceProd?.unit || 'piece',
            purchasePrice: parseFloat(pieceCostPrice.toFixed(3)),
            boxPurchasePrice: parseFloat(boxCostPrice.toFixed(3)),
            costPrice: parseFloat(pieceCostPrice.toFixed(3)),
            sellingPrice: parseFloat(pieceSellingPrice.toFixed(3)),
            boxSellingPrice: parseFloat(boxSellingPrice.toFixed(3)),
            minQuantity: sourceProd?.minQuantity || 5,
            hasLocalImage: !!sourceProd?.hasLocalImage,
            hasCloudImage: !!sourceProd?.hasCloudImage,
            updatedAt: serverTimestamp()
          };

          // If duplicated from an existing product with a local catalog image, copy the image in IndexedDB
          if (sourceProd?.hasLocalImage && sourceProd.id) {
            try {
              const imgBlob = await getLocalImage(sourceProd.id);
              if (imgBlob) {
                await saveLocalImage(newProdRef.id, imgBlob);
              }
            } catch (imgErr) {
              console.warn('Error copying local image to new product:', imgErr);
            }
          }

          batch.set(newProdRef, newProductData);
        }

        // Add to 'purchases' collection (records in "آخر المشتريات" / "حركة المشتريات")
        const purchaseRef = doc(collection(db, `users/${user.uid}/purchases`));
        batch.set(purchaseRef, {
          productId: targetProductId,
          productName: item.name.trim(),
          qtyAdded: totalPieces,
          numBoxes: item.unitType === 'carton' ? qty : Math.floor(qty / ppb),
          extraPieces: item.unitType === 'carton' ? 0 : (qty % ppb),
          piecesPerBox: ppb,
          amount: Number(item.total) || 0,
          price: parseFloat(pieceCostPrice.toFixed(3)),
          boxPrice: parseFloat(boxCostPrice.toFixed(3)),
          supplierId: finalSupplierId || null,
          supplierName: finalSupplierName || null,
          invoiceNumber: invoiceNumber || null,
          date: purchaseDate.toISOString(),
          createdAt: serverTimestamp(),
        });

        // Add Product Movement Transaction
        const txRef = doc(collection(db, `users/${user.uid}/transactions`));
        batch.set(txRef, {
          productId: targetProductId,
          productName: item.name.trim(),
          type: 'purchase',
          quantityChange: totalPieces,
          price: parseFloat(pieceCostPrice.toFixed(3)),
          boxPrice: parseFloat(boxCostPrice.toFixed(3)),
          amount: Number(item.total) || 0,
          supplierId: finalSupplierId || '',
          supplierName: finalSupplierName,
          date: purchaseDate.toISOString()
        });
      }

      // 3. Create Supplier Transaction / Debt if applicable
      const totalAmount = calculateGrandTotal();

      if (finalSupplierId) {
        const suppTxRef = doc(collection(db, `users/${user.uid}/supplierTransactions`));
        batch.set(suppTxRef, {
          supplierId: finalSupplierId,
          amount: paymentMethod === 'cash' ? totalAmount : 0,
          date: invoiceDate || now.toISOString(),
          note: `فاتورة توريد رقم #${invoiceNumber || 'آلية'} بقيمة ${formatCurrency(totalAmount, settings.currency)} (${paymentMethod === 'cash' ? 'مدفوعة كاش' : 'آجل / دين'})`,
          updatedAt: serverTimestamp()
        });

        // If debt / credit
        if (paymentMethod === 'credit') {
          const debtRef = doc(collection(db, `users/${user.uid}/debts`));
          batch.set(debtRef, {
            customerName: `المورد: ${finalSupplierName}`,
            phone: '',
            totalAmount: totalAmount,
            status: 'unpaid',
            type: 'payable', // الدين للمورد (علينا)
            history: [{
              type: 'debt',
              amount: totalAmount,
              date: now.toISOString(),
              note: `فاتورة شراء رقم #${invoiceNumber || 'آلية'}`
            }],
            updatedAt: serverTimestamp()
          });
        }
      }

      // 4. Update or create GoodsReceipt document to record General Manager's Approval
      const receiptDocRef = initialReceipt?.id
        ? doc(db, `users/${user.uid}/goodsReceipts`, initialReceipt.id)
        : doc(collection(db, `users/${user.uid}/goodsReceipts`));

      const receiptRecord: any = {
        receiptNumber: initialReceipt?.receiptNumber || `RC-${Date.now().toString().slice(-6)}`,
        invoiceNumber: invoiceNumber.trim() || '',
        invoiceDate: invoiceDate || now.toISOString().split('T')[0],
        supplierId: finalSupplierId || null,
        supplierName: finalSupplierName,
        paymentMethod,
        status: 'approved',
        totalAmount,
        totalItemsCount: items.length,
        totalUnitsCount: items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0),
        items: items.map(item => ({
          id: item.id,
          name: item.name.trim(),
          barcode: item.barcode || '',
          unitType: item.unitType,
          piecesPerBox: Number(item.piecesPerBox) || 1,
          quantity: Number(item.quantity) || 0,
          costPrice: Number(item.costPrice) || 0,
          sellingPrice: Number(item.sellingPrice) || 0,
          total: Number(item.total) || 0,
          matchedProductId: item.matchedProductId || null,
          matchedProductName: item.matchedProductName || null
        })),
        reviewedBy: {
          staffId: currentStaff?.id || 'admin',
          staffName: currentStaff?.name || user.displayName || 'المدير العام',
          role: currentStaff?.role || 'admin'
        },
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (!initialReceipt?.id) {
        receiptRecord.submittedBy = {
          staffId: currentStaff?.id || 'admin',
          staffName: currentStaff?.name || user.displayName || 'المدير العام',
          role: currentStaff?.role || 'admin'
        };
        receiptRecord.createdAt = serverTimestamp();
      }

      batch.set(receiptDocRef, receiptRecord, { merge: true });

      await batch.commit();

      await logAudit(
        initialReceipt?.id ? 'update' : 'create',
        'purchase',
        finalSupplierId || 'general',
        finalSupplierName,
        `اعتماد وترحيل فاتورة توريد بقيمة ${formatCurrency(totalAmount, settings.currency)} للمخزون والحسابات بواسطة المدير العام`
      );

      showToast('تم اعتماد الفاتورة وترحيل الكميات والأسعار للحسابات والمخزون بنجاح! 🎉', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error approving invoice:', err);
      showToast('حدث خطأ أثناء اعتماد الفاتورة: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/80 sm:backdrop-blur-sm overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-6xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 ${
          initialReceipt ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700' : 'bg-gradient-to-r from-blue-600 to-indigo-700'
        } text-white shrink-0`}>
          <div className="flex items-center space-x-3 space-x-reverse min-w-0">
            <div className="p-2 sm:p-2.5 bg-white/20 rounded-xl backdrop-blur-md shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black truncate">
                  {initialReceipt 
                    ? `مراجعة وتدقيق إذن استلام بضاعة (${initialReceipt.receiptNumber || `إذن #${initialReceipt.id?.slice(-5)}`})`
                    : 'إدخال ومسح فواتير التوريد بالذكاء الاصطناعي'}
                </h2>
                {initialReceipt?.submittedBy?.staffName && (
                  <span className="text-[11px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                    وارد من: {initialReceipt.submittedBy.staffName}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-blue-100 font-medium truncate">
                {initialReceipt 
                  ? 'يرجى تدقيق أسعار الشراء وهوامش الربح ثم الضغط على اعتماد لترحيل الأصناف رسمياً للمخزون'
                  : 'التقاط صورة الفاتورة للتعرف التلقائي وربط المخزون وتحديث الأسعار'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0 mr-2"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          {/* Review Notice if Reviewing Pending Receipt */}
          {initialReceipt && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>وضع المراجعة والاعتماد المالي:</strong> تم استلام هذه البضائع وتفريغها بواسطة <strong>{initialReceipt.submittedBy?.staffName || 'أمين المخزن'}</strong>، يرجى التأكد من أسعار الشراء وتحديد سعر البيع ثم اعتماد الترحيل.
                </span>
              </div>
            </div>
          )}
          {/* Step 1: File Capture & Scan Section */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center space-x-2 sm:space-x-3 space-x-reverse w-full sm:w-auto">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  id="invoice-image-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 space-x-reverse px-3.5 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all shadow-xs text-xs sm:text-sm"
                >
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>{imagePreview ? 'تغيير صورة الفاتورة' : 'التقاط / اختيار صورة الفاتورة'}</span>
                </button>

                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => handleAnalyzeInvoice()}
                    disabled={isAnalyzing}
                    className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 space-x-reverse px-4 sm:px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black shadow-md transition-all disabled:opacity-50 text-xs sm:text-sm"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin shrink-0" />
                        <span>جاري التحليل...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300 shrink-0" />
                        <span>تحليل الفاتورة بالذكاء الاصطناعي</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {imagePreview && (
                <div className="relative group w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 border-blue-500 shadow-md self-center sm:self-auto">
                  <img src={imagePreview} alt="الفاتورة" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isAnalyzing && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center space-x-3 space-x-reverse text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-bold">
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-blue-600 shrink-0" />
                <span>{analyzeStep}</span>
              </div>
            )}
          </div>

          {/* Step 2: Invoice Header Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                اسم المورد
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  name="invoice_supplier_name"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="اسم المورد أو الشركات"
                  className="w-full pr-9 pl-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                رقم الفاتورة (مكتوب بالفاتورة)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  name="invoice_doc_number"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="مثال: #9401"
                  className="w-full pr-9 pl-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                تاريخ الفاتورة
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                طريقة الدفع للمورد
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-300 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit')}
                  className={`flex-1 py-1 sm:py-1.5 text-xs font-bold rounded-md transition-all ${paymentMethod === 'credit' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  آجل (دين)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 py-1 sm:py-1.5 text-xs font-bold rounded-md transition-all ${paymentMethod === 'cash' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  كاش (نقداً)
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Extracted Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white flex items-center space-x-2 space-x-reverse">
                <PackageCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <span>جدول البضائع والمنتجات الواردة ({items.length})</span>
              </h3>
              <div className="flex items-center space-x-1.5 sm:space-x-2 space-x-reverse">
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={handleMergeSimilarItems}
                    className="flex items-center space-x-1 space-x-reverse px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                    title="دمج الأصناف المكررة ذات النكهات المختلفة المربوطة بنفس المنتج"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">دمج النكهات المكررة</span>
                    <span className="sm:hidden">دمج النكهات</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="flex items-center space-x-1 space-x-reverse px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg font-bold hover:bg-blue-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة بند يدوي</span>
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">لا توجد بنود حالياً.</p>
                <p className="text-xs text-slate-400 mt-1">قم بالتقاط صورة الفاتورة وضغط "تحليل الفاتورة بالذكاء الاصطناعي" أو إضافتها يدوياً.</p>
              </div>
            ) : (
              <>
                {/* 📱 MOBILE RESPONSIVE CARDS VIEW (< md) */}
                <div className="md:hidden space-y-3">
                  {items.map((item, index) => {
                    const ppb = Number(item.piecesPerBox) > 0 ? Number(item.piecesPerBox) : 1;
                    const qty = Number(item.quantity) || 0;
                    const cost = Number(item.costPrice) || 0;
                    const totalPieces = item.unitType === 'carton' ? (qty * ppb) : qty;
                    const piecePrice = item.unitType === 'carton' ? (cost / ppb) : cost;
                    const boxPrice = item.unitType === 'carton' ? cost : (cost * ppb);
                    const matchedProd = products.find(p => p.id === item.matchedProductId);

                    return (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xs space-y-2.5"
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full font-black text-xs">
                              {index + 1}
                            </span>
                            {item.matchedProductId ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                                <Check className="w-3 h-3 text-blue-600" />
                                <span>مقترن بالمخزن</span>
                              </span>
                            ) : item.copiedFromProductId ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                                <Copy className="w-3 h-3 text-indigo-600" />
                                <span>نسخة جديدة بالأسعار الجديدة</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                منتج جديد
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                            title="حذف هذا البند"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>

                        {/* Product Name from Invoice */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            اسم المنتج الوارد بالفاتورة
                          </label>
                          <input
                            type="text"
                            name={`item_name_${item.id}`}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-bwignore="true"
                            data-form-type="other"
                            value={item.name}
                            onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                            placeholder="اسم المنتج"
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg font-bold"
                          />
                        </div>

                        {/* Smart Pairing & Search Selector (Full Mobile Width) */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                            الاقتران بمنتج المخزن
                          </label>
                          <ProductPairSelector 
                            item={item} 
                            products={products} 
                            onPair={handlePairProduct}
                            isCardMode={true}
                          />
                        </div>

                        {/* Price Change & Profit Margin Alert Banner */}
                        <PriceAlertBanner 
                          item={item} 
                          matchedProduct={matchedProd} 
                          currency={settings.currency} 
                          onApplySuggestedPrice={(p) => handleItemChange(item.id, 'sellingPrice', p)} 
                          onDuplicateAsNew={() => handleDuplicateAsNewProduct(item.id)}
                        />

                        {/* Quantity & Unit Row */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200/70 dark:border-slate-700/60">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                              نوع الوحدة
                            </label>
                            <select
                              value={item.unitType || 'piece'}
                              onChange={(e) => handleItemChange(item.id, 'unitType', e.target.value as 'carton' | 'piece')}
                              className="w-full px-1.5 py-1 text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded font-bold"
                            >
                              <option value="carton">كرتونة</option>
                              <option value="piece">قطعة</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                              قطع/كرتونة
                            </label>
                            <input
                              type="number"
                              min="1"
                              inputMode="numeric"
                              autoComplete="off"
                              autoCorrect="off"
                              data-lpignore="true"
                              data-1p-ignore="true"
                              data-bwignore="true"
                              data-form-type="other"
                              value={item.piecesPerBox || 1}
                              onChange={(e) => handleItemChange(item.id, 'piecesPerBox', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full px-1.5 py-1 text-xs text-center border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded font-black text-slate-700 dark:text-slate-200"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                              الكمية الواردة
                            </label>
                            <input
                              type="number"
                              min="1"
                              inputMode="decimal"
                              autoComplete="off"
                              autoCorrect="off"
                              data-lpignore="true"
                              data-1p-ignore="true"
                              data-bwignore="true"
                              data-form-type="other"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                              className="w-full px-1.5 py-1 text-xs text-center border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded font-black text-blue-600 dark:text-blue-400"
                            />
                          </div>
                        </div>

                        {/* Calculated Pieces Summary */}
                        <div className="text-[11px] text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1.5 rounded-lg flex items-center justify-between border border-blue-200/60 dark:border-blue-800/50">
                          <span>
                            📦 سيضاف للمخزون: <strong className="text-blue-800 dark:text-blue-200 text-xs font-black">{totalPieces} قطعة</strong>
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {item.unitType === 'carton' ? `(${qty} كرتونة × ${ppb})` : `(حساب بالقطعة)`}
                          </span>
                        </div>

                        {/* Pricing & Total Row */}
                        <div className={canViewCostPrices ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}>
                          {canViewCostPrices ? (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                سعر الشراء ({item.unitType === 'carton' ? 'كرتونة' : 'قطعة'})
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                inputMode="decimal"
                                autoComplete="off"
                                autoCorrect="off"
                                data-lpignore="true"
                                data-1p-ignore="true"
                                data-bwignore="true"
                                data-form-type="other"
                                value={item.costPrice}
                                onChange={(e) => handleItemChange(item.id, 'costPrice', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded font-bold"
                              />
                              {item.unitType === 'carton' && (
                                <div className="text-[9px] text-slate-400 mt-0.5">
                                  القطعة: {formatCurrency(piecePrice, settings.currency)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                              <Lock size={14} className="shrink-0 text-slate-400" />
                              <span>سعر الشراء محمي</span>
                            </div>
                          )}

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                              سعر البيع ({item.unitType === 'carton' ? 'كرتونة' : 'قطعة'})
                            </label>
                            <input
                              type="number"
                              step="0.001"
                              inputMode="decimal"
                              autoComplete="off"
                              autoCorrect="off"
                              data-lpignore="true"
                              data-1p-ignore="true"
                              data-bwignore="true"
                              data-form-type="other"
                              value={item.sellingPrice}
                              onChange={(e) => handleItemChange(item.id, 'sellingPrice', e.target.value)}
                              disabled={!canEditProductPrices}
                              className={`w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded font-bold text-emerald-600 dark:text-emerald-400 ${
                                !canEditProductPrices ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''
                              }`}
                            />
                            <div className="text-[9px] text-slate-400 mt-0.5 font-medium">
                              {item.unitType === 'carton' ? (
                                <span>القطعة: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(ppb > 0 ? (Number(item.sellingPrice) / ppb) : Number(item.sellingPrice), settings.currency)}</strong></span>
                              ) : ppb > 1 ? (
                                <span>الكرتونة: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(Number(item.sellingPrice) * ppb, settings.currency)}</strong></span>
                              ) : null}
                            </div>
                          </div>

                          {canViewCostPrices && (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                إجمالي البند
                              </label>
                              <div className="px-2 py-1 text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800 text-center">
                                {formatCurrency(item.total, settings.currency)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 💻 DESKTOP COMPREHENSIVE TABLE VIEW (>= md) */}
                <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5 w-8 text-center">#</th>
                        <th className="p-2.5 min-w-[220px]">اسم المنتج وربطه بالمخزن</th>
                        <th className="p-2.5 w-28">الباركود</th>
                        <th className="p-2.5 w-28 text-center">الوحدة المشتراة</th>
                        <th className="p-2.5 w-20 text-center">قطع/كرتونة</th>
                        <th className="p-2.5 w-20 text-center">الكمية</th>
                        {canViewCostPrices && <th className="p-2.5 w-28">سعر الشراء</th>}
                        <th className="p-2.5 w-28">سعر البيع</th>
                        {canViewCostPrices && <th className="p-2.5 w-24">الإجمالي</th>}
                        <th className="p-2.5 w-24 text-center">الحالة</th>
                        <th className="p-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {items.map((item, index) => {
                        const ppb = Number(item.piecesPerBox) > 0 ? Number(item.piecesPerBox) : 1;
                        const qty = Number(item.quantity) || 0;
                        const cost = Number(item.costPrice) || 0;
                        const totalPieces = item.unitType === 'carton' ? (qty * ppb) : qty;
                        const piecePrice = item.unitType === 'carton' ? (cost / ppb) : cost;
                        const boxPrice = item.unitType === 'carton' ? cost : (cost * ppb);

                        return (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-2 text-center font-bold text-slate-400">{index + 1}</td>
                            
                            {/* Name */}
                            <td className="p-2">
                              <input
                                type="text"
                                name={`table_item_name_${item.id}`}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                data-lpignore="true"
                                data-1p-ignore="true"
                                data-bwignore="true"
                                data-form-type="other"
                                value={item.name}
                                onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                                placeholder="اسم المنتج"
                                className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded font-bold"
                              />
                              <ProductPairSelector 
                                item={item} 
                                products={products} 
                                onPair={handlePairProduct} 
                              />
                              <PriceAlertBanner 
                                item={item} 
                                matchedProduct={products.find(p => p.id === item.matchedProductId)} 
                                currency={settings.currency} 
                                onApplySuggestedPrice={(p) => handleItemChange(item.id, 'sellingPrice', p)} 
                                onDuplicateAsNew={() => handleDuplicateAsNewProduct(item.id)}
                                canViewCostPrices={canViewCostPrices}
                              />
                            </td>

                            {/* Barcode */}
                            <td className="p-2">
                              <input
                                type="text"
                                name={`table_item_barcode_${item.id}`}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                data-lpignore="true"
                                data-1p-ignore="true"
                                data-bwignore="true"
                                data-form-type="other"
                                value={item.barcode || ''}
                                onChange={(e) => handleItemChange(item.id, 'barcode', e.target.value)}
                                placeholder="الباركود"
                                className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded font-mono text-xs"
                              />
                            </td>

                            {/* Unit Type Selection */}
                            <td className="p-2">
                              <select
                                value={item.unitType || 'piece'}
                                onChange={(e) => handleItemChange(item.id, 'unitType', e.target.value as 'carton' | 'piece')}
                                className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded font-bold text-xs"
                              >
                                <option value="carton">كرتونة / صندوق</option>
                                <option value="piece">قطعة / حبة</option>
                              </select>
                            </td>

                            {/* Pieces per Box */}
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                inputMode="numeric"
                                autoComplete="off"
                                autoCorrect="off"
                                data-lpignore="true"
                                data-1p-ignore="true"
                                data-bwignore="true"
                                data-form-type="other"
                                value={item.piecesPerBox || 1}
                                onChange={(e) => handleItemChange(item.id, 'piecesPerBox', Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full px-1.5 py-1 text-center border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded font-black text-slate-700 dark:text-slate-200"
                              />
                            </td>

                            {/* Quantity */}
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                inputMode="decimal"
                                autoComplete="off"
                                autoCorrect="off"
                                data-lpignore="true"
                                data-1p-ignore="true"
                                data-bwignore="true"
                                data-form-type="other"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                className="w-full px-2 py-1 text-center border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded font-black text-blue-600 dark:text-blue-400"
                              />
                              {item.unitType === 'carton' && ppb > 1 && (
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-0.5 text-center">
                                  (+{totalPieces} قطعة)
                                </div>
                              )}
                            </td>

                            {/* Cost Price */}
                            {canViewCostPrices && (
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.001"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  autoCorrect="off"
                                  data-lpignore="true"
                                  data-1p-ignore="true"
                                  data-bwignore="true"
                                  data-form-type="other"
                                  value={item.costPrice}
                                  onChange={(e) => handleItemChange(item.id, 'costPrice', e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded font-bold"
                                />
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                  {item.unitType === 'carton' ? (
                                    <span>سعر القطعة: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(piecePrice, settings.currency)}</strong></span>
                                  ) : (
                                    <span>سعر الكرتونة: <strong>{formatCurrency(boxPrice, settings.currency)}</strong></span>
                                  )}
                                </div>
                              </td>
                            )}

                            {/* Selling Price */}
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.001"
                                inputMode="decimal"
                                autoComplete="off"
                                autoCorrect="off"
                                data-lpignore="true"
                                data-1p-ignore="true"
                                data-bwignore="true"
                                data-form-type="other"
                                value={item.sellingPrice}
                                onChange={(e) => handleItemChange(item.id, 'sellingPrice', e.target.value)}
                                disabled={!canEditProductPrices}
                                className={`w-full px-2 py-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded font-bold text-emerald-600 dark:text-emerald-400 ${
                                  !canEditProductPrices ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''
                                }`}
                              />
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                {item.unitType === 'carton' ? (
                                  <span>القطعة: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(ppb > 0 ? (Number(item.sellingPrice) / ppb) : Number(item.sellingPrice), settings.currency)}</strong></span>
                                ) : ppb > 1 ? (
                                  <span>الكرتونة: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(item.sellingPrice) * ppb, settings.currency)}</strong></span>
                                ) : null}
                              </div>
                            </td>

                            {/* Total */}
                            {canViewCostPrices && (
                              <td className="p-2 font-black text-slate-800 dark:text-white">
                                {formatCurrency(item.total, settings.currency)}
                              </td>
                            )}

                            {/* Stock Status Badge */}
                            <td className="p-2 text-center">
                              {item.matchedProductId ? (
                                <span className="inline-flex flex-col items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                                  <span className="flex items-center gap-1">
                                    <Check className="w-3 h-3 text-blue-600" />
                                    مرتبط بالمخزن
                                  </span>
                                  {item.originalInvoiceName && item.originalInvoiceName.trim().toLowerCase() !== item.name.trim().toLowerCase() && (
                                    <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-normal mt-0.5" title={`سيُسجل "${item.originalInvoiceName}" كاسم بديل تلقائياً`}>
                                      اسم بديل سينحفظ ✨
                                    </span>
                                  )}
                                </span>
                              ) : item.copiedFromProductId ? (
                                <span className="inline-flex flex-col items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                                  <span className="flex items-center gap-1">
                                    <Copy className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                    نسخة جديدة
                                  </span>
                                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-normal mt-0.5">
                                    بالأسعار الجديدة
                                  </span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                  منتج جديد
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Modal Footer (Sticky Bottom Action Bar) */}
        <div className="p-3.5 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/90 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 shrink-0 shadow-lg">
          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
            {canViewCostPrices ? (
              <>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي مبلغ الفاتورة:</span>
                <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                  {formatCurrency(calculateGrandTotal(), settings.currency)}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي الأصناف المدخلة:</span>
                <span className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400">
                  {items.length} صنف ({items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)} وحدة)
                </span>
              </>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-xs sm:text-sm"
            >
              إلغاء
            </button>

            {/* If Manager and not reviewing an existing receipt, allow saving as draft/pending */}
            {canViewCostPrices && !initialReceipt && (
              <button
                type="button"
                onClick={handleSaveAsPendingReceipt}
                disabled={isSaving || items.length === 0}
                className="px-4 sm:px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-xl font-bold transition-all disabled:opacity-50 text-xs sm:text-sm"
              >
                حفظ كإذن معلق للمراجعة
              </button>
            )}

            {/* If storekeeper without cost access, primary action is Send for Approval */}
            {!canViewCostPrices ? (
              <button
                type="button"
                onClick={handleSaveAsPendingReceipt}
                disabled={isSaving || items.length === 0}
                className="flex items-center justify-center space-x-2 space-x-reverse px-5 sm:px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl font-black shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 text-xs sm:text-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin shrink-0" />
                    <span>جاري الإرسال...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span>حفظ وإرسال للاعتماد من المدير العام</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApproveAndCommitInvoice}
                disabled={isSaving || items.length === 0}
                className={`flex items-center justify-center space-x-2 space-x-reverse px-5 sm:px-6 py-2.5 ${
                  initialReceipt 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/25' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                } text-white rounded-xl font-black shadow-lg transition-all disabled:opacity-50 text-xs sm:text-sm`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin shrink-0" />
                    <span>جاري الترحيل...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span>
                      {initialReceipt ? 'اعتماد الفاتورة وترحيلها رسمياً للمخزون والحسابات' : 'اعتماد الفاتورة وتحديث المخزون'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

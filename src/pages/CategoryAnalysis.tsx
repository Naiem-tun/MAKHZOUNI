import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { Product } from '../types';
import { sanitizeProduct, formatCurrency } from '../lib/utils';
import {
  Star,
  Gem,
  TrendingUp,
  AlertTriangle,
  Search,
  Package,
  ArrowUpDown,
  ChevronDown,
  HelpCircle,
  X,
} from 'lucide-react';
import { useFolioTheme } from '../components/folio/FolioPageChrome';
import { matchesQuery } from '../components/dashboard/PurchaseVarianceModal';

export type ProductClassification = 'star' | 'traffic' | 'gem' | 'underperformer' | 'neutral';

export interface EvaluatedProduct {
  id: string;
  name: string;
  category: string;
  barcode?: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  piecesPerBox?: number;
  profitPerUnit: number;
  marginPct: number;
  batchCapital: number;
  batchPotentialProfit: number;
  classification: ProductClassification;
  tagTitle: string;
  recommendation: string;
}

export interface CategoryEvaluation {
  id: string;
  name: string;
  iconName?: string;
  totalProductsCount: number;
  activeStockCount: number;
  totalPieces: number;
  totalCapital: number;
  totalPotentialProfit: number;
  avgMarginPct: number;
  starsCount: number;
  gemsCount: number;
  trafficCount: number;
  underperformersCount: number;
  items: EvaluatedProduct[];
}

export default function CategoryAnalysis() {
  const { user, settings } = useAppContext();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'star' | 'traffic' | 'gem' | 'underperformer'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'potentialProfit' | 'margin' | 'quantity' | 'capital'>(
    'potentialProfit',
  );
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showLogicInfo, setShowLogicInfo] = useState(false);

  const { theme } = useFolioTheme(
    Boolean(settings.darkMode),
    settings.folioThemeId,
  );
  const showFinancials = settings.showFinancials ?? true;
  const language = settings.language || 'ar';
  const formatPrivateValue = (val: number) =>
    !showFinancials ? '••••••' : formatCurrency(val, settings.currency, language);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const path = `users/${user.uid}/products`;
    const unsub = onSnapshot(
      collection(db, path),
      (snap) => {
        const liveList = snap.docs.map((doc) =>
          sanitizeProduct({ id: doc.id, ...doc.data() } as Product),
        );
        setProducts(liveList.filter((p) => !p.isDraft));
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load products for category analysis:', err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  const categoryEvaluations = useMemo<Record<string, CategoryEvaluation>>(() => {
    const activeProducts = products.filter((p) => (p.quantity ?? 0) > 0);
    const grouped: Record<string, Product[]> = {};

    activeProducts.forEach((p) => {
      const cat = p.category?.trim() || 'أخرى';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    const evaluations: Record<string, CategoryEvaluation> = {};

    Object.entries(grouped).forEach(([catName, catProducts]) => {
      let totalPieces = 0;
      let totalCapital = 0;
      let totalPotentialProfit = 0;
      let sumMargin = 0;

      catProducts.forEach((p) => {
        const qty = Math.max(0, p.quantity ?? 0);
        const cost = Math.max(0, p.purchasePrice ?? 0);
        const sell = Math.max(0, p.sellingPrice ?? 0);
        const profit = Math.max(0, sell - cost);
        const marginPct = cost > 0 ? (profit / cost) * 100 : 0;

        totalPieces += qty;
        totalCapital += qty * cost;
        totalPotentialProfit += qty * profit;
        sumMargin += marginPct;
      });

      const avgMarginPct = catProducts.length > 0 ? sumMargin / catProducts.length : 0;
      const avgCapitalPerItem = catProducts.length > 0 ? totalCapital / catProducts.length : 0;
      const avgProfitPerItem =
        catProducts.length > 0 ? totalPotentialProfit / catProducts.length : 0;

      let starsCount = 0;
      let gemsCount = 0;
      let trafficCount = 0;
      let underperformersCount = 0;

      const evaluatedItems: EvaluatedProduct[] = catProducts.map((p) => {
        const qty = Math.max(0, p.quantity ?? 0);
        const cost = Math.max(0, p.purchasePrice ?? 0);
        const sell = Math.max(0, p.sellingPrice ?? 0);
        const profit = Math.max(0, sell - cost);
        const marginPct = cost > 0 ? (profit / cost) * 100 : 0;
        const batchCapital = qty * cost;
        const batchPotentialProfit = qty * profit;

        let classification: ProductClassification = 'neutral';
        let tagTitle = 'سلعة متوازنة';
        let recommendation = 'أداء طبيعي ومتناسق مع الفئة، استمر على نفس وتيرة الشراء.';

        const isSubsidizedBaseline = marginPct <= 8.5;

        if (
          marginPct >= avgMarginPct * 0.95 &&
          (batchPotentialProfit >= avgProfitPerItem || batchCapital >= avgCapitalPerItem)
        ) {
          classification = 'star';
          tagTitle = 'سلعة ذهبية';
          recommendation =
            'ركيزة أرباح أساسية للفئة؛ حافظ على تواجدها الدائم ولا تدع الرف ينفد منها.';
          starsCount++;
        } else if (marginPct >= Math.max(22, avgMarginPct * 1.3) && qty <= 8) {
          classification = 'gem';
          tagTitle = 'فرصة مدفونة';
          recommendation =
            'هامش ربح ممتاز جداً ولكن كميتها المتبقية قليلة؛ زيادة كميتها سترفع أرباح الرف.';
          gemsCount++;
        } else if ((isSubsidizedBaseline || marginPct < avgMarginPct * 0.75) && qty >= 15) {
          classification = 'traffic';
          tagTitle = 'محرك سيولة';
          recommendation =
            'سلعة سريعة الدوران تجلب الزبائن؛ حافظ على تزويدها دون تجميد سيولة زائدة.';
          trafficCount++;
        } else if (
          marginPct < avgMarginPct * 0.6 &&
          !isSubsidizedBaseline &&
          batchCapital > avgCapitalPerItem * 0.8
        ) {
          classification = 'underperformer';
          tagTitle = 'تحتاج مراجعة';
          recommendation =
            'هامش ربحها ضعيف مقارنة بباقي سلع الفئة وتجمد مالاً كبيراً؛ راجع سعر شرائها أو استبدلها.';
          underperformersCount++;
        }

        return {
          id: p.id || '',
          name: p.name,
          category: catName,
          barcode: p.barcode,
          purchasePrice: cost,
          sellingPrice: sell,
          quantity: qty,
          piecesPerBox: p.piecesPerBox,
          profitPerUnit: profit,
          marginPct,
          batchCapital,
          batchPotentialProfit,
          classification,
          tagTitle,
          recommendation,
        };
      });

      evaluations[catName] = {
        id: catName,
        name: catName,
        totalProductsCount: catProducts.length,
        activeStockCount: catProducts.length,
        totalPieces,
        totalCapital,
        totalPotentialProfit,
        avgMarginPct,
        starsCount,
        gemsCount,
        trafficCount,
        underperformersCount,
        items: evaluatedItems,
      };
    });

    return evaluations;
  }, [products]);

  const categoriesList = useMemo(() => {
    return Object.values(categoryEvaluations).sort((a, b) => b.totalCapital - a.totalCapital);
  }, [categoryEvaluations]);

  const globalStoreSummary = useMemo(() => {
    let totalPieces = 0;
    let totalCapital = 0;
    let totalPotentialProfit = 0;
    let totalStars = 0;
    let totalGems = 0;
    let totalTraffic = 0;
    let totalUnderperformers = 0;
    let totalProducts = 0;

    categoriesList.forEach((cat) => {
      totalPieces += cat.totalPieces;
      totalCapital += cat.totalCapital;
      totalPotentialProfit += cat.totalPotentialProfit;
      totalStars += cat.starsCount;
      totalGems += cat.gemsCount;
      totalTraffic += cat.trafficCount;
      totalUnderperformers += cat.underperformersCount;
      totalProducts += cat.totalProductsCount;
    });

    const avgMargin = totalCapital > 0 ? (totalPotentialProfit / totalCapital) * 100 : 0;

    return {
      totalCategories: categoriesList.length,
      totalProducts,
      totalPieces,
      totalCapital,
      totalPotentialProfit,
      avgMargin,
      totalStars,
      totalGems,
      totalTraffic,
      totalUnderperformers,
    };
  }, [categoriesList]);

  const displayedItems = useMemo(() => {
    let list: EvaluatedProduct[] = [];

    if (selectedCategory === 'all') {
      Object.values(categoryEvaluations).forEach((c) => {
        list.push(...c.items);
      });
    } else if (categoryEvaluations[selectedCategory]) {
      list = [...categoryEvaluations[selectedCategory].items];
    }

    if (activeFilter !== 'all') {
      list = list.filter((it) => it.classification === activeFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim();
      list = list.filter(
        (it) =>
          matchesQuery(it.name, q) ||
          matchesQuery(it.category, q) ||
          (it.barcode && it.barcode.toLowerCase().includes(q.toLowerCase())),
      );
    }

    list.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'potentialProfit') diff = a.batchPotentialProfit - b.batchPotentialProfit;
      else if (sortBy === 'margin') diff = a.marginPct - b.marginPct;
      else if (sortBy === 'quantity') diff = a.quantity - b.quantity;
      else if (sortBy === 'capital') diff = a.batchCapital - b.batchCapital;
      return sortOrder === 'desc' ? -diff : diff;
    });

    return list;
  }, [categoryEvaluations, selectedCategory, activeFilter, searchTerm, sortBy, sortOrder]);

  const currentCategoryData =
    selectedCategory !== 'all' ? categoryEvaluations[selectedCategory] : null;

  const getTagColor = (classification: ProductClassification) => {
    if (classification === 'star') return theme.positive;
    if (classification === 'gem') return theme.accent;
    if (classification === 'traffic') return theme.neutral;
    if (classification === 'underperformer') return theme.negative;
    return theme.textMuted;
  };

  return (
    <div
      className="min-h-screen px-2.5 sm:px-5 pt-3 pb-24 transition-colors"
      style={{ backgroundColor: theme.bg, color: theme.text }}
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto space-y-5">
        {/* FOLIO HEADER */}
        <header
          className="border-b pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-right"
          style={{ borderColor: theme.border }}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: theme.textMuted }}>
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                FOLIO
              </span>
              <span aria-hidden="true">·</span>
              <span>مقارنة السلع داخل كل فئة وفق العائد ورأس المال</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: theme.text }}>
              تحليل الفئات والمنتجات الذكي
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowLogicInfo((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: showLogicInfo ? theme.text : theme.surface,
                borderColor: showLogicInfo ? theme.text : theme.border,
                color: showLogicInfo ? theme.surface : theme.text,
              }}
            >
              <HelpCircle size={14} style={{ color: showLogicInfo ? theme.surface : theme.accent }} />
              <span>آلية التقييم</span>
              <ChevronDown
                size={13}
                className={showLogicInfo ? 'rotate-180 transition-transform' : 'transition-transform'}
              />
            </button>
          </div>
        </header>

        {/* LOGIC EXPLANATION DRAWER */}
        <AnimatePresence>
          {showLogicInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <section
                className="border p-4 space-y-3 text-right"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <div className="text-xs font-black" style={{ color: theme.accent }}>
                  الأساس الرياضي لتقييم السلع داخل الفئة
                </div>
                <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
                  تُقاس كل سلعة بمقارنة هامش ربحها بـ{' '}
                  <strong style={{ color: theme.text }}>متوسط هامش الفئة نفسها</strong> ووزن رأس
                  المال المجمد في دفعتها:
                </p>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse"
                  style={{ borderColor: theme.border }}
                >
                  <div className="p-3 space-y-1" style={{ borderColor: theme.border }}>
                    <div className="flex items-center gap-1.5 text-xs font-black" style={{ color: theme.positive }}>
                      <Star size={13} />
                      <span>سلع ذهبية</span>
                    </div>
                    <p className="text-[11px] leading-snug" style={{ color: theme.textMuted }}>
                      ربحها أعلى من متوسط الفئة وتدر أعلى أرباح صافية؛ لا تدع الرف ينفد منها.
                    </p>
                  </div>
                  <div className="p-3 space-y-1" style={{ borderColor: theme.border }}>
                    <div className="flex items-center gap-1.5 text-xs font-black" style={{ color: theme.accent }}>
                      <Gem size={13} />
                      <span>فرص مدفونة</span>
                    </div>
                    <p className="text-[11px] leading-snug" style={{ color: theme.textMuted }}>
                      هامش ربح ممتاز ولكن الكمية المتبقية قليلة؛ زيادتها ترفع أرباح الفئة.
                    </p>
                  </div>
                  <div className="p-3 space-y-1" style={{ borderColor: theme.border }}>
                    <div className="flex items-center gap-1.5 text-xs font-black" style={{ color: theme.neutral }}>
                      <TrendingUp size={13} />
                      <span>محركات سيولة</span>
                    </div>
                    <p className="text-[11px] leading-snug" style={{ color: theme.textMuted }}>
                      هامش منخفض ودوران عالٍ يجلب الزبائن؛ حافظ على تدفقها دون تجميد سيولة.
                    </p>
                  </div>
                  <div className="p-3 space-y-1" style={{ borderColor: theme.border }}>
                    <div className="flex items-center gap-1.5 text-xs font-black" style={{ color: theme.negative }}>
                      <AlertTriangle size={13} />
                      <span>تحتاج مراجعة</span>
                    </div>
                    <p className="text-[11px] leading-snug" style={{ color: theme.textMuted }}>
                      ربح ضعيف مقارنة بالفئة وتجمد مالاً كبيراً؛ راجع سعر الشراء أو استبدلها.
                    </p>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SECTION 01: 4-CELL KPI STRIP */}
        <section
          className="border text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="px-4 py-2.5 border-b flex items-center justify-between"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                01
              </span>
              <span>
                {currentCategoryData
                  ? `مؤشرات فئة «${currentCategoryData.name}»`
                  : 'المؤشرات الإجمالية للمخزون النشط'}
              </span>
            </div>
            <span className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
              {currentCategoryData
                ? `${currentCategoryData.activeStockCount} صنف`
                : `${globalStoreSummary.totalProducts} صنف · ${globalStoreSummary.totalCategories} فئة`}
            </span>
          </div>

          <div
            className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-x-reverse"
            style={{ borderColor: theme.border }}
          >
            <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                القطع المتوفرة حالياً
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tabular-nums">
                {(currentCategoryData
                  ? currentCategoryData.totalPieces
                  : globalStoreSummary.totalPieces
                ).toLocaleString()}
              </div>
              <div className="text-[10px]" style={{ color: theme.textMuted }}>
                قطعة على الرفوف
              </div>
            </div>

            <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                رأس المال المجمد
              </div>
              <div
                className="text-xl sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.text }}
              >
                {formatPrivateValue(
                  currentCategoryData
                    ? currentCategoryData.totalCapital
                    : globalStoreSummary.totalCapital,
                )}
              </div>
              <div className="text-[10px]" style={{ color: theme.textMuted }}>
                بقيمة التكلفة الحالية
              </div>
            </div>

            <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                الأرباح المتوقعة للدفعة
              </div>
              <div
                className="text-xl sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.positive }}
              >
                {formatPrivateValue(
                  currentCategoryData
                    ? currentCategoryData.totalPotentialProfit
                    : globalStoreSummary.totalPotentialProfit,
                )}
              </div>
              <div className="text-[10px]" style={{ color: theme.textMuted }}>
                عند بيع كامل الكمية
              </div>
            </div>

            <div className="p-4 space-y-1" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                متوسط هامش الربح
              </div>
              <div
                className="text-xl sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.accent }}
              >
                {(currentCategoryData
                  ? currentCategoryData.avgMarginPct
                  : globalStoreSummary.avgMargin
                ).toFixed(1)}
                %
              </div>
              <div className="text-[10px]" style={{ color: theme.textMuted }}>
                {currentCategoryData ? 'المعيار المرجعي للفئة' : 'متوسط المتجر الكلي'}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 02: CATEGORIES ALLOCATION TABLE */}
        <section
          className="border text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="p-4 border-b flex flex-wrap items-center justify-between gap-2"
            style={{ borderColor: theme.border }}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                  02
                </span>
                <span style={{ color: theme.textMuted }}>توزيع رأس المال والعائد</span>
              </div>
              <h2 className="text-sm sm:text-base font-black">جدول الفئات (اضغط للتصفية)</h2>
            </div>

            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="px-3 py-1.5 text-xs font-bold border cursor-pointer"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text,
                }}
              >
                عرض كل الفئات ({globalStoreSummary.totalCategories})
              </button>
            )}
          </div>

          {categoriesList.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold" style={{ color: theme.textMuted }}>
              لا توجد فئات برصيد متاح حالياً.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr
                    className="border-b font-bold"
                    style={{
                      borderColor: theme.border,
                      backgroundColor: theme.surfaceMuted,
                      color: theme.textMuted,
                    }}
                  >
                    <th className="py-2.5 px-3">الفئة</th>
                    <th className="py-2.5 px-3">الأصناف</th>
                    <th className="py-2.5 px-3">رأس المال</th>
                    <th className="py-2.5 px-3">الربح المتوقع</th>
                    <th className="py-2.5 px-3">الهامش</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriesList.map((cat, idx) => {
                    const active = selectedCategory === cat.id;
                    const capShare =
                      globalStoreSummary.totalCapital > 0
                        ? Math.round((cat.totalCapital / globalStoreSummary.totalCapital) * 100)
                        : 0;
                    return (
                      <tr
                        key={cat.id}
                        onClick={() =>
                          setSelectedCategory(active ? 'all' : cat.id)
                        }
                        className="border-b last:border-b-0 cursor-pointer transition-colors"
                        style={{
                          borderColor: theme.border,
                          backgroundColor: active ? theme.surfaceMuted : 'transparent',
                        }}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-bold"
                              style={{ color: active ? theme.accent : theme.text }}
                            >
                              {cat.name}
                            </span>
                            <span
                              className="text-[10px] font-mono tabular-nums"
                              style={{ color: theme.textMuted }}
                            >
                              {capShare}%
                            </span>
                          </div>
                          <div
                            className="w-full h-1 mt-1.5 overflow-hidden"
                            style={{ backgroundColor: theme.bg }}
                          >
                            <div
                              className="h-full"
                              style={{
                                width: `${Math.max(4, capShare)}%`,
                                backgroundColor: theme.series[idx % theme.series.length],
                              }}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          {cat.activeStockCount}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-bold">
                          {formatPrivateValue(cat.totalCapital)}
                        </td>
                        <td
                          className="py-2.5 px-3 font-mono tabular-nums font-black"
                          style={{ color: theme.positive }}
                        >
                          +{formatPrivateValue(cat.totalPotentialProfit)}
                        </td>
                        <td
                          className="py-2.5 px-3 font-mono tabular-nums font-bold"
                          style={{ color: theme.accent }}
                        >
                          {cat.avgMarginPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SECTION 03: PRODUCT QUALITY MATRIX + SEARCH + EVALUATED ITEMS */}
        <section
          className="border text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="p-4 border-b space-y-3"
            style={{ borderColor: theme.border }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                    03
                  </span>
                  <span style={{ color: theme.textMuted }}>تقييم السلع التفصيلي</span>
                </div>
                <h2 className="text-sm sm:text-base font-black">
                  توزيع جودة السلع في{' '}
                  {selectedCategory === 'all' ? 'المتجر ككل' : `فئة «${selectedCategory}»`}
                </h2>
              </div>
              <span className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                {displayedItems.length} سلعة مطابقة
              </span>
            </div>

            {/* Quality Classification Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {[
                {
                  id: 'all',
                  label: 'عرض الكل',
                  count: currentCategoryData
                    ? currentCategoryData.activeStockCount
                    : globalStoreSummary.totalProducts,
                  color: theme.text,
                },
                {
                  id: 'star',
                  label: 'سلع ذهبية',
                  count: currentCategoryData
                    ? currentCategoryData.starsCount
                    : globalStoreSummary.totalStars,
                  color: theme.positive,
                },
                {
                  id: 'gem',
                  label: 'فرص مدفونة',
                  count: currentCategoryData
                    ? currentCategoryData.gemsCount
                    : globalStoreSummary.totalGems,
                  color: theme.accent,
                },
                {
                  id: 'traffic',
                  label: 'محركات سيولة',
                  count: currentCategoryData
                    ? currentCategoryData.trafficCount
                    : globalStoreSummary.totalTraffic,
                  color: theme.neutral,
                },
                {
                  id: 'underperformer',
                  label: 'تحتاج مراجعة',
                  count: currentCategoryData
                    ? currentCategoryData.underperformersCount
                    : globalStoreSummary.totalUnderperformers,
                  color: theme.negative,
                },
              ].map((btn) => {
                const active = activeFilter === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setActiveFilter(btn.id as any)}
                    className="p-2.5 border text-right transition-colors cursor-pointer"
                    style={{
                      backgroundColor: active ? theme.text : theme.bg,
                      borderColor: active ? theme.text : theme.border,
                      color: active ? theme.surface : theme.text,
                    }}
                  >
                    <div
                      className="text-[11px] font-bold truncate"
                      style={{ color: active ? theme.surface : btn.color }}
                    >
                      {btn.label}
                    </div>
                    <div className="text-xs font-black font-mono tabular-nums mt-0.5">
                      {btn.count} سلعة
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Search & Sort Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <div
                className="flex items-center gap-2 px-3 py-2 border flex-1"
                style={{ backgroundColor: theme.bg, borderColor: theme.border }}
              >
                <Search size={14} style={{ color: theme.textMuted }} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث عن اسم السلعة، الفئة، أو الباركود..."
                  className="bg-transparent text-xs w-full outline-none"
                  style={{ color: theme.text }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="cursor-pointer"
                    style={{ color: theme.textMuted }}
                    aria-label="مسح البحث"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="px-3 py-2 border text-xs font-bold outline-none cursor-pointer"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  <option value="potentialProfit">ترتيب: الأرباح المحتملة</option>
                  <option value="margin">ترتيب: نسبة الربح</option>
                  <option value="quantity">ترتيب: الكمية</option>
                  <option value="capital">ترتيب: رأس المال المجمد</option>
                </select>

                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="p-2 border cursor-pointer"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                  title={sortOrder === 'desc' ? 'تنازلي' : 'تصاعدي'}
                >
                  <ArrowUpDown size={15} />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div
                className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: theme.accent, borderTopColor: 'transparent' }}
              />
              <span className="text-xs font-bold" style={{ color: theme.textMuted }}>
                جاري تحليل السلع الحالية بالمتجر...
              </span>
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <Package size={28} className="mx-auto opacity-40" style={{ color: theme.textMuted }} />
              <div className="text-xs font-black" style={{ color: theme.text }}>
                لا توجد سلع مطابقة لهذا الفلتر
              </div>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>
                جرب تغيير الفئة المحددة أو إلغاء فلتر التقييم لعرض المنتجات الأخرى.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: theme.border }}>
              {displayedItems.map((item, idx) => {
                const tagColor = getTagColor(item.classification);
                return (
                  <div
                    key={item.id || idx}
                    className="p-4 space-y-3"
                    style={{
                      borderColor: theme.border,
                      borderRightWidth: '3px',
                      borderRightStyle: 'solid',
                      borderRightColor: tagColor,
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="font-mono tabular-nums text-xs font-black shrink-0"
                            style={{ color: theme.textMuted }}
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <h3 className="text-sm sm:text-base font-black truncate">{item.name}</h3>
                        </div>

                        <div
                          className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
                          style={{ color: theme.textMuted }}
                        >
                          <span className="font-bold" style={{ color: tagColor }}>
                            {item.tagTitle}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{item.category}</span>
                          {item.barcode && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums" dir="ltr">
                                {item.barcode}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="self-end sm:self-auto text-left shrink-0">
                        <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>
                          الربح المتوقع للكمية
                        </div>
                        <div
                          className="text-base font-black font-mono tabular-nums"
                          style={{ color: theme.positive }}
                        >
                          +{formatPrivateValue(item.batchPotentialProfit)}
                        </div>
                      </div>
                    </div>

                    <div
                      className="grid grid-cols-2 sm:grid-cols-4 border divide-y sm:divide-y-0 divide-x divide-x-reverse text-xs"
                      style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                    >
                      <div className="p-2.5 space-y-0.5" style={{ borderColor: theme.border }}>
                        <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>
                          الشراء / البيع
                        </div>
                        <div className="font-mono tabular-nums font-bold">
                          {formatPrivateValue(item.purchasePrice)}{' '}
                          <span style={{ color: theme.textMuted }}>←</span>{' '}
                          {formatCurrency(item.sellingPrice, settings.currency, language)}
                        </div>
                      </div>

                      <div className="p-2.5 space-y-0.5" style={{ borderColor: theme.border }}>
                        <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>
                          هامش الربح
                        </div>
                        <div className="font-mono tabular-nums font-black" style={{ color: tagColor }}>
                          {item.marginPct.toFixed(1)}%{' '}
                          <span
                            className="text-[10px] font-normal"
                            style={{ color: theme.textMuted }}
                          >
                            (+{formatPrivateValue(item.profitPerUnit)})
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 space-y-0.5" style={{ borderColor: theme.border }}>
                        <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>
                          الكمية المتوفرة
                        </div>
                        <div className="font-mono tabular-nums font-bold">
                          {item.quantity} قطعة{' '}
                          {item.piecesPerBox && item.piecesPerBox > 1 && (
                            <span
                              className="text-[10px] font-normal"
                              style={{ color: theme.textMuted }}
                            >
                              ({Math.floor(item.quantity / item.piecesPerBox)} كرتونة)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-2.5 space-y-0.5" style={{ borderColor: theme.border }}>
                        <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>
                          رأس المال المجمد
                        </div>
                        <div className="font-mono tabular-nums font-bold">
                          {formatPrivateValue(item.batchCapital)}
                        </div>
                      </div>
                    </div>

                    <div
                      className="px-3 py-2 border text-[11px] font-bold"
                      style={{
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.border,
                        color: theme.textMuted,
                      }}
                    >
                      {item.recommendation}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

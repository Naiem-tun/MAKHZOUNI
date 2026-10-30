import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  collection, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { useCategories } from '../hooks/useCategories';
import { Product } from '../types';
import { sanitizeProduct, formatCurrency, cn } from '../lib/utils';
import { 
  Layers, 
  Star, 
  Gem, 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  Filter, 
  Package, 
  ArrowUpDown, 
  CheckCircle2, 
  Coins, 
  Sparkles,
  Info,
  ChevronDown,
  Percent,
  Boxes,
  HelpCircle,
  TrendingDown
} from 'lucide-react';

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
  marginPct: number; // Markup % or margin %
  batchCapital: number; // quantity * purchasePrice
  batchPotentialProfit: number; // quantity * profitPerUnit
  classification: ProductClassification;
  tagTitle: string;
  tagColor: string;
  tagBg: string;
  tagBorder: string;
  recommendation: string;
}

export interface CategoryEvaluation {
  id: string;
  name: string;
  iconName?: string;
  totalProductsCount: number;
  activeStockCount: number; // products with quantity > 0
  totalPieces: number;
  totalCapital: number; // money tied in this category
  totalPotentialProfit: number;
  avgMarginPct: number;
  starsCount: number;
  gemsCount: number;
  trafficCount: number;
  underperformersCount: number;
  items: EvaluatedProduct[];
}

export default function CategoryAnalysis() {
  const { t } = useTranslation();
  const { user, settings } = useAppContext();
  const { categories } = useCategories();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'star' | 'traffic' | 'gem' | 'underperformer'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'potentialProfit' | 'margin' | 'quantity' | 'capital'>('potentialProfit');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showLogicInfo, setShowLogicInfo] = useState(false);

  // 1. Strictly listen to current live products in the store (no historical stale cache)
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const path = `users/${user.uid}/products`;
    const unsub = onSnapshot(
      collection(db, path),
      (snap) => {
        const liveList = snap.docs.map((doc) =>
          sanitizeProduct({ id: doc.id, ...doc.data() } as Product)
        );
        // Exclude drafts or soft-deleted items if any
        setProducts(liveList.filter((p) => !p.isDraft));
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load products for category analysis:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  // 2. Compute category-level evaluation and per-product classification
  const categoryEvaluations = useMemo<Record<string, CategoryEvaluation>>(() => {
    // Only analyze products that currently exist in inventory and have positive stock
    const activeProducts = products.filter((p) => (p.quantity ?? 0) > 0);

    // Group active products by category
    const grouped: Record<string, Product[]> = {};

    activeProducts.forEach((p) => {
      const cat = p.category?.trim() || 'أخرى';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    const evaluations: Record<string, CategoryEvaluation> = {};

    // For each category, compute benchmark statistics
    Object.entries(grouped).forEach(([catName, catProducts]) => {
      let totalPieces = 0;
      let totalCapital = 0;
      let totalPotentialProfit = 0;
      let sumMargin = 0;

      // First pass: Calculate baseline category totals
      catProducts.forEach((p) => {
        const qty = Math.max(0, p.quantity ?? 0);
        const cost = Math.max(0, p.purchasePrice ?? 0);
        const sell = Math.max(0, p.sellingPrice ?? 0);
        const profit = Math.max(0, sell - cost);
        // Margin relative to cost: (sell - cost) / cost
        const marginPct = cost > 0 ? (profit / cost) * 100 : 0;

        totalPieces += qty;
        totalCapital += qty * cost;
        totalPotentialProfit += qty * profit;
        sumMargin += marginPct;
      });

      const avgMarginPct = catProducts.length > 0 ? sumMargin / catProducts.length : 0;
      const avgCapitalPerItem = catProducts.length > 0 ? totalCapital / catProducts.length : 0;
      const avgProfitPerItem = catProducts.length > 0 ? totalPotentialProfit / catProducts.length : 0;

      let starsCount = 0;
      let gemsCount = 0;
      let trafficCount = 0;
      let underperformersCount = 0;

      // Second pass: Classify each product within its own category benchmarks
      const evaluatedItems: EvaluatedProduct[] = catProducts.map((p) => {
        const qty = Math.max(0, p.quantity ?? 0);
        const cost = Math.max(0, p.purchasePrice ?? 0);
        const sell = Math.max(0, p.sellingPrice ?? 0);
        const profit = Math.max(0, sell - cost);
        const marginPct = cost > 0 ? (profit / cost) * 100 : 0;
        const batchCapital = qty * cost;
        const batchPotentialProfit = qty * profit;

        // Classification heuristics
        let classification: ProductClassification = 'neutral';
        let tagTitle = 'سلعة متوازنة';
        let tagColor = 'text-zinc-600 dark:text-zinc-300';
        let tagBg = 'bg-zinc-100 dark:bg-zinc-800';
        let tagBorder = 'border-zinc-200 dark:border-zinc-700';
        let recommendation = 'أداء طبيعي ومتناسق مع الفئة، استمر على نفس وتيرة الشراء.';

        // Safe threshold bounds for Tunisian regulated goods (e.g. sugar, milk, semolina, oil, etc.)
        const isSubsidizedBaseline = marginPct <= 8.5;

        if (
          marginPct >= avgMarginPct * 0.95 &&
          (batchPotentialProfit >= avgProfitPerItem || batchCapital >= avgCapitalPerItem)
        ) {
          // 1. Star product: Good/superior margin AND contributes high absolute profit/capital
          classification = 'star';
          tagTitle = 'سلعة ذهبية 🌟';
          tagColor = 'text-amber-700 dark:text-amber-400';
          tagBg = 'bg-amber-50 dark:bg-amber-950/40';
          tagBorder = 'border-amber-200 dark:border-amber-800/40';
          recommendation =
            'ركيزة أرباح أساسية للفئة؛ حافظ على تواجدها الدائم ولا تدع الرف ينفد منها.';
          starsCount++;
        } else if (marginPct >= Math.max(22, avgMarginPct * 1.3) && qty <= 8) {
          // 2. Hidden Gem: High margin but low stock volume
          classification = 'gem';
          tagTitle = 'فرصة مدفونة 💎';
          tagColor = 'text-cyan-700 dark:text-cyan-400';
          tagBg = 'bg-cyan-50 dark:bg-cyan-950/40';
          tagBorder = 'border-cyan-200 dark:border-cyan-800/40';
          recommendation =
            'هامش ربح ممتاز جداً ولكن كميتها المتبقية قليلة؛ زيادة كميتها سترفع أرباح الرف.';
          gemsCount++;
        } else if (
          (isSubsidizedBaseline || marginPct < avgMarginPct * 0.75) &&
          qty >= 15
        ) {
          // 3. Traffic Driver: Low margin, but high stock/demand
          classification = 'traffic';
          tagTitle = 'محرك سيولة 📦';
          tagColor = 'text-blue-700 dark:text-blue-400';
          tagBg = 'bg-blue-50 dark:bg-blue-950/40';
          tagBorder = 'border-blue-200 dark:border-blue-800/40';
          recommendation =
            'سلعة سريعة الدوران تجلب الزبائن؛ حافظ على تزويدها دون تجميد سيولة زائدة.';
          trafficCount++;
        } else if (
          marginPct < avgMarginPct * 0.6 &&
          !isSubsidizedBaseline &&
          batchCapital > avgCapitalPerItem * 0.8
        ) {
          // 4. Underperformer / Dead Weight
          classification = 'underperformer';
          tagTitle = 'تحتاج مراجعة ⚠️';
          tagColor = 'text-rose-700 dark:text-rose-400';
          tagBg = 'bg-rose-50 dark:bg-rose-950/40';
          tagBorder = 'border-rose-200 dark:border-rose-800/40';
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
          tagColor,
          tagBg,
          tagBorder,
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

  // Available categories list sorted by capital/activity
  const categoriesList = useMemo(() => {
    return Object.values(categoryEvaluations).sort(
      (a, b) => b.totalCapital - a.totalCapital
    );
  }, [categoryEvaluations]);

  // Overall Global Store Summary
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

    const avgMargin =
      totalCapital > 0 ? (totalPotentialProfit / totalCapital) * 100 : 0;

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

  // Filter and sort items to display
  const displayedItems = useMemo(() => {
    let list: EvaluatedProduct[] = [];

    if (selectedCategory === 'all') {
      // Aggregate all categories items
      Object.values(categoryEvaluations).forEach((c) => {
        list.push(...c.items);
      });
    } else if (categoryEvaluations[selectedCategory]) {
      list = [...categoryEvaluations[selectedCategory].items];
    }

    // Filter by Classification
    if (activeFilter !== 'all') {
      list = list.filter((it) => it.classification === activeFilter);
    }

    // Filter by Search Term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.barcode && it.barcode.includes(q))
      );
    }

    // Sorting
    list.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'potentialProfit') {
        diff = a.batchPotentialProfit - b.batchPotentialProfit;
      } else if (sortBy === 'margin') {
        diff = a.marginPct - b.marginPct;
      } else if (sortBy === 'quantity') {
        diff = a.quantity - b.quantity;
      } else if (sortBy === 'capital') {
        diff = a.batchCapital - b.batchCapital;
      }
      return sortOrder === 'desc' ? -diff : diff;
    });

    return list;
  }, [
    categoryEvaluations,
    selectedCategory,
    activeFilter,
    searchTerm,
    sortBy,
    sortOrder,
  ]);

  const currentCategoryData =
    selectedCategory !== 'all' ? categoryEvaluations[selectedCategory] : null;

  return (
    <div className="space-y-6 pb-28 text-right" dir="rtl">
      {/* 1. Header with Wisdom & Description */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Layers size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
                تحليل الفئات والمنتجات الذكي
              </h1>
              <p className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">
                مقارنة السلع داخل كل فئة وفق هوامش الربح ورأس المال المجمد وقوة العائد
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowLogicInfo(!showLogicInfo)}
          className="flex items-center gap-2 self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-black text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 shadow-xs transition-all cursor-pointer"
        >
          <HelpCircle size={15} className="text-brand-500" />
          <span>كيف تعمل خوارزمية التقييم؟</span>
          <ChevronDown
            size={14}
            className={cn(
              'transition-transform duration-200',
              showLogicInfo ? 'rotate-180' : ''
            )}
          />
        </button>
      </header>

      {/* Logic Explanation Collapse Banner */}
      <AnimatePresence>
        {showLogicInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-brand-50 via-white to-white dark:from-brand-950/20 dark:via-zinc-900 dark:to-zinc-900 border border-brand-200/80 dark:border-brand-900/40 space-y-3">
              <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300 font-black text-sm">
                <Sparkles size={16} />
                <span>الأساس العلمي والرياضي لتقييم السلع داخل الفئة:</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                تعتمد هذه الخوارزمية على مبدأ <strong className="font-bold text-zinc-800 dark:text-zinc-200">إدارة فئات التجزئة (Retail Category Management)</strong>؛ حيث لا تتم مقارنة سلعة بأخرى خارج فئتها، بل تُقاس كل سلعة بمقارنة هامش ربحها بـ <span className="underline decoration-brand-400 font-bold">متوسط هامش الفئة نفسها</span> ووزن رأس المال المجمد في دفعتها.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30">
                  <div className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-1">
                    <Star size={14} />
                    <span>سلع ذهبية (Stars)</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                    ربحها أعلى من متوسط الفئة وتدر أعلى أرباح صافية؛ لا تدع الرف ينفد منها أبداً.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-900/30">
                  <div className="text-xs font-black text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5 mb-1">
                    <Gem size={14} />
                    <span>فرص مدفونة (Gems)</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                    هامش ربح ممتاز جداً ولكن كميتها المتبقية على الرف قليلة؛ زيادة كميتها ترفع أرباح الفئة.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/30">
                  <div className="text-xs font-black text-blue-800 dark:text-blue-300 flex items-center gap-1.5 mb-1">
                    <TrendingUp size={14} />
                    <span>محركات سيولة (Traffic)</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                    هامش ربح منخفض ولكن كميتها وسحبها عالي لجلب الزبائن؛ حافظ على تدفقها دون تجميد سيولة زائدة.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30">
                  <div className="text-xs font-black text-rose-800 dark:text-rose-300 flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={14} />
                    <span>تحتاج مراجعة (Review)</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                    ربح ضعيف جداً مقارنة بالفئة وتجمد مالاً كبيراً؛ يُنصح بمراجعة سعر الشراء أو استبدالها ببديل.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Executive Cards: Live Inventory Capital & Potential Profit */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Pieces */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold">القطع المتوفرة حالياً</span>
            <Boxes size={18} className="text-brand-500" />
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white">
            {currentCategoryData
              ? currentCategoryData.totalPieces.toLocaleString()
              : globalStoreSummary.totalPieces.toLocaleString()}{' '}
            <span className="text-xs font-bold text-zinc-400">قطعة</span>
          </div>
          <p className="text-[10px] font-medium text-zinc-400">
            {currentCategoryData
              ? `${currentCategoryData.activeStockCount} سلع متوفرة في الفئة`
              : `${globalStoreSummary.totalProducts} سلعة في ${globalStoreSummary.totalCategories} فئات`}
          </p>
        </div>

        {/* Capital Tied */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold">رأس المال المجمد</span>
            <Coins size={18} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white">
            {formatCurrency(
              currentCategoryData
                ? currentCategoryData.totalCapital
                : globalStoreSummary.totalCapital,
              settings.currency,
              settings.language
            )}
          </div>
          <p className="text-[10px] font-medium text-zinc-400">
            قيمة شراء السلع الموجودة على الرفوف
          </p>
        </div>

        {/* Expected Gross Profit */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold">الأرباح المتوقعة للدفعة</span>
            <TrendingUp size={18} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(
              currentCategoryData
                ? currentCategoryData.totalPotentialProfit
                : globalStoreSummary.totalPotentialProfit,
              settings.currency,
              settings.language
            )}
          </div>
          <p className="text-[10px] font-medium text-zinc-400">
            الربح الصافي عند بيع كامل الكمية
          </p>
        </div>

        {/* Avg Category Margin */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold">متوسط هامش الربح</span>
            <Percent size={18} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white">
            {(currentCategoryData
              ? currentCategoryData.avgMarginPct
              : globalStoreSummary.avgMargin
            ).toFixed(1)}
            %
          </div>
          <p className="text-[10px] font-medium text-zinc-400">
            {currentCategoryData
              ? `المعيار المرجعي لفئة ${currentCategoryData.name}`
              : 'متوسط كل السلع المتوفرة بالمحل'}
          </p>
        </div>
      </div>

      {/* 3. Category Selector Carousel / Pills */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-zinc-400 uppercase tracking-wider">
            اختر الفئة لتحليل سلعها
          </span>
          <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400">
            {selectedCategory === 'all'
              ? 'كل الفئات معاً'
              : `فئة: ${selectedCategory}`}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer border',
              selectedCategory === 'all'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-sm'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            )}
          >
            <Layers size={14} />
            <span>كل الفئات</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-zinc-200/50 dark:bg-zinc-700/50">
              {globalStoreSummary.totalProducts}
            </span>
          </button>

          {categoriesList.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer border',
                selectedCategory === cat.id
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              )}
            >
              <Package size={14} />
              <span>{cat.name}</span>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-md text-[10px] font-black',
                  selectedCategory === cat.id
                    ? 'bg-white/20 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                )}
              >
                {cat.activeStockCount}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Category Decision Balance Bar (Gold vs Traffic vs Gems vs Review) */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
              توزيع جودة السلع في{' '}
              {selectedCategory === 'all'
                ? 'المتجر ككل'
                : `فئة «${selectedCategory}»`}
            </span>
          </div>
          <span className="text-[11px] font-bold text-zinc-400">
            إجمالي السلع النشطة: {displayedItems.length}
          </span>
        </div>

        {/* Quick Filter Buttons by Decision */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={cn(
              'p-2.5 rounded-xl text-xs font-black border transition-all text-center cursor-pointer',
              activeFilter === 'all'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-xs'
                : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
            )}
          >
            <div className="text-[10px] text-zinc-400 mb-0.5">عرض الكل</div>
            <div>{currentCategoryData ? currentCategoryData.activeStockCount : globalStoreSummary.totalProducts} سلعة</div>
          </button>

          <button
            onClick={() => setActiveFilter('star')}
            className={cn(
              'p-2.5 rounded-xl text-xs font-black border transition-all text-center cursor-pointer',
              activeFilter === 'star'
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-amber-50/70 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/40 hover:bg-amber-100'
            )}
          >
            <div className="text-[10px] text-amber-600/80 dark:text-amber-400 mb-0.5 flex items-center justify-center gap-1">
              <Star size={11} />
              <span>سلع ذهبية</span>
            </div>
            <div>
              {currentCategoryData
                ? currentCategoryData.starsCount
                : globalStoreSummary.totalStars}{' '}
              سلعة
            </div>
          </button>

          <button
            onClick={() => setActiveFilter('gem')}
            className={cn(
              'p-2.5 rounded-xl text-xs font-black border transition-all text-center cursor-pointer',
              activeFilter === 'gem'
                ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                : 'bg-cyan-50/70 dark:bg-cyan-950/20 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900/40 hover:bg-cyan-100'
            )}
          >
            <div className="text-[10px] text-cyan-600/80 dark:text-cyan-400 mb-0.5 flex items-center justify-center gap-1">
              <Gem size={11} />
              <span>فرص مدفونة</span>
            </div>
            <div>
              {currentCategoryData
                ? currentCategoryData.gemsCount
                : globalStoreSummary.totalGems}{' '}
              سلعة
            </div>
          </button>

          <button
            onClick={() => setActiveFilter('traffic')}
            className={cn(
              'p-2.5 rounded-xl text-xs font-black border transition-all text-center cursor-pointer',
              activeFilter === 'traffic'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-blue-50/70 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900/40 hover:bg-blue-100'
            )}
          >
            <div className="text-[10px] text-blue-600/80 dark:text-blue-400 mb-0.5 flex items-center justify-center gap-1">
              <TrendingUp size={11} />
              <span>محركات سيولة</span>
            </div>
            <div>
              {currentCategoryData
                ? currentCategoryData.trafficCount
                : globalStoreSummary.totalTraffic}{' '}
              سلعة
            </div>
          </button>

          <button
            onClick={() => setActiveFilter('underperformer')}
            className={cn(
              'p-2.5 rounded-xl text-xs font-black border transition-all text-center cursor-pointer',
              activeFilter === 'underperformer'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-rose-50/70 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/40 hover:bg-rose-100'
            )}
          >
            <div className="text-[10px] text-rose-600/80 dark:text-rose-400 mb-0.5 flex items-center justify-center gap-1">
              <AlertTriangle size={11} />
              <span>تحتاج مراجعة</span>
            </div>
            <div>
              {currentCategoryData
                ? currentCategoryData.underperformersCount
                : globalStoreSummary.totalUnderperformers}{' '}
              سلعة
            </div>
          </button>
        </div>
      </div>

      {/* 5. Search & Sort Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث عن اسم السلعة أو الباركود..."
            className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
          >
            <option value="potentialProfit">ترتيب حسب: الأرباح المحتملة للدفعة</option>
            <option value="margin">ترتيب حسب: نسبة الربح</option>
            <option value="quantity">ترتيب حسب: كمية الرصيد</option>
            <option value="capital">ترتيب حسب: رأس المال المجمد</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer shadow-xs"
            title={sortOrder === 'desc' ? 'ترتيب تنازلي (الأعلى أولاً)' : 'ترتيب تصاعدي (الأقل أولاً)'}
          >
            <ArrowUpDown size={16} />
          </button>
        </div>
      </div>

      {/* 6. Product Comparison List / Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-brand-500 border-t-transparent animate-spin" />
          <span className="text-xs font-bold text-zinc-400">
            جاري فحص وتحليل السلع الموجودة حالياً بالمحل...
          </span>
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 space-y-2">
          <Package size={32} className="mx-auto text-zinc-300 dark:text-zinc-700" />
          <div className="text-sm font-black text-zinc-700 dark:text-zinc-300">
            لا توجد سلع مطابقة لهذا الفلتر
          </div>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            جرب تغيير الفئة المحددة أو إلغاء فلتر التقييم لعرض المنتجات الأخرى.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedItems.map((item, idx) => (
            <motion.div
              layout
              key={item.id || idx}
              className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:border-brand-500/30 transition-all space-y-3"
            >
              {/* Product Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-600 dark:text-zinc-400 font-black text-xs">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white truncate">
                        {item.name}
                      </h3>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-lg text-[10px] font-black border',
                          item.tagBg,
                          item.tagColor,
                          item.tagBorder
                        )}
                      >
                        {item.tagTitle}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400 mt-0.5">
                      <span>الفئة: {item.category}</span>
                      {item.barcode && <span>• باركود: {item.barcode}</span>}
                    </div>
                  </div>
                </div>

                {/* Batch Expected Profit Callout */}
                <div className="self-end sm:self-auto text-left pl-1">
                  <span className="text-[10px] font-black text-zinc-400 block uppercase">
                    الربح الإجمالي للكمية
                  </span>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(item.batchPotentialProfit, settings.currency, settings.language)}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
                {/* Cost vs Selling */}
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 space-y-0.5">
                  <div className="text-[10px] font-bold text-zinc-400">سعر الشراء / البيع</div>
                  <div className="font-black text-zinc-800 dark:text-zinc-200">
                    {formatCurrency(item.purchasePrice, settings.currency, settings.language)} 
                    <span className="text-zinc-400 mx-1">←</span> 
                    {formatCurrency(item.sellingPrice, settings.currency, settings.language)}
                  </div>
                </div>

                {/* Margin % */}
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 space-y-0.5">
                  <div className="text-[10px] font-bold text-zinc-400">هامش الربح (المردودية)</div>
                  <div className="font-black flex items-center gap-1.5">
                    <span className={cn(
                      item.marginPct >= 20 ? 'text-emerald-600 dark:text-emerald-400' :
                      item.marginPct >= 10 ? 'text-zinc-800 dark:text-zinc-200' :
                      'text-rose-600 dark:text-rose-400'
                    )}>
                      {item.marginPct.toFixed(1)}%
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400">
                      (+{formatCurrency(item.profitPerUnit, settings.currency, settings.language)} للقطعة)
                    </span>
                  </div>
                </div>

                {/* Stock Quantity */}
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 space-y-0.5">
                  <div className="text-[10px] font-bold text-zinc-400">الكمية المتوفرة</div>
                  <div className="font-black text-zinc-900 dark:text-white">
                    {item.quantity}{' '}
                    <span className="text-[10px] text-zinc-400 font-bold">
                      قطعة {item.piecesPerBox && item.piecesPerBox > 1 ? `(${Math.floor(item.quantity / item.piecesPerBox)} كرتونة)` : ''}
                    </span>
                  </div>
                </div>

                {/* Capital Tied */}
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 space-y-0.5">
                  <div className="text-[10px] font-bold text-zinc-400">رأس المال المجمد بها</div>
                  <div className="font-black text-zinc-800 dark:text-zinc-200">
                    {formatCurrency(item.batchCapital, settings.currency, settings.language)}
                  </div>
                </div>
              </div>

              {/* Smart Recommendation Footer */}
              <div className="p-2.5 rounded-xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100/60 dark:border-brand-900/30 flex items-start gap-2">
                <Info size={14} className="text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 leading-snug">
                  {item.recommendation}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

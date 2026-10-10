import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, BrainCircuit, Sparkles, CheckCircle2, AlertTriangle, 
  XCircle, Coins, ShieldCheck, Calendar, ArrowRight,
  TrendingUp, Info, HelpCircle
} from 'lucide-react';
import { Supplier, SupplierTransaction, SupplierCycle } from '../../types';
import { formatCurrency, safeParseDate, roundMoney } from '../../lib/utils';

interface SmartDealAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  activeTransactions: SupplierTransaction[];
  archivedCycles: SupplierCycle[];
  allTransactions: SupplierTransaction[];
  settings: any;
}

export function SmartDealAdvisorModal({
  isOpen,
  onClose,
  suppliers,
  activeTransactions,
  archivedCycles,
  allTransactions,
  settings,
}: SmartDealAdvisorModalProps) {
  // Deal evaluation inputs
  const [dealCost, setDealCost] = useState<string>('');
  const [availableCash, setAvailableCash] = useState<string>('');
  const [dealName, setDealName] = useState<string>('');
  const [expectedDiscountPct, setExpectedDiscountPct] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'deal' | 'commitments' | 'readiness'>('deal');

  // Currency helper
  const formatMoney = (val: number) => {
    return formatCurrency(roundMoney(val), settings.currency, settings.language);
  };

  // 1. Analyze Essential & Recurring Supplies (Milk, Bread, Gas, Water, Dairy)
  const recurringAnalysis = useMemo(() => {
    // Combine all available transactions (active + historical if any)
    const txs = allTransactions.length > 0 ? allTransactions : activeTransactions;
    if (txs.length === 0 && suppliers.length === 0) {
      return {
        hasData: false,
        essentialSuppliers: [],
        weeklyEstimatedTotal: 0,
        dailyEstimatedTotal: 0,
        breakdownByCategory: []
      };
    }

    // Helper to identify essential goods from name or typeOfGoods
    const isEssential = (text: string) => {
      const lower = (text || '').toLowerCase();
      return (
        lower.includes('حليب') || lower.includes('lait') ||
        lower.includes('ياغورت') || lower.includes('yaourt') ||
        lower.includes('ألبان') || lower.includes('لبن') ||
        lower.includes('دليس') || lower.includes('délice') || lower.includes('vitalait') ||
        lower.includes('خبز') || lower.includes('pain') ||
        lower.includes('غاز') || lower.includes('gaz') ||
        lower.includes('ماء') || lower.includes('مياه') || lower.includes('eau') ||
        lower.includes('بيض') || lower.includes('oeuf')
      );
    };

    // Calculate time span of transactions in days
    let daysSpan = 14; // default minimum 2 weeks baseline
    if (txs.length > 1) {
      const timestamps = txs.map(t => safeParseDate(t.date).getTime()).filter(t => !isNaN(t));
      if (timestamps.length >= 2) {
        const minT = Math.min(...timestamps);
        const maxT = Math.max(...timestamps);
        const diffDays = Math.round((maxT - minT) / (1000 * 60 * 60 * 24));
        if (diffDays >= 7) {
          daysSpan = diffDays;
        }
      }
    }

    // Group by supplier
    const supplierStats: Record<string, { supplier: Supplier; total: number; count: number; isEssentialGood: boolean }> = {};

    suppliers.forEach(s => {
      const sTxs = txs.filter(t => t.supplierId === s.id);
      const total = sTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
      const isEss = isEssential(s.name) || isEssential(s.typeOfGoods) || (s.visitDays && s.visitDays.length >= 2);
      
      supplierStats[s.id || s.name] = {
        supplier: s,
        total,
        count: sTxs.length,
        isEssentialGood: !!isEss
      };
    });

    const essentialList = Object.values(supplierStats).filter(st => st.isEssentialGood && st.total > 0);
    
    // Total spent on essentials
    const totalEssentialSpent = essentialList.reduce((sum, st) => sum + st.total, 0);
    
    // Normalize to weekly rate: (total / daysSpan) * 7
    const weeklyEstimatedTotal = daysSpan > 0 ? (totalEssentialSpent / daysSpan) * 7 : 0;
    const dailyEstimatedTotal = weeklyEstimatedTotal / 7;

    // Categorized breakdown
    const categories: { name: string; icon: string; weekly: number; suppliers: string[] }[] = [
      { name: 'الحليب والياغورت والألبان', icon: '🥛', weekly: 0, suppliers: [] },
      { name: 'الخبز والمخبوزات', icon: '🥖', weekly: 0, suppliers: [] },
      { name: 'الغاز والمياه والمشروبات', icon: '🔥', weekly: 0, suppliers: [] },
      { name: 'سلع غذائية دورية أخرى', icon: '📦', weekly: 0, suppliers: [] },
    ];

    essentialList.forEach(st => {
      const s = st.supplier;
      const weeklyAmount = daysSpan > 0 ? (st.total / daysSpan) * 7 : 0;
      const nameAndType = `${s.name} ${s.typeOfGoods}`.toLowerCase();

      if (nameAndType.includes('حليب') || nameAndType.includes('ياغورت') || nameAndType.includes('ألبان') || nameAndType.includes('دليس') || nameAndType.includes('vitalait')) {
        categories[0].weekly += weeklyAmount;
        categories[0].suppliers.push(s.name);
      } else if (nameAndType.includes('خبز') || nameAndType.includes('pain')) {
        categories[1].weekly += weeklyAmount;
        categories[1].suppliers.push(s.name);
      } else if (nameAndType.includes('غاز') || nameAndType.includes('ماء') || nameAndType.includes('مياه')) {
        categories[2].weekly += weeklyAmount;
        categories[2].suppliers.push(s.name);
      } else {
        categories[3].weekly += weeklyAmount;
        categories[3].suppliers.push(s.name);
      }
    });

    return {
      hasData: txs.length > 0 || suppliers.length > 0,
      essentialSuppliers: essentialList,
      weeklyEstimatedTotal: roundMoney(weeklyEstimatedTotal),
      dailyEstimatedTotal: roundMoney(dailyEstimatedTotal),
      breakdownByCategory: categories.filter(c => c.weekly > 0)
    };
  }, [allTransactions, activeTransactions, suppliers]);

  // 2. Deal Evaluation Logic
  const dealResult = useMemo(() => {
    const cost = parseFloat(dealCost);
    const cash = parseFloat(availableCash);

    if (isNaN(cost) || cost <= 0 || isNaN(cash) || cash <= 0) {
      return null;
    }

    const remainingCash = cash - cost;
    const dailyNeed = recurringAnalysis.dailyEstimatedTotal > 0 
      ? recurringAnalysis.dailyEstimatedTotal 
      : 30; // sensible fallback daily essential in TND if no prior data

    const weeklyNeed = recurringAnalysis.weeklyEstimatedTotal > 0
      ? recurringAnalysis.weeklyEstimatedTotal
      : dailyNeed * 7;

    // Safe remaining days
    const safetyDaysCovered = remainingCash > 0 ? (remainingCash / dailyNeed) : 0;

    // Recommended maximum safe spending limit:
    // Keep at least 4 to 5 days of essential cash cushion
    const requiredCushion = roundMoney(dailyNeed * 4);
    const maxSafeDealCost = Math.max(0, roundMoney(cash - requiredCushion));

    // Status evaluation
    let status: 'safe' | 'caution' | 'danger';
    let title: string;
    let badgeLabel: string;
    let explanation: string;
    let advice: string;

    if (remainingCash < 0) {
      status = 'danger';
      title = '🛑 لا! عجز مالي فوري';
      badgeLabel = 'صفقة مستحيلة - عجز كاش';
      explanation = `تكلفة الصفقة (${formatMoney(cost)}) تتجاوز كامل الكاش المتوفر بيدك (${formatMoney(cash)}) بعجز قدره ${formatMoney(Math.abs(remainingCash))}.`;
      advice = 'لا يمكنك دخول هذه الصفقة نهائياً إلا إذا كان الشراء بالآجل أو تقليص الكمية لأقل من الكاش المتاح.';
    } else if (safetyDaysCovered < 2.5) {
      status = 'danger';
      title = '🛑 لا! خطر عجز سيولة شديد';
      badgeLabel = 'خطر شديد - لا يُنصح بها';
      explanation = `بعد دفع الصفقة، سيتبقى معك فقط ${formatMoney(remainingCash)}، وهو لا يكفي حتى لتغطية يومين من مشتريات الحليب والخبز الإلزامية (المتوسط اليومي: ${formatMoney(dailyNeed)}). ستعجز عن دفع مستحقات شاحنة الألبان أو الخبز!`;
      advice = `الحد الأقصى الآمن الذي يمكنك شراؤه حالياً من هذه الصفقة هو: ${formatMoney(maxSafeDealCost)} حتى تحافظ على وسادة أمان تكفي سلعك اليومية.`;
    } else if (safetyDaysCovered < 5.0) {
      status = 'caution';
      title = '⚠️ نعم مشروطة - مقبولة بحذر';
      badgeLabel = 'مقبولة بحذر - هامش ضيق';
      explanation = `سيتبقى معك ${formatMoney(remainingCash)} بعد الصفقة، وهو يكفي لحوالي ${Math.round(safetyDaysCovered)} أيام فقط من مصاريف الحليب والخبز. إذا كانت مداخيل الصندوق اليومية ممتازة ومستمرة يمكنك إتمامها.`;
      advice = `إذا كانت البضاعة سريعة الدوران فسارع ببيعها، أو اشترِ كمية أصغر بقيمة ${formatMoney(maxSafeDealCost)} لتكون في أمان تام.`;
    } else {
      status = 'safe';
      title = '🟢 نعم! صفقة آمنة وممتازة';
      badgeLabel = 'صفقة آمنة ومربحة';
      explanation = `بعد دفع قيمة الصفقة (${formatMoney(cost)})، سيتبقى معك ${formatMoney(remainingCash)} كاش جاهز. هذا المبلغ يغطي مصاريف الحليب والخبز والأساسيات لأكثر من ${Math.round(safetyDaysCovered)} أيام براحة تامة!`;
      advice = 'الوضع المالي ممتاز والسيولة المتبقية تحميك من أي ضغط؛ توكل على الله واغتنم التخفيض.';
    }

    return {
      cost,
      cash,
      remainingCash,
      safetyDaysCovered: Math.round(safetyDaysCovered * 10) / 10,
      maxSafeDealCost,
      requiredCushion,
      status,
      title,
      badgeLabel,
      explanation,
      advice,
      weeklyNeed
    };
  }, [dealCost, availableCash, recurringAnalysis, settings]);

  // 3. Upcoming Visit Readiness for Today & Tomorrow
  const upcomingReadiness = useMemo(() => {
    const today = new Date().getDay();
    const tomorrow = (today + 1) % 7;

    const daysMap = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    const getSuppliersForDay = (dayIndex: number) => {
      return suppliers.filter(s => s.visitDays && s.visitDays.includes(dayIndex)).map(s => {
        // Average tx amount
        const sTxs = (allTransactions.length > 0 ? allTransactions : activeTransactions).filter(t => t.supplierId === s.id && t.amount > 0);
        const avg = sTxs.length > 0 ? roundMoney(sTxs.reduce((sum, t) => sum + t.amount, 0) / sTxs.length) : 0;
        return {
          supplier: s,
          avgAmount: avg
        };
      });
    };

    const todayList = getSuppliersForDay(today);
    const tomorrowList = getSuppliersForDay(tomorrow);

    const todayExpectedCash = roundMoney(todayList.reduce((sum, item) => sum + item.avgAmount, 0));
    const tomorrowExpectedCash = roundMoney(tomorrowList.reduce((sum, item) => sum + item.avgAmount, 0));

    return {
      todayName: daysMap[today],
      tomorrowName: daysMap[tomorrow],
      todayList,
      tomorrowList,
      todayExpectedCash,
      tomorrowExpectedCash
    };
  }, [suppliers, allTransactions, activeTransactions]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose} 
          className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" 
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 15 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.96, y: 15 }} 
          className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden text-right"
          dir="rtl"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-gradient-to-r from-brand-50/60 via-white to-amber-50/40 dark:from-zinc-900 dark:to-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/25">
                <BrainCircuit size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                    مستشار الصفقات والسيولة الذكي
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    AI التجاري
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  يتتبع نفقات الحليب والخبز الإلزامية ويحميك من أزمات السيولة عند الشراء
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="grid grid-cols-3 border-b border-zinc-100 dark:border-zinc-800 text-xs font-bold bg-zinc-50 dark:bg-zinc-900/50 p-1 gap-1">
            <button
              onClick={() => setActiveTab('deal')}
              className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'deal'
                  ? 'bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <Sparkles size={14} />
              <span>فاحص الصفقات (نعم/لا)</span>
            </button>
            <button
              onClick={() => setActiveTab('commitments')}
              className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'commitments'
                  ? 'bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <ShieldCheck size={14} />
              <span>مصاريفك الإلزامية الثابتة</span>
            </button>
            <button
              onClick={() => setActiveTab('readiness')}
              className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'readiness'
                  ? 'bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <Calendar size={14} />
              <span>جاهزية الكاش غداً</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* TAB 1: DEAL EVALUATOR */}
            {activeTab === 'deal' && (
              <div className="space-y-4">
                {/* Context banner */}
                <div className="p-3 bg-brand-50/70 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-800/50 rounded-xl flex items-start gap-2.5 text-xs text-brand-900 dark:text-brand-200">
                  <Info size={16} className="text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    عرض عليك مورد صفقة أو تخفيضاً؟ اكتب تكلفة الصفقة والمبلغ الموجود في يدك، ليحسب لك الوكيل هل ستتبقى سيولة كافية لشاحنات الحليب والخبز القادمة أم لا!
                  </p>
                </div>

                {/* Inputs Box */}
                <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        تكلفة الصفقة المطلوبة ({settings.currency}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="مثال: 450"
                        value={dealCost}
                        onChange={(e) => setDealCost(e.target.value)}
                        className="w-full h-11 px-3 text-sm font-black rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        الكاش المتوفر بيدك / في الصندوق حالياً ({settings.currency}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="مثال: 700"
                        value={availableCash}
                        onChange={(e) => setAvailableCash(e.target.value)}
                        className="w-full h-11 px-3 text-sm font-black rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        اسم البضاعة أو المورد (اختياري)
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: 30 كرتونة معكرونة أو عصير"
                        value={dealName}
                        onChange={(e) => setDealName(e.target.value)}
                        className="w-full h-9 px-3 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        نسبة التخفيض أو التوفير التقريبي (اختياري %)
                      </label>
                      <input
                        type="number"
                        placeholder="مثال: 10%"
                        value={expectedDiscountPct}
                        onChange={(e) => setExpectedDiscountPct(e.target.value)}
                        className="w-full h-9 px-3 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Deal Evaluation Card Output */}
                {dealResult ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      dealResult.status === 'safe'
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                        : dealResult.status === 'caution'
                        ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                        : 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                    }`}
                  >
                    {/* Header decision */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-200/50 dark:border-zinc-700/50">
                      <div className="flex items-center gap-2">
                        {dealResult.status === 'safe' ? (
                          <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
                        ) : dealResult.status === 'caution' ? (
                          <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400" />
                        ) : (
                          <XCircle size={24} className="text-rose-600 dark:text-rose-400" />
                        )}
                        <h3 className={`text-base sm:text-lg font-black ${
                          dealResult.status === 'safe'
                            ? 'text-emerald-900 dark:text-emerald-200'
                            : dealResult.status === 'caution'
                            ? 'text-amber-900 dark:text-amber-200'
                            : 'text-rose-900 dark:text-rose-200'
                        }`}>
                          {dealResult.title}
                        </h3>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                        dealResult.status === 'safe'
                          ? 'bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200'
                          : dealResult.status === 'caution'
                          ? 'bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                          : 'bg-rose-200/80 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200'
                      }`}>
                        {dealResult.badgeLabel}
                      </span>
                    </div>

                    {/* Metric strip */}
                    <div className="grid grid-cols-3 gap-2 my-3 text-center">
                      <div className="p-2 bg-white/70 dark:bg-zinc-900/70 rounded-xl">
                        <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">الكاش المتبقي</span>
                        <span className={`text-sm font-black ${dealResult.remainingCash >= 0 ? 'text-zinc-900 dark:text-white' : 'text-rose-600'}`}>
                          {formatMoney(dealResult.remainingCash)}
                        </span>
                      </div>
                      <div className="p-2 bg-white/70 dark:bg-zinc-900/70 rounded-xl">
                        <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">تغطية مصاريف الأساسيات</span>
                        <span className="text-sm font-black text-brand-600 dark:text-brand-400">
                          {dealResult.safetyDaysCovered > 0 ? `~${dealResult.safetyDaysCovered} أيام` : 'صفر أيام'}
                        </span>
                      </div>
                      <div className="p-2 bg-white/70 dark:bg-zinc-900/70 rounded-xl">
                        <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">وسادة الأمان المطلوبة</span>
                        <span className="text-sm font-black text-zinc-700 dark:text-zinc-300">
                          {formatMoney(dealResult.requiredCushion)}
                        </span>
                      </div>
                    </div>

                    {/* Analysis explanation */}
                    <p className="text-xs sm:text-sm font-medium leading-relaxed mb-3 text-zinc-800 dark:text-zinc-200">
                      {dealResult.explanation}
                    </p>

                    {/* Operational Advice */}
                    <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-start gap-2 text-xs">
                      <span className="font-bold text-zinc-900 dark:text-white shrink-0">توجيه الوكيل:</span>
                      <span className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{dealResult.advice}</span>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                    <Coins size={32} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      أدخل تكلفة الصفقة والكاش المتوفر بيدك للحصول على تقييم فوري بالذكاء التجاري
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: FIXED COMMITMENTS */}
            {activeTab === 'commitments' && (
              <div className="space-y-4">
                <div className="p-3 bg-brand-50/70 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-800/50 rounded-xl text-xs text-brand-900 dark:text-brand-200 flex items-start gap-2">
                  <ShieldCheck size={18} className="text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">مفهوم «وسادة الأمان النقدي الإلزامية»:</span>
                    <span className="text-zinc-600 dark:text-zinc-300">
                      هذه المبالغ تذهب بصفة شبه ثابتة إلى شاحنات الحليب والألبان والخبز والغاز. تجميد هذا المبلغ في بضائع بطيئة البيع هو السبب الأول لأزمات السيولة في محلات التجزئة.
                    </span>
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 text-center">
                    <span className="block text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      متوسط المصروف الأسبوعي الثابت
                    </span>
                    <span className="text-lg sm:text-xl font-black text-brand-600 dark:text-brand-400 mt-1 block">
                      {formatMoney(recurringAnalysis.weeklyEstimatedTotal)}
                    </span>
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">تقريباً كل 7 أيام</span>
                  </div>

                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 text-center">
                    <span className="block text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      المعدل اليومي للسلع الأساسية
                    </span>
                    <span className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mt-1 block">
                      {formatMoney(recurringAnalysis.dailyEstimatedTotal)}
                    </span>
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">يومياً لتغطية الحليب والخبز</span>
                  </div>
                </div>

                {/* Categorized breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                    توزيع النفقات الإلزامية حسب الصنف:
                  </h4>
                  {recurringAnalysis.breakdownByCategory.length > 0 ? (
                    recurringAnalysis.breakdownByCategory.map((cat, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{cat.icon}</span>
                          <div>
                            <span className="text-xs font-black text-zinc-900 dark:text-white block">{cat.name}</span>
                            {cat.suppliers.length > 0 && (
                              <span className="text-[10px] text-zinc-400 block">
                                {cat.suppliers.join('، ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-black text-zinc-900 dark:text-white block">
                            ~{formatMoney(cat.weekly)}
                          </span>
                          <span className="text-[10px] text-zinc-400">أسبوعياً</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">
                      سيتم توزيع الأصناف تلقائياً مع تسجيل أولى فواتير الموردين أو رفع دورة سابقة
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: CASH READINESS FOR TODAY & TOMORROW */}
            {activeTab === 'readiness' && (
              <div className="space-y-4">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs text-zinc-600 dark:text-zinc-300">
                  يعتمد هذا الجدول على <span className="font-bold text-zinc-900 dark:text-white">أيام زيارات الموردين المسجلة في التطبيق (Visit Days)</span> ومتوسط فواتيرهم السابقة؛ ليساعدك على حجز الكاش المطلوب في الدرج وتفادي الحرج.
                </div>

                {/* Today */}
                <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-900/40 bg-brand-50/40 dark:bg-brand-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-brand-900 dark:text-brand-300 flex items-center gap-1.5">
                      <Calendar size={14} />
                      زيارات اليوم ({upcomingReadiness.todayName})
                    </span>
                    <span className="text-xs font-black text-brand-700 dark:text-brand-400 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-800">
                      كاش متوقع: {formatMoney(upcomingReadiness.todayExpectedCash)}
                    </span>
                  </div>

                  {upcomingReadiness.todayList.length > 0 ? (
                    <div className="space-y-1.5">
                      {upcomingReadiness.todayList.map((item, idx) => (
                        <div key={idx} className="p-2 bg-white dark:bg-zinc-900 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-zinc-900 dark:text-white">{item.supplier.name}</span>
                            <span className="text-[10px] text-zinc-400 mr-2">({item.supplier.typeOfGoods || 'بضاعة عامة'})</span>
                          </div>
                          <span className="font-black text-zinc-700 dark:text-zinc-300">
                            {item.avgAmount > 0 ? `~${formatMoney(item.avgAmount)}` : 'حسب الفاتورة'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">لا توجد زيارات مجدولة لليوم</p>
                  )}
                </div>

                {/* Tomorrow */}
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Calendar size={14} />
                      زيارات الغد ({upcomingReadiness.tomorrowName})
                    </span>
                    <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                      كاش متوقع: {formatMoney(upcomingReadiness.tomorrowExpectedCash)}
                    </span>
                  </div>

                  {upcomingReadiness.tomorrowList.length > 0 ? (
                    <div className="space-y-1.5">
                      {upcomingReadiness.tomorrowList.map((item, idx) => (
                        <div key={idx} className="p-2 bg-white dark:bg-zinc-900 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-zinc-900 dark:text-white">{item.supplier.name}</span>
                            <span className="text-[10px] text-zinc-400 mr-2">({item.supplier.typeOfGoods || 'بضاعة عامة'})</span>
                          </div>
                          <span className="font-black text-zinc-700 dark:text-zinc-300">
                            {item.avgAmount > 0 ? `~${formatMoney(item.avgAmount)}` : 'حسب الفاتورة'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">لا توجد زيارات مجدولة ليوم الغد</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
              <TrendingUp size={12} />
              تحليل فوري مبني على سجلات مشتريات متجرك
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold active:scale-95 transition-transform"
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

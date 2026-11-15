import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, BrainCircuit, Sparkles, CheckCircle2, AlertTriangle, 
  XCircle, Coins, ShieldCheck, Calendar, ArrowRight,
  TrendingUp, Info, HelpCircle
} from 'lucide-react';
import { Supplier, SupplierTransaction, SupplierCycle } from '../../types';
import { formatCurrency, safeParseDate, roundMoney } from '../../lib/utils';
import { useFolioTheme } from '../folio/FolioPageChrome';

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
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
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

    // Recommended maximum safe spending limit based on 3-day immediate safety cushion:
    const requiredCushion = roundMoney(dailyNeed * 3);
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
    } else if (safetyDaysCovered < 3.0) {
      status = 'danger';
      title = '🛑 لا! خطر عجز سيولة في الـ 3 أيام القادمة';
      badgeLabel = 'خطر شديد - لا يُنصح بها';
      explanation = `بعد دفع الصفقة، سيتبقى معك فقط ${formatMoney(remainingCash)}، وهو أقل من وسادة أمان الـ 3 أيام القادمة (${formatMoney(requiredCushion)}) لمشتريات الحليب والخبز الإلزامية (المتوسط اليومي: ${formatMoney(dailyNeed)}). ستعجز عن دفع مستحقات شاحنة الألبان أو الخبز!`;
      advice = `الحد الأقصى الآمن الذي يمكنك شراؤه حالياً من هذه الصفقة هو: ${formatMoney(maxSafeDealCost)} حتى تحتفظ بكاش يغطي الـ 3 أيام القادمة براحة.`;
    } else if (safetyDaysCovered < 5.0) {
      status = 'caution';
      title = '⚠️ نعم مشروطة - مقبولة بحذر';
      badgeLabel = 'مقبولة بحذر - هامش ضيق';
      explanation = `سيتبقى معك ${formatMoney(remainingCash)} بعد الصفقة، وهو يغطي الـ 3 أيام القادمة بهامش ضيق (${Math.round(safetyDaysCovered * 10) / 10} أيام). إذا كانت مداخيل الصندوق اليومية ممتازة وتصريف البضاعة سريعاً يمكنك إتمامها.`;
      advice = `إذا كانت البضاعة سريعة الدوران فسارع ببيعها، أو اشترِ كمية أصغر بقيمة ${formatMoney(maxSafeDealCost)} لتكون في أمان تام.`;
    } else {
      status = 'safe';
      title = '🟢 نعم! صفقة آمنة وممتازة';
      badgeLabel = 'صفقة آمنة ومربحة';
      explanation = `بعد دفع قيمة الصفقة (${formatMoney(cost)})، سيتبقى معك ${formatMoney(remainingCash)} كاش جاهز. هذا المبلغ يغطي الـ 3 أيام القادمة وأكثر براحة تامة (${Math.round(safetyDaysCovered * 10) / 10} أيام أمان)!`;
      advice = 'الوضع المالي ممتاز والسيولة المتبقية تحميك تماماً؛ توكل على الله واغتنم التخفيض.';
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

  // 3. Upcoming Visit Readiness for Next 3 Days (Today, Tomorrow, Day after Tomorrow)
  const upcomingReadiness = useMemo(() => {
    const today = new Date().getDay();
    const tomorrow = (today + 1) % 7;
    const afterTomorrow = (today + 2) % 7;

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
    const afterTomorrowList = getSuppliersForDay(afterTomorrow);

    const todayExpectedCash = roundMoney(todayList.reduce((sum, item) => sum + item.avgAmount, 0));
    const tomorrowExpectedCash = roundMoney(tomorrowList.reduce((sum, item) => sum + item.avgAmount, 0));
    const afterTomorrowExpectedCash = roundMoney(afterTomorrowList.reduce((sum, item) => sum + item.avgAmount, 0));
    const total3DaysExpectedCash = roundMoney(todayExpectedCash + tomorrowExpectedCash + afterTomorrowExpectedCash);

    return {
      todayName: daysMap[today],
      tomorrowName: daysMap[tomorrow],
      afterTomorrowName: daysMap[afterTomorrow],
      todayList,
      tomorrowList,
      afterTomorrowList,
      todayExpectedCash,
      tomorrowExpectedCash,
      afterTomorrowExpectedCash,
      total3DaysExpectedCash
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
          className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 12 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.96, y: 12 }} 
          className="relative w-full max-w-xl max-h-[92vh] flex flex-col border shadow-2xl overflow-hidden text-right"
          style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
          dir="rtl"
        >
          {/* Header */}
          <div
            className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 border shrink-0"
                style={{
                  color: theme.accent,
                  borderColor: `${theme.accent}45`,
                  backgroundColor: `${theme.accent}12`
                }}
              >
                01
              </span>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black truncate" style={{ color: theme.text }}>
                  مستشار الصفقات والسيولة
                </h2>
                <p className="text-[11px] truncate mt-0.5" style={{ color: theme.textMuted }}>
                  يتتبع نفقات الحليب والخبز الإلزامية ويحميك من أزمات السيولة عند الشراء
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-1.5 border flex items-center justify-center transition-colors cursor-pointer shrink-0"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.text
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Sub Navigation Tabs */}
          <div
            className="grid grid-cols-3 border-b text-xs font-bold p-1.5 gap-1.5 shrink-0"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('deal')}
              className="py-2 px-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              style={
                activeTab === 'deal'
                  ? { backgroundColor: theme.accent, color: theme.accentText }
                  : { backgroundColor: 'transparent', color: theme.textMuted }
              }
            >
              <Sparkles size={14} />
              <span>فاحص الصفقات</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('commitments')}
              className="py-2 px-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              style={
                activeTab === 'commitments'
                  ? { backgroundColor: theme.accent, color: theme.accentText }
                  : { backgroundColor: 'transparent', color: theme.textMuted }
              }
            >
              <ShieldCheck size={14} />
              <span>المصاريف الإلزامية</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('readiness')}
              className="py-2 px-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              style={
                activeTab === 'readiness'
                  ? { backgroundColor: theme.accent, color: theme.accentText }
                  : { backgroundColor: 'transparent', color: theme.textMuted }
              }
            >
              <Calendar size={14} />
              <span>رادار الـ 3 أيام</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* TAB 1: DEAL EVALUATOR */}
            {activeTab === 'deal' && (
              <div className="space-y-4">
                {/* Context banner */}
                <div
                  className="p-3 border flex items-start gap-2.5 text-xs"
                  style={{
                    backgroundColor: `${theme.accent}10`,
                    borderColor: `${theme.accent}40`,
                    color: theme.text
                  }}
                >
                  <Info size={16} className="shrink-0 mt-0.5" style={{ color: theme.accent }} />
                  <p className="leading-relaxed">
                    عرض عليك مورد صفقة أو تخفيضاً؟ اكتب تكلفة الصفقة والمبلغ الموجود في يدك، ليحسب لك الوكيل هل ستتبقى سيولة كافية لشاحنات الحليب والخبز القادمة أم لا!
                  </p>
                </div>

                {/* Inputs Box */}
                <div
                  className="p-4 border space-y-3"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1" style={{ color: theme.text }}>
                        تكلفة الصفقة المطلوبة ({settings.currency}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="مثال: 450"
                        value={dealCost}
                        onChange={(e) => setDealCost(e.target.value)}
                        className="w-full h-11 px-3 text-sm font-mono font-black tabular-nums border outline-none"
                        style={{
                          backgroundColor: theme.bg,
                          borderColor: theme.border,
                          color: theme.text
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1" style={{ color: theme.text }}>
                        الكاش المتوفر بيدك / في الصندوق حالياً ({settings.currency}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="مثال: 700"
                        value={availableCash}
                        onChange={(e) => setAvailableCash(e.target.value)}
                        className="w-full h-11 px-3 text-sm font-mono font-black tabular-nums border outline-none"
                        style={{
                          backgroundColor: theme.bg,
                          borderColor: theme.border,
                          color: theme.text
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium mb-1" style={{ color: theme.textMuted }}>
                        اسم البضاعة أو المورد (اختياري)
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: 30 كرتونة معكرونة أو عصير"
                        value={dealName}
                        onChange={(e) => setDealName(e.target.value)}
                        className="w-full h-9 px-3 text-xs border outline-none"
                        style={{
                          backgroundColor: theme.bg,
                          borderColor: theme.border,
                          color: theme.text
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium mb-1" style={{ color: theme.textMuted }}>
                        نسبة التخفيض أو التوفير التقريبي (اختياري %)
                      </label>
                      <input
                        type="number"
                        placeholder="مثال: 10%"
                        value={expectedDiscountPct}
                        onChange={(e) => setExpectedDiscountPct(e.target.value)}
                        className="w-full h-9 px-3 text-xs font-mono tabular-nums border outline-none"
                        style={{
                          backgroundColor: theme.bg,
                          borderColor: theme.border,
                          color: theme.text
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Deal Evaluation Card Output */}
                {dealResult ? (() => {
                  const statusColor = dealResult.status === 'safe'
                    ? theme.positive
                    : dealResult.status === 'caution'
                    ? theme.neutral
                    : theme.negative;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 sm:p-5 border"
                      style={{
                        backgroundColor: `${statusColor}10`,
                        borderColor: `${statusColor}55`
                      }}
                    >
                      {/* Header decision */}
                      <div
                        className="flex items-center justify-between gap-2 pb-3 border-b"
                        style={{ borderColor: `${statusColor}30` }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {dealResult.status === 'safe' ? (
                            <CheckCircle2 size={22} className="shrink-0" style={{ color: statusColor }} />
                          ) : dealResult.status === 'caution' ? (
                            <AlertTriangle size={22} className="shrink-0" style={{ color: statusColor }} />
                          ) : (
                            <XCircle size={22} className="shrink-0" style={{ color: statusColor }} />
                          )}
                          <h3 className="text-sm sm:text-base font-black" style={{ color: theme.text }}>
                            {dealResult.title}
                          </h3>
                        </div>
                        <span
                          className="px-2.5 py-1 border text-[11px] font-black shrink-0"
                          style={{
                            backgroundColor: `${statusColor}20`,
                            borderColor: `${statusColor}50`,
                            color: statusColor
                          }}
                        >
                          {dealResult.badgeLabel}
                        </span>
                      </div>

                      {/* Metric strip */}
                      <div
                        className="grid grid-cols-3 border divide-x divide-x-reverse my-3 text-center"
                        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                      >
                        <div className="p-2.5" style={{ borderColor: theme.border }}>
                          <span className="block text-[10px] font-bold" style={{ color: theme.textMuted }}>الكاش المتبقي</span>
                          <span
                            className="text-sm font-mono font-black tabular-nums"
                            style={{ color: dealResult.remainingCash >= 0 ? theme.text : theme.negative }}
                          >
                            {formatMoney(dealResult.remainingCash)}
                          </span>
                        </div>
                        <div className="p-2.5" style={{ borderColor: theme.border }}>
                          <span className="block text-[10px] font-bold" style={{ color: theme.textMuted }}>تغطية الأساسيات</span>
                          <span className="text-sm font-mono font-black tabular-nums" style={{ color: theme.accent }}>
                            {dealResult.safetyDaysCovered > 0 ? `~${dealResult.safetyDaysCovered} أيام` : 'صفر أيام'}
                          </span>
                        </div>
                        <div className="p-2.5" style={{ borderColor: theme.border }}>
                          <span className="block text-[10px] font-bold" style={{ color: theme.textMuted }}>وسادة الأمان</span>
                          <span className="text-sm font-mono font-black tabular-nums" style={{ color: theme.text }}>
                            {formatMoney(dealResult.requiredCushion)}
                          </span>
                        </div>
                      </div>

                      {/* Analysis explanation */}
                      <p className="text-xs sm:text-sm font-medium leading-relaxed mb-3" style={{ color: theme.text }}>
                        {dealResult.explanation}
                      </p>

                      {/* 3-day radar warning tie-in */}
                      {upcomingReadiness.total3DaysExpectedCash > 0 && dealResult.remainingCash < upcomingReadiness.total3DaysExpectedCash && (
                        <div
                          className="mb-3 p-3 border flex items-start gap-2.5 text-xs"
                          style={{
                            backgroundColor: `${theme.neutral}18`,
                            borderColor: `${theme.neutral}50`,
                            color: theme.text
                          }}
                        >
                          <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: theme.neutral }} />
                          <div>
                            <span className="font-bold block">تحذير مباشر من رادار الـ 3 أيام:</span>
                            <span className="leading-relaxed">
                              شاحنات الموردين القادمة خلال الـ 3 أيام القادمة ستحتاج إلى حوالي <strong>{formatMoney(upcomingReadiness.total3DaysExpectedCash)}</strong>، بينما سيتبقى معك بعد هذه الصفقة <strong>{formatMoney(dealResult.remainingCash)}</strong> فقط! قد تواجه حرجاً في الدفع.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Operational Advice */}
                      <div
                        className="pt-3 border-t flex items-start gap-2 text-xs"
                        style={{ borderColor: `${statusColor}30` }}
                      >
                        <span className="font-bold shrink-0" style={{ color: theme.text }}>توجيه الوكيل:</span>
                        <span className="leading-relaxed" style={{ color: theme.textMuted }}>{dealResult.advice}</span>
                      </div>
                    </motion.div>
                  );
                })() : (
                  <div
                    className="text-center py-8 border border-dashed p-6"
                    style={{ borderColor: theme.border, backgroundColor: theme.surface }}
                  >
                    <Coins size={30} className="mx-auto mb-2" style={{ color: theme.textMuted }} />
                    <p className="text-xs font-bold" style={{ color: theme.textMuted }}>
                      أدخل تكلفة الصفقة والكاش المتوفر بيدك للحصول على تقييم فوري بالذكاء التجاري
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: FIXED COMMITMENTS */}
            {activeTab === 'commitments' && (
              <div className="space-y-4">
                <div
                  className="p-3 border text-xs flex items-start gap-2"
                  style={{
                    backgroundColor: `${theme.accent}10`,
                    borderColor: `${theme.accent}40`,
                    color: theme.text
                  }}
                >
                  <ShieldCheck size={18} className="shrink-0 mt-0.5" style={{ color: theme.accent }} />
                  <div>
                    <span className="font-bold block">مفهوم «وسادة الأمان النقدي الإلزامية»:</span>
                    <span style={{ color: theme.textMuted }}>
                      هذه المبالغ تذهب بصفة شبه ثابتة إلى شاحنات الحليب والألبان والخبز والغاز. تجميد هذا المبلغ في بضائع بطيئة البيع هو السبب الأول لأزمات السيولة في محلات التجزئة.
                    </span>
                  </div>
                </div>

                {/* Summary cards */}
                <div
                  className="grid grid-cols-2 border divide-x divide-x-reverse"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <div className="p-4 text-center" style={{ borderColor: theme.border }}>
                    <span className="block text-xs font-bold" style={{ color: theme.textMuted }}>
                      متوسط المصروف الأسبوعي الثابت
                    </span>
                    <span className="text-lg sm:text-xl font-mono font-black tabular-nums mt-1 block" style={{ color: theme.accent }}>
                      {formatMoney(recurringAnalysis.weeklyEstimatedTotal)}
                    </span>
                    <span className="text-[10px] mt-0.5 block" style={{ color: theme.textMuted }}>تقريباً كل 7 أيام</span>
                  </div>

                  <div className="p-4 text-center" style={{ borderColor: theme.border }}>
                    <span className="block text-xs font-bold" style={{ color: theme.textMuted }}>
                      المعدل اليومي للسلع الأساسية
                    </span>
                    <span className="text-lg sm:text-xl font-mono font-black tabular-nums mt-1 block" style={{ color: theme.text }}>
                      {formatMoney(recurringAnalysis.dailyEstimatedTotal)}
                    </span>
                    <span className="text-[10px] mt-0.5 block" style={{ color: theme.textMuted }}>يومياً لتغطية الحليب والخبز</span>
                  </div>
                </div>

                {/* Categorized breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black" style={{ color: theme.text }}>
                    توزيع النفقات الإلزامية حسب الصنف:
                  </h4>
                  {recurringAnalysis.breakdownByCategory.length > 0 ? (
                    recurringAnalysis.breakdownByCategory.map((cat, idx) => (
                      <div
                        key={idx}
                        className="p-3 border flex items-center justify-between"
                        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{cat.icon}</span>
                          <div>
                            <span className="text-xs font-black block" style={{ color: theme.text }}>{cat.name}</span>
                            {cat.suppliers.length > 0 && (
                              <span className="text-[10px] block" style={{ color: theme.textMuted }}>
                                {cat.suppliers.join('، ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-mono font-black tabular-nums block" style={{ color: theme.text }}>
                            ~{formatMoney(cat.weekly)}
                          </span>
                          <span className="text-[10px]" style={{ color: theme.textMuted }}>أسبوعياً</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      className="p-4 text-center text-xs border border-dashed"
                      style={{ color: theme.textMuted, borderColor: theme.border, backgroundColor: theme.surface }}
                    >
                      سيتم توزيع الأصناف تلقائياً مع تسجيل أولى فواتير الموردين أو رفع دورة سابقة
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: CASH READINESS FOR NEXT 3 DAYS */}
            {activeTab === 'readiness' && (
              <div className="space-y-4">
                {/* 3-day overview banner */}
                <div
                  className="p-4 border flex items-center justify-between"
                  style={{
                    backgroundColor: `${theme.accent}10`,
                    borderColor: `${theme.accent}45`
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar size={20} className="shrink-0" style={{ color: theme.accent }} />
                    <div>
                      <span className="text-xs font-black block" style={{ color: theme.text }}>
                        إجمالي السيولة المطلوبة للموردين خلال الـ 3 أيام القادمة:
                      </span>
                      <span className="text-[11px]" style={{ color: theme.textMuted }}>
                        ({upcomingReadiness.todayName}، {upcomingReadiness.tomorrowName}، {upcomingReadiness.afterTomorrowName})
                      </span>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <span className="text-base sm:text-lg font-mono font-black tabular-nums block" style={{ color: theme.accent }}>
                      {formatMoney(upcomingReadiness.total3DaysExpectedCash)}
                    </span>
                    <span className="text-[10px]" style={{ color: theme.textMuted }}>تقدير الكاش المطلوب</span>
                  </div>
                </div>

                <div
                  className="p-3 border text-xs"
                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
                >
                  يعتمد هذا الجدول على <span className="font-bold" style={{ color: theme.text }}>أيام زيارات الموردين المسجلة في التطبيق (Visit Days)</span> ومتوسط فواتيرهم؛ ليساعدك على حجز الكاش المطلوب في الدرج وتفادي الحرج.
                </div>

                {[
                  {
                    title: `اليوم الأول: اليوم (${upcomingReadiness.todayName})`,
                    list: upcomingReadiness.todayList,
                    cash: upcomingReadiness.todayExpectedCash,
                    empty: 'لا توجد زيارات مجدولة لليوم',
                    highlight: true
                  },
                  {
                    title: `اليوم الثاني: غداً (${upcomingReadiness.tomorrowName})`,
                    list: upcomingReadiness.tomorrowList,
                    cash: upcomingReadiness.tomorrowExpectedCash,
                    empty: 'لا توجد زيارات مجدولة ليوم الغد',
                    highlight: false
                  },
                  {
                    title: `اليوم الثالث: بعد غد (${upcomingReadiness.afterTomorrowName})`,
                    list: upcomingReadiness.afterTomorrowList,
                    cash: upcomingReadiness.afterTomorrowExpectedCash,
                    empty: 'لا توجد زيارات مجدولة لبعد غد',
                    highlight: false
                  }
                ].map((day, dIdx) => (
                  <div
                    key={dIdx}
                    className="p-4 border space-y-3"
                    style={{
                      backgroundColor: day.highlight ? `${theme.accent}08` : theme.surface,
                      borderColor: day.highlight ? `${theme.accent}45` : theme.border
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-black flex items-center gap-1.5"
                        style={{ color: day.highlight ? theme.accent : theme.text }}
                      >
                        <Calendar size={14} />
                        {day.title}
                      </span>
                      <span
                        className="text-xs font-mono font-black tabular-nums px-2.5 py-1 border"
                        style={{
                          backgroundColor: theme.bg,
                          borderColor: day.highlight ? `${theme.accent}45` : theme.border,
                          color: day.highlight ? theme.accent : theme.text
                        }}
                      >
                        كاش متوقع: {formatMoney(day.cash)}
                      </span>
                    </div>

                    {day.list.length > 0 ? (
                      <div className="space-y-1.5">
                        {day.list.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2 border flex items-center justify-between text-xs"
                            style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                          >
                            <div>
                              <span className="font-bold" style={{ color: theme.text }}>{item.supplier.name}</span>
                              <span className="text-[10px] mr-2" style={{ color: theme.textMuted }}>
                                ({item.supplier.typeOfGoods || 'بضاعة عامة'})
                              </span>
                            </div>
                            <span className="font-mono font-black tabular-nums" style={{ color: theme.text }}>
                              {item.avgAmount > 0 ? `~${formatMoney(item.avgAmount)}` : 'حسب الفاتورة'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs italic" style={{ color: theme.textMuted }}>{day.empty}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="p-4 border-t flex items-center justify-between shrink-0"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <span className="text-[11px] flex items-center gap-1" style={{ color: theme.textMuted }}>
              <TrendingUp size={12} />
              تحليل فوري مبني على سجلات مشتريات متجرك
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2.5 border text-xs font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.text
              }}
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

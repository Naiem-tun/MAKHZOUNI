import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { Plus, Eye, Trash2, CheckCircle2, TrendingDown, TrendingUp, Search, ChevronDown, X } from 'lucide-react';
import { MonitoredProduct, Product } from '../types';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CustomConfirmModal } from '../components/common/CustomConfirmModal';
import { useFolioTheme } from '../components/folio/FolioPageChrome';

export default function MonitoredProducts() {
  const { user, settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

  const [monitored, setMonitored] = useState<MonitoredProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MonitoredProduct | null>(null);

  const [confirmConfig, setConfirmConfig] = useState<{
    show: boolean;
    message: string;
    onConfirm?: () => void;
  }>({ show: false, message: '' });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/monitored_products`));
    const unsub = onSnapshot(q, (snap) => {
      setMonitored(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MonitoredProduct)));
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/products`));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    });
    return unsub;
  }, [user]);

  return (
    <div className="space-y-5 pb-24 pt-4 md:pt-6" style={{ color: theme.text }}>
      {/* Editorial Header */}
      <header
        className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-4 border-b"
        style={{ borderColor: theme.border }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
              01
            </span>
            <span className="tracking-wider uppercase font-mono" style={{ color: theme.textMuted }}>
              MONITORING · VELOCITY
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">المنتجات تحت المراقبة</h1>
          <p className="text-xs sm:text-sm" style={{ color: theme.textMuted }}>
            تتبع سرعة حركة بيع المنتجات المختارة بمرور الوقت
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 text-white px-4 py-2.5 text-xs sm:text-sm font-bold cursor-pointer"
          style={{ backgroundColor: theme.accent }}
        >
          <Plus size={16} />
          <span>إضافة منتج للمراقبة</span>
        </button>
      </header>

      {monitored.length === 0 ? (
        <div
          className="text-center py-16 border"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <Eye size={38} className="mx-auto mb-3 opacity-30" />
          <h3 className="text-base font-black mb-1">لا توجد منتجات تحت المراقبة</h3>
          <p className="text-xs mb-5" style={{ color: theme.textMuted }}>
            قم بإضافة منتج لمعرفة سرعة بيعه بدقة
          </p>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white cursor-pointer"
            style={{ backgroundColor: theme.accent }}
          >
            <Plus size={16} />
            <span>إضافة منتج</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monitored.map((mp) => (
            <MonitoredCard
              key={mp.id}
              item={mp}
              theme={theme}
              onCheck={() => {
                setSelectedProduct(mp);
                setIsCheckModalOpen(true);
              }}
              onDelete={() => {
                setConfirmConfig({
                  show: true,
                  message: `هل أنت متأكد من مسح ${mp.name} من قائمة المراقبة؟ لن يحذف هذا المنتج من المخزون الأصلي.`,
                  onConfirm: async () => {
                    if (!user) return;
                    await deleteDoc(doc(db, `users/${user.uid}/monitored_products`, mp.id!));
                    setConfirmConfig({ show: false, message: '' });
                  },
                });
              }}
            />
          ))}
        </div>
      )}

      {isAddModalOpen && (
        <AddMonitoredModal onClose={() => setIsAddModalOpen(false)} products={products} user={user} theme={theme} />
      )}

      {isCheckModalOpen && selectedProduct && (
        <CheckQuantityModal
          item={selectedProduct}
          onClose={() => setIsCheckModalOpen(false)}
          user={user}
          theme={theme}
        />
      )}

      <CustomConfirmModal
        show={confirmConfig.show}
        message={confirmConfig.message}
        type="confirm"
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig({ show: false, message: '' })}
      />
    </div>
  );
}

const MonitoredCard: React.FC<{
  item: MonitoredProduct;
  theme: any;
  onCheck: () => void;
  onDelete: () => void;
}> = ({ item, theme, onCheck, onDelete }) => {
  const daysSinceStart = Math.max(
    1,
    Math.ceil((new Date().getTime() - item.startDate.toMillis()) / (1000 * 60 * 60 * 24)),
  );
  const totalSold =
    item.initialQuantity -
    item.currentQuantity +
    item.history.filter((h) => h.type === 'purchase').reduce((acc, h) => acc + (h.addedQuantity || 0), 0);

  const dailyRate = (totalSold / daysSinceStart).toFixed(1).replace(/\.0$/, '');

  const chartData = item.history.map((h, i) => {
    const d = h.date?.toDate ? h.date.toDate() : new Date(h.date);
    return {
      date:
        d.toLocaleDateString('ar', { month: 'short', day: 'numeric' }) +
        (item.history.length > 1 ? ` (${i + 1})` : ''),
      الكمية: h.quantity,
    };
  });

  return (
    <div
      className="border p-4 flex flex-col gap-4"
      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
    >
      <div className="flex justify-between items-start gap-2 pb-3 border-b" style={{ borderColor: theme.border }}>
        <h3 className="font-black text-base line-clamp-1">{item.name}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="px-2 py-0.5 border font-mono font-bold text-xs tabular-nums"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.accent,
            }}
          >
            {item.currentQuantity}
          </span>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 border transition-colors cursor-pointer"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.negative,
            }}
            title="إزالة من المراقبة"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div
        className="grid grid-cols-2 border divide-x divide-x-reverse"
        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      >
        <div className="p-2.5 space-y-0.5" style={{ borderColor: theme.border }}>
          <div className="text-[11px] font-bold flex items-center gap-1" style={{ color: theme.textMuted }}>
            <TrendingDown size={13} />
            <span>مباع</span>
          </div>
          <div className="font-mono font-black text-sm tabular-nums">
            {totalSold} <span className="text-[10px] font-sans font-normal" style={{ color: theme.textMuted }}>قطعة</span>
          </div>
        </div>

        <div className="p-2.5 space-y-0.5" style={{ borderColor: theme.border }}>
          <div className="text-[11px] font-bold flex items-center gap-1" style={{ color: theme.textMuted }}>
            <TrendingUp size={13} />
            <span>معدل البيع/يوم</span>
          </div>
          <div className="font-mono font-black text-sm tabular-nums" style={{ color: theme.accent }}>
            {dailyRate} <span className="text-[10px] font-sans font-normal" style={{ color: theme.textMuted }}>قطعة/يوم</span>
          </div>
        </div>
      </div>

      <div className="h-36 w-full mt-auto" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme.textMuted }} axisLine={false} tickLine={false} />
            <YAxis
              hide
              domain={['dataMin - Math.max(1, dataMin * 0.1)', 'dataMax + Math.max(1, dataMax * 0.1)']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: 0,
                color: theme.text,
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="الكمية"
              stroke={theme.accent}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: theme.accent }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button
        type="button"
        onClick={onCheck}
        className="w-full flex justify-center items-center gap-1.5 py-2.5 text-xs font-bold border transition-colors mt-auto cursor-pointer"
        style={{
          backgroundColor: theme.text,
          borderColor: theme.text,
          color: theme.surface,
        }}
      >
        <CheckCircle2 size={15} />
        <span>جرد سريع للمنتج</span>
      </button>
    </div>
  );
};

const AddMonitoredModal: React.FC<{
  onClose: () => void;
  products: Product[];
  user: any;
  theme: any;
}> = ({ onClose, products, user, theme }) => {
  const [selectedId, setSelectedId] = useState('');
  const [initialQty, setInitialQty] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredProducts = products.filter((p) =>
    (p.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()),
  );
  const selectedProduct = products.find((p) => p.id === selectedId);

  const handleSave = async () => {
    if (!selectedId || !initialQty) return;
    const p = products.find((prod) => prod.id === selectedId);
    if (!p) return;

    await addDoc(collection(db, `users/${user.uid}/monitored_products`), {
      productId: p.id,
      name: p.name,
      initialQuantity: Number(initialQty),
      currentQuantity: Number(initialQty),
      startDate: new Date(),
      lastCheckDate: new Date(),
      history: [
        {
          date: new Date(),
          quantity: Number(initialQty),
          type: 'start',
        },
      ],
    } as Omit<MonitoredProduct, 'id'>);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div
        className="border p-5 w-full max-w-md shadow-2xl space-y-4"
        style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: theme.border }}>
          <h2 className="text-base font-black">إضافة منتج للمراقبة</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 border cursor-pointer"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="relative space-y-1.5">
          <span className="block text-xs font-bold" style={{ color: theme.textMuted }}>
            المنتج
          </span>
          <div className="relative">
            <button
              type="button"
              className="w-full p-3 text-right flex justify-between items-center border outline-none text-sm font-bold cursor-pointer"
              style={{
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: selectedProduct ? theme.text : theme.textMuted,
              }}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="line-clamp-1">{selectedProduct ? selectedProduct.name : '-- اختر منتجاً --'}</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                style={{ color: theme.textMuted }}
              />
            </button>
            {isDropdownOpen && (
              <div
                className="absolute z-10 w-full mt-1 border shadow-xl overflow-hidden flex flex-col"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <div className="p-2 border-b" style={{ borderColor: theme.border }}>
                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute right-2.5 top-2.5"
                      style={{ color: theme.textMuted }}
                    />
                    <input
                      type="text"
                      placeholder="ابحث عن منتج..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-2 pr-8 pl-2 border outline-none text-xs"
                      style={{
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y" style={{ borderColor: theme.border }}>
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-center text-xs" style={{ color: theme.textMuted }}>
                      لا توجد منتجات متطابقة
                    </div>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(p.id!);
                          setInitialQty(p.quantity.toString());
                          setIsDropdownOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full text-right p-3 text-xs font-bold transition-colors line-clamp-1 cursor-pointer"
                        style={{
                          backgroundColor: selectedId === p.id ? theme.surfaceMuted : 'transparent',
                          color: selectedId === p.id ? theme.accent : theme.text,
                        }}
                      >
                        {p.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="block text-xs font-bold" style={{ color: theme.textMuted }}>
            الكمية الابتدائية (للانطلاق من الوقت الحالي)
          </span>
          <input
            type="number"
            value={initialQty}
            onChange={(e) => setInitialQty(e.target.value)}
            className="w-full p-3 border outline-none font-mono font-bold text-sm"
            style={{
              backgroundColor: theme.bg,
              borderColor: theme.border,
              color: theme.text,
            }}
          />
        </label>

        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 p-2.5 border text-xs font-bold cursor-pointer"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedId || !initialQty}
            className="flex-1 p-2.5 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: theme.accent }}
          >
            إضافة
          </button>
        </div>
      </div>
    </div>
  );
};

const CheckQuantityModal: React.FC<{
  item: MonitoredProduct;
  onClose: () => void;
  user: any;
  theme: any;
}> = ({ item, onClose, user, theme }) => {
  const [qty, setQty] = useState('');

  const handleSave = async () => {
    if (!qty) return;
    const newHistory = [
      ...item.history,
      {
        date: new Date(),
        quantity: Number(qty),
        type: 'check' as const,
      },
    ];

    await updateDoc(doc(db, `users/${user.uid}/monitored_products`, item.id!), {
      currentQuantity: Number(qty),
      lastCheckDate: new Date(),
      history: newHistory,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div
        className="border p-5 w-full max-w-md shadow-2xl space-y-4"
        style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: theme.border }}>
          <h2 className="text-base font-black">جرد سريع: {item.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 border cursor-pointer"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
          >
            <X size={15} />
          </button>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
          أدخل الكمية المتبقية حالياً في الرف / المخزن. (لا يؤثر على المخزون الرئيسي).
        </p>

        <label className="block space-y-1.5">
          <span className="block text-xs font-bold" style={{ color: theme.textMuted }}>
            الكمية المتبقية الآن
          </span>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            autoFocus
            placeholder={`آخر كمية مسجلة: ${item.currentQuantity}`}
            className="w-full p-3 border outline-none font-mono font-bold text-sm"
            style={{
              backgroundColor: theme.bg,
              borderColor: theme.border,
              color: theme.text,
            }}
          />
        </label>

        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 p-2.5 border text-xs font-bold cursor-pointer"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!qty}
            className="flex-1 p-2.5 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: theme.accent }}
          >
            تحديث الكمية
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, deleteDoc, updateDoc, setDoc, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { Plus, Eye, History, Trash2, CheckCircle2, TrendingDown, TrendingUp, AlertTriangle, ArrowRight, Search, ChevronDown } from 'lucide-react';
import { MonitoredProduct, MonitoredProductHistory, Product } from '../types';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CustomConfirmModal } from '../components/common/CustomConfirmModal';

export default function MonitoredProducts() {
  const { user } = useAppContext();
  const { t } = useTranslation();
  
  const [monitored, setMonitored] = useState<MonitoredProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MonitoredProduct | null>(null);
  
  // Confirm Modal state
  const [confirmConfig, setConfirmConfig] = useState<{show: boolean, message: string, onConfirm?: () => void}>({ show: false, message: '' });

  // Load monitored products
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/monitored_products`));
    const unsub = onSnapshot(q, (snap) => {
      setMonitored(snap.docs.map(d => ({ id: d.id, ...d.data() } as MonitoredProduct)));
    });
    return unsub;
  }, [user]);

  // Load products (for the dropdown)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/products`));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
    return unsub;
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Eye className="text-brand-500" /> المنتجات تحت المراقبة
          </h1>
          <p className="text-sm text-zinc-500 mt-1">تتبع سرعة حركة بيع المنتجات المختارة بمرور الوقت</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition"
        >
          <Plus size={20} /> إضافة منتج للمراقبة
        </button>
      </div>

      {monitored.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <Eye size={48} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">لا توجد منتجات تحت المراقبة</h3>
          <p className="text-zinc-500 mb-6">قم بإضافة منتج لمعرفة سرعة بيعه بدقة</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 px-6 py-3 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-500/20 transition mx-auto font-bold"
          >
            <Plus size={20} /> إضافة منتج
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monitored.map(mp => (
            <MonitoredCard 
              key={mp.id} 
              item={mp} 
              onCheck={() => {
                setSelectedProduct(mp);
                setIsCheckModalOpen(true);
              }}
              onDelete={() => {
                setConfirmConfig({
                  show: true,
                  message: `هل أنت متأكد من مسح ${mp.name} من قائمة المراقبة؟ لن يحذف هذا المنتج من المخزون الأصلي.`,
                  onConfirm: async () => {
                    await deleteDoc(doc(db, `users/${user.uid}/monitored_products`, mp.id!));
                    setConfirmConfig({ show: false, message: '' });
                  }
                });
              }} 
            />
          ))}
        </div>
      )}

      {/* Add Modal & Check Modal logic to follow */}
      {isAddModalOpen && (
        <AddMonitoredModal 
          onClose={() => setIsAddModalOpen(false)} 
          products={products}
          user={user}
        />
      )}
      
      {isCheckModalOpen && selectedProduct && (
        <CheckQuantityModal
          item={selectedProduct}
          onClose={() => setIsCheckModalOpen(false)}
          user={user}
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

const MonitoredCard: React.FC<{ item: MonitoredProduct, onCheck: () => void, onDelete: () => void }> = ({ item, onCheck, onDelete }) => {
  const daysSinceStart = Math.max(1, Math.ceil((new Date().getTime() - item.startDate.toMillis()) / (1000 * 60 * 60 * 24)));
  const totalSold = item.initialQuantity - item.currentQuantity + item.history.filter(h => h.type === 'purchase').reduce((acc, h) => acc + (h.addedQuantity || 0), 0);
  
  // Format daily rate to look like a quantity (e.g. 15, or 15.5) rather than a price (15.00)
  const dailyRate = (totalSold / daysSinceStart).toFixed(1).replace(/\.0$/, '');

  const chartData = item.history.map((h, i) => {
    const d = h.date?.toDate ? h.date.toDate() : new Date(h.date);
    return {
      date: d.toLocaleDateString('ar', { month: 'short', day: 'numeric' }) + (item.history.length > 1 ? ` (${i + 1})` : ''),
      الكمية: h.quantity
    };
  });

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-bold text-lg text-zinc-900 dark:text-white line-clamp-1">{item.name}</h3>
        <div className="flex items-center gap-2">
          <span className="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 px-2 py-1 flex items-center justify-center rounded-lg text-sm font-bold">
            {item.currentQuantity}
          </span>
          <button 
            onClick={onDelete} 
            className="text-zinc-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
            title="إزالة من المراقبة"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1"><TrendingDown size={14}/> مباع</div>
          <div className="font-bold text-zinc-900 dark:text-zinc-100">{totalSold} <span className="text-xs text-zinc-500 font-normal">قطعة منذ أن بدأ</span></div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1"><TrendingUp size={14}/> معدل البيع/يوم</div>
          <div className="font-bold text-brand-600 dark:text-brand-400">{dailyRate} <span className="text-xs text-brand-600/70 dark:text-brand-400/70 font-normal">قطعة/يوم</span></div>
        </div>
      </div>

      <div className="h-40 w-full mb-4 mt-auto -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{fontSize: 10, fill: '#888'}} axisLine={false} tickLine={false} />
            <YAxis hide domain={['dataMin - Math.max(1, dataMin * 0.1)', 'dataMax + Math.max(1, dataMax * 0.1)']} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Line type="monotone" dataKey="الكمية" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button 
        onClick={onCheck}
        className="w-full flex justify-center items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition font-medium mt-auto"
      >
        <CheckCircle2 size={18} /> جرد سريع للمنتج
      </button>
    </div>
  );
}

// Minimal Modals just to finish the structure
const AddMonitoredModal: React.FC<{ onClose: () => void, products: Product[], user: any }> = ({ onClose, products, user }) => {
  const [selectedId, setSelectedId] = useState('');
  const [initialQty, setInitialQty] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedProduct = products.find(p => p.id === selectedId);

  const handleSave = async () => {
    if (!selectedId || !initialQty) return;
    const p = products.find(prod => prod.id === selectedId);
    if (!p) return;
    
    await addDoc(collection(db, `users/${user.uid}/monitored_products`), {
      productId: p.id,
      name: p.name,
      initialQuantity: Number(initialQty),
      currentQuantity: Number(initialQty),
      startDate: new Date(),
      lastCheckDate: new Date(),
      history: [{
        date: new Date(),
        quantity: Number(initialQty),
        type: 'start'
      }]
    } as Omit<MonitoredProduct, 'id'>);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">إضافة منتج للمراقبة</h2>
        
        <div className="block mb-4 relative">
          <span className="block text-sm font-medium mb-1">المنتج</span>
          <div className="relative">
            <button 
              type="button"
              className="w-full p-3 text-right flex justify-between items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-brand-500"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className={selectedProduct ? 'text-zinc-900 dark:text-zinc-100 line-clamp-1 text-right text-left' : 'text-zinc-400'}>
                {selectedProduct ? selectedProduct.name : '-- اختر منتجاً --'}
              </span>
              <ChevronDown size={18} className={`text-zinc-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden flex flex-col">
                <div className="p-2 border-b border-zinc-100 dark:border-zinc-700">
                  <div className="relative">
                    <Search size={16} className="absolute right-2.5 top-2.5 text-zinc-400" />
                    <input 
                      type="text" 
                      placeholder="ابحث عن منتج..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-2 pr-8 pl-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none text-sm focus:border-brand-500"
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-center text-zinc-500 text-sm">لا توجد منتجات متطابقة</div>
                  ) : (
                    filteredProducts.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(p.id!);
                          setInitialQty(p.quantity.toString());
                          setIsDropdownOpen(false);
                          setSearchQuery('');
                        }}
                        className={`w-full text-right p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors line-clamp-1 ${selectedId === p.id ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 font-bold' : ''}`}
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

        <label className="block mb-6">
          <span className="block text-sm font-medium mb-1">الكمية الابتدائية (للإنطلاق من الوقت الحالي)</span>
          <input 
            type="number" value={initialQty} onChange={e => setInitialQty(e.target.value)}
            className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-brand-500"
          />
        </label>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">إلغاء</button>
          <button onClick={handleSave} disabled={!selectedId || !initialQty} className="flex-1 p-3 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700 transition disabled:opacity-50">إضافة</button>
        </div>
      </div>
    </div>
  );
}

const CheckQuantityModal: React.FC<{ item: MonitoredProduct, onClose: () => void, user: any }> = ({ item, onClose, user }) => {
  const [qty, setQty] = useState('');

  const handleSave = async () => {
    if (!qty) return;
    const newHistory = [...item.history, {
      date: new Date(),
      quantity: Number(qty),
      type: 'check' as const
    }];
    
    await updateDoc(doc(db, `users/${user.uid}/monitored_products`, item.id!), {
      currentQuantity: Number(qty),
      lastCheckDate: new Date(),
      history: newHistory
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">جرد سريع للمنتج: {item.name}</h2>
        <p className="text-sm mb-4 text-zinc-500">أدخل الكمية المتبقية حالياً في الرف / المخزن. (لا تنسى أنه لا يؤثر على المخزون الرئيسي).</p>
        
        <label className="block mb-6">
          <span className="block text-sm font-medium mb-1">الكمية المتبقية الآن</span>
          <input 
            type="number" value={qty} onChange={e => setQty(e.target.value)} autoFocus
            placeholder={`آخر كمية مُسجلة: ${item.currentQuantity}`}
            className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-brand-500"
          />
        </label>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">إلغاء</button>
          <button onClick={handleSave} disabled={!qty} className="flex-1 p-3 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition disabled:opacity-50">تحديث الكمية</button>
        </div>
      </div>
    </div>
  );
}

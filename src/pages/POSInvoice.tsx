import React, { useState, useEffect } from 'react';
import {
  useTranslation } from 'react-i18next';
import {
  motion, AnimatePresence } from 'motion/react';
import {
  
  Calculator, 
  Trash2,
  ScanBarcode, 
  Plus, 
  Search,
  ChevronDown,
  Copy,
  CheckCheck,
  MessageCircle,
  RotateCcw,
  FileDown,
  Loader2
} from 'lucide-react';
import * as html2pdf from 'html2pdf.js';
import {
  useAppContext } from '../AppContext';
import {
  collection, onSnapshot, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import {
  db } from '../lib/firebase';
import {
  Product } from '../types';

import {
  BarcodeScanner } from '../components/common/BarcodeScanner';

interface InvoiceItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  product?: Product;
  saleMode?: 'box' | 'piece' | 'kg' | 'gram' | 'subpiece';
}

export default function POSInvoice() {
  const { t } = useTranslation();
  const { user, showToast, settings } = useAppContext();
  
  const [products, setProducts] = useState<Product[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`products_cache_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/products`;
    const q = collection(db, path);
    return onSnapshot(q, (snap) => {
      const fetchedProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(fetchedProducts);
      localStorage.setItem(`products_cache_${user.uid}`, JSON.stringify(fetchedProducts));
    }, (error) => {
      console.error(error);
    });
  }, [user]);

  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    try {
      const saved = localStorage.getItem('pos_invoice_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('pos_invoice_items', JSON.stringify(items));
  }, [items]);
  const [isCopied, setIsCopied] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const scannerHandler = () => {
      setIsScannerOpen(true);
    };
    window.addEventListener('open-barcode-scanner-pos', scannerHandler);
    return () => window.removeEventListener('open-barcode-scanner-pos', scannerHandler);
  }, []);

  useEffect(() => {
    if (inputText.trim().length > 1) {
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(inputText.toLowerCase()) ||
        p.barcode?.includes(inputText) ||
        p.barcode2?.includes(inputText)
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [inputText, products]);

  const addItem = (product: any) => {
    let initialMode: 'box' | 'kg' | 'piece' | 'gram' | 'subpiece' = 'piece';
    if (product.unit === 'kg') initialMode = 'kg';

    const newItem: InvoiceItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      productId: product.id,
      name: product.name,
      price: product.sellingPrice || 0,
      quantity: 1,
      product: product,
      saleMode: initialMode
    };
    setItems([newItem, ...items]);
    setInputText('');
    setSuggestions([]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const clearAll = () => {
    setItems([]);
  };

  const updateItem = (id: string, field: 'price' | 'quantity' | 'saleMode', value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const calculateItemTotal = (item: InvoiceItem) => {
    const isKgProduct = item.product?.unit === 'kg';
    const subItems = item.product?.subItemsPerPiece || 1;

    if (item.saleMode === 'box' && item.product?.piecesPerBox) {
      return item.price * item.quantity * item.product.piecesPerBox;
    }
    
    if (item.saleMode === 'subpiece') {
      return (item.price / subItems) * item.quantity;
    }
    
    if (item.saleMode === 'gram') {
      if (isKgProduct && subItems > 1) {
        return ((item.price / subItems) / 100) * item.quantity;
      }
      return (item.price / 1000) * item.quantity;
    }
    
    if (item.saleMode === 'kg') {
      if (isKgProduct && subItems > 1) {
        return ((item.price / subItems) * 10) * item.quantity;
      }
      return item.price * item.quantity;
    }
    
    return item.price * item.quantity;
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const generateInvoiceText = () => {
    let text = `*فاتورة مبيعات*\n\n`;
    items.forEach((item) => {
      let quantityText = item.quantity.toString();
      if (item.saleMode === 'gram') quantityText += ' غرام';
      else if (item.saleMode === 'kg') quantityText += ' كغ';
      else if (item.saleMode === 'subpiece') quantityText += ' حبة';
      else if (item.saleMode === 'piece') quantityText += ' قطعة';
      else if (item.saleMode === 'box') quantityText += ' كرتونة';
      else quantityText += '';

      text += `${item.name} - ${quantityText} - ${item.price.toFixed(3)} - ${calculateItemTotal(item).toFixed(3)}\n`;
    });
    text += `\n*المجموع الكلي: ${calculateTotal().toFixed(3)} د.ت*`;
    return text;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateInvoiceText());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(generateInvoiceText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      showToast('جاري تحضير الفاتورة...', 'info');

      let tableHtml = "";
      items.forEach((item, index) => {
        let quantityText = item.quantity.toString();
        if (item.saleMode === 'gram') quantityText += ' غرام';
        else if (item.saleMode === 'kg') quantityText += ' كغ';
        else if (item.saleMode === 'subpiece') quantityText += ' حبة';
        else if (item.saleMode === 'piece') quantityText += ' قطعة';
        else if (item.saleMode === 'box') quantityText += ' كرتونة';

        tableHtml += `
          <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; text-align: right;">${index + 1}</td>
            <td style="padding: 10px; text-align: right;">${item.name}</td>
            <td style="padding: 10px; text-align: center;">${quantityText}</td>
            <td style="padding: 10px; text-align: center;">${item.price.toFixed(3)}</td>
            <td style="padding: 10px; text-align: center; font-weight: 700;">${calculateItemTotal(item).toFixed(3)}</td>
          </tr>
        `;
      });

      const elementHtml = `
      <div style="font-family: 'Inter', system-ui, sans-serif; direction: rtl; padding: 30px; max-width: 800px; margin: 0 auto; color: #0f172a;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 28px; font-weight: 900; color: #0284c7; margin: 0;">فاتورة مبيعات</h1>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f4f4f5; border-radius: 8px;">
              <th style="padding: 12px 10px;text-align: right;font-size: 13px;font-weight: 700;color: #52525b;">#</th>
              <th style="padding: 12px 10px;text-align: right;font-size: 13px;font-weight: 700;color: #52525b;">المنتج</th>
              <th style="padding: 12px 10px;text-align: center;font-size: 13px;font-weight: 700;color: #52525b;">الكمية</th>
              <th style="padding: 12px 10px;text-align: center;font-size: 13px;font-weight: 700;color: #52525b;">السعر (د.ت)</th>
              <th style="padding: 12px 10px;text-align: center;font-size: 13px;font-weight: 700;color: #52525b;">المجموع (د.ت)</th>
            </tr>
          </thead>
          <tbody>
            ${tableHtml}
          </tbody>
        </table>
        
        <div style="display: flex; justify-content: flex-end; padding-top: 20px; border-top: 2px solid #f4f4f5;">
          <div style="background-color: #f0f9ff; padding: 16px 32px; border-radius: 12px; border: 1px solid #e0f2fe; text-align: center;">
            <p style="font-size: 13px; font-weight: 700; color: #0369a1; margin: 0 0 4px 0;">المجموع الكلي</p>
            <p style="font-size: 24px; font-weight: 900; color: #0284c7; margin: 0;">${calculateTotal().toFixed(3)} د.ت</p>
          </div>
        </div>
      </div>
      `;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = elementHtml;
      
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `فاتورة_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // @ts-ignore
      const html2pdfModule: any = html2pdf.default || html2pdf;
      await html2pdfModule().set(opt).from(wrapper.firstElementChild).save();
      
      showToast('تم تحميل الفاتورة بنجاح', 'success');
    } catch (error) {
      console.error(error);
      showToast('حدث خطأ أثناء تحميل الفاتورة', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const [isCompleting, setIsCompleting] = useState(false);

  const handleCompleteSale = async () => {
    if (!user || items.length === 0) return;
    try {
      setIsCompleting(true);
      
      if (settings.posDeductInventory) {
        const batch = writeBatch(db);
        items.forEach(item => {
          const productRef = doc(db, `users/${user.uid}/products`, item.productId);
          const p = products.find(p => p.id === item.productId);
          if (p) {
            batch.update(productRef, {
              quantity: Math.max(0, p.quantity - item.quantity),
              updatedAt: serverTimestamp()
            });
          }
        });
        await batch.commit();
        showToast('تم إتمام البيع وخصم الكميات من المخزون', 'success');
      } else {
        showToast('تم إتمام البيع', 'success');
      }
      
      setItems([]);
      localStorage.removeItem('pos_invoice_items');
    } catch (error) {
      console.error('Error completing sale:', error);
      showToast('حدث خطأ أثناء إتمام البيع', 'error');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleScan = (decodedText: string) => {
    setIsScannerOpen(false);
    
    // Find product matching the scanned barcode
    const matchedProduct = products.find(p => p.barcode === decodedText || p.barcode2 === decodedText);
    
    if (matchedProduct) {
      addItem(matchedProduct);
      showToast('تمت إضافة المنتج بنجاح');
    } else {
      showToast('المنتج غير موجود في قائمة المنتجات');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-24 pt-4 sm:pt-6 px-2 sm:px-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
            <Calculator size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-1">نقاط البيع (POS)</h1>
            <p className="text-xs text-zinc-500 font-medium">إنشاء فاتورة مبيعات للعملاء</p>
          </div>
        </div>
        
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors dark:bg-red-500/10 dark:hover:bg-red-500/20"
          >
            <RotateCcw size={16} />
            <span className="hidden sm:inline">مسح الكل</span>
          </button>
        )}
      </div>

      {/* Input Section */}
      <div className="relative z-30">
        <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500/30 transition-all shadow-sm">
          <div className="flex items-center justify-center pl-2 pr-3 text-zinc-400">
            <Search size={20} />
          </div>
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('search_product_or_barcode') || 'ابحث باسم المنتج أو الباركود...'}
            className="flex-1 h-12 bg-transparent px-2 text-base font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none w-full"
          />
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="p-2 ml-1 text-zinc-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors"
          >
            <ScanBarcode size={24} />
          </button>
        </div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 right-0 top-full z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden mt-2"
            >
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addItem(p)}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-right transition-colors border-b border-zinc-50 dark:border-zinc-800 last:border-0"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{p.name}</span>
                    <span className="text-xs font-medium text-zinc-500">
                      {t('selling_price')} : {(p.boxPurchasePrice || p.purchasePrice || 0).toFixed(3)}
                    </span>
                  </div>
                  <Plus size={18} className="text-brand-500" />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Items List */}
      <div className="space-y-4 mt-6">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
              className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden"
            >
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{item.name}</h3>
              </div>
              
              <div className="p-3 sm:p-4 flex items-end justify-between gap-2 sm:gap-4">
                <div className="flex items-end gap-2 sm:gap-4 flex-1">
                  {/* Price */}
                  <div className="flex-[1.2]">
                    <label className="block text-[10px] sm:text-xs font-bold text-zinc-400 mb-1 truncate">{t('selling_price')} </label>
                    <input
                      type="number"
                      step="any"
                      value={item.price || ''}
                      onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value.replace(',', '.')) || 0)}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg py-2 px-1 sm:px-3 text-sm sm:text-base font-bold text-zinc-900 dark:text-white text-center focus:ring-2 focus:ring-brand-500 h-10"
                    />
                  </div>
                  {/* Quantity */}
                  <div className="flex-[1.5]">
                    <div className="flex flex-col gap-1 mb-1 justify-end min-h-[24px]">
                      <label className="text-[10px] sm:text-xs font-bold text-zinc-400 truncate">{t('quantity')}</label>
                      <div className="flex gap-1 flex-wrap justify-start">
                        {(item.product?.piecesPerBox || 0) > 1 && (
                          <button onClick={() => updateItem(item.id, 'saleMode', 'box')} className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${item.saleMode === 'box' ? 'bg-brand-500 text-white font-bold shadow-sm' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'}`}>كرتونة</button>
                        )}
                        {item.product?.unit !== 'kg' && (
                          <button onClick={() => updateItem(item.id, 'saleMode', 'piece')} className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${item.saleMode === 'piece' || (!['box', 'subpiece', 'gram', 'kg'].includes(item.saleMode || '')) ? 'bg-brand-500 text-white font-bold shadow-sm' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'}`}>قطعة</button>
                        )}
                        {item.product?.unit === 'kg' && (
                          <>
                            <button onClick={() => updateItem(item.id, 'saleMode', 'kg')} className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${item.saleMode === 'kg' || (!['box', 'subpiece', 'gram', 'piece'].includes(item.saleMode || '')) ? 'bg-brand-500 text-white font-bold shadow-sm' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'}`}>كغ</button>
                            <button onClick={() => updateItem(item.id, 'saleMode', 'gram')} className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${item.saleMode === 'gram' ? 'bg-brand-500 text-white font-bold shadow-sm' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'}`}>غرام</button>
                          </>
                        )}
                        {item.product?.unit !== 'kg' && (item.product?.subItemsPerPiece || 0) > 1 && (
                          <button onClick={() => updateItem(item.id, 'saleMode', 'subpiece')} className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${item.saleMode === 'subpiece' ? 'bg-brand-500 text-white font-bold shadow-sm' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'}`}>حبة</button>
                        )}
                      </div>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value.replace(',', '.')) || 0)}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg py-2 px-1 sm:px-3 text-sm sm:text-base font-bold text-zinc-900 dark:text-white text-center focus:ring-2 focus:ring-brand-500 h-10"
                    />
                  </div>
                  {/* Total */}
                  <div className="flex-[1.2] text-left pl-1 sm:pl-2">
                    <label className="block text-[10px] sm:text-xs font-bold text-zinc-400 mb-1 truncate min-h-[24px]">المجموع</label>
                    <div className="text-sm sm:text-base font-black text-brand-600 dark:text-brand-400 truncate flex items-center justify-end h-10">
                      {calculateItemTotal(item).toFixed(3)}
                    </div>
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors self-end mb-[2px]"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center justify-center opacity-50">
            <Calculator size={48} className="text-zinc-300 mb-4" strokeWidth={1} />
            <p className="text-zinc-500 font-medium">ابدأ بالبحث عن منتجات لإضافتها</p>
          </div>
        )}
      </div>

      {/* Total Card */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-6 block"
          >
            <div className="bg-brand-600 text-white rounded-lg p-4 shadow-2xl flex flex-col gap-3 border-2 border-brand-500/50 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-brand-200 text-sm font-bold mb-1">المجموع الكلي</span>
                  <span className="text-xs text-brand-300 opacity-80">{items.length} منتجات مضافة</span>
                </div>
                <div className="text-3xl font-black">
                  {calculateTotal().toFixed(3)} <span className="text-lg text-brand-200 ml-1">د.ت</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-2 border-t border-brand-500/30">
                <button
                  onClick={handleCopy}
                  className="flex-[1.5] flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 py-2.5 rounded-lg transition-colors font-bold text-sm"
                >
                  {isCopied ? <CheckCheck size={18} /> : <Copy size={18} />}
                  <span className="hidden sm:inline">{isCopied ? 'تم النسخ' : 'نسخ'}</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="flex-[1.5] flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 py-2.5 rounded-lg transition-colors font-bold text-sm disabled:opacity-50"
                >
                  {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
                  <span className="hidden sm:inline">PDF</span>
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="flex-[2] flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] active:bg-[#1da851] py-2.5 rounded-lg transition-colors font-bold text-sm"
                >
                  <MessageCircle size={18} />
                  <span>شارك عبر واتساب</span>
                </button>
              </div>

              <button
                onClick={handleCompleteSale}
                disabled={isCompleting}
                className="w-full flex items-center justify-center gap-2 bg-white text-brand-600 hover:bg-zinc-50 active:bg-zinc-100 py-3 rounded-xl transition-colors font-black text-lg shadow-sm mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isCompleting ? <Loader2 size={24} className="animate-spin" /> : <CheckCheck size={24} />}
                <span>إتمام البيع</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  );
}

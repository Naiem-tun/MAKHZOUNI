import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calculator,
  Trash2,
  ScanBarcode,
  Plus,
  Search,
  Copy,
  CheckCheck,
  MessageCircle,
  RotateCcw,
  FileDown,
  Loader2,
} from 'lucide-react';
import * as html2pdf from 'html2pdf.js';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import { useFolioTheme } from '../components/folio/FolioPageChrome';

interface InvoiceItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  product?: Product;
  saleMode?: 'box' | 'piece' | 'kg' | 'gram' | 'subpiece';
}

export default function InvoiceCalculator() {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

  const [products, setProducts] = useState<Product[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`products_cache_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/products`;
    const q = collection(db, path);
    return onSnapshot(
      q,
      (snap) => {
        const fetchedProducts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(fetchedProducts);
        localStorage.setItem(`products_cache_${user.uid}`, JSON.stringify(fetchedProducts));
      },
      (error) => {
        console.error(error);
      },
    );
  }, [user]);

  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    try {
      const saved = localStorage.getItem('invoice_calculator_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('invoice_calculator_items', JSON.stringify(items));
  }, [items]);

  const [isCopied, setIsCopied] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const scannerHandler = () => {
      setIsScannerOpen(true);
    };
    window.addEventListener('open-barcode-scanner-invoice-calculator', scannerHandler);
    return () => window.removeEventListener('open-barcode-scanner-invoice-calculator', scannerHandler);
  }, []);

  useEffect(() => {
    if (inputText.trim().length > 1) {
      const filtered = products
        .filter(
          (p) =>
            (p.name || '').toLowerCase().includes((inputText || '').toLowerCase()) ||
            p.barcode?.includes(inputText) ||
            p.barcode2?.includes(inputText),
        )
        .slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [inputText, products]);

  const addItem = (product: any) => {
    let initialMode: 'box' | 'kg' | 'piece' | 'gram' | 'subpiece' = 'piece';
    if (product.unit === 'kg') initialMode = 'kg';
    else if ((product.piecesPerBox || 0) > 1) initialMode = 'box';

    const newItem: InvoiceItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      productId: product.id,
      name: product.name,
      price:
        initialMode === 'box'
          ? product.boxPurchasePrice || product.purchasePrice || 0
          : product.purchasePrice || 0,
      quantity: 1,
      product,
      saleMode: initialMode,
    };
    setItems([newItem, ...items]);
    setInputText('');
    setSuggestions([]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    setItems([]);
  };

  const updateItem = (id: string, field: 'price' | 'quantity' | 'saleMode', value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          if (field === 'saleMode' && item.product) {
            let newPrice = item.price;
            if (value === 'box') {
              newPrice =
                item.product.boxPurchasePrice ||
                item.product.purchasePrice * (item.product.piecesPerBox || 1) ||
                0;
            } else if (value === 'piece' || value === 'kg' || value === 'gram' || value === 'subpiece') {
              newPrice = item.product.purchasePrice || 0;
            }
            return { ...item, saleMode: value, price: newPrice };
          }
          return { ...item, [field]: value };
        }
        return item;
      }),
    );
  };

  const calculateItemTotal = (item: InvoiceItem) => {
    const isKgProduct = item.product?.unit === 'kg';
    const subItems = item.product?.subItemsPerPiece || 1;

    if (item.saleMode === 'box') {
      return item.price * item.quantity;
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
    let text = `*فاتورة مشتريات*\n\n`;
    items.forEach((item) => {
      let quantityText = item.quantity.toString();
      if (item.saleMode === 'gram') quantityText += ' غرام';
      else if (item.saleMode === 'kg') quantityText += ' كغ';
      else if (item.saleMode === 'subpiece') quantityText += ' حبة';
      else if (item.saleMode === 'piece') quantityText += ' قطعة';
      else if (item.saleMode === 'box') quantityText += ' كرتونة';

      text += `🔹 الصنف: ${item.name}\n   الكمية: ${quantityText} | السعر: ${item.price.toFixed(3)} | المجموع: ${calculateItemTotal(item).toFixed(3)}\n\n`;
    });
    text += `*المجموع الكلي: ${calculateTotal().toFixed(3)} د.ت*`;
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

      let tableHtml = '';
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

      const invoiceId = Math.floor(100000 + Math.random() * 900000).toString();
      const currentDate = new Date().toLocaleDateString('ar-TN', { year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = new Date().toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' });

      const elementHtml = `
      <div style="font-family: 'Inter', system-ui, sans-serif; direction: rtl; padding: 40px; max-width: 800px; margin: 0 auto; color: #0f172a; background-color: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 30px;">
          <div style="flex: 1;">
            ${settings?.receiptLogo ? `<img src="${settings.receiptLogo}" style="max-width: 120px; max-height: 80px; margin-bottom: 15px; border-radius: 8px; object-fit: contain;" onerror="this.style.display='none'" />` : ''}
            <h1 style="font-size: 24px; font-weight: 900; color: #0f172a; margin: 0 0 8px 0;">${settings?.storeName || 'فاتورة مبيعات'}</h1>
            <p style="font-size: 13px; color: #64748b; margin: 0;">شكراً لزيارتكم تسعدنا خدمتكم</p>
          </div>
          <div style="text-align: left; background-color: #f8fafc; padding: 15px 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <div style="margin-bottom: 8px;">
              <span style="font-size: 12px; color: #64748b; font-weight: 600;">رقم الفاتورة</span>
              <div style="font-size: 16px; font-weight: 800; color: #0284c7; font-family: monospace;">#INV-${invoiceId}</div>
            </div>
            <div style="display: flex; gap: 15px; margin-top: 10px;">
              <div>
                <span style="font-size: 11px; color: #64748b; display: block; margin-bottom: 2px;">التاريخ</span>
                <span style="font-size: 13px; font-weight: 600; color: #334155;">${currentDate}</span>
              </div>
              <div>
                <span style="font-size: 11px; color: #64748b; display: block; margin-bottom: 2px;">الوقت</span>
                <span style="font-size: 13px; font-weight: 600; color: #334155;">${currentTime}</span>
              </div>
            </div>
          </div>
        </div>
        <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 40px;">
          <thead>
            <tr>
              <th style="padding: 12px 15px; text-align: right; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">#</th>
              <th style="padding: 12px 15px; text-align: right; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">المنتج</th>
              <th style="padding: 12px 15px; text-align: center; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">الكمية</th>
              <th style="padding: 12px 15px; text-align: center; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">سعر الوحدة</th>
              <th style="padding: 12px 15px; text-align: center; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">المجموع</th>
            </tr>
          </thead>
          <tbody>${tableHtml}</tbody>
        </table>
        <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
          <div style="width: 300px;">
            <div style="display: flex; justify-content: space-between; padding: 12px 15px; border-bottom: 1px solid #f1f5f9;">
              <span style="font-size: 14px; color: #64748b; font-weight: 500;">المجموع الفرعي</span>
              <span style="font-size: 14px; color: #334155; font-weight: 600;">${calculateTotal().toFixed(3)} د.ت</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 15px; background-color: #f8fafc; border-radius: 8px; margin-top: 15px; border: 1px solid #e2e8f0;">
              <span style="font-size: 16px; color: #0f172a; font-weight: 800;">المبلغ الإجمالي</span>
              <span style="font-size: 20px; color: #0284c7; font-weight: 900;">${calculateTotal().toFixed(3)} د.ت</span>
            </div>
          </div>
        </div>
        ${
          settings?.receiptThankYouMessage || settings?.receiptPolicy
            ? `<div style="padding-top: 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                ${settings?.receiptThankYouMessage ? `<p style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">${settings.receiptThankYouMessage}</p>` : ''}
                ${settings?.receiptPolicy ? `<p style="font-size: 12px; color: #64748b; margin: 0; white-space: pre-wrap; line-height: 1.6; max-width: 600px; margin: 0 auto;">${settings.receiptPolicy}</p>` : ''}
              </div>`
            : ''
        }
      </div>
      `;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = elementHtml;

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `فاتورة_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
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

  const handleScan = (decodedText: string) => {
    setIsScannerOpen(false);
    const matchedProduct = products.find((p) => p.barcode === decodedText || p.barcode2 === decodedText);

    if (matchedProduct) {
      addItem(matchedProduct);
      showToast('تمت إضافة المنتج بنجاح');
    } else {
      showToast('المنتج غير موجود في قائمة المنتجات');
    }
  };

  return (
    <div
      className="max-w-3xl mx-auto space-y-5 pb-24 pt-4 sm:pt-6"
      style={{ color: theme.text }}
      dir="rtl"
    >
      {/* Editorial Header */}
      <header
        className="flex items-end justify-between gap-4 pb-4 border-b"
        style={{ borderColor: theme.border }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
              01
            </span>
            <span className="tracking-wider uppercase font-mono" style={{ color: theme.textMuted }}>
              CALCULATOR · PURCHASES
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t('invoice_calculator')}</h1>
          <p className="text-xs sm:text-sm" style={{ color: theme.textMuted }}>
            {t('invoice_desc')}
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-colors cursor-pointer"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.negative,
            }}
          >
            <RotateCcw size={14} />
            <span>مسح الكل</span>
          </button>
        )}
      </header>

      {/* Search Bar & Autocomplete */}
      <div className="relative z-30">
        <div
          className="flex items-center border p-1 transition-colors"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex items-center justify-center px-3" style={{ color: theme.textMuted }}>
            <Search size={18} />
          </div>
          <input
            type="search"
            name="calculator_search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('search_product_or_barcode') || 'ابحث باسم المنتج أو الباركود...'}
            className="flex-1 h-11 bg-transparent px-2 text-sm sm:text-base font-medium outline-none w-full"
            style={{ color: theme.text }}
          />
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="p-2.5 ml-1 border transition-colors cursor-pointer"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.text,
            }}
          >
            <ScanBarcode size={20} />
          </button>
        </div>

        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute left-0 right-0 top-full z-50 border overflow-hidden mt-1 shadow-lg"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItem(p)}
                  className="w-full flex items-center justify-between p-3.5 text-right border-b last:border-0 transition-colors cursor-pointer"
                  style={{ borderColor: theme.border }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold">{p.name}</span>
                    <span className="text-xs font-mono tabular-nums" style={{ color: theme.textMuted }}>
                      {t('purchase_price')}: {(p.boxPurchasePrice || p.purchasePrice || 0).toFixed(3)}
                    </span>
                  </div>
                  <Plus size={18} style={{ color: theme.accent }} />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              layout
              className="border overflow-hidden"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div
                className="px-4 py-2.5 border-b flex items-center justify-between"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
              >
                <h3 className="font-bold text-sm sm:text-base">{item.name}</h3>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 transition-colors cursor-pointer"
                  style={{ color: theme.negative }}
                  title="حذف"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="p-3 sm:p-4 grid grid-cols-12 items-end gap-2 sm:gap-3">
                {/* Price */}
                <div className="col-span-4">
                  <label className="block text-[11px] font-bold mb-1 truncate" style={{ color: theme.textMuted }}>
                    {t('purchase_price')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    autoComplete="off"
                    autoCorrect="off"
                    data-lpignore="true"
                    data-form-type="other"
                    value={item.price || ''}
                    onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value.replace(',', '.')) || 0)}
                    className="w-full border py-2 px-2 text-sm font-mono font-bold text-center outline-none h-10"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  />
                </div>

                {/* Quantity & SaleMode */}
                <div className="col-span-5">
                  <div className="flex flex-col gap-1 mb-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
                        {t('quantity')}
                      </label>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-start">
                      {(item.product?.piecesPerBox || 0) > 1 && (
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, 'saleMode', 'box')}
                          className="text-[10px] px-1.5 py-0.5 border font-bold cursor-pointer"
                          style={{
                            backgroundColor: item.saleMode === 'box' ? theme.text : theme.surfaceMuted,
                            color: item.saleMode === 'box' ? theme.surface : theme.textMuted,
                            borderColor: item.saleMode === 'box' ? theme.text : theme.border,
                          }}
                        >
                          كرتونة
                        </button>
                      )}
                      {item.product?.unit !== 'kg' && (
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, 'saleMode', 'piece')}
                          className="text-[10px] px-1.5 py-0.5 border font-bold cursor-pointer"
                          style={{
                            backgroundColor:
                              item.saleMode === 'piece' || !['box', 'subpiece', 'gram', 'kg'].includes(item.saleMode || '')
                                ? theme.text
                                : theme.surfaceMuted,
                            color:
                              item.saleMode === 'piece' || !['box', 'subpiece', 'gram', 'kg'].includes(item.saleMode || '')
                                ? theme.surface
                                : theme.textMuted,
                            borderColor:
                              item.saleMode === 'piece' || !['box', 'subpiece', 'gram', 'kg'].includes(item.saleMode || '')
                                ? theme.text
                                : theme.border,
                          }}
                        >
                          قطعة
                        </button>
                      )}
                      {item.product?.unit === 'kg' && (
                        <>
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, 'saleMode', 'kg')}
                            className="text-[10px] px-1.5 py-0.5 border font-bold cursor-pointer"
                            style={{
                              backgroundColor:
                                item.saleMode === 'kg' || !['box', 'subpiece', 'gram', 'piece'].includes(item.saleMode || '')
                                  ? theme.text
                                  : theme.surfaceMuted,
                              color:
                                item.saleMode === 'kg' || !['box', 'subpiece', 'gram', 'piece'].includes(item.saleMode || '')
                                  ? theme.surface
                                  : theme.textMuted,
                              borderColor:
                                item.saleMode === 'kg' || !['box', 'subpiece', 'gram', 'piece'].includes(item.saleMode || '')
                                  ? theme.text
                                  : theme.border,
                            }}
                          >
                            كغ
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, 'saleMode', 'gram')}
                            className="text-[10px] px-1.5 py-0.5 border font-bold cursor-pointer"
                            style={{
                              backgroundColor: item.saleMode === 'gram' ? theme.text : theme.surfaceMuted,
                              color: item.saleMode === 'gram' ? theme.surface : theme.textMuted,
                              borderColor: item.saleMode === 'gram' ? theme.text : theme.border,
                            }}
                          >
                            غرام
                          </button>
                        </>
                      )}
                      {item.product?.unit !== 'kg' && (item.product?.subItemsPerPiece || 0) > 1 && (
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, 'saleMode', 'subpiece')}
                          className="text-[10px] px-1.5 py-0.5 border font-bold cursor-pointer"
                          style={{
                            backgroundColor: item.saleMode === 'subpiece' ? theme.text : theme.surfaceMuted,
                            color: item.saleMode === 'subpiece' ? theme.surface : theme.textMuted,
                            borderColor: item.saleMode === 'subpiece' ? theme.text : theme.border,
                          }}
                        >
                          حبة
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    autoComplete="off"
                    autoCorrect="off"
                    data-lpignore="true"
                    data-form-type="other"
                    value={item.quantity || ''}
                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value.replace(',', '.')) || 0)}
                    className="w-full border py-2 px-2 text-sm font-mono font-bold text-center outline-none h-10"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  />
                </div>

                {/* Line Total */}
                <div className="col-span-3 text-left">
                  <label className="block text-[11px] font-bold mb-1 truncate" style={{ color: theme.textMuted }}>
                    المجموع
                  </label>
                  <div
                    className="h-10 px-2 border flex items-center justify-end font-mono font-black text-sm tabular-nums truncate"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.accent,
                    }}
                  >
                    {calculateItemTotal(item).toFixed(3)}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div
            className="text-center py-14 border flex flex-col items-center justify-center"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <Calculator size={38} className="mb-3 opacity-35" strokeWidth={1.2} />
            <p className="text-sm font-bold" style={{ color: theme.textMuted }}>
              ابدأ بالبحث عن منتجات لإضافتها
            </p>
          </div>
        )}
      </div>

      {/* Editorial Totals & Actions Bar */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="border p-4 space-y-4"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div
              className="flex items-center justify-between pb-3 border-b"
              style={{ borderColor: theme.border }}
            >
              <div>
                <span className="block text-xs font-bold mb-0.5" style={{ color: theme.textMuted }}>
                  المجموع الكلي
                </span>
                <span className="text-[11px] font-mono" style={{ color: theme.textMuted }}>
                  {items.length} منتجات مضافة
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums" dir="ltr" style={{ color: theme.accent }}>
                {calculateTotal().toFixed(3)} <span className="text-sm">د.ت</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 py-2.5 border text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text,
                }}
              >
                {isCopied ? <CheckCheck size={16} /> : <Copy size={16} />}
                <span>{isCopied ? 'تم النسخ' : 'نسخ'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center justify-center gap-1.5 py-2.5 border text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text,
                }}
              >
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsApp}
                className="flex items-center justify-center gap-1.5 py-2.5 border text-xs sm:text-sm font-bold text-white transition-colors cursor-pointer"
                style={{
                  backgroundColor: theme.positive,
                  borderColor: theme.positive,
                }}
              >
                <MessageCircle size={16} />
                <span>واتساب</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
        tabId="invoice-calculator"
      />
    </div>
  );
}

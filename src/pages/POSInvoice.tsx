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
  Pause,
  List,
  Printer,
  X,
} from 'lucide-react';
import * as html2pdf from 'html2pdf.js';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { forceStopAllCameras, BarcodeScanner } from '../components/common/BarcodeScanner';
import { Product } from '../types';
import { cleanQuantity, roundMoney } from '../lib/utils';
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

export default function POSInvoice() {
  const { t } = useTranslation();
  const { user, showToast, settings } = useAppContext();
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
      const saved = localStorage.getItem('pos_invoice_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('pos_invoice_items', JSON.stringify(items));
  }, [items]);

  const [heldInvoices, setHeldInvoices] = useState<{ id: string; items: InvoiceItem[]; time: number }[]>(() => {
    try {
      const saved = localStorage.getItem('pos_held_invoices');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('pos_held_invoices', JSON.stringify(heldInvoices));
  }, [heldInvoices]);

  const [showHeldInvoices, setShowHeldInvoices] = useState(false);

  const holdCurrentInvoice = () => {
    if (items.length === 0) return;
    setHeldInvoices((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(7), items: [...items], time: Date.now() },
    ]);
    setItems([]);
    showToast('تم تعليق الفاتورة بنجاح', 'success');
  };

  const resumeInvoice = (id: string) => {
    const invoiceToResume = heldInvoices.find((h) => h.id === id);
    if (!invoiceToResume) return;

    if (items.length > 0) {
      setHeldInvoices((prev) => [
        ...prev.filter((h) => h.id !== id),
        { id: Math.random().toString(36).substring(7), items: [...items], time: Date.now() },
      ]);
    } else {
      setHeldInvoices((prev) => prev.filter((h) => h.id !== id));
    }

    setItems(invoiceToResume.items);
    setShowHeldInvoices(false);
    showToast('تم استعادة الفاتورة', 'success');
  };

  const [isCopied, setIsCopied] = useState(false);
  const [isInlineScannerOpen, setIsInlineScannerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showReceiptPreviewModal, setShowReceiptPreviewModal] = useState(false);

  useEffect(() => {
    const scannerHandler = () => {
      setIsInlineScannerOpen(true);
    };
    window.addEventListener('open-barcode-scanner-pos', scannerHandler);
    return () => {
      window.removeEventListener('open-barcode-scanner-pos', scannerHandler);
      forceStopAllCameras();
    };
  }, []);

  useEffect(() => {
    if (inputText.trim().length > 1) {
      const filtered = products
        .filter(
          (p) =>
            (p.name || '').toLowerCase().includes((inputText || '').toLowerCase()) ||
            p.barcode?.includes(inputText) ||
            p.barcode2?.includes(inputText) ||
            (p.aliases || []).some((a) => (a || '').toLowerCase().includes((inputText || '').toLowerCase())),
        )
        .slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [inputText, products]);

  const calculateDeductedPieces = (p: any, quantity: number, saleMode?: string): number => {
    if (!p || !quantity) return 0;
    const isKgProduct = p.unit === 'kg';
    const subItems = p.subItemsPerPiece || 1;
    const q = cleanQuantity(quantity);

    if (saleMode === 'box' && p.piecesPerBox) {
      return cleanQuantity(q * p.piecesPerBox);
    } else if (saleMode === 'subpiece') {
      return cleanQuantity(q / subItems);
    } else if (saleMode === 'gram') {
      if (isKgProduct && subItems > 1) {
        return cleanQuantity((q / subItems) / 100);
      } else {
        return cleanQuantity(q / 1000);
      }
    } else if (saleMode === 'kg') {
      if (isKgProduct && subItems > 1) {
        return cleanQuantity((q / subItems) * 10);
      } else {
        return cleanQuantity(q);
      }
    }
    return cleanQuantity(q);
  };

  const getMaxAvailableInMode = (
    p: any,
    saleMode?: string,
    excludeItemId?: string,
    currentCartItems: InvoiceItem[] = [],
  ): number => {
    if (!p) return 0;
    const totalStock = cleanQuantity(
      settings.posDeductInventory === false
        ? p.posQuantity !== undefined
          ? p.posQuantity
          : p.quantity
        : p.quantity !== undefined
        ? p.quantity
        : p.posQuantity || 0,
    );
    if (totalStock <= 0) return 0;

    const otherItems = currentCartItems.filter((it) => it.productId === p.id && it.id !== excludeItemId);
    const alreadyUsed = otherItems.reduce((sum, it) => sum + calculateDeductedPieces(p, it.quantity, it.saleMode), 0);

    const remaining = Math.max(0, cleanQuantity(totalStock - alreadyUsed));
    if (remaining <= 0) return 0;

    const isKgProduct = p.unit === 'kg';
    const subItems = p.subItemsPerPiece || 1;

    if (saleMode === 'box') {
      const piecesPerBox = p.piecesPerBox || 1;
      return Math.floor(remaining / piecesPerBox);
    }
    if (saleMode === 'subpiece') {
      return cleanQuantity(remaining * subItems);
    }
    if (saleMode === 'gram') {
      if (isKgProduct && subItems > 1) {
        return cleanQuantity(remaining * subItems * 100);
      }
      return cleanQuantity(remaining * 1000);
    }
    if (saleMode === 'kg') {
      if (isKgProduct && subItems > 1) {
        return cleanQuantity((remaining * subItems) / 10);
      }
      return cleanQuantity(remaining);
    }
    return cleanQuantity(remaining);
  };

  const addItem = (product: any) => {
    let initialMode: 'box' | 'kg' | 'piece' | 'gram' | 'subpiece' = 'piece';
    if (product.unit === 'kg') initialMode = 'kg';

    const maxAvailable = getMaxAvailableInMode(product, initialMode, undefined, items);
    if (maxAvailable <= 0) {
      showToast(`المنتج "${product.name}" غير متوفر في المخزون (الكمية المتبقية: 0)`, 'error');
      return;
    }

    const existingIndex = items.findIndex((it) => it.productId === product.id && it.saleMode === initialMode);
    if (existingIndex > -1) {
      const existingItem = items[existingIndex];
      const newQty = cleanQuantity(existingItem.quantity + 1);
      if (newQty > maxAvailable) {
        showToast(`لا يمكن زيادة الكمية: أقصى كمية متوفرة في المخزون هي ${maxAvailable}`, 'error');
        return;
      }
      const updatedItems = [...items];
      updatedItems[existingIndex] = { ...existingItem, quantity: newQty };
      setItems(updatedItems);
      setInputText('');
      setSuggestions([]);
      return;
    }

    const newItem: InvoiceItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      productId: product.id,
      name: product.name,
      price: product.sellingPrice || 0,
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
          const p = products.find((prod) => prod.id === item.productId) || item.product;
          if (field === 'quantity') {
            let numVal = Math.max(0, cleanQuantity(value));
            if (p) {
              const maxVal = getMaxAvailableInMode(p, item.saleMode, item.id, items);
              if (numVal > maxVal) {
                showToast(`الكمية المطلوبة (${numVal}) أكبر من المتوفر في المخزون (${maxVal})`, 'error');
                numVal = maxVal;
              }
            }
            return { ...item, quantity: numVal };
          } else if (field === 'saleMode') {
            const newMode = value;
            let currentQty = item.quantity;
            if (p) {
              const maxVal = getMaxAvailableInMode(p, newMode, item.id, items);
              if (currentQty > maxVal) {
                currentQty = maxVal > 0 ? (maxVal >= 1 ? 1 : maxVal) : 0;
                showToast(`تم تعديل الكمية إلى (${currentQty}) لتناسب المخزون المتاح (${maxVal})`, 'info');
              }
            }
            return { ...item, saleMode: newMode, quantity: currentQty };
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

    if (item.saleMode === 'box' && item.product?.piecesPerBox) {
      return roundMoney(item.price * item.quantity * item.product.piecesPerBox);
    }
    if (item.saleMode === 'subpiece') {
      return roundMoney((item.price / subItems) * item.quantity);
    }
    if (item.saleMode === 'gram') {
      if (isKgProduct && subItems > 1) {
        return roundMoney(((item.price / subItems) / 100) * item.quantity);
      }
      return roundMoney((item.price / 1000) * item.quantity);
    }
    if (item.saleMode === 'kg') {
      if (isKgProduct && subItems > 1) {
        return roundMoney(((item.price / subItems) * 10) * item.quantity);
      }
      return roundMoney(item.price * item.quantity);
    }
    return roundMoney(item.price * item.quantity);
  };

  const calculateTotal = () => {
    return roundMoney(items.reduce((sum, item) => sum + calculateItemTotal(item), 0));
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

  const handlePrint = () => {
    try {
      const paperSize = settings?.receiptPaperSize || '80mm';
      const is58mm = paperSize === '58mm';

      const invoiceId = Math.floor(100000 + Math.random() * 900000).toString();
      const currentDate = new Date().toLocaleDateString('ar-TN', { year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = new Date().toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' });

      let itemsHtml = '';
      items.forEach((item) => {
        let quantityText = item.quantity.toString();
        if (item.saleMode === 'gram') quantityText += ' غرام';
        else if (item.saleMode === 'kg') quantityText += ' كغ';
        else if (item.saleMode === 'subpiece') quantityText += ' حبة';
        else if (item.saleMode === 'piece') quantityText += ' قطعة';
        else if (item.saleMode === 'box') quantityText += ' كرتونة';

        itemsHtml += `
          <tr style="border-bottom: 1px dashed #cccccc;">
            <td style="padding: 6px 0; text-align: right; max-width: ${is58mm ? '120px' : '180px'}; word-wrap: break-word;">${item.name}</td>
            <td style="padding: 6px 0; text-align: center; white-space: nowrap;">${quantityText}</td>
            <td style="padding: 6px 0; text-align: left; white-space: nowrap;">${calculateItemTotal(item).toFixed(3)}</td>
          </tr>
        `;
      });

      const receiptHtml = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>فاتورة البيع</title>
          <style>
            @page { size: ${is58mm ? '58mm' : '80mm'} auto; margin: 0; }
            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              width: ${is58mm ? '48mm' : '72mm'};
              margin: 0 auto;
              padding: ${is58mm ? '2mm' : '4mm'} 0;
              font-size: ${is58mm ? '11px' : '13px'};
              line-height: 1.4;
              color: #000000;
              background-color: #ffffff;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .store-name { font-size: ${is58mm ? '16px' : '20px'}; font-weight: 900; margin-bottom: 4px; }
            .divider { border-top: 1px dashed #000000; margin: 10px 0; }
            .info-table, .items-table { width: 100%; border-collapse: collapse; }
            .info-table td { padding: 2px 0; font-size: ${is58mm ? '10px' : '11px'}; }
            .items-table th { border-bottom: 1px dashed #000000; padding: 5px 0; font-weight: bold; }
            .totals-container { margin-top: 10px; font-size: ${is58mm ? '12px' : '14px'}; }
            .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
            .total-amount { font-size: ${is58mm ? '15px' : '18px'}; font-weight: 900; border-top: 1px solid #000000; padding-top: 6px; margin-top: 4px; }
            .footer-msg { font-size: ${is58mm ? '10px' : '11px'}; margin-top: 15px; text-align: center; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="center">
            ${settings?.receiptLogo ? `<img src="${settings.receiptLogo}" style="max-width: ${is58mm ? '50px' : '80px'}; max-height: 50px; margin-bottom: 8px; object-fit: contain;" />` : ''}
            <div class="store-name">${settings?.storeName || 'مخزوني'}</div>
            <div style="font-size: ${is58mm ? '9px' : '11px'}; opacity: 0.8;">شكراً لزيارتكم تسعدنا خدمتكم</div>
          </div>
          <div class="divider"></div>
          <table class="info-table">
            <tr><td class="bold">رقم الفاتورة:</td><td style="text-align: left; font-family: monospace;">#INV-${invoiceId}</td></tr>
            <tr><td>التاريخ:</td><td style="text-align: left;">${currentDate}</td></tr>
            <tr><td>الوقت:</td><td style="text-align: left;">${currentTime}</td></tr>
          </table>
          <div class="divider"></div>
          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: right;">المنتج</th>
                <th style="text-align: center; width: 60px;">الكمية</th>
                <th style="text-align: left; width: 60px;">المجموع</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="totals-container">
            <div class="totals-row"><span>المجموع الكلي:</span><span class="bold">${calculateTotal().toFixed(3)} د.ت</span></div>
            <div class="totals-row total-amount"><span>المبلغ المدفوع:</span><span>${calculateTotal().toFixed(3)} د.ت</span></div>
          </div>
          ${
            settings?.receiptThankYouMessage || settings?.receiptPolicy
              ? `<div class="divider"></div><div class="footer-msg">
                  ${settings?.receiptThankYouMessage ? `<div class="bold" style="margin-bottom: 5px;">${settings.receiptThankYouMessage}</div>` : ''}
                  ${settings?.receiptPolicy ? `<div>${settings.receiptPolicy}</div>` : ''}
                </div>`
              : ''
          }
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
        </html>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(receiptHtml);
        iframeDoc.close();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 3000);
      } else {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(receiptHtml);
          printWindow.document.close();
        } else {
          showToast('يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة', 'error');
        }
      }
    } catch (err) {
      console.error('Failed to print: ', err);
      showToast('حدث خطأ أثناء محاولة الطباعة', 'error');
    }
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

  const [isCompleting, setIsCompleting] = useState(false);
  const [deductInventory, setDeductInventory] = useState(settings.posDeductInventory ?? true);

  const handleCompleteSale = async () => {
    if (!user || items.length === 0) return;
    try {
      setIsCompleting(true);

      if (deductInventory) {
        for (const item of items) {
          const p = products.find((prod) => prod.id === item.productId);
          if (p) {
            const availableStock = cleanQuantity(
              settings.posDeductInventory === false
                ? p.posQuantity !== undefined
                  ? p.posQuantity
                  : p.quantity
                : p.quantity !== undefined
                ? p.quantity
                : p.posQuantity || 0,
            );
            const reqDeduct = calculateDeductedPieces(p, item.quantity, item.saleMode);
            if (reqDeduct > availableStock) {
              showToast(
                `لا يمكن إتمام البيع: الكمية المطلوبة للمنتج "${item.name}" تتجاوز المتوفر في المخزون (${availableStock})`,
                'error',
              );
              setIsCompleting(false);
              return;
            }
          }
        }
      }

      const batch = writeBatch(db);
      const invoiceRef = doc(collection(db, `users/${user.uid}/invoices`));

      let totalAmount = 0;
      let totalCost = 0;
      const invoiceItems = items.map((item) => {
        const p = products.find((prod) => prod.id === item.productId);
        const itemTotal = roundMoney(calculateItemTotal(item));

        let itemCost = 0;
        let unitCost = 0;
        if (p) {
          unitCost = roundMoney(p.purchasePrice || p.costPrice || 0);
          const isKgProduct = p.unit === 'kg';
          const subItems = p.subItemsPerPiece || 1;

          if (item.saleMode === 'box' && p.piecesPerBox) {
            itemCost = roundMoney((p.boxPurchasePrice || unitCost * p.piecesPerBox) * item.quantity);
          } else if (item.saleMode === 'subpiece') {
            itemCost = roundMoney((unitCost / subItems) * item.quantity);
          } else if (item.saleMode === 'gram') {
            if (isKgProduct && subItems > 1) {
              itemCost = roundMoney(((unitCost / subItems) / 100) * item.quantity);
            } else {
              itemCost = roundMoney((unitCost / 1000) * item.quantity);
            }
          } else if (item.saleMode === 'kg') {
            if (isKgProduct && subItems > 1) {
              itemCost = roundMoney(((unitCost / subItems) * 10) * item.quantity);
            } else {
              itemCost = roundMoney(unitCost * item.quantity);
            }
          } else {
            itemCost = roundMoney(unitCost * item.quantity);
          }
        }

        let actualDeductQty = cleanQuantity(item.quantity);
        if (p) {
          const isKgProduct = p.unit === 'kg';
          const subItems = p.subItemsPerPiece || 1;
          if (item.saleMode === 'box' && p.piecesPerBox) {
            actualDeductQty = cleanQuantity(item.quantity * p.piecesPerBox);
          } else if (item.saleMode === 'subpiece') {
            actualDeductQty = cleanQuantity(item.quantity / subItems);
          } else if (item.saleMode === 'gram') {
            if (isKgProduct && subItems > 1) {
              actualDeductQty = cleanQuantity((item.quantity / subItems) / 100);
            } else {
              actualDeductQty = cleanQuantity(item.quantity / 1000);
            }
          } else if (item.saleMode === 'kg') {
            if (isKgProduct && subItems > 1) {
              actualDeductQty = cleanQuantity((item.quantity / subItems) * 10);
            } else {
              actualDeductQty = cleanQuantity(item.quantity);
            }
          }
        }

        totalAmount = roundMoney(totalAmount + itemTotal);
        totalCost = roundMoney(totalCost + itemCost);

        if (deductInventory && p) {
          const productRef = doc(db, `users/${user.uid}/products`, item.productId);
          const currentQty = cleanQuantity(p.quantity !== undefined ? p.quantity : 0);
          const currentPosQty = cleanQuantity(p.posQuantity !== undefined ? p.posQuantity : p.quantity);

          if (settings.posDeductInventory !== false) {
            batch.update(productRef, {
              quantity: Math.max(0, cleanQuantity(currentQty - actualDeductQty)),
              posQuantity: Math.max(0, cleanQuantity(currentPosQty - actualDeductQty)),
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.update(productRef, {
              posQuantity: Math.max(0, cleanQuantity(currentPosQty - actualDeductQty)),
              updatedAt: serverTimestamp(),
            });
          }
        }

        return {
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          saleMode: item.saleMode || 'piece',
          deductedQuantity: actualDeductQty,
          unit: item.product?.unit || p?.unit || '',
          price: roundMoney(item.price),
          cost: unitCost,
          total: itemTotal,
          profit: roundMoney(itemTotal - itemCost),
        };
      });

      const invoiceData = {
        invoiceNumber: Math.floor(100000 + Math.random() * 900000).toString(),
        items: invoiceItems,
        totalAmount: roundMoney(totalAmount),
        totalCost: roundMoney(totalCost),
        totalProfit: roundMoney(totalAmount - totalCost),
        deductedFrom: deductInventory ? (settings.posDeductInventory !== false ? 'both' : 'cashier') : 'none',
        createdAt: serverTimestamp(),
      };

      batch.set(invoiceRef, invoiceData);
      await batch.commit();

      if (deductInventory) {
        showToast('تم حفظ الفاتورة بنجاح وخصم الكميات من المخزون', 'success');
      } else {
        showToast('تم حفظ الفاتورة بنجاح', 'success');
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
    const matchedProduct = products.find((p) => p.barcode === decodedText || p.barcode2 === decodedText);

    if (matchedProduct) {
      addItem(matchedProduct);
      showToast(`تمت إضافة: ${matchedProduct.name}`, 'success');
    } else {
      showToast('المنتج غير موجود', 'error');
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
        className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b"
        style={{ borderColor: theme.border }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
              01
            </span>
            <span className="tracking-wider uppercase font-mono" style={{ color: theme.textMuted }}>
              POS · CASHIER
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">نقاط البيع (POS)</h1>
          <p className="text-xs sm:text-sm" style={{ color: theme.textMuted }}>
            إنشاء فاتورة مبيعات فورية وإتمام الخصم من المخزون
          </p>
        </div>

        <div className="flex items-center gap-2">
          {heldInvoices.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHeldInvoices(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.accent,
              }}
            >
              <List size={15} />
              <span>المعلقة</span>
              <span className="font-mono tabular-nums">({heldInvoices.length})</span>
            </button>
          )}

          {items.length > 0 && (
            <button
              type="button"
              onClick={holdCurrentInvoice}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <Pause size={15} />
              <span>تعليق</span>
            </button>
          )}

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
              <RotateCcw size={15} />
              <span>مسح</span>
            </button>
          )}
        </div>
      </header>

      {/* Inline Barcode Scanner & Search Box */}
      <div className="relative z-30">
        <AnimatePresence>
          {isInlineScannerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              <div
                className="h-64 sm:h-72 w-full overflow-hidden border relative"
                style={{ borderColor: theme.border }}
              >
                <BarcodeScanner
                  isOpen={isInlineScannerOpen}
                  onClose={() => setIsInlineScannerOpen(false)}
                  onScan={handleScan}
                  inline={true}
                  continuous={true}
                  tabId="pos"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="flex items-center border p-1 transition-colors"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex items-center justify-center px-3" style={{ color: theme.textMuted }}>
            <Search size={18} />
          </div>
          <input
            type="search"
            name="pos_search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('search_product_or_barcode') || 'ابحث باسم المنتج أو الباركود...'}
            className="flex-1 h-11 bg-transparent px-2 text-sm sm:text-base font-medium outline-none w-full"
            style={{ color: theme.text }}
          />
          <button
            type="button"
            onClick={() => setIsInlineScannerOpen(!isInlineScannerOpen)}
            className="p-2.5 ml-1 border transition-colors cursor-pointer"
            style={{
              backgroundColor: isInlineScannerOpen ? theme.text : theme.surfaceMuted,
              borderColor: isInlineScannerOpen ? theme.text : theme.border,
              color: isInlineScannerOpen ? theme.surface : theme.text,
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
                      {t('selling_price')} : {(p.sellingPrice || 0).toFixed(3)}
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
          {items.map((item) => {
            const liveProduct = products.find((p) => p.id === item.productId) || item.product;
            const maxAvailableStock = liveProduct
              ? getMaxAvailableInMode(liveProduct, item.saleMode, item.id, items)
              : 999999;

            return (
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
                  className="px-4 py-2.5 border-b flex items-center justify-between gap-2 flex-wrap"
                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h3 className="font-bold text-sm sm:text-base truncate">{item.name}</h3>
                    {liveProduct && (
                      <div className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                        {settings.posDeductInventory !== false ? (
                          <>
                            <span>
                              المخزن: {cleanQuantity(liveProduct.quantity || 0)} {liveProduct.unit || 'قطعة'}
                            </span>
                            <span className="mx-1.5">·</span>
                            <span style={{ color: theme.accent }}>
                              الكاشير: {cleanQuantity(liveProduct.posQuantity !== undefined ? liveProduct.posQuantity : liveProduct.quantity)}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: theme.accent }}>
                            مخزون الكاشير:{' '}
                            {cleanQuantity(liveProduct.posQuantity !== undefined ? liveProduct.posQuantity : liveProduct.quantity)}{' '}
                            {liveProduct.unit || 'قطعة'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 transition-colors cursor-pointer"
                    style={{ color: theme.negative }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="p-3 sm:p-4 grid grid-cols-12 items-end gap-2 sm:gap-3">
                  {/* Selling Price */}
                  <div className="col-span-4">
                    <label className="block text-[11px] font-bold mb-1 truncate" style={{ color: theme.textMuted }}>
                      {t('selling_price')}
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
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
                          {t('quantity')}
                        </label>
                        {liveProduct && (
                          <span
                            className="text-[10px] font-mono tabular-nums font-bold"
                            style={{ color: maxAvailableStock <= 0 ? theme.negative : theme.accent }}
                          >
                            (المتاح: {maxAvailableStock})
                          </span>
                        )}
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
                      min={0}
                      max={maxAvailableStock}
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
            );
          })}
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

      {/* Editorial Totals & Checkout Panel */}
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setShowReceiptPreviewModal(true)}
                className="flex items-center justify-center gap-1.5 py-2.5 border text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text,
                }}
              >
                <Printer size={16} />
                <span>طباعة</span>
              </button>
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

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="deduct-inventory"
                checked={deductInventory}
                onChange={(e) => setDeductInventory(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
                style={{ accentColor: theme.accent }}
              />
              <label htmlFor="deduct-inventory" className="text-xs sm:text-sm font-bold cursor-pointer">
                خصم من المخزون
              </label>
            </div>

            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={isCompleting}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-white font-black text-base transition-opacity disabled:opacity-60 cursor-pointer"
              style={{ backgroundColor: theme.accent }}
            >
              {isCompleting ? <Loader2 size={20} className="animate-spin" /> : <CheckCheck size={20} />}
              <span>إتمام البيع</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Held Invoices Modal */}
      <AnimatePresence>
        {showHeldInvoices && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="border w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <div
                className="p-4 border-b flex justify-between items-center"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
              >
                <h3 className="font-black text-base flex items-center gap-2">
                  <List size={18} style={{ color: theme.accent }} />
                  <span>الفواتير المعلقة</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowHeldInvoices(false)}
                  className="p-1.5 border cursor-pointer"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {heldInvoices.length === 0 ? (
                  <div className="text-center py-8 text-xs" style={{ color: theme.textMuted }}>
                    لا توجد فواتير معلقة
                  </div>
                ) : (
                  heldInvoices.map((invoice, index) => (
                    <div
                      key={invoice.id}
                      className="p-3.5 border flex flex-col gap-2.5"
                      style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-black text-sm">فاتورة معلقة #{index + 1}</span>
                        <span className="text-xs font-mono tabular-nums" style={{ color: theme.textMuted }}>
                          {new Date(invoice.time).toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs font-mono tabular-nums" style={{ color: theme.textMuted }}>
                        {invoice.items.length} منتجات · الإجمالي:{' '}
                        {invoice.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(3)} د.ت
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => resumeInvoice(invoice.id)}
                          className="flex-1 text-white py-2 text-xs font-bold cursor-pointer"
                          style={{ backgroundColor: theme.accent }}
                        >
                          استكمال
                        </button>
                        <button
                          type="button"
                          onClick={() => setHeldInvoices((prev) => prev.filter((h) => h.id !== invoice.id))}
                          className="px-4 border py-2 text-xs font-bold cursor-pointer"
                          style={{
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                            color: theme.negative,
                          }}
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Thermal Receipt Preview Modal */}
      <AnimatePresence>
        {showReceiptPreviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="border w-full max-w-lg overflow-hidden flex flex-col my-8 shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <div
                className="p-4 border-b flex justify-between items-center"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
              >
                <div className="flex items-center gap-2">
                  <Printer size={18} style={{ color: theme.accent }} />
                  <h3 className="font-black text-base">معاينة فاتورة الطابعة الحرارية</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReceiptPreviewModal(false)}
                  className="p-1.5 border cursor-pointer"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div
                className="p-3 border-b text-xs text-right leading-relaxed font-medium"
                style={{
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.textMuted,
                }}
              >
                ملاحظة للمعاينة: إذا لم تبدأ الطباعة مباشرة بسبب حظر النوافذ المنبثقة داخل المتصفح، افتح التطبيق في تبويب خارجي للطباعة الحرارية المباشرة.
              </div>

              <div
                className="p-6 flex justify-center overflow-y-auto max-h-[50vh]"
                style={{ backgroundColor: theme.surfaceMuted }}
              >
                <div
                  className="bg-white text-black p-5 shadow-md border border-zinc-300 relative text-right select-none"
                  style={{
                    width: (settings?.receiptPaperSize || '80mm') === '58mm' ? '280px' : '380px',
                    fontFamily: 'monospace, sans-serif',
                  }}
                >
                  <div className="text-center mb-4">
                    {settings?.receiptLogo ? (
                      <img
                        src={settings.receiptLogo}
                        className="mx-auto max-h-12 max-w-[80px] object-contain mb-2"
                        alt="Logo"
                      />
                    ) : null}
                    <h4 className="font-black text-lg text-black leading-tight">{settings?.storeName || 'مخزوني'}</h4>
                    <p className="text-[10px] text-zinc-500 mt-1">شكراً لزيارتكم تسعدنا خدمتكم</p>
                  </div>

                  <div className="border-t border-dashed border-zinc-400 my-2" />

                  <div className="text-xs space-y-1 text-zinc-700">
                    <div className="flex justify-between font-mono">
                      <span className="font-bold">#INV-{Math.floor(100000 + Math.random() * 900000)}</span>
                      <span>رقم الفاتورة:</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{new Date().toLocaleDateString('ar-TN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      <span>التاريخ:</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{new Date().toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>الوقت:</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-zinc-400 my-2" />

                  <table className="w-full text-xs text-black border-collapse">
                    <thead>
                      <tr className="border-b border-dashed border-zinc-400 font-bold">
                        <th className="text-right pb-1">المنتج</th>
                        <th className="text-center pb-1">الكمية</th>
                        <th className="text-left pb-1">المجموع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        let quantityText = item.quantity.toString();
                        if (item.saleMode === 'gram') quantityText += ' غرام';
                        else if (item.saleMode === 'kg') quantityText += ' كغ';
                        else if (item.saleMode === 'subpiece') quantityText += ' حبة';
                        else if (item.saleMode === 'piece') quantityText += ' قطعة';
                        else if (item.saleMode === 'box') quantityText += ' كرتونة';

                        return (
                          <tr key={item.id} className="border-b border-dashed border-zinc-100">
                            <td className="py-1.5 text-right font-medium max-w-[120px] break-words">{item.name}</td>
                            <td className="py-1.5 text-center text-zinc-600 font-bold">{quantityText}</td>
                            <td className="py-1.5 text-left font-bold">{calculateItemTotal(item).toFixed(3)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="border-t border-dashed border-zinc-400 my-2" />

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-bold">{calculateTotal().toFixed(3)} د.ت</span>
                      <span className="text-zinc-600">المجموع الكلي:</span>
                    </div>
                    <div className="flex justify-between text-sm font-black pt-1 border-t border-zinc-300">
                      <span>{calculateTotal().toFixed(3)} د.ت</span>
                      <span>المبلغ المدفوع:</span>
                    </div>
                  </div>

                  {(settings?.receiptThankYouMessage || settings?.receiptPolicy) ? (
                    <>
                      <div className="border-t border-dashed border-zinc-400 my-2" />
                      <div className="text-[10px] text-center text-zinc-600 space-y-1">
                        {settings?.receiptThankYouMessage && <p className="font-bold">{settings.receiptThankYouMessage}</p>}
                        {settings?.receiptPolicy && <p className="whitespace-pre-wrap">{settings.receiptPolicy}</p>}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              <div
                className="p-4 border-t flex flex-col gap-2"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full flex items-center justify-center gap-2 text-white py-3 font-bold text-sm cursor-pointer"
                  style={{ backgroundColor: theme.accent }}
                >
                  <Printer size={18} />
                  <span>بدء الطباعة الآن</span>
                </button>
                <div className="text-center text-[11px] font-mono" style={{ color: theme.textMuted }}>
                  المقاس المختار حالياً: {settings?.receiptPaperSize || '80mm'}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

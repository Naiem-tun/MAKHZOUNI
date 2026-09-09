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
  Loader2,
  Pause,
  List,
  Printer
} from 'lucide-react';
import * as html2pdf from 'html2pdf.js';
import {
  useAppContext } from '../AppContext';
import {
  collection, onSnapshot, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { forceStopAllCameras } from '../components/common/BarcodeScanner';
import { Product } from '../types';
import { cleanQuantity, formatQuantity, roundMoney } from '../lib/utils';

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
  
  const [heldInvoices, setHeldInvoices] = useState<{id: string, items: InvoiceItem[], time: number}[]>(() => {
    try {
      const saved = localStorage.getItem('pos_held_invoices');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('pos_held_invoices', JSON.stringify(heldInvoices));
  }, [heldInvoices]);

  const [showHeldInvoices, setShowHeldInvoices] = useState(false);

  const holdCurrentInvoice = () => {
    if (items.length === 0) return;
    setHeldInvoices(prev => [
      ...prev, 
      { id: Math.random().toString(36).substring(7), items: [...items], time: Date.now() }
    ]);
    setItems([]);
    showToast('تم تعليق الفاتورة بنجاح', 'success');
  };

  const resumeInvoice = (id: string) => {
    const invoiceToResume = heldInvoices.find(h => h.id === id);
    if (!invoiceToResume) return;

    // If current invoice is not empty, hold it first
    if (items.length > 0) {
      setHeldInvoices(prev => [
        ...prev.filter(h => h.id !== id),
        { id: Math.random().toString(36).substring(7), items: [...items], time: Date.now() }
      ]);
    } else {
      setHeldInvoices(prev => prev.filter(h => h.id !== id));
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
    
    // Cleanup Hook to forcefully stop any active camera tracks when leaving the POS page
    return () => {
      window.removeEventListener('open-barcode-scanner-pos', scannerHandler);
      
      // Stop all tracks in any active video elements using global tracking
      forceStopAllCameras();
    };
  }, []);

  useEffect(() => {
    if (inputText.trim().length > 1) {
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(inputText.toLowerCase()) ||
        p.barcode?.includes(inputText) ||
        p.barcode2?.includes(inputText) ||
        p.aliases?.some(a => a.toLowerCase().includes(inputText.toLowerCase()))
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [inputText, products]);

  // Helper to calculate how many base units (pieces/kg) a given item deducts from inventory
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

  // Helper to calculate maximum allowed quantity in the specific saleMode based on remaining stock
  const getMaxAvailableInMode = (p: any, saleMode?: string, excludeItemId?: string, currentCartItems: InvoiceItem[] = []): number => {
    if (!p) return 0;
    const totalStock = cleanQuantity(
      settings.posDeductInventory === false
        ? (p.posQuantity !== undefined ? p.posQuantity : p.quantity)
        : (p.quantity !== undefined ? p.quantity : (p.posQuantity || 0))
    );
    if (totalStock <= 0) return 0;

    // Deduct stock already occupied by other rows of the same product in cart
    const otherItems = currentCartItems.filter(it => it.productId === p.id && it.id !== excludeItemId);
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

    // Check if same product and same saleMode already exists in cart
    const existingIndex = items.findIndex(it => it.productId === product.id && it.saleMode === initialMode);
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
        const p = products.find(prod => prod.id === item.productId) || item.product;
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
    }));
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
      else quantityText += '';

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

      let itemsHtml = "";
      items.forEach((item, index) => {
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
            @page {
              size: ${is58mm ? '58mm' : '80mm'} auto;
              margin: 0;
            }
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
            <tr>
              <td class="bold">رقم الفاتورة:</td>
              <td style="text-align: left; font-family: monospace;">#INV-${invoiceId}</td>
            </tr>
            <tr>
              <td>التاريخ:</td>
              <td style="text-align: left;">${currentDate}</td>
            </tr>
            <tr>
              <td>الوقت:</td>
              <td style="text-align: left;">${currentTime}</td>
            </tr>
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
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals-container">
            <div class="totals-row">
              <span>المجموع الكلي:</span>
              <span class="bold">${calculateTotal().toFixed(3)} د.ت</span>
            </div>
            <div class="totals-row total-amount">
              <span>المبلغ المدفوع:</span>
              <span>${calculateTotal().toFixed(3)} د.ت</span>
            </div>
          </div>

          ${(settings?.receiptThankYouMessage || settings?.receiptPolicy) ? `
            <div class="divider"></div>
            <div class="footer-msg">
              ${settings?.receiptThankYouMessage ? `<div class="bold" style="margin-bottom: 5px;">${settings.receiptThankYouMessage}</div>` : ''}
              ${settings?.receiptPolicy ? `<div>${settings.receiptPolicy}</div>` : ''}
            </div>
          ` : ''}
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
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

      const invoiceId = Math.floor(100000 + Math.random() * 900000).toString();
      const currentDate = new Date().toLocaleDateString('ar-TN', { year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = new Date().toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' });

      const elementHtml = `
      <div style="font-family: 'Inter', system-ui, sans-serif; direction: rtl; padding: 40px; max-width: 800px; margin: 0 auto; color: #0f172a; background-color: #ffffff;">
        
        <!-- Header Section -->
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
        
        <!-- Items Table -->
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
          <tbody>
            ${tableHtml}
          </tbody>
        </table>
        
        <!-- Totals Section -->
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

        <!-- Footer Section -->
        ${(settings?.receiptThankYouMessage || settings?.receiptPolicy) ? `
        <div style="padding-top: 30px; border-top: 1px solid #e2e8f0; text-align: center;">
          ${settings?.receiptThankYouMessage ? `<p style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">${settings.receiptThankYouMessage}</p>` : ''}
          ${settings?.receiptPolicy ? `<p style="font-size: 12px; color: #64748b; margin: 0; white-space: pre-wrap; line-height: 1.6; max-width: 600px; margin: 0 auto;">${settings.receiptPolicy}</p>` : ''}
        </div>
        ` : ''}
        
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
  const [deductInventory, setDeductInventory] = useState(settings.posDeductInventory ?? true);

  const handleCompleteSale = async () => {
    if (!user || items.length === 0) return;
    try {
      setIsCompleting(true);

      // Verify all items have enough inventory before proceeding
      if (deductInventory) {
        for (const item of items) {
          const p = products.find(prod => prod.id === item.productId);
          if (p) {
            const availableStock = cleanQuantity(
              settings.posDeductInventory === false
                ? (p.posQuantity !== undefined ? p.posQuantity : p.quantity)
                : (p.quantity !== undefined ? p.quantity : (p.posQuantity || 0))
            );
            const reqDeduct = calculateDeductedPieces(p, item.quantity, item.saleMode);
            if (reqDeduct > availableStock) {
              showToast(`لا يمكن إتمام البيع: الكمية المطلوبة للمنتج "${item.name}" تتجاوز المتوفر في المخزون (${availableStock})`, 'error');
              setIsCompleting(false);
              return;
            }
          }
        }
      }

      const batch = writeBatch(db);

      // Create invoice record
      const invoiceRef = doc(collection(db, `users/${user.uid}/invoices`));
      
      let totalAmount = 0;
      let totalCost = 0;
      const invoiceItems = items.map(item => {
        const p = products.find(p => p.id === item.productId);
        const itemTotal = roundMoney(calculateItemTotal(item));
        
        let itemCost = 0;
        let unitCost = 0;
        if (p) {
          unitCost = roundMoney(p.purchasePrice || p.costPrice || 0);
          const isKgProduct = p.unit === 'kg';
          const subItems = p.subItemsPerPiece || 1;

          if (item.saleMode === 'box' && p.piecesPerBox) {
            itemCost = roundMoney((p.boxPurchasePrice || (unitCost * p.piecesPerBox)) * item.quantity);
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
            // Deduct from BOTH warehouse inventory (quantity) AND cashier inventory (posQuantity)
            batch.update(productRef, {
              quantity: Math.max(0, cleanQuantity(currentQty - actualDeductQty)),
              posQuantity: Math.max(0, cleanQuantity(currentPosQty - actualDeductQty)),
              updatedAt: serverTimestamp()
            });
          } else {
            // Deduct ONLY from cashier inventory (posQuantity)
            batch.update(productRef, {
              posQuantity: Math.max(0, cleanQuantity(currentPosQty - actualDeductQty)),
              updatedAt: serverTimestamp()
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
          profit: roundMoney(itemTotal - itemCost)
        };
      });

      const invoiceData = {
        invoiceNumber: Math.floor(100000 + Math.random() * 900000).toString(),
        items: invoiceItems,
        totalAmount: roundMoney(totalAmount),
        totalCost: roundMoney(totalCost),
        totalProfit: roundMoney(totalAmount - totalCost),
        deductedFrom: deductInventory ? (settings.posDeductInventory !== false ? 'both' : 'cashier') : 'none',
        createdAt: serverTimestamp()
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
    // Find product matching the scanned barcode
    const matchedProduct = products.find(p => p.barcode === decodedText || p.barcode2 === decodedText);
    
    if (matchedProduct) {
      addItem(matchedProduct);
      showToast(`تمت إضافة: ${matchedProduct.name}`, 'success');
    } else {
      showToast('المنتج غير موجود', 'error');
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
        
        <div className="flex items-center gap-2">
          {heldInvoices.length > 0 && (
            <button
              onClick={() => setShowHeldInvoices(true)}
              className="relative flex items-center gap-2 px-3 py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
            >
              <List size={16} />
              <span className="hidden sm:inline">المعلقة</span>
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-950">
                {heldInvoices.length}
              </span>
            </button>
          )}

          {items.length > 0 && (
            <button
              onClick={holdCurrentInvoice}
              className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors dark:bg-orange-500/10 dark:hover:bg-orange-500/20"
            >
              <Pause size={16} />
              <span className="hidden sm:inline">تعليق</span>
            </button>
          )}

          {items.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors dark:bg-red-500/10 dark:hover:bg-red-500/20"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">مسح</span>
            </button>
          )}
        </div>
      </div>

      {/* Input Section */}
      <div className="relative z-30">
        <AnimatePresence>
          {isInlineScannerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="h-64 sm:h-72 w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
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

        <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500/30 transition-all shadow-sm">
          <div className="flex items-center justify-center pl-2 pr-3 text-zinc-400">
            <Search size={20} />
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
            className="flex-1 h-12 bg-transparent px-2 text-base font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none w-full"
          />
          <button 
            onClick={() => isInlineScannerOpen ? setIsInlineScannerOpen(false) : setIsInlineScannerOpen(true)}
            className={`p-2 ml-1 rounded-lg transition-colors ${isInlineScannerOpen ? 'text-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'text-zinc-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10'}`}
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
          {items.map((item) => {
            const liveProduct = products.find(p => p.id === item.productId) || item.product;
            const maxAvailableStock = liveProduct ? getMaxAvailableInMode(liveProduct, item.saleMode, item.id, items) : 999999;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
                className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden"
              >
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{item.name}</h3>
                  {liveProduct && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {settings.posDeductInventory !== false ? (
                        <>
                          <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                            المخزن: {cleanQuantity(liveProduct.quantity || 0)} {liveProduct.unit || 'قطعة'}
                          </span>
                          <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-md">
                            الكاشير: {cleanQuantity(liveProduct.posQuantity !== undefined ? liveProduct.posQuantity : liveProduct.quantity)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-md">
                          مخزون الكاشير: {cleanQuantity(liveProduct.posQuantity !== undefined ? liveProduct.posQuantity : liveProduct.quantity)} {liveProduct.unit || 'قطعة'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="p-3 sm:p-4 flex items-end justify-between gap-2 sm:gap-4">
                  <div className="flex items-end gap-2 sm:gap-4 flex-1">
                    {/* Price */}
                    <div className="flex-[1.2]">
                      <label className="block text-[10px] sm:text-xs font-bold text-zinc-400 mb-1 truncate">{t('selling_price')} </label>
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
                        className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg py-2 px-1 sm:px-3 text-sm sm:text-base font-bold text-zinc-900 dark:text-white text-center focus:ring-2 focus:ring-brand-500 h-10"
                      />
                    </div>
                    {/* Quantity */}
                    <div className="flex-[1.5]">
                      <div className="flex flex-col gap-1 mb-1 justify-end min-h-[24px]">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] sm:text-xs font-bold text-zinc-400 truncate">{t('quantity')}</label>
                          {liveProduct && (
                            <span className={`text-[9px] font-bold ${maxAvailableStock <= 0 ? 'text-red-500' : 'text-brand-600 dark:text-brand-400'}`}>
                              (المتاح: {maxAvailableStock})
                            </span>
                          )}
                        </div>
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
                        min={0}
                        max={maxAvailableStock}
                        inputMode="decimal"
                        autoComplete="off"
                        autoCorrect="off"
                        data-lpignore="true"
                        data-form-type="other"
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
            );
          })}
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
                  onClick={() => setShowReceiptPreviewModal(true)}
                  className="flex-[1.5] flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 py-2.5 rounded-lg transition-colors font-bold text-sm"
                >
                  <Printer size={18} />
                  <span>طباعة</span>
                </button>
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
              
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="deduct-inventory" 
                  checked={deductInventory}
                  onChange={(e) => setDeductInventory(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded bg-white border-brand-300 focus:ring-brand-500"
                />
                <label htmlFor="deduct-inventory" className="text-sm text-brand-100 font-medium cursor-pointer">
                  خصم من المخزون
                </label>
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

      {/* Held Invoices Modal */}
      <AnimatePresence>
        {showHeldInvoices && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                  <List size={20} className="text-brand-500" />
                  الفواتير المعلقة
                </h3>
                <button
                  onClick={() => setShowHeldInvoices(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  إغلاق
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {heldInvoices.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    لا توجد فواتير معلقة
                  </div>
                ) : (
                  heldInvoices.map((invoice, index) => (
                    <div key={invoice.id} className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-zinc-900 dark:text-white">
                          فاتورة معلقة #{index + 1}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date(invoice.time).toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        {invoice.items.length} منتجات | الإجمالي: {invoice.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(3)} د.ت
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => resumeInvoice(invoice.id)}
                          className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-sm font-bold transition-colors"
                        >
                          استكمال
                        </button>
                        <button
                          onClick={() => setHeldInvoices(prev => prev.filter(h => h.id !== invoice.id))}
                          className="px-4 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 py-2 rounded-lg text-sm font-bold transition-colors"
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

      {/* Receipt Preview Modal */}
      <AnimatePresence>
        {showReceiptPreviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col my-8"
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <Printer size={20} className="text-brand-600" />
                  <h3 className="font-bold text-lg text-zinc-950 dark:text-white">
                    معاينة فاتورة الطابعة الحرارية
                  </h3>
                </div>
                <button
                  onClick={() => setShowReceiptPreviewModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  إغلاق
                </button>
              </div>

              {/* Info Banner on Iframe Printing */}
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 text-right leading-relaxed font-semibold">
                ⚠️ <strong>ملاحظة هامة للمعاينة:</strong> إذا لم تبدأ الطباعة عند النقر على "بدء الطباعة" بسبب حظر المتصفح للنوافذ المنبثقة داخل بيئة التطوير، يرجى فتح التطبيق في <strong>رابط خارجي (تبويب جديد)</strong> لتجربة ميزة الطباعة بنجاح وبشكل مباشر على طابعتك الحرارية.
              </div>

              {/* Printable Area Wrapper */}
              <div className="p-6 bg-zinc-200/50 dark:bg-zinc-950/40 flex justify-center overflow-y-auto max-h-[50vh]">
                <div 
                  className={`bg-white text-black p-5 shadow-lg border border-zinc-300/60 rounded-sm relative text-right select-none`}
                  style={{ 
                    width: (settings?.receiptPaperSize || '80mm') === '58mm' ? '280px' : '380px',
                    fontFamily: 'monospace, sans-serif'
                  }}
                >
                  {/* Decorative Jagged Receipt Top/Bottom Edges */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[radial-gradient(circle_at_bottom,_transparent_4px,_#e5e7eb_4px)] bg-[length:12px_8px] bg-repeat-x transform -translate-y-1"></div>
                  
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

                  <div className="border-t border-dashed border-zinc-400 my-2"></div>

                  <div className="text-xs space-y-1 text-zinc-700">
                    <div className="flex justify-between direction-ltr font-mono">
                      <span className="font-bold">#INV-{Math.floor(100000 + Math.random() * 900000)}</span>
                      <span>رقم الفاتورة:</span>
                    </div>
                    <div className="flex justify-between direction-ltr">
                      <span>{new Date().toLocaleDateString('ar-TN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      <span>التاريخ:</span>
                    </div>
                    <div className="flex justify-between direction-ltr">
                      <span>{new Date().toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>الوقت:</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-zinc-400 my-2"></div>

                  {/* Items Table */}
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

                  <div className="border-t border-dashed border-zinc-400 my-2"></div>

                  {/* Totals */}
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

                  {/* Custom Footer Notes */}
                  {(settings?.receiptThankYouMessage || settings?.receiptPolicy) ? (
                    <>
                      <div className="border-t border-dashed border-zinc-400 my-2"></div>
                      <div className="text-[10px] text-center text-zinc-600 space-y-1">
                        {settings?.receiptThankYouMessage && <p className="font-bold">{settings.receiptThankYouMessage}</p>}
                        {settings?.receiptPolicy && <p className="whitespace-pre-wrap">{settings.receiptPolicy}</p>}
                      </div>
                    </>
                  ) : null}

                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[radial-gradient(circle_at_top,_transparent_4px,_#e5e7eb_4px)] bg-[length:12px_8px] bg-repeat-x transform translate-y-1"></div>
                </div>
              </div>

              {/* Action buttons inside Modal */}
              <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
                <button
                  onClick={() => {
                    handlePrint();
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-xl font-bold transition-all text-base shadow-sm active:scale-[0.99]"
                >
                  <Printer size={20} />
                  <span>بدء الطباعة الآن</span>
                </button>
                <div className="text-center text-[10px] text-zinc-500 font-medium">
                  المقاس المختار حالياً: {settings?.receiptPaperSize || '80mm'} (يمكنك تغييره من الإعدادات)
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

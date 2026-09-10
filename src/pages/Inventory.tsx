import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, ScanBarcode, CheckCircle2, Check,
  Package, Wallet, FileText, ClipboardCheck, Trash2, History,
  X, PlusCircle, MinusCircle, ArrowRight, Download, Receipt, FileBarChart, TrendingUp, Activity, Printer,
  FlaskConical
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  deleteDoc,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { cn, safeParseFloat, handleFirestoreError, formatCurrency, safeParseDate, formatAppDate, cleanQuantity, formatQuantity, roundMoney, commitBatchesInChunks } from '../lib/utils';
import { OperationType } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ProductPagination } from '../components/products/ProductPagination';
import { useCategories, categoryIcons } from '../hooks/useCategories';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import { Logo } from '../components/UI';
import { InventoryReportView } from '../components/inventory/InventoryReportView';
import { HistoryModal } from '../components/inventory/HistoryModal';
import { ExpensesModal } from '../components/inventory/ExpensesModal';
import { InventoryCompareModal } from '../components/inventory/InventoryCompareModal';
import { InventoryPrintModal } from '../components/inventory/InventoryPrintModal';

import { InventoryItem } from '../components/inventory/InventoryItem';
import { useTranslation } from 'react-i18next';
import { logAudit } from '../lib/auditLogger';




function distributeQuantityToProducts(originalProducts: any[], newTotalQty: number) {
  const cleanTargetTotal = cleanQuantity(newTotalQty);
  const currentTotal = originalProducts.reduce((sum, p) => sum + cleanQuantity(p.quantity || 0), 0);
  const diff = cleanQuantity(cleanTargetTotal - currentTotal);
  
  if (diff === 0) {
    return originalProducts.map(p => ({ product: p, newQty: cleanQuantity(p.quantity || 0) }));
  }

  const products = originalProducts.map(p => ({ ...p, currentQty: cleanQuantity(p.quantity || 0) }));

  if (diff > 0) {
    products[products.length - 1].currentQty = cleanQuantity(products[products.length - 1].currentQty + diff);
  } else {
    let remainingToDeduct = Math.abs(diff);
    for (let i = 0; i < products.length; i++) {
      if (remainingToDeduct <= 0) break;
      
      const p = products[i];
      if (p.currentQty > 0) {
        const deductAmount = Math.min(p.currentQty, remainingToDeduct);
        p.currentQty = cleanQuantity(p.currentQty - deductAmount);
        remainingToDeduct = cleanQuantity(remainingToDeduct - deductAmount);
      }
    }
    
    if (remainingToDeduct > 0) {
      products[products.length - 1].currentQty = cleanQuantity(products[products.length - 1].currentQty - remainingToDeduct);
    }
  }

  return products.map(p => ({
    product: p,
    newQty: cleanQuantity(p.currentQty)
  }));
}

export default function Inventory() {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const { categories } = useCategories();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showUninventoriedOnly, setShowUninventoriedOnly] = useState(false);
  const [inventoryData, setInventoryData] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('current_inventory_data');
    return saved ? JSON.parse(saved) : {};
  });
  const [checkedProducts, setCheckedProducts] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('checked_inventory_products');
    return saved ? JSON.parse(saved) : {};
  });
  const [products, setProducts] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`products_cache_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(products.length === 0);
  
  const [currentPage, setCurrentPage] = useState(1);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, any> = {};

    products.forEach(p => {
      const key = (p.barcode || p.name).trim().toLowerCase();
      
      if (!groups[key]) {
        groups[key] = {
          id: key, // Using this as the fake product ID
          name: p.name,
          barcode: p.barcode || p.barcode2 || '',
          category: p.category,
          quantity: 0,
          sellingPrice: p.sellingPrice || 0,
          purchasePrice: p.purchasePrice || p.costPrice || 0,
          costPrice: p.costPrice || p.purchasePrice || 0,
          piecesPerBox: p.piecesPerBox,
          hasLocalImage: p.hasLocalImage,
          hasCloudImage: p.hasCloudImage,
          isGroup: true,
          originalProducts: []
        };
      }
      
      groups[key].originalProducts.push(p);
      groups[key].quantity += (p.quantity || 0);
    });

    Object.values(groups).forEach(group => {
      group.originalProducts.sort((a: any, b: any) => {
        const timeA = a.updatedAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || 0;
        return timeA - timeB;
      });
    });

    return Object.values(groups);
  }, [products]);

  const ITEMS_PER_PAGE = 20;

  const [modalConfig, setModalConfig] = useState<{
    show: boolean;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({ show: false, message: '', type: 'alert' });

  const showAlert = (message: string) => {
    setModalConfig({ show: true, message, type: 'alert' });
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setModalConfig({ show: true, message, type: 'confirm', onConfirm });
  };

  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [expensesAmount, setExpensesAmount] = useState(0);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [shouldDeductExpenses, setShouldDeductExpenses] = useState(true);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyReports, setHistoryReports] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  const [showReportView, setShowReportView] = useState(false);
  const [currentReport, setCurrentReport] = useState<any>(null);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showDetailedControls, setShowDetailedControls] = useState(() => {
    return localStorage.getItem('detailed_inventory_mode') === 'true';
  });

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('detailed_inventory_mode', String(showDetailedControls));
  }, [showDetailedControls]);

  useEffect(() => {
    const scannerHandler = () => {
      setIsScannerOpen(true);
    };
    window.addEventListener('open-barcode-scanner-inventory', scannerHandler);
    return () => window.removeEventListener('open-barcode-scanner-inventory', scannerHandler);
  }, []);

  const handleScan = (decodedText: string) => {
    setIsScannerOpen(false);
    
    const foundProduct = groupedProducts.find(p => p.barcode === decodedText || p.id === decodedText.toLowerCase());
    
    if (foundProduct) {
      setSearchTerm(decodedText);
      showToast(`${t('found')}: ${foundProduct.name}`, 'success');
    } else {
      showToast(t('product_not_found_inventory'), 'error');
    }
  };
  
  // Persistence: Save inventory data to localStorage
  useEffect(() => {
    localStorage.setItem('current_inventory_data', JSON.stringify(inventoryData));
  }, [inventoryData]);

  useEffect(() => {
    localStorage.setItem('checked_inventory_products', JSON.stringify(checkedProducts));
  }, [checkedProducts]);

  const toggleChecked = useCallback((id: string) => {
    setCheckedProducts(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const getDraftItems = useCallback(() => {
    return products.map(p => {
      const actualQty = inventoryData[p.id];
      const finalQty = actualQty !== undefined ? Number(actualQty) : Number(p.quantity || 0);
      const sold = Number(p.quantity || 0) - finalQty;
      const purchasePrice = roundMoney(Number(p.purchasePrice || p.costPrice || 0));
      const remainingValue = roundMoney(finalQty * purchasePrice);
      const revenue = roundMoney(sold * Number(p.sellingPrice || 0));
      const profit = roundMoney(revenue - (sold * purchasePrice));
      
      const isSurplus = sold < 0;
      const surplusQuantity = isSurplus ? Math.abs(sold) : 0;
      const surplusCostValue = isSurplus ? roundMoney(surplusQuantity * purchasePrice) : 0;

      return {
        productName: p.name, 
        category: p.category,
        barcode: p.barcode || p.barcode2 || '',
        purchasePrice,
        sellingPrice: p.sellingPrice || 0,
        quantityBefore: p.quantity || 0, 
        quantityAfter: finalQty, 
        salesCalculated: sold, 
        profit: sold > 0 ? profit : 0,
        remainingValue,
        isSurplus,
        surplusQuantity,
        surplusCostValue
      };
    });
  }, [groupedProducts, inventoryData]);

  const handleClearInventory = () => {
    if (Object.keys(inventoryData).length === 0 && Object.keys(checkedProducts).length === 0) return;
    showConfirm(t('confirm_clear_quantities'), () => {
      setInventoryData({});
      setCheckedProducts({});
      localStorage.removeItem('current_inventory_data');
      localStorage.removeItem('checked_inventory_products');
    });
  };

  const fetchCurrentMonthExpenses = async () => {
    if (!user) return;
    setLoadingExpenses(true);
    try {
      const expensesPath = `users/${user.uid}/expenses`;
      const expensesQuery = query(
        collection(db, expensesPath),
        where("audited", "==", false)
      );
      
      const snapshot = await getDocs(expensesQuery);
      const total = snapshot.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setExpensesAmount(total);
    } catch (err) {
      console.error("Fetch expenses failed:", err);
    } finally {
      setLoadingExpenses(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCurrentMonthExpenses();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const reportsPath = `users/${user.uid}/reports`;
      const q = query(
        collection(db, reportsPath), 
        where("type", "==", "inventory")
      );
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setHistoryReports(reports);
    } catch (err) {
      console.error("Fetch history failed:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showHistoryModal) {
      fetchHistory();
    }
  }, [showHistoryModal]);

  // Real-time fetch from Firebase
  useEffect(() => {
    if (!user) return;
    
    const productsPath = `users/${user.uid}/products`;
    const q = collection(db, productsPath);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setProducts(prods);
      localStorage.setItem(`products_cache_${user.uid}`, JSON.stringify(prods));
      setLoading(false);
    }, (error) => {
      console.error("Fetch products failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Reset to first page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredProducts = useMemo(() => {
    if (!groupedProducts) return [];
    const productsToFilter = groupedProducts;
    const s = searchTerm.toLowerCase();
    const filtered = productsToFilter.filter((p: any) => {
      const matchSearch = p.name?.toLowerCase().includes(s) || p.barcode?.includes(s) || p.barcode2?.includes(s);
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      const matchUninventoried = !showUninventoriedOnly || !checkedProducts[p.id];
      return matchSearch && matchCat && matchUninventoried;
    });

    return [...filtered].sort((a, b) => {
      const categoryCompare = (a.category || '').localeCompare(b.category || '', settings.language);
      if (categoryCompare !== 0) return categoryCompare;
      return (a.name || '').localeCompare(b.name || '', settings.language);
    });
  }, [groupedProducts, searchTerm, categoryFilter, showUninventoriedOnly, inventoryData]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const sortedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const progress = useMemo(() => {
    if (!groupedProducts || groupedProducts.length === 0) return 0;
    const completed = Object.keys(inventoryData).length;
    return Math.round((completed / groupedProducts.length) * 100);
  }, [products, inventoryData]);

  const getCountBreakdown = (total: number, piecesPerBox: number) => {
    if (!total || total <= 0) return null;
    if (!piecesPerBox || piecesPerBox <= 1) return `${total} ${t('piece')}`;
    
    const cartons = Math.floor(total / piecesPerBox);
    const pieces = total % piecesPerBox;
    
    const parts = [];
    if (cartons > 0) parts.push(`${cartons} ${t('box')}`);
    if (pieces > 0) parts.push(`${pieces} ${t('piece')}`);
    
    return parts.join(' + ');
  };

  const handleMatch = useCallback((id: string, qty: number) => {
    setInventoryData(prev => ({ ...prev, [id]: qty }));
  }, []);

  const handleAddCarton = useCallback((id: string, pieces: number) => {
    setInventoryData(prev => ({ ...prev, [id]: (Number(prev[id]) || 0) + pieces }));
  }, []);

  const handleAddPiece = useCallback((id: string) => {
    setInventoryData(prev => ({ ...prev, [id]: (Number(prev[id]) || 0) + 1 }));
  }, []);

  const handleChangeQuantity = useCallback((id: string, val: string) => {
    if (val === '') {
      setInventoryData(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      const parsedVal = parseFloat(val.replace(',', '.'));
      setInventoryData(prev => ({ ...prev, [id]: isNaN(parsedVal) ? 0 : parsedVal }));
    }
  }, []);

  const handleAutoFillTest = useCallback(() => {
    if (!groupedProducts || groupedProducts.length === 0) {
      showToast(t('no_products_found'), 'error');
      return;
    }

    const testData: Record<string, number> = {};
    groupedProducts.forEach((p: any) => {
      // Set 0 to avoid surplus quantities and test batch processing cleanly
      testData[p.id] = 0;
    });

    setInventoryData(testData);
    showToast(`تم ملء ${groupedProducts.length} منتج بالقيمة 0 للاختبار`, 'success');
  }, [groupedProducts, showToast, t]);

  const handleCompleteInventory = async () => {
    if (!user) return;
    if (Object.keys(inventoryData).length === 0) {
      showAlert(t('enter_inventory_data_first'));
      return;
    }
    
    showConfirm(t('confirm_save_inventory'), async () => {
      try {
        const auditTime = serverTimestamp();
        const localNow = new Date();
        const writeOperations: Array<{
          type: 'set' | 'update' | 'delete';
          ref: any;
          data?: any;
        }> = [];
        
        let totalRevenue = 0;
        let totalProfit = 0;
        let totalRemainingValue = 0;
        let surplusValueUnverified = 0;
        let surplusItemsCount = 0;
        let surplusTotalQuantity = 0;
        const surplusDetails: string[] = [];
        const items: any[] = [];

        // Process grouped products
        groupedProducts.forEach(group => {
          const actualQty = inventoryData[group.id];
          const groupFinalQty = actualQty !== undefined ? Number(actualQty) : Number(group.quantity || 0);
          
          let groupRevenue = 0;
          let groupCost = 0;
          let groupProfit = 0;
          let groupRemainingValue = 0;
          
          const distributed = distributeQuantityToProducts(group.originalProducts, groupFinalQty);
          
          distributed.forEach(({ product, newQty }) => {
             const oldQty = product.quantity || 0;
             const itemSold = oldQty - newQty;
             
             const cost = roundMoney(Number(product.purchasePrice || product.costPrice || 0));
             const price = roundMoney(Number(product.sellingPrice || 0));
             
             groupRemainingValue = roundMoney(groupRemainingValue + (newQty * cost));
             
             if (itemSold > 0) {
                groupRevenue = roundMoney(groupRevenue + (itemSold * price));
                groupCost = roundMoney(groupCost + (itemSold * cost));
                groupProfit = roundMoney(groupProfit + (itemSold * (price - cost)));
             }
          });

          totalRemainingValue = roundMoney(totalRemainingValue + groupRemainingValue);
          const sold = Number(group.quantity || 0) - groupFinalQty;
          
          if (sold > 0) {
            totalRevenue = roundMoney(totalRevenue + groupRevenue);
            totalProfit = roundMoney(totalProfit + groupProfit);
          }

          const isSurplus = sold < 0;
          const surplusQuantity = isSurplus ? Math.abs(sold) : 0;
          const purchasePrice = roundMoney(Number(group.purchasePrice || 0));
          const surplusCostValue = isSurplus ? roundMoney(surplusQuantity * purchasePrice) : 0;

          if (isSurplus) {
            surplusValueUnverified = roundMoney(surplusValueUnverified + surplusCostValue);
            surplusItemsCount += 1;
            surplusTotalQuantity += surplusQuantity;
            surplusDetails.push(`${group.name}: المسجل (${group.quantity || 0}) -> الفعلي (${groupFinalQty}) [زيادة غير مفسرة: +${surplusQuantity} بقيمة تكلفة ${surplusCostValue}]`);
          }
          
          items.push({ 
            productName: group.name, 
            category: group.category,
            barcode: group.barcode || '',
            purchasePrice: roundMoney(group.purchasePrice || 0),
            sellingPrice: roundMoney(group.sellingPrice || 0),
            quantityBefore: group.quantity || 0, 
            quantityAfter: groupFinalQty, 
            salesCalculated: sold, 
            profit: sold > 0 ? roundMoney(groupProfit) : 0,
            remainingValue: roundMoney(groupRemainingValue),
            isSurplus,
            surplusQuantity,
            surplusCostValue: roundMoney(surplusCostValue)
          });
          
          if (actualQty !== undefined) {
            distributed.forEach(({ product, newQty }) => {
              const productRef = doc(db, `users/${user.uid}/products`, product.id!);
              writeOperations.push({
                type: 'update',
                ref: productRef,
                data: {
                  quantity: cleanQuantity(newQty),
                  posQuantity: cleanQuantity(newQty),
                  updatedAt: auditTime,
                  lastInventoryDate: auditTime
                }
              });
            });
          }
        });

        // Fetch expenses (cached if offline)
        const expensesPath = `users/${user.uid}/expenses`;
        const expensesQuery = query(
          collection(db, expensesPath),
          where("audited", "==", false)
        );
        const expensesSnapshot = await getDocs(expensesQuery);
        const actualExpensesAmount = roundMoney(expensesSnapshot.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0));
        const finalExpensesAmount = shouldDeductExpenses ? actualExpensesAmount : 0;
        const netProfit = roundMoney(totalProfit - finalExpensesAmount);

        // Prepare Report
        const reportsPath = `users/${user.uid}/reports`;
        const reportRef = doc(collection(db, reportsPath));
        writeOperations.push({
          type: 'set',
          ref: reportRef,
          data: {
            date: auditTime,
            totalRevenue: roundMoney(totalRevenue),
            totalProfit: roundMoney(totalProfit),
            totalRemainingValue: roundMoney(totalRemainingValue),
            surplusValueUnverified: roundMoney(surplusValueUnverified),
            surplusItemsCount,
            surplusTotalQuantity,
            totalExpenses: roundMoney(finalExpensesAmount), 
            netProfit: roundMoney(netProfit),
            items,
            type: 'inventory',
            expensesDeducted: shouldDeductExpenses
          }
        });

        // Mark expenses as audited
        if (shouldDeductExpenses) {
          expensesSnapshot.docs.forEach(expenseDoc => {
            writeOperations.push({
              type: 'update',
              ref: doc(db, expensesPath, expenseDoc.id),
              data: {
                audited: true,
                reportId: reportRef.id,
                auditedAt: auditTime
              }
            });
          });
        }

        // Update meta
        const profilePath = `users/${user.uid}/profile`;
        const finalMetaDocs = await getDocs(query(collection(db, profilePath), where("type", "==", "inventory_metadata")));
        if (finalMetaDocs.empty) {
          writeOperations.push({
            type: 'set',
            ref: doc(collection(db, profilePath)),
            data: { type: 'inventory_metadata', lastAuditDate: auditTime }
          });
        } else {
          writeOperations.push({
            type: 'update',
            ref: doc(db, profilePath, finalMetaDocs.docs[0].id),
            data: { lastAuditDate: auditTime }
          });
        }

        // Commit all operations safely in chunks of 400 (under Firestore's 500 limit)
        commitBatchesInChunks(db, writeOperations, writeBatch).then(() => {
          logAudit(
            'create',
            'inventory',
            reportRef.id,
            `جرد ${formatAppDate(localNow, settings?.language || 'ar', t)}`,
            `تسجيل عملية جرد بإجمالي ربح: ${roundMoney(totalProfit)}${surplusItemsCount > 0 ? ` | يوجد ${surplusItemsCount} صنف بزيادة غير مفسرة بقيمة تكلفة: ${roundMoney(surplusValueUnverified)}` : ''}`
          );

          if (surplusItemsCount > 0) {
            logAudit(
              'update',
              'inventory',
              reportRef.id,
              'زيادات مخزون غير مفسرة أثناء الجرد',
              `أصناف أظهرت فائضاً في الجرد الفعلي بعدد (${surplusItemsCount}) صنف وإجمالي كمية (+${surplusTotalQuantity}) بقيمة تكلفة ${roundMoney(surplusValueUnverified)} د.ت:\n${surplusDetails.join('\n')}`
            );
          }
        }).catch(err => {
          console.error("Inventory background chunked sync failed:", err);
        });

        // UI SUCCESS: Show report immediately
        const newReport = {
          id: reportRef.id,
          date: localNow,
          totalRevenue: roundMoney(totalRevenue),
          totalProfit: roundMoney(totalProfit),
          totalRemainingValue: roundMoney(totalRemainingValue),
          surplusValueUnverified: roundMoney(surplusValueUnverified),
          surplusItemsCount,
          surplusTotalQuantity,
          totalExpenses: roundMoney(finalExpensesAmount),
          netProfit: roundMoney(netProfit),
          items,
          expensesDeducted: shouldDeductExpenses
        };
        
        setInventoryData({});
        setCheckedProducts({});
        setExpensesAmount(0);
        setCurrentReport(newReport);
        setShowReportView(true);
        showToast(t('inventory_saved_success'));
        
        // Clear localStorage
        localStorage.removeItem('current_inventory_data');
        localStorage.removeItem('checked_inventory_products');
        
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/inventory`);
      }
    });
  };

  const generatePDF = async (report: any) => {
    try {
      showToast(t('preparing_pdf'));
      
      const storeName = settings.storeName || t('makhzouni');
      const reportDate = safeParseDate(report.date).toLocaleDateString('en-GB');
      const filename = `inventory-${reportDate.replace(/\//g, '-')}.pdf`;
      const formattedDate = formatAppDate(safeParseDate(report.date), settings.language, t);

      const totalProfitStr = formatCurrency(report.totalProfit || 0, settings.currency, settings.language);
      const totalRemainingVal = report.totalRemainingValue !== undefined 
        ? report.totalRemainingValue 
        : report.items?.reduce((sum: number, item: any) => {
            const prod = products.find(p => p.name === item.productName);
            const cost = prod?.purchasePrice || prod?.costPrice || 0;
            return sum + (cost * (item.quantityAfter || 0));
          }, 0) || 0;
      const totalRemainingStr = formatCurrency(totalRemainingVal, settings.currency, settings.language);

      const displayItems = report.items || [];
      const surplusItems = displayItems.filter((it: any) => it.isSurplus || (it.salesCalculated < 0));
      const surplusCount = report.surplusCount !== undefined ? report.surplusCount : surplusItems.length;
      const surplusTotalQty = report.surplusTotalQuantity !== undefined 
        ? report.surplusTotalQuantity 
        : surplusItems.reduce((acc: number, it: any) => acc + (it.surplusQuantity || Math.abs(it.salesCalculated || 0)), 0);
      const surplusCostTotal = report.surplusValueUnverified !== undefined 
        ? report.surplusValueUnverified 
        : surplusItems.reduce((acc: number, it: any) => {
            if (it.surplusCostValue !== undefined) return acc + it.surplusCostValue;
            const prod = products.find(p => p.name === it.productName);
            const cost = it.purchasePrice || prod?.purchasePrice || prod?.costPrice || 0;
            const qty = it.surplusQuantity || Math.abs(it.salesCalculated || 0);
            return acc + (qty * cost);
          }, 0);

      // Safe page chunking: 15 rows on page 1, 22 rows on subsequent pages
      const PAGE_1_MAX = 15;
      const OTHER_PAGE_MAX = 22;
      const pageChunks: any[][] = [];
      
      if (displayItems.length === 0) {
        pageChunks.push([]);
      } else {
        pageChunks.push(displayItems.slice(0, PAGE_1_MAX));
        let offset = PAGE_1_MAX;
        while (offset < displayItems.length) {
          pageChunks.push(displayItems.slice(offset, offset + OTHER_PAGE_MAX));
          offset += OTHER_PAGE_MAX;
        }
      }

      const totalPages = pageChunks.length;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const hiddenHost = document.createElement('div');
      hiddenHost.style.position = 'fixed';
      hiddenHost.style.top = '-99999px';
      hiddenHost.style.left = '0';
      hiddenHost.style.width = '794px';
      hiddenHost.style.zIndex = '-9999';
      hiddenHost.style.background = '#ffffff';
      document.body.appendChild(hiddenHost);

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const items = pageChunks[pageIdx];
        const isFirstPage = pageIdx === 0;

        let rowsHtml = '';
        items.forEach((item: any, i: number) => {
          const isItemSurplus = item.isSurplus || (item.salesCalculated < 0);
          const surplusQty = item.surplusQuantity || (isItemSurplus ? Math.abs(item.salesCalculated) : 0);
          const remainingVal = item.remainingValue !== undefined 
            ? item.remainingValue 
            : (((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0));

          const rowBg = isItemSurplus ? '#fffbeb' : (i % 2 === 1 ? '#f8fafc' : '#ffffff');
          const profitCell = isItemSurplus 
            ? `<span style="color: #94a3b8; font-family: monospace; font-size: 11px;">0.000</span>` 
            : `<span style="font-weight: 700; color: #0f172a;" dir="ltr">${formatCurrency(item.profit || 0, settings.currency, settings.language)}</span>`;

          const soldCell = isItemSurplus
            ? `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background-color: #fef3c7; color: #78350f; border: 1px solid #fcd34d; font-weight: bold; font-size: 10.5px;">+${surplusQty} غير مفسَّر</span>`
            : `<span style="font-weight: 700; color: #0f172a;">${item.salesCalculated}</span>`;

          const surplusNote = isItemSurplus 
            ? `<div style="font-size: 10px; color: #b45309; font-weight: bold; margin-top: 2px;">زيادة غير مفسَّرة: المسجل (${item.quantityBefore ?? '—'}) ➔ الفعلي (${item.quantityAfter ?? '—'})</div>`
            : '';

          rowsHtml += `
            <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0; height: 38px;">
              <td style="padding: 6px 10px; text-align: right; vertical-align: middle; width: 38%;">
                <div style="font-weight: 700; color: #0f172a; font-size: 12px;">${item.productName || '—'}</div>
                ${surplusNote}
              </td>
              <td style="padding: 6px 6px; text-align: center; vertical-align: middle; width: 14%; font-size: 12px;">
                ${soldCell}
              </td>
              <td style="padding: 6px 10px; text-align: left; vertical-align: middle; width: 16%; font-size: 12px;" dir="ltr">
                ${profitCell}
              </td>
              <td style="padding: 6px 6px; text-align: center; vertical-align: middle; width: 14%; font-weight: 700; color: #0f172a; font-size: 12px;">
                ${item.quantityAfter ?? '—'}
              </td>
              <td style="padding: 6px 10px; text-align: left; vertical-align: middle; width: 18%; font-weight: 700; color: #0f172a; font-size: 12px;" dir="ltr">
                ${formatCurrency(remainingVal, settings.currency, settings.language)}
              </td>
            </tr>
          `;
        });

        const headerHtml = isFirstPage ? `
          <!-- Main First Page Header Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border-bottom: 2px solid #021024; padding-bottom: 12px;">
            <tr>
              <td style="width: 32%; text-align: right; vertical-align: middle;">
                <div style="font-size: 19px; font-weight: 900; color: #021024;">${storeName}</div>
              </td>
              <td style="width: 36%; text-align: center; vertical-align: middle;">
                <div style="font-size: 21px; font-weight: 900; color: #0f172a;">${t('sales_report')}</div>
              </td>
              <td style="width: 32%; text-align: left; vertical-align: middle;" dir="ltr">
                <div style="font-size: 13px; color: #64748b; font-weight: 600;">${formattedDate}</div>
              </td>
            </tr>
          </table>

          <!-- Summary Cards on First Page -->
          <table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 16px;">
            <tr>
              <td style="width: ${surplusCostTotal > 0 ? '33.33%' : '50%'}; vertical-align: top; background-color: #004eff; color: #ffffff; padding: 12px 14px; border-radius: 8px;">
                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">${t('total_profits')}</div>
                <div style="font-size: 20px; font-weight: 900;" dir="ltr">${totalProfitStr}</div>
              </td>
              <td style="width: ${surplusCostTotal > 0 ? '33.33%' : '50%'}; vertical-align: top; background-color: #021024; color: #ffffff; padding: 12px 14px; border-radius: 8px;">
                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">${t('total_remaining_value')}</div>
                <div style="font-size: 20px; font-weight: 900;" dir="ltr">${totalRemainingStr}</div>
              </td>
              ${surplusCostTotal > 0 ? `
              <td style="width: 33.33%; vertical-align: top; background-color: #d97706; color: #ffffff; padding: 12px 14px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 12px; font-weight: bold;">فائض غير مبرَّر</span>
                  <span style="font-size: 10px; background-color: rgba(0,0,0,0.25); padding: 1px 6px; border-radius: 4px; font-weight: bold;">
                    ${surplusCount} صنف (+${surplusTotalQty})
                  </span>
                </div>
                <div style="font-size: 18px; font-weight: 900;" dir="ltr">${formatCurrency(surplusCostTotal, settings.currency, settings.language)}</div>
                <div style="font-size: 9.5px; opacity: 0.9; margin-top: 2px;">كميات فعلية زائدة عن المسجل</div>
              </td>
              ` : ''}
            </tr>
          </table>

          <div style="font-size: 11px; color: #64748b; margin-bottom: 10px;">
            * ${t('sorted_by_sales_desc')}
          </div>
        ` : `
          <!-- Subsequent Pages Header Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 8px;">
            <tr>
              <td style="width: 33%; text-align: right; font-size: 14px; font-weight: 800; color: #021024;">${storeName}</td>
              <td style="width: 34%; text-align: center; font-size: 15px; font-weight: 800; color: #0f172a;">${t('sales_report')} (تابع)</td>
              <td style="width: 33%; text-align: left; font-size: 12px; color: #64748b;" dir="ltr">${formattedDate}</td>
            </tr>
          </table>
        `;

        const pageHtml = `
          <div style="width: 794px; min-height: 1120px; max-height: 1120px; box-sizing: border-box; padding: 25px 30px; background: #ffffff; color: #0f172a; direction: rtl; font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, Roboto, sans-serif; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              ${headerHtml}

              <!-- Table -->
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="background-color: #e6f0ff; color: #021024; border-bottom: 2px solid #94a3b8; height: 34px;">
                    <th style="padding: 6px 10px; text-align: right; font-weight: 800; width: 38%;">${t('product')}</th>
                    <th style="padding: 6px 6px; text-align: center; font-weight: 800; width: 14%;">${t('sold')}</th>
                    <th style="padding: 6px 10px; text-align: left; font-weight: 800; width: 16%;">${t('profit')}</th>
                    <th style="padding: 6px 6px; text-align: center; font-weight: 800; width: 14%;">${t('remaining_qty')}</th>
                    <th style="padding: 6px 10px; text-align: left; font-weight: 800; width: 18%;">${t('remaining_value')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 25px; font-size: 13px;">لا توجد عناصر</td></tr>'}
                </tbody>
              </table>
            </div>

            <!-- Page Footer -->
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 600; color: #64748b;">
              <div>${storeName} — ${t('sales_report')}</div>
              <div>صفحة <strong style="color: #021024;">${pageIdx + 1}</strong> من <strong style="color: #021024;">${totalPages}</strong></div>
              <div dir="ltr">${formattedDate}</div>
            </div>
          </div>
        `;

        const pageContainer = document.createElement('div');
        pageContainer.innerHTML = pageHtml;
        hiddenHost.appendChild(pageContainer);

        await new Promise((resolve) => setTimeout(resolve, 30));

        const pageElem = pageContainer.firstElementChild as HTMLElement;
        const canvas = await html2canvas(pageElem, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: 794,
          windowWidth: 794
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

        if (pageIdx < totalPages - 1) {
          pdf.addPage('a4', 'p');
        }

        hiddenHost.removeChild(pageContainer);
      }

      if (document.body.contains(hiddenHost)) {
        document.body.removeChild(hiddenHost);
      }

      pdf.save(filename);
      showToast(t('pdf_download_success'), 'success');
    } catch (err) {
      console.error("PDF generation error:", err);
      showToast(t('pdf_download_error') + ': ' + String(err), 'error');
    }
  };

  if (showReportView && currentReport) {
    return (
      <InventoryReportView
        report={currentReport}
        products={products}
        onClose={() => {
          setShowReportView(false);
          if (isViewingHistory) {
            setShowHistoryModal(true);
            setIsViewingHistory(false);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6 pb-40 min-h-[100dvh] -mx-2 sm:mx-0 relative" dir="rtl">
      <ExpensesModal
        show={showExpensesModal}
        onClose={() => setShowExpensesModal(false)}
        loading={loadingExpenses}
        amount={expensesAmount}
        shouldDeduct={shouldDeductExpenses}
        onToggleDeduct={() => setShouldDeductExpenses(!shouldDeductExpenses)}
      />

      <HistoryModal
        show={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        loading={loadingHistory}
        reports={historyReports}
        showConfirm={showConfirm}
        onSelectReport={(report) => {
          setCurrentReport(report);
          setShowReportView(true);
          setShowHistoryModal(false);
          setIsViewingHistory(true);
        }}
        onDeleteReport={(reportId) => {
          if (!user) return;
          setHistoryReports(prev => prev.filter(r => r.id !== reportId));
          showToast(t('report_deleted_successfully') || 'Report deleted successfully', 'success');
          
          deleteDoc(doc(db, `users/${user.uid}/reports`, reportId)).catch((error) => {
            console.error("Error deleting report", error);
            showToast(t('error_deleting_report') || 'Error deleting report', 'error');
            // We could optionally revert the deletion in state here, but letting it be is okay.
          });
        }}
      />
      {/* Header Section */}
      <div className="flex items-center justify-between pt-2 px-4 gap-4 min-w-0">
        <div className="text-right space-y-1 shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white leading-tight">{t('jard_monthly')}</h1>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">{t('enter_actual_quantity')}</p>
        </div>
        <button 
          onClick={handleCompleteInventory} 
          className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-brand-600 text-sm font-bold text-white transition-all hover:bg-brand-700 shadow-md shadow-brand-500/20 active:scale-95 whitespace-nowrap"
        >
          <ClipboardCheck size={18} strokeWidth={2.5} />
          <span>{t('save') || 'حفظ'}</span>
        </button>
      </div>

      <div className="flex justify-start gap-2 px-4">
        <button 
          onClick={() => setShowHistoryModal(true)}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg shadow-sm text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform"
          title={t('inventory_log')}
        >
          <FileText size={18} />
        </button>
        <button 
          onClick={() => setShowExpensesModal(true)}
          className={cn(
            "h-10 px-3 flex items-center gap-2 bg-white dark:bg-zinc-900 border rounded-lg shadow-sm active:scale-95 transition-all text-xs font-bold",
            expensesAmount > 0 ? "border-[#B34C36]/20 text-[#B34C36] bg-[#B34C36]/5" : "border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 w-10 justify-center px-0"
          )}
          title={t('expenses')}
        >
          <Wallet size={18} />
          {expensesAmount > 0 && <span>{formatCurrency(expensesAmount, settings.currency, settings.language)}</span>}
        </button>
        <button 
          onClick={() => setShowCompareModal(true)}
          className="h-10 px-3 flex items-center gap-2 bg-brand-50 border border-brand-200 dark:bg-brand-900/20 dark:border-brand-800 text-brand-600 dark:text-brand-400 rounded-lg shadow-sm active:scale-95 transition-all text-sm font-bold"
          title="مقارنة الجرد الذكية"
        >
          <Activity size={18} />
          <span className="hidden sm:inline">مقارنة بـ Excel</span>
        </button>
        <button 
          onClick={() => setShowPrintModal(true)}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg shadow-sm text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform"
          title="طباعة كشف الجرد الورقي"
        >
          <Printer size={18} />
        </button>
        <button 
          onClick={() => setShowDetailedControls(!showDetailedControls)}
          className={cn(
            "w-10 h-10 flex items-center justify-center border rounded-lg shadow-sm active:scale-95 transition-all",
            showDetailedControls 
              ? "bg-brand-600 border-brand-600 text-white shadow-brand-500/20" 
              : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-400"
          )}
          title={t('detailed_inventory_mode')}
        >
          <PlusCircle size={18} />
        </button>
        <button 
          onClick={handleClearInventory}
          className={cn(
            "w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border rounded-lg shadow-sm active:scale-95 transition-transform",
            Object.keys(inventoryData).length > 0 
              ? "text-white shadow-lg shadow-[#B34C36]/20" 
              : "border-zinc-100 dark:border-zinc-800 text-zinc-300 dark:text-zinc-700"
          )}
          style={Object.keys(inventoryData).length > 0 ? { backgroundColor: '#B34C36', borderColor: '#B34C36' } : {}}
          title={t('confirm_clear_quantities')}
        >
          <Trash2 size={18} />
        </button>
        <button 
          onClick={handleAutoFillTest}
          className="h-10 px-3 flex items-center gap-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/30 rounded-lg shadow-sm active:scale-95 transition-all text-xs font-bold"
          title="ملء القيمة 0 لجميع المنتجات للاختبار"
        >
          <FlaskConical size={16} />
          <span className="hidden sm:inline">ملء القيمة 0 للاختبار</span>
          <span className="sm:hidden">ملء 0 تجريبي</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 px-4">
        <div className="flex justify-between items-center text-[9px] font-black text-zinc-400 uppercase tracking-widest">
          <span className="text-brand-500">{progress}%</span>
          <span>{t('overall_progress')}</span>
        </div>
        <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-brand-500 rounded-full" 
          />
        </div>
      </div>

      {/* Search Bar & Categories */}
      <div className="space-y-3 px-4">
        <div className="flex gap-2">
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="w-11 h-11 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm active:scale-95"
          >
            <ScanBarcode size={20} className="text-zinc-400" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
            <input 
              type="search"
              name="inventory_search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
              className="w-full h-11 pr-10 pl-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none text-[13px] placeholder:text-zinc-300"
              placeholder={t('search_product_inventory_placeholder')} 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative group/filter flex-1" ref={categoryRef}>
            <button 
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className="w-full flex items-center justify-between py-2.5 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[13px] font-bold text-zinc-600 dark:text-zinc-400 outline-none hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm focus:border-brand-500/50"
            >
              <span className="truncate flex-1 text-center">{categoryFilter === 'all' ? t('all_categories_filter') : t(categories.find(c => c.name === categoryFilter)?.key || categoryFilter)}</span>
              <svg className="h-4 w-4 fill-current text-zinc-400 shrink-0" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
            </button>
            {categoryDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-full max-h-[300px] overflow-y-auto z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1">
                <button
                  onClick={() => {
                    setCategoryFilter('all');
                    setCategoryDropdownOpen(false);
                  }}
                  className={cn(
                    "w-full text-right px-4 py-2 text-[13px] hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors truncate",
                    categoryFilter === 'all' ? "text-brand-600 font-bold bg-brand-50/50 dark:bg-brand-900/10 dark:text-brand-400" : "text-zinc-600 dark:text-zinc-400"
                  )}
                >
                  {t('all_categories_filter')}
                </button>
                {categories.map((c, index) => (
                  <button
                    key={`${c.id}-${index}`}
                    onClick={() => {
                      setCategoryFilter(c.name);
                      setCategoryDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-right px-4 py-2 text-[13px] hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors truncate",
                      categoryFilter === c.name ? "text-brand-600 font-bold bg-brand-50/50 dark:bg-brand-900/10 dark:text-brand-400" : "text-zinc-600 dark:text-zinc-400"
                    )}
                  >
                    {t(c.key || c.name)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowUninventoriedOnly(!showUninventoriedOnly)}
            className={cn(
              "px-4 py-2.5 rounded-lg border text-[13px] font-bold transition-all whitespace-nowrap",
              showUninventoriedOnly 
                ? "bg-brand-500 border-brand-500 text-white shadow-md shadow-brand-500/20" 
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            )}
          >
            {t('not_inventoried')}
          </button>
        </div>
      </div>

      {/* Product List */}
      <div className="grid grid-cols-1 gap-2 px-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {sortedProducts.map((p) => (
              <InventoryItem
                key={p.id}
                product={p}
                inventoryQuantity={inventoryData[p.id]}
                isChecked={!!checkedProducts[p.id]}
                showDetailedControls={showDetailedControls}
                onToggleCheck={toggleChecked}
                onAddPiece={handleAddPiece}
                onAddCarton={handleAddCarton}
                onChangeQuantity={handleChangeQuantity}
              />
            ))}
            
            {filteredProducts.length === 0 && (
              <div className="text-center py-20 text-zinc-300 text-sm">
                {t('no_products_found')}
              </div>
            )}
          </>
        )}
      </div>

      {/* Pagination */}
      <ProductPagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Custom Alert/Confirm Modal */}
      <AnimatePresence>
        {modalConfig.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-[280px] bg-white dark:bg-zinc-900 rounded-lg p-6 shadow-2xl border border-zinc-100 dark:border-zinc-800 text-center"
            >
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {modalConfig.message}
              </p>
              
              <div className="flex gap-2">
                {modalConfig.type === 'confirm' ? (
                  <>
                    <button 
                      onClick={() => {
                        setModalConfig(prev => ({ ...prev, show: false }));
                        modalConfig.onConfirm?.();
                      }}
                      className="flex-1 py-2.5 text-white rounded-lg text-[12px] font-black active:scale-95 transition-all shadow-lg shadow-[#B34C36]/20"
                      style={{ backgroundColor: '#B34C36' }}
                    >
                      {t('confirm')}
                    </button>
                    <button 
                      onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                      className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-[12px] font-bold active:scale-95 transition-all"
                    >
                      {t('cancel')}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                    className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-[12px] font-black active:scale-95 transition-all"
                  >
                    {t('ok')}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      <BarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
        tabId="inventory"
      />
      
      <InventoryCompareModal 
        show={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        currentReportItems={getDraftItems()}
        products={products}
      />

      <InventoryPrintModal 
        show={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        products={groupedProducts}
        categories={categories}
      />
    </div>
  );
}

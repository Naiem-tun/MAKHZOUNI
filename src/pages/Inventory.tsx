import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, ScanBarcode, CheckCircle2, Check,
  Package, Wallet, FileText, ClipboardCheck, Trash2, History,
  X, PlusCircle, MinusCircle, ArrowRight, Download, Receipt, FileBarChart, TrendingUp, Activity, Printer, AlertTriangle,
  Loader2
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
import { ProductPagination } from '../components/products/ProductPagination';
import { useCategories, categoryIcons } from '../hooks/useCategories';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import { Logo } from '../components/UI';
import { InventoryReportView } from '../components/inventory/InventoryReportView';
import { HistoryModal } from '../components/inventory/HistoryModal';
import { ExpensesModal } from '../components/inventory/ExpensesModal';
import { InventoryCompareModal } from '../components/inventory/InventoryCompareModal';
import { InventoryPrintModal } from '../components/inventory/InventoryPrintModal';
import { DamageModal } from '../components/inventory/DamageModal';

import { InventoryItem } from '../components/inventory/InventoryItem';
import { useTranslation } from 'react-i18next';
import { logAudit } from '../lib/auditLogger';
import { 
  evaluateItemPriceHike, 
  calculatePriceHikeSummary, 
  PRICE_HIKE_COUNTER_DOC_PATH, 
  EvaluatedItemResult 
} from '../lib/priceHikeTracker';
import { InventoryLayer } from '../types';
import { useFolioTheme } from '../components/folio/FolioPageChrome';
import { matchesQuery } from '../components/dashboard/PurchaseVarianceModal';




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
  const { user, settings, showToast, setActiveTab } = useAppContext();
  const { categories } = useCategories();
  const { theme } = useFolioTheme(
    Boolean(settings.darkMode),
    settings.folioThemeId,
  );
  const showFinancials = settings.showFinancials ?? true;
  const language = settings.language || 'ar';
  const formatPrivateValue = (val: number) =>
    !showFinancials ? '••••••' : formatCurrency(val, settings.currency, language);
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
  const [latestReport, setLatestReport] = useState<any>(null);
  const [allPurchases, setAllPurchases] = useState<any[]>([]);
  const [activeCounterAmount, setActiveCounterAmount] = useState<number>(0);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, any> = {};

    products.forEach(p => {
      const key = (p.barcode || p.name || "").trim().toLowerCase();
      
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

  const priceHikeCalculation = useMemo(() => {
    if (!groupedProducts || groupedProducts.length === 0) return null;

    const lastJardTime = latestReport ? safeParseDate(latestReport.date).getTime() : 0;
    
    // 1. Filter purchases since last Jard timestamp strictly
    const periodPurchases = allPurchases.filter(p => {
      const pTime = safeParseDate(p.date).getTime();
      return pTime > lastJardTime;
    });

    // 2. Build map of previous report items for opening balance
    const reportItemsMap = new Map<string, any>();
    let hasEstimatedOpening = false;

    if (latestReport && Array.isArray(latestReport.items)) {
      latestReport.items.forEach((it: any) => {
        const barcodeKey = (it.barcode || '').trim().toLowerCase();
        const nameKey = (it.productName || '').trim().toLowerCase();
        if (barcodeKey) reportItemsMap.set(barcodeKey, it);
        if (nameKey) reportItemsMap.set(nameKey, it);
      });
    } else {
      hasEstimatedOpening = true;
    }

    const evaluatedResults: EvaluatedItemResult[] = [];

    groupedProducts.forEach((group: any) => {
      const actualQty = inventoryData[group.id];
      const groupFinalQty = actualQty !== undefined ? Number(actualQty) : Number(group.quantity || 0);

      const barcodeKey = (group.barcode || '').trim().toLowerCase();
      const nameKey = (group.name || '').trim().toLowerCase();
      
      let matchedReportItem = barcodeKey ? reportItemsMap.get(barcodeKey) : null;
      let matchType: 'barcode' | 'id' | 'name' = 'barcode';

      if (!matchedReportItem && nameKey) {
        matchedReportItem = reportItemsMap.get(nameKey);
        matchType = 'name';
      }

      let openingLayers: InventoryLayer[] = [];
      if (matchedReportItem?.remainingLayers && Array.isArray(matchedReportItem.remainingLayers) && matchedReportItem.remainingLayers.length > 0) {
        openingLayers = matchedReportItem.remainingLayers;
      } else if (matchedReportItem) {
        openingLayers = [{
          qty: cleanQuantity(matchedReportItem.quantityAfter || 0),
          cost: roundMoney(matchedReportItem.purchasePrice || group.purchasePrice || 0)
        }];
        hasEstimatedOpening = true;
      } else {
        openingLayers = [{
          qty: cleanQuantity(group.quantity || 0),
          cost: roundMoney(group.purchasePrice || 0)
        }];
        hasEstimatedOpening = true;
      }

      // Filter period purchases for this group
      const groupOriginalIds = new Set(group.originalProducts?.map((p: any) => p.id) || [group.id]);
      const groupPurchases = periodPurchases.filter(p => {
        if (group.barcode && p.barcode && p.barcode.trim() === group.barcode.trim()) return true;
        if (p.productId && groupOriginalIds.has(p.productId)) return true;
        if (p.productName && p.productName.trim().toLowerCase() === nameKey) return true;
        return false;
      });

      const evalResult = evaluateItemPriceHike({
        productId: group.id,
        productName: group.name,
        barcode: group.barcode || '',
        openingLayers,
        periodPurchases: groupPurchases,
        quantityBefore: Number(group.quantity || 0),
        quantityAfter: groupFinalQty,
        sellingPrice: Number(group.sellingPrice || 0),
        fallbackPurchasePrice: Number(group.purchasePrice || 0),
        matchType
      });

      evaluatedResults.push(evalResult);
    });

    const summary = calculatePriceHikeSummary(
      evaluatedResults,
      activeCounterAmount,
      hasEstimatedOpening
    );

    return { evaluatedResults, summary };
  }, [groupedProducts, inventoryData, latestReport, allPurchases, activeCounterAmount]);

  const ITEMS_PER_PAGE = 20;

  const [isSavingInventory, setIsSavingInventory] = useState(false);

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
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageAmount, setDamageAmount] = useState(0);
  const [damageCount, setDamageCount] = useState(0);
  
  const [showReportView, setShowReportView] = useState(false);
  const [currentReport, setCurrentReport] = useState<any>(null);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showDetailedControls, setShowDetailedControls] = useState(() => {
    return localStorage.getItem('detailed_inventory_mode') === 'true';
  });

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'zero_stock'>('all');
  const [stockDropdownOpen, setStockDropdownOpen] = useState(false);
  const stockFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
      if (stockFilterRef.current && !stockFilterRef.current.contains(event.target as Node)) {
        setStockDropdownOpen(false);
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
    
    const foundProduct = groupedProducts.find(p => p.barcode === decodedText || p.id === (decodedText || "").toLowerCase());
    
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
    return groupedProducts.map(group => {
      const actualQty = inventoryData[group.id];
      const finalQty = actualQty !== undefined ? Number(actualQty) : Number(group.quantity || 0);
      const sold = Number(group.quantity || 0) - finalQty;
      const purchasePrice = roundMoney(Number(group.purchasePrice || group.costPrice || 0));
      const remainingValue = roundMoney(finalQty * purchasePrice);
      const revenue = roundMoney(sold * Number(group.sellingPrice || 0));
      const profit = roundMoney(revenue - (sold * purchasePrice));
      
      const isSurplus = sold < 0;
      const surplusQuantity = isSurplus ? Math.abs(sold) : 0;
      const surplusCostValue = isSurplus ? roundMoney(surplusQuantity * purchasePrice) : 0;

      const evalItem = priceHikeCalculation?.evaluatedResults.find(r => r.productId === group.id);

      return {
        productName: group.name || '', 
        category: group.category || '',
        barcode: group.barcode || '',
        purchasePrice,
        sellingPrice: group.sellingPrice || 0,
        quantityBefore: group.quantity || 0, 
        quantityAfter: finalQty, 
        salesCalculated: sold, 
        profit: sold > 0 ? profit : 0,
        remainingValue,
        isSurplus,
        surplusQuantity,
        surplusCostValue,
        remainingLayers: (evalItem?.remainingLayers || []).map(l => ({
          qty: cleanQuantity(l.qty || 0),
          cost: roundMoney(l.cost || 0),
          date: l.date || null
        })),
        loss: evalItem?.loss || 0,
        latestCost: evalItem?.latestCost || purchasePrice,
        batchCost: evalItem?.batchCost || purchasePrice,
        matchType: evalItem?.matchType || 'barcode'
      };
    });
  }, [groupedProducts, inventoryData, priceHikeCalculation]);

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

  useEffect(() => {
    if (!user) return;
    const damageLogsPath = `users/${user.uid}/damage_logs`;
    const q = query(
      collection(db, damageLogsPath),
      where("audited", "==", false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data());
      const total = items.reduce((acc: number, item: any) => acc + (item.totalLoss || 0), 0);
      setDamageAmount(roundMoney(total));
      setDamageCount(snapshot.docs.length);
    }, (err) => {
      console.error("Damage logs listener error:", err);
    });

    return () => unsubscribe();
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
      })).sort((a: any, b: any) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());
      setHistoryReports(reports);
      if (reports.length > 0) {
        setLatestReport(reports[0]);
      }
    } catch (err) {
      console.error("Fetch history failed:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchHistory();

    const purchasesPath = `users/${user.uid}/purchases`;
    const unsubPurchases = onSnapshot(collection(db, purchasesPath), (snap) => {
      setAllPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Purchases listener error in Inventory:", err));

    const counterRef = doc(db, PRICE_HIKE_COUNTER_DOC_PATH(user.uid));
    const unsubCounter = onSnapshot(counterRef, (snap) => {
      if (snap.exists()) {
        setActiveCounterAmount(Number(snap.data().currentAmount) || 0);
      } else {
        setActiveCounterAmount(0);
      }
    }, (err) => console.error("Counter listener error in Inventory:", err));

    return () => {
      unsubPurchases();
      unsubCounter();
    };
  }, [user]);

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

  // Reset to first page on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, showUninventoriedOnly, stockFilter]);

  const stockStats = useMemo(() => {
    if (!groupedProducts) return { total: 0, inStock: 0, zeroStock: 0 };
    let inStock = 0;
    let zeroStock = 0;
    groupedProducts.forEach(p => {
      const q = cleanQuantity(p.quantity || 0);
      if (q > 0) inStock++;
      else zeroStock++;
    });
    return { total: groupedProducts.length, inStock, zeroStock };
  }, [groupedProducts]);

  const filteredProducts = useMemo(() => {
    if (!groupedProducts) return [];
    const productsToFilter = groupedProducts;
    const s = (searchTerm || '').trim();
    const filtered = productsToFilter.filter((p: any) => {
      const matchSearch =
        !s ||
        matchesQuery(p.name || '', s) ||
        (p.barcode || '').toLowerCase().includes(s.toLowerCase()) ||
        (p.barcode2 || '').toLowerCase().includes(s.toLowerCase());
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      const matchUninventoried = !showUninventoriedOnly || !checkedProducts[p.id];

      const qty = cleanQuantity(p.quantity || 0);
      let matchStock = true;
      if (stockFilter === 'in_stock') {
        matchStock = qty > 0;
      } else if (stockFilter === 'zero_stock') {
        matchStock = qty <= 0;
      }

      return matchSearch && matchCat && matchUninventoried && matchStock;
    });

    return [...filtered].sort((a, b) => {
      const categoryCompare = (a.category || '').localeCompare(b.category || '', settings.language);
      if (categoryCompare !== 0) return categoryCompare;
      return (a.name || '').localeCompare(b.name || '', settings.language);
    });
  }, [groupedProducts, searchTerm, categoryFilter, showUninventoriedOnly, stockFilter, checkedProducts]);

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

  const handleCompleteInventory = async () => {
    if (!user) return;
    if (isSavingInventory) return;
    if (Object.keys(inventoryData).length === 0) {
      showAlert(t('enter_inventory_data_first'));
      return;
    }
    
    showConfirm(t('confirm_save_inventory'), async () => {
      setIsSavingInventory(true);
      try {
        const auditTime = serverTimestamp();
        const localNow = new Date();
        const writeOperations: Array<{
          type: 'set' | 'update' | 'delete';
          ref: any;
          data?: any;
          options?: { merge?: boolean };
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
          
          const evalItem = priceHikeCalculation?.evaluatedResults?.find(r => r.productId === group.id);
          items.push({ 
            productName: group.name || '', 
            category: group.category || '',
            barcode: group.barcode || '',
            purchasePrice: roundMoney(Number(group.purchasePrice || 0)),
            sellingPrice: roundMoney(Number(group.sellingPrice || 0)),
            quantityBefore: Number(group.quantity || 0), 
            quantityAfter: Number(groupFinalQty || 0), 
            salesCalculated: Number(sold || 0), 
            profit: sold > 0 ? roundMoney(groupProfit) : 0,
            remainingValue: roundMoney(groupRemainingValue || 0),
            isSurplus: Boolean(isSurplus),
            surplusQuantity: Number(surplusQuantity || 0),
            surplusCostValue: roundMoney(surplusCostValue || 0),
            remainingLayers: (evalItem?.remainingLayers || []).map(l => ({
              qty: cleanQuantity(l.qty || 0),
              cost: roundMoney(l.cost || 0),
              date: l.date || null
            })),
            loss: Number(evalItem?.loss || 0),
            latestCost: Number(evalItem?.latestCost || group.purchasePrice || 0),
            batchCost: Number(evalItem?.batchCost || group.purchasePrice || 0),
            matchType: evalItem?.matchType || 'barcode'
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

        // Parallel fetch for expenses, damage logs, and metadata for maximum speed
        const expensesPath = `users/${user.uid}/expenses`;
        const expensesQuery = query(
          collection(db, expensesPath),
          where("audited", "==", false)
        );
        const damageLogsPath = `users/${user.uid}/damage_logs`;
        const damageLogsQuery = query(
          collection(db, damageLogsPath),
          where("audited", "==", false)
        );
        const profilePath = `users/${user.uid}/profile`;
        const metaQuery = query(collection(db, profilePath), where("type", "==", "inventory_metadata"));

        const [expensesSnapshot, damageLogsSnapshot, finalMetaDocs] = await Promise.all([
          getDocs(expensesQuery),
          getDocs(damageLogsQuery),
          getDocs(metaQuery)
        ]);

        const actualExpensesAmount = roundMoney(expensesSnapshot.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0));
        const finalExpensesAmount = shouldDeductExpenses ? actualExpensesAmount : 0;
        const netProfit = roundMoney(totalProfit - finalExpensesAmount);

        const damageItems = damageLogsSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            productName: d.productName || d.name || '',
            quantity: Number(d.quantity || 0),
            costPrice: Number(d.costPrice || 0),
            totalLoss: Number(d.totalLoss || 0),
            date: d.date || null,
            reason: d.reason || '',
            barcode: d.barcode || ''
          };
        });
        const totalDamageLoss = roundMoney(damageItems.reduce((acc, item: any) => acc + (item.totalLoss || 0), 0));

        // Prepare Report
        const reportsPath = `users/${user.uid}/reports`;
        const reportRef = doc(collection(db, reportsPath));
        writeOperations.push({
          type: 'set',
          ref: reportRef,
          data: {
            date: auditTime,
            totalRevenue: roundMoney(totalRevenue || 0),
            totalProfit: roundMoney(totalProfit || 0),
            totalRemainingValue: roundMoney(totalRemainingValue || 0),
            surplusValueUnverified: roundMoney(surplusValueUnverified || 0),
            surplusItemsCount: Number(surplusItemsCount || 0),
            surplusTotalQuantity: Number(surplusTotalQuantity || 0),
            totalExpenses: roundMoney(finalExpensesAmount || 0), 
            netProfit: roundMoney(netProfit || 0),
            items,
            damageItems, // Save damage items
            totalDamageLoss: roundMoney(totalDamageLoss || 0), // Save total damage loss
            type: 'inventory',
            expensesDeducted: Boolean(shouldDeductExpenses),
            priceHikeSummary: null,
            priceHikeSinceLastJard: Number(activeCounterAmount || 0)
          }
        });

        // Save last inventory audit date for optional period filtering without wiping the cumulative counter
        const counterRef = doc(db, PRICE_HIKE_COUNTER_DOC_PATH(user.uid));
        writeOperations.push({
          type: 'set',
          ref: counterRef,
          options: { merge: true },
          data: {
            lastResetDate: auditTime,
            lastResetReportId: reportRef.id || '',
            priceHikeAtAudit: Number(activeCounterAmount || 0)
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

        // Mark damage logs as audited
        damageLogsSnapshot.docs.forEach(damageDoc => {
          writeOperations.push({
            type: 'update',
            ref: doc(db, damageLogsPath, damageDoc.id),
            data: {
              audited: true,
              reportId: reportRef.id,
              auditedAt: auditTime
            }
          });
        });

        // Update meta
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
        await commitBatchesInChunks(db, writeOperations, writeBatch);

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
          expensesDeducted: shouldDeductExpenses,
          priceHikeSummary: null,
          priceHikeSinceLastJard: activeCounterAmount
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
        console.error("Inventory save error:", err);
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/inventory`);
      } finally {
        setIsSavingInventory(false);
      }
    });
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

  const countedItemsCount = Object.keys(inventoryData).length;

  return (
    <div
      className="min-h-screen px-2.5 sm:px-5 pt-3 pb-36 transition-colors relative"
      style={{ backgroundColor: theme.bg, color: theme.text }}
      dir="rtl"
    >
      <ExpensesModal
        show={showExpensesModal}
        onClose={() => setShowExpensesModal(false)}
        loading={loadingExpenses}
        amount={expensesAmount}
        shouldDeduct={shouldDeductExpenses}
        onToggleDeduct={() => setShouldDeductExpenses(!shouldDeductExpenses)}
      />

      <DamageModal
        show={showDamageModal}
        onClose={() => setShowDamageModal(false)}
        products={products}
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
          setHistoryReports((prev) => prev.filter((r) => r.id !== reportId));
          showToast(t('report_deleted_successfully') || 'Report deleted successfully', 'success');

          deleteDoc(doc(db, `users/${user.uid}/reports`, reportId)).catch((error) => {
            console.error('Error deleting report', error);
            showToast(t('error_deleting_report') || 'Error deleting report', 'error');
          });
        }}
      />

      <div className="max-w-6xl mx-auto space-y-5">
        {/* FOLIO HEADER */}
        <header
          className="border-b pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-right"
          style={{ borderColor: theme.border }}
        >
          <div className="space-y-1 min-w-0">
            <div
              className="flex items-center gap-2 text-xs font-bold"
              style={{ color: theme.textMuted }}
            >
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                FOLIO
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{t('enter_actual_quantity')}</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-black tracking-tight leading-tight"
              style={{ color: theme.text }}
            >
              {t('jard_monthly')}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleCompleteInventory}
              disabled={isSavingInventory}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border text-xs font-black transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              style={{
                backgroundColor: theme.text,
                borderColor: theme.text,
                color: theme.surface,
              }}
            >
              {isSavingInventory ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{t('saving') || 'جارٍ الحفظ...'}</span>
                </>
              ) : (
                <>
                  <ClipboardCheck size={14} />
                  <span>{t('save') || 'حفظ الجرد'}</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* FOLIO TOOLBAR */}
        <div
          className="border p-2 flex flex-wrap items-center justify-between gap-2"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text,
              }}
              title={t('inventory_log')}
            >
              <History size={14} style={{ color: theme.textMuted }} />
              <span className="hidden sm:inline">{t('inventory_log') || 'سجل الجرد'}</span>
              {historyReports.length > 0 && (
                <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                  ({historyReports.length})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('reports');
                window.dispatchEvent(new CustomEvent('open-analytics-tab', { detail: 'inventory_intel' }));
              }}
              className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text,
              }}
              title="تحليلات واستخبارات الجرد"
            >
              <TrendingUp size={14} style={{ color: theme.accent }} />
              <span className="hidden sm:inline">تحليلات الجرد</span>
            </button>

            <button
              type="button"
              onClick={() => setShowExpensesModal(true)}
              className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.bg,
                borderColor: expensesAmount > 0 ? theme.negative : theme.border,
                color: expensesAmount > 0 ? theme.negative : theme.text,
              }}
              title={t('expenses')}
            >
              <Wallet size={14} />
              <span className="hidden md:inline">{t('expenses')}</span>
              {expensesAmount > 0 ? (
                <span className="font-mono tabular-nums font-black">
                  {formatPrivateValue(expensesAmount)}
                </span>
              ) : (
                <span className="sm:hidden">{t('expenses')}</span>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.accent,
              }}
              title="مقارنة الجرد الذكية بـ Excel"
            >
              <Activity size={14} />
              <span className="hidden md:inline">مقارنة بـ Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="w-9 h-9 flex items-center justify-center border transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text,
              }}
              title="طباعة كشف الجرد الورقي"
            >
              <Printer size={15} />
            </button>

            <button
              type="button"
              onClick={() => setShowDetailedControls(!showDetailedControls)}
              className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: showDetailedControls ? theme.accent : theme.bg,
                borderColor: showDetailedControls ? theme.accent : theme.border,
                color: showDetailedControls ? theme.accentText : theme.text,
              }}
              title={t('detailed_inventory_mode')}
            >
              <PlusCircle size={14} />
              <span className="hidden sm:inline">تفصيلي</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDamageModal(true)}
              className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.bg,
                borderColor: damageCount > 0 ? theme.negative : theme.border,
                color: damageCount > 0 ? theme.negative : theme.text,
              }}
              title="تسجيل وإدارة التالف"
            >
              <AlertTriangle size={14} />
              <span className="hidden sm:inline">التالف</span>
              {damageCount > 0 && (
                <span className="font-mono tabular-nums font-black">({damageCount})</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleClearInventory}
              className="w-9 h-9 flex items-center justify-center border transition-colors cursor-pointer"
              style={{
                backgroundColor: countedItemsCount > 0 ? theme.negative : theme.bg,
                borderColor: countedItemsCount > 0 ? theme.negative : theme.border,
                color: countedItemsCount > 0 ? '#FFFFFF' : theme.textMuted,
              }}
              title={t('confirm_clear_quantities')}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* SECTION 01: PROGRESS & INVENTORY KPI STRIP */}
        <section
          className="border text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="grid grid-cols-3 divide-x divide-x-reverse"
            style={{ borderColor: theme.border }}
          >
            <div className="p-3.5 space-y-0.5" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                {t('overall_progress')}
              </div>
              <div
                className="text-xl font-black font-mono tabular-nums"
                style={{ color: theme.accent }}
              >
                {progress}%
              </div>
            </div>
            <div className="p-3.5 space-y-0.5" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                تم إدخال كميتها
              </div>
              <div className="text-xl font-black font-mono tabular-nums">
                {countedItemsCount} / {groupedProducts.length}
              </div>
            </div>
            <div className="p-3.5 space-y-0.5" style={{ borderColor: theme.border }}>
              <div className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                متوفر / رصيد صفر
              </div>
              <div className="text-xl font-black font-mono tabular-nums">
                {stockStats.inStock}{' '}
                <span className="text-xs font-normal" style={{ color: theme.textMuted }}>
                  / {stockStats.zeroStock}
                </span>
              </div>
            </div>
          </div>

          <div
            className="h-1 w-full overflow-hidden border-t"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full"
              style={{ backgroundColor: theme.accent }}
            />
          </div>
        </section>

        {/* SEARCH & FILTERS */}
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="w-11 h-11 shrink-0 flex items-center justify-center border transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
              title="مسح الباركود"
            >
              <ScanBarcode size={18} />
            </button>
            <div
              className="flex-1 flex items-center gap-2 border px-3"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <Search size={16} style={{ color: theme.textMuted }} className="shrink-0" />
              <input
                type="search"
                name="inventory_search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                className="w-full h-11 bg-transparent outline-none text-xs sm:text-sm"
                style={{ color: theme.text }}
                placeholder={t('search_product_inventory_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="مسح البحث"
                  className="cursor-pointer"
                  style={{ color: theme.textMuted }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <div className="relative flex-1 min-w-[130px]" ref={categoryRef}>
              <button
                type="button"
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className="w-full h-10 flex items-center justify-between px-3 border text-xs font-bold outline-none transition-colors cursor-pointer"
                style={{
                  backgroundColor: categoryFilter !== 'all' ? theme.text : theme.surface,
                  borderColor: categoryFilter !== 'all' ? theme.text : theme.border,
                  color: categoryFilter !== 'all' ? theme.surface : theme.text,
                }}
              >
                <span className="truncate flex-1 text-right">
                  {categoryFilter === 'all'
                    ? t('all_categories_filter')
                    : t(categories.find((c) => c.name === categoryFilter)?.key || categoryFilter)}
                </span>
                <svg className="h-4 w-4 fill-current opacity-60 shrink-0" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </button>
              {categoryDropdownOpen && (
                <div
                  className="absolute top-full right-0 mt-1 w-full max-h-[300px] overflow-y-auto z-50 border shadow-xl py-1"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter('all');
                      setCategoryDropdownOpen(false);
                    }}
                    className="w-full text-right px-3.5 py-2 text-xs font-bold transition-colors truncate cursor-pointer"
                    style={{
                      backgroundColor: categoryFilter === 'all' ? theme.surfaceMuted : 'transparent',
                      color: categoryFilter === 'all' ? theme.accent : theme.text,
                    }}
                  >
                    {t('all_categories_filter')}
                  </button>
                  {categories.map((c, index) => (
                    <button
                      type="button"
                      key={`${c.id}-${index}`}
                      onClick={() => {
                        setCategoryFilter(c.name);
                        setCategoryDropdownOpen(false);
                      }}
                      className="w-full text-right px-3.5 py-2 text-xs font-bold transition-colors truncate cursor-pointer"
                      style={{
                        backgroundColor:
                          categoryFilter === c.name ? theme.surfaceMuted : 'transparent',
                        color: categoryFilter === c.name ? theme.accent : theme.text,
                      }}
                    >
                      {t(c.key || c.name)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={stockFilterRef}>
              <button
                type="button"
                onClick={() => setStockDropdownOpen(!stockDropdownOpen)}
                className="h-10 px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                style={{
                  backgroundColor: stockFilter !== 'all' ? theme.text : theme.surface,
                  borderColor: stockFilter !== 'all' ? theme.text : theme.border,
                  color: stockFilter !== 'all' ? theme.surface : theme.text,
                }}
                title="فلترة حسب كمية المخزون"
              >
                <span>
                  {stockFilter === 'all' && 'الكمية: الكل'}
                  {stockFilter === 'in_stock' && 'المتوفر فقط (>0)'}
                  {stockFilter === 'zero_stock' && 'غير متوفر (كمية 0)'}
                </span>
                <svg className="h-4 w-4 fill-current opacity-60 shrink-0" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </button>

              {stockDropdownOpen && (
                <div
                  className="absolute top-full right-0 mt-1 min-w-[215px] z-50 border shadow-xl py-1 overflow-hidden"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  {[
                    { id: 'all', label: 'جميع المنتجات (الكل)', count: stockStats.total },
                    { id: 'in_stock', label: 'المتوفر فقط (إخفاء كمية 0)', count: stockStats.inStock },
                    { id: 'zero_stock', label: 'غير المتوفرة فقط (كمية 0)', count: stockStats.zeroStock },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => {
                        setStockFilter(opt.id as any);
                        setStockDropdownOpen(false);
                      }}
                      className="w-full text-right px-3.5 py-2 text-xs font-bold transition-colors flex items-center justify-between cursor-pointer"
                      style={{
                        backgroundColor:
                          stockFilter === opt.id ? theme.surfaceMuted : 'transparent',
                        color: stockFilter === opt.id ? theme.accent : theme.text,
                      }}
                    >
                      <span>{opt.label}</span>
                      <span className="font-mono tabular-nums opacity-70">({opt.count})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowUninventoriedOnly(!showUninventoriedOnly)}
              className="h-10 px-3 border text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
              style={{
                backgroundColor: showUninventoriedOnly ? theme.accent : theme.surface,
                borderColor: showUninventoriedOnly ? theme.accent : theme.border,
                color: showUninventoriedOnly ? theme.accentText : theme.text,
              }}
            >
              {t('not_inventoried')}
            </button>
          </div>
        </div>

        {/* SECTION 02: INVENTORY ITEMS LIST */}
        <section
          className="border text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="px-4 py-2.5 border-b flex items-center justify-between"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                02
              </span>
              <span>جدول عدّ المخزون</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
              {filteredProducts.length} صنف
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div
                className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: theme.accent, borderTopColor: 'transparent' }}
              />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-14 text-xs font-bold" style={{ color: theme.textMuted }}>
              {t('no_products_found')}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: theme.border }}>
              {sortedProducts.map((p, index) => (
                <InventoryItem
                  key={p.id}
                  product={p}
                  sequenceNumber={(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                  inventoryQuantity={inventoryData[p.id]}
                  isChecked={!!checkedProducts[p.id]}
                  showDetailedControls={showDetailedControls}
                  onToggleCheck={toggleChecked}
                  onAddPiece={handleAddPiece}
                  onAddCarton={handleAddCarton}
                  onChangeQuantity={handleChangeQuantity}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </section>

        {/* Pagination */}
        <ProductPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          theme={theme}
        />
      </div>

      {/* Custom Alert/Confirm Modal */}
      <AnimatePresence>
        {modalConfig.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalConfig((prev) => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-xs border p-5 text-center shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
              dir="rtl"
            >
              <p className="text-xs font-bold mb-5 leading-relaxed">{modalConfig.message}</p>

              <div className="flex gap-2">
                {modalConfig.type === 'confirm' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setModalConfig((prev) => ({ ...prev, show: false }));
                        modalConfig.onConfirm?.();
                      }}
                      className="flex-1 py-2 text-white border text-xs font-black cursor-pointer"
                      style={{
                        backgroundColor: theme.negative,
                        borderColor: theme.negative,
                      }}
                    >
                      {t('confirm')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalConfig((prev) => ({ ...prev, show: false }))}
                      className="flex-1 py-2 border text-xs font-bold cursor-pointer"
                      style={{
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                    >
                      {t('cancel')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModalConfig((prev) => ({ ...prev, show: false }))}
                    className="w-full py-2 border text-xs font-black cursor-pointer"
                    style={{
                      backgroundColor: theme.accent,
                      borderColor: theme.accent,
                      color: theme.accentText,
                    }}
                  >
                    {t('ok')}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-screen Loading Overlay during Inventory Save */}
      <AnimatePresence>
        {isSavingInventory && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              className="relative w-full max-w-sm border p-6 shadow-2xl text-center flex flex-col items-center"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
              dir="rtl"
            >
              <div
                className="w-12 h-12 border flex items-center justify-center mb-4"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.accent,
                }}
              >
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="text-base font-black mb-2">
                {t('saving_inventory') || 'جارٍ حفظ الجرد وتحديث المخزون...'}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
                يتم الآن تحديث أرصدة المنتجات في قاعدة البيانات وتسجيل التقرير المالي، يرجى الانتظار لحين اكتمال العملية.
              </p>
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

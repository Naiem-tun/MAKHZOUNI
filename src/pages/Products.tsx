import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, OperationType } from '../types';
import { handleFirestoreError, cn } from '../lib/utils';
import { 
  Plus, 
  Search, 
  Filter, 
  ScanBarcode,
  Layers,
  Package,
  History,
  AlertCircle,
  Shield,
  X
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { ProductPagination } from '../components/products/ProductPagination';
import { DeleteConfirmationModal } from '../components/products/DeleteConfirmationModal';
import { AddQuantityModal } from '../components/products/AddQuantityModal';
import { ProductEditModal } from '../components/products/ProductEditModal';
import { PriceNegotiationModal } from '../components/products/PriceNegotiationModal';
import { ProductsHeader } from '../components/products/ProductsHeader';
import { ProductsFilters } from '../components/products/ProductsFilters';
import { ProductsList } from '../components/products/ProductsList';
import { CustomConfirmModal } from '../components/common/CustomConfirmModal';
import { useCategories } from '../hooks/useCategories';

import { BarcodeScanner } from '../components/common/BarcodeScanner';

import { Logo } from '../components/UI';
import { query, orderBy, limit, getDocs, where } from 'firebase/firestore';

export default function Products() {
  const { t } = useTranslation();
  const { user, settings, showToast, setIsDataLoaded, activeSupplier } = useAppContext();
  const { categories } = useCategories();
  const [products, setProducts] = useState<Product[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`products_cache_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(products.length === 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [inventoryReports, setInventoryReports] = useState<any[]>([]);

  useEffect(() => {
    if (!user || sortBy !== 'most_sold') return;
    const reportsPath = `users/${user.uid}/reports`;
    const reportsQuery = query(collection(db, reportsPath), where('type', '==', 'inventory'), orderBy('date', 'desc'), limit(1));
    const unsub = onSnapshot(reportsQuery, (snap) => {
      setInventoryReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, [user, sortBy]);

  const salesMap = useMemo(() => {
    if (inventoryReports.length === 0) return {};
    const items = inventoryReports[0].items || [];
    const map: Record<string, number> = {};
    items.forEach((item: any) => {
      if (item.productName) map[item.productName] = item.salesCalculated || 0;
    });
    return map;
  }, [inventoryReports]);

  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'available', 'low', 'out'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showBoxInfo, setShowBoxInfo] = useState(() => {
    const saved = localStorage.getItem('products_showBoxInfo');
    return saved === 'true';
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'search' | 'barcode-field' | 'barcode2-field'>('search');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scannedBarcode2, setScannedBarcode2] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [quantityProduct, setQuantityProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [lastPurchaseInfo, setLastPurchaseInfo] = useState<any>(null);
  const [isNegotiationModalOpen, setIsNegotiationModalOpen] = useState(false);
  const [negotiationProducts, setNegotiationProducts] = useState<Product[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [modalConfig, setModalConfig] = useState<{
    show: boolean;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({ show: false, message: '', type: 'alert' });

  const showConfirm = (message: string, onConfirm: () => void) => {
    setModalConfig({ show: true, message, type: 'confirm', onConfirm });
  };

  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/products`;
    const q = collection(db, path);
    return onSnapshot(q, (snap) => {
      const fetchedProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(fetchedProducts);
      localStorage.setItem(`products_cache_${user.uid}`, JSON.stringify(fetchedProducts));
      setLoading(false);
      setIsDataLoaded(true);
    }, (error) => {
      setLoading(false);
      setIsDataLoaded(true);
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }, [user, setIsDataLoaded]);

  // Reset to first page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDelete = () => {
    if (!user || !productToDelete) return;
    
    // UI feedback: close modal immediately
    setIsDeleteModalOpen(false);
    const path = `users/${user.uid}/products/${productToDelete.id}`;
    
    deleteDoc(doc(db, path))
      .then(() => {
        setProductToDelete(null);
      })
      .catch(err => {
        handleFirestoreError(err, OperationType.DELETE, path);
      });
  };

  const performQuantitySave = async (numBoxes: number, extraPieces: number, boxPrice: number, piecePrice: number) => {
    if (!user || !quantityProduct) return;

    const addedQty = (numBoxes * (quantityProduct.piecesPerBox || 1)) + extraPieces;
    const newQty = (quantityProduct.quantity || 0) + addedQty;

    // UI feedback: close modal immediately
    setIsQuantityModalOpen(false);
    setQuantityProduct(null);
    showToast(t('stock_updated_success'));

    try {
      const batch = writeBatch(db);
      const productRef = doc(db, `users/${user.uid}/products/${quantityProduct.id}`);
      const purchasesPath = `users/${user.uid}/purchases`;
      const purchaseRef = doc(collection(db, purchasesPath));
      
      const purchaseAmount = (numBoxes * boxPrice) + (extraPieces * piecePrice);

      // Record the purchase transaction
      batch.set(purchaseRef, {
        productId: quantityProduct.id,
        productName: quantityProduct.name,
        qtyAdded: addedQty,
        amount: purchaseAmount,
        price: piecePrice,
        boxPrice: boxPrice,
        numBoxes,
        extraPieces,
        piecesPerBox: quantityProduct.piecesPerBox || 1,
        supplierId: activeSupplier?.id || null,
        supplierName: activeSupplier?.name || null,
        date: serverTimestamp(),
      });

      // Update product stock
      batch.update(productRef, {
        quantity: newQty,
        purchasePrice: piecePrice,
        boxPurchasePrice: boxPrice,
        updatedAt: serverTimestamp(),
      });

      // Commit in the background
      batch.commit().catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/products`);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/products`);
    }
  };

  const handleSaveProduct = async (productData: any) => {
    if (!user) return;
    
    // UI feedback: close modal immediately
    setIsModalOpen(false);
    setEditingProduct(null);
    setScannedBarcode('');
    setScannedBarcode2('');
    showToast(t('product_saved_success'));

    try {
      const batch = writeBatch(db);
      
      if (editingProduct) {
        const path = `users/${user.uid}/products/${editingProduct.id}`;
        updateDoc(doc(db, path), {
          ...productData,
          updatedAt: serverTimestamp(),
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, path);
        });
      } else {
        const path = `users/${user.uid}/products`;
        const purchasesPath = `users/${user.uid}/purchases`;
        
        const productRef = doc(collection(db, path));
        batch.set(productRef, {
          ...productData,
          updatedAt: serverTimestamp(),
        });

        // Record initial stock as a purchase
        if (productData.quantity > 0) {
          const purchaseAmount = productData.quantity * (productData.purchasePrice || 0);
          const purchaseRef = doc(collection(db, purchasesPath));
          batch.set(purchaseRef, {
            productId: productRef.id,
            productName: productData.name,
            qtyAdded: productData.quantity,
            amount: purchaseAmount,
            date: serverTimestamp(),
          });
        }
        
        batch.commit().catch(err => {
          handleFirestoreError(err, OperationType.CREATE, path);
        });
      }
    } catch (err) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE, `users/${user.uid}/products`);
    }
  };

  const fetchLastPurchase = async (productId: string) => {
    if (!user) return null;
    try {
      const q = query(
        collection(db, `users/${user.uid}/purchases`),
        where('productId', '==', productId),
        orderBy('date', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data();
      }
    } catch (err) {
      console.warn("Failed to fetch last purchase:", err);
    }
    return null;
  };

  const fetchPurchaseHistory = async (productId: string) => {
    if (!user) return [];
    try {
      const q = query(
        collection(db, `users/${user.uid}/purchases`),
        where('productId', '==', productId),
        orderBy('date', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => doc.data());
    } catch (err) {
      console.warn("Failed to fetch purchase history:", err);
      return [];
    }
  };

  const handleProductChoice = async (product: Product) => {
    // Update search term so the product is visible in the list behind the modal
    if (product.barcode) {
      setSearchTerm(product.barcode);
    } else if (product.barcode2) {
      setSearchTerm(product.barcode2);
    } else {
      setSearchTerm(product.name);
    }

    if (showBoxInfo) {
      const barcodeToMatch = product.barcode || product.barcode2;
      const matchingProducts = barcodeToMatch 
        ? products.filter(p => p.barcode === barcodeToMatch || p.barcode2 === barcodeToMatch || p.id === product.id)
        : [product];
      
      setNegotiationProducts(matchingProducts);
      setIsNegotiationModalOpen(true);
    } else {
      setQuantityProduct(product);
      const lastP = await fetchLastPurchase(product.id!);
      setLastPurchaseInfo(lastP);
      setIsQuantityModalOpen(true);
    }
  };

  const handleScan = async (decodedText: string) => {
    setIsScannerOpen(false);
    if (scannerTarget === 'search') {
      // Set search term immediately to filter the list
      setSearchTerm(decodedText);
      
      const matching = products.filter(p => p.barcode === decodedText || p.barcode2 === decodedText);
      
      if (matching.length > 0) {
        if (showBoxInfo) {
          setNegotiationProducts(matching);
          setIsNegotiationModalOpen(true);
        } else {
          handleProductChoice(matching[0]);
        }
      } else {
        showConfirm(t('product_not_found_add') || 'Product not found. Do you want to add it?', () => {
          setScannedBarcode(decodedText);
          setEditingProduct(null);
          setIsModalOpen(true);
        });
      }
    } else if (scannerTarget === 'barcode-field') {
      setScannedBarcode(decodedText);
    } else if (scannerTarget === 'barcode2-field') {
      setScannedBarcode2(decodedText);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.barcode?.includes(searchTerm) ||
                         p.barcode2?.includes(searchTerm);
    
    let matchesStock = true;
    if (stockFilter === 'available') {
      matchesStock = (p.quantity || 0) > (p.minQuantity || 0);
    } else if (stockFilter === 'low') {
      matchesStock = (p.quantity || 0) <= (p.minQuantity || 0) && (p.quantity || 0) > 0;
    } else if (stockFilter === 'out') {
      matchesStock = (p.quantity || 0) <= 0;
    }

    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;

    return matchesSearch && matchesStock && matchesCategory;
  }).sort((a, b) => {
    if (sortBy === 'most_sold') {
      const salesA = salesMap[a.name] || 0;
      const salesB = salesMap[b.name] || 0;
      if (salesA !== salesB) return salesB - salesA;
    } else if (sortBy === 'highest_profit') {
      const profitA = (a.sellingPrice || 0) - (a.purchasePrice || 0);
      const profitB = (b.sellingPrice || 0) - (b.purchasePrice || 0);
      if (profitA !== profitB) return profitB - profitA;
    }

    const catA = a.category || '';
    const catB = b.category || '';
    if (catA !== catB) {
      return catA.localeCompare(catB, settings.language);
    }
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB, settings.language);
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    localStorage.setItem('products_showBoxInfo', showBoxInfo.toString());
  }, [showBoxInfo]);

  useEffect(() => {
    const productHandler = () => {
      setEditingProduct(null);
      setScannedBarcode('');
      setScannedBarcode2('');
      setIsModalOpen(true);
    };
    const scannerHandler = () => {
      setScannerTarget('search');
      setIsScannerOpen(true);
    };
    window.addEventListener('open-product-modal', productHandler);
    window.addEventListener('open-barcode-scanner', scannerHandler);
    return () => {
      window.removeEventListener('open-product-modal', productHandler);
      window.removeEventListener('open-barcode-scanner', scannerHandler);
    };
  }, []);

  return (
    <div className="space-y-6">
      <ProductsHeader 
        onAddProduct={() => {
          setEditingProduct(null);
          setScannedBarcode('');
          setScannedBarcode2('');
          setIsModalOpen(true);
        }} 
      />

      {/* Search & Filters */}
      <ProductsFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showBoxInfo={showBoxInfo}
        setShowBoxInfo={setShowBoxInfo}
        categories={categories}
        onOpenScanner={() => {
          setScannerTarget('search');
          setIsScannerOpen(true);
        }}
      />

      {/* Products List */}
      <ProductsList 
        products={paginatedProducts} 
        showBoxInfo={showBoxInfo}
        onEdit={(product) => {
          setEditingProduct(product);
          setIsModalOpen(true);
        }}
        onAddQuantity={(product) => {
          setQuantityProduct(product);
          setIsQuantityModalOpen(true);
        }}
      />

      <ProductPagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />

      <AddQuantityModal
        product={quantityProduct}
        isOpen={isQuantityModalOpen}
        onClose={() => {
          setIsQuantityModalOpen(false);
          setLastPurchaseInfo(null);
        }}
        onConfirm={performQuantitySave}
        lastPurchase={lastPurchaseInfo}
      />

      <ProductEditModal
        product={editingProduct}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setScannedBarcode('');
          setScannedBarcode2('');
        }}
        onSave={handleSaveProduct}
        onDelete={(product) => {
          setIsModalOpen(false);
          setProductToDelete(product);
          setIsDeleteModalOpen(true);
        }}
        scannedBarcode={scannedBarcode}
        scannedBarcode2={scannedBarcode2}
        onScan={(target) => {
          setScannerTarget(target === 'barcode2' ? 'barcode2-field' : 'barcode-field');
          setIsScannerOpen(true);
        }}
      />

      <BarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />

      <PriceNegotiationModal
        products={negotiationProducts}
        isOpen={isNegotiationModalOpen}
        onClose={() => {
          setIsNegotiationModalOpen(false);
          setNegotiationProducts([]);
        }}
      />

      {/* Custom Alert/Confirm Modal */}
      <CustomConfirmModal 
        show={modalConfig.show}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
}

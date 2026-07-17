import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, increment, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, OperationType } from '../types';
import { syncTracker } from '../lib/syncTracker';
import { handleFirestoreError, cn } from '../lib/utils';
import { logAudit } from '../lib/auditLogger';
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
  X,
  WifiOff
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { ProductPagination } from '../components/products/ProductPagination';
import { DeleteConfirmationModal } from '../components/products/DeleteConfirmationModal';
import { AddQuantityModal } from '../components/products/AddQuantityModal';
import { ProductEditModal } from '../components/products/ProductEditModal';
import { PriceNegotiationModal } from '../components/products/PriceNegotiationModal';
import { SmartPurchasePopup } from '../components/products/SmartPurchasePopup';
import { deleteLocalImage, saveLocalImage } from '../lib/localImages';
import { uploadCloudImage, deleteCloudImage } from '../lib/cloudImages';
import { compressImage } from '../lib/imageCompressor';
import { ProductsHeader } from '../components/products/ProductsHeader';
import { ProductsFilters } from '../components/products/ProductsFilters';
import { ProductsList } from '../components/products/ProductsList';
import { CustomConfirmModal } from '../components/common/CustomConfirmModal';
import { useCategories } from '../hooks/useCategories';

import { BarcodeScanner } from '../components/common/BarcodeScanner';

import { Logo } from '../components/UI';
import { query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import * as xlsx from 'xlsx';

export default function Products() {
  const { t } = useTranslation();
  const { user, settings, updateSettings, showToast, setIsDataLoaded, activeSupplier, setActiveSupplier } = useAppContext();
  const { categories } = useCategories();
  const [products, setProducts] = useState<Product[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`products_cache_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(products.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'available', 'low', 'out'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showPosStock, setShowPosStock] = useState(false);
  
  const showBoxInfo = settings.defaultStockView === 'boxes';
  const setShowBoxInfo = (val: boolean) => {
    updateSettings({ defaultStockView: val ? 'boxes' : 'pieces' });
  };
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
  const [createdNewProduct, setCreatedNewProduct] = useState<Product | null>(null);
  const [isSmartPopupOpen, setIsSmartPopupOpen] = useState(false);
  const [pendingQuantityProduct, setPendingQuantityProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (activeSupplier && pendingQuantityProduct) {
      setQuantityProduct(pendingQuantityProduct);
      setLastPurchaseInfo(null);
      setIsQuantityModalOpen(true);
      setPendingQuantityProduct(null);
    }
  }, [activeSupplier, pendingQuantityProduct]);

  useEffect(() => {
    const handleSupplierClosed = () => {
      setPendingQuantityProduct(null);
    };
    window.addEventListener('supplier-selector-closed', handleSupplierClosed);
    return () => {
      window.removeEventListener('supplier-selector-closed', handleSupplierClosed);
    };
  }, []);

  
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
      setError(null);
    }, (err) => {
      setLoading(false);
      setIsDataLoaded(true);
      const hasCachedData = !!localStorage.getItem(`products_cache_${user.uid}`);
      if (hasCachedData) {
        setError('أنت تتصفح في وضع عدم الاتصال. البيانات المعروضة هي نسخة مخبأة قد لا تكون الأحدث.');
      } else {
        setError('حدث خطأ أثناء تحميل المنتجات. يرجى المحاولة لاحقاً.');
      }
      handleFirestoreError(err, OperationType.LIST, path);
    });
  }, [user, setIsDataLoaded]);

  // Reset to first page on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stockFilter, categoryFilter]);

  const handleDelete = () => {
    if (!user || !productToDelete) return;
    
    // UI feedback: close modal immediately
    setIsDeleteModalOpen(false);
    const path = `users/${user.uid}/products/${productToDelete.id}`;
    
    deleteDoc(doc(db, path))
      .then(() => {
        logAudit('delete', 'product', productToDelete.id!, productToDelete.name, 'حذف منتج');
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

    try {
      // Find if this product is monitored
      const monitoredQ = query(
        collection(db, `users/${user.uid}/monitored_products`),
        where('productId', '==', quantityProduct.id)
      );
      const monitoredSnap = await getDocs(monitoredQ);

      const purchaseAmount = Number(((numBoxes * boxPrice) + (extraPieces * piecePrice)).toFixed(3));
      
      const batch = writeBatch(db);
      const productRef = doc(db, `users/${user.uid}/products/${quantityProduct.id}`);
      const purchasesPath = `users/${user.uid}/purchases`;
      const purchaseRef = doc(collection(db, purchasesPath));

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
        date: Timestamp.now(),
      });

      // Update product stock
      const currentPosQty = quantityProduct.posQuantity !== undefined ? quantityProduct.posQuantity : quantityProduct.quantity;
      batch.update(productRef, {
        quantity: increment(addedQty),
        posQuantity: currentPosQty + addedQty,
        purchasePrice: piecePrice,
        boxPurchasePrice: boxPrice,
        updatedAt: serverTimestamp(),
      });

      // Update session total if active
      if (activeSupplier) {
        setActiveSupplier(prev => prev ? { ...prev, sessionTotal: (prev.sessionTotal || 0) + purchaseAmount } : null);
      }

      // Update monitored product if exists
      if (!monitoredSnap.empty) {
        monitoredSnap.forEach((docSnap) => {
          const monitoredData = docSnap.data();
          const newHistory = [
            ...(monitoredData.history || []),
            {
              date: new Date(),
              quantity: (monitoredData.currentQuantity || 0) + addedQty,
              type: 'purchase',
              addedQuantity: addedQty,
              note: 'شراء كمية جديدة'
            }
          ];
          batch.update(doc(db, `users/${user.uid}/monitored_products`, docSnap.id), {
            currentQuantity: increment(addedQty),
            history: newHistory
          });
        });
      }

      // Fire and forget to prevent UI blocking when offline
      syncTracker.track(batch.commit()).catch(err => {
         console.error("Sync deferred or failed:", err);
      });

      logAudit('update', 'product', quantityProduct.id!, quantityProduct.name, `إضافة كمية: ${addedQty}`);

      // UI feedback: close modal and show toast immediately
      setIsQuantityModalOpen(false);
      setQuantityProduct(null);
      showToast(t('stock_updated_success'), 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/products`);
      throw err; // throw error so the modal knows transaction failed and resets isSaving state
    }
  };

  const handleSaveProduct = async (productData: any, imageFile?: File | Blob | null, imageRemoved?: boolean) => {
    if (!user) return;

    try {
      const batch = writeBatch(db);
      
      const hasLocalImageValue = !!imageFile || !!(editingProduct?.hasLocalImage && !imageRemoved);
      const hasCloudImageValue = settings.syncImages ? hasLocalImageValue : (Boolean(editingProduct?.hasCloudImage) && !imageRemoved);

      if (editingProduct?.id) {
        const path = `users/${user.uid}/products/${editingProduct.id}`;
        const { quantity, ...updateFields } = productData;
        await updateDoc(doc(db, path), {
          ...updateFields,
          hasLocalImage: hasLocalImageValue,
          hasCloudImage: hasCloudImageValue,
          updatedAt: serverTimestamp(),
        });
        
        const changes: string[] = [];
        if (editingProduct.name !== productData.name) changes.push(`الاسم (من ${editingProduct.name} إلى ${productData.name})`);
        if (editingProduct.purchasePrice !== productData.purchasePrice) changes.push(`سعر الشراء (من ${editingProduct.purchasePrice} إلى ${productData.purchasePrice})`);
        if (editingProduct.sellingPrice !== productData.sellingPrice) changes.push(`سعر البيع (من ${editingProduct.sellingPrice} إلى ${productData.sellingPrice})`);
        if (editingProduct.wholesalePrice !== productData.wholesalePrice) changes.push(`سعر الجملة (من ${editingProduct.wholesalePrice} إلى ${productData.wholesalePrice})`);
        if (editingProduct.category !== productData.category) changes.push(`الفئة (من ${editingProduct.category} إلى ${productData.category})`);
        if (editingProduct.minQuantity !== productData.minQuantity) changes.push(`الحد الأدنى (من ${editingProduct.minQuantity} إلى ${productData.minQuantity})`);

        let detailsStr = 'تعديل بيانات المنتج';
        if (changes.length > 0) {
           detailsStr += ` - ${changes.join('، ')}`;
        }
        
        logAudit('update', 'product', editingProduct.id, productData.name, detailsStr);
        
        if (imageRemoved) {
           await Promise.allSettled([
             deleteLocalImage(editingProduct.id!),
             deleteCloudImage(user.uid, editingProduct.id!)
           ]).catch(console.error);
        }
        if (imageFile) {
           const compressedBlob = await compressImage(imageFile);
           await saveLocalImage(editingProduct.id!, compressedBlob).catch(console.error);
           if (settings.syncImages) {
             uploadCloudImage(user.uid, editingProduct.id!, compressedBlob).catch(console.error);
           }
        }

      } else {
        const path = `users/${user.uid}/products`;
        const purchasesPath = `users/${user.uid}/purchases`;
        
        const productRef = doc(collection(db, path));
        batch.set(productRef, {
          ...productData,
          posQuantity: productData.quantity,
          hasLocalImage: hasLocalImageValue,
          hasCloudImage: hasCloudImageValue,
          updatedAt: serverTimestamp(),
        });

        // Record initial stock as a purchase
        if (productData.quantity > 0) {
          const purchaseAmount = Number((productData.quantity * (productData.purchasePrice || 0)).toFixed(3));
          const purchaseRef = doc(collection(db, purchasesPath));
          batch.set(purchaseRef, {
            productId: productRef.id,
            productName: productData.name,
            qtyAdded: productData.quantity,
            amount: purchaseAmount,
            supplierId: activeSupplier?.id || null,
            supplierName: activeSupplier?.name || null,
            date: Timestamp.now(),
          });

          if (activeSupplier) {
            setActiveSupplier(prev => prev ? { ...prev, sessionTotal: (prev.sessionTotal || 0) + purchaseAmount } : null);
          }
        }
        
        // Fire and forget batch commit for instant offline UI
        syncTracker.track(batch.commit()).catch(err => console.error("Sync deferred or failed:", err));

        logAudit('create', 'product', productRef.id, productData.name, 'إضافة منتج جديد');

        const newProd: Product = {
          id: productRef.id,
          name: productData.name,
          category: productData.category,
          purchasePrice: productData.purchasePrice,
          sellingPrice: productData.sellingPrice,
          barcode: productData.barcode,
          barcode2: productData.barcode2,
          piecesPerBox: productData.piecesPerBox,
          boxPurchasePrice: productData.boxPurchasePrice,
          quantity: productData.quantity,
          posQuantity: productData.quantity,
          minQuantity: productData.minQuantity,
          hasLocalImage: hasLocalImageValue,
          hasCloudImage: hasCloudImageValue,
          updatedAt: null,
        };
        setCreatedNewProduct(newProd);
        setIsSmartPopupOpen(true);
        
        if (imageFile) {
           const compressedBlob = await compressImage(imageFile);
           await saveLocalImage(productRef.id, compressedBlob).catch(console.error);
           if (settings.syncImages) {
             uploadCloudImage(user.uid, productRef.id, compressedBlob).catch(console.error);
           }
        }
      }
      
      // UI feedback: close modal and clear states upon success
      setIsModalOpen(false);
      setEditingProduct(null);
      setScannedBarcode('');
      setScannedBarcode2('');
      showToast(t('product_saved_success'), 'success');

    } catch (err) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE, `users/${user.uid}/products`);
      throw err; // throw error so the modal knows transaction failed and resets isSaving state
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
      const matching = barcodeToMatch 
        ? products.filter(p => p.barcode === barcodeToMatch || p.barcode2 === barcodeToMatch || p.id === product.id)
        : [product];
      
      const matchingProducts = [
        product,
        ...matching.filter(p => p.id !== product.id)
      ];
      
      setNegotiationProducts(matchingProducts);
      setIsNegotiationModalOpen(true);
    } else {
      if (settings.requireSupplierSession && !activeSupplier) {
        showToast('يجب فتح حصة مورد أولاً لإضافة المشتريات', 'error');
        return;
      }
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
        } else if (matching.length === 1) {
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

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
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
      const catA = a.category || '';
      const catB = b.category || '';
      if (catA !== catB) {
        return catA.localeCompare(catB, settings.language);
      }
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB, settings.language);
    });
  }, [products, searchTerm, stockFilter, categoryFilter, settings.language]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
    window.addEventListener('open-barcode-scanner-products', scannerHandler);
    return () => {
      window.removeEventListener('open-product-modal', productHandler);
      window.removeEventListener('open-barcode-scanner-products', scannerHandler);
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
        showBoxInfo={showBoxInfo}
        setShowBoxInfo={setShowBoxInfo}
        showPosStock={showPosStock}
        setShowPosStock={setShowPosStock}
        categories={categories}
        onOpenScanner={() => {
          setScannerTarget('search');
          setIsScannerOpen(true);
        }}
      />
      
      {error && (
        <div className={cn(
          "border p-4 rounded-xl flex items-center justify-center space-x-2 space-x-reverse",
          error.includes('عدم الاتصال') 
            ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400" 
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
        )}>
          {error.includes('عدم الاتصال') ? <WifiOff className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{error}</span>
        </div>
      )}

      {/* Products List */}
      <ProductsList 
        products={paginatedProducts} 
        showBoxInfo={showBoxInfo}
        showPosStock={showPosStock}
        onEdit={(product) => {
          setEditingProduct(product);
          setIsModalOpen(true);
        }}
        onAddQuantity={(product) => {
          setQuantityProduct(product);
          setIsQuantityModalOpen(true);
        }}
        onCardClick={(product) => {
          if (showBoxInfo) {
            handleProductChoice(product);
          } else {
            setEditingProduct(product);
            setIsModalOpen(true);
          }
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

      {isModalOpen && (
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
          onCopy={(productToCopy) => {
            setIsModalOpen(false);
            setTimeout(() => {
              setEditingProduct({
                ...productToCopy,
                id: undefined,
                quantity: 0,
                purchasePrice: 0,
                sellingPrice: 0,
                boxPurchasePrice: 0,
                _copiedFromId: productToCopy.id,
              });
              setIsModalOpen(true);
            }, 100);
          }}
          onScan={(target) => {
            setScannerTarget(target === 'barcode2' ? 'barcode2-field' : 'barcode-field');
            setIsScannerOpen(true);
          }}
        />
      )}

      <BarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
        tabId="products"
      />

      <PriceNegotiationModal
        products={negotiationProducts}
        isOpen={isNegotiationModalOpen}
        onClose={() => {
          setIsNegotiationModalOpen(false);
          setNegotiationProducts([]);
        }}
      />

      <SmartPurchasePopup
        product={createdNewProduct}
        isOpen={isSmartPopupOpen}
        onClose={() => {
          setIsSmartPopupOpen(false);
          setCreatedNewProduct(null);
        }}
        onConfirmPurchase={() => {
          if (createdNewProduct) {
            setIsSmartPopupOpen(false);
            if (settings.requireSupplierSession && !activeSupplier) {
              setPendingQuantityProduct(createdNewProduct);
              window.dispatchEvent(new CustomEvent('open-supplier-selector'));
            } else {
              setQuantityProduct(createdNewProduct);
              setLastPurchaseInfo(null);
              setIsQuantityModalOpen(true);
            }
            setCreatedNewProduct(null);
          }
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

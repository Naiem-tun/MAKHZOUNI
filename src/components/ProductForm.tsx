import React from 'react';
import { ProductEditModal } from './products/ProductEditModal';
import { BarcodeScanner } from './common/BarcodeScanner';
import { useProductManagement } from '../hooks/useProductManagement';

export function ProductForm({ user }: { user: any }) {
  const {
    isProductModalOpen,
    setIsProductModalOpen,
    isScannerOpen,
    setIsScannerOpen,
    globalScannedBarcode,
    handleSaveProduct,
    handleScannerResult
  } = useProductManagement(user);

  // We expose a global event listener to open the modal
  React.useEffect(() => {
    const handleOpenModal = () => setIsProductModalOpen(true);
    const handleOpenScanner = () => setIsScannerOpen(true);

    window.addEventListener('open-product-modal', handleOpenModal);
    window.addEventListener('open-barcode-scanner', handleOpenScanner);

    return () => {
      window.removeEventListener('open-product-modal', handleOpenModal);
      window.removeEventListener('open-barcode-scanner', handleOpenScanner);
    };
  }, [setIsProductModalOpen, setIsScannerOpen]);

  return (
    <>
      {isProductModalOpen && (
        <ProductEditModal 
          isOpen={isProductModalOpen}
          product={null}
          onClose={() => setIsProductModalOpen(false)}
          onSave={handleSaveProduct}
          scannedBarcode={globalScannedBarcode}
          onScan={() => {
            setIsProductModalOpen(false);
            setIsScannerOpen(true);
          }}
        />
      )}

      <BarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScannerResult}
      />
    </>
  );
}

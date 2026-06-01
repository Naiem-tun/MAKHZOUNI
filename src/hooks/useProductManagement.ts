import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError } from '../lib/utils';
import { OperationType } from '../types';

export function useProductManagement(user: any) {
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [globalScannedBarcode, setGlobalScannedBarcode] = useState('');

  const handleSaveProduct = async (productData: any) => {
    if (!user) return;
    try {
      const path = `users/${user.uid}/products`;
      
      setIsProductModalOpen(false);
      setGlobalScannedBarcode('');
      
      addDoc(collection(db, path), {
        ...productData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/products`);
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleScannerResult = (barcode: string) => {
    setIsScannerOpen(false);
    setGlobalScannedBarcode(barcode);
    setIsProductModalOpen(true);
  };

  return {
    isProductModalOpen,
    setIsProductModalOpen,
    isScannerOpen,
    setIsScannerOpen,
    globalScannedBarcode,
    setGlobalScannedBarcode,
    handleSaveProduct,
    handleScannerResult
  };
}

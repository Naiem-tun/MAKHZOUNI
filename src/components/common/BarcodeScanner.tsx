import React, { useEffect, useState, useId } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { X, Barcode, AlertCircle } from 'lucide-react';

import { useTranslation } from 'react-i18next';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
}

export function BarcodeScanner({ isOpen, onClose, onScan, title }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const displayTitle = title || t('scan_barcode_title');
  const [error, setError] = useState<string | null>(null);
  const scannerId = useId().replace(/:/g, ''); // Generate safe ID

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;
    const containerId = `scanner-reader-${scannerId}`;

    if (isOpen) {
      setError(null);
      const startScanner = async () => {
        try {
          html5QrCode = new Html5Qrcode(containerId);
          
          let hasScanned = false;
          
          const config = {
            fps: 10,
            aspectRatio: 1
          };

          const onDecode = (decodedText: string) => {
            if (hasScanned) return;
            hasScanned = true;
            onScan(decodedText);
            onClose();
          };

          try {
            await html5QrCode.start({ facingMode: "environment" }, config, onDecode, () => {});
          } catch (envCameraError) {
            console.warn("Failed to start environment camera, trying any camera", envCameraError);
            if (isMounted) {
               // Try without specific facing mode
               await html5QrCode.start({ facingMode: "user" }, config, onDecode, () => {});
            }
          }

          if (!isMounted) {
            html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
            return;
          }

          // Force the video element to fill the container and use object-cover
          setTimeout(() => {
            const videoElement = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
            if (videoElement) {
              videoElement.style.width = '100%';
              videoElement.style.height = '100%';
              videoElement.style.objectFit = 'cover';
            }
          }, 300);
        } catch (err: any) {
          console.error("Scanner error:", err);
          if (isMounted) setError(err.message || String(err) || "Failed to access camera");
        }
      };

      // Add a slight delay to ensure DOM is ready
      setTimeout(startScanner, 200);
    }

    return () => {
      isMounted = false;
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
              html5QrCode?.clear();
            }).catch(console.error);
          } else {
            html5QrCode.clear();
          }
        } catch (e) {
          console.error("Error clearing scanner:", e);
        }
      }
      setTimeout(() => {
        try {
          const videoElement = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
          if (videoElement && (videoElement as any).srcObject) {
            const stream = (videoElement as any).srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            (videoElement as any).srcObject = null;
          }
        } catch (e) {}
      }, 300);
    };
  }, [isOpen, onScan, onClose, scannerId]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                <Barcode size={20} className="text-brand-500" />
                {displayTitle}
              </h3>
              <button
                onClick={onClose}
                className="p-2 bg-white dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 shadow-sm transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scanner Container */}
            <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
              
              {/* The Actual Scanner Container - Never conditionally unmounted by React while modal is open */}
              <div className={`absolute inset-0 ${error ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <div id={`scanner-reader-${scannerId}`} className="w-full h-full" />
              </div>

              {error && (
                <div className="relative z-50 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-3 border border-red-500/30">
                    <AlertCircle size={24} className="text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">فشل تشغيل الكاميرا</h3>
                  <p className="text-red-200/80 text-xs mb-4 leading-relaxed">
                    {error}
                  </p>
                  <button 
                    onClick={onClose}
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors text-sm"
                  >
                    إغلاق
                  </button>
                </div>
              )}
            </div>
            
            {/* Footer / Hint */}
            {!error && (
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 text-center border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {t('scan_barcode_hint')}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import React, { useEffect, useState, useId } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { X, QrCode, AlertCircle } from 'lucide-react';

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
            qrbox: { width: 250, height: 250 },
            aspectRatio: window.innerHeight / window.innerWidth
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
          className="fixed inset-0 z-[100] flex flex-col bg-zinc-950"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 text-white bg-zinc-950/80 backdrop-blur-md relative z-10">
            <button 
              onClick={onClose} 
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-all active:scale-90"
            >
              <X size={28} />
            </button>
            <h2 className="text-xl font-bold">{displayTitle}</h2>
            <div className="w-12 h-12 flex items-center justify-center text-brand-500">
              <QrCode size={24} />
            </div>
          </div>

          {/* Scanner Container */}
          <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
            
            {/* The Actual Scanner Container - Never conditionally unmounted by React while modal is open */}
            <div className={`absolute inset-0 ${error ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div id={`scanner-reader-${scannerId}`} className="w-full h-full" />
            </div>

            {error && (
              <div className="relative z-50 flex flex-col items-center justify-center p-8 text-center bg-red-950/40 rounded-2xl border border-red-500/20 max-w-sm mx-auto shadow-[0_0_40px_rgba(239,68,68,0.1)] backdrop-blur-md">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
                  <AlertCircle size={32} className="text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">فشل تشغيل الكاميرا</h3>
                <p className="text-red-200/80 text-sm mb-6 leading-relaxed">
                  {error}
                </p>
                <button 
                  onClick={onClose}
                  className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors w-full"
                >
                  إغلاق
                </button>
              </div>
            )}

            {!error && (
              <>
                {/* Visual Overlay - Scanner Frame */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-72 h-72">
                    {/* Corner Accents */}
                    <div className="absolute -top-2 -left-2 w-12 h-12 border-t-4 border-l-4 border-brand-500 rounded-tl-2xl shadow-[0_0_20px_rgba(var(--brand-500),0.3)]" />
                    <div className="absolute -top-2 -right-2 w-12 h-12 border-t-4 border-r-4 border-brand-500 rounded-tr-2xl shadow-[0_0_20px_rgba(var(--brand-500),0.3)]" />
                    <div className="absolute -bottom-2 -left-2 w-12 h-12 border-b-4 border-l-4 border-brand-500 rounded-bl-2xl shadow-[0_0_20px_rgba(var(--brand-500),0.3)]" />
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 border-b-4 border-r-4 border-brand-500 rounded-br-2xl shadow-[0_0_20px_rgba(var(--brand-500),0.3)]" />
                    
                    {/* Pulse Glow */}
                    <div className="absolute inset-0 bg-brand-500/5 animate-pulse rounded-lg" />
                    
                    {/* Scanning Line */}
                    <motion.div 
                      className="absolute left-0 right-0 h-1 bg-brand-500/60 shadow-[0_0_20px_rgba(var(--brand-500),0.5)] z-10"
                      animate={{ 
                        top: ['0%', '100%', '0%'] 
                      }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity, 
                        ease: "easeInOut" 
                      }}
                    />
                  </div>
                </div>

                {/* Instruction Text */}
                <div className="absolute bottom-12 left-0 right-0 text-center px-8 z-10">
                  <p className="inline-block px-6 py-2 rounded-full bg-zinc-900/60 text-white/80 text-sm font-medium backdrop-blur-sm border border-white/5">
                    {t('scan_barcode_hint')}
                  </p>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

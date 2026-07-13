import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { X, Barcode, AlertCircle } from 'lucide-react';

import { useTranslation } from 'react-i18next';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
  inline?: boolean;
  continuous?: boolean;
}

export function BarcodeScanner({ isOpen, onClose, onScan, title, inline = false, continuous = false }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const displayTitle = title || t('scan_barcode_title');
  const [error, setError] = useState<string | null>(null);
  
  const scannerWrapperRef = useRef<HTMLDivElement>(null);
  const lastScannedRef = useRef<{ text: string, time: number } | null>(null);

  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;
    
    // Generate a unique ID for this specific effect run to avoid Strict Mode conflicts
    const uniqueScannerId = `scanner-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Create the target div dynamically
    const targetDiv = document.createElement('div');
    targetDiv.id = uniqueScannerId;
    targetDiv.style.width = '100%';
    targetDiv.style.height = '100%';
    
    if (scannerWrapperRef.current) {
      scannerWrapperRef.current.appendChild(targetDiv);
    }

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode(uniqueScannerId);
        
        let hasScanned = false;
        
        const config = {
          fps: 10,
          aspectRatio: inline ? undefined : 1
        };

        const onDecode = (decodedText: string) => {
          if (!continuous && hasScanned) return;
          
          if (continuous) {
            const now = Date.now();
            if (lastScannedRef.current && lastScannedRef.current.text === decodedText && now - lastScannedRef.current.time < 1500) {
              return;
            }
            lastScannedRef.current = { text: decodedText, time: now };
            
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
              gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.start();
              setTimeout(() => {
                oscillator.stop();
                audioCtx.close();
              }, 100);
            } catch (e) {}

            onScanRef.current(decodedText);
          } else {
            hasScanned = true;
            onScanRef.current(decodedText);
            onCloseRef.current();
          }
        };

        try {
          await html5QrCode.start({ facingMode: "environment" }, config, onDecode, () => {});
        } catch (envCameraError) {
          if (isMounted) {
             await html5QrCode.start({ facingMode: "user" }, config, onDecode, () => {});
          }
        }

        if (!isMounted) {
          html5QrCode.stop().then(() => html5QrCode?.clear()).catch(() => {});
          return;
        }

        setTimeout(() => {
          if (!isMounted) return;
          const videoElement = targetDiv.querySelector('video');
          if (videoElement) {
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.objectFit = 'cover';
          }
        }, 300);
      } catch (err: any) {
        if (isMounted) setError(err.message || String(err) || "Failed to access camera");
      }
    };

    // Delay slightly so that the DOM is fully established
    const timeoutId = setTimeout(startScanner, 100);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      
      if (html5QrCode) {
        // Suppress any errors during stop/clear
        try {
          // Temporarily hide it so the user doesn't see frozen frames while stopping
          targetDiv.style.display = 'none';
          
          if (html5QrCode.isScanning) {
            html5QrCode.stop()
              .then(() => {
                try { html5QrCode?.clear(); } catch(e) {}
                targetDiv.remove();
              })
              .catch(() => {
                targetDiv.remove();
              });
          } else {
            try { html5QrCode.clear(); } catch(e) {}
            targetDiv.remove();
          }
        } catch (e) {
          targetDiv.remove();
        }
      } else {
        targetDiv.remove();
      }
    };
  }, [isOpen, inline, continuous]);

  const scannerContent = (
    <div className={`relative w-full ${inline ? 'h-full' : 'aspect-square'} bg-black flex items-center justify-center overflow-hidden`}>
      <div 
        ref={scannerWrapperRef} 
        className={`absolute inset-0 w-full h-full ${error ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} 
      />

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
  );

  if (inline) {
    return (
      <div className={`flex flex-col h-full bg-black rounded-lg overflow-hidden relative ${!isOpen ? 'pointer-events-none opacity-0' : ''}`}>
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <button
            onClick={onClose}
            className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-sm transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {scannerContent}
      </div>
    );
  }

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

            {scannerContent}
            
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


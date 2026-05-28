import React, { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { X, QrCode } from 'lucide-react';

import { useTranslation } from 'react-i18next';
import { useModalBackButton } from '../../hooks/useModalBackButton';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
}

export function BarcodeScanner({ isOpen, onClose, onScan, title }: BarcodeScannerProps) {
  const { t } = useTranslation();
  useModalBackButton(isOpen, onClose);
  
  const displayTitle = title || t('scan_barcode_title');

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;

    if (isOpen) {
      const startScanner = async () => {
        try {
          html5QrCode = new Html5Qrcode("scanner-reader");
          
          // Get screen dimensions to optimize scanning area
          const width = window.innerWidth;
          const height = window.innerHeight;
          const minSide = Math.min(width, height);
          const qrBoxSize = Math.floor(minSide * 0.7);

          let hasScanned = false;

          await html5QrCode.start(
            { facingMode: "environment" },
            { 
              fps: 15, 
              qrbox: { width: qrBoxSize, height: qrBoxSize },
              aspectRatio: height / width, // Match device aspect ratio
            },
            (decodedText) => {
              if (hasScanned) return;
              hasScanned = true;
              onScan(decodedText);
              onClose();
            },
            () => {} // ignore errors
          );

          if (!isMounted) {
            html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
            return;
          }

          // Force the video element to fill the container and use object-cover
          const videoElement = document.querySelector('#scanner-reader video') as HTMLVideoElement;
          if (videoElement) {
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.objectFit = 'cover';
          }
        } catch (err) {
          console.error("Scanner error:", err);
          if (isMounted) onClose();
        }
      };

      // Add a slight delay to ensure DOM is ready
      setTimeout(startScanner, 100);
    }

    return () => {
      isMounted = false;
      
      // Cleanup QR code instance
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
      
      // Aggressively kill media tracks to prevent camera from hovering in background
      setTimeout(() => {
        try {
          const videoElement = document.querySelector('#scanner-reader video') as HTMLVideoElement;
          if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            stream.getTracks().forEach(track => {
              track.stop();
            });
            videoElement.srcObject = null;
          }
        } catch (e) {
          console.error("Error stopping video stream:", e);
        }
      }, 300);
    };
  }, [isOpen, onScan, onClose]);

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
            {/* The Actual Scanner */}
            <div id="scanner-reader" className="w-full h-full" />
            
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

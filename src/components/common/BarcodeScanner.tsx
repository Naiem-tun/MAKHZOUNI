import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { X, Barcode, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

// --- GLOBAL CAMERA TRACKER ---
const globalActiveStreams = new Set<MediaStream>();
let activeScannersCount = 0;

if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    try {
      const stream = await originalGetUserMedia(constraints);
      
      // If no scanners are active (e.g. unmounted during async camera starting), stop immediately!
      if (activeScannersCount === 0) {
        stream.getTracks().forEach(track => track.stop());
        return stream;
      }

      globalActiveStreams.add(stream);
      stream.getTracks().forEach((track: MediaStreamTrack) => {
        track.addEventListener('ended', () => {
          if (stream.getTracks().every((t: MediaStreamTrack) => t.readyState === 'ended')) {
            globalActiveStreams.delete(stream);
          }
        });
      });
      return stream;
    } catch (err) {
      throw err;
    }
  };
}

export function forceStopAllCameras() {
  globalActiveStreams.forEach(stream => {
    stream.getTracks().forEach(track => track.stop());
  });
  globalActiveStreams.clear();

  if (typeof document !== 'undefined') {
    document.querySelectorAll('video').forEach(video => {
      if ((video as any).srcObject) {
        const stream = (video as any).srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        (video as any).srcObject = null;
      }
    });
  }
}
// -----------------------------

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
  inline?: boolean;
  continuous?: boolean;
  tabId?: string;
}

export function BarcodeScanner({ isOpen, onClose, onScan, title, inline = false, continuous = false }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const { activeTab, settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
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

  // Handle activeTab changes: automatically close the scanner if we switch away (change tabs)
  const initialTabRef = useRef(activeTab);
  useEffect(() => {
    if (isOpen) {
      if (activeTab !== initialTabRef.current) {
        onClose();
      }
    } else {
      initialTabRef.current = activeTab;
    }
  }, [activeTab, isOpen, onClose]);

  // Track the number of active scanners globally to prevent any pending camera streams
  useEffect(() => {
    if (!isOpen) return;
    activeScannersCount++;
    return () => {
      activeScannersCount--;
      if (activeScannersCount <= 0) {
        activeScannersCount = 0;
        forceStopAllCameras();
      }
    };
  }, [isOpen]);

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

    let startPromise: Promise<any> | null = null;

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
          startPromise = html5QrCode.start({ facingMode: "environment" }, config, onDecode, () => {});
          await startPromise;
        } catch (envCameraError) {
          if (isMounted) {
             startPromise = html5QrCode.start({ facingMode: "user" }, config, onDecode, () => {});
             await startPromise;
          }
        }

        if (!isMounted) {
          // If unmounted during start, cleanup is handled in the effect return
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
      
      // Keep targetDiv attached to the DOM under document.body so the browser doesn't
      // abruptly trigger onabort() or onended on the active video element before html5-qrcode stop() completes.
      if (targetDiv && targetDiv.parentNode) {
        try {
          const videoElement = targetDiv.querySelector('video');
          if (videoElement) {
            videoElement.onabort = null;
            videoElement.onerror = null;
          }
          
          document.body.appendChild(targetDiv);
          targetDiv.style.position = 'fixed';
          targetDiv.style.top = '-9999px';
          targetDiv.style.left = '-9999px';
          targetDiv.style.width = '1px';
          targetDiv.style.height = '1px';
          targetDiv.style.opacity = '0';
        } catch (e) {
          console.warn("Failed to temporarily re-parent targetDiv:", e);
        }
      }

      const performCleanup = async () => {
        if (startPromise) {
          try {
            await startPromise; // Wait for any pending start to complete
          } catch(e) {}
        }

        // Before stopping, remove the video's onabort handler which html5-qrcode sets to throw the Uncaught error
        try {
          const videoElement = targetDiv.querySelector('video');
          if (videoElement) {
            videoElement.onabort = null;
            videoElement.onerror = null;
          }
        } catch (e) {}

        if (html5QrCode) {
          try {
            if (html5QrCode.isScanning) {
              await html5QrCode.stop();
            }
          } catch (e) {
            // It might fail or log warnings, which is fine since we are shutting down
          }
          try {
            html5QrCode.clear();
          } catch (e) {}
        }
        
        // Now that the scanner has cleanly stopped, we can safely turn off any leftover tracks
        try {
          const videoElement = targetDiv.querySelector('video');
          if (videoElement) {
            videoElement.pause();
            if ((videoElement as any).srcObject) {
              const stream = (videoElement as any).srcObject as MediaStream;
              stream.getTracks().forEach(track => track.stop());
              (videoElement as any).srcObject = null;
            }
          }
        } catch (err) {}

        try {
          if (targetDiv.parentNode) {
            targetDiv.remove();
          }
        } catch (e) {}
        
        // Final aggressive check to guarantee no cameras remain active
        forceStopAllCameras();
      };

      performCleanup();
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
          <div
            className="w-12 h-12 border flex items-center justify-center mb-3"
            style={{ backgroundColor: theme.surface, borderColor: theme.negative, color: theme.negative }}
          >
            <AlertCircle size={22} />
          </div>
          <h3 className="text-base font-black text-white mb-2">فشل تشغيل الكاميرا</h3>
          <p className="text-zinc-300 text-xs mb-4 leading-relaxed">
            {error}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border font-bold text-xs cursor-pointer"
            style={{ backgroundColor: theme.negative, borderColor: theme.negative, color: '#FFFFFF' }}
          >
            إغلاق
          </button>
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className={`flex flex-col h-full bg-black border overflow-hidden relative ${!isOpen ? 'pointer-events-none opacity-0' : ''}`} style={{ borderColor: theme.border }}>
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 border text-white bg-black/70 hover:bg-black cursor-pointer"
            style={{ borderColor: theme.border }}
          >
            <X size={16} />
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
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
          dir="rtl"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="border shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
          >
            {/* Header */}
            <div
              className="px-4 py-3 border-b flex justify-between items-center"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <h3 className="font-black text-sm sm:text-base flex items-center gap-2" style={{ color: theme.text }}>
                <Barcode size={18} style={{ color: theme.accent }} />
                <span>{displayTitle}</span>
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="p-1.5 border cursor-pointer"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
              >
                <X size={16} />
              </button>
            </div>

            {scannerContent}

            {/* Footer / Hint */}
            {!error && (
              <div
                className="p-3 text-center border-t"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <p className="text-xs font-bold" style={{ color: theme.textMuted }}>
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


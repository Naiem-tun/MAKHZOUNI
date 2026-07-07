import { useState, useEffect } from "react";
import { syncTracker } from "../../lib/syncTracker";
import { RotateCcw } from "lucide-react";

export function SyncBadge() {
  const [count, setCount] = useState(syncTracker.pendingCount);
  useEffect(() => {
    return syncTracker.subscribe(setCount);
  }, []);

  if (count === 0) return null;

  return (
    <span className="flex items-center justify-center bg-red-500 text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full shadow-sm">
      {count}
    </span>
  );
}

export function SyncCounterBadge({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [count, setCount] = useState(syncTracker.pendingCount);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    return syncTracker.subscribe(setCount);
  }, []);

  if (count === 0) return null;

  return (
    <div
      className={`absolute top-full mt-2 right-0 w-64 bg-zinc-900 text-white text-xs rounded-lg py-3 px-4 shadow-xl transition-all z-50 ${isOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"}`}
    >
      <div className="font-bold mb-2 text-amber-400">
        تحذير: {count} عمليات قيد الانتظار لمزامنتها
      </div>
      <div className="text-zinc-400 mb-3 leading-relaxed whitespace-normal text-right">
        يبدو أن هناك عمليات تمت إضافتها مسبقاً ولم تنجح المزامنة بعد. انقر على
        زر إعادة المحاولة لمحاولة إرسالها الآن.
      </div>
      <button
        disabled={isSyncing}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsSyncing(true);
          await syncTracker.forceSync();
          setTimeout(() => {
            setIsSyncing(false);
            onClose();
          }, 1000);
        }}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-md font-bold transition-all disabled:opacity-50"
      >
        <RotateCcw size={14} className={isSyncing ? "animate-spin" : ""} />
        {isSyncing ? "جاري المزامنة..." : "إعادة المزامنة الآن"}
      </button>
    </div>
  );
}

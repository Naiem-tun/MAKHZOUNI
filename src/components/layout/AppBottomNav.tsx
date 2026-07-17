import { Calculator, ScanBarcode } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AppBottomNavProps {
  isScannerTab: boolean;
  handleScannerClick: () => void;
  toolbarTabs: any[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function AppBottomNav({
  isScannerTab,
  handleScannerClick,
  toolbarTabs,
  activeTab,
  setActiveTab,
}: AppBottomNavProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 px-4 border-t border-zinc-200/60 dark:border-zinc-800/60 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-none">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        {/* Fixed Barcode Scanner */}
        <button
          onClick={handleScannerClick}
          className="flex-shrink-0 w-14 h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg shadow-sm flex items-center justify-center relative active:scale-95 transition-all"
          aria-label={t("scan_barcode") || "Scan Barcode"}
        >
          {isScannerTab ? (
            <ScanBarcode size={24} />
          ) : (
            <Calculator size={24} />
          )}
        </button>

        {/* Scrollable Tabs */}
        <div className="flex-1 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm w-max">
            {toolbarTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

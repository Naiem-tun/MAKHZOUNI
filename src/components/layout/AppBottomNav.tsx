import { Calculator, ScanBarcode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../AppContext";
import { useFolioTheme } from "../folio/FolioPageChrome";

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
  const { settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 px-3 sm:px-4 border-t transition-colors"
      style={{
        backgroundColor: theme.bg,
        borderColor: theme.border,
      }}
    >
      <div className="flex items-center gap-2.5 max-w-7xl mx-auto">
        {/* Fixed Barcode Scanner / Calculator */}
        <button
          type="button"
          onClick={handleScannerClick}
          className="flex-shrink-0 w-13 h-13 border flex items-center justify-center relative active:scale-95 transition-colors cursor-pointer"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.accent,
          }}
          aria-label={t("scan_barcode") || "Scan Barcode"}
        >
          {isScannerTab ? (
            <ScanBarcode size={22} />
          ) : (
            <Calculator size={22} />
          )}
        </button>

        {/* Scrollable Tabs */}
        <div className="flex-1 overflow-x-auto no-scrollbar">
          <div
            className="flex items-center gap-1 p-1 border h-13 min-w-full w-max"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
            }}
          >
            {toolbarTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="flex shrink-0 items-center justify-center gap-2 px-4 h-full text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                  style={
                    active
                      ? {
                          backgroundColor: theme.text,
                          color: theme.surface,
                        }
                      : {
                          backgroundColor: "transparent",
                          color: theme.textMuted,
                        }
                  }
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

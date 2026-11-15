import { Menu, CloudOff, Cloud, Square, Play, ShoppingCart, Lock } from "lucide-react";
import { Logo } from "../UI";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../AppContext";
import { safeDispatchEvent } from "../../lib/utils";
import { useState } from "react";
import { SyncBadge, SyncCounterBadge } from "./SyncBadges";
import { useFolioTheme } from "../folio/FolioPageChrome";

interface AppHeaderProps {
  setMobileMenuOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function AppHeader({
  setMobileMenuOpen,
  activeTab,
  setActiveTab,
}: AppHeaderProps) {
  const { isOffline, settings, activeSupplier, setIsSessionSummaryOpen, lockApp } = useAppContext();
  const { t } = useTranslation();
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

  return (
    <header
      className="sticky top-0 z-40 border-b transition-colors"
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
        color: theme.text,
      }}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-15 items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="p-1.5 border transition-colors cursor-pointer"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text,
                }}
                aria-label={t("menu")}
              >
                <Menu size={20} />
              </button>
              <div
                onClick={() => setActiveTab("dashboard")}
                className="cursor-pointer flex items-center gap-2"
              >
                <Logo className="w-9 h-9 active:scale-95 transition-transform" />
                <span
                  className="hidden md:inline text-sm font-black tracking-tight"
                  style={{ color: theme.text }}
                >
                  {settings.storeName || "مخزوني"}
                </span>
              </div>
            </div>

            <div className="flex items-center">
              {isOffline ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSyncMenu(!showSyncMenu);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 border relative cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.negative,
                    color: theme.negative,
                  }}
                >
                  <CloudOff size={13} />
                  <SyncBadge />
                  <span className="text-[11px] font-bold hidden sm:inline">
                    {t("offline_mode", "مخزن محلياً")}
                  </span>
                  <SyncCounterBadge
                    isOpen={showSyncMenu}
                    onClose={() => setShowSyncMenu(false)}
                  />
                </div>
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSyncMenu(!showSyncMenu);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 border relative cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.positive,
                  }}
                  title={t(
                    "online_mode_tooltip",
                    "متصل. يتم المزامنة بشكل لحظي.",
                  )}
                >
                  <Cloud size={13} />
                  <SyncBadge />
                  <span
                    className="text-[11px] font-bold hidden sm:inline"
                    style={{ color: theme.textMuted }}
                  >
                    {t("online_mode", "متصل ومحدث")}
                  </span>
                  <SyncCounterBadge
                    isOpen={showSyncMenu}
                    onClose={() => setShowSyncMenu(false)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activeSupplier) {
                  setIsSessionSummaryOpen(true);
                } else {
                  safeDispatchEvent("open-supplier-selector");
                }
              }}
              className="h-9 px-3 border flex items-center justify-center transition-colors cursor-pointer"
              style={
                activeSupplier
                  ? {
                      backgroundColor: theme.text,
                      color: theme.surface,
                      borderColor: theme.text,
                    }
                  : {
                      backgroundColor: theme.surfaceMuted,
                      color: theme.accent,
                      borderColor: theme.border,
                    }
              }
              title={
                activeSupplier
                  ? t("end_supplier_session")
                  : t("start_supplier_session")
              }
            >
              {activeSupplier ? (
                <div className="flex items-center gap-2">
                  <Square size={14} fill="currentColor" />
                  <span className="text-[11px] font-black leading-none truncate max-w-[110px]">
                    {activeSupplier.name}
                  </span>
                </div>
              ) : (
                <Play size={15} fill="currentColor" />
              )}
            </button>

            {settings.showShoppingList !== false && (
              <button
                type="button"
                onClick={() => setActiveTab("shopping-list")}
                className="h-9 w-9 border flex items-center justify-center transition-colors cursor-pointer"
                style={
                  activeTab === "shopping-list"
                    ? {
                        backgroundColor: theme.text,
                        color: theme.surface,
                        borderColor: theme.text,
                      }
                    : {
                        backgroundColor: theme.surface,
                        color: theme.textMuted,
                        borderColor: theme.border,
                      }
                }
                title={t("shopping_list")}
              >
                <ShoppingCart size={18} />
              </button>
            )}

            {settings.appPinEnabled && settings.appPin && (
              <button
                type="button"
                onClick={lockApp}
                className="h-9 w-9 border flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  backgroundColor: theme.surface,
                  color: theme.textMuted,
                  borderColor: theme.border,
                }}
                title="قفل التطبيق الآن"
              >
                <Lock size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

import { Menu, CloudOff, Cloud, Square, Play, ShoppingCart, Wallet, Lock, User, Users, Crown } from "lucide-react";
import { Logo } from "../UI";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../AppContext";
import { useStaffAuth } from "../../contexts/StaffAuthContext";
import { ROLE_LABELS } from "../../lib/permissions";
import { safeDispatchEvent } from "../../lib/utils";
import { useState } from "react";
import { SyncBadge, SyncCounterBadge } from "./SyncBadges";

interface AppHeaderProps {
  setMobileMenuOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenStaffSwitcher?: () => void;
}

export function AppHeader({
  setMobileMenuOpen,
  activeTab,
  setActiveTab,
  onOpenStaffSwitcher,
}: AppHeaderProps) {
  const { user, isOffline, settings, activeSupplier, setIsSessionSummaryOpen } = useAppContext();
  const { currentStaff, lockScreen } = useStaffAuth();
  const { t } = useTranslation();
  const [showSyncMenu, setShowSyncMenu] = useState(false);

  const roleInfo = currentStaff ? ROLE_LABELS[currentStaff.role] : null;

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm dark:bg-[#121A2F]">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                <Menu size={24} />
              </button>
              <div
                onClick={() => setActiveTab("dashboard")}
                className="cursor-pointer"
              >
                <Logo className="w-10 h-10 shadow-lg active:scale-95 transition-transform" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isOffline ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSyncMenu(!showSyncMenu);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-400 relative cursor-pointer"
                >
                  <CloudOff size={14} />
                  <SyncBadge />
                  <span className="text-xs font-bold hidden sm:inline">
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
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400 relative cursor-pointer"
                  title={t(
                    "online_mode_tooltip",
                    "متصل. يتم المزامنة بشكل لحظي.",
                  )}
                >
                  <Cloud size={14} />
                  <SyncBadge />
                  <span className="text-xs font-bold hidden sm:inline">
                    {t("online_mode", "متصل ومحدث")}
                  </span>
                  <SyncCounterBadge
                    isOpen={showSyncMenu}
                    onClose={() => setShowSyncMenu(false)}
                  />
                </div>
              )}

              {/* Staff Pill / Switcher / Role Badge */}
              {currentStaff ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenStaffSwitcher) {
                        onOpenStaffSwitcher();
                      } else {
                        safeDispatchEvent("open-staff-switcher");
                      }
                    }}
                    className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-zinc-100/90 dark:bg-zinc-800/90 hover:bg-zinc-200/90 dark:hover:bg-zinc-700/90 transition border border-zinc-200 dark:border-zinc-700/70 shadow-2xs active:scale-95"
                    title={`الموظف الحالي: ${currentStaff.name} (${roleInfo?.ar || ''}) - اضغط للتبديل`}
                  >
                    <div
                      className="w-5 h-5 rounded-full text-[10px] font-black text-white flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: currentStaff.avatarColor || (currentStaff.role === 'admin' ? '#f59e0b' : '#3b82f6') }}
                    >
                      {currentStaff.role === 'admin' ? (
                        <Crown size={11} className="text-white" />
                      ) : (
                        currentStaff.name.slice(0, 1)
                      )}
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 max-w-[60px] sm:max-w-[100px] truncate leading-tight">
                      {currentStaff.name}
                    </span>
                    {roleInfo && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border hidden md:inline-flex items-center leading-none shrink-0 ${roleInfo.badgeBg}`}>
                        {roleInfo.ar}
                      </span>
                    )}
                    <Users size={12} className="text-zinc-400 dark:text-zinc-500 hidden sm:inline" />
                  </button>

                  <button
                    type="button"
                    onClick={lockScreen}
                    className="p-1 rounded-lg text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition active:scale-90"
                    title="قفل الشاشة مؤقتاً (PIN Lock)"
                  >
                    <Lock size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenStaffSwitcher) {
                      onOpenStaffSwitcher();
                    } else {
                      safeDispatchEvent("open-staff-switcher");
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-400 hover:bg-blue-100 transition shadow-sm font-bold text-xs active:scale-95"
                  title="تسجيل الدخول أو اختيار الموظف"
                >
                  <Users size={14} />
                  <span>تسجيل الدخول</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                if (activeSupplier) {
                  setIsSessionSummaryOpen(true);
                } else {
                  safeDispatchEvent("open-supplier-selector");
                }
              }}
              className={`transition-all h-9 px-3 rounded-lg flex items-center justify-center ${activeSupplier ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md scale-105" : "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/40 shadow-sm transition-all"}`}
              title={
                activeSupplier
                  ? t("end_supplier_session")
                  : t("start_supplier_session")
              }
            >
              {activeSupplier ? (
                <div className="flex items-center gap-2">
                  <Square size={16} fill="currentColor" />
                  <span className="text-[10px] font-black leading-none">
                    {activeSupplier.name}
                  </span>
                </div>
              ) : (
                <Play size={16} fill="currentColor" />
              )}
            </button>

            {settings.showShoppingList !== false && (
              <button
                onClick={() => setActiveTab("shopping-list")}
                className={`transition-colors ${activeTab === "shopping-list" ? "text-brand-600" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"}`}
                title={t("shopping_list")}
              >
                <ShoppingCart size={22} />
              </button>
            )}
            <button
              onClick={() => setActiveTab("expenses")}
              className={`transition-colors ${activeTab === "expenses" ? "text-warn-text" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"}`}
            >
              <Wallet size={22} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}


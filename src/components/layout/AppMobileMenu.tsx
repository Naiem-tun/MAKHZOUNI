import { motion } from "motion/react";
import { X, Eye, EyeOff, Lock, Users, UserPlus, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../AppContext";
import { useStaffAuth } from "../../contexts/StaffAuthContext";
import { ROLE_LABELS } from "../../lib/permissions";
import { safeDispatchEvent } from "../../lib/utils";

interface AppMobileMenuProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mainPagesTabs: any[];
  reportsSubpages: any[];
  otherTabs: any[];
  onOpenStaffSwitcher?: () => void;
}

export function AppMobileMenu({
  mobileMenuOpen,
  setMobileMenuOpen,
  activeTab,
  setActiveTab,
  mainPagesTabs,
  reportsSubpages,
  otherTabs,
  onOpenStaffSwitcher,
}: AppMobileMenuProps) {
  const { settings, updateSettings, setIsCatalogMode } = useAppContext();
  const { currentStaff, lockScreen, checkPermission, logoutStaff } = useStaffAuth();
  const { t } = useTranslation();

  if (!mobileMenuOpen) return null;

  const roleInfo = currentStaff ? ROLE_LABELS[currentStaff.role] : null;
  const canViewFinancials = checkPermission("canViewFinancialReports");

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setMobileMenuOpen(false)}
        className="absolute inset-0 bg-zinc-950/20 backdrop-blur-sm"
      />
      <motion.div
        initial={{ x: settings.language === "ar" ? "100%" : "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: settings.language === "ar" ? "100%" : "-100%" }}
        className={`absolute top-0 bottom-0 w-80 bg-white dark:bg-zinc-900 shadow-2xl ${
          settings.language === "ar" ? "right-0" : "left-0"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-lg font-bold text-zinc-900 dark:text-white">
            {t("menu")}
          </span>
          <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={20} className="text-zinc-500" />
          </button>
        </div>

        {/* Staff Profile Header Card */}
        <div className="p-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/60">
          {currentStaff ? (
            <div className="flex flex-col gap-2 bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-full text-xs font-black text-white flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: currentStaff.avatarColor || "#3b82f6" }}
                  >
                    {currentStaff.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">
                      {currentStaff.name}
                    </div>
                    {roleInfo && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleInfo.badgeBg}`}>
                        {roleInfo.ar}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      lockScreen();
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
                    title="قفل الشاشة"
                  >
                    <Lock size={16} />
                  </button>
                </div>
              </div>

              {currentStaff.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenStaffSwitcher) {
                      onOpenStaffSwitcher();
                    } else {
                      safeDispatchEvent("open-staff-switcher");
                    }
                  }}
                  className="w-full mt-1 py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-amber-300/60 dark:border-amber-700/60 shadow-2xs"
                >
                  <Users size={14} className="text-amber-600 dark:text-amber-400" />
                  <span>العودة لوضع المدير العام</span>
                </button>
              )}

              <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-700/50">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenStaffSwitcher) {
                      onOpenStaffSwitcher();
                    } else {
                      safeDispatchEvent("open-staff-switcher");
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700/60 dark:hover:bg-zinc-700 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 transition"
                >
                  <Users size={13} />
                  <span>تبديل الموظف</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setActiveTab("staff");
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-[11px] font-bold text-blue-700 dark:text-blue-300 transition border border-blue-200/60 dark:border-blue-800/60"
                >
                  <UserPlus size={13} />
                  <span>إدارة الطاقم</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logoutStaff();
                  }}
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                  title="تسجيل الخروج"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                if (onOpenStaffSwitcher) {
                  onOpenStaffSwitcher();
                } else {
                  safeDispatchEvent("open-staff-switcher");
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
            >
              <Users size={15} />
              <span>تسجيل الدخول / اختيار الموظف</span>
            </button>
          )}
        </div>

        <nav className="p-3 overflow-y-auto max-h-[calc(100dvh-10rem)] space-y-6 pb-[calc(2rem+env(safe-area-inset-bottom))] custom-scrollbar">
          {/* 1. العمليات اليومية */}
          <div className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              {t("main_operations") || "العمليات اليومية"}
            </div>
            {mainPagesTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 font-bold"
                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <tab.icon size={20} />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 2. التقارير والمالية - Only if permitted */}
          {canViewFinancials && (
            <>
              <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-3" />
              <div className="space-y-1">
                <div className="px-3 pb-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center justify-between">
                  <span>
                    {t("reports_analytics") || "التقارير والإحصائيات"}
                  </span>
                  <button
                    onClick={() =>
                      updateSettings({
                        showFinancials: !settings.showFinancials,
                      })
                    }
                    className="p-1 -mr-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    title={
                      settings.showFinancials
                        ? "إخفاء الإحصائيات"
                        : "إظهار الإحصائيات"
                    }
                  >
                    {settings.showFinancials ? (
                      <Eye size={16} />
                    ) : (
                      <EyeOff size={16} />
                    )}
                  </button>
                </div>
                {reportsSubpages.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab("reports");
                      setTimeout(
                        () =>
                          window.dispatchEvent(
                            new CustomEvent("open-analytics-tab", {
                              detail: tab.id,
                            }),
                          ),
                        100,
                      );
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <tab.icon
                      size={20}
                      className={
                        activeTab === "reports"
                          ? "text-brand-500"
                          : "text-zinc-400"
                      }
                    />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-3" />

          {/* 3. أدوات وتتبع */}
          <div className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              {t("smart_tracking") || "أدوات مساعدة للتجارة"}
            </div>
            {otherTabs
              .filter((t) =>
                [
                  "monitored-products",
                  "shopping-list",
                  "pos",
                  "invoice-calculator",
                  "draft-products",
                ].includes(t.id),
              )
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    activeTab === tab.id
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 font-bold"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  <tab.icon size={20} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-3" />

          {/* 4. تفضيلات النظام */}
          <div className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              {t("system_settings") || "تفضيلات وإعدادات"}
            </div>
            {otherTabs
              .filter((t) =>
                ["staff", "staff-management", "settings", "catalog-mode", "audit-logs"].includes(t.id),
              )
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === "catalog-mode") {
                      setIsCatalogMode(true);
                    } else {
                      setActiveTab(tab.id);
                    }
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    activeTab === tab.id
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 font-bold"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  <tab.icon size={20} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
          </div>
        </nav>
      </motion.div>
    </div>
  );
}

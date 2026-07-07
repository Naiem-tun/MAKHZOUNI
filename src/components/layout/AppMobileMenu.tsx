import { motion } from "motion/react";
import { X, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../AppContext";

interface AppMobileMenuProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mainPagesTabs: any[];
  reportsSubpages: any[];
  otherTabs: any[];
}

export function AppMobileMenu({
  mobileMenuOpen,
  setMobileMenuOpen,
  activeTab,
  setActiveTab,
  mainPagesTabs,
  reportsSubpages,
  otherTabs,
}: AppMobileMenuProps) {
  const { settings, updateSettings, setIsCatalogMode } = useAppContext();
  const { t } = useTranslation();

  if (!mobileMenuOpen) return null;

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
        <div className="flex h-18 items-center justify-between px-6 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-xl font-bold text-zinc-900 dark:text-white">
            {t("menu")}
          </span>
          <button onClick={() => setMobileMenuOpen(false)}>
            <X size={24} className="text-zinc-500" />
          </button>
        </div>
        <nav className="p-3 overflow-y-auto max-h-[calc(100vh-4.5rem)] space-y-6 pb-8 custom-scrollbar">
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

          <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-3" />

          {/* 2. التقارير والمالية */}
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
                ["settings", "catalog-mode", "audit-logs"].includes(t.id),
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

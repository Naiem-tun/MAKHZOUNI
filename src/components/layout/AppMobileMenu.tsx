import { motion } from "motion/react";
import { X, Eye, EyeOff, Lock, BarChart3, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../AppContext";
import { useFolioTheme } from "../folio/FolioPageChrome";

interface AppMobileMenuProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mainPagesTabs: any[];
  otherTabs: any[];
}

export function AppMobileMenu({
  mobileMenuOpen,
  setMobileMenuOpen,
  activeTab,
  setActiveTab,
  mainPagesTabs,
  otherTabs,
}: AppMobileMenuProps) {
  const { settings, updateSettings, setIsCatalogMode, lockApp } = useAppContext();
  const { t } = useTranslation();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

  if (!mobileMenuOpen) return null;

  const navItemStyle = (active: boolean) =>
    active
      ? {
          backgroundColor: theme.text,
          color: theme.surface,
          borderColor: theme.text,
        }
      : {
          backgroundColor: "transparent",
          color: theme.text,
          borderColor: "transparent",
        };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setMobileMenuOpen(false)}
        className="absolute inset-0 bg-black/45 backdrop-blur-xs"
      />
      <motion.div
        initial={{ x: settings.language === "ar" ? "100%" : "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: settings.language === "ar" ? "100%" : "-100%" }}
        className={`absolute top-0 bottom-0 w-80 border-x shadow-2xl ${
          settings.language === "ar" ? "right-0" : "left-0"
        }`}
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
          color: theme.text,
        }}
      >
        <div
          className="flex h-16 items-center justify-between px-5 border-b"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold" style={{ color: theme.accent }}>
              FOLIO
            </span>
            <span className="text-base font-black" style={{ color: theme.text }}>
              {t("menu")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 border cursor-pointer"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.textMuted,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="p-3 overflow-y-auto max-h-[calc(100dvh-4rem)] space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))] custom-scrollbar">
          {/* 01. العمليات اليومية */}
          <div className="space-y-1">
            <div className="px-2 pb-1.5 flex items-center gap-2 text-[11px] font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                01
              </span>
              <span style={{ color: theme.textMuted }}>
                {t("main_operations") || "العمليات اليومية"}
              </span>
            </div>
            {mainPagesTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 border text-xs font-bold transition-colors cursor-pointer"
                  style={navItemStyle(active)}
                >
                  <tab.icon size={17} style={{ color: active ? theme.surface : theme.textMuted }} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="h-px mx-2" style={{ backgroundColor: theme.border }} />

          {/* 02. التقارير والتحليلات */}
          <div className="space-y-1">
            <div className="px-2 pb-1.5 text-[11px] font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                  02
                </span>
                <span style={{ color: theme.textMuted }}>
                  {t("reports_analytics") || "التقارير والإحصائيات"}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateSettings({
                    showFinancials: !settings.showFinancials,
                  })
                }
                className="p-1 border cursor-pointer"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.textMuted,
                }}
                title={
                  settings.showFinancials
                    ? "إخفاء الإحصائيات"
                    : "إظهار الإحصائيات"
                }
              >
                {settings.showFinancials ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab("reports");
                setMobileMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 border text-xs font-bold transition-colors cursor-pointer"
              style={navItemStyle(activeTab === "reports")}
            >
              <BarChart3
                size={17}
                style={{ color: activeTab === "reports" ? theme.surface : theme.textMuted }}
              />
              <span>{t("reports") || "التقارير والتحليلات"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("category-analysis");
                setMobileMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 border text-xs font-bold transition-colors cursor-pointer"
              style={navItemStyle(activeTab === "category-analysis")}
            >
              <Layers
                size={17}
                style={{
                  color: activeTab === "category-analysis" ? theme.surface : theme.textMuted,
                }}
              />
              <span>تحليل الفئات والسلع</span>
            </button>
          </div>

          <div className="h-px mx-2" style={{ backgroundColor: theme.border }} />

          {/* 03. أدوات وتتبع */}
          <div className="space-y-1">
            <div className="px-2 pb-1.5 flex items-center gap-2 text-[11px] font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                03
              </span>
              <span style={{ color: theme.textMuted }}>
                {t("smart_tracking") || "أدوات مساعدة للتجارة"}
              </span>
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
              .map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 border text-xs font-bold transition-colors cursor-pointer"
                    style={navItemStyle(active)}
                  >
                    <tab.icon size={17} style={{ color: active ? theme.surface : theme.textMuted }} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
          </div>

          <div className="h-px mx-2" style={{ backgroundColor: theme.border }} />

          {/* 04. تفضيلات النظام */}
          <div className="space-y-1">
            <div className="px-2 pb-1.5 flex items-center gap-2 text-[11px] font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                04
              </span>
              <span style={{ color: theme.textMuted }}>
                {t("system_settings") || "تفضيلات وإعدادات"}
              </span>
            </div>
            {otherTabs
              .filter((t) =>
                ["settings", "catalog-mode", "audit-logs"].includes(t.id),
              )
              .map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (tab.id === "catalog-mode") {
                        setIsCatalogMode(true);
                      } else {
                        setActiveTab(tab.id);
                      }
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 border text-xs font-bold transition-colors cursor-pointer"
                    style={navItemStyle(active)}
                  >
                    <tab.icon size={17} style={{ color: active ? theme.surface : theme.textMuted }} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}

            {settings.appPinEnabled && settings.appPin && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  lockApp();
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 border text-xs font-bold transition-colors cursor-pointer"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.negative,
                }}
              >
                <Lock size={17} />
                <span>قفل التطبيق الآن</span>
              </button>
            )}
          </div>
        </nav>
      </motion.div>
    </div>
  );
}

import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { 
  ChevronLeft,
  BookOpen,
  ScanBarcode,
  Package,
  Play,
  ClipboardList,
  Wallet,
  Receipt,
  PieChart,
  Database,
  Zap
} from 'lucide-react';

import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

export const GuideView = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);
  
  const sections = [
    {
      title: t('guide_1_title'),
      content: t('guide_1_content'),
      icon: ScanBarcode
    },
    {
      title: t('guide_2_title'),
      content: t('guide_2_content'),
      icon: Package
    },
    {
      title: t('guide_3_title'),
      content: t('guide_3_content'),
      icon: Play
    },
    {
      title: t('guide_4_title'),
      content: t('guide_4_content'),
      icon: ClipboardList
    },
    {
      title: t('guide_5_title'),
      content: t('guide_5_content'),
      icon: Wallet
    },
    {
      title: t('guide_6_title'),
      content: t('guide_6_content'),
      icon: Receipt
    },
    {
      title: t('guide_7_title'),
      content: t('guide_7_content'),
      icon: PieChart
    },
    {
      title: t('guide_8_title'),
      content: t('guide_8_content'),
      icon: Database
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20" style={{ color: theme.text }}>
      <header
        className="flex items-center gap-3 border-b pb-4"
        style={{ borderColor: theme.border }}
      >
        <button
          type="button"
          onClick={onBack}
          className="h-10 w-10 border flex items-center justify-center cursor-pointer"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.text,
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-right">
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: theme.textMuted }}>
            <span style={{ color: theme.accent }}>الدليل</span>
            <span>·</span>
            <span>{t('learn_store_management')}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: theme.text }}>
            {t('user_guide')}
          </h1>
        </div>
        <div
          className="h-10 w-10 border flex items-center justify-center"
          style={{
            backgroundColor: theme.surfaceMuted,
            borderColor: theme.border,
            color: theme.accent,
          }}
        >
          <BookOpen size={20} />
        </div>
      </header>

      <div
        className="border divide-y"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        {sections.map((section, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            key={idx}
            className="flex gap-4 p-4 sm:p-5 text-right"
            style={{ borderColor: theme.border }}
          >
            <div
              className="h-11 w-11 border flex items-center justify-center shrink-0"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.accent,
              }}
            >
              <section.icon size={20} />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold" style={{ color: theme.accent }}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  {section.title}
                </h3>
              </div>
              <p className="text-xs leading-relaxed font-medium" style={{ color: theme.textMuted }}>
                {section.content}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div
        className="border p-6 text-center space-y-2"
        style={{
          backgroundColor: theme.surfaceMuted,
          borderColor: theme.border,
          color: theme.text,
        }}
      >
        <Zap className="mx-auto" size={24} style={{ color: theme.accent }} />
        <h4 className="text-base font-black">{t('guide_help_title')}</h4>
        <p className="text-xs font-medium" style={{ color: theme.textMuted }}>
          {t('guide_help_content')}
        </p>
      </div>
    </div>
  );
};

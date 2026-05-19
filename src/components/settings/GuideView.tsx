import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { 
  ChevronLeft,
  BookOpen,
  Home,
  Package,
  Clipboard,
  Truck,
  Wallet,
  Coffee,
  Printer,
  Database,
  Zap
} from 'lucide-react';

export const GuideView = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  
  const sections = [
    {
      title: t('guide_1_title'),
      content: t('guide_1_content'),
      icon: Home
    },
    {
      title: t('guide_2_title'),
      content: t('guide_2_content'),
      icon: Package
    },
    {
      title: t('guide_3_title'),
      content: t('guide_3_content'),
      icon: Clipboard
    },
    {
      title: t('guide_4_title'),
      content: t('guide_4_content'),
      icon: Truck
    },
    {
      title: t('guide_5_title'),
      content: t('guide_5_content'),
      icon: Wallet
    },
    {
      title: t('guide_6_title'),
      content: t('guide_6_content'),
      icon: Coffee
    },
    {
      title: t('guide_7_title'),
      content: t('guide_7_content'),
      icon: Printer
    },
    {
      title: t('guide_8_title'),
      content: t('guide_8_content'),
      icon: Database
    }
  ];

  return (
    <div className="space-y-8 pb-12">
      <header className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <button onClick={onBack} className="h-10 w-10 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 text-right">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">{t('user_guide')}</h1>
          <p className="text-[10px] uppercase font-bold tracking-widest text-brand-500">{t('learn_store_management')}</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 dark:bg-brand-950/20">
          <BookOpen size={24} />
        </div>
      </header>

      <div className="space-y-6">
        {sections.map((section, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={idx} 
            className="flex gap-4 group"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-2xl bg-white border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 shadow-sm group-hover:border-brand-200 transition-all">
                <section.icon size={22} />
              </div>
              {idx < sections.length - 1 && <div className="w-px flex-1 bg-zinc-100 dark:bg-zinc-800" />}
            </div>
            <div className="flex-1 text-right pt-1 pb-4">
              <h3 className="text-base font-black text-zinc-900 dark:text-white mb-2 leading-none flex items-center gap-2 justify-end">
                {section.title}
                <span className="h-1 w-4 bg-brand-500 rounded-full opacity-30" />
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                {section.content}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-brand-500 rounded-[32px] p-8 text-white text-center relative overflow-hidden shadow-xl shadow-brand-500/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="relative z-10">
          <Zap className="mx-auto mb-4 opacity-50" size={32} />
          <h4 className="text-xl font-black mb-2">{t('guide_help_title')}</h4>
          <p className="text-sm opacity-80 font-medium">
            {t('guide_help_content')}
          </p>
        </div>
      </div>
    </div>
  );
};

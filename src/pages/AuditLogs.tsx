import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { AuditLog } from '../types';
import { formatAppDate, roundMoney } from '../lib/utils';
import {
  Activity,
  Plus,
  Edit2,
  Trash2,
  Package,
  Truck,
  CreditCard,
  ClipboardCheck,
  Wallet,
  ShoppingCart,
} from 'lucide-react';
import { useFolioTheme } from '../components/folio/FolioPageChrome';

function cleanAuditText(text?: string | null): string {
  if (!text) return '';
  return text.replace(/(\d+\.\d{4,})/g, (match) => {
    const num = parseFloat(match);
    if (isNaN(num)) return match;
    return roundMoney(num).toString();
  });
}

export default function AuditLogs() {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, `users/${user.uid}/auditLogs`),
      orderBy('timestamp', 'desc'),
      limit(200),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData: AuditLog[] = [];
      snapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() } as AuditLog);
      });
      setLogs(logsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getActionColor = (action: string) => {
    if (action === 'create') return theme.positive;
    if (action === 'update') return theme.accent;
    if (action === 'delete') return theme.negative;
    return theme.textMuted;
  };

  const getActionIcon = (action: string) => {
    const color = getActionColor(action);
    switch (action) {
      case 'create':
        return <Plus size={12} style={{ color }} />;
      case 'update':
        return <Edit2 size={12} style={{ color }} />;
      case 'delete':
        return <Trash2 size={12} style={{ color }} />;
      default:
        return <Activity size={12} style={{ color }} />;
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'product':
        return <Package size={16} />;
      case 'supplier':
        return <Truck size={16} />;
      case 'debt':
        return <CreditCard size={16} />;
      case 'inventory':
        return <ClipboardCheck size={16} />;
      case 'expense':
        return <Wallet size={16} />;
      case 'purchase':
        return <ShoppingCart size={16} />;
      default:
        return <Activity size={16} />;
    }
  };

  const getActionName = (action: string) => {
    switch (action) {
      case 'create':
        return t('created') || 'إضافة';
      case 'update':
        return t('updated') || 'تعديل';
      case 'delete':
        return t('deleted') || 'حذف';
      default:
        return action;
    }
  };

  const getEntityName = (entityType: string) => {
    switch (entityType) {
      case 'product':
        return t('product') || 'منتج';
      case 'supplier':
        return t('supplier') || 'مورد';
      case 'debt':
        return t('debt') || 'دين';
      case 'inventory':
        return t('inventory') || 'جرد';
      case 'expense':
        return t('expense') || 'مصروف';
      case 'purchase':
        return t('purchase') || 'شراء';
      default:
        return entityType;
    }
  };

  return (
    <div className="space-y-5 pb-20 pt-4 md:pt-6" style={{ color: theme.text }}>
      {/* Editorial Header */}
      <header className="pb-4 border-b space-y-1" style={{ borderColor: theme.border }}>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
            01
          </span>
          <span className="tracking-wider uppercase font-mono" style={{ color: theme.textMuted }}>
            SYSTEM · AUDIT LOGS
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          {t('audit_logs') || 'سجل النشاطات'}
        </h1>
        <p className="text-xs sm:text-sm" style={{ color: theme.textMuted }}>
          {t('audit_logs_subtitle') || 'تتبع جميع العمليات والتغييرات في النظام'}
        </p>
      </header>

      <div className="border overflow-hidden" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
        {loading ? (
          <div className="p-10 text-center text-xs font-bold" style={{ color: theme.textMuted }}>
            <Activity className="animate-spin mx-auto mb-2" size={22} style={{ color: theme.accent }} />
            <p>{t('loading')}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Activity size={32} className="mx-auto mb-3 opacity-30" />
            <h3 className="text-base font-black mb-1">{t('no_audit_logs') || 'لا توجد نشاطات'}</h3>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              {t('no_audit_logs_desc') || 'لم يتم تسجيل أي عمليات بعد'}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: theme.border }}>
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 sm:p-4 flex items-center gap-3.5 transition-colors"
                style={{ borderColor: theme.border }}
              >
                <div
                  className="shrink-0 w-9 h-9 border flex items-center justify-center relative"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  {getEntityIcon(log.entityType)}
                </div>

                <div className="flex-grow min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5 mb-0.5 text-xs">
                    <span
                      className="inline-flex items-center gap-1 font-bold"
                      style={{ color: getActionColor(log.action) }}
                    >
                      {getActionIcon(log.action)}
                      <span>{getActionName(log.action)}</span>
                    </span>
                    <span style={{ color: theme.textMuted }}>·</span>
                    <span className="font-bold text-sm break-words">
                      {getEntityName(log.entityType)}: {cleanAuditText(log.entityName)}
                    </span>
                  </div>
                  {log.details && (
                    <p className="text-xs break-words whitespace-normal" style={{ color: theme.textMuted }}>
                      {cleanAuditText(log.details)}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-left font-mono text-[11px] tabular-nums" style={{ color: theme.textMuted }}>
                  {formatAppDate(log.timestamp?.toDate() || new Date(), settings?.language || 'ar', t, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

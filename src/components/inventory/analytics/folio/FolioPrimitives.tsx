import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Table2 } from 'lucide-react';
import { FolioTheme } from './folioTypes';

interface FolioSectionShellProps {
  id: string;
  indexNumber: string;
  kicker: string;
  title: string;
  leadLeft: string;
  leadRight: string;
  figureCaption: string;
  theme: FolioTheme;
  tableContent?: React.ReactNode;
  children: React.ReactNode;
}

export const FolioSectionShell: React.FC<FolioSectionShellProps> = ({
  id,
  indexNumber,
  kicker,
  title,
  leadLeft,
  leadRight,
  figureCaption,
  theme,
  tableContent,
  children,
}) => {
  const [showTable, setShowTable] = useState(false);

  return (
    <section
      id={id}
      className="scroll-mt-24 py-10 md:py-14 border-b transition-colors duration-200"
      style={{ borderColor: theme.border }}
    >
      {/* Kicker & Title */}
      <div className="max-w-3xl mb-6">
        <div
          className="text-xs font-mono tracking-wider mb-2 flex items-center gap-2"
          style={{ color: theme.textMuted }}
        >
          <span className="font-bold tabular-nums" style={{ color: theme.accent }}>
            {indexNumber}
          </span>
          <span aria-hidden="true">—</span>
          <span>{kicker}</span>
        </div>
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight [text-wrap:balance]"
          style={{ color: theme.text }}
        >
          {title}
        </h2>
      </div>

      {/* Editorial 2-Column Prose Lead */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-10 mb-8 text-sm sm:text-[15px] leading-relaxed"
        style={{ color: theme.textMuted }}
      >
        <p>{leadLeft}</p>
        <p>{leadRight}</p>
      </div>

      {/* Chart Canvas Area */}
      <div className="space-y-4">
        {children}

        {/* Figure Footer: Caption + Show Data Table Toggle */}
        <div
          className="pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ borderColor: theme.border }}
        >
          <div className="text-xs space-y-0.5" style={{ color: theme.textMuted }}>
            <div className="font-mono font-bold tabular-nums uppercase tracking-wider">
              FIG. {indexNumber}
            </div>
            <p>{figureCaption}</p>
          </div>

          {tableContent && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: showTable ? theme.text : theme.surface,
                color: showTable ? theme.surface : theme.text,
                borderColor: theme.border,
              }}
            >
              <Table2 size={14} />
              <span>{showTable ? 'إخفاء جدول البيانات' : 'عرض جدول البيانات'}</span>
              {showTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>

        {/* Collapsible Data Table */}
        {tableContent && showTable && (
          <div
            className="mt-4 border overflow-x-auto"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
            }}
          >
            {tableContent}
          </div>
        )}
      </div>
    </section>
  );
};

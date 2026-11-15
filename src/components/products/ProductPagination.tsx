import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';
import { resolveFolioTheme } from '../folio/FolioPageChrome';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  theme?: FolioTheme;
}

export function ProductPagination({
  currentPage,
  totalPages,
  onPageChange,
  theme,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const activeTheme = theme || resolveFolioTheme(false);

  const getPages = () => {
    const delta = 1;
    const range: (number | string)[] = [];
    const left = currentPage - delta;
    const right = currentPage + delta;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        range.push(i);
      } else if (i === left - 1 || i === right + 1) {
        range.push('...');
      }
    }
    return range.filter((v, i, a) => a.indexOf(v) === i);
  };

  return (
    <div className="flex items-center justify-center gap-1 py-4 pb-12" dir="ltr">
      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        className="flex h-9 w-9 items-center justify-center border transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        style={{
          backgroundColor: activeTheme.surface,
          borderColor: activeTheme.border,
          color: activeTheme.text,
        }}
      >
        <ChevronLeft size={14} strokeWidth={2} />
      </button>

      <div className="flex flex-row-reverse items-center gap-1 mx-1">
        {getPages().map((p, i) => {
          if (p === '...') {
            return (
              <span
                key={i}
                className="w-5 text-center text-xs font-mono"
                style={{ color: activeTheme.textMuted }}
              >
                ...
              </span>
            );
          }
          const active = currentPage === p;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPageChange(p as number)}
              className="flex h-9 w-9 items-center justify-center border text-xs font-mono tabular-nums font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: active ? activeTheme.text : activeTheme.surface,
                borderColor: active ? activeTheme.text : activeTheme.border,
                color: active ? activeTheme.surface : activeTheme.textMuted,
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        className="flex h-9 w-9 items-center justify-center border transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        style={{
          backgroundColor: activeTheme.surface,
          borderColor: activeTheme.border,
          color: activeTheme.text,
        }}
      >
        <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

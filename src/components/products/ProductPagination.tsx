import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ProductPagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const delta = 1;
    const range = [];
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
    <div className="flex items-center justify-center gap-1 py-5 pb-24" dir="ltr">
      {/* Next Button (Left side in RTL) */}
      <button 
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-100 bg-white text-zinc-900 shadow-sm transition-all hover:bg-zinc-50 active:scale-95 disabled:opacity-10 disabled:cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
      >
        <ChevronLeft size={14} strokeWidth={2} />
      </button>
      
      <div className="flex flex-row-reverse items-center gap-0.5 mx-1">
        {getPages().map((p, i) => {
          if (p === '...') {
            return <span key={i} className="w-4 text-center text-[10px] font-medium text-zinc-400">...</span>;
          }
          return (
            <button
              key={i}
              onClick={() => onPageChange(p as number)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                currentPage === p
                  ? 'bg-zinc-950 text-white shadow-md dark:bg-brand-600'
                  : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Previous Button (Right side in RTL) */}
      <button 
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-100 bg-white text-zinc-900 shadow-sm transition-all hover:bg-zinc-50 active:scale-95 disabled:opacity-10 disabled:cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
      >
        <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

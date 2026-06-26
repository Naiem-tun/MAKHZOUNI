import React from 'react';
import { cn } from '../lib/utils';
import { Package } from 'lucide-react';

export const Card = ({ children, className, variant = 'white' }: any) => {
  const bg = variant === 'white' ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50 dark:bg-zinc-800';
  return (
    <div className={cn("rounded-lg border border-neutral-200 dark:border-neutral-800", bg, className)}>
      {children}
    </div>
  );
};

export const Logo = ({ className }: { className?: string }) => (
  <div 
    className={`flex items-center justify-center bg-brand-600 text-white overflow-hidden shadow-brand-500/10 ${className}`}
    style={{ borderRadius: '28%' }}
  >
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="w-3/5 h-3/5"
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
      <path d="M16.5 9.42 7.5 4.27" />
    </svg>
  </div>
);

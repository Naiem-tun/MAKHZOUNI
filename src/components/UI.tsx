import React from 'react';
import { cn } from '../lib/utils';
import { Package } from 'lucide-react';

export const Card = ({ children, className, variant = 'white' }: any) => {
  const bg = variant === 'white' ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50 dark:bg-zinc-800';
  return (
    <div className={cn("rounded-2xl border border-neutral-200 dark:border-neutral-800", bg, className)}>
      {children}
    </div>
  );
};

export const Button = ({ children, onClick, className, variant = 'primary', size = 'md' }: any) => {
  const variants: any = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700',
    ghost: 'bg-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
    danger: 'bg-[#B34C36] text-white hover:opacity-90 transition-opacity shadow-sm',
  };
  
  const sizes: any = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  };

  return (
    <button 
      onClick={onClick}
      className={cn("flex items-center justify-center gap-2 rounded-2xl font-bold transition-all active:scale-95", variants[variant], sizes[size], className)}
    >
      {children}
    </button>
  );
};

export const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6 relative">
        <button onClick={onClose} className="absolute top-4 left-4 text-zinc-400 hover:text-zinc-600">×</button>
        {title && <h2 className="text-xl font-bold mb-6 text-right">{title}</h2>}
        {children}
      </Card>
    </div>
  );
};

export const ProductIcon = ({ category, className }: any) => (
  <div className={cn("flex items-center justify-center rounded-2xl bg-zinc-50 text-zinc-400 dark:bg-zinc-800", className)}>
    <Package size={16} />
  </div>
);

export const Logo = ({ className }: { className?: string }) => (
  <div 
    className={`flex items-center justify-center bg-[#5B89BB] text-white overflow-hidden shadow-indigo-500/10 ${className}`}
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

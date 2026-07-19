const fs = require('fs');
let code = fs.readFileSync('src/components/inventory/InventoryCompareModal.tsx', 'utf8');

// Replace table row
const rowTarget = `                            return sortedResult.map((item: any, idx: number) => {
                              const { oldVal, newVal, diff, format, isNew } = renderMetric(item);
                            const isDeleted = item.deleted;
                               
                            return (
                              <tr key={idx} className={cn("hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors", isDeleted && "opacity-60")}>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100">{item.name}</div>
                                  <div className="text-[10px] text-zinc-400 mt-0.5">
                                    {isNew && <span className="text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-medium">منتج جديد</span>}
                                    {isDeleted && <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-medium">غير متوفر حالياً</span>}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center font-medium text-zinc-500">
                                  {isNew ? '—' : format(oldVal)}
                                </td>
                                <td className="py-3 px-4 text-center font-bold text-zinc-900 dark:text-zinc-100">
                                  {format(newVal)}
                                </td>
                                <td className="py-3 px-4">
                                  <div className={cn(
                                    "flex items-center justify-center gap-1 font-bold rounded-lg py-1 px-2 mx-auto w-fit whitespace-nowrap",
                                    diff > 0 ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10" : 
                                    diff < 0 ? "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-500/10" : 
                                    "text-zinc-500 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-800"
                                  )}>
                                    {diff > 0 ? <TrendingUp size={14} /> : diff < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                                    <span dir="ltr">{diff > 0 ? '+' : ''}{format(diff)}</span>
                                  </div>
                                </td>
                              </tr>
                            );`;

const rowReplacement = `                            return sortedResult.map((item: any, idx: number) => {
                              const { oldVal, newVal, diff, format, isNew, pct } = renderMetric(item);
                              const isDeleted = item.deleted;
                               
                              return (
                                <tr key={idx} className={cn("hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors", isDeleted && "opacity-60")}>
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-zinc-900 dark:text-zinc-100">{item.name}</div>
                                    <div className="text-[10px] text-zinc-400 mt-1 flex flex-wrap gap-1">
                                      {isNew && <span className="text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-medium">منتج جديد</span>}
                                      {isDeleted && <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-medium">غير متوفر حالياً</span>}
                                      {compareMode === 'capital' && item.newQty > 0 && item.newSold === 0 && <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-medium">منتج راكد</span>}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center font-medium text-zinc-500">
                                    {isNew ? '—' : format(oldVal)}
                                  </td>
                                  <td className="py-3 px-4 text-center font-bold text-zinc-900 dark:text-zinc-100">
                                    {format(newVal)}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex flex-col items-center justify-center gap-1">
                                      <div className={cn(
                                        "flex items-center justify-center gap-1 font-bold rounded-lg py-1 px-2 mx-auto w-fit whitespace-nowrap",
                                        diff > 0 ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10" : 
                                        diff < 0 ? "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-500/10" : 
                                        "text-zinc-500 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-800"
                                      )}>
                                        {diff > 0 ? <TrendingUp size={14} /> : diff < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                                        <span dir="ltr">{diff > 0 ? '+' : ''}{format(diff)}</span>
                                      </div>
                                      {diff !== 0 && !isNew && !isDeleted && (
                                        <div className={cn(
                                          "text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center",
                                          diff > 0 ? "text-emerald-600 bg-emerald-500/10" : "text-red-600 bg-red-500/10"
                                        )}>
                                          <span dir="ltr">{diff > 0 ? '+' : ''}{pct?.toFixed(1)}%</span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );`;

code = code.replace(rowTarget, rowReplacement);

// Replace modal overlay with full screen view
const modalTarget = `    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">مقارنة الجرد الذكية</h3>
                  <p className="text-xs text-zinc-500">مقارنة المبيعات، الأرباح، والكميات بين جردين</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 sm:p-5 overflow-y-auto flex-1">`;

const modalReplacement = `    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col w-full h-full"
          >
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">مقارنة الجرد الذكية</h3>
                  <p className="text-xs text-zinc-500">مقارنة المبيعات، الأرباح، والكميات بين جردين</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 w-full max-w-5xl mx-auto">`;

code = code.replace(modalTarget, modalReplacement);

const tableWrapperTarget = `                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                      <table className="w-full text-sm text-right">`;

const tableWrapperReplacement = `                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-[500px]">
                    <div className="overflow-x-auto overflow-y-auto flex-1">
                      <table className="w-full text-sm text-right relative">`;

code = code.replace(tableWrapperTarget, tableWrapperReplacement);

fs.writeFileSync('src/components/inventory/InventoryCompareModal.tsx', code);

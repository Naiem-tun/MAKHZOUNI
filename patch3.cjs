const fs = require('fs');
let code = fs.readFileSync('src/components/inventory/InventoryCompareModal.tsx', 'utf8');

// Replace tabs
code = code.replace(
  'className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-x-auto w-full sm:w-auto"',
  'className="flex items-center gap-1 sm:gap-2 bg-white dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-x-auto w-full no-scrollbar"'
);
code = code.replaceAll(
  'className={cn("px-4 py-1.5 text-sm',
  'className={cn("px-3 sm:px-4 py-1.5 text-xs sm:text-sm'
);

// Replace table header
const theadTarget = `<table className="w-full text-sm text-right relative">
                        <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 sticky top-0 border-b border-zinc-200 dark:border-zinc-700 z-10 whitespace-nowrap">
                          <tr>
                            <th className="py-3 px-4 font-bold min-w-[140px]">المنتج</th>
                            <th className="py-3 px-4 text-center font-bold min-w-[100px]">الجرد 1</th>
                            <th className="py-3 px-4 text-center font-bold min-w-[100px]">الجرد 2</th>
                            <th className="py-3 px-4 text-center font-bold min-w-[100px]">الفرق</th>
                          </tr>
                        </thead>`;

const theadReplacement = `<table className="w-full text-xs sm:text-sm text-right relative">
                        <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 sticky top-0 border-b border-zinc-200 dark:border-zinc-700 z-10 whitespace-nowrap shadow-sm">
                          <tr>
                            <th className="py-3 px-2 sm:px-4 font-bold text-right">المنتج</th>
                            <th className="py-3 px-2 sm:px-4 text-center font-bold">الجرد 1</th>
                            <th className="py-3 px-2 sm:px-4 text-center font-bold">الجرد 2</th>
                            <th className="py-3 px-2 sm:px-4 text-center font-bold">الفرق</th>
                          </tr>
                        </thead>`;

code = code.replace(theadTarget, theadReplacement);

// Replace td classes
code = code.replaceAll('<td className="py-3 px-4">', '<td className="py-3 px-2 sm:px-4">');
code = code.replaceAll('<td className="py-3 px-4 text-center font-medium text-zinc-500">', '<td className="py-3 px-2 sm:px-4 text-center font-medium text-zinc-500">');
code = code.replaceAll('<td className="py-3 px-4 text-center font-bold text-zinc-900 dark:text-zinc-100">', '<td className="py-3 px-2 sm:px-4 text-center font-bold text-zinc-900 dark:text-zinc-100">');

fs.writeFileSync('src/components/inventory/InventoryCompareModal.tsx', code);

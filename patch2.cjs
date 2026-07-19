const fs = require('fs');
let code = fs.readFileSync('src/components/inventory/InventoryCompareModal.tsx', 'utf8');

code = code.replace('<div className="space-y-4">', '<div className="flex flex-col h-full gap-4 pb-20">');
fs.writeFileSync('src/components/inventory/InventoryCompareModal.tsx', code);

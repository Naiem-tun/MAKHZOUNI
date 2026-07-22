const fs = require('fs');
let code = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

code = code.replace(
  "if (!products || products.length === 0) return 0;",
  "if (!groupedProducts || groupedProducts.length === 0) return 0;"
);

fs.writeFileSync('src/pages/Inventory.tsx', code);

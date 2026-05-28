import fs from 'fs';

const errors = `
src/App.tsx(43,1)
src/components/settings/CategoriesManager.tsx(9,1)
src/components/settings/DataManagement.tsx(11,1)
src/components/settings/GuideView.tsx(16,1)
src/pages/Analytics.tsx(9,1)
src/pages/Analytics.tsx(14,1)
src/pages/Dashboard.tsx(26,1)
src/pages/Inventory.tsx(7,1)
src/pages/Inventory.tsx(20,1)
src/pages/InvoiceCalculator.tsx(14,1)
src/pages/Products.tsx(19,1)
src/pages/SettingsPage.tsx(54,1)
src/pages/ShoppingList.tsx(12,1)
src/pages/ShoppingList.tsx(25,1)
`;

const lines = errors.trim().split('\n');
for (const line of lines) {
  const match = line.match(/^(.+?)\((\d+),/);
  if (match) {
    const file = match[1];
    const errorLine = parseInt(match[2], 10);
    
    let content = fs.readFileSync(file, 'utf8').split('\n');
    let insertIdx = Math.max(0, errorLine - 2);
    while (insertIdx > 0) {
      if (content[insertIdx - 1].includes('import ') || content[insertIdx - 1].trim() === '') {
        break;
      }
      insertIdx--;
    }
    content.splice(insertIdx, 0, 'import {');
    fs.writeFileSync(file, content.join('\n'));
    console.log('Fixed', file);
  }
}

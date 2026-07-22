const fs = require('fs');
let code = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

// We need to inject distributeQuantityToProducts outside the component
const distributeLogic = `
function distributeQuantityToProducts(originalProducts: any[], newTotalQty: number) {
  const currentTotal = originalProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const diff = newTotalQty - currentTotal;
  
  if (diff === 0) {
    return originalProducts.map(p => ({ product: p, newQty: p.quantity || 0 }));
  }

  const products = originalProducts.map(p => ({ ...p, currentQty: p.quantity || 0 }));

  if (diff > 0) {
    products[products.length - 1].currentQty += diff;
  } else {
    let remainingToDeduct = Math.abs(diff);
    for (let i = 0; i < products.length; i++) {
      if (remainingToDeduct <= 0) break;
      
      const p = products[i];
      if (p.currentQty > 0) {
        const deductAmount = Math.min(p.currentQty, remainingToDeduct);
        p.currentQty -= deductAmount;
        remainingToDeduct -= deductAmount;
      }
    }
    
    if (remainingToDeduct > 0) {
      products[products.length - 1].currentQty -= remainingToDeduct;
    }
  }

  return products.map(p => ({
    product: p,
    newQty: p.currentQty
  }));
}
`;

code = code.replace("export default function Inventory() {", distributeLogic + "\nexport default function Inventory() {");

// Now we need to define groupedProducts inside the component
const groupedProductsLogic = `
  const groupedProducts = useMemo(() => {
    const groups: Record<string, any> = {};

    products.forEach(p => {
      const key = (p.barcode || p.name).trim().toLowerCase();
      
      if (!groups[key]) {
        groups[key] = {
          id: key, // Using this as the fake product ID
          name: p.name,
          barcode: p.barcode || p.barcode2 || '',
          category: p.category,
          quantity: 0,
          sellingPrice: p.sellingPrice || 0,
          purchasePrice: p.purchasePrice || p.costPrice || 0,
          costPrice: p.costPrice || p.purchasePrice || 0,
          piecesPerBox: p.piecesPerBox,
          hasLocalImage: p.hasLocalImage,
          hasCloudImage: p.hasCloudImage,
          isGroup: true,
          originalProducts: []
        };
      }
      
      groups[key].originalProducts.push(p);
      groups[key].quantity += (p.quantity || 0);
    });

    Object.values(groups).forEach(group => {
      group.originalProducts.sort((a: any, b: any) => {
        const timeA = a.updatedAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || 0;
        return timeA - timeB;
      });
    });

    return Object.values(groups);
  }, [products]);
`;

code = code.replace("const [currentPage, setCurrentPage] = useState(1);", "const [currentPage, setCurrentPage] = useState(1);\n" + groupedProductsLogic);

// Replace filteredProducts to use groupedProducts
code = code.replace(
  "const filteredProducts = useMemo(() => {\n    if (!products) return [];",
  "const filteredProducts = useMemo(() => {\n    if (!groupedProducts) return [];\n    const productsToFilter = groupedProducts;"
);
code = code.replace(
  "const filtered = products.filter(p => {",
  "const filtered = productsToFilter.filter((p: any) => {"
);
code = code.replace(
  "}, [products, searchTerm, categoryFilter, showUninventoriedOnly, inventoryData]);",
  "}, [groupedProducts, searchTerm, categoryFilter, showUninventoriedOnly, inventoryData]);"
);

// getDraftItems needs to iterate over groupedProducts
const draftItemsTarget = `  const getDraftItems = useCallback(() => {
    return products.map(p => {
      const actualQty = inventoryData[p.id];
      const finalQty = actualQty !== undefined ? Number(actualQty) : Number(p.quantity || 0);
      const sold = Number(p.quantity || 0) - finalQty;
      const remainingValue = finalQty * (Number(p.purchasePrice || p.costPrice) || 0);
      const revenue = sold * Number(p.sellingPrice || 0);
      const profit = revenue - (sold * (Number(p.purchasePrice || p.costPrice) || 0));
      return {
        productName: p.name, 
        category: p.category,
        barcode: p.barcode || p.barcode2 || '',
        purchasePrice: p.purchasePrice || p.costPrice || 0,
        sellingPrice: p.sellingPrice || 0,
        quantityBefore: p.quantity || 0, 
        quantityAfter: finalQty, 
        salesCalculated: sold, 
        profit: sold > 0 ? profit : 0,
        remainingValue 
      };
    });
  }, [products, inventoryData]);`;

const draftItemsReplacement = `  const getDraftItems = useCallback(() => {
    return groupedProducts.map(p => {
      const actualQty = inventoryData[p.id];
      const finalQty = actualQty !== undefined ? Number(actualQty) : Number(p.quantity || 0);
      const sold = Number(p.quantity || 0) - finalQty;
      const remainingValue = finalQty * (Number(p.purchasePrice || p.costPrice) || 0);
      const revenue = sold * Number(p.sellingPrice || 0);
      const profit = revenue - (sold * (Number(p.purchasePrice || p.costPrice) || 0));
      return {
        productName: p.name, 
        category: p.category,
        barcode: p.barcode || '',
        purchasePrice: p.purchasePrice || 0,
        sellingPrice: p.sellingPrice || 0,
        quantityBefore: p.quantity || 0, 
        quantityAfter: finalQty, 
        salesCalculated: sold, 
        profit: sold > 0 ? profit : 0,
        remainingValue 
      };
    });
  }, [groupedProducts, inventoryData]);`;

code = code.replace(draftItemsTarget, draftItemsReplacement);

// Update progress calculation
code = code.replace(
  "return Math.round((completed / products.length) * 100);",
  "return Math.round((completed / groupedProducts.length) * 100);"
);
code = code.replace(
  "}, [products, inventoryData]);",
  "}, [groupedProducts, inventoryData]);"
);

// handleSave logic needs to use groupedProducts and distributeQuantityToProducts
const saveTarget = `        // calculate remaining value for ALL products
        products.forEach(p => {
          const actualQty = inventoryData[p.id];
          const finalQty = actualQty !== undefined ? Number(actualQty) : Number(p.quantity || 0);
          totalRemainingValue += finalQty * (Number(p.purchasePrice || p.costPrice) || 0);
          
          const sold = Number(p.quantity || 0) - finalQty;
          const remainingValue = finalQty * (Number(p.purchasePrice || p.costPrice) || 0);
          
          const revenue = sold * Number(p.sellingPrice || 0);
          const profit = revenue - (sold * (Number(p.purchasePrice || p.costPrice) || 0));
          
          if (sold > 0) {
            totalRevenue += revenue;
            totalProfit += profit;
          }
          
          items.push({ 
            productName: p.name, 
            category: p.category,
            barcode: p.barcode || p.barcode2 || '',
            purchasePrice: p.purchasePrice || p.costPrice || 0,
            sellingPrice: p.sellingPrice || 0,
            quantityBefore: p.quantity || 0, 
            quantityAfter: finalQty, 
            salesCalculated: sold, 
            profit: sold > 0 ? profit : 0,
            remainingValue 
          });
          
          if (actualQty !== undefined) {
            const productRef = doc(db, \`users/\${user.uid}/products\`, p.id!);
            batch.update(productRef, {
              quantity: finalQty,
              posQuantity: finalQty,
              updatedAt: auditTime,
              lastInventoryDate: auditTime
            });
          }
        });`;

const saveReplacement = `        // Process grouped products
        groupedProducts.forEach(group => {
          const actualQty = inventoryData[group.id];
          const groupFinalQty = actualQty !== undefined ? Number(actualQty) : Number(group.quantity || 0);
          
          totalRemainingValue += groupFinalQty * (Number(group.purchasePrice) || 0);
          const sold = Number(group.quantity || 0) - groupFinalQty;
          const remainingValue = groupFinalQty * (Number(group.purchasePrice) || 0);
          
          const revenue = sold * Number(group.sellingPrice || 0);
          const profit = revenue - (sold * (Number(group.purchasePrice) || 0));
          
          if (sold > 0) {
            totalRevenue += revenue;
            totalProfit += profit;
          }
          
          items.push({ 
            productName: group.name, 
            category: group.category,
            barcode: group.barcode || '',
            purchasePrice: group.purchasePrice || 0,
            sellingPrice: group.sellingPrice || 0,
            quantityBefore: group.quantity || 0, 
            quantityAfter: groupFinalQty, 
            salesCalculated: sold, 
            profit: sold > 0 ? profit : 0,
            remainingValue 
          });
          
          if (actualQty !== undefined) {
            const distributed = distributeQuantityToProducts(group.originalProducts, groupFinalQty);
            distributed.forEach(({ product, newQty }) => {
              const productRef = doc(db, \`users/\${user.uid}/products\`, product.id!);
              batch.update(productRef, {
                quantity: newQty,
                posQuantity: newQty,
                updatedAt: auditTime,
                lastInventoryDate: auditTime
              });
            });
          }
        });`;

code = code.replace(saveTarget, saveReplacement);

// handleScan logic update
const scanTarget = `  const handleScan = (decodedText: string) => {
    setIsScannerOpen(false);
    
    const foundProduct = products.find(p => p.barcode === decodedText || p.barcode2 === decodedText);
    
    if (foundProduct) {
      setSearchTerm(decodedText);
      showToast(\`\${t('found')}: \${foundProduct.name}\`, 'success');
    } else {
      showToast(t('product_not_found_inventory'), 'error');
    }
  };`;
const scanReplacement = `  const handleScan = (decodedText: string) => {
    setIsScannerOpen(false);
    
    const foundProduct = groupedProducts.find(p => p.barcode === decodedText || p.id === decodedText.toLowerCase());
    
    if (foundProduct) {
      setSearchTerm(decodedText);
      showToast(\`\${t('found')}: \${foundProduct.name}\`, 'success');
    } else {
      showToast(t('product_not_found_inventory'), 'error');
    }
  };`;

code = code.replace(scanTarget, scanReplacement);

fs.writeFileSync('src/pages/Inventory.tsx', code);

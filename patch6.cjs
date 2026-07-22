const fs = require('fs');
let code = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

const draftItemsTarget = `  const getDraftItems = useCallback(() => {
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

const draftItemsReplacement = `  const getDraftItems = useCallback(() => {
    return groupedProducts.map(group => {
      const actualQty = inventoryData[group.id];
      const finalQty = actualQty !== undefined ? Number(actualQty) : Number(group.quantity || 0);
      const sold = Number(group.quantity || 0) - finalQty;
      
      let groupRevenue = 0;
      let groupCost = 0;
      let groupProfit = 0;
      let groupRemainingValue = 0;
      
      const distributed = distributeQuantityToProducts(group.originalProducts, finalQty);
      
      distributed.forEach(({ product, newQty }) => {
         const oldQty = product.quantity || 0;
         const itemSold = oldQty - newQty;
         
         const cost = Number(product.purchasePrice || product.costPrice || 0);
         const price = Number(product.sellingPrice || 0);
         
         groupRemainingValue += newQty * cost;
         
         if (itemSold > 0) {
            groupRevenue += itemSold * price;
            groupCost += itemSold * cost;
            groupProfit += itemSold * (price - cost);
         }
      });

      return {
        productName: group.name, 
        category: group.category,
        barcode: group.barcode || '',
        purchasePrice: group.purchasePrice || 0,
        sellingPrice: group.sellingPrice || 0,
        quantityBefore: group.quantity || 0, 
        quantityAfter: finalQty, 
        salesCalculated: sold, 
        profit: sold > 0 ? groupProfit : 0,
        remainingValue: groupRemainingValue 
      };
    });
  }, [groupedProducts, inventoryData]);`;

code = code.replace(draftItemsTarget, draftItemsReplacement);

const saveTarget = `        // Process grouped products
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

const saveReplacement = `        // Process grouped products
        groupedProducts.forEach(group => {
          const actualQty = inventoryData[group.id];
          const groupFinalQty = actualQty !== undefined ? Number(actualQty) : Number(group.quantity || 0);
          
          let groupRevenue = 0;
          let groupCost = 0;
          let groupProfit = 0;
          let groupRemainingValue = 0;
          
          const distributed = distributeQuantityToProducts(group.originalProducts, groupFinalQty);
          
          distributed.forEach(({ product, newQty }) => {
             const oldQty = product.quantity || 0;
             const itemSold = oldQty - newQty;
             
             const cost = Number(product.purchasePrice || product.costPrice || 0);
             const price = Number(product.sellingPrice || 0);
             
             groupRemainingValue += newQty * cost;
             
             if (itemSold > 0) {
                groupRevenue += itemSold * price;
                groupCost += itemSold * cost;
                groupProfit += itemSold * (price - cost);
             }
          });

          totalRemainingValue += groupRemainingValue;
          const sold = Number(group.quantity || 0) - groupFinalQty;
          
          if (sold > 0) {
            totalRevenue += groupRevenue;
            totalProfit += groupProfit;
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
            profit: sold > 0 ? groupProfit : 0,
            remainingValue: groupRemainingValue 
          });
          
          if (actualQty !== undefined) {
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

fs.writeFileSync('src/pages/Inventory.tsx', code);

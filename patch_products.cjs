const fs = require('fs');
let content = fs.readFileSync('src/pages/Products.tsx', 'utf8');

// Revert the malformed parts
content = content.replace("handleFirestoreError(err, OperationType.UPDATE, `use  const handleSaveProduct = async (productData: any, imageFile?: File | Blob | null, imageRemoved?: boolean) => {", 
`handleFirestoreError(err, OperationType.UPDATE, \`users/\${user.uid}/products\`);
      throw err;
    }
  };

  const handleSaveProduct = async (productData: any, imageFile?: File | Blob | null, imageRemoved?: boolean) => {`);

content = content.replace(`    } catch (err) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE, \`users/\${user.uid}/products\`);
      throw err; // throw error so the modal knows transaction failed and resets isSaving state
    }
  };ch (err) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE, \`users/\${user.uid}/products\`);
      throw err; // throw error so the modal knows transaction failed and resets isSaving state
    }
  };`, `    } catch (err) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE, \`users/\${user.uid}/products\`);
      throw err;
    }
  };`);

fs.writeFileSync('src/pages/Products.tsx', content);

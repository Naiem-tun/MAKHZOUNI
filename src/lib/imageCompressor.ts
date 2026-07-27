export async function compressImage(file: File | Blob, maxWidth = 600, quality = 0.6): Promise<Blob> {
  return new Promise((resolve) => {
    if (!file || !(file instanceof Blob)) {
      resolve(file as any);
      return;
    }

    try {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const result = event.target?.result;
          if (!result || typeof result !== 'string') {
            resolve(file);
            return;
          }

          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;

              if (!width || !height) {
                resolve(file);
                return;
              }

              // Calculate new dimensions while maintaining aspect ratio
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(file); // Fallback to original if canvas fails
                return;
              }

              // Fill white background in case of transparent images
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);

              canvas.toBlob(
                (blob) => {
                  resolve(blob || file);
                },
                'image/jpeg',
                quality
              );
            } catch (canvasErr) {
              console.warn('Canvas image compression failed, using original file:', canvasErr);
              resolve(file);
            }
          };

          img.onerror = () => {
            console.warn('Failed to load image element for compression, using original file');
            resolve(file);
          };

          img.src = result;
        } catch (loadErr) {
          console.warn('Error reading image result for compression, using original file:', loadErr);
          resolve(file);
        }
      };

      reader.onerror = () => {
        console.warn('FileReader failed during compression, using original file');
        resolve(file);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('FileReader initiation error during compression, using original file:', err);
      resolve(file);
    }
  });
}

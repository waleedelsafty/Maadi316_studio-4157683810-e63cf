
/**
 * Resizes an image file to a specified maximum width while maintaining aspect ratio.
 * @param file The image file to resize.
 * @param maxWidth The maximum width of the resized image.
 * @returns A promise that resolves with the base64 data URL of the resized image (JPEG format).
 */
export function resizeImage(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Use JPEG format with quality setting to significantly reduce size
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8); 
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

    
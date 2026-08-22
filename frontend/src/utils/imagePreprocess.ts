/**
 * Safe client-side image enhancer for receipt OCR:
 * - Grayscale conversion
 * - High-contrast boost without clipping shadows
 * - Preserves character edges for thermal printers
 */
export async function preprocessReceiptImage(imageUriOrDataUrl: string): Promise<string> {
  if (typeof document === "undefined") {
    return imageUriOrDataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(imageUriOrDataUrl);
          return;
        }

        // Maintain good resolution (max 1600px width/height for fast WASM OCR)
        let width = img.width;
        let height = img.height;
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Smooth contrast enhancement (contrast = 1.25)
        const contrast = 1.25;
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

        for (let i = 0; i < data.length; i += 4) {
          // Standard luminosity grayscale
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          // Apply gentle contrast
          const enhanced = Math.max(0, Math.min(255, factor * (gray - 128) + 128));

          data[i] = enhanced;
          data[i + 1] = enhanced;
          data[i + 2] = enhanced;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (e) {
        console.warn("Image preprocessing fallback:", e);
        resolve(imageUriOrDataUrl);
      }
    };
    img.onerror = () => resolve(imageUriOrDataUrl);
    img.src = imageUriOrDataUrl;
  });
}

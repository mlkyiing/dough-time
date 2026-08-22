/**
 * High-performance image pre-processing for receipt OCR:
 * - Grayscale conversion
 * - High-contrast boost
 * - Threshold binarization (sharpens faint thermal printer dots into solid text)
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

        // Scale image if too small to ensure high DPI for OCR
        const scale = img.width < 1200 ? 1.5 : 1.0;
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);

        // Draw image scaled
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Contrast & brightness enhancement
        const contrast = 1.35; // boost contrast
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

        for (let i = 0; i < data.length; i += 4) {
          // Standard luminosity grayscale
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          // Apply contrast
          let enhanced = factor * (gray - 128) + 128;

          // Adaptive thresholding: thermal text ink is dark
          if (enhanced < 140) {
            enhanced = enhanced * 0.4; // make text crisp black
          } else {
            enhanced = 255; // make paper crisp white
          }

          enhanced = Math.max(0, Math.min(255, enhanced));

          data[i] = enhanced;
          data[i + 1] = enhanced;
          data[i + 2] = enhanced;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.95));
      } catch (e) {
        console.warn("Image preprocessing fallback:", e);
        resolve(imageUriOrDataUrl);
      }
    };
    img.onerror = () => resolve(imageUriOrDataUrl);
    img.src = imageUriOrDataUrl;
  });
}

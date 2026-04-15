/**
 * Shared color utility functions for profile-based background theming.
 * Used by FriendProfile, FriendCollection, Home, and related pages.
 */

export const getLighterColor = (rgbString) => {
  if (!rgbString) return null;
  const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgbString;
  const r = Math.min(255, Math.floor(parseInt(match[1]) * 1.4));
  const g = Math.min(255, Math.floor(parseInt(match[2]) * 1.4));
  const b = Math.min(255, Math.floor(parseInt(match[3]) * 1.4));
  return `rgb(${r}, ${g}, ${b})`;
};

export const getDarkerColor = (rgbString) => {
  if (!rgbString) return null;
  const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgbString;
  const r = Math.floor(parseInt(match[1]) * 0.6);
  const g = Math.floor(parseInt(match[2]) * 0.6);
  const b = Math.floor(parseInt(match[3]) * 0.6);
  return `rgb(${r}, ${g}, ${b})`;
};

export const getRgbaFromRgb = (rgbString, opacity) => {
  if (!rgbString) return null;
  const safeOpacity =
    typeof opacity === "number" && opacity >= 0 && opacity <= 1 ? opacity : 1;
  const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgbString;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${safeOpacity})`;
};

export const computeAverageColorFromImage = (imageUrl) => {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

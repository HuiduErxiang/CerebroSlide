/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SlideElement } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const withRetry = async <T,>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (err: any) {
    const isNetworkError = err.message?.includes('xhr') || err.message?.includes('Rpc failed') || err.message?.includes('fetch');
    if (retries > 0 && isNetworkError) {
      console.log(`Retrying... attempts left: ${retries}`);
      await new Promise(r => setTimeout(r, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const resizeImage = (base64Str: string, maxWidth = 512, maxHeight = 512): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Use JPEG with 0.8 quality for smaller file size in XML
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

export function detectAndFixOverlaps(elements: SlideElement[]): SlideElement[] {
  const textElements = elements.filter(el => el.type === 'text');
  const nonTextElements = elements.filter(el => el.type !== 'text');

  const sorted = [...textElements].sort((a, b) => a.y - b.y);

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const xOverlap = a.x < b.x + b.w && b.x < a.x + a.w;
      if (!xOverlap) continue;
      const yOverlap = a.y < b.y + b.h && b.y < a.y + a.h;
      if (!yOverlap) continue;
      const newY = a.y + a.h + 2;
      sorted[j] = { ...sorted[j], y: newY };
      const overflow = newY + sorted[j].h - 100;
      if (overflow > 0) {
        sorted[j] = { ...sorted[j], h: Math.max(sorted[j].h - overflow, 5) };
      }
    }
  }

  return [...nonTextElements, ...sorted];
}

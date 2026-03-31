/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pptxgen from "pptxgenjs";
import { Project } from "../types";

const formatColor = (color: string | undefined): string => {
  if (!color || color === 'transparent') return "000000";
  
  // Handle rgb/rgba
  if (color.startsWith('rgb')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, '0');
      const g = parseInt(match[2]).toString(16).padStart(2, '0');
      const b = parseInt(match[3]).toString(16).padStart(2, '0');
      return (r + g + b).toUpperCase();
    }
  }

  let hex = color.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  // Ensure it's a valid hex string of length 6
  hex = hex.replace(/[^0-9A-Fa-f]/g, '0');
  if (hex.length < 6) hex = hex.padEnd(6, '0');
  return hex.substring(0, 6).toUpperCase();
};

const safeNumber = (num: any, fallback: number = 0): number => {
  const n = parseFloat(num);
  if (isNaN(n) || !isFinite(n)) return fallback;
  return n;
};

export const exportToPptx = async (project: Project, backgroundColor?: string, cornerRadius: number = 12) => {
  if (!project || !project.slides || project.slides.length === 0) return;
  
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  // Determine which slides to export and in what order
  let slidesToExport: any[] = [];
  
  if (project.outline && project.outline.length > 0) {
    // If there's an outline, follow its order and only take the linked slides
    // This ensures we only export the LATEST version for each outline item
    // and in the CORRECT order defined by the outline.
    project.outline.forEach(item => {
      if (item.slideId) {
        const slide = project.slides.find(s => s.id === item.slideId);
        if (slide) {
          slidesToExport.push(slide);
        }
      }
    });
  } 
  
  // Fallback: if no slides were found via outline or no outline exists
  if (slidesToExport.length === 0) {
    // Just use the slides array but reverse it because they are prepended in App.tsx
    slidesToExport = [...project.slides].reverse();
  }

  slidesToExport.forEach(slide => {
    if (!slide.elements || !Array.isArray(slide.elements)) return;
    
    const pptSlide = pptx.addSlide();
    
    // Set slide background color if provided
    if (backgroundColor && backgroundColor !== 'transparent') {
      pptSlide.background = { color: formatColor(backgroundColor) };
    }
    
    slide.elements.forEach(el => {
      const x = Math.min(100, Math.max(0, safeNumber(el.x)));
      const y = Math.min(100, Math.max(0, safeNumber(el.y)));
      const w = Math.min(100, Math.max(0.1, safeNumber(el.w)));
      const h = Math.min(100, Math.max(0.1, safeNumber(el.h)));

      if (el.type === 'text') {
        const transparency = el.style?.opacity !== undefined ? Math.round((1 - safeNumber(el.style.opacity, 1)) * 100) : 0;
        const color = formatColor(el.style?.color);
        const fill = el.style?.fill && el.style.fill !== 'transparent' 
          ? { color: formatColor(el.style.fill), transparency: transparency } 
          : undefined;
        
        const fontSizePt = Math.max(1, safeNumber(el.style?.fontSize, 18));
        
        const options: any = {
          x: `${x}%`,
          y: `${y}%`,
          w: `${w}%`,
          h: `${h}%`,
          fontSize: fontSizePt,
          color: color,
          fill: fill,
          bold: !!el.style?.bold,
          italic: !!el.style?.italic,
          align: el.style?.align || 'left',
          valign: el.style?.valign === 'middle' ? 'middle' : el.style?.valign === 'bottom' ? 'bottom' : 'top',
          fontFace: (el.style?.fontFamily || 'Arial').split(',')[0].replace(/['"]/g, ""),
          transparency: transparency,
          shadow: el.style?.shadow ? { type: 'outer', color: '000000', opacity: 0.2, blur: 4, offset: 2, angle: 45 } : undefined,
          autoFit: true,
          breakLine: true,
          margin: 5,
        };

        // Only apply shape properties if we are actually using a shape background for text
        if (fill && (safeNumber(el.style?.cornerRadius, cornerRadius)) > 0) {
          options.shape = pptx.ShapeType.roundRect;
          options.rectRadius = Math.min(1, Math.max(0, (safeNumber(el.style?.cornerRadius, cornerRadius)) / 540));
        }

        // Ensure content is a string and not empty
        const textContent = String(el.content || "").trim();
        if (textContent) {
          pptSlide.addText(textContent, options);
        }
      } else if (el.type === 'shape') {
        let shapeType: any = pptx.ShapeType.rect;
        let isRoundRect = false;

        if (el.shapeType === 'CIRCLE') shapeType = pptx.ShapeType.ellipse;
        else if (el.shapeType === 'TRIANGLE') shapeType = pptx.ShapeType.triangle;
        else if (el.shapeType === 'LINE') shapeType = pptx.ShapeType.line;
        else if ((safeNumber(el.style?.cornerRadius, cornerRadius)) > 0) {
          shapeType = pptx.ShapeType.roundRect;
          isRoundRect = true;
        }

        const transparency = el.style?.opacity !== undefined ? Math.round((1 - safeNumber(el.style.opacity, 1)) * 100) : 0;
        const fill = formatColor(el.style?.fill || "#CCCCCC");
        
        const shapeOptions: any = {
          x: `${x}%`,
          y: `${y}%`,
          w: `${w}%`,
          h: `${h}%`,
          fill: { color: fill, transparency: transparency },
          shadow: el.style?.shadow ? { type: 'outer', color: '000000', opacity: 0.2, blur: 4, offset: 2, angle: 45 } : undefined,
        };

        if (isRoundRect) {
          shapeOptions.rectRadius = Math.min(1, Math.max(0, (safeNumber(el.style?.cornerRadius, cornerRadius)) / 540));
        }

        pptSlide.addShape(shapeType, shapeOptions);
      }
 else if (el.type === 'image' && slide.images && el.imageIndex !== undefined && slide.images[el.imageIndex]) {
        try {
          const imageData = slide.images[el.imageIndex];
          if (!imageData || imageData.length < 50) return;

          // Ensure the data string is a clean base64 data URL
          let finalData = imageData.trim();
          
          // If it starts with data: but lacks ;base64,, it's malformed
          if (finalData.startsWith('data:') && !finalData.includes(';base64,')) {
             // Try to fix it if it's just missing the base64 part but has the mime type
             const parts = finalData.split(',');
             if (parts.length > 1) {
               finalData = `${parts[0]};base64,${parts[1]}`;
             }
          } else if (!finalData.startsWith('data:')) {
             // Assume it's raw base64 and add the header
             finalData = `data:image/png;base64,${finalData}`;
          }
          
          pptSlide.addImage({
            data: finalData,
            x: `${x}%`,
            y: `${y}%`,
            w: `${w}%`,
            h: `${h}%`,
          });
        } catch (imgErr) {
          console.error("Failed to add image to PPTX:", imgErr);
        }
      }
    });
  });

  const fileName = `${project.name.replace(/[/\\?%*:|"<>]/g, '-')}.pptx`;
  await pptx.writeFile({ fileName });
};

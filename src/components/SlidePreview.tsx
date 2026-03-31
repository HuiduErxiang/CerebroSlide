/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Slide } from "../types";

interface SlidePreviewProps {
  slide: Slide;
  shadowIntensity?: string;
  cornerRadius: number;
  backgroundColor?: string;
}

export const SlidePreview = ({ slide, shadowIntensity, cornerRadius, backgroundColor }: SlidePreviewProps) => {
  if (!slide || !slide.elements || !Array.isArray(slide.elements)) {
    return (
      <div className="relative w-full aspect-video bg-black/5 rounded-lg flex items-center justify-center border border-black/5">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold text-black/40">幻灯片无法预览</p>
          <p className="text-[10px] text-black/20">数据缺失或格式不正确，请尝试重新生成。</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full aspect-video shadow-2xl rounded-lg overflow-hidden border border-black/5"
      style={{ backgroundColor: backgroundColor || '#ffffff' }}
    >
      {slide.elements.map((el, idx) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${el.x}%`,
          top: `${el.y}%`,
          width: `${el.w}%`,
          height: `${el.h}%`,
          zIndex: idx,
        };

        if (el.type === 'text') {
          return (
            <div 
              key={idx} 
              style={{
                ...style,
                fontSize: `${(el.style?.fontSize || 16) * 1.333}px`,
                color: el.style?.color || '#000',
                fontWeight: el.style?.bold ? 'bold' : 'normal',
                fontStyle: el.style?.italic ? 'italic' : 'normal',
                textAlign: el.style?.align || 'left',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: el.style?.valign === 'middle' ? 'center' : el.style?.valign === 'bottom' ? 'flex-end' : 'flex-start',
                fontFamily: el.style?.fontFamily,
                padding: '2%',
                lineHeight: 1.4,
                overflow: 'hidden',
                wordBreak: 'break-word',
                backgroundColor: el.style?.fill || 'transparent',
                borderRadius: `${el.style?.cornerRadius ?? cornerRadius}px`,
                opacity: el.style?.opacity ?? 1,
                boxShadow: el.style?.shadow ? (
                  shadowIntensity === 'high' ? '0 20px 40px rgba(0,0,0,0.25)' :
                  shadowIntensity === 'medium' ? '0 12px 24px rgba(0,0,0,0.15)' : 
                  '0 4px 12px rgba(0,0,0,0.1)'
                ) : 'none',
              }}
            >
              {el.content}
            </div>
          );
        }

        if (el.type === 'shape') {
          return (
            <div 
              key={idx} 
              style={{
                ...style,
                backgroundColor: el.style?.fill || '#ccc',
                borderRadius: el.shapeType === 'CIRCLE' ? '50%' : `${el.style?.cornerRadius ?? cornerRadius}px`,
                opacity: el.style?.opacity ?? 1,
                boxShadow: el.style?.shadow ? (
                  shadowIntensity === 'high' ? '0 20px 40px rgba(0,0,0,0.25)' :
                  shadowIntensity === 'medium' ? '0 12px 24px rgba(0,0,0,0.15)' : 
                  '0 4px 12px rgba(0,0,0,0.1)'
                ) : 'none',
              }}
            />
          );
        }

        if (el.type === 'image' && slide.images && el.imageIndex !== undefined && slide.images[el.imageIndex]) {
          return (
            <img 
              key={idx} 
              src={slide.images[el.imageIndex]} 
              style={{ ...style, objectFit: 'cover' }} 
              referrerPolicy="no-referrer"
            />
          );
        }

        return null;
      })}
    </div>
  );
};

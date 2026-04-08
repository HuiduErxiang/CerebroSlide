/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useLayoutEffect } from "react";
import { Slide } from "../types";

interface SlidePreviewProps {
  slide: Slide;
  shadowIntensity?: string;
  cornerRadius: number;
  backgroundColor?: string;
}

interface AutoFitTextProps {
  content: string;
  baseFontSize: number;
  style: React.CSSProperties;
}

const AutoFitText = ({ content, baseFontSize, style }: AutoFitTextProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    let fontSize = baseFontSize;
    text.style.fontSize = `${fontSize}px`;

    while (text.scrollHeight > container.clientHeight && fontSize > 6) {
      fontSize -= 0.5;
      text.style.fontSize = `${fontSize}px`;
    }
  }, [content, baseFontSize]);

  return (
    <div ref={containerRef} style={{ ...style, overflow: 'hidden' }}>
      <span ref={textRef} style={{ fontSize: `${baseFontSize}px`, display: 'block', lineHeight: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {content}
      </span>
    </div>
  );
};

export const SlidePreview = ({ slide, shadowIntensity, cornerRadius, backgroundColor }: SlidePreviewProps) => {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const families = slide.elements
      .map(el => el.style?.fontFamily)
      .filter((f): f is string => !!f)
      .map(f => f.split(',')[0].trim().replace(/['"]/g, ''));
    const unique = [...new Set(families)];
    unique.forEach(family => {
      const id = `gf-${family.replace(/\s+/g, '-')}`;
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
        document.head.appendChild(link);
      }
    });
  }, [slide]);

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
        const baseStyle: React.CSSProperties = {
          position: 'absolute',
          left: `${el.x}%`,
          top: `${el.y}%`,
          width: `${el.w}%`,
          height: `${el.h}%`,
          boxSizing: 'border-box',
          zIndex: idx,
        };

        if (el.type === 'text') {
          const baseFontSize = (el.style?.fontSize || 16) * 1.333;
          const textContainerStyle: React.CSSProperties = {
            ...baseStyle,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: el.style?.valign === 'middle' ? 'center' : el.style?.valign === 'bottom' ? 'flex-end' : 'flex-start',
            padding: '1.5%',
            lineHeight: 1.4,
            color: el.style?.color,
            fontWeight: el.style?.bold ? 'bold' : 'normal',
            fontStyle: el.style?.italic ? 'italic' : 'normal',
            textAlign: el.style?.align || 'left',
            fontFamily: el.style?.fontFamily,
            backgroundColor: el.style?.fill || 'transparent',
            borderRadius: `${el.style?.cornerRadius ?? cornerRadius}px`,
            opacity: el.style?.opacity ?? 1,
            boxShadow: el.style?.shadow ? (
              shadowIntensity === 'high' ? '0 20px 40px rgba(0,0,0,0.25)' :
              shadowIntensity === 'medium' ? '0 12px 24px rgba(0,0,0,0.15)' :
              '0 4px 12px rgba(0,0,0,0.1)'
            ) : 'none',
          };
          return (
            <AutoFitText
              key={idx}
              content={el.content || ''}
              baseFontSize={baseFontSize}
              style={textContainerStyle}
            />
          );
        }

        if (el.type === 'shape') {
          return (
            <div
              key={idx}
              style={{
                ...baseStyle,
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
              style={{ ...baseStyle, objectFit: 'cover' }}
              referrerPolicy="no-referrer"
            />
          );
        }

        return null;
      })}
    </div>
  );
};

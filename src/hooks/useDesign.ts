import { useState, useMemo } from 'react';
import { Type } from '@google/genai';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { PresetStyle, Project, DesignConfig, UseDesignReturn } from '../types';

function parseJSON<T = Record<string, unknown>>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(cleaned) as T;
}
import { PRESET_STYLES, DEFAULT_COLORS, FONTS } from '../constants';
import { withRetry } from '../utils';
import { getSessionToken } from './useProjects';

async function callAI(
  req: { model?: string; contents: unknown; config?: Record<string, unknown> },
  userApiKey: string
): Promise<{ text: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = await getSessionToken(userApiKey);
    headers['x-session-token'] = token;
  } catch {
    headers['x-api-key'] = userApiKey;
  }

  const response = await fetch('/api/ai/generate-content', {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const errObj = (err as { error?: unknown }).error;
    const errMsg =
      typeof errObj === 'string'
        ? errObj
        : typeof errObj === 'object' && errObj !== null && 'message' in errObj
          ? String((errObj as { message: unknown }).message)
          : `AI request failed: ${response.status}`;
    throw new Error(errMsg);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text != null)?.text ?? '';
  return { text };
}

export function useDesign(
  userApiKey: string,
  syncData: (projects?: Project[], styles?: PresetStyle[]) => Promise<void>
): UseDesignReturn {
  const [customStyles, setCustomStyles] = useState<PresetStyle[]>([]);
  const [styleDescription, setStyleDescription] = useState('');
  const [styleRequirements, setStyleRequirements] = useState('');
  const [imageRequirements, setImageRequirements] = useState('');
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const [selectedFont, setSelectedFont] = useState(FONTS[0].family);
  const [templateImage, setTemplateImage] = useState<string | null>(null);
  const [styleGuideText, setStyleGuideText] = useState('');
  const [docColors, setDocColors] = useState<string[] | null>(null);
  const [cornerRadius, setCornerRadius] = useState(12);
  const [shadowIntensity, setShadowIntensity] = useState<'none' | 'subtle' | 'medium' | 'high'>('subtle');
  const [safeMargin, setSafeMargin] = useState(40);
  const [showPageNumber, setShowPageNumber] = useState(true);
  const [footerText, setFooterText] = useState('');
  const [titleFontSize, setTitleFontSize] = useState(48);
  const [subtitleFontSize, setSubtitleFontSize] = useState(28);
  const [bodyFontSize, setBodyFontSize] = useState(18);
  const [isAnalyzingTemplate, setIsAnalyzingTemplate] = useState(false);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');

  const allStyles = useMemo(() => [...PRESET_STYLES, ...customStyles], [customStyles]);

  const getDesignConfig = (): DesignConfig => ({
    colors,
    selectedFont,
    styleDescription,
    styleRequirements,
    imageRequirements,
    cornerRadius,
    shadowIntensity,
    safeMargin,
    showPageNumber,
    footerText,
    titleFontSize,
    subtitleFontSize,
    bodyFontSize,
    styleGuideText,
  });

  const saveCustomStyle = () => {
    if (!newStyleName.trim()) return;
    const newStyle: PresetStyle = {
      id: 'custom_' + Date.now(),
      name: newStyleName.trim(),
      style: styleDescription,
      requirements: styleRequirements,
      colors: [...colors],
      fontFamily: selectedFont,
      isCustom: true,
      referenceImage: templateImage || undefined,
      cornerRadius,
      shadowIntensity,
      safeMargin,
      showPageNumber,
      footerText,
      titleFontSize,
      subtitleFontSize,
      bodyFontSize,
      imageRequirements,
    };
    const updated = [...customStyles, newStyle];
    setCustomStyles(updated);
    syncData(undefined, updated);
    setNewStyleName('');
    setIsSavingStyle(false);
  };

  const deleteCustomStyle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customStyles.filter(s => s.id !== id);
    setCustomStyles(updated);
    syncData(undefined, updated);
  };

  const applyPreset = (preset: PresetStyle) => {
    setStyleDescription(preset.style);
    setStyleRequirements(preset.requirements);
    setColors(preset.colors);
    if (preset.fontFamily) setSelectedFont(preset.fontFamily);
    if (preset.referenceImage) setTemplateImage(preset.referenceImage);
    if (preset.imageRequirements) setImageRequirements(preset.imageRequirements);
    setCornerRadius(preset.cornerRadius ?? 12);
    setShadowIntensity(preset.shadowIntensity ?? 'subtle');
    setSafeMargin(preset.safeMargin ?? 40);
    setShowPageNumber(preset.showPageNumber ?? true);
    setFooterText(preset.footerText ?? '');
    setTitleFontSize(preset.titleFontSize ?? 48);
    setSubtitleFontSize(preset.subtitleFontSize ?? 28);
    setBodyFontSize(preset.bodyFontSize ?? 18);
  };

  const analyzeTemplateImage = async (base64: string) => {
    setIsAnalyzingTemplate(true);
    try {
      const response = await withRetry(() =>
        callAI({
          model: 'gemini-3.1-flash-lite-preview',
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/png', data: base64.split(',')[1] } },
              {
                text: `分析这张幻灯片模板图并提取其设计风格。
            请重点提取整体风格样式（例如：杂志风、动漫风、极简科技风、孟菲斯风格等）。
            
            返回一个 JSON 对象，包含以下字段（所有内容必须使用中文）：
            - styleDescription: 整体风格样式的简短描述（使用中文，例如"高端杂志排版风格"）。
            - styleRequirements: 具体的视觉规则描述（使用中文，例如"大圆角、柔和阴影、网格背景、非对称布局"）。
            - imageRequirements: 背景图及贴图的具体要求（使用中文，例如"使用抽象渐变作为背景，贴图采用 3D 拟物风格"）。
            - colors: 包含 4 个十六进制颜色值的数组（严格遵守此顺序：1.背景色, 2.主色/强调色, 3.辅助色/线框色, 4.文字色）。注意：文字色必须与背景色有极高对比度。
            - suggestedFont: 与此风格匹配的常用 Web 字体名称。
            - cornerRadius: 建议的圆角大小（0 到 40 之间的整数）。
            - shadowIntensity: 建议的阴影强度（"none", "subtle", 或 "medium"）。
            - safeMargin: 建议的安全边距（0 到 100 之间的整数）。
            - titleFontSize: 建议的标题字号（36 到 72 之间的整数）。
            - subtitleFontSize: 建议的副标题字号（20 到 36 之间的整数）。
            - bodyFontSize: 建议的正文字号（12 到 24 之间的整数）。
            `,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                styleDescription: { type: Type.STRING },
                styleRequirements: { type: Type.STRING },
                imageRequirements: { type: Type.STRING },
                colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestedFont: { type: Type.STRING },
                cornerRadius: { type: Type.NUMBER },
                shadowIntensity: { type: Type.STRING },
                safeMargin: { type: Type.NUMBER },
                titleFontSize: { type: Type.NUMBER },
                subtitleFontSize: { type: Type.NUMBER },
                bodyFontSize: { type: Type.NUMBER },
              },
              required: ['styleDescription', 'styleRequirements', 'imageRequirements', 'colors'],
            },
          },
        }, userApiKey)
      );

      const result = parseJSON<{
        styleDescription?: string;
        styleRequirements?: string;
        imageRequirements?: string;
        colors?: string[];
        suggestedFont?: string;
        cornerRadius?: number;
        shadowIntensity?: string;
        safeMargin?: number;
        titleFontSize?: number;
        subtitleFontSize?: number;
        bodyFontSize?: number;
      }>(response.text || '{}');

      if (result.styleDescription) {
        setStyleDescription(prev => {
          if (!prev) return result.styleDescription;
          if (prev.includes(result.styleDescription)) return prev;
          return `${prev} | ${result.styleDescription}`;
        });
      }
      if (result.styleRequirements) {
        setStyleRequirements(prev => {
          if (!prev) return result.styleRequirements;
          if (prev.includes(result.styleRequirements)) return prev;
          return `${prev} | ${result.styleRequirements}`;
        });
      }
      if (result.imageRequirements) {
        setImageRequirements(prev => {
          if (!prev) return result.imageRequirements;
          if (prev.includes(result.imageRequirements)) return prev;
          return `${prev} | ${result.imageRequirements}`;
        });
      }
      if (result.colors && Array.isArray(result.colors)) setColors(result.colors.slice(0, 4));
      if (result.cornerRadius !== undefined) setCornerRadius(result.cornerRadius);
      if (result.shadowIntensity) setShadowIntensity(result.shadowIntensity as 'none' | 'subtle' | 'medium' | 'high');
      if (result.safeMargin !== undefined) setSafeMargin(result.safeMargin);
      if (result.titleFontSize !== undefined) setTitleFontSize(result.titleFontSize);
      if (result.subtitleFontSize !== undefined) setSubtitleFontSize(result.subtitleFontSize);
      if (result.bodyFontSize !== undefined) setBodyFontSize(result.bodyFontSize);
      if (result.suggestedFont) {
        const matched = FONTS.find(f =>
          result.suggestedFont.toLowerCase().includes(f.name.toLowerCase())
        );
        if (matched) setSelectedFont(matched.family);
      }
    } catch (err) {
      console.error('Failed to analyze template:', err);
      throw err;
    } finally {
      setIsAnalyzingTemplate(false);
    }
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setTemplateImage(base64);
      analyzeTemplateImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleStyleGuideUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingDoc(true);
    try {
      let text = '';
      if (
        file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          fullText += strings.join(' ') + '\n';
        }
        text = fullText;
      } else {
        text = await file.text();
      }

      setStyleGuideText(text);

      const ai_response = await callAI({
        model: 'gemini-3.1-flash-lite-preview',
        contents: `分析这份风格简述文档并提取关键设计信息。
        重点关注：
        1. 整体风格（例如：极简、科技、专业）
        2. 具体样式要求（例如：玻璃拟态、圆角、特定间距）
        3. 背景及贴图要求（例如：抽象背景、写实照片、特定插画风格）
        4. 配色方案（提取文档中提到的主色、背景色、文字色等）
        
        请务必使用中文返回结果。
        返回结果必须为 JSON 格式。
        
        文档内容：
        ${text.substring(0, 5000)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              styleDescription: { type: Type.STRING },
              styleRequirements: { type: Type.STRING },
              imageRequirements: { type: Type.STRING },
              colors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '包含 4 个十六进制颜色值的数组：1.背景色, 2.主色, 3.辅助色, 4.文字色',
              },
            },
            required: ['styleDescription', 'styleRequirements', 'imageRequirements'],
          },
        },
      }, userApiKey);

      const result = parseJSON<{
        styleDescription?: string;
        styleRequirements?: string;
        imageRequirements?: string;
        colors?: string[];
      }>(ai_response.text || '{}');
      if (result.styleDescription) {
        setStyleDescription(prev => {
          if (!prev) return result.styleDescription;
          if (prev.includes(result.styleDescription)) return prev;
          return `${prev} | ${result.styleDescription}`;
        });
      }
      if (result.styleRequirements) {
        setStyleRequirements(prev => {
          if (!prev) return result.styleRequirements;
          if (prev.includes(result.styleRequirements)) return prev;
          return `${prev} | ${result.styleRequirements}`;
        });
      }
      if (result.imageRequirements) {
        setImageRequirements(prev => {
          if (!prev) return result.imageRequirements;
          if (prev.includes(result.imageRequirements)) return prev;
          return `${prev} | ${result.imageRequirements}`;
        });
      }
      if (result.colors && Array.isArray(result.colors) && result.colors.length >= 4) {
        setDocColors(result.colors.slice(0, 4));
        if (!templateImage) {
          setColors(result.colors.slice(0, 4));
        }
      }
    } catch (err) {
      console.error('Style guide upload failed:', err);
      throw err;
    } finally {
      setIsAnalyzingDoc(false);
    }
  };

  return {
    customStyles,
    setCustomStyles,
    allStyles,
    colors,
    setColors,
    selectedFont,
    setSelectedFont,
    styleDescription,
    setStyleDescription,
    styleRequirements,
    setStyleRequirements,
    imageRequirements,
    setImageRequirements,
    templateImage,
    setTemplateImage,
    styleGuideText,
    setStyleGuideText,
    docColors,
    cornerRadius,
    setCornerRadius,
    shadowIntensity,
    setShadowIntensity,
    safeMargin,
    setSafeMargin,
    showPageNumber,
    setShowPageNumber,
    footerText,
    setFooterText,
    titleFontSize,
    setTitleFontSize,
    subtitleFontSize,
    setSubtitleFontSize,
    bodyFontSize,
    setBodyFontSize,
    isAnalyzingTemplate,
    isAnalyzingDoc,
    isSavingStyle,
    setIsSavingStyle,
    newStyleName,
    setNewStyleName,
    saveCustomStyle,
    deleteCustomStyle,
    applyPreset,
    analyzeTemplateImage,
    handleTemplateUpload,
    handleStyleGuideUpload,
    getDesignConfig,
  };
}

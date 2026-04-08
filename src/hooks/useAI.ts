import { useState, useRef } from 'react';
import { Type, ThinkingLevel } from '@google/genai';
import * as mammoth from 'mammoth';
import { getSessionToken } from './useProjects';
import {
  OutlineItem,
  Slide,
  SlideElement,
  Project,
  PresetStyle,
  ScenarioId,
  UseAIReturn,
  DesignConfig,
} from '../types';
import { LAYOUT_PRESETS, SYSTEM_INSTRUCTION, SCRIPT_SYSTEM_INSTRUCTION, SCENARIOS } from '../constants';
import { withRetry, resizeImage, detectAndFixOverlaps } from '../utils';

interface GeminiRequest {
  model?: string;
  contents: unknown;
  config?: {
    systemInstruction?: unknown;
    responseMimeType?: string;
    responseSchema?: unknown;
    maxOutputTokens?: number;
    temperature?: number;
    thinkingConfig?: { thinkingLevel?: string };
    imageConfig?: { aspectRatio?: string };
    responseModalities?: string[];
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>;
    };
  }>;
  text?: string;
}

async function callAI(req: GeminiRequest, userApiKey: string): Promise<GeminiResponse> {
  const { model, contents, config } = req;
  const body: Record<string, unknown> = { model, contents };
  if (config) body.config = config;

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
    body: JSON.stringify(body),
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

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.find(p => p.text != null)?.text ?? '';
  return { ...data, text };
}

export function useAI(
  userApiKey: string,
  selectedModel: string,
  designConfig: DesignConfig,
  activeProject: Project | null,
  syncData: (projects?: Project[], styles?: PresetStyle[]) => Promise<void>,
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
  showToast: (message: string, type: 'error' | 'success' | 'info') => void
): UseAIReturn {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState('split-left');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [remixingSlideId, setRemixingSlideId] = useState<string | null>(null);
  const [imageGenProgress, setImageGenProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [visualizingItemId, setVisualizingItemId] = useState<string | null>(null);
  const [isScriptMode, setIsScriptMode] = useState(false);
  const [scriptInput, setScriptInput] = useState('');
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>('general');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isSuggestingLayouts, setIsSuggestingLayouts] = useState(false);
  const [layoutSelectionItem, setLayoutSelectionItem] = useState<OutlineItem | null>(null);
  const [layoutSuggestions, setLayoutSuggestions] = useState<{ id: string; reason: string }[]>([]);
  const [scriptFiles, setScriptFiles] = useState<{ name: string; content: string }[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const clearInputs = () => {
    setInputText('');
    setAudioBlob(null);
    setSelectedImage(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        showToast('正在识别语音...', 'info');
        setTimeout(() => {
          showToast('语音识别成功', 'success');
        }, 1500);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      showToast('无法访问麦克风', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const _buildSystemInstruction = (item?: OutlineItem, overrideStyle?: string) => {
    const {
      styleDescription,
      styleRequirements,
      colors,
      selectedFont,
      cornerRadius,
      shadowIntensity,
      safeMargin,
      showPageNumber,
      footerText,
      titleFontSize,
      subtitleFontSize,
      bodyFontSize,
      styleGuideText,
      imageRequirements,
    } = designConfig;

    const context =
      activeProject?.slides.map((s, i) => `Slide ${i + 1}: ${s.title} - ${s.description}`).join('\n') || '';

    return SYSTEM_INSTRUCTION(
      overrideStyle ?? styleDescription,
      styleRequirements,
      colors,
      selectedFont,
      context,
      { cornerRadius, shadowIntensity, safeMargin, showPageNumber, footerText, titleFontSize, subtitleFontSize, bodyFontSize },
      styleGuideText,
      imageRequirements,
      item?.pageStyle,
      item?.decorativeIcon,
      item?.keyData,
      item?.quotes,
      item?.highlights,
      item?.suggestedLayout,
      selectedScenarioId
    );
  };

  const _slideResponseSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      elements: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['text', 'shape', 'image'] },
            x: { type: Type.NUMBER },
            y: { type: Type.NUMBER },
            w: { type: Type.NUMBER },
            h: { type: Type.NUMBER },
            content: { type: Type.STRING },
            shapeType: { type: Type.STRING, enum: ['RECTANGLE', 'CIRCLE', 'TRIANGLE', 'LINE'] },
            imageIndex: { type: Type.NUMBER },
            style: {
              type: Type.OBJECT,
              properties: {
                fontSize: { type: Type.NUMBER },
                color: { type: Type.STRING },
                fill: { type: Type.STRING },
                bold: { type: Type.BOOLEAN },
                italic: { type: Type.BOOLEAN },
                align: { type: Type.STRING, enum: ['left', 'center', 'right'] },
                valign: { type: Type.STRING, enum: ['top', 'middle', 'bottom'] },
                fontFamily: { type: Type.STRING },
                opacity: { type: Type.NUMBER },
                shadow: { type: Type.BOOLEAN },
                cornerRadius: { type: Type.NUMBER },
              },
              required: ['color', 'fontFamily'],
            },
          },
          required: ['type', 'x', 'y', 'w', 'h'],
        },
      },
      imagePrompts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING },
            aspectRatio: { type: Type.STRING },
          },
          required: ['prompt', 'aspectRatio'],
        },
      },
    },
    required: ['title', 'description', 'elements'],
  };

  const _generateImages = async (
    imagePrompts: { prompt: string; aspectRatio: string }[],
    styleDescription: string,
    styleRequirements: string
  ): Promise<string[]> => {
    setIsGeneratingImages(true);
    setImageGenProgress({ current: 0, total: imagePrompts.length });
    const generatedImages: string[] = [];
    try {
      for (let i = 0; i < imagePrompts.length; i++) {
        setImageGenProgress(prev => ({ ...prev, current: i + 1 }));
        const imageReq = imagePrompts[i];
        const imgParts: unknown[] = [
          {
            text: `Create a professional presentation asset for: ${imageReq.prompt}. 
              VISUAL STYLE: ${styleDescription}. 
              TECHNICAL REQUIREMENTS: ${styleRequirements}. 
              High resolution, sharp details, 4K, professional quality. 
              Optimized for presentations, clean, high contrast, balanced composition.`,
          },
        ];
        let imgResponse: GeminiResponse;
        try {
          imgResponse = await withRetry(() =>
            callAI({
              model: 'gemini-2.5-flash-image',
              contents: { parts: imgParts },
              config: {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: { aspectRatio: imageReq.aspectRatio || '16:9' },
              },
            }, userApiKey)
          );
        } catch (err: unknown) {
          const e = err as { message?: string; status?: number };
          if (e.message?.includes('403') || e.status === 403) {
            showToast('图片生成失败：您的 API Key 可能没有绘图权限或额度不足 (403)', 'error');
          }
          throw err;
        }
        const part = imgResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part?.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          let base64Data = `data:${mimeType};base64,${part.inlineData.data}`;
          base64Data = await resizeImage(base64Data, 1280, 1280);
          generatedImages.push(base64Data);
        }
      }
    } catch (imgErr) {
      console.error('Image generation failed:', imgErr);
      const msg = (imgErr as { message?: string }).message || '图片生成失败';
      showToast(msg, 'error');
    } finally {
      setIsGeneratingImages(false);
    }
    return generatedImages;
  };

  const generateSlide = async (item?: OutlineItem) => {
    if (!activeProject) {
      setError('请先创建一个项目。');
      return;
    }
    if (!item && !inputText && !audioBlob && !selectedImage) {
      setError('请输入内容描述。');
      return;
    }

    setIsGenerating(true);
    if (item) setVisualizingItemId(item.id);
    setError(null);

    try {
      const parts: unknown[] = [];

      if (item) {
        parts.push({
          text: `ORIGINAL SOURCE TEXT (CONTEXT):\n        ${activeProject.sourceText || activeProject.script || 'Not available'}\n\nGenerate a slide based on this outline item:\nTitle: ${item.title}\nSubtitle: ${item.subtitle}\nBody (FINAL COPY - USE VERBATIM, DO NOT PARAPHRASE OR EXPAND): ${item.body}\nSuggested Layout: ${item.suggestedLayout} (${item.layoutDescription})\n\nCRITICAL: The body text elements in the slide MUST display EXACTLY the content from the Body field above. Do NOT add, remove, or rephrase any body copy. Only the title and subtitle may be lightly styled.`,
        });
      } else {
        if (inputText) parts.push({ text: `User input: ${inputText}` });
        if (selectedLayoutId) {
          const layout = LAYOUT_PRESETS.find(l => l.id === selectedLayoutId);
          if (layout) parts.push({ text: `Preferred Layout: ${layout.name} (${layout.description})` });
        }
      }

      const response = await withRetry(() =>
        callAI({
          model: selectedModel,
          contents: { parts },
          config: {
            systemInstruction: _buildSystemInstruction(item),
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseSchema: _slideResponseSchema,
          },
        }, userApiKey)
      );

      const result = JSON.parse(response.text || '{}');
      let slideElements: SlideElement[] = detectAndFixOverlaps(result.elements || []);

      if (
        result.imagePrompts?.length > 0 &&
        !slideElements.some(el => el.type === 'image' && el.x === 0 && el.y === 0 && el.w === 100 && el.h === 100)
      ) {
        slideElements.unshift({ type: 'image', x: 0, y: 0, w: 100, h: 100, imageIndex: 0 });
      }

      let generatedImages: string[] = [];
      if (result.imagePrompts && result.imagePrompts.length > 0) {
        generatedImages = await _generateImages(
          result.imagePrompts,
          designConfig.styleDescription,
          designConfig.styleRequirements
        );
      }

      const newSlide: Slide = {
        id: Date.now().toString(),
        elements: slideElements,
        title: result.title,
        description: result.description,
        timestamp: Date.now(),
        images: generatedImages.length > 0 ? generatedImages : undefined,
        pageStyle: item?.pageStyle,
        keyData: item?.keyData,
        quotes: item?.quotes,
        highlights: item?.highlights,
      };

      setProjects(prev => {
        const updated = prev.map(p => {
          if (p.id !== activeProject.id) return p;
          if (item) {
            const newOutline = p.outline?.map(o =>
              o.id === item.id ? { ...o, isGenerated: true, slideId: newSlide.id } : o
            );
            return { ...p, outline: newOutline, slides: [newSlide, ...p.slides] };
          }
          return { ...p, slides: [newSlide, ...p.slides] };
        });
        syncData(updated);
        return updated;
      });

      clearInputs();
      showToast('幻灯片生成成功！', 'success');
    } catch (err: unknown) {
      const e = err as { message?: string };
      const msg =
        e.message?.includes('xhr') || e.message?.includes('Rpc failed')
          ? '网络连接波动，请稍后重试。'
          : e.message || '生成失败，请重试。';
      showToast(msg, 'error');
      setError(msg);
    } finally {
      setIsGenerating(false);
      setVisualizingItemId(null);
    }
  };

  const generateOutline = async () => {
    const combinedContent = [
      scriptInput,
      ...scriptFiles.map(f => `File: ${f.name}\nContent: ${f.content}`),
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');

    if (!combinedContent.trim() || !activeProject) return;

    setIsGeneratingOutline(true);
    setError(null);
    try {
      const scenario = SCENARIOS.find(s => s.id === selectedScenarioId) || SCENARIOS[0];
      const response = await withRetry(() =>
        callAI({
          model: selectedModel,
          contents: `Input content to transform into a slide outline:
        ${combinedContent}
        
        Additional User Requirements/Prompt:
        ${additionalPrompt || 'None'}`,
          config: {
            systemInstruction: SCRIPT_SYSTEM_INSTRUCTION(scenario),
            maxOutputTokens: 8192,
            temperature: 0.4,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }, userApiKey)
      );

      const rawText = response.text || '';
      const slides: OutlineItem[] = [];
      const slideBlocks = rawText.split(/\[SLIDE\]/i).filter(b => b.trim().length > 0);

      for (const block of slideBlocks) {
        const cleanBlock = block.split(/\[END_SLIDE\]/i)[0].trim();
        const lines = cleanBlock.split('\n');

        const item: Partial<OutlineItem> = {
          isGenerated: false,
          isRefining: false,
          isRefined: false,
          keyData: [],
          quotes: [],
          highlights: [],
        };

        lines.forEach(line => {
          const trimmedLine = line.trim();
          const lowerLine = trimmedLine.toLowerCase();
          if (lowerLine.startsWith('id:')) item.id = trimmedLine.replace(/^ID:/i, '').trim();
          else if (lowerLine.startsWith('title:')) item.title = trimmedLine.replace(/^TITLE:/i, '').trim();
          else if (lowerLine.startsWith('subtitle:')) item.subtitle = trimmedLine.replace(/^SUBTITLE:/i, '').trim();
          else if (lowerLine.startsWith('body:')) item.body = trimmedLine.replace(/^BODY:/i, '').trim();
          else if (lowerLine.startsWith('layout:')) item.suggestedLayout = trimmedLine.replace(/^LAYOUT:/i, '').trim();
          else if (lowerLine.startsWith('layout_desc:')) item.layoutDescription = trimmedLine.replace(/^LAYOUT_DESC:/i, '').trim();
          else if (lowerLine.startsWith('data:')) {
            const dataStr = trimmedLine.replace(/^DATA:/i, '').trim();
            if (dataStr) {
              const parts = dataStr.split(',');
              item.keyData = parts
                .map(p => {
                  const [label, value, unit] = p.split('|').map(s => s.trim());
                  return { label: label || '', value: value || '', unit: unit || '' };
                })
                .filter(d => d.label || d.value);
            }
          } else if (lowerLine.startsWith('quote:')) {
            const quoteStr = trimmedLine.replace(/^QUOTE:/i, '').trim();
            if (quoteStr) {
              const [text, author] = quoteStr.split('|').map(s => s.trim());
              if (text) item.quotes = [{ text, author: author || '' }];
            }
          } else if (lowerLine.startsWith('highlights:')) {
            const highStr = trimmedLine.replace(/^HIGHLIGHTS:/i, '').trim();
            if (highStr) {
              item.highlights = highStr
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0);
            }
          }
        });

        if (item.title) {
          item.metaDescription = item.body;
          slides.push(item as OutlineItem);
        }
      }

      if (slides.length === 0) {
        throw new Error('未能从AI返回的内容中解析出大纲，请重试。');
      }

      setProjects(prev => {
        const updated = prev.map(p =>
          p.id === activeProject.id
            ? { ...p, scenarioId: selectedScenarioId, script: scriptInput, sourceText: scriptInput, outline: slides }
            : p
        );
        syncData(updated);
        return updated;
      });
      showToast('大纲已生成，请审阅并点击"精炼内容"', 'success');
    } catch (err: unknown) {
      console.error('Outline generation failed:', err);
      const msg = (err as { message?: string }).message || '生成大纲失败，请重试';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const refineOutlineItem = async (itemId: string) => {
    if (!activeProject || !activeProject.outline) return;
    const item = activeProject.outline.find(o => o.id === itemId);
    if (!item) return;

    setProjects(prev =>
      prev.map(p =>
        p.id === activeProject.id
          ? { ...p, outline: p.outline?.map(o => (o.id === itemId ? { ...o, isRefining: true } : o)) }
          : p
      )
    );

    try {
      const scenario = SCENARIOS.find(s => s.id === activeProject.scenarioId) || SCENARIOS[0];
      const response = await withRetry(() =>
        callAI({
          model: selectedModel,
          contents: `You are a PPT content refiner specializing in ${scenario.name} style. Based on the following slide meta-description AND the original source text, generate the FINAL text content and a specific STYLE description for this slide.
        
        TONE OF VOICE: ${scenario.tone}
        CONTENT LOGIC: ${scenario.logic}

        ORIGINAL SOURCE TEXT (CONTEXT):
        ${activeProject.sourceText || activeProject.script || 'Not available'}

        GLOBAL PPT STYLE: ${designConfig.styleDescription}
        GLOBAL STYLE REQUIREMENTS: ${designConfig.styleRequirements}
        
        SLIDE META-DESCRIPTION:
        Title: ${item.title}
        Subtitle: ${item.subtitle}
        Suggested Layout: ${item.suggestedLayout}
        Creative Blueprint: ${item.metaDescription || item.body}
        
        TASK:
        1. Use the ORIGINAL SOURCE TEXT to enrich the content.
        2. Extract visual, image, and layout cues from the Creative Blueprint and merge them with the Global Style to create a "pageStyle" description.
        3. Generate the "realBody" content. Decide the FORMAT based on layout and scenario — do NOT default to bullet lists:

        FORMAT BY LAYOUT:
        - center-hero / quote / expert-quote: 1 tagline or punchy sentence, ≤20 chars, no bullets, no sections.
        - full-image: at most 1 immersive sentence, can be empty.
        - split-left / split-right / top-bottom: single section, 2–4 bullets with "•" prefix, each ≤15 words.
        - grid-3 / grid-2 / bento-grid: split into sections matching number of grid cells. Each section: optional bold heading (≤6 words, use **heading** markdown) + 1–2 sentences. Separate sections with a blank line.
        - feature-list / timeline-flow: numbered sections, each with a bold heading (≤6 words) + 1 sentence description.
        - data-focus: 1–2 background sentences, let keyData carry the main content.

        FORMAT BY SCENARIO:
        - general: clear and structured.
        - academic: precise terminology, objective tone, complete sentences allowed.
        - business: action-oriented verbs, result-focused, punchy.
        - creative: expressive, emotional, metaphors allowed, free format.
        - ted: single powerful core-idea sentence, maximum impact.

        HARD LIMIT: total realBody (including headings) ≤ 80 characters. Be ruthlessly concise.
        4. Refine the granular data using the source text for accuracy.
        5. Select a single contextually relevant emoji as a "decorativeIcon".
        
        Return a JSON object:
        {
          "realBody": "...",
          "pageStyle": "...",
          "decorativeIcon": "...",
          "keyData": [...],
          "quotes": [...],
          "highlights": [...]
        }
        
        Keep the language the same as the input.`,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.4,
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                realBody: { type: Type.STRING },
                pageStyle: { type: Type.STRING },
                decorativeIcon: { type: Type.STRING },
                keyData: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      value: { type: Type.STRING },
                      unit: { type: Type.STRING },
                    },
                  },
                },
                quotes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { text: { type: Type.STRING }, author: { type: Type.STRING } },
                  },
                },
                highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['realBody', 'pageStyle', 'decorativeIcon'],
            },
          },
        }, userApiKey)
      );

      let rawText = response.text || '';
      if (rawText.length > 20000) {
        const lastBrace = rawText.lastIndexOf('}');
        if (lastBrace !== -1) rawText = rawText.substring(0, lastBrace + 1);
      }

      const result = JSON.parse(rawText);

      setProjects(prev => {
        const updated = prev.map(p => {
          if (p.id !== activeProject.id) return p;
          const newOutline = p.outline?.map(o =>
            o.id === itemId
              ? {
                  ...o,
                  body: result.realBody,
                  pageStyle: result.pageStyle,
                  decorativeIcon: result.decorativeIcon,
                  keyData: result.keyData || o.keyData,
                  quotes: result.quotes || o.quotes,
                  highlights: result.highlights || o.highlights,
                  isRefining: false,
                  isRefined: true,
                }
              : o
          );
          return { ...p, outline: newOutline };
        });
        syncData(updated);
        return updated;
      });
      showToast('内容精炼完成', 'success');
    } catch (err) {
      console.error('Refinement failed:', err);
      showToast('精炼内容失败', 'error');
      setProjects(prev =>
        prev.map(p =>
          p.id === activeProject.id
            ? { ...p, outline: p.outline?.map(o => (o.id === itemId ? { ...o, isRefining: false } : o)) }
            : p
        )
      );
    }
  };

  const refineAllOutlineItems = async () => {
    if (!activeProject || !activeProject.outline) return;
    const unrefined = activeProject.outline.filter(o => !o.pageStyle);
    if (unrefined.length === 0) {
      showToast('所有内容已精炼', 'info');
      return;
    }
    showToast(`开始精炼 ${unrefined.length} 页内容...`, 'info');
    for (const item of unrefined) {
      await refineOutlineItem(item.id);
    }
    showToast('全案内容精炼完成', 'success');
  };

  const suggestLayouts = async (item: OutlineItem) => {
    if (!item || isSuggestingLayouts) return;
    setIsSuggestingLayouts(true);
    setLayoutSelectionItem(item);
    setLayoutSuggestions([]);

    try {
      const prompt = `You are a presentation design expert. Analyze the following slide content and suggest 6 different layouts from the available list.
      
CONTENT:
Title: ${item.title}
Subtitle: ${item.subtitle}
Body: ${item.body}

AVAILABLE LAYOUTS:
${LAYOUT_PRESETS.map(l => `- ${l.id}: ${l.name} (${l.description})`).join('\n')}

For each suggestion, provide the layout ID and a brief reasoning (in the same language as the content) why it fits this specific content.

Output MUST be a JSON array of objects:
[
  { "id": "layout-id", "reason": "reasoning..." },
  ...
]`;

      const response = await callAI({
        model: selectedModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }, userApiKey);

      const suggestions = JSON.parse(response.text || '[]');
      setLayoutSuggestions(suggestions);
    } catch (err) {
      console.error('Layout suggestion failed:', err);
      showToast('获取布局建议失败，请重试', 'error');
    } finally {
      setIsSuggestingLayouts(false);
    }
  };

  const remixSlide = async (slide: Slide) => {
    if (!activeProject || !slide || !slide.elements) return;
    setRemixingSlideId(slide.id);
    setError(null);
    try {
      const context = activeProject.slides
        .filter(s => s.id !== slide.id)
        .map((s, i) => `Slide ${i + 1}: ${s.title}`)
        .join('\n');

      const parts: unknown[] = [
        {
          text: `Remix the layout for this slide. KEEP the content, but CHANGE the visual arrangement significantly.
        Title: ${slide.title}
        Description: ${slide.description}
        Current Elements Count: ${slide.elements.length}
        
        Instruction: Provide a completely different layout (e.g., if it was left-right, make it top-bottom or grid).`,
        },
      ];

      const remixSystemInstruction = (() => {
        const {
          styleDescription,
          styleRequirements,
          colors,
          selectedFont,
          cornerRadius,
          shadowIntensity,
          safeMargin,
          showPageNumber,
          footerText,
          titleFontSize,
          subtitleFontSize,
          bodyFontSize,
          styleGuideText,
          imageRequirements,
        } = designConfig;
        const decorativeIcon = activeProject.outline?.find(o => o.slideId === slide.id)?.decorativeIcon;
        return SYSTEM_INSTRUCTION(
          styleDescription,
          styleRequirements,
          colors,
          selectedFont,
          context,
          { cornerRadius, shadowIntensity, safeMargin, showPageNumber, footerText, titleFontSize, subtitleFontSize, bodyFontSize },
          styleGuideText,
          imageRequirements,
          slide.pageStyle,
          decorativeIcon,
          undefined,
          undefined,
          undefined,
          undefined,
          selectedScenarioId
        );
      })();

      const slideResponse = await withRetry(() =>
        callAI({
          model: selectedModel,
          contents: { parts },
          config: {
            systemInstruction: remixSystemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                elements: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, enum: ['text', 'shape', 'image'] },
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      w: { type: Type.NUMBER },
                      h: { type: Type.NUMBER },
                      content: { type: Type.STRING },
                      shapeType: { type: Type.STRING, enum: ['RECTANGLE', 'CIRCLE', 'TRIANGLE', 'LINE'] },
                      imageIndex: { type: Type.NUMBER },
                      style: {
                        type: Type.OBJECT,
                        properties: {
                          fontSize: { type: Type.NUMBER },
                          color: { type: Type.STRING },
                          fill: { type: Type.STRING },
                          bold: { type: Type.BOOLEAN },
                          italic: { type: Type.BOOLEAN },
                          align: { type: Type.STRING, enum: ['left', 'center', 'right'] },
                          valign: { type: Type.STRING, enum: ['top', 'middle', 'bottom'] },
                          fontFamily: { type: Type.STRING },
                          opacity: { type: Type.NUMBER },
                          shadow: { type: Type.BOOLEAN },
                          cornerRadius: { type: Type.NUMBER },
                        },
                        required: ['color', 'fontFamily'],
                      },
                    },
                    required: ['type', 'x', 'y', 'w', 'h'],
                  },
                },
              },
              required: ['elements'],
            },
          },
        }, userApiKey)
      );

      const slideData = JSON.parse(slideResponse.text ?? '{}');
      let slideElements: SlideElement[] = detectAndFixOverlaps(slideData.elements || []);

      if (
        slide.images &&
        slide.images.length > 0 &&
        !slideElements.some(el => el.type === 'image' && el.x === 0 && el.y === 0 && el.w === 100 && el.h === 100)
      ) {
        slideElements.unshift({ type: 'image', x: 0, y: 0, w: 100, h: 100, imageIndex: 0 });
      }

      setProjects(prev => {
        const updated = prev.map(p => {
          if (p.id === activeProject.id) {
            return { ...p, slides: p.slides.map(s => (s.id === slide.id ? { ...s, elements: slideElements } : s)) };
          }
          return p;
        });
        syncData(updated);
        return updated;
      });
      showToast('布局已重混', 'success');
    } catch (err: unknown) {
      console.error('Slide remix failed:', err);
      setError('重混布局失败，请重试');
    } finally {
      setRemixingSlideId(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setSelectedImage(base64);
        showToast('正在分析参考图布局...', 'info');
        const response = await callAI({
          model: 'gemini-3.1-flash-lite-preview',
          contents: {
            parts: [
              {
                text: "Analyze this PPT slide image and describe its layout structure in one sentence. Also, suggest which of these layout types it most closely resembles: 'split-left', 'split-right', 'center-hero', 'grid-3', 'top-bottom', 'full-image'.",
              },
              { inlineData: { mimeType: file.type, data: base64.split(',')[1] } },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                layoutType: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['layoutType', 'description'],
            },
          },
        }, userApiKey);
        const result = JSON.parse(response.text ?? '{}');
        if (result.layoutType) {
          setSelectedLayoutId(result.layoutType);
          showToast(`已识别布局: ${result.description}`, 'success');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Image upload failed:', err);
      showToast('图片上传或分析失败', 'error');
    }
  };

  const handleScriptFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: { name: string; content: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let content = '';
        if (file.name.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value;
        } else {
          content = await file.text();
        }
        newFiles.push({ name: file.name, content });
      } catch (err) {
        console.error(`Failed to read file ${file.name}:`, err);
        showToast(`读取文件 ${file.name} 失败`, 'error');
      }
    }
    setScriptFiles(prev => [...prev, ...newFiles]);
  };

  const removeScriptFile = (index: number) => {
    setScriptFiles(prev => prev.filter((_, i) => i !== index));
  };

  return {
    inputText,
    setInputText,
    isRecording,
    audioBlob,
    selectedLayoutId,
    setSelectedLayoutId,
    selectedImage,
    setSelectedImage,
    isGenerating,
    isGeneratingImages,
    remixingSlideId,
    imageGenProgress,
    error,
    visualizingItemId,
    isScriptMode,
    setIsScriptMode,
    scriptInput,
    setScriptInput,
    selectedScenarioId,
    setSelectedScenarioId,
    additionalPrompt,
    setAdditionalPrompt,
    isGeneratingOutline,
    isSuggestingLayouts,
    layoutSelectionItem,
    setLayoutSelectionItem,
    layoutSuggestions,
    scriptFiles,
    startRecording,
    stopRecording,
    generateSlide,
    generateOutline,
    refineOutlineItem,
    refineAllOutlineItems,
    suggestLayouts,
    remixSlide,
    handleImageUpload,
    handleScriptFileUpload,
    removeScriptFile,
    clearInputs,
  };
}

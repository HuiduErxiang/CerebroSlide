/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { 
  Mic, 
  Square, 
  Image as ImageIcon, 
  Type as TextIcon, 
  Send, 
  Loader2, 
  Download, 
  Copy, 
  Check, 
  FileCode, 
  Layout, 
  Sparkles,
  Plus,
  Settings,
  X,
  ExternalLink,
  Key,
  Palette,
  ChevronRight,
  History,
  FolderPlus,
  Save,
  Trash2,
  ChevronLeft,
  Menu,
  Database as DatabaseIcon,
  FileUp,
  Paperclip,
  RefreshCw,
  RotateCcw,
  MicOff,
  ImagePlus,
  MessageSquare,
  FileText,
  Layers,
  FilePlus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import * as mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

import { 
  SlideElement, 
  Slide, 
  Project, 
  OutlineItem, 
  LayoutPreset, 
  ModelOption, 
  PresetStyle, 
  FontOption,
  ScenarioId,
  Scenario
} from "./types";

import { 
  LAYOUT_PRESETS, 
  MODELS, 
  DEFAULT_COLORS, 
  SCRIPT_SYSTEM_INSTRUCTION, 
  PRESET_STYLES, 
  STYLE_KEYWORDS, 
  REQ_KEYWORDS, 
  FONTS, 
  CHANGELOG, 
  SYSTEM_INSTRUCTION,
  SCENARIOS
} from "./constants";

import { cn, withRetry, blobToBase64, resizeImage } from "./utils";
import { saveToDB, getFromDB } from "./services/dbService";
import { exportToPptx } from "./services/pptxService";
import { SlidePreview } from "./components/SlidePreview";
import { WireframeIcon } from "./components/WireframeIcon";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  // Auth & Global State
  const [activeTab, setActiveTab] = useState<'deck' | 'single'>('deck');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userApiKey, setUserApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  // --- Helpers ---

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Project State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Design State
  const [customStyles, setCustomStyles] = useState<PresetStyle[]>([]);
  const [styleDescription, setStyleDescription] = useState("");
  const [styleRequirements, setStyleRequirements] = useState("");
  const [imageRequirements, setImageRequirements] = useState("");
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const [selectedFont, setSelectedFont] = useState(FONTS[0].family);
  const [templateImage, setTemplateImage] = useState<string | null>(null);
  const [styleGuideText, setStyleGuideText] = useState<string>("");
  const [docColors, setDocColors] = useState<string[] | null>(null);
  
  // New granular style states
  const [cornerRadius, setCornerRadius] = useState(12);
  const [shadowIntensity, setShadowIntensity] = useState<'none' | 'subtle' | 'medium' | 'high'>('subtle');
  const [safeMargin, setSafeMargin] = useState(40);
  const [showPageNumber, setShowPageNumber] = useState(true);
  const [footerText, setFooterText] = useState("");
  const [titleFontSize, setTitleFontSize] = useState(48);
  const [subtitleFontSize, setSubtitleFontSize] = useState(28);
  const [bodyFontSize, setBodyFontSize] = useState(18);
  const [isAnalyzingTemplate, setIsAnalyzingTemplate] = useState(false);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [newStyleName, setNewStyleName] = useState("");

  // Generation State
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>("split-left");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        
        // Convert audio to text (Mock for now, or use Gemini if possible)
        showToast("正在识别语音...", "info");
        // In a real app, we'd send this to a STT service
        // For now, we'll just show a message
        setTimeout(() => {
          showToast("语音识别成功", "success");
        }, 1500);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      showToast("无法访问麦克风", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [remixingSlideId, setRemixingSlideId] = useState<string | null>(null);
  const [imageGenProgress, setImageGenProgress] = useState({ current: 0, total: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [visualizingItemId, setVisualizingItemId] = useState<string | null>(null);

  // Script Mode State
  const [isScriptMode, setIsScriptMode] = useState(false);
  const [scriptInput, setScriptInput] = useState("");
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>('general');
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isSuggestingLayouts, setIsSuggestingLayouts] = useState(false);
  const [layoutSelectionItem, setLayoutSelectionItem] = useState<OutlineItem | null>(null);
  const [layoutSuggestions, setLayoutSuggestions] = useState<{id: string, reason: string}[]>([]);
  const [scriptFiles, setScriptFiles] = useState<{ name: string; content: string }[]>([]);
  const scriptFileInputRef = useRef<HTMLInputElement>(null);

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [designPanelOpen, setDesignPanelOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || null
  , [projects, activeProjectId]);

  const allStyles = useMemo(() => [...PRESET_STYLES, ...customStyles], [customStyles]);

  // --- Persistence ---

  useEffect(() => {
    const savedKey = localStorage.getItem("slidegen_user_api_key");
    if (savedKey) {
      setUserApiKey(savedKey);
      setIsLoggedIn(true);
      loadUserData(savedKey);
    }
  }, []);

  useEffect(() => {
    if (activeProject) {
      setScriptInput(activeProject.script || "");
    }
  }, [activeProjectId]);

  const loadUserData = async (apiKey: string) => {
    const prefix = `slidegen_v2_${apiKey}_`;
    try {
      console.log("Loading user data for:", apiKey);
      // 1. Try to load from cloud
      const response = await fetch('/api/user-data', {
        headers: { 'x-api-key': apiKey }
      });
      
      if (!response.ok) throw new Error("Cloud sync failed");
      const cloudData = await response.json();
      console.log("Cloud data received:", cloudData);

      // 2. Deep scan local data
      let localProjects: Project[] = await getFromDB(prefix + "projects");
      if (!localProjects || localProjects.length === 0) {
        const legacyKeys = [prefix + "projects", "projects", "slidegen_projects"];
        for (const key of legacyKeys) {
          const legacy = localStorage.getItem(key);
          if (legacy) {
            try {
              const parsed = JSON.parse(legacy);
              if (Array.isArray(parsed) && parsed.length > 0) {
                localProjects = parsed;
                break;
              }
            } catch (e) {}
          }
        }
      }

      const localStyles = JSON.parse(localStorage.getItem(prefix + "custom_styles") || localStorage.getItem("custom_styles") || "[]");

      // 3. Decision logic
      if (cloudData.projects && cloudData.projects.length > 0) {
        // Cloud has data, use it
        console.log("Using cloud data:", cloudData.projects.length, "projects");
        const projectsWithOutline = cloudData.projects.map((p: any) => ({
          ...p,
          script: p.script || "",
          outline: p.outline || []
        }));
        setProjects(projectsWithOutline);
        setCustomStyles(cloudData.customStyles || []);
        if (projectsWithOutline.length > 0) {
          setActiveProjectId(projectsWithOutline[0].id);
        }
      } else if (localProjects && localProjects.length > 0) {
        // Cloud is empty but local has data -> Migrate
        console.log("Cloud empty, migrating local data:", localProjects.length, "projects");
        showToast(`正在同步您的 ${localProjects.length} 个本地项目...`, "info");
        
        // Update UI immediately for better UX
        setProjects([...localProjects]);
        setCustomStyles(localStyles);
        setActiveProjectId(localProjects[0].id);

        try {
          await fetch('/api/user-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
            body: JSON.stringify({ projects: localProjects, customStyles: localStyles })
          });
          showToast("本地数据已成功同步至云端！", "success");
        } catch (syncErr) {
          console.error("Initial migration sync failed:", syncErr);
          showToast("云端同步失败，但本地数据已加载", "info");
        }
      } else {
        // Both empty
        console.log("No data found in cloud or local");
        setProjects([]);
        setCustomStyles([]);
      }

      const savedModel = localStorage.getItem(prefix + "model");
      if (savedModel) setSelectedModel(savedModel);
    } catch (err) {
      console.error("Failed to load user data:", err);
      showToast("数据加载失败，请检查网络", "error");
    }
  };

  const syncData = async (updatedProjects?: Project[], updatedStyles?: PresetStyle[]) => {
    if (!userApiKey) return;
    
    const newProjects = updatedProjects || projects;
    const newStyles = updatedStyles || customStyles;

    if (updatedProjects) setProjects(updatedProjects);
    if (updatedStyles) setCustomStyles(updatedStyles);

    // 1. Sync to cloud (Background)
    fetch('/api/user-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': userApiKey },
      body: JSON.stringify({ projects: newProjects, customStyles: newStyles })
    }).catch(err => console.error("Cloud sync failed:", err));

    // 2. Save to local cache
    const prefix = `slidegen_v2_${userApiKey}_`;
    if (updatedProjects) {
      saveToDB(prefix + "projects", updatedProjects).catch(err => console.error("Local save failed:", err));
    }
    if (updatedStyles) {
      localStorage.setItem(prefix + "custom_styles", JSON.stringify(updatedStyles));
    }
  };

  // --- Handlers ---

  const forceMigrateLocalData = async () => {
    if (!userApiKey) return;
    const prefix = `slidegen_v2_${userApiKey}_`;
    try {
      showToast("正在深度扫描本地数据...", "info");
      
      let localProjects: Project[] = [];
      const legacyKeys = [prefix + "projects", "projects", "slidegen_projects", "slidegen_v2_projects"];
      
      for (const key of legacyKeys) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          try {
            const parsed = JSON.parse(legacy);
            if (Array.isArray(parsed)) {
              localProjects = [...localProjects, ...parsed];
            }
          } catch (e) {}
        }
      }
      
      // Also check IndexedDB
      const dbProjects = await getFromDB(prefix + "projects");
      if (dbProjects && Array.isArray(dbProjects)) {
        localProjects = [...localProjects, ...dbProjects];
      }

      // Remove duplicates by ID
      localProjects = Array.from(new Map(localProjects.map(p => [p.id, p])).values());

      if (localProjects.length === 0) {
        showToast("未发现可迁移的本地数据", "info");
        return;
      }

      const confirm = window.confirm(`发现 ${localProjects.length} 个本地项目，是否将其合并到当前的云端账户？`);
      if (!confirm) return;

      // Update UI immediately
      setProjects(prev => {
        const merged = [...prev, ...localProjects];
        return Array.from(new Map(merged.map(p => [p.id, p])).values());
      });

      // Fetch current cloud data to merge on server
      const response = await fetch('/api/user-data', {
        headers: { 'x-api-key': userApiKey }
      });
      const cloudData = await response.json();

      const mergedProjects = [...(cloudData.projects || []), ...localProjects];
      const uniqueProjects = Array.from(new Map(mergedProjects.map(p => [p.id, p])).values());

      await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': userApiKey },
        body: JSON.stringify({ projects: uniqueProjects, customStyles: customStyles })
      });

      if (uniqueProjects.length > 0 && !activeProjectId) {
        setActiveProjectId(uniqueProjects[0].id);
      }
      
      showToast(`成功合并 ${localProjects.length} 个项目！`, "success");
    } catch (err) {
      console.error("Manual migration failed:", err);
      showToast("同步失败，请重试", "error");
    }
  };

  const handleLogin = async () => {
    if (!userApiKey.trim()) return;
    
    setIsLoggingIn(true);
    try {
      // Validate API Key by making a small call
      const ai = new GoogleGenAI({ apiKey: userApiKey.trim() });
      await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "hi",
        config: { 
          maxOutputTokens: 1,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      localStorage.setItem("slidegen_user_api_key", userApiKey.trim());
      setIsLoggedIn(true);
      loadUserData(userApiKey.trim());
      showToast("登录成功，欢迎回来！", "success");
    } catch (err: any) {
      console.error("API Key validation failed:", err);
      showToast("API Key 验证失败，请检查是否输入正确或是否有额度", "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("slidegen_user_api_key");
    setIsLoggedIn(false);
    setUserApiKey("");
    setProjects([]);
    setCustomStyles([]);
    setActiveProjectId(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setSelectedImage(base64);
        setUploadProgress(100);
        
        // Extract layout from image
        showToast("正在分析参考图布局...", "info");
        const ai = new GoogleGenAI({ apiKey: userApiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview", // Use a model with vision
          contents: {
            parts: [
              { text: "Analyze this PPT slide image and describe its layout structure in one sentence. Also, suggest which of these layout types it most closely resembles: 'split-left', 'split-right', 'center-hero', 'grid-3', 'top-bottom', 'full-image'." },
              { inlineData: { mimeType: file.type, data: base64.split(",")[1] } }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                layoutType: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["layoutType", "description"]
            }
          }
        });
        
        const result = JSON.parse(response.text);
        if (result.layoutType) {
          setSelectedLayoutId(result.layoutType);
          showToast(`已识别布局: ${result.description}`, "success");
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Image upload failed:", err);
      showToast("图片上传或分析失败", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const createProject = () => {
    if (!newProjectName.trim()) return;
    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName.trim(),
      createdAt: Date.now(),
      scenarioId: selectedScenarioId,
      slides: []
    };
    const updated = [newProject, ...projects];
    syncData(updated);
    setActiveProjectId(newProject.id);
    setNewProjectName("");
    setIsCreatingProject(false);
    showToast(`项目 "${newProject.name}" 创建成功`, "success");
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = projects.filter(p => p.id !== id);
    syncData(updated);
    if (activeProjectId === id) {
      setActiveProjectId(updated.length > 0 ? updated[0].id : null);
    }
    showToast("项目已删除", "info");
  };

  const saveCustomStyle = () => {
    if (!newStyleName.trim()) return;
    const newStyle: PresetStyle = {
      id: "custom_" + Date.now(),
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
      imageRequirements
    };
    const updated = [...customStyles, newStyle];
    syncData(undefined, updated);
    setNewStyleName("");
    setIsSavingStyle(false);
    showToast(`风格 "${newStyle.name}" 已保存`, "success");
  };

  const deleteCustomStyle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customStyles.filter(s => s.id !== id);
    syncData(undefined, updated);
    showToast("风格已删除", "info");
  };

  const applyPreset = (preset: PresetStyle) => {
    setStyleDescription(preset.style);
    setStyleRequirements(preset.requirements);
    setColors(preset.colors);
    if (preset.fontFamily) setSelectedFont(preset.fontFamily);
    if (preset.referenceImage) setTemplateImage(preset.referenceImage);
    if (preset.imageRequirements) setImageRequirements(preset.imageRequirements);
    
    // Apply granular settings if they exist, otherwise use defaults
    setCornerRadius(preset.cornerRadius ?? 12);
    setShadowIntensity(preset.shadowIntensity ?? 'subtle');
    setSafeMargin(preset.safeMargin ?? 40);
    setShowPageNumber(preset.showPageNumber ?? true);
    setFooterText(preset.footerText ?? "");
    setTitleFontSize(preset.titleFontSize ?? 48);
    setSubtitleFontSize(preset.subtitleFontSize ?? 28);
    setBodyFontSize(preset.bodyFontSize ?? 18);
  };

  const analyzeTemplateImage = async (base64: string) => {
    setIsAnalyzingTemplate(true);
    try {
      const ai = new GoogleGenAI({ apiKey: userApiKey });
      const response = await withRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/png", data: base64.split(",")[1] } },
            { text: `分析这张幻灯片模板图并提取其设计风格。
            请重点提取整体风格样式（例如：杂志风、动漫风、极简科技风、孟菲斯风格等）。
            
            返回一个 JSON 对象，包含以下字段（所有内容必须使用中文）：
            - styleDescription: 整体风格样式的简短描述（使用中文，例如“高端杂志排版风格”）。
            - styleRequirements: 具体的视觉规则描述（使用中文，例如“大圆角、柔和阴影、网格背景、非对称布局”）。
            - imageRequirements: 背景图及贴图的具体要求（使用中文，例如“使用抽象渐变作为背景，贴图采用 3D 拟物风格”）。
            - colors: 包含 4 个十六进制颜色值的数组（严格遵守此顺序：1.背景色, 2.主色/强调色, 3.辅助色/线框色, 4.文字色）。注意：文字色必须与背景色有极高对比度。
            - suggestedFont: 与此风格匹配的常用 Web 字体名称。
            - cornerRadius: 建议的圆角大小（0 到 40 之间的整数）。
            - shadowIntensity: 建议的阴影强度（"none", "subtle", 或 "medium"）。
            - safeMargin: 建议的安全边距（0 到 100 之间的整数）。
            - titleFontSize: 建议的标题字号（36 到 72 之间的整数）。
            - subtitleFontSize: 建议的副标题字号（20 到 36 之间的整数）。
            - bodyFontSize: 建议的正文字号（12 到 24 之间的整数）。
            ` }
          ]
        },
        config: { 
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      }));

      const result = JSON.parse(response.text || "{}");
      
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
      
      // Apply granular settings if extracted, otherwise keep defaults
      if (result.cornerRadius !== undefined) setCornerRadius(result.cornerRadius);
      if (result.shadowIntensity) setShadowIntensity(result.shadowIntensity);
      if (result.safeMargin !== undefined) setSafeMargin(result.safeMargin);
      if (result.titleFontSize !== undefined) setTitleFontSize(result.titleFontSize);
      if (result.subtitleFontSize !== undefined) setSubtitleFontSize(result.subtitleFontSize);
      if (result.bodyFontSize !== undefined) setBodyFontSize(result.bodyFontSize);
      
      // Try to match font
      if (result.suggestedFont) {
        const matched = FONTS.find(f => result.suggestedFont.toLowerCase().includes(f.name.toLowerCase()));
        if (matched) setSelectedFont(matched.family);
      }
      showToast("参考图分析完成，已应用风格", "success");
    } catch (err) {
      console.error("Failed to analyze template:", err);
      const msg = "分析模板失败，请重试。";
      showToast(msg, 'error');
      setError(msg);
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
      let text = "";
      if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          fullText += strings.join(" ") + "\n";
        }
        text = fullText;
      } else {
        text = await file.text();
      }
      
      setStyleGuideText(text);
      
      // Analyze text to extract style info
      const ai = new GoogleGenAI({ apiKey: userApiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              styleDescription: { type: Type.STRING },
              styleRequirements: { type: Type.STRING },
              imageRequirements: { type: Type.STRING },
              colors: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "包含 4 个十六进制颜色值的数组：1.背景色, 2.主色, 3.辅助色, 4.文字色"
              }
            },
            required: ["styleDescription", "styleRequirements", "imageRequirements"]
          }
        }
      });
      
      const result = JSON.parse(response.text);
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

      // Only apply colors from document if no template image is present
      if (result.colors && Array.isArray(result.colors) && result.colors.length >= 4) {
        setDocColors(result.colors.slice(0, 4));
        if (!templateImage) {
          setColors(result.colors.slice(0, 4));
        }
      }

      showToast("风格简述文档已加载并分析完成", "success");
    } catch (err) {
      console.error("Style guide upload failed:", err);
      showToast("文档加载或分析失败，请确保文件格式正确", "error");
    } finally {
      setIsAnalyzingDoc(false);
    }
  };

  const deleteSlide = (slideId: string) => {
    if (!activeProjectId) return;
    const updatedProjects = projects.map(p => 
      p.id === activeProjectId 
        ? { ...p, slides: p.slides.filter(s => s.id !== slideId) } 
        : p
    );
    syncData(updatedProjects);
  };

  const suggestLayouts = async (item: OutlineItem) => {
    if (!item || isSuggestingLayouts) return;
    
    setIsSuggestingLayouts(true);
    setLayoutSelectionItem(item);
    setLayoutSuggestions([]);
    
    try {
      const ai = new GoogleGenAI({ apiKey: userApiKey || process.env.GEMINI_API_KEY });
      
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

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      const suggestions = JSON.parse(response.text || "[]");
      setLayoutSuggestions(suggestions);
    } catch (err) {
      console.error("Layout suggestion failed:", err);
      showToast("获取布局建议失败，请重试", "error");
    } finally {
      setIsSuggestingLayouts(false);
    }
  };

  const generateSlide = async (item?: OutlineItem) => {
    if (!activeProjectId) {
      setError("请先创建一个项目。");
      return;
    }
    if (!item && !inputText && !audioBlob && !selectedImage) {
      setError("请输入内容描述。");
      return;
    }

    setIsGenerating(true);
    if (item) setVisualizingItemId(item.id);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: userApiKey });
      
      // Build context from previous slides
      const context = activeProject?.slides.map((s, i) => 
        `Slide ${i+1}: ${s.title} - ${s.description}`
      ).join("\n") || "";

      const parts: any[] = [];
      
      if (item) {
        parts.push({ text: `ORIGINAL SOURCE TEXT (CONTEXT):
        ${activeProject?.sourceText || activeProject?.script || "Not available"}

        Generate a slide based on this outline item:
        Title: ${item.title}
        Subtitle: ${item.subtitle}
        Body: ${item.body}
        Suggested Layout: ${item.suggestedLayout} (${item.layoutDescription})` });
      } else {
        if (inputText) parts.push({ text: `User input: ${inputText}` });
        if (selectedLayoutId) {
          const layout = LAYOUT_PRESETS.find(l => l.id === selectedLayoutId);
          if (layout) parts.push({ text: `Preferred Layout: ${layout.name} (${layout.description})` });
        }
      }

      const response = await withRetry(() => ai.models.generateContent({
        model: selectedModel,
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION(
            styleDescription, 
            styleRequirements, 
            colors, 
            selectedFont, 
            context,
            { 
              cornerRadius, 
              shadowIntensity, 
              safeMargin, 
              showPageNumber, 
              footerText,
              titleFontSize,
              subtitleFontSize,
              bodyFontSize
            },
            styleGuideText,
            imageRequirements,
            item?.pageStyle,
            item?.decorativeIcon,
            item?.keyData,
            item?.quotes,
            item?.highlights,
            item?.suggestedLayout
          ),
          responseMimeType: "application/json",
          thinkingConfig: selectedModel.includes("gemini-3") ? { thinkingLevel: ThinkingLevel.LOW } : undefined,
          responseSchema: {
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
                        fontSize: { type: Type.NUMBER, description: "Font size in pt. MUST be exactly the size specified in the hierarchy rules (e.g. 48, 28, or 18)." },
                        color: { type: Type.STRING, description: "Hex color code. MANDATORY: Use the PRIMARY TEXT color from the palette." },
                        fill: { type: Type.STRING, description: "Hex color code for background fill. Use ACCENT or SECONDARY from palette." },
                        bold: { type: Type.BOOLEAN },
                        italic: { type: Type.BOOLEAN },
                        align: { type: Type.STRING, enum: ['left', 'center', 'right'] },
                        valign: { type: Type.STRING, enum: ['top', 'middle', 'bottom'] },
                        fontFamily: { type: Type.STRING },
                        opacity: { type: Type.NUMBER },
                        shadow: { type: Type.BOOLEAN },
                        cornerRadius: { type: Type.NUMBER }
                      }
                    }
                  },
                  required: ['type', 'x', 'y', 'w', 'h']
                }
              },
              imagePrompts: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    prompt: { type: Type.STRING },
                    aspectRatio: { type: Type.STRING, description: 'One of: "1:1", "3:4", "4:3", "9:16", "16:9"' }
                  },
                  required: ["prompt", "aspectRatio"]
                } 
              },
            },
            required: ["title", "description", "elements"],
          },
        },
      }));

      const result = JSON.parse(response.text || "{}");
      let slideElements: SlideElement[] = result.elements || [];

      // Auto-insert background image if missing but prompt exists
      if (result.imagePrompts?.length > 0 && !slideElements.some(el => el.type === 'image' && el.x === 0 && el.y === 0 && el.w === 100 && el.h === 100)) {
        slideElements.unshift({
          type: 'image',
          x: 0, y: 0, w: 100, h: 100,
          imageIndex: 0
        });
      }
      
      let generatedImages: string[] = [];
      if (result.imagePrompts && result.imagePrompts.length > 0) {
        setIsGeneratingImages(true);
        setImageGenProgress({ current: 0, total: result.imagePrompts.length });
        try {
          for (let i = 0; i < result.imagePrompts.length; i++) {
            setImageGenProgress(prev => ({ ...prev, current: i + 1 }));
            const imageReq = result.imagePrompts[i];
            const imgParts: any[] = [
              { text: `Create a professional presentation asset for: ${imageReq.prompt}. 
              VISUAL STYLE: ${styleDescription}. 
              TECHNICAL REQUIREMENTS: ${styleRequirements}. 
              High resolution, sharp details, 4K, professional quality. 
              Optimized for presentations, clean, high contrast, balanced composition.` }
            ];

            let imgResponse;
            try {
              imgResponse = await withRetry(() => ai.models.generateContent({
                model: "gemini-2.5-flash-image",
                contents: { parts: imgParts },
                config: {
                  imageConfig: {
                    aspectRatio: (imageReq.aspectRatio as any) || "16:9"
                  }
                }
              }));
            } catch (err: any) {
              if (err.message?.includes("403") || err.status === 403) {
                showToast("图片生成失败：您的 API Key 可能没有绘图权限或额度不足 (403)", "error");
              }
              throw err;
            }
            
            const part = imgResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (part?.inlineData) {
              let base64Data = `data:image/png;base64,${part.inlineData.data}`;
              base64Data = await resizeImage(base64Data, 1280, 1280);
              generatedImages.push(base64Data);
            }
          }
        } catch (imgErr) {
          console.error("Image generation failed:", imgErr);
        } finally {
          setIsGeneratingImages(false);
        }
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
        highlights: item?.highlights
      };

      setProjects(prev => {
        const updated = prev.map(p => {
          if (p.id !== activeProjectId) return p;
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
      showToast("幻灯片生成成功！", "success");

    } catch (err: any) {
      const msg = err.message?.includes('xhr') || err.message?.includes('Rpc failed') 
        ? "网络连接波动，请稍后重试。" 
        : (err.message || "生成失败，请重试。");
      showToast(msg, 'error');
      setError(msg);
    } finally {
      setIsGenerating(false);
      setVisualizingItemId(null);
    }
  };

  // --- Helpers ---

  const resizeImage = (base64Str: string, maxWidth = 1280, maxHeight = 1280): Promise<string> => {
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

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const clearInputs = () => {
    setInputText("");
    setAudioBlob(null);
    setSelectedImage(null);
  };

  const generateOutline = async () => {
    const combinedContent = [
      scriptInput,
      ...scriptFiles.map(f => `File: ${f.name}\nContent: ${f.content}`)
    ].filter(Boolean).join("\n\n---\n\n");

    if (!combinedContent.trim() || !activeProject) return;
    
    setIsGeneratingOutline(true);
    setError(null);
    try {
      const scenario = SCENARIOS.find(s => s.id === selectedScenarioId) || SCENARIOS[0];
      const ai = new GoogleGenAI({ apiKey: userApiKey });
      const response = await withRetry(() => ai.models.generateContent({
        model: selectedModel,
        contents: `Input content to transform into a slide outline:
        ${combinedContent}
        
        Additional User Requirements/Prompt:
        ${additionalPrompt || "None"}`,
        config: {
          systemInstruction: SCRIPT_SYSTEM_INSTRUCTION(scenario),
          maxOutputTokens: 8192,
          temperature: 0.4,
          thinkingConfig: selectedModel.includes("gemini-3") ? { thinkingLevel: ThinkingLevel.LOW } : undefined,
        }
      }));

      const rawText = response.text || "";
      
      // Manual Parsing Logic
      const slides: OutlineItem[] = [];
      const slideBlocks = rawText.split(/\[SLIDE\]/i).filter(b => b.trim().length > 0);

      for (const block of slideBlocks) {
        const cleanBlock = block.split(/\[END_SLIDE\]/i)[0].trim();
        const lines = cleanBlock.split("\n");
        
        const item: Partial<OutlineItem> = {
          isGenerated: false,
          isRefining: false,
          isRefined: false,
          keyData: [],
          quotes: [],
          highlights: []
        };

        lines.forEach(line => {
          const lowerLine = line.trim();
          if (lowerLine.startsWith("ID:")) item.id = lowerLine.replace(/^ID:/i, "").trim();
          else if (lowerLine.startsWith("TITLE:")) item.title = lowerLine.replace(/^TITLE:/i, "").trim();
          else if (lowerLine.startsWith("SUBTITLE:")) item.subtitle = lowerLine.replace(/^SUBTITLE:/i, "").trim();
          else if (lowerLine.startsWith("BODY:")) item.body = lowerLine.replace(/^BODY:/i, "").trim();
          else if (lowerLine.startsWith("LAYOUT:")) item.suggestedLayout = lowerLine.replace(/^LAYOUT:/i, "").trim();
          else if (lowerLine.startsWith("LAYOUT_DESC:")) item.layoutDescription = lowerLine.replace(/^LAYOUT_DESC:/i, "").trim();
          else if (lowerLine.startsWith("DATA:")) {
            const dataStr = lowerLine.replace(/^DATA:/i, "").trim();
            if (dataStr) {
              const parts = dataStr.split(",");
              item.keyData = parts.map(p => {
                const [label, value, unit] = p.split("|").map(s => s.trim());
                return { label: label || "", value: value || "", unit: unit || "" };
              }).filter(d => d.label || d.value);
            }
          }
          else if (lowerLine.startsWith("QUOTE:")) {
            const quoteStr = lowerLine.replace(/^QUOTE:/i, "").trim();
            if (quoteStr) {
              const [text, author] = quoteStr.split("|").map(s => s.trim());
              if (text) item.quotes = [{ text, author: author || "" }];
            }
          }
          else if (lowerLine.startsWith("HIGHLIGHTS:")) {
            const highStr = lowerLine.replace(/^HIGHLIGHTS:/i, "").trim();
            if (highStr) {
              item.highlights = highStr.split(",").map(s => s.trim()).filter(s => s.length > 0);
            }
          }
        });

        if (item.title) {
          item.metaDescription = item.body;
          slides.push(item as OutlineItem);
        }
      }

      if (slides.length === 0) {
        console.error("No slides parsed from raw text:", rawText);
        throw new Error("未能从AI返回的内容中解析出大纲，请重试。");
      }

      const updatedProjects = projects.map(p => 
        p.id === activeProjectId ? { ...p, scenarioId: selectedScenarioId, script: scriptInput, sourceText: scriptInput, outline: slides } : p
      );
      setProjects(updatedProjects);
      syncData(updatedProjects);
      showToast("大纲已生成，请审阅并点击“精炼内容”", "success");
    } catch (err: any) {
      console.error("Outline generation failed:", err);
      setError("生成大纲失败，请重试");
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const refineOutlineItem = async (itemId: string) => {
    if (!activeProject || !activeProject.outline) return;
    const item = activeProject.outline.find(o => o.id === itemId);
    if (!item) return;

    // Update state to show refining
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId 
        ? { ...p, outline: p.outline?.map(o => o.id === itemId ? { ...o, isRefining: true } : o) } 
        : p
    ));

    try {
      const scenario = SCENARIOS.find(s => s.id === activeProject.scenarioId) || SCENARIOS[0];
      const ai = new GoogleGenAI({ apiKey: userApiKey });
      const response = await withRetry(() => ai.models.generateContent({
        model: selectedModel,
        contents: `You are a PPT content refiner specializing in ${scenario.name} style. Based on the following slide meta-description AND the original source text, generate the FINAL text content and a specific STYLE description for this slide.
        
        TONE OF VOICE: ${scenario.tone}
        CONTENT LOGIC: ${scenario.logic}

        ORIGINAL SOURCE TEXT (CONTEXT):
        ${activeProject.sourceText || activeProject.script || "Not available"}

        GLOBAL PPT STYLE: ${styleDescription}
        GLOBAL STYLE REQUIREMENTS: ${styleRequirements}
        
        SLIDE META-DESCRIPTION:
        Title: ${item.title}
        Subtitle: ${item.subtitle}
        Suggested Layout: ${item.suggestedLayout}
        Creative Blueprint: ${item.metaDescription || item.body}
        
        TASK:
        1. Use the ORIGINAL SOURCE TEXT to enrich the content. If the Creative Blueprint is too brief, look back at the source text to find missing technical details, data, or nuances relevant to this slide's title.
        2. Extract visual, image, and layout cues from the Creative Blueprint and merge them with the Global Style to create a "pageStyle" description.
           - EMPHASIZE: Spatial depth, visual layering (overlapping elements), and sophisticated hierarchy.
           - NESTED LOGIC: If there are multiple related data points or highlights, suggest a "Nested Container" approach (a large group box containing individual cards).
           - IF layout is 'center-hero', the pageStyle should focus on a minimal, high-impact cover aesthetic.
           - IF layout is 'data-focus', suggest high-contrast data cards.
        3. Generate the "realBody" content. 
           - MUST be extremely concise (max 3-4 bullet points).
           - ${scenario.id === 'ted' ? 'SPECIAL FOR TED STYLE: Use ONLY 1-2 punchy sentences. Avoid bullet points if possible. Focus on a single powerful idea.' : 'Each point should be a short, punchy sentence. Use "•" as the ONLY bullet point symbol for consistency.'}
           - DO NOT include the title or subtitle.
        4. Refine the granular data using the source text for accuracy:
           - keyData: Ensure labels and values are precise.
           - quotes: Ensure quotes are impactful and authors are correct.
           - highlights: Ensure these are truly "golden sentences".
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
          responseMimeType: "application/json",
          temperature: 0.4,
          maxOutputTokens: 4096,
          thinkingConfig: selectedModel.includes("gemini-3") ? { thinkingLevel: ThinkingLevel.LOW } : undefined,
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
                    unit: { type: Type.STRING }
                  }
                }
              },
              quotes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    author: { type: Type.STRING }
                  }
                }
              },
              highlights: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["realBody", "pageStyle", "decorativeIcon"]
          }
        }
      }));

      let rawText = response.text || "";
      
      // Sanity check: If the text is suspiciously long and repetitive, it might be a loop
      if (rawText.length > 20000) {
        console.warn("Detected suspiciously long AI response in refinement, potential loop.");
        const lastBrace = rawText.lastIndexOf('}');
        if (lastBrace !== -1) {
          rawText = rawText.substring(0, lastBrace + 1);
        }
      }

      const result = JSON.parse(rawText);
      
      setProjects(prev => {
        const updated = prev.map(p => {
          if (p.id !== activeProjectId) return p;
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
                  isRefined: true 
                } 
              : o
          );
          return { ...p, outline: newOutline };
        });
        syncData(updated);
        return updated;
      });
      showToast("内容精炼完成", "success");
    } catch (err) {
      console.error("Refinement failed:", err);
      showToast("精炼内容失败", "error");
      setProjects(prev => prev.map(p => 
        p.id === activeProjectId 
          ? { ...p, outline: p.outline?.map(o => o.id === itemId ? { ...o, isRefining: false } : o) } 
          : p
      ));
    }
  };

  const refineAllOutlineItems = async () => {
    if (!activeProject || !activeProject.outline) return;
    const unrefined = activeProject.outline.filter(o => !o.pageStyle);
    if (unrefined.length === 0) {
      showToast("所有内容已精炼", "info");
      return;
    }

    showToast(`开始精炼 ${unrefined.length} 页内容...`, "info");
    for (const item of unrefined) {
      await refineOutlineItem(item.id);
    }
    showToast("全案内容精炼完成", "success");
  };

  const handleScriptFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: { name: string; content: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let content = "";
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
        showToast(`读取文件 ${file.name} 失败`, "error");
      }
    }
    setScriptFiles(prev => [...prev, ...newFiles]);
  };

  const removeScriptFile = (index: number) => {
    setScriptFiles(prev => prev.filter((_, i) => i !== index));
  };

  const remixSlide = async (slide: Slide) => {
    if (!activeProject || !slide || !slide.elements) return;
    setRemixingSlideId(slide.id);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: userApiKey });
      
      const context = activeProject.slides
        .filter(s => s.id !== slide.id)
        .map((s, i) => `Slide ${i+1}: ${s.title}`)
        .join("\n");

      const parts: any[] = [];
      
      parts.push({ text: `Remix the layout for this slide. KEEP the content, but CHANGE the visual arrangement significantly.
        Title: ${slide.title}
        Description: ${slide.description}
        Current Elements Count: ${slide.elements.length}
        
        Instruction: Provide a completely different layout (e.g., if it was left-right, make it top-bottom or grid).` });

      const slideResponse = await withRetry(() => ai.models.generateContent({
        model: selectedModel,
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION(
            styleDescription, 
            styleRequirements, 
            colors, 
            selectedFont, 
            context,
            { 
              cornerRadius, 
              shadowIntensity, 
              safeMargin, 
              showPageNumber, 
              footerText,
              titleFontSize,
              subtitleFontSize,
              bodyFontSize
            },
            styleGuideText,
            imageRequirements,
            slide.pageStyle,
            activeProject.outline?.find(o => o.slideId === slide.id)?.decorativeIcon
          ),
          responseMimeType: "application/json",
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
                        fontSize: { type: Type.NUMBER, description: "Font size in pt. MUST be exactly the size specified in the hierarchy rules (e.g. 48, 28, or 18)." },
                        color: { type: Type.STRING, description: "Hex color code. MANDATORY: Use the PRIMARY TEXT color from the palette." },
                        fill: { type: Type.STRING, description: "Hex color code for background fill. Use ACCENT or SECONDARY from palette." },
                        bold: { type: Type.BOOLEAN },
                        italic: { type: Type.BOOLEAN },
                        align: { type: Type.STRING, enum: ['left', 'center', 'right'] },
                        valign: { type: Type.STRING, enum: ['top', 'middle', 'bottom'] },
                        fontFamily: { type: Type.STRING },
                        opacity: { type: Type.NUMBER },
                        shadow: { type: Type.BOOLEAN },
                        cornerRadius: { type: Type.NUMBER }
                      }
                    }
                  },
                  required: ['type', 'x', 'y', 'w', 'h']
                }
              }
            },
            required: ["elements"]
          }
        }
      }));

      const slideData = JSON.parse(slideResponse.text);
      let slideElements: SlideElement[] = slideData.elements || [];

      // If original slide had images, ensure background image is preserved in remix if prompt was intended
      if (slide.images && slide.images.length > 0 && !slideElements.some(el => el.type === 'image' && el.x === 0 && el.y === 0 && el.w === 100 && el.h === 100)) {
        slideElements.unshift({
          type: 'image',
          x: 0, y: 0, w: 100, h: 100,
          imageIndex: 0
        });
      }
      
      const updatedProjects = projects.map(p => {
        if (p.id === activeProjectId) {
          return {
            ...p,
            slides: p.slides.map(s => s.id === slide.id ? { ...s, elements: slideElements } : s)
          };
        }
        return p;
      });

      setProjects(updatedProjects);
      syncData(updatedProjects);
      showToast("布局已重混", "success");
    } catch (err: any) {
      console.error("Slide remix failed:", err);
      setError("重混布局失败，请重试");
    } finally {
      setRemixingSlideId(null);
    }
  };

  // --- Render ---

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white p-10 rounded-[40px] shadow-2xl space-y-8 text-center"
        >
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center text-white mx-auto shadow-xl shadow-emerald-600/20">
            <Sparkles size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">SlideGen AI v2</h1>
            <p className="text-black/40 text-sm">输入您的 Gemini API Key 开启创作</p>
          </div>
          <div className="space-y-4">
            <input
              type="password"
              value={userApiKey}
              onChange={(e) => setUserApiKey(e.target.value)}
              placeholder="在此粘贴您的 API Key..."
              className="w-full px-6 py-4 bg-black/5 border border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 outline-none transition-all"
            />
            <button
              onClick={handleLogin}
              disabled={isLoggingIn || !userApiKey.trim()}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white rounded-2xl font-bold shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>正在验证 Key...</span>
                </>
              ) : (
                "进入工作台"
              )}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F5F5F4] text-[#141414] font-sans flex overflow-hidden">
      
      {/* Left Sidebar: Projects */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className="bg-white border-r border-black/5 flex flex-col shrink-0 overflow-hidden"
      >
        <div className="p-6 border-b border-black/5 flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <FolderPlus size={20} className="text-emerald-600" /> 我的项目
          </h2>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => userApiKey && loadUserData(userApiKey)}
              className="p-1.5 hover:bg-black/5 text-black/40 rounded-lg transition-colors"
              title="刷新数据"
            >
              <History size={18} />
            </button>
            <button 
              onClick={() => setIsCreatingProject(true)}
              className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
          <AnimatePresence initial={false}>
            {isCreatingProject && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-3 bg-emerald-50 rounded-2xl space-y-3"
              >
                <input 
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="项目名称..."
                  className="w-full bg-white border-none rounded-xl p-2 text-sm outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && createProject()}
                />
                <div className="flex gap-2">
                  <button onClick={createProject} className="flex-1 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg">创建</button>
                  <button onClick={() => setIsCreatingProject(false)} className="flex-1 py-1.5 bg-black/5 text-black/40 text-xs font-bold rounded-lg">取消</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {projects.length === 0 && !isCreatingProject && (
            <div className="text-center py-10 px-4 space-y-2">
              <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center mx-auto text-black/20">
                <FolderPlus size={24} />
              </div>
              <p className="text-xs text-black/40 font-medium">暂无项目</p>
              <button 
                onClick={() => setIsCreatingProject(true)}
                className="text-[10px] text-emerald-600 font-bold hover:underline"
              >
                立即创建第一个项目
              </button>
            </div>
          )}

          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => setActiveProjectId(project.id)}
              className={cn(
                "w-full p-4 rounded-2xl text-left transition-all group relative cursor-pointer",
                activeProjectId === project.id ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "hover:bg-black/5"
              )}
            >
              <p className="font-bold text-sm truncate pr-6">{project.name}</p>
              <p className={cn("text-[10px] mt-1", activeProjectId === project.id ? "text-white/60" : "text-black/40")}>
                {project.slides.length} 张幻灯片
              </p>
              <button 
                onClick={(e) => deleteProject(project.id, e)}
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                  activeProjectId === project.id ? "hover:bg-white/20" : "hover:bg-red-50 text-red-400"
                )}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-black/5">
          <button 
            onClick={() => setShowSettings(true)}
            className="w-full p-3 rounded-xl hover:bg-black/5 flex items-center gap-3 text-sm font-bold text-black/60 transition-all"
          >
            <Settings size={18} /> 设置与模型
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F5F5F4]">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-black/5 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-black/5 rounded-xl transition-colors">
              <Menu size={20} />
            </button>
            <div className="h-4 w-[1px] bg-black/10" />
            <h1 className="font-bold text-lg truncate max-w-[300px]">
              {activeProject ? activeProject.name : "请选择或创建项目"}
            </h1>
          </div>
          <div className="flex items-center bg-black/5 p-1 rounded-2xl">
            <button 
              onClick={() => setActiveTab('deck')}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
                activeTab === 'deck' ? "bg-white text-emerald-600 shadow-sm" : "text-black/40 hover:text-black/60"
              )}
            >
              <Layers size={18} /> 全案生成
            </button>
            <button 
              onClick={() => setActiveTab('single')}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
                activeTab === 'single' ? "bg-white text-emerald-600 shadow-sm" : "text-black/40 hover:text-black/60"
              )}
            >
              <FilePlus size={18} /> 单页制作
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setDesignPanelOpen(!designPanelOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                designPanelOpen ? "bg-emerald-50 text-emerald-600" : "hover:bg-black/5 text-black/40"
              )}
            >
              <Palette size={18} /> 设计风格
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-12 scrollbar-hide">
          {!activeProject ? (
            <div className="h-full flex flex-col items-center justify-center text-black/20 space-y-4">
              <FolderPlus size={80} strokeWidth={1} />
              <p className="text-xl font-bold">从创建一个新项目开始吧</p>
            </div>
          ) : activeTab === 'deck' ? (
            <div className="max-w-6xl mx-auto space-y-12">
              {/* Deck Mode: Full Generation Flow */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Script Input */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-black/5 space-y-6 sticky top-8">
                    <div className="flex items-center justify-between">
                      <h2 className="font-bold text-lg flex items-center gap-2 text-emerald-600">
                        <FileText size={20} /> 输入文案
                      </h2>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest">选择内容场景 (影响文案调性)</p>
                      <div className="grid grid-cols-2 gap-2">
                        {SCENARIOS.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedScenarioId(s.id)}
                            className={cn(
                              "flex flex-col items-start p-3 rounded-2xl border transition-all text-left",
                              selectedScenarioId === s.id 
                                ? "bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/20" 
                                : "bg-white border-black/5 hover:border-black/10"
                            )}
                          >
                            <span className={cn(
                              "text-[10px] font-bold",
                              selectedScenarioId === s.id ? "text-emerald-600" : "text-black/60"
                            )}>{s.name}</span>
                            <span className="text-[9px] text-black/40 line-clamp-1 mt-0.5">{s.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea 
                      value={scriptInput}
                      onChange={(e) => setScriptInput(e.target.value)}
                      placeholder="粘贴您的长文、会议纪要或灵感片段..."
                      className="w-full h-64 bg-black/5 border-none rounded-3xl p-6 text-sm outline-none resize-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all leading-relaxed"
                    />
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-black/40 uppercase tracking-widest">附件文档 ({scriptFiles.length})</p>
                        <button 
                          onClick={() => scriptFileInputRef.current?.click()}
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all"
                          title="上传参考文档"
                        >
                          <Paperclip size={18} />
                        </button>
                        <input 
                          type="file" 
                          ref={scriptFileInputRef}
                          onChange={handleScriptFileUpload}
                          multiple
                          accept=".txt,.md,.docx"
                          className="hidden"
                        />
                      </div>
                      
                      {scriptFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {scriptFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-black/5 rounded-full text-[10px] font-bold group">
                              <FileText size={12} className="text-black/40" />
                              <span className="max-w-[100px] truncate">{file.name}</span>
                              <button onClick={() => removeScriptFile(idx)} className="text-black/20 hover:text-red-500">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={generateOutline}
                      disabled={isGeneratingOutline || !scriptInput.trim()}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      {isGeneratingOutline ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={18} />}
                      生成大纲结构
                    </button>
                  </div>
                </div>

                {/* Right: Outline & Generation */}
                <div className="lg:col-span-2 space-y-8">
                  {activeProject.outline && activeProject.outline.length > 0 ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                          <h2 className="font-bold text-xl">幻灯片大纲 ({activeProject.outline.length})</h2>
                          {activeProject.scenarioId && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                              {SCENARIOS.find(s => s.id === activeProject.scenarioId)?.name} 风格
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={async () => {
                              try {
                                await exportToPptx(activeProject, colors[0], cornerRadius);
                              } catch (err) {
                                showToast("导出 PPTX 失败，请检查内容或重试", "error");
                                console.error(err);
                              }
                            }}
                            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
                          >
                            <Download size={16} /> 导出完整 PPTX
                          </button>
                          <button 
                            onClick={async () => {
                              if (!activeProject.outline) return;
                              for (const item of activeProject.outline) {
                                if (!item.isGenerated) {
                                  await generateSlide(item);
                                }
                              }
                            }}
                            disabled={isGenerating || !!remixingSlideId}
                            className="px-6 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-black/80 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            一键视觉化全案
                          </button>
                          <button 
                            onClick={refineAllOutlineItems}
                            disabled={isGenerating || !!remixingSlideId}
                            className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <Sparkles size={16} />
                            一键精炼全案内容
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-8">
                        {activeProject.outline.map((item, idx) => (
                          <div key={item.id} className="bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden group">
                            <div className="p-8 space-y-6">
                              <div className="flex items-start justify-between gap-8">
                                  <div className="flex-1 space-y-6">
                                    <div className="flex items-center gap-3">
                                      <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                                        {idx + 1}
                                      </span>
                                      <div className="flex-1">
                                        <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest mb-1 ml-2">标题</p>
                                        <input 
                                          value={item.title}
                                          onChange={(e) => {
                                            const newOutline = activeProject.outline?.map(o => o.id === item.id ? { ...o, title: e.target.value } : o);
                                            syncData(projects.map(p => p.id === activeProjectId ? { ...p, outline: newOutline } : p));
                                          }}
                                          className="text-xl font-bold bg-transparent border-none outline-none w-full focus:ring-2 focus:ring-emerald-500/10 rounded-lg px-2"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest mb-1 ml-2">副标题</p>
                                      <input 
                                        value={item.subtitle}
                                        onChange={(e) => {
                                          const newOutline = activeProject.outline?.map(o => o.id === item.id ? { ...o, subtitle: e.target.value } : o);
                                          syncData(projects.map(p => p.id === activeProjectId ? { ...p, outline: newOutline } : p));
                                        }}
                                        placeholder="添加副标题..."
                                        className="text-sm text-black/40 bg-transparent border-none outline-none w-full focus:ring-2 focus:ring-emerald-500/10 rounded-lg px-2"
                                      />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest mb-1 ml-2">正文内容 {item.isRefined && <span className="text-emerald-500 font-normal">(已精炼)</span>}</p>
                                      <div className="relative group/body">
                                        <textarea 
                                          value={item.body}
                                          onChange={(e) => {
                                            const newOutline = activeProject.outline?.map(o => o.id === item.id ? { ...o, body: e.target.value } : o);
                                            syncData(projects.map(p => p.id === activeProjectId ? { ...p, outline: newOutline } : p));
                                          }}
                                          className="w-full bg-black/5 border-none rounded-2xl p-4 text-sm outline-none resize-none focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all min-h-[100px] leading-relaxed"
                                        />
                                        <button
                                          onClick={() => refineOutlineItem(item.id)}
                                          disabled={item.isRefining || isGenerating}
                                          className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm opacity-0 group-hover/body:opacity-100 transition-all hover:bg-emerald-50 text-emerald-600 disabled:opacity-50"
                                          title="精炼内容与风格"
                                        >
                                          {item.isRefining ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                        </button>
                                      </div>
                                      {item.pageStyle && (
                                        <div className="mt-2 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50 flex items-start gap-3">
                                          {item.decorativeIcon && (
                                            <div className="text-2xl shrink-0 mt-1">{item.decorativeIcon}</div>
                                          )}
                                          <div className="flex-1">
                                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">本页专属风格</p>
                                            <p className="text-[11px] text-emerald-800/70 leading-relaxed">{item.pageStyle}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                <div className="w-56 shrink-0 space-y-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest">建议布局</p>
                                      <button 
                                        onClick={() => suggestLayouts(item)}
                                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
                                      >
                                        <RefreshCw size={10} /> 更换布局
                                      </button>
                                    </div>
                                    <WireframeIcon type={item.suggestedLayout} />
                                  </div>
                                  <div className="p-3 bg-black/5 rounded-xl">
                                    <p className="text-[10px] text-black/40 leading-relaxed italic">“{item.layoutDescription}”</p>
                                  </div>
                                </div>
                              </div>

                              {/* Visualization Result */}
                              <div className="pt-8 border-t border-black/5">
                                {item.isGenerated ? (
                                  <div className="space-y-6">
                                    <div className="relative group/slide rounded-2xl overflow-hidden border border-black/5 shadow-inner">
                                      {(() => {
                                        const slide = activeProject.slides.find(s => s.id === item.slideId);
                                        return (
                                          <>
                                            <SlidePreview 
                                              slide={slide!} 
                                              shadowIntensity={shadowIntensity} 
                                              cornerRadius={cornerRadius} 
                                              backgroundColor={colors[0]}
                                            />
                                            {slide && (
                                              <div className="absolute inset-0 bg-black/80 opacity-0 group-hover/slide:opacity-100 transition-all flex items-center justify-center gap-4 backdrop-blur-sm z-50">
                                                <button 
                                                  onClick={() => remixSlide(slide)}
                                                  disabled={!!remixingSlideId || isGenerating}
                                                  className="px-4 py-2 bg-white text-black rounded-xl text-xs font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                  {remixingSlideId === slide.id ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                                                  重混布局
                                                </button>
                                                <button 
                                                  onClick={() => generateSlide(item)}
                                                  disabled={!!remixingSlideId || isGenerating}
                                                  className="px-4 py-2 bg-white text-black rounded-xl text-xs font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                  {isGenerating && visualizingItemId === item.id ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                                                  重新绘制
                                                </button>
                                                <button 
                                                  onClick={async () => {
                                                    try {
                                                      await exportToPptx({ ...activeProject, slides: [slide] }, colors[0], cornerRadius);
                                                    } catch (err) {
                                                      showToast("导出单页 PPTX 失败", "error");
                                                      console.error(err);
                                                    }
                                                  }}
                                                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-xl cursor-pointer"
                                                >
                                                  <Download size={14} /> 导出此页
                                                </button>
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => generateSlide(item)}
                                    disabled={isGenerating || !!remixingSlideId}
                                    className="w-full py-10 border-2 border-dashed border-black/10 rounded-[32px] hover:border-emerald-500/40 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-3 group/btn relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {visualizingItemId === item.id ? (
                                      <div className="flex flex-col items-center gap-4">
                                        <div className="relative">
                                          <Loader2 className="animate-spin text-emerald-600" size={48} />
                                          <div className="absolute inset-0 flex items-center justify-center">
                                            <Sparkles size={20} className="text-emerald-400" />
                                          </div>
                                        </div>
                                        <div className="text-center space-y-1">
                                          <p className="text-sm font-bold text-emerald-600">
                                            {isGeneratingImages ? `正在生成贴图 (${imageGenProgress.current}/${imageGenProgress.total})` : "正在构思页面布局..."}
                                          </p>
                                          <p className="text-[10px] text-black/20">AI 正在为您打造专业视觉效果</p>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center text-black/20 group-hover/btn:bg-emerald-100 group-hover/btn:text-emerald-600 transition-all scale-100 group-hover/btn:scale-110">
                                          <Sparkles size={32} />
                                        </div>
                                        <div className="text-center">
                                          <p className="text-base font-bold text-black/40 group-hover/btn:text-emerald-600">点击视觉化此页面</p>
                                          <p className="text-xs text-black/20 mt-1">基于建议布局生成专业幻灯片</p>
                                        </div>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[600px] flex flex-col items-center justify-center text-black/5 space-y-6">
                      <FileText size={120} strokeWidth={1} />
                      <div className="text-center space-y-2">
                        <p className="text-2xl font-bold">生成大纲后开始创作</p>
                        <p className="text-sm">在左侧输入您的文案，我们将为您规划每一页的结构</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-12">
              {/* Single Mode: Individual Slide Creation */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Left: Input & Layout Selection */}
                <div className="space-y-8">
                  <div className="bg-white p-10 rounded-[40px] shadow-sm border border-black/5 space-y-10">
                    <div className="space-y-6">
                      <h2 className="font-bold text-xl flex items-center gap-3 text-emerald-600">
                        <MessageSquare size={24} /> 创意指令
                      </h2>
                      <textarea 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="描述您想要的页面内容，或使用语音指令..."
                        className="w-full h-40 bg-black/5 border-none rounded-3xl p-8 text-base outline-none resize-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all leading-relaxed"
                      />
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={isRecording ? stopRecording : startRecording}
                          className={cn(
                            "flex-1 py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                            isRecording ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20" : "bg-black/5 text-black/60 hover:bg-black/10"
                          )}
                        >
                          {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                          {isRecording ? "正在倾听..." : "语音输入指令"}
                        </button>
                        <label className="flex-1 py-4 bg-black/5 text-black/60 hover:bg-black/10 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all">
                          <ImagePlus size={20} />
                          参考图临摹
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h2 className="font-bold text-xl flex items-center gap-3 text-emerald-600">
                        <Layout size={24} /> 选择布局
                      </h2>
                      <div className="grid grid-cols-3 gap-4">
                        {LAYOUT_PRESETS.map(preset => (
                          <button 
                            key={preset.id}
                            onClick={() => setSelectedLayoutId(preset.id)}
                            className={cn(
                              "p-4 rounded-[24px] border-2 transition-all text-left space-y-3 group/layout",
                              selectedLayoutId === preset.id ? "border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-500/10" : "border-transparent bg-black/5 hover:bg-black/10"
                            )}
                          >
                            <WireframeIcon type={preset.iconType} className="border-none bg-transparent group-hover/layout:scale-105 transition-transform" />
                            <div className="space-y-1">
                              <p className="text-xs font-bold truncate">{preset.name}</p>
                              <p className="text-[10px] text-black/30 line-clamp-1">{preset.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={() => generateSlide()}
                      disabled={isGenerating || (!inputText.trim() && !audioBlob && !selectedImage)}
                      className="w-full py-6 bg-emerald-600 text-white rounded-[32px] font-bold shadow-2xl shadow-emerald-600/20 flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-95"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" size={28} /> : <Sparkles size={24} />}
                      立即生成页面
                    </button>
                  </div>
                </div>

                {/* Right: Preview & History */}
                <div className="space-y-10">
                  {(() => {
                    const singleSlides = activeProject.slides.filter(s => !activeProject.outline?.some(o => o.slideId === s.id));
                    if (singleSlides.length === 0) {
                      return (
                        <div className="h-[600px] flex flex-col items-center justify-center text-black/5 space-y-6">
                          <Sparkles size={120} strokeWidth={1} />
                          <div className="text-center space-y-2">
                            <p className="text-2xl font-bold">生成的页面将出现在这里</p>
                            <p className="text-sm">使用左侧的指令或参考图开始创作您的第一页幻灯片</p>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-10">
                        <div className="flex items-center justify-between px-4">
                          <h2 className="font-bold text-2xl flex items-center gap-3">
                            <History size={24} className="text-black/20" /> 最近生成
                          </h2>
                        </div>
                        
                        <div className="space-y-10">
                          {singleSlides.map((slide) => (
                            <motion.div 
                              key={slide.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-white p-10 rounded-[48px] shadow-sm border border-black/5 space-y-8 group/card"
                            >
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <h3 className="font-bold text-xl">{slide.title}</h3>
                                  <p className="text-xs text-black/20">{new Date(slide.timestamp).toLocaleString()}</p>
                                </div>
                                <button 
                                  onClick={() => deleteSlide(slide.id)}
                                  className="p-3 hover:bg-red-50 text-red-400 rounded-2xl transition-colors opacity-0 group-hover/card:opacity-100"
                                >
                                  <Trash2 size={20} />
                                </button>
                              </div>
                              <p className="text-black/60 leading-relaxed text-base">{slide.description}</p>
                              
                              <div className="rounded-3xl overflow-hidden border border-black/5 shadow-inner">
                                <SlidePreview 
                                  slide={slide} 
                                  shadowIntensity={shadowIntensity} 
                                  cornerRadius={cornerRadius} 
                                  backgroundColor={colors[0]}
                                />
                              </div>

                              <div className="flex gap-3 justify-end pt-4">
                                <button 
                                  onClick={() => remixSlide(slide)}
                                  disabled={!!remixingSlideId || isGenerating}
                                  className="flex items-center gap-2 px-6 py-3 bg-black/5 text-black/60 rounded-2xl font-bold text-sm hover:bg-black/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {remixingSlideId === slide.id ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                                  重混布局
                                </button>
                                <button 
                                  onClick={() => generateSlide()}
                                  disabled={!!remixingSlideId || isGenerating}
                                  className="flex items-center gap-2 px-6 py-3 bg-black/5 text-black/60 rounded-2xl font-bold text-sm hover:bg-black/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />}
                                  重新绘制
                                </button>
                                <button 
                                  onClick={async () => {
                                    try {
                                      await exportToPptx({ ...activeProject, slides: [slide] }, colors[0], cornerRadius);
                                    } catch (err) {
                                      showToast("导出单页 PPTX 失败", "error");
                                      console.error(err);
                                    }
                                  }}
                                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/10"
                                >
                                  <Download size={18} />
                                  导出此页
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Right Panel: Design Style */}
      <motion.aside
        initial={false}
        animate={{ width: designPanelOpen ? 360 : 0, opacity: designPanelOpen ? 1 : 0 }}
        className="bg-white border-l border-black/5 flex flex-col shrink-0 overflow-hidden"
      >
        <div className="p-6 border-b border-black/5 flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Palette size={20} className="text-emerald-600" /> 设计风格
          </h2>
          <button onClick={() => setDesignPanelOpen(false)} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
          {/* Template Reference */}
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-black/40">参考模板图</label>
            <div 
              className={cn(
                "relative h-40 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 overflow-hidden",
                templateImage ? "border-emerald-500 bg-emerald-50/30" : "border-black/5 hover:border-emerald-200 hover:bg-emerald-50/30"
              )}
            >
              {templateImage ? (
                <>
                  <img src={templateImage} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[2px]" referrerPolicy="no-referrer" />
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-emerald-600">
                      {isAnalyzingTemplate ? <Loader2 className="animate-spin" /> : <Check size={24} />}
                    </div>
                    <span className="text-xs font-bold text-emerald-700">
                      {isAnalyzingTemplate ? "正在提取风格..." : "风格已提取"}
                    </span>
                    <button 
                      onClick={() => {
                        setTemplateImage(null);
                        // If template is removed and doc colors exist, revert to doc colors
                        if (docColors) {
                          setColors(docColors);
                        }
                      }}
                      className="mt-2 px-3 py-1 bg-white/80 backdrop-blur-sm text-[10px] font-bold rounded-full hover:bg-white transition-all"
                    >
                      移除并重新上传
                    </button>
                  </div>
                </>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center text-black/20">
                    <ImageIcon size={24} />
                  </div>
                  <span className="text-xs font-bold text-black/40">上传参考图自动提取风格</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleTemplateUpload} />
                </label>
              )}
            </div>
          </div>

          {/* Style Guide Document */}
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-black/40">风格简述文档</label>
            <div 
              className={cn(
                "relative p-4 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 overflow-hidden",
                styleGuideText ? "border-emerald-500 bg-emerald-50/30" : "border-black/5 hover:border-emerald-200 hover:bg-emerald-50/30"
              )}
            >
              {styleGuideText ? (
                <div className="flex flex-col items-center gap-2 w-full">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                    {isAnalyzingDoc ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-emerald-700">
                      {isAnalyzingDoc ? "正在分析文档..." : "文档已加载"}
                    </p>
                    <p className="text-[9px] text-emerald-600/60 line-clamp-1 px-4">{styleGuideText.substring(0, 50)}...</p>
                  </div>
                  <button 
                    onClick={() => {
                      setStyleGuideText("");
                      setDocColors(null);
                    }}
                    disabled={isAnalyzingDoc}
                    className="mt-1 px-3 py-1 bg-white text-[10px] font-bold rounded-full shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                  >
                    移除
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2 py-4">
                  <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center text-black/20">
                    <FileUp size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-black/40">上传风格简述 (DOCX/PDF/TXT)</span>
                  <input type="file" className="hidden" accept=".docx,.pdf,.txt,.md" onChange={handleStyleGuideUpload} />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-black/40">形状与阴影</label>
            <div className="space-y-4 bg-black/5 p-4 rounded-2xl">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-black/40">
                  <span>圆角程度</span>
                  <span>{cornerRadius}px</span>
                </div>
                <input 
                  type="range" min="0" max="40" value={cornerRadius} 
                  onChange={(e) => setCornerRadius(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-black/40">阴影强度</span>
                <div className="flex gap-2">
                  {(['none', 'subtle', 'medium', 'high'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setShadowIntensity(level)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                        shadowIntensity === level ? "bg-emerald-500 text-white shadow-sm" : "bg-white text-black/40 hover:bg-black/5"
                      )}
                    >
                      {level === 'none' ? '无' : level === 'subtle' ? '微弱' : level === 'medium' ? '中等' : '强烈'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-black/40">布局网格</label>
            <div className="space-y-4 bg-black/5 p-4 rounded-2xl">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-black/40">
                  <span>安全边距</span>
                  <span>{safeMargin}px</span>
                </div>
                <input 
                  type="range" min="0" max="100" value={safeMargin} 
                  onChange={(e) => setSafeMargin(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-black/40">排版字号</label>
            <div className="space-y-4 bg-black/5 p-4 rounded-2xl">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-black/40">
                  <span>标题字号</span>
                  <span>{titleFontSize}pt</span>
                </div>
                <input 
                  type="range" min="24" max="120" value={titleFontSize} 
                  onChange={(e) => setTitleFontSize(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-black/40">
                  <span>副标题字号</span>
                  <span>{subtitleFontSize}pt</span>
                </div>
                <input 
                  type="range" min="16" max="64" value={subtitleFontSize} 
                  onChange={(e) => setSubtitleFontSize(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-black/40">
                  <span>正文字号</span>
                  <span>{bodyFontSize}pt</span>
                </div>
                <input 
                  type="range" min="10" max="32" value={bodyFontSize} 
                  onChange={(e) => setBodyFontSize(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-black/40">品牌标识 (Branding)</label>
            <div className="space-y-4 bg-black/5 p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-black/40">显示页码</span>
                <button 
                  onClick={() => setShowPageNumber(!showPageNumber)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-all relative",
                    showPageNumber ? "bg-emerald-500" : "bg-black/10"
                  )}
                >
                  <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", showPageNumber ? "left-6" : "left-1")} />
                </button>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-black/40">页脚文本</span>
                <input 
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="例如：© 2024 SlideGen AI"
                  className="w-full bg-white border-none rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Preset Styles */}
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-black/40">风格预设</label>
            <div className="grid grid-cols-1 gap-3">
              {allStyles.map(style => (
                <div
                  key={style.id}
                  onClick={() => applyPreset(style)}
                  className="p-4 rounded-2xl border border-black/5 hover:border-emerald-200 hover:bg-emerald-50 transition-all text-left group relative cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">{style.name}</span>
                    <div className="flex gap-1">
                      {style.colors && style.colors.map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-black/40 line-clamp-1">{style.style}</p>
                  {style.isCustom && (
                    <button 
                      onClick={(e) => deleteCustomStyle(style.id, e)}
                      className="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Custom Config */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-black/40">整体风格</label>
              <input 
                value={styleDescription}
                onChange={(e) => setStyleDescription(e.target.value)}
                className="w-full bg-black/5 border-none rounded-2xl p-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all"
                placeholder="例如：极简主义..."
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {STYLE_KEYWORDS.map(kw => (
                  <button key={kw} onClick={() => setStyleDescription(prev => prev ? `${prev}, ${kw}` : kw)} className="px-2 py-1 bg-black/5 rounded-full text-[10px] font-medium text-black/40 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">{kw}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-black/40">样式要求</label>
              <textarea 
                value={styleRequirements}
                onChange={(e) => setStyleRequirements(e.target.value)}
                className="w-full h-24 bg-black/5 border-none rounded-2xl p-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all resize-none"
                placeholder="例如：大圆角..."
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {REQ_KEYWORDS.map(kw => (
                  <button key={kw} onClick={() => setStyleRequirements(prev => prev ? `${prev}, ${kw}` : kw)} className="px-2 py-1 bg-black/5 rounded-full text-[10px] font-medium text-black/40 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">{kw}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-black/40">背景及贴图要求</label>
              <textarea 
                value={imageRequirements}
                onChange={(e) => setImageRequirements(e.target.value)}
                className="w-full h-24 bg-black/5 border-none rounded-2xl p-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all resize-none"
                placeholder="例如：使用抽象几何背景，贴图采用写实风格..."
              />
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-black/40">配色方案</label>
              <div className="grid grid-cols-4 gap-3">
                {colors.map((c, i) => (
                  <div key={i} className="relative group flex flex-col items-center gap-1.5">
                    <div className="w-full h-10 rounded-xl border border-black/5 shadow-inner" style={{ backgroundColor: c }} />
                    <span className="text-[8px] font-bold text-black/30 uppercase tracking-tighter">
                      {["背景", "主色", "辅助", "文字"][i]}
                    </span>
                    <input 
                      type="color" 
                      value={c} 
                      onChange={(e) => {
                        const next = [...colors];
                        next[i] = e.target.value;
                        setColors(next);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-black/40">字体选择</label>
              <div className="grid grid-cols-2 gap-2">
                {FONTS.map(font => (
                  <button
                    key={font.family}
                    onClick={() => setSelectedFont(font.family)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      selectedFont === font.family 
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm" 
                        : "border-black/5 hover:bg-black/5 text-black/60"
                    )}
                    style={{ fontFamily: font.family }}
                  >
                    <div className="text-sm font-bold truncate">{font.name}</div>
                    <div className="text-[10px] opacity-60 uppercase tracking-tighter">{font.category}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <AnimatePresence mode="wait">
                {isSavingStyle ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="space-y-3 p-4 bg-emerald-50 rounded-2xl"
                  >
                    <input 
                      autoFocus
                      value={newStyleName}
                      onChange={(e) => setNewStyleName(e.target.value)}
                      placeholder="风格名称..."
                      className="w-full bg-white border-none rounded-xl p-2 text-sm outline-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveCustomStyle} className="flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg">保存</button>
                      <button onClick={() => setIsSavingStyle(false)} className="flex-1 py-2 bg-black/5 text-black/40 text-xs font-bold rounded-lg">取消</button>
                    </div>
                  </motion.div>
                ) : (
                  <button 
                    onClick={() => setIsSavingStyle(true)}
                    className="w-full py-4 bg-black/5 hover:bg-emerald-50 text-black/60 hover:text-emerald-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Save size={18} /> 保存当前风格
                  </button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowSettings(false); setSelectedVersion(null); }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl p-10 flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between mb-8 shrink-0">
                <div className="flex items-center gap-4">
                  {selectedVersion && (
                    <button 
                      onClick={() => setSelectedVersion(null)}
                      className="p-2 hover:bg-black/5 rounded-xl transition-colors text-black/40"
                    >
                      <ChevronLeft size={24} />
                    </button>
                  )}
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold">
                      {selectedVersion ? `v${selectedVersion} 详情` : "设置与更新"}
                    </h3>
                    <p className="text-xs text-black/40 font-medium">
                      {selectedVersion ? CHANGELOG.find(v => v.version === selectedVersion)?.title : `当前版本: v${CHANGELOG[0].version}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setShowSettings(false); setSelectedVersion(null); }} className="p-2 hover:bg-black/5 rounded-xl transition-colors"><X size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
                <AnimatePresence mode="wait">
                  {selectedVersion ? (
                    <motion.div
                      key="version-detail"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="markdown-body prose prose-sm max-w-none"
                    >
                      <Markdown>
                        {CHANGELOG.find(v => v.version === selectedVersion)?.details || ""}
                      </Markdown>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="settings-main"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-8"
                    >
                      <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-black/40">AI 模型配置</label>
                        <div className="grid grid-cols-1 gap-2">
                          {MODELS.map(m => (
                            <button 
                              key={m.id} 
                              onClick={() => setSelectedModel(m.id)}
                              className={cn("p-4 rounded-2xl border text-left transition-all", selectedModel === m.id ? "bg-emerald-50 border-emerald-200" : "bg-white border-black/5")}
                            >
                              <p className="font-bold text-sm">{m.name}</p>
                              <p className="text-[10px] text-black/40">{m.description}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-black/40">数据管理</label>
                        <div className="p-4 rounded-2xl border border-black/5 bg-black/[0.02] space-y-3">
                          <p className="text-xs text-black/60 leading-relaxed">
                            如果您在升级前有本地保存的项目，但现在未显示，可以尝试手动深度扫描并合并。
                          </p>
                          <button 
                            onClick={forceMigrateLocalData}
                            className="w-full py-3 bg-white border border-black/10 rounded-xl text-xs font-bold hover:bg-black/5 transition-colors flex items-center justify-center gap-2"
                          >
                            <DatabaseIcon size={14} /> 深度扫描并合并本地数据
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-black/40">版本更新日志 (点击查看详情)</label>
                        <div className="space-y-6">
                          {CHANGELOG.map((log, idx) => (
                            <div 
                              key={log.version} 
                              onClick={() => setSelectedVersion(log.version)}
                              className="relative pl-6 border-l border-black/5 cursor-pointer group hover:border-emerald-500 transition-colors"
                            >
                              <div className={cn(
                                "absolute -left-[5px] top-1 w-2 h-2 rounded-full transition-all",
                                idx === 0 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-black/10 group-hover:bg-emerald-300"
                              )} />
                              <div className="flex items-baseline justify-between mb-2">
                                <div className="flex items-baseline gap-3">
                                  <span className="font-bold text-sm group-hover:text-emerald-600 transition-colors">v{log.version}</span>
                                  <span className="text-[10px] text-black/40 font-medium">{log.title}</span>
                                </div>
                                <ChevronRight size={14} className="text-black/20 group-hover:text-emerald-500 transition-all" />
                              </div>
                              <ul className="space-y-1.5">
                                {log.items.map((item, i) => (
                                  <li key={i} className="text-xs text-black/60 leading-relaxed flex gap-2">
                                    <span className="text-emerald-500 mt-1 shrink-0">•</span>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-6 border-t border-black/5 mt-8 shrink-0">
                <button onClick={handleLogout} className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-100 transition-all">退出登录</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Layout Selection Modal */}
      <AnimatePresence>
        {layoutSelectionItem && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLayoutSelectionItem(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-black/5 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-2xl font-bold">更换布局建议</h3>
                  <p className="text-sm text-black/40 mt-1">基于当前页面内容为您推荐的最佳排版方案</p>
                </div>
                <button onClick={() => setLayoutSelectionItem(null)} className="p-2 hover:bg-black/5 rounded-xl transition-colors"><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                {isSuggestingLayouts ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin text-emerald-600" size={40} />
                    <p className="text-sm font-bold text-black/40 animate-pulse">正在深度分析内容并生成布局建议...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {layoutSuggestions.map((suggestion) => {
                      const preset = LAYOUT_PRESETS.find(p => p.id === suggestion.id);
                      if (!preset) return null;
                      return (
                        <button
                          key={suggestion.id}
                          onClick={() => {
                            if (!activeProject || !activeProjectId) return;
                            const newOutline = activeProject.outline?.map(o => 
                              o.id === layoutSelectionItem.id ? { ...o, suggestedLayout: suggestion.id, layoutDescription: suggestion.reason } : o
                            );
                            const updatedProjects = projects.map(p => p.id === activeProjectId ? { ...p, outline: newOutline } : p);
                            syncData(updatedProjects);
                            setLayoutSelectionItem(null);
                            // Automatically trigger re-generation if it was already generated
                            if (layoutSelectionItem.isGenerated) {
                              const updatedItem = newOutline?.find(o => o.id === layoutSelectionItem.id);
                              if (updatedItem) generateSlide(updatedItem);
                            }
                          }}
                          className="group/layout p-6 rounded-[32px] border border-black/5 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-left space-y-4"
                        >
                          <WireframeIcon type={preset.iconType} className="group-hover/layout:scale-105 transition-transform" />
                          <div>
                            <p className="font-bold text-sm group-hover:text-emerald-600 transition-colors">{preset.name}</p>
                            <p className="text-[10px] text-black/40 mt-1 leading-relaxed italic line-clamp-3">“{suggestion.reason}”</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="p-8 bg-black/[0.02] border-t border-black/5 flex items-center justify-between shrink-0">
                <p className="text-[10px] text-black/40 font-bold uppercase tracking-widest">选择一个布局后将自动重新生成该页幻灯片</p>
                <button 
                  onClick={() => suggestLayouts(layoutSelectionItem)}
                  className="px-6 py-2 bg-white border border-black/10 rounded-xl text-xs font-bold hover:bg-black/5 transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={14} /> 重新换一批建议
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200]"
          >
            <div className={cn(
              "px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 font-bold text-sm backdrop-blur-md",
              toast.type === 'error' ? "bg-red-50/90 border-red-100 text-red-600" : 
              toast.type === 'success' ? "bg-emerald-50/90 border-emerald-100 text-emerald-600" :
              "bg-white/90 border-black/5 text-black/60"
            )}>
              {toast.type === 'error' && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              {toast.type === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
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
import * as pdfjsLib from "pdfjs-dist";

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

import { 
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
  STYLE_KEYWORDS, 
  REQ_KEYWORDS, 
  FONTS, 
  CHANGELOG,
  SCENARIOS
} from "./constants";

import { cn, blobToBase64 } from "./utils";
import { exportToPptx } from "./services/pptxService";
import { SlidePreview } from "./components/SlidePreview";
import { WireframeIcon } from "./components/WireframeIcon";
import { useProjects, _resetSessionCache } from "./hooks/useProjects";
import { useDesign } from "./hooks/useDesign";
import { useAI } from "./hooks/useAI";

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
  const [copied, setCopied] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [designPanelOpen, setDesignPanelOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scriptFileInputRef = useRef<HTMLInputElement>(null);

  // --- Helpers ---

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // customStyles ref — shared between useProjects (syncData) and useDesign
  const customStylesRef = useRef<PresetStyle[]>([]);

  // --- Hooks ---

  const {
    projects,
    setProjects,
    activeProjectId,
    setActiveProjectId,
    activeProject,
    isCreatingProject,
    setIsCreatingProject,
    newProjectName,
    setNewProjectName,
    loadUserData,
    syncData,
    createProject,
    deleteProject,
    deleteSlide,
    forceMigrateLocalData,
  } = useProjects(userApiKey, customStylesRef);

  const {
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
  } = useDesign(userApiKey, syncData);

  // Keep customStylesRef in sync so syncData always has latest styles
  customStylesRef.current = customStyles;

  const designConfig = getDesignConfig();

  const {
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
  } = useAI(userApiKey, selectedModel, designConfig, activeProject, syncData, setProjects, showToast);

  // --- Persistence ---

  useEffect(() => {
    const savedKey = localStorage.getItem("slidegen_user_api_key");
    if (savedKey) {
      setUserApiKey(savedKey);
      setIsLoggedIn(true);
      handleLoadUserData(savedKey, true);
    }
  }, []);

  useEffect(() => {
    if (activeProject) {
      setScriptInput(activeProject.script || "");
    }
  }, [activeProjectId]);

  const handleLoadUserData = async (apiKey: string, silent = false) => {
    try {
      const result = await loadUserData(apiKey);
      if (result && result.customStyles) {
        setCustomStyles(result.customStyles);
        customStylesRef.current = result.customStyles;
      }
    } catch (err) {
      if (silent) {
        showToast("数据加载失败，请检查网络", "error");
      } else {
        throw err;
      }
    }
  };

  const handleLogin = async () => {
    if (!userApiKey.trim()) return;

    setIsLoggingIn(true);
    try {
      await handleLoadUserData(userApiKey.trim());
      localStorage.setItem("slidegen_user_api_key", userApiKey.trim());
      setIsLoggedIn(true);
      showToast("登录成功，欢迎回来！", "success");
    } catch (err: unknown) {
      console.error("Login failed:", err);
      showToast("API Key 验证失败，请检查是否输入正确或是否有额度", "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("slidegen_user_api_key");
    _resetSessionCache();
    setIsLoggedIn(false);
    setUserApiKey("");
    setProjects([]);
    setActiveProjectId(null);
    setCustomStyles([]);
    customStylesRef.current = [];
  };

  // --- Render ---

  // --- Render ---

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white p-10 rounded-[40px] shadow-2xl space-y-8 text-center"
        >
          <div className="w-20 h-20 rounded-3xl overflow-hidden mx-auto shadow-xl shadow-emerald-600/20">
            <img src="/favicon.png" alt="CEREBRO" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">CEREBRO</h1>
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
        <div className="p-6 border-b border-black/5 flex items-center gap-3">
          <img src="/favicon.png" alt="CEREBRO" className="w-9 h-9 object-cover rounded-lg" />
          <span style={{ fontFamily: "'Phosphate Inline', 'Phosphate', Impact, sans-serif", letterSpacing: "0.05em" }} className="text-2xl font-black italic text-emerald-600">CEREBRO</span>
        </div>
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
                  placeholder="例如：© 2024 CerebroSlide"
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
                  <button key={kw} onClick={() => setStyleDescription(styleDescription ? `${styleDescription}, ${kw}` : kw)} className="px-2 py-1 bg-black/5 rounded-full text-[10px] font-medium text-black/40 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">{kw}</button>
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
                  <button key={kw} onClick={() => setStyleRequirements(styleRequirements ? `${styleRequirements}, ${kw}` : kw)} className="px-2 py-1 bg-black/5 rounded-full text-[10px] font-medium text-black/40 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">{kw}</button>
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';

export interface SlideElement {
  type: 'text' | 'shape' | 'image';
  x: number; // 0-100 percentage of slide width
  y: number; // 0-100 percentage of slide height
  w: number; // 0-100 percentage of slide width
  h: number; // 0-100 percentage of slide height
  content?: string;
  shapeType?: 'RECTANGLE' | 'CIRCLE' | 'TRIANGLE' | 'LINE';
  style?: {
    fontSize?: number;
    color?: string;
    fill?: string;
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    fontFamily?: string;
    opacity?: number;
    shadow?: boolean;
    cornerRadius?: number;
  };
  imageIndex?: number; // Index in the generated images array
}

export interface Slide {
  id: string;
  elements: SlideElement[];
  title: string;
  description: string;
  timestamp: number;
  images?: string[]; // Base64 images
  pageStyle?: string; // Specific style for this page
  keyData?: { label: string; value: string; unit?: string }[];
  quotes?: { text: string; author?: string }[];
  highlights?: string[];
}

export interface OutlineItem {
  id: string;
  title: string;
  subtitle: string;
  body: string; // This will be the "real" content after refinement
  metaDescription?: string; // The initial creative/meta description
  pageStyle?: string; // Specific style for this page
  decorativeIcon?: string; // An emoji or icon name
  suggestedLayout: string; // e.g., 'split-left', 'center-hero', 'grid-3'
  layoutDescription: string;
  isGenerated: boolean;
  slideId?: string; // Link to the generated slide
  isRefining?: boolean;
  isRefined?: boolean;
  keyData?: { label: string; value: string; unit?: string }[];
  quotes?: { text: string; author?: string }[];
  highlights?: string[];
}

export type ScenarioId = 'general' | 'academic' | 'business' | 'creative' | 'ted';

export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  tone: string;
  logic: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  scenarioId?: ScenarioId;
  stylePresetId?: string;
  slides: Slide[];
  script?: string;
  sourceText?: string;
  outline?: OutlineItem[];
}

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  iconType: 'split-left' | 'split-right' | 'center-hero' | 'grid-3' | 'top-bottom' | 'full-image' | 'grid-2' | 'quote' | 'feature-list';
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
}

export interface PresetStyle {
  id: string;
  name: string;
  style: string;
  requirements: string;
  colors: string[];
  fontFamily?: string;
  isCustom?: boolean;
  isBuiltIn?: boolean;
  referenceImage?: string;
  cornerRadius?: number; // 0 to 40
  shadowIntensity?: 'none' | 'subtle' | 'medium' | 'high';
  safeMargin?: number; // 0 to 100
  showPageNumber?: boolean;
  footerText?: string;
  titleFontSize?: number;
  subtitleFontSize?: number;
  bodyFontSize?: number;
  imageRequirements?: string;
}

export interface FontOption {
  name: string;
  family: string;
  category: 'sans' | 'serif' | 'mono' | 'display';
}

export interface DesignConfig {
  colors: string[];
  selectedFont: string;
  styleDescription: string;
  styleRequirements: string;
  imageRequirements: string;
  cornerRadius: number;
  shadowIntensity: 'none' | 'subtle' | 'medium' | 'high';
  safeMargin: number;
  showPageNumber: boolean;
  footerText: string;
  titleFontSize: number;
  subtitleFontSize: number;
  bodyFontSize: number;
  styleGuideText: string;
}

export interface UseProjectsReturn {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  activeProject: Project | null;
  isCreatingProject: boolean;
  setIsCreatingProject: (v: boolean) => void;
  newProjectName: string;
  setNewProjectName: (v: string) => void;

  loadUserData: (apiKey: string) => Promise<{ customStyles: PresetStyle[] } | void>;
  syncData: (projects?: Project[], styles?: PresetStyle[]) => Promise<void>;
  createProject: () => void;
  deleteProject: (id: string, e: React.MouseEvent) => void;
  deleteSlide: (slideId: string) => void;
  forceMigrateLocalData: () => Promise<void>;
}

export interface UseDesignReturn {
  customStyles: PresetStyle[];
  setCustomStyles: React.Dispatch<React.SetStateAction<PresetStyle[]>>;
  allStyles: PresetStyle[];
  colors: string[];
  setColors: React.Dispatch<React.SetStateAction<string[]>>;
  selectedFont: string;
  setSelectedFont: (v: string) => void;
  styleDescription: string;
  setStyleDescription: (v: string) => void;
  styleRequirements: string;
  setStyleRequirements: (v: string) => void;
  imageRequirements: string;
  setImageRequirements: (v: string) => void;
  templateImage: string | null;
  setTemplateImage: (v: string | null) => void;
  styleGuideText: string;
  setStyleGuideText: (v: string) => void;
  docColors: string[] | null;
  cornerRadius: number;
  setCornerRadius: (v: number) => void;
  shadowIntensity: 'none' | 'subtle' | 'medium' | 'high';
  setShadowIntensity: (v: 'none' | 'subtle' | 'medium' | 'high') => void;
  safeMargin: number;
  setSafeMargin: (v: number) => void;
  showPageNumber: boolean;
  setShowPageNumber: (v: boolean) => void;
  footerText: string;
  setFooterText: (v: string) => void;
  titleFontSize: number;
  setTitleFontSize: (v: number) => void;
  subtitleFontSize: number;
  setSubtitleFontSize: (v: number) => void;
  bodyFontSize: number;
  setBodyFontSize: (v: number) => void;
  isAnalyzingTemplate: boolean;
  isAnalyzingDoc: boolean;
  isSavingStyle: boolean;
  setIsSavingStyle: (v: boolean) => void;
  newStyleName: string;
  setNewStyleName: (v: string) => void;

  saveCustomStyle: () => void;
  deleteCustomStyle: (id: string, e: React.MouseEvent) => void;
  applyPreset: (preset: PresetStyle) => void;
  analyzeTemplateImage: (base64: string) => Promise<void>;
  handleTemplateUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleStyleGuideUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getDesignConfig: () => DesignConfig;
  editingStyleId: string | null;
  startEditStyle: (style: PresetStyle) => void;
  cancelEditStyle: () => void;
}

export interface UseAIReturn {
  inputText: string;
  setInputText: (v: string) => void;
  isRecording: boolean;
  audioBlob: Blob | null;
  selectedLayoutId: string;
  setSelectedLayoutId: (v: string) => void;
  selectedImage: string | null;
  setSelectedImage: (v: string | null) => void;
  isGenerating: boolean;
  isGeneratingImages: boolean;
  remixingSlideId: string | null;
  imageGenProgress: { current: number; total: number };
  error: string | null;
  visualizingItemId: string | null;
  isScriptMode: boolean;
  setIsScriptMode: (v: boolean) => void;
  scriptInput: string;
  setScriptInput: (v: string) => void;
  selectedScenarioId: ScenarioId;
  setSelectedScenarioId: (v: ScenarioId) => void;
  additionalPrompt: string;
  setAdditionalPrompt: (v: string) => void;
  isGeneratingOutline: boolean;
  isSuggestingLayouts: boolean;
  layoutSelectionItem: OutlineItem | null;
  setLayoutSelectionItem: (v: OutlineItem | null) => void;
  layoutSuggestions: { id: string; reason: string }[];
  scriptFiles: { name: string; content: string }[];

  startRecording: () => Promise<void>;
  stopRecording: () => void;
  generateSlide: (item?: OutlineItem) => Promise<void>;
  generateOutline: () => Promise<void>;
  refineOutlineItem: (itemId: string) => Promise<void>;
  refineAllOutlineItems: () => Promise<void>;
  suggestLayouts: (item: OutlineItem) => Promise<void>;
  remixSlide: (slide: Slide) => Promise<void>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleScriptFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeScriptFile: (index: number) => void;
  clearInputs: () => void;
}

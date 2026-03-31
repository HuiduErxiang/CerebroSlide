/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

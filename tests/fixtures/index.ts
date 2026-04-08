import type { SlideElement, Slide, Project, PresetStyle, DesignConfig } from '../../src/types';

export function createSlideElement(overrides: Partial<SlideElement> = {}): SlideElement {
  return {
    type: 'text',
    x: 10,
    y: 10,
    w: 80,
    h: 20,
    content: 'Test content',
    style: {
      fontSize: 18,
      color: '#FFFFFF',
      bold: false,
      italic: false,
      align: 'left',
    },
    ...overrides,
  };
}

export function createSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    id: `slide-${Date.now()}`,
    title: 'Test Slide',
    description: 'A test slide',
    timestamp: Date.now(),
    elements: [createSlideElement()],
    ...overrides,
  };
}

export function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: `project-${Date.now()}`,
    name: 'Test Project',
    createdAt: Date.now(),
    slides: [],
    outline: [],
    script: '',
    ...overrides,
  };
}

export function createPresetStyle(overrides: Partial<PresetStyle> = {}): PresetStyle {
  return {
    id: `style-${Date.now()}`,
    name: 'Test Style',
    style: 'modern',
    requirements: 'Clean and minimal',
    colors: ['#1A1A2E', '#16213E', '#0F3460', '#E94560'],
    fontFamily: 'Inter',
    cornerRadius: 12,
    shadowIntensity: 'subtle',
    safeMargin: 5,
    showPageNumber: false,
    footerText: '',
    titleFontSize: 40,
    subtitleFontSize: 24,
    bodyFontSize: 18,
    ...overrides,
  };
}

export function createDesignConfig(overrides: Partial<DesignConfig> = {}): DesignConfig {
  return {
    colors: ['#1A1A2E', '#16213E', '#0F3460', '#E94560'],
    selectedFont: 'Inter',
    styleDescription: 'modern minimalist',
    styleRequirements: 'Clean layouts with bold typography',
    imageRequirements: 'Abstract geometric backgrounds',
    cornerRadius: 12,
    shadowIntensity: 'subtle',
    safeMargin: 5,
    showPageNumber: false,
    footerText: '',
    titleFontSize: 40,
    subtitleFontSize: 24,
    bodyFontSize: 18,
    styleGuideText: '',
    ...overrides,
  };
}

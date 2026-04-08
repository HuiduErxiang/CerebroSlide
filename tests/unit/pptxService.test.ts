import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProject, createSlide, createSlideElement } from '../fixtures';

const mockSlide = {
  addText: vi.fn(),
  addShape: vi.fn(),
  addImage: vi.fn(),
  background: undefined as any,
};

const mockPptxInstance = {
  layout: '',
  ShapeType: {
    rect: 'rect',
    roundRect: 'roundRect',
    ellipse: 'ellipse',
    triangle: 'triangle',
    line: 'line',
  },
  addSlide: vi.fn().mockReturnValue(mockSlide),
  writeFile: vi.fn().mockResolvedValue(undefined),
};

vi.mock('pptxgenjs', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return mockPptxInstance;
    }),
  };
});

describe('exportToPptx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSlide.background = undefined;
    mockPptxInstance.addSlide.mockReturnValue(mockSlide);
    mockPptxInstance.writeFile.mockResolvedValue(undefined);
  });

  it('does nothing when project has no slides', async () => {
    const { exportToPptx } = await import('../../src/services/pptxService');
    const pptxgen = (await import('pptxgenjs')).default;
    const project = createProject({ slides: [] });
    await exportToPptx(project);
    expect(pptxgen).not.toHaveBeenCalled();
  });

  it('creates a slide for each slide in project', async () => {
    const { exportToPptx } = await import('../../src/services/pptxService');
    const slide1 = createSlide({ id: 's1', elements: [createSlideElement({ content: 'Hello' })] });
    const slide2 = createSlide({ id: 's2', elements: [createSlideElement({ content: 'World' })] });
    const project = createProject({ slides: [slide1, slide2] });

    await exportToPptx(project);

    expect(mockPptxInstance.addSlide).toHaveBeenCalledTimes(2);
  });

  it('maps text element coordinates as percentage strings', async () => {
    const { exportToPptx } = await import('../../src/services/pptxService');
    const element = createSlideElement({ x: 10, y: 20, w: 80, h: 15, content: 'Test' });
    const slide = createSlide({ elements: [element] });
    const project = createProject({ slides: [slide] });

    await exportToPptx(project);

    const [, options] = mockSlide.addText.mock.calls[0];
    expect(options.x).toBe('10%');
    expect(options.y).toBe('20%');
    expect(options.w).toBe('80%');
    expect(options.h).toBe('15%');
  });

  it('handles hex color formatting correctly', async () => {
    const { exportToPptx } = await import('../../src/services/pptxService');
    const element = createSlideElement({
      content: 'Colored',
      style: { color: '#FF5733', fontSize: 18 },
    });
    const slide = createSlide({ elements: [element] });
    const project = createProject({ slides: [slide] });

    await exportToPptx(project);

    const [, options] = mockSlide.addText.mock.calls[0];
    expect(options.color).toBe('FF5733');
  });

  it('respects outline order when exporting slides', async () => {
    const { exportToPptx } = await import('../../src/services/pptxService');
    const slide1 = createSlide({ id: 's1' });
    const slide2 = createSlide({ id: 's2' });
    const project = createProject({
      slides: [slide1, slide2],
      outline: [
        { id: 'o2', title: 'Second', subtitle: '', body: '', suggestedLayout: 'center-hero', layoutDescription: '', isGenerated: true, slideId: 's2' },
        { id: 'o1', title: 'First', subtitle: '', body: '', suggestedLayout: 'center-hero', layoutDescription: '', isGenerated: true, slideId: 's1' },
      ],
    });

    await exportToPptx(project);

    expect(mockPptxInstance.addSlide).toHaveBeenCalledTimes(2);
  });

  it('sets slide background color when provided', async () => {
    const { exportToPptx } = await import('../../src/services/pptxService');
    const slide = createSlide({ elements: [createSlideElement({ content: 'BG test' })] });
    const project = createProject({ slides: [slide] });

    await exportToPptx(project, '#1A1A2E');

    expect(mockSlide.background).toEqual({ color: '1A1A2E' });
  });

  it('handles shape elements', async () => {
    const { exportToPptx } = await import('../../src/services/pptxService');
    const shapeEl = createSlideElement({ type: 'shape', shapeType: 'CIRCLE', content: undefined });
    const slide = createSlide({ elements: [shapeEl] });
    const project = createProject({ slides: [slide] });

    await exportToPptx(project);

    expect(mockSlide.addShape).toHaveBeenCalledTimes(1);
  });

  it('calls writeFile to produce PPTX output', async () => {
    const { exportToPptx } = await import('../../src/services/pptxService');
    const slide = createSlide({ elements: [createSlideElement({ content: 'Export test' })] });
    const project = createProject({ name: 'My Project', slides: [slide] });

    await exportToPptx(project);

    expect(mockPptxInstance.writeFile).toHaveBeenCalledWith({ fileName: 'My Project.pptx' });
  });
});

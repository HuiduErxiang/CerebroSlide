import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAI } from '../../src/hooks/useAI';
import { _resetSessionCache } from '../../src/hooks/useProjects';
import { createProject, createDesignConfig } from '../fixtures';
import type { Project } from '../../src/types';

vi.mock('@google/genai', () => ({
  Type: {
    OBJECT: 'object',
    ARRAY: 'array',
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
  },
  ThinkingLevel: {
    LOW: 'LOW',
  },
}));

vi.mock('mammoth', () => ({
  convertToHtml: vi.fn().mockResolvedValue({ value: '<p>test</p>' }),
  extractRawText: vi.fn().mockResolvedValue({ value: 'raw text' }),
}));

const makeSlideResponse = (overrides = {}) =>
  JSON.stringify({
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                title: 'Test Slide',
                description: 'A test slide description',
                elements: [
                  { type: 'text', x: 10, y: 10, w: 80, h: 20, content: 'Hello World' },
                ],
                ...overrides,
              }),
            },
          ],
        },
      },
    ],
  });

const makeOutlineResponse = (slides: Array<{ id: string; title: string }>) =>
  JSON.stringify({
    candidates: [
      {
        content: {
          parts: [
            {
              text: slides
                .map(
                  s => `[SLIDE]\nID: ${s.id}\nTITLE: ${s.title}\nSUBTITLE: A subtitle\nBODY: Body content\nLAYOUT: center-hero\nLAYOUT_DESC: Centered hero layout\n[END_SLIDE]`
                )
                .join('\n'),
            },
          ],
        },
      },
    ],
  });

const mockSessionResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({ sessionToken: 'mock-token', expiresAt: Date.now() + 3600_000 }),
});

const mockFetchResponse = (body: string, ok = true) => ({
  ok,
  status: ok ? 200 : 400,
  json: async () => JSON.parse(body),
});

const mockFetchWithSession = (aiResponseBody: string, ok = true) => {
  return (url: string) => {
    if (typeof url === 'string' && url.includes('/api/session')) {
      return Promise.resolve(mockSessionResponse());
    }
    return Promise.resolve(mockFetchResponse(aiResponseBody, ok));
  };
};

describe('useAI', () => {
  const mockFetch = vi.fn();
  const mockSyncData = vi.fn().mockResolvedValue(undefined);
  const mockSetProjects = vi.fn();
  const mockShowToast = vi.fn();
  const designConfig = createDesignConfig();

  const renderAIHook = (activeProject: Project | null = null) =>
    renderHook(() =>
      useAI(
        'test-api-key',
        'gemini-2.5-flash',
        designConfig,
        activeProject,
        mockSyncData,
        mockSetProjects,
        mockShowToast
      )
    );

  beforeEach(() => {
    vi.clearAllMocks();
    _resetSessionCache();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  describe('generateSlide', () => {
    it('sets error when no active project', async () => {
      const { result } = renderAIHook(null);

      await act(async () => {
        await result.current.generateSlide();
      });

      expect(result.current.error).toBe('请先创建一个项目。');
    });

    it('sets error when no input provided', async () => {
      const project = createProject({ id: 'p1' });
      const { result } = renderAIHook(project);

      await act(async () => {
        await result.current.generateSlide();
      });

      expect(result.current.error).toBe('请输入内容描述。');
    });

    it('calls /api/ai/generate-content and updates projects via setProjects', async () => {
      mockFetch.mockImplementation(mockFetchWithSession(makeSlideResponse()));

      const project = createProject({ id: 'p1', slides: [] });
      const { result } = renderAIHook(project);

      act(() => {
        result.current.setInputText('Generate a slide about React');
      });

      await act(async () => {
        await result.current.generateSlide();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/generate-content',
        expect.objectContaining({ method: 'POST' })
      );
      expect(mockSetProjects).toHaveBeenCalledTimes(1);
      expect(mockShowToast).toHaveBeenCalledWith('幻灯片生成成功！', 'success');
      expect(result.current.isGenerating).toBe(false);
    });

    it('shows error toast on API failure', async () => {
      mockFetch.mockImplementation(mockFetchWithSession(JSON.stringify({ error: 'API limit reached' }), false));

      const project = createProject({ id: 'p1', slides: [] });
      const { result } = renderAIHook(project);

      act(() => {
        result.current.setInputText('Some input');
      });

      await act(async () => {
        await result.current.generateSlide();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('API limit reached'),
        'error'
      );
      expect(result.current.isGenerating).toBe(false);
    });
  });

  describe('generateOutline', () => {
    it('does nothing when scriptInput is empty', async () => {
      const project = createProject({ id: 'p1' });
      const { result } = renderAIHook(project);

      await act(async () => {
        await result.current.generateOutline();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('parses [SLIDE]...[END_SLIDE] blocks into outline items', async () => {
      mockFetch.mockImplementation(
        mockFetchWithSession(
          makeOutlineResponse([
            { id: 'sl1', title: 'Introduction' },
            { id: 'sl2', title: 'Main Content' },
          ])
        )
      );

      const project = createProject({ id: 'p1' });
      const { result } = renderAIHook(project);

      act(() => {
        result.current.setScriptInput('This is a long script about React');
      });

      await act(async () => {
        await result.current.generateOutline();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/generate-content',
        expect.objectContaining({ method: 'POST' })
      );
      expect(mockSetProjects).toHaveBeenCalledTimes(1);

      const setterCall = mockSetProjects.mock.calls[0][0];
      const updatedProjects: Project[] = setterCall([project]);
      const updatedProject = updatedProjects.find(p => p.id === 'p1');
      expect(updatedProject?.outline).toHaveLength(2);
      expect(updatedProject?.outline?.[0].title).toBe('Introduction');
    });
  });

  describe('clearInputs', () => {
    it('resets inputText, audioBlob, and selectedImage', () => {
      const { result } = renderAIHook(null);

      act(() => {
        result.current.setInputText('some text');
        result.current.setSelectedImage('data:image/png;base64,xxx');
      });

      act(() => {
        result.current.clearInputs();
      });

      expect(result.current.inputText).toBe('');
      expect(result.current.audioBlob).toBeNull();
      expect(result.current.selectedImage).toBeNull();
    });
  });

  describe('_slideResponseSchema required fields (SC-002)', () => {
    it('sends responseSchema with style.required containing color and fontFamily', async () => {
      mockFetch.mockImplementation(mockFetchWithSession(makeSlideResponse()));

      const project = createProject({ id: 'p1', slides: [] });
      const { result } = renderAIHook(project);

      act(() => {
        result.current.setInputText('Test slide');
      });

      await act(async () => {
        await result.current.generateSlide();
      });

      const aiCall = mockFetch.mock.calls.find(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('/api/ai/generate-content')
      );
      expect(aiCall).toBeDefined();
      const body = JSON.parse((aiCall![1] as { body: string }).body);
      const schema = body.config?.responseSchema;
      expect(schema).toBeDefined();
      const styleSchema = schema?.properties?.elements?.items?.properties?.style;
      expect(styleSchema?.required).toContain('color');
      expect(styleSchema?.required).toContain('fontFamily');
    });
  });
});

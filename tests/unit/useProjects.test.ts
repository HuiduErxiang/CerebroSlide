import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjects, _resetSessionCache } from '../../src/hooks/useProjects';
import { createProject, createPresetStyle } from '../fixtures';
import { createRef } from 'react';
import type { PresetStyle } from '../../src/types';

const mockFetch = vi.fn();

vi.mock('../../src/services/dbService', () => ({
  saveToDB: vi.fn().mockResolvedValue(undefined),
  getFromDB: vi.fn().mockResolvedValue(undefined),
}));

const makeStylesRef = (styles: PresetStyle[] = []) => {
  const ref = createRef<PresetStyle[]>() as React.MutableRefObject<PresetStyle[]>;
  ref.current = styles;
  return ref;
};

const mockSessionResponse = () => ({
  ok: true,
  json: async () => ({ sessionToken: 'mock-session-token', expiresAt: Date.now() + 3600_000 }),
});

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSessionCache();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    globalThis.confirm = vi.fn().mockReturnValue(false) as unknown as typeof confirm;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadUserData', () => {
    it('loads projects from cloud and returns customStyles', async () => {
      const project = createProject({ id: 'p1' });
      const style = createPresetStyle({ id: 'st1' });
      mockFetch
        .mockResolvedValueOnce(mockSessionResponse())
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ projects: [project], customStyles: [style] }),
        });

      const { result } = renderHook(() => useProjects('test-api-key', makeStylesRef()));

      let returnVal: { customStyles: PresetStyle[] } | void;
      await act(async () => {
        returnVal = await result.current.loadUserData('test-api-key');
      });

      expect(result.current.projects).toHaveLength(1);
      expect(result.current.activeProjectId).toBe('p1');
      expect((returnVal as { customStyles: PresetStyle[] })?.customStyles).toHaveLength(1);
    });

    it('falls back to local data when cloud is empty', async () => {
      const { getFromDB } = await import('../../src/services/dbService');
      const localProject = createProject({ id: 'local-p1' });
      vi.mocked(getFromDB).mockResolvedValueOnce([localProject] as unknown as undefined);
      mockFetch
        .mockResolvedValueOnce(mockSessionResponse())
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ projects: [], customStyles: [] }),
        })
        .mockResolvedValueOnce(mockSessionResponse())
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      const { result } = renderHook(() => useProjects('test-api-key', makeStylesRef()));

      await act(async () => {
        await result.current.loadUserData('test-api-key');
      });

      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].id).toBe('local-p1');
    });

    it('throws when cloud request fails', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('session error'))
        .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

      const { result } = renderHook(() => useProjects('test-api-key', makeStylesRef()));

      await expect(
        result.current.loadUserData('test-api-key')
      ).rejects.toThrow();
    });
  });

  describe('createProject', () => {
    it('adds new project and syncs data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sessionToken: 'tok', expiresAt: Date.now() + 3600_000 }),
      });

      const { result } = renderHook(() => useProjects('test-api-key', makeStylesRef()));

      act(() => {
        result.current.setNewProjectName('My New Project');
      });

      await act(async () => {
        result.current.createProject();
      });

      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].name).toBe('My New Project');
      expect(result.current.activeProjectId).toBe(result.current.projects[0].id);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user-data',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('does nothing when project name is empty', async () => {
      const { result } = renderHook(() => useProjects('test-api-key', makeStylesRef()));

      act(() => {
        result.current.createProject();
      });

      expect(result.current.projects).toHaveLength(0);
    });
  });

  describe('deleteProject', () => {
    it('removes project and syncs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sessionToken: 'tok', expiresAt: Date.now() + 3600_000 }),
      });

      const project = createProject({ id: 'p-del' });
      const { result } = renderHook(() => useProjects('test-api-key', makeStylesRef()));

      act(() => {
        result.current.setProjects([project]);
        result.current.setActiveProjectId('p-del');
      });

      const fakeEvent = { stopPropagation: vi.fn() } as unknown as React.MouseEvent;

      await act(async () => {
        result.current.deleteProject('p-del', fakeEvent);
      });

      expect(result.current.projects).toHaveLength(0);
      expect(result.current.activeProjectId).toBeNull();
    });
  });

  describe('deleteSlide', () => {
    it('removes slide from active project and syncs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sessionToken: 'tok', expiresAt: Date.now() + 3600_000 }),
      });

      const { result } = renderHook(() => useProjects('test-api-key', makeStylesRef()));
      const project = createProject({
        id: 'proj1',
        slides: [
          { id: 'sl1', title: 'Slide 1', description: '', timestamp: 1, elements: [] },
          { id: 'sl2', title: 'Slide 2', description: '', timestamp: 2, elements: [] },
        ],
      });

      act(() => {
        result.current.setProjects([project]);
        result.current.setActiveProjectId('proj1');
      });

      await act(async () => {
        result.current.deleteSlide('sl1');
      });

      const updatedProject = result.current.projects.find(p => p.id === 'proj1');
      expect(updatedProject?.slides).toHaveLength(1);
      expect(updatedProject?.slides[0].id).toBe('sl2');
    });
  });

  describe('syncData', () => {
    it('posts to /api/user-data with session token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sessionToken: 'mock-tok', expiresAt: Date.now() + 3600_000 }),
      });

      const { saveToDB } = await import('../../src/services/dbService');
      const styles = [createPresetStyle()];
      const { result } = renderHook(() => useProjects('test-api-key', makeStylesRef(styles)));
      const project = createProject();

      await act(async () => {
        await result.current.syncData([project], styles);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user-data',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(saveToDB).toHaveBeenCalled();
    });

    it('does not sync when apiKey is empty', async () => {
      const { result } = renderHook(() => useProjects('', makeStylesRef()));

      await act(async () => {
        await result.current.syncData([createProject()]);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

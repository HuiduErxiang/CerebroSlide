import { useState, useMemo, useRef } from 'react';
import { Project, PresetStyle, UseProjectsReturn } from '../types';
import { saveToDB, getFromDB } from '../services/dbService';

let _sessionToken: string | null = null;
let _sessionExpiresAt = 0;

export function _resetSessionCache() {
  _sessionToken = null;
  _sessionExpiresAt = 0;
}

export async function getSessionToken(apiKey: string): Promise<string> {
  if (_sessionToken && Date.now() < _sessionExpiresAt - 60_000) {
    return _sessionToken;
  }
  const response = await fetch('/api/session', {
    headers: { 'x-api-key': apiKey },
  });
  if (!response.ok) throw new Error('Session exchange failed');
  const data = await response.json();
  _sessionToken = data.sessionToken as string;
  _sessionExpiresAt = data.expiresAt as number;
  return _sessionToken;
}

function sessionHeaders(token: string): Record<string, string> {
  return { 'x-session-token': token };
}

export function useProjects(
  userApiKey: string,
  customStylesRef: React.RefObject<PresetStyle[]>
): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const projectsRef = useRef<Project[]>(projects);
  projectsRef.current = projects;

  const activeProject = useMemo(
    () => projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const syncData = async (updatedProjects?: Project[], updatedStyles?: PresetStyle[]) => {
    if (!userApiKey) return;

    const newProjects = updatedProjects ?? projectsRef.current;
    const newStyles = updatedStyles ?? customStylesRef.current ?? [];

    if (updatedProjects) setProjects(updatedProjects);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const token = await getSessionToken(userApiKey);
      Object.assign(headers, sessionHeaders(token));
    } catch {
      headers['x-api-key'] = userApiKey;
    }

    fetch('/api/user-data', {
      method: 'POST',
      headers,
      body: JSON.stringify({ projects: newProjects, customStyles: newStyles }),
    }).catch(err => console.error('Cloud sync failed:', err));

    const prefix = `slidegen_v2_${userApiKey}_`;
    if (updatedProjects) {
      saveToDB(prefix + 'projects', updatedProjects).catch(err =>
        console.error('Local save failed:', err)
      );
    }
    if (updatedStyles) {
      localStorage.setItem(prefix + 'custom_styles', JSON.stringify(updatedStyles));
    }
  };

  const loadUserData = async (apiKey: string) => {
    const prefix = `slidegen_v2_${apiKey}_`;

    let getHeaders: Record<string, string> = {};
    try {
      const token = await getSessionToken(apiKey);
      getHeaders = sessionHeaders(token);
    } catch {
      getHeaders = { 'x-api-key': apiKey };
    }

    const response = await fetch('/api/user-data', { headers: getHeaders });
    if (!response.ok) throw new Error('Cloud sync failed');
    const cloudData = await response.json();

    let localProjects: Project[] = await getFromDB(prefix + 'projects');
    if (!localProjects || localProjects.length === 0) {
      const legacyKeys = [prefix + 'projects', 'projects', 'slidegen_projects'];
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

    const localStyles: PresetStyle[] = JSON.parse(
      localStorage.getItem(prefix + 'custom_styles') ||
        localStorage.getItem('custom_styles') ||
        '[]'
    );

    if (cloudData.projects && cloudData.projects.length > 0) {
      const projectsWithOutline: Project[] = cloudData.projects.map((p: Project) => ({
        ...p,
        script: p.script || '',
        outline: p.outline || [],
      }));
      setProjects(projectsWithOutline);
      if (projectsWithOutline.length > 0) {
        setActiveProjectId(projectsWithOutline[0].id);
      }
      return { customStyles: cloudData.customStyles || [] as PresetStyle[] };
    } else if (localProjects && localProjects.length > 0) {
      setProjects([...localProjects]);
      setActiveProjectId(localProjects[0].id);
      try {
        const migrateHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
          const token = await getSessionToken(apiKey);
          Object.assign(migrateHeaders, sessionHeaders(token));
        } catch {
          migrateHeaders['x-api-key'] = apiKey;
        }
        await fetch('/api/user-data', {
          method: 'POST',
          headers: migrateHeaders,
          body: JSON.stringify({ projects: localProjects, customStyles: localStyles }),
        });
      } catch (syncErr) {
        console.error('Initial migration sync failed:', syncErr);
      }
      return { customStyles: localStyles };
    } else {
      setProjects([]);
      return { customStyles: [] as PresetStyle[] };
    }
  };

  const createProject = () => {
    if (!newProjectName.trim()) return;
    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName.trim(),
      createdAt: Date.now(),
      slides: [],
    };
    const updated = [newProject, ...projectsRef.current];
    syncData(updated);
    setActiveProjectId(newProject.id);
    setNewProjectName('');
    setIsCreatingProject(false);
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = projectsRef.current.filter(p => p.id !== id);
    syncData(updated);
    if (activeProjectId === id) {
      setActiveProjectId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const deleteSlide = (slideId: string) => {
    if (!activeProjectId) return;
    const updatedProjects = projectsRef.current.map(p =>
      p.id === activeProjectId
        ? { ...p, slides: p.slides.filter(s => s.id !== slideId) }
        : p
    );
    syncData(updatedProjects);
  };

  const forceMigrateLocalData = async () => {
    if (!userApiKey) return;
    const prefix = `slidegen_v2_${userApiKey}_`;
    let localProjects: Project[] = [];
    const legacyKeys = [
      prefix + 'projects',
      'projects',
      'slidegen_projects',
      'slidegen_v2_projects',
    ];

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

    const dbProjects = await getFromDB(prefix + 'projects');
    if (dbProjects && Array.isArray(dbProjects)) {
      localProjects = [...localProjects, ...dbProjects];
    }

    localProjects = Array.from(new Map(localProjects.map(p => [p.id, p])).values());

    if (localProjects.length === 0) return;

    const confirm = window.confirm(
      `发现 ${localProjects.length} 个本地项目，是否将其合并到当前的云端账户？`
    );
    if (!confirm) return;

    setProjects(prev => {
      const merged = [...prev, ...localProjects];
      return Array.from(new Map(merged.map(p => [p.id, p])).values());
    });

    const getHdrs: Record<string, string> = {};
    try {
      const token = await getSessionToken(userApiKey);
      Object.assign(getHdrs, sessionHeaders(token));
    } catch {
      getHdrs['x-api-key'] = userApiKey;
    }

    const response = await fetch('/api/user-data', { headers: getHdrs });
    const cloudData = await response.json();

    const mergedProjects = [...(cloudData.projects || []), ...localProjects];
    const uniqueProjects = Array.from(
      new Map(mergedProjects.map(p => [p.id, p])).values()
    );

    const postHdrs: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const token = await getSessionToken(userApiKey);
      Object.assign(postHdrs, sessionHeaders(token));
    } catch {
      postHdrs['x-api-key'] = userApiKey;
    }

    await fetch('/api/user-data', {
      method: 'POST',
      headers: postHdrs,
      body: JSON.stringify({
        projects: uniqueProjects,
        customStyles: customStylesRef.current ?? [],
      }),
    });

    if (uniqueProjects.length > 0 && !activeProjectId) {
      setActiveProjectId(uniqueProjects[0].id);
    }
  };

  return {
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
  };
}

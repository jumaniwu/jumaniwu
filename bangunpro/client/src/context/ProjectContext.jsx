import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { user } = useAuth();
  const [activeProject, setActiveProject] = useState(null);
  const [projectType, setProjectType] = useState('gedung');

  useEffect(() => {
    if (user) fetchActive();
  }, [user]);

  const fetchActive = async () => {
    try {
      const r = await api.get('/projects/active');
      setActiveProject(r.data);
      if (r.data?.type) setProjectType(r.data.type);
    } catch { setActiveProject(null); }
  };

  const switchProject = async (projectId) => {
    await api.post(`/projects/${projectId}/set-active`);
    await fetchActive();
  };

  return (
    <ProjectContext.Provider value={{ activeProject, projectType, setProjectType, fetchActive, switchProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => useContext(ProjectContext);

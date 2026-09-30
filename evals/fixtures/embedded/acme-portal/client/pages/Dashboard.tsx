import { useEffect, useState } from "react";
import { apiFetch } from "../api.ts";

interface Project {
  id: string;
  name: string;
}

export const Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    apiFetch<Project[]>("/projects").then(setProjects);
  }, []);

  return (
    <section>
      <h1>Projects</h1>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>{project.name}</li>
        ))}
      </ul>
    </section>
  );
};

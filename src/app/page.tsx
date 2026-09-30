import { CommandEnvironment } from "@/components/os/CommandEnvironment";
import {
  DEMO_ACTIVITY,
  demoSystemsOnlineCount,
} from "@/lib/demo/fixtures";
import { listProjects } from "@/lib/registry/projects";

export default function HomePage() {
  const projects = listProjects();
  const online = demoSystemsOnlineCount(projects);

  return (
    <CommandEnvironment
      projects={projects}
      systemsOnline={online}
      activitySeed={DEMO_ACTIVITY}
    />
  );
}

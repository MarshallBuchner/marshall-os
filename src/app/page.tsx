import { HeroCommand } from "@/components/dashboard/HeroCommand";
import { JarvisCore } from "@/components/dashboard/JarvisCore";
import { ProjectCards } from "@/components/dashboard/ProjectCards";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { TodayGlance } from "@/components/dashboard/TodayGlance";
import { AgentsPanel } from "@/components/dashboard/AgentsPanel";
import {
  DEMO_ACTIVITY,
  DEMO_SCHEDULE,
  demoAttentionCount,
  demoSystemsOnlineCount,
} from "@/lib/demo/fixtures";
import { listAgents, listProjects } from "@/lib/registry/projects";

export default function HomePage() {
  const projects = listProjects();
  const agents = listAgents();
  const online = demoSystemsOnlineCount(projects);
  const attention = demoAttentionCount(projects);

  return (
    <div className="space-y-5">
      <HeroCommand
        systemsOnline={online}
        systemsTotal={projects.length}
        attention={attention}
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-5">
          <JarvisCore />
          <ProjectCards projects={projects} />
        </div>
        <div className="space-y-5">
          <ActivityFeed seed={DEMO_ACTIVITY} />
          <TodayGlance items={DEMO_SCHEDULE} />
        </div>
      </div>

      <AgentsPanel agents={agents} />
    </div>
  );
}

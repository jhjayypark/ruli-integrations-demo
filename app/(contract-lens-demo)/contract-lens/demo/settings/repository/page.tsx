"use client";

import DemoKnowledgeBasePage from "@/app/(assistant-demo)/assistant/demo/knowledge-base/page";
import { TeamSharingProvider } from "@/app/(assistant-demo)/assistant/demo/knowledge-base/team-sharing-context";

// The Contract Lens repository IS the Knowledge Base document library —
// same component, relocated under Contract Lens settings so repo setup
// happens here instead of under Knowledge Base.
export default function RepositorySettingsPage(): React.ReactElement {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-y-auto">
      <TeamSharingProvider>
        <DemoKnowledgeBasePage />
      </TeamSharingProvider>
    </div>
  );
}

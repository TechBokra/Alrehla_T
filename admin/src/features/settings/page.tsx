import {
  CustomizationFieldsPage,
  StoryGoalsPage,
  WritingDialectsPage,
} from "./catalog-pages";
import { SettingsSidebar } from "./sidebar";
import type { SettingsTab } from "./tabs";

const panels = {
  "customization-fields": CustomizationFieldsPage,
  "story-goals": StoryGoalsPage,
  "writing-dialects": WritingDialectsPage,
};

export function SettingsPage({ tab }: { tab: SettingsTab }) {
  const Content = panels[tab];
  return (
    <section
      className="flex min-w-0 flex-col gap-6"
      aria-labelledby="settings-title"
    >
      <h1 id="settings-title" className="text-2xl font-semibold">
        الإعدادات
      </h1>
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border md:flex-row">
        <SettingsSidebar tab={tab} />
        <div className="min-w-0 w-full flex-1 p-4 lg:p-6">
          <Content />
        </div>
      </div>
    </section>
  );
}

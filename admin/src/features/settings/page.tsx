import {
  CustomizationFieldsPage,
  StoryGoalsPage,
  WritingDialectsPage,
} from "./catalog";
import { IdentityContactPage } from "./identity-contact";
import { SettingsSidebar } from "./sidebar";
import type { ActiveSettingsTab } from "./tabs";

const panels = {
  "identity-contact": IdentityContactPage,
  "customization-fields": CustomizationFieldsPage,
  "story-goals": StoryGoalsPage,
  "writing-dialects": WritingDialectsPage,
};

export function SettingsPage({
  tab,
  canManageCatalog,
  canManagePlatform,
}: {
  tab: ActiveSettingsTab;
  canManageCatalog: boolean;
  canManagePlatform: boolean;
}) {
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
        <SettingsSidebar
          tab={tab}
          canManageCatalog={canManageCatalog}
          canManagePlatform={canManagePlatform}
        />
        <div className="min-w-0 w-full flex-1 p-4 lg:p-6">
          <Content />
        </div>
      </div>
    </section>
  );
}

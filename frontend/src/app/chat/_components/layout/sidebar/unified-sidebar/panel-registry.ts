import type {
  SidebarPanelContentMap,
  SidebarPanelDefinition,
  SidebarPanelFactoryContext,
  SidebarPanelInstance,
  SidebarPanelVariant,
} from "./types";

const SIDEBAR_PANEL_DEFINITIONS: readonly SidebarPanelDefinition[] = [
  {
    id: "activity",
    label: "Activity",
    orderByVariant: {
      desktop: 0,
      mobile: 0,
    },
  },
  {
    id: "context",
    label: "Context",
    orderByVariant: {
      desktop: 3,
      mobile: 5,
    },
  },
  {
    id: "browser",
    label: "Browser",
    orderByVariant: {
      desktop: 1,
      mobile: 1,
    },
  },
  {
    id: "computer",
    label: "Computer",
    orderByVariant: {
      desktop: 2,
      mobile: 2,
    },
  },
  {
    id: "artifacts",
    label: "Preview",
    orderByVariant: {
      desktop: 4,
      mobile: 4,
    },
    isVisible: ({ hasArtifacts }) => hasArtifacts,
  },
  {
    id: "files",
    label: "Files",
    orderByVariant: {
      desktop: 5,
      mobile: 3,
    },
  },
] as const;

function sortPanelsByVariant(
  panels: readonly SidebarPanelDefinition[],
  variant: SidebarPanelVariant,
): SidebarPanelDefinition[] {
  return [...panels].sort((a, b) => a.orderByVariant[variant] - b.orderByVariant[variant]);
}

export function buildSidebarPanelInstances(
  variant: SidebarPanelVariant,
  hasArtifacts: boolean,
  panelContentMap: SidebarPanelContentMap,
): SidebarPanelInstance[] {
  const context: SidebarPanelFactoryContext = {
    variant,
    hasArtifacts,
    panelContentMap,
  };

  return sortPanelsByVariant(SIDEBAR_PANEL_DEFINITIONS, variant)
    .filter((definition) => (definition.isVisible ? definition.isVisible(context) : true))
    .map((definition) => ({
      ...definition,
      content: panelContentMap[definition.id] ?? null,
    }));
}

export function resolveSidebarPanelContent(
  activeTab: SidebarPanelInstance["id"],
  panels: readonly SidebarPanelInstance[],
): SidebarPanelInstance["content"] {
  return panels.find((panel) => panel.id === activeTab)?.content ?? panels[0]?.content ?? null;
}

export function resolveSidebarActiveTab(
  activeTab: SidebarPanelInstance["id"],
  panels: readonly SidebarPanelInstance[],
): SidebarPanelInstance["id"] {
  return panels.some((panel) => panel.id === activeTab) ? activeTab : (panels[0]?.id ?? "activity");
}

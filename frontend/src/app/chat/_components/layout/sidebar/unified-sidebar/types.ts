import type { ReactNode } from "react";

export type SidebarTab = "activity" | "context" | "artifacts" | "files";
export type SidebarPanelVariant = "desktop" | "mobile";

export type SidebarPanelContentMap = Partial<Record<SidebarTab, ReactNode>>;

export interface SidebarPanelFactoryContext {
  variant: SidebarPanelVariant;
  hasArtifacts: boolean;
  panelContentMap: SidebarPanelContentMap;
}

export interface SidebarPanelDefinition {
  id: SidebarTab;
  label: string;
  orderByVariant: Record<SidebarPanelVariant, number>;
  accent?: boolean;
  isVisible?: (context: SidebarPanelFactoryContext) => boolean;
}

export interface SidebarPanelInstance extends SidebarPanelDefinition {
  content: ReactNode | null;
}

export interface UnifiedSidebarProps {
  children: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  activeTab: SidebarTab;
  onSetActiveTab: (tab: SidebarTab) => void;
  panelContentMap: SidebarPanelContentMap;
  hasArtifacts: boolean;
  width?: number;
  onWidthChange?: (width: number) => void;
}

export interface SidebarPaneProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: SidebarTab;
  onSetActiveTab: (tab: SidebarTab) => void;
  panelContentMap: SidebarPanelContentMap;
  hasArtifacts: boolean;
  width?: number;
  onWidthChange?: (width: number) => void;
}


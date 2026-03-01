// CRITICAL
"use client";

import { memo } from "react";

export const TabButton = memo(
  function TabButton({
    active,
    onClick,
    label,
    accent,
  }: {
    active: boolean;
    onClick: () => void;
    label: string;
    accent?: boolean;
  }) {
    return (
      <button
        onClick={onClick}
        className={`relative px-2.5 py-2 text-[11px] font-medium transition-colors whitespace-nowrap rounded-none border-b-2 ${
          active
            ? accent
              ? "text-(--hl2) border-(--hl2)"
              : "text-(--fg) border-(--fg)/70"
            : accent
              ? "text-(--hl2)/60 border-transparent hover:text-(--hl2)"
              : "text-(--dim) border-transparent hover:text-(--fg)"
        }`}
      >
        {label}
      </button>
    );
  },
  function areTabButtonPropsEqual(prev, next) {
    return (
      prev.active === next.active &&
      prev.accent === next.accent &&
      prev.label === next.label &&
      prev.onClick === next.onClick
    );
  },
);

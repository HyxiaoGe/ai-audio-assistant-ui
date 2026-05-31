"use client";

import { useRef } from "react";

interface Tab {
  id: string;
  label: string;
}

interface TabSwitchProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function TabSwitch({ tabs, activeTab, onTabChange }: TabSwitchProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // WAI-ARIA tabs：方向键在标签间移动（automatic activation，移动即激活），
  // Home/End 跳到首尾，两端环绕。整组只占一个 Tab 停靠点（roving tabindex）。
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    tabRefs.current[nextIndex]?.focus();
    onTabChange(nextTab.id);
  };

  return (
    <div
      role="tablist"
      className="inline-flex border-b"
      style={{ borderColor: 'var(--app-glass-border)' }}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`tabpanel-${tab.id}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className="px-8 py-3 relative transition-colors whitespace-nowrap"
            style={{
              color: isActive ? 'var(--app-text)' : 'var(--app-text-muted)',
              fontWeight: isActive ? 500 : 400,
              fontSize: '16px'
            }}
          >
            {tab.label}
            {isActive && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[3px]"
                style={{ background: 'var(--app-primary)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

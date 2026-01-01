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
  return (
    <div className="inline-flex border-b" style={{ borderColor: 'var(--app-glass-border)' }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
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

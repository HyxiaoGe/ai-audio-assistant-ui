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
    <div className="inline-flex border-b" style={{ borderColor: '#E2E8F0' }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="px-8 py-3 relative transition-colors whitespace-nowrap"
            style={{
              color: isActive ? '#0F172A' : '#64748B',
              fontWeight: isActive ? 500 : 400,
              fontSize: '16px'
            }}
          >
            {tab.label}
            {isActive && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[3px]"
                style={{ background: '#3B82F6' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

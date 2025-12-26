"use client";

import type React from "react";
import { BarChart3, Settings, List } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { getTheme, Theme } from '@/styles/theme-config';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  isActive: boolean;
  onClick: () => void;
  theme: Theme;
}

function SidebarItem({ icon, label, isActive, onClick, theme }: SidebarItemProps) {
  const colors = getTheme(theme);
  
  return (
    <button
      onClick={onClick}
      className="w-full h-11 flex items-center gap-3 px-4 rounded-lg transition-all relative"
      style={{
        background: isActive ? colors.bg.secondary : 'transparent',
        color: isActive ? colors.text.primary : colors.text.tertiary,
        fontSize: '14px',
        fontWeight: isActive ? 500 : 400
      }}
    >
      {/* 左侧蓝色指示条 */}
      {isActive && (
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r"
          style={{ background: colors.brand.primary }}
        />
      )}
      
      <div className="w-5 h-5 flex items-center justify-center">
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}

interface SidebarProps {
  theme?: Theme;
}

export default function Sidebar({ theme = 'light' }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const colors = getTheme(theme);

  const menuItems = [
    {
      icon: <BarChart3 className="w-5 h-5" />,
      label: '概览',
      path: '/'
    },
    {
      icon: <List className="w-5 h-5" />,
      label: '任务',
      path: '/tasks'
    },
    {
      icon: <Settings className="w-5 h-5" />,
      label: '设置',
      path: '/settings'
    }
  ];

  // 判断当前路径应该高亮哪个菜单项
  const isActive = (itemPath: string) => {
    // 概览：只在首页高亮
    if (itemPath === '/') {
      return pathname === '/';
    }
    
    // 任务：在任务列表页和任务详情页都高亮
    if (itemPath === '/tasks') {
      return pathname === '/tasks' || 
             pathname.startsWith('/tasks/');
    }
    
    // 其他页面：精确匹配
    return pathname === itemPath;
  };

  return (
    <aside 
      className="w-60 h-full p-4 space-y-1"
      style={{
        background: colors.bg.tertiary,
        borderRight: `1px solid ${colors.border.default}`
      }}
    >
      {menuItems.map((item) => (
        <SidebarItem
          key={item.path}
          icon={item.icon}
          label={item.label}
          path={item.path}
          isActive={isActive(item.path)}
          onClick={() => router.push(item.path)}
          theme={theme}
        />
      ))}
    </aside>
  );
}

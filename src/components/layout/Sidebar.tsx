"use client";

import type React from "react";
import { BarChart3, Settings, List, LineChart, Youtube, Shield } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n-context';
import { useUserStore } from '@/store/user-store';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  isActive: boolean;
  onClick: () => void;
}

function SidebarItem({ icon, label, isActive, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className="sidebar-item relative"
      data-active={isActive}
    >
      <div className="w-5 h-5 flex items-center justify-center">
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const isAdmin = useUserStore((state) => state.isAdmin);

  const menuItems = [
    {
      icon: <BarChart3 className="w-5 h-5" />,
      label: t("nav.overview"),
      path: '/'
    },
    {
      icon: <List className="w-5 h-5" />,
      label: t("nav.tasks"),
      path: '/tasks'
    },
    {
      icon: <Youtube className="w-5 h-5" />,
      label: t("nav.subscriptions"),
      path: '/subscriptions'
    },
    {
      icon: <LineChart className="w-5 h-5" />,
      label: t("nav.stats"),
      path: '/stats'
    },
    {
      icon: <Settings className="w-5 h-5" />,
      label: t("nav.settings"),
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

    if (itemPath === '/stats') {
      return pathname === '/stats' || pathname.startsWith('/stats/');
    }

    if (itemPath === '/subscriptions') {
      return pathname === '/subscriptions' || pathname.startsWith('/subscriptions/');
    }

    if (itemPath === '/admin') {
      return pathname === '/admin' || pathname.startsWith('/admin/');
    }

    // 其他页面：精确匹配
    return pathname === itemPath;
  };

  return (
    <aside
      className="w-60 h-full p-4 flex flex-col"
      style={{
        background: "var(--app-glass-bg)",
        borderRight: "1px solid var(--app-glass-border)",
        backdropFilter: `blur(var(--app-glass-blur))`,
        boxShadow: "var(--app-glass-shadow)"
      }}
    >
      <div className="space-y-1 flex-1">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            isActive={isActive(item.path)}
            onClick={() => router.push(item.path)}
          />
        ))}
      </div>

      {/* Admin section at bottom */}
      {isAdmin && (
        <div className="pt-4 border-t" style={{ borderColor: 'var(--app-glass-border)' }}>
          <SidebarItem
            icon={<Shield className="w-5 h-5" />}
            label={t("admin.console")}
            path="/admin"
            isActive={isActive('/admin')}
            onClick={() => router.push('/admin')}
          />
        </div>
      )}
    </aside>
  );
}

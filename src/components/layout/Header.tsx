"use client";

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Moon, Sun, ChevronDown, Mic, LogOut } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getTheme } from '@/styles/theme-config';

interface HeaderProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  language?: 'zh' | 'en';
  theme?: 'light' | 'dark';
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

export default function Header({ 
  isAuthenticated, 
  onOpenLogin,
  language = 'zh',
  theme = 'light',
  onToggleLanguage = () => {},
  onToggleTheme = () => {}
}: HeaderProps) {
  const colors = getTheme(theme);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
    document.cookie = "mock_auth=; path=/; max-age=0; samesite=lax";
    await signOut({ callbackUrl: '/' });
  };
  
  return (
    <header 
      className="h-16 flex items-center justify-between px-6"
      style={{ 
        background: colors.bg.secondary,
        borderBottom: `1px solid ${colors.border.default}`
      }}
    >
      {/* 左侧：Logo + 产品名称 */}
      <Link href="/" className="flex items-center gap-2">
        <div 
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #0F172A 100%)' }}
        >
          <Mic className="w-4 h-4 text-white" />
        </div>
        <span 
          className="text-base"
          style={{ fontWeight: 600, color: colors.text.primary }}
        >
          {language === 'zh' ? 'AI 音频助手' : 'AI Audio'}
        </span>
      </Link>

      {/* 右侧：功能按钮组 */}
      <div className="flex items-center gap-4">
        {/* 语言切换 */}
        <button 
          onClick={onToggleLanguage}
          className="text-sm transition-all hover:opacity-70 px-2 py-1 rounded"
          style={{ color: colors.text.tertiary }}
        >
          {language === 'zh' ? '中/EN' : 'EN/中'}
        </button>

        {/* 主题切换 */}
        <button 
          onClick={onToggleTheme}
          className="w-6 h-6 flex items-center justify-center transition-all hover:opacity-70 duration-300"
          style={{ 
            color: theme === 'dark' ? '#F59E0B' : '#6366F1',
            transform: theme === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
          title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </button>

        {/* 用户头像 + 下拉 */}
        {isAuthenticated ? (
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <Avatar size="sm">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sean" />
                <AvatarFallback>S</AvatarFallback>
              </Avatar>
              <ChevronDown className="w-4 h-4" style={{ color: colors.text.tertiary }} />
            </button>

            {isMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-36 rounded-lg border shadow-lg z-10"
                style={{ background: colors.bg.secondary, borderColor: colors.border.default }}
              >
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-black/5 transition-colors"
                  style={{ color: colors.text.primary }}
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="px-4 py-2 rounded-lg border transition-colors"
            style={{
              borderColor: colors.border.default,
              color: colors.text.primary,
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            {language === 'zh' ? '登录' : 'Login'}
          </button>
        )}
      </div>
    </header>
  );
}

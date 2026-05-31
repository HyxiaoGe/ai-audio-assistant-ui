"use client";

import { useState } from 'react';
import { Mic } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { loginWithGoogle, loginWithGitHub } from '@/store/auth-store';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  callbackUrl?: string;
}

export default function LoginModal({ isOpen, onClose, callbackUrl = '/tasks' }: LoginModalProps) {
  const [loading, setLoading] = useState<'google' | 'github' | null>(null);
  const { t } = useI18n();

  const handleSocialLogin = (provider: 'google' | 'github') => {
    setLoading(provider);
    if (provider === 'google') {
      loginWithGoogle(callbackUrl);
    } else {
      loginWithGitHub(callbackUrl);
    }
  };

  return (
    // Radix Dialog 提供焦点陷阱 / Esc 关闭 / 焦点恢复 / role=dialog+aria-modal / 内置关闭按钮。
    // className 覆盖：block(去掉 DialogContent 默认 grid，保留原 mb 间距) + 原有 max-w-md/圆角/内边距。
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="block w-full max-w-md sm:max-w-md rounded-2xl p-12">
        {/* sr-only 标题：给对话框可访问名称；视觉标题仍由下方 h1 呈现 */}
        <DialogTitle className="sr-only">{t("app.name")}</DialogTitle>

        {/* Logo 和产品信息区域 */}
        <div className="text-center mb-12">
            {/* Logo 图标 */}
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
              style={{ background: "var(--app-brand-gradient)" }}
            >
              <Mic className="w-6 h-6 text-white" />
            </div>

            {/* 产品名称 - Heading/H1 */}
            <h1 className="text-h1 mb-2" style={{ color: "var(--app-text)" }}>
              {t("app.name")}
            </h1>

            {/* 副标题 - Body/Default */}
            <p className="text-body-default" style={{ color: "var(--app-text-muted)" }}>
              {t("app.tagline")}
            </p>
          </div>

          {/* OAuth 登录按钮组 */}
          <div className="space-y-4 mb-8">
            {/* Google 登录按钮 */}
            <button
              onClick={() => handleSocialLogin('google')}
              disabled={loading !== null}
              className="glass-control w-full h-12 rounded-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 500, fontSize: '16px', color: "var(--app-text)" }}
            >
              {/* Google Logo SVG */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.8 10.2273C19.8 9.51819 19.7364 8.83637 19.6182 8.18182H10.2V12.05H15.6382C15.4 13.3 14.6727 14.3591 13.5864 15.0682V17.5773H16.8182C18.7091 15.8364 19.8 13.2727 19.8 10.2273Z" fill="#4285F4"/>
                <path d="M10.2 20C12.9 20 15.1682 19.1045 16.8182 17.5773L13.5864 15.0682C12.6864 15.6682 11.5455 16.0227 10.2 16.0227C7.59545 16.0227 5.38182 14.2636 4.58636 11.9H1.25455V14.4909C2.89545 17.7591 6.30909 20 10.2 20Z" fill="#34A853"/>
                <path d="M4.58636 11.9C4.38636 11.3 4.27273 10.6591 4.27273 10C4.27273 9.34091 4.38636 8.7 4.58636 8.1V5.50909H1.25455C0.572727 6.86364 0.2 8.38636 0.2 10C0.2 11.6136 0.572727 13.1364 1.25455 14.4909L4.58636 11.9Z" fill="#FBBC04"/>
                <path d="M10.2 3.97727C11.6682 3.97727 12.9818 4.48182 14.0227 5.47273L16.8909 2.60455C15.1636 0.986364 12.8955 0 10.2 0C6.30909 0 2.89545 2.24091 1.25455 5.50909L4.58636 8.1C5.38182 5.73636 7.59545 3.97727 10.2 3.97727Z" fill="#EA4335"/>
              </svg>
              {loading === 'google' ? t("auth.redirecting") : t("auth.loginWithGoogle")}
            </button>

            {/* GitHub 登录按钮 */}
            <button
              onClick={() => handleSocialLogin('github')}
              disabled={loading !== null}
              className="w-full h-12 rounded-lg bg-[var(--app-github-bg)] flex items-center justify-center gap-3 transition-colors hover:bg-[var(--app-github-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 500, fontSize: '16px', color: '#FFFFFF' }}
            >
              {/* GitHub Logo SVG */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M10 0C4.475 0 0 4.475 0 10C0 14.425 2.8625 18.1625 6.8375 19.4875C7.3375 19.575 7.525 19.275 7.525 19.0125C7.525 18.775 7.5125 17.9875 7.5125 17.15C5 17.6125 4.35 16.5375 4.15 15.975C4.0375 15.6875 3.55 14.8 3.125 14.5625C2.775 14.375 2.275 13.9125 3.1125 13.9C3.9 13.8875 4.4625 14.625 4.65 14.925C5.55 16.4375 6.9875 16.0125 7.5625 15.75C7.65 15.1 7.9125 14.6625 8.2 14.4125C5.975 14.1625 3.65 13.3 3.65 9.475C3.65 8.3875 4.0375 7.4875 4.675 6.7875C4.575 6.5375 4.225 5.5125 4.775 4.1375C4.775 4.1375 5.6125 3.875 7.525 5.1625C8.325 4.9375 9.175 4.825 10.025 4.825C10.875 4.825 11.725 4.9375 12.525 5.1625C14.4375 3.8625 15.275 4.1375 15.275 4.1375C15.825 5.5125 15.475 6.5375 15.375 6.7875C16.0125 7.4875 16.4 8.375 16.4 9.475C16.4 13.3125 14.0625 14.1625 11.8375 14.4125C12.2 14.725 12.5125 15.325 12.5125 16.2625C12.5125 17.6 12.5 18.675 12.5 19.0125C12.5 19.275 12.6875 19.5875 13.1875 19.4875C15.1726 18.8173 16.8976 17.5414 18.1197 15.8395C19.3418 14.1375 19.9994 12.0952 20 10C20 4.475 15.525 0 10 0Z" fill="white"/>
              </svg>
              {loading === 'github' ? t("auth.redirecting") : t("auth.loginWithGitHub")}
            </button>
          </div>

          {/* 底部协议文字 - Caption */}
          <p className="text-caption text-center" style={{ color: "var(--app-text-subtle)" }}>
            {t("auth.agreementPrefix")}{' '}
            <a href="#" className="hover:underline" style={{ color: "var(--app-primary)" }}>
              {t("auth.agreementLink")}
            </a>
            {' '}{t("auth.agreementAnd")}{' '}
            <a href="#" className="hover:underline" style={{ color: "var(--app-primary)" }}>
              {t("auth.privacyPolicy")}
            </a>
          </p>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Globe,
  Palette,
  Bell,
  Save,
  CheckCircle2
} from 'lucide-react';

interface SettingsProps {
  isAuthenticated?: boolean;
  onOpenLogin?: () => void;
  language?: 'zh' | 'en';
  theme?: 'light' | 'dark';
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

export default function Settings({ 
  isAuthenticated = false, 
  onOpenLogin = () => {},
  language = 'zh',
  theme = 'light',
  onToggleLanguage = () => {},
  onToggleTheme = () => {}
}: SettingsProps) {
  const [languageState, setLanguageState] = useState('zh-CN');
  const [themeState, setThemeState] = useState('light');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // 保存设置到localStorage
    localStorage.setItem('settings', JSON.stringify({
      language: languageState,
      theme: themeState,
      emailNotifications,
      pushNotifications
    }));
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: '#FFFFFF' }}>
      {/* Header */}
      <Header 
        isAuthenticated={isAuthenticated} 
        onOpenLogin={onOpenLogin}
        language={language}
        theme={theme}
        onToggleLanguage={onToggleLanguage}
        onToggleTheme={onToggleTheme}
      />

      {/* 主体：Sidebar + 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto p-8">
          {/* 页面标题和保存按钮 */}
          <div className="flex items-center justify-between mb-8">
            <h2 
              className="text-h2"
              style={{ color: '#0F172A' }}
            >
              设置
            </h2>
            <Button
              onClick={handleSave}
              disabled={saved}
              style={{
                background: saved ? '#10B981' : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
              }}
              className="text-white hover:opacity-90 transition-opacity"
            >
              {saved ? (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  已保存
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  保存设置
                </>
              )}
            </Button>
          </div>

          {/* 设置卡片 */}
          <div className="space-y-6">
            {/* Language & Theme Settings */}
            <Card>
              <CardHeader>
                <CardTitle>外观设置</CardTitle>
                <CardDescription>
                  自定义应用的语言和主题
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    界面语言
                  </Label>
                  <Select value={languageState} onValueChange={setLanguageState}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh-CN">简体中文</SelectItem>
                      <SelectItem value="zh-TW">繁體中文</SelectItem>
                      <SelectItem value="en-US">English</SelectItem>
                      <SelectItem value="ja-JP">日本語</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    更改界面显示语言
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    主题模式
                  </Label>
                  <Select value={themeState} onValueChange={setThemeState}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">浅色模式</SelectItem>
                      <SelectItem value="dark">深色模式</SelectItem>
                      <SelectItem value="auto">跟随系统</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    选择你喜欢的界面主题
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  通知设置
                </CardTitle>
                <CardDescription>
                  管理通知和提醒方式
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="email-notifications">邮件通知</Label>
                    <p className="text-sm text-gray-500">
                      任务完成时发送邮件通知
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="push-notifications">推送通知</Label>
                    <p className="text-sm text-gray-500">
                      接收浏览器推送通知
                    </p>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Processing Settings */}
            <Card>
              <CardHeader>
                <CardTitle>处理偏好</CardTitle>
                <CardDescription>
                  自定义音视频处理选项
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>默认转写语言</Label>
                  <Select defaultValue="zh-CN">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh-CN">中文（普通话）</SelectItem>
                      <SelectItem value="en-US">英语（美国）</SelectItem>
                      <SelectItem value="en-GB">英语（英国）</SelectItem>
                      <SelectItem value="ja-JP">日语</SelectItem>
                      <SelectItem value="ko-KR">韩语</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    设置音频转写的默认语言
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>摘要详细程度</Label>
                  <Select defaultValue="medium">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brief">简要</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="detailed">详细</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    选择AI生成摘要的详细程度
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Account Info */}
            <Card>
              <CardHeader>
                <CardTitle>账户信息</CardTitle>
                <CardDescription>
                  查看你的账户使用情况
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">总任务数</p>
                    <p className="text-2xl font-semibold">24</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">本月使用</p>
                    <p className="text-2xl font-semibold">8</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">总处理时长</p>
                    <p className="text-2xl font-semibold">12.5h</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">存储空间</p>
                    <p className="text-2xl font-semibold">2.3GB</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">危险操作</CardTitle>
                <CardDescription>
                  这些操作不可逆，请谨慎操作
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">清除所有任务</p>
                    <p className="text-sm text-gray-500">删除所有任务记录和数据</p>
                  </div>
                  <Button variant="destructive" size="sm">
                    清除数据
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">删除账户</p>
                    <p className="text-sm text-gray-500">永久删除你的账户和所有数据</p>
                  </div>
                  <Button variant="destructive" size="sm">
                    删除账户
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

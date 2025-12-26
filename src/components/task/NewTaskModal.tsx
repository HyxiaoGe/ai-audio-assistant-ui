"use client";

import { useRef, useState } from 'react';
import { X, Link as LinkIcon, ChevronDown, ChevronUp } from 'lucide-react';
import TabSwitch from './TabSwitch';
import UploadZone from './UploadZone';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskData) => void;
}

export interface TaskData {
  type: 'upload' | 'link';
  file?: File;
  videoUrl?: string;
  platform?: 'youtube' | 'bilibili';
  options: {
    language: string;
    speakerDiarization: boolean;
    summaryStyle: string;
  };
}

type Platform = 'youtube' | 'bilibili';

export default function NewTaskModal({ isOpen, onClose, onSubmit }: NewTaskModalProps) {
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('youtube');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedOptions, setAdvancedOptions] = useState({
    language: 'auto',
    speakerDiarization: true,
    summaryStyle: 'meeting'
  });
  const uploadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tabs = [
    { id: 'upload', label: '上传文件' },
    { id: 'link', label: '复制链接' }
  ];

  const platformTabs = [
    { id: 'youtube', label: 'YouTube' },
    { id: 'bilibili', label: 'Bilibili' }
  ];

  const platformInfo = {
    youtube: {
      placeholder: 'https://youtube.com/watch?v=...',
      formats: [
        'youtube.com/watch?v=xxx',
        'youtu.be/xxx'
      ]
    },
    bilibili: {
      placeholder: 'https://www.bilibili.com/video/BVxxx...',
      formats: [
        'bilibili.com/video/BVxxx',
        'b23.tv/xxx'
      ]
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setIsUploading(true);
    setUploadProgress(0);
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
    }

    // Simulate upload
    uploadTimerRef.current = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          if (uploadTimerRef.current) {
            clearInterval(uploadTimerRef.current);
            uploadTimerRef.current = null;
          }
          setIsUploading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const handleFileRemove = () => {
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
    setSelectedFile(null);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleSubmit = () => {
    const taskData: TaskData = {
      type: activeTab as 'upload' | 'link',
      file: selectedFile || undefined,
      videoUrl: videoUrl || undefined,
      platform: selectedPlatform,
      options: advancedOptions
    };

    onSubmit(taskData);
    handleClose();
  };

  const handleClose = () => {
    // Reset state
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
    setActiveTab('upload');
    setSelectedFile(null);
    setIsUploading(false);
    setUploadProgress(0);
    setVideoUrl('');
    setSelectedPlatform('youtube');
    setShowAdvanced(false);
    onClose();
  };

  const canSubmit = activeTab === 'upload' 
    ? selectedFile && !isUploading 
    : videoUrl.trim().length > 0;

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.6)' }}
      onClick={handleClose}
    >
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: '#FFFFFF' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 flex items-center justify-between px-8 py-6 border-b"
          style={{ background: '#FFFFFF', borderColor: '#E2E8F0' }}
        >
          <h2 className="text-2xl" style={{ fontWeight: 600, color: '#0F172A' }}>
            新建任务
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#64748B' }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6">
          {/* Tab Switch */}
          <div className="flex justify-center">
            <TabSwitch 
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {activeTab === 'upload' ? (
              // Upload File Tab
              <div className="flex justify-center">
                <UploadZone
                  onFileSelect={handleFileSelect}
                  onFileRemove={handleFileRemove}
                  uploadProgress={uploadProgress}
                  uploadedFile={selectedFile}
                  isUploading={isUploading}
                />
              </div>
            ) : (
              // Link Tab
              <div className="space-y-6">
                {/* Platform Selection */}
                <div className="flex justify-center">
                  <div className="inline-flex rounded-lg border p-1" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>
                    {platformTabs.map((tab) => {
                      const isActive = tab.id === selectedPlatform;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setSelectedPlatform(tab.id as Platform)}
                          className="px-6 py-2 rounded-md text-sm transition-all"
                          style={{
                            background: isActive ? '#FFFFFF' : 'transparent',
                            color: isActive ? '#0F172A' : '#64748B',
                            fontWeight: isActive ? 500 : 400,
                            boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* URL Input */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-5 h-5" style={{ color: '#64748B' }} />
                    <h3 className="text-base" style={{ fontWeight: 500, color: '#0F172A' }}>
                      粘贴 {selectedPlatform === 'youtube' ? 'YouTube' : 'Bilibili'} 视频链接
                    </h3>
                  </div>

                  <Input
                    type="url"
                    placeholder={platformInfo[selectedPlatform].placeholder}
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full"
                  />

                  <div className="space-y-1" style={{ color: '#94A3B8', fontSize: '14px' }}>
                    <p>支持格式：</p>
                    <ul className="list-disc list-inside pl-2 space-y-1">
                      {platformInfo[selectedPlatform].formats.map((format, index) => (
                        <li key={index}>{format}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Options */}
            <div className="space-y-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
                style={{ color: '#64748B' }}
              >
                <span>高级选项</span>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showAdvanced && (
                <div className="border rounded-lg p-6 space-y-4" style={{ borderColor: '#E2E8F0' }}>
                  {/* Language Selection */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="text-sm sm:w-32" style={{ color: '#64748B' }}>
                      语言：
                    </label>
                    <select
                      value={advancedOptions.language}
                      onChange={(e) => setAdvancedOptions({ ...advancedOptions, language: e.target.value })}
                      className="flex-1 sm:max-w-xs px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                    >
                      <option value="auto">自动检测</option>
                      <option value="zh">中文</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  {/* Speaker Diarization */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="text-sm sm:w-32" style={{ color: '#64748B' }}>
                      说话人分离：
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedOptions.speakerDiarization}
                        onChange={(e) => setAdvancedOptions({ ...advancedOptions, speakerDiarization: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm" style={{ color: '#0F172A' }}>启用</span>
                    </label>
                  </div>

                  {/* Summary Style */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="text-sm sm:w-32" style={{ color: '#64748B' }}>
                      摘要风格：
                    </label>
                    <select
                      value={advancedOptions.summaryStyle}
                      onChange={(e) => setAdvancedOptions({ ...advancedOptions, summaryStyle: e.target.value })}
                      className="flex-1 sm:max-w-xs px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                    >
                      <option value="meeting">会议纪要</option>
                      <option value="lecture">讲座笔记</option>
                      <option value="podcast">播客摘要</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="sticky bottom-0 flex items-center justify-end gap-3 px-8 py-6 border-t"
          style={{ background: '#FFFFFF', borderColor: '#E2E8F0' }}
        >
          <Button
            onClick={handleClose}
            className="px-6 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: 'transparent',
              color: '#64748B',
              border: '1px solid #E2E8F0'
            }}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-8 py-2 rounded-lg text-sm transition-all"
            style={{
              background: canSubmit ? '#3B82F6' : '#E2E8F0',
              color: canSubmit ? '#FFFFFF' : '#94A3B8',
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed'
            }}
          >
            开始处理
          </Button>
        </div>
      </div>
    </div>
  );
}

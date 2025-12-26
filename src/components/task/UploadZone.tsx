"use client";

import { useState, useRef, DragEvent } from 'react';
import { Upload, X, FileAudio, CheckCircle } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  uploadProgress?: number;
  uploadedFile?: File | null;
  isUploading?: boolean;
}

export default function UploadZone({ 
  onFileSelect, 
  onFileRemove,
  uploadProgress = 0,
  uploadedFile = null,
  isUploading = false
}: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Check file type
      const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a', 'video/mp4'];
      if (validTypes.some(type => file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
        onFileSelect(file);
      }
    }
  };

  const handleClick = () => {
    if (!isUploading && !uploadedFile) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
  };

  // State: Uploaded
  if (uploadedFile && !isUploading) {
    return (
      <div
        className="w-full rounded-2xl border-2 flex items-center justify-center px-8 py-6"
        style={{
          borderColor: '#E2E8F0',
          background: '#F8FAFC',
          minHeight: '240px'
        }}
      >
        <div className="flex items-center gap-4 w-full">
          <CheckCircle className="w-6 h-6 flex-shrink-0" style={{ color: '#10B981' }} />
          <FileAudio className="w-6 h-6 flex-shrink-0" style={{ color: '#64748B' }} />
          <div className="flex-1 min-w-0">
            <p className="text-base truncate" style={{ fontWeight: 500, color: '#0F172A' }}>
              {uploadedFile.name}
            </p>
            <p className="text-sm" style={{ color: '#64748B' }}>
              {formatFileSize(uploadedFile.size)}
            </p>
          </div>
          <button
            onClick={onFileRemove}
            className="text-sm hover:opacity-70 transition-opacity px-3 py-1"
            style={{ color: '#EF4444', fontWeight: 500 }}
          >
            删除
          </button>
        </div>
      </div>
    );
  }

  // State: Uploading
  if (isUploading) {
    return (
      <div
        className="w-full rounded-2xl border-2 flex flex-col items-center justify-center px-8 py-6 gap-4"
        style={{
          borderColor: '#E2E8F0',
          background: '#F8FAFC',
          minHeight: '240px'
        }}
      >
        <div className="flex items-center gap-3 w-full">
          <FileAudio className="w-6 h-6" style={{ color: '#64748B' }} />
          <p className="text-base flex-1" style={{ fontWeight: 500, color: '#0F172A' }}>
            {uploadedFile?.name || 'Uploading...'}
          </p>
        </div>
        
        <div className="w-full space-y-2">
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${uploadProgress}%`,
                background: '#3B82F6'
              }}
            />
          </div>
          <p className="text-sm text-right" style={{ color: '#64748B' }}>
            {uploadProgress}%
          </p>
        </div>

        <button
          onClick={onFileRemove}
          className="text-sm hover:opacity-70 transition-opacity px-4 py-2"
          style={{ color: '#64748B' }}
        >
          取消
        </button>
      </div>
    );
  }

  // State: Default or Drag Over
  return (
    <div
      className="w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all"
      style={{
        borderColor: isDragOver ? '#3B82F6' : '#E2E8F0',
        background: isDragOver ? '#EFF6FF' : '#F8FAFC',
        minHeight: '240px'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a"
        onChange={handleFileChange}
      />
      
      <div className="h-full flex flex-col items-center justify-center px-8 py-12 gap-4">
        <Upload 
          className="w-12 h-12" 
          style={{ color: isDragOver ? '#3B82F6' : '#64748B' }} 
        />
        
        <p 
          className="text-base text-center"
          style={{ 
            fontWeight: 500, 
            color: isDragOver ? '#3B82F6' : '#0F172A' 
          }}
        >
          将文件拖放到此处，或{' '}
          <span style={{ color: '#3B82F6' }}>点击上传</span>
        </p>
        
        <p 
          className="text-sm text-center"
          style={{ color: isDragOver ? '#3B82F6' : '#94A3B8' }}
        >
          支持 MP3、MP4、WAV、M4A，最大 500MB
        </p>
      </div>
    </div>
  );
}

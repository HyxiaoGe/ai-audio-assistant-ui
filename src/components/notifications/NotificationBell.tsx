"use client";

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useGlobalStore } from '@/store/global-store';
import NotificationPanel from './NotificationPanel';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [ring, setRing] = useState(false);
  const prevUnread = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const unreadCount = useGlobalStore((state) => state.unreadCount);
  const loadNotifications = useGlobalStore((state) => state.loadNotifications);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // One-shot bell ring when the unread count increases (no permanent loop).
  // setState is deferred via setTimeout to avoid cascading renders inside the effect body.
  useEffect(() => {
    if (unreadCount > prevUnread.current) {
      const startTimer = setTimeout(() => setRing(true), 0);
      const stopTimer = setTimeout(() => setRing(false), 1000);
      prevUnread.current = unreadCount;
      return () => {
        clearTimeout(startTimer);
        clearTimeout(stopTimer);
      };
    }
    prevUnread.current = unreadCount;
  }, [unreadCount]);

  const togglePanel = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      loadNotifications();
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={togglePanel}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell
          className={`w-5 h-5 ${
            unreadCount > 0 ? 'text-blue-600 dark:text-blue-400' : ''
          } ${ring ? 'animate-bounce' : ''}`}
          style={ring ? { animationIterationCount: 1 } : undefined}
        />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <NotificationPanel onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}

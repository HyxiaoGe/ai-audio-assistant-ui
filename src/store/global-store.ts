/**
 * Global Zustand Store
 *
 * Manages global application state:
 * - Task states (progress, status) for real-time updates
 * - Notifications loaded from backend API
 * - WebSocket connection status
 */

import { create } from 'zustand';
import type { TaskStatus, Notification } from '@/types/api';
import { apiClient } from '@/lib/api-client';
import { notifyError } from '@/lib/notify';

// ============================================================================
// Types
// ============================================================================

export interface TaskProgress {
  task_id: string;
  status: TaskStatus;
  progress: number;
  stage?: string;
  title?: string;
  error_message?: string;
  updated_at: number; // timestamp
}

// Re-export Notification type from API types
export type { Notification };

// ============================================================================
// Store Interface
// ============================================================================

interface GlobalStore {
  // ===== Task States =====
  tasks: Record<string, TaskProgress>;
  updateTask: (taskId: string, data: Partial<TaskProgress>) => void;
  removeTask: (taskId: string) => void;
  clearTasks: () => void;

  // ===== Notifications =====
  notifications: Notification[];
  unreadCount: number;
  notificationsLoaded: boolean;
  notificationsLoading: boolean;
  notificationsError: string | null;
  notificationsPage: number;
  notificationsHasMore: boolean;

  loadNotifications: (opts?: { append?: boolean }) => Promise<void>;
  refreshUnread: () => Promise<void>;
  addNotificationFromWebSocket: (notification: Notification) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;

  // ===== WebSocket State =====
  wsConnected: boolean;
  wsReconnecting: boolean;
  setWsConnected: (connected: boolean) => void;
  setWsReconnecting: (reconnecting: boolean) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useGlobalStore = create<GlobalStore>((set, get) => ({
  // ===== Task States =====
  tasks: {},

  updateTask: (taskId: string, data: Partial<TaskProgress>) => {
    set((state) => ({
      tasks: {
        ...state.tasks,
        [taskId]: {
          ...(state.tasks[taskId] || { task_id: taskId, status: 'pending', progress: 0 }),
          ...data,
          updated_at: Date.now(),
        },
      },
    }));
  },

  removeTask: (taskId: string) => {
    set((state) => {
      const newTasks = { ...state.tasks };
      delete newTasks[taskId];
      return { tasks: newTasks };
    });
  },

  clearTasks: () => {
    set({ tasks: {} });
  },

  // ===== Notifications =====
  notifications: [],
  unreadCount: 0,
  notificationsLoaded: false,
  notificationsLoading: false,
  notificationsError: null,
  notificationsPage: 0,
  notificationsHasMore: true,

  /**
   * Load notifications from backend API.
   * Default: fresh page-1 load (replaces the feed).
   * append:true: load the NEXT page and concatenate older items.
   * hasMore is derived from total vs. items already loaded.
   */
  loadNotifications: async (opts?: { append?: boolean }) => {
    const { notificationsLoading, notificationsPage } = get();
    if (notificationsLoading) {
      return;
    }

    const append = opts?.append ?? false;
    const page = append ? notificationsPage + 1 : 1;

    set({ notificationsLoading: true, notificationsError: null });

    try {
      const response = await apiClient.getNotifications({
        page,
        page_size: 20,
      });

      set((state) => {
        const notifications = append
          ? [...state.notifications, ...response.items]
          : response.items;
        const hasMore = notifications.length < response.total;
        return {
          notifications,
          notificationsPage: page,
          notificationsHasMore: hasMore,
          notificationsLoaded: true,
          notificationsLoading: false,
        };
      });
    } catch (err) {
      set({
        notificationsLoading: false,
        notificationsError:
          err instanceof Error ? err.message : "Failed to load notifications",
      });
    }
  },

  /**
   * Refresh the server-authoritative unread count.
   */
  refreshUnread: async () => {
    const stats = await apiClient.getNotificationStats();
    set({ unreadCount: stats.unread });
  },

  /**
   * Add a notification pushed over WebSocket: dedupe-prepend by id,
   * bump unreadCount only when unread, cap the in-memory feed at 100.
   */
  addNotificationFromWebSocket: (notification: Notification) => {
    set((state) => {
      const exists = state.notifications.some((n) => n.id === notification.id);
      if (exists) {
        return state;
      }

      const notifications = [notification, ...state.notifications].slice(0, 100);
      const unreadCount = notification.read_at
        ? state.unreadCount
        : state.unreadCount + 1;

      return { notifications, unreadCount };
    });
  },

  /**
   * Mark a single notification as read.
   * Optimistic: flip read_at immediately; on failure roll back + notify.
   * Unread count is taken from the server response ({unread}).
   */
  markAsRead: async (id: string) => {
    const prev = get().notifications;
    const target = prev.find((n) => n.id === id);
    if (!target || target.read_at) {
      return;
    }
    const prevUnread = get().unreadCount;

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      ),
    }));

    try {
      const { unread } = await apiClient.markNotificationRead(id);
      set({ unreadCount: unread });
    } catch {
      set({ notifications: prev, unreadCount: prevUnread });
      notifyError("notif.mark_read_failed");
    }
  },

  /**
   * Mark all notifications as read.
   * Optimistic: flip every read_at + zero the badge; on failure roll back + notify.
   * Unread count is taken from the server response ({affected, unread}).
   */
  markAllAsRead: async () => {
    const prev = get().notifications;
    const prevUnread = get().unreadCount;

    set((state) => {
      const now = new Date().toISOString();
      return {
        notifications: state.notifications.map((n) => ({
          ...n,
          read_at: n.read_at || now,
        })),
        unreadCount: 0,
      };
    });

    try {
      const { unread } = await apiClient.markAllNotificationsRead();
      set({ unreadCount: unread });
    } catch {
      set({ notifications: prev, unreadCount: prevUnread });
      notifyError("notif.mark_all_read_failed");
    }
  },

  // ===== WebSocket State =====
  wsConnected: false,
  wsReconnecting: false,

  setWsConnected: (connected: boolean) => {
    set({ wsConnected: connected });
  },

  setWsReconnecting: (reconnecting: boolean) => {
    set({ wsReconnecting: reconnecting });
  },
}));

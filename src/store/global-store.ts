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

  loadNotifications: () => Promise<void>;
  refreshNotificationStats: () => Promise<void>;
  addNotificationFromWebSocket: (notification: Notification) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  clearNotifications: () => Promise<void>;

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

  /**
   * Load notifications from backend API
   * Called on app initialization and when new notifications are received
   */
  loadNotifications: async () => {
    const { notificationsLoading } = get();

    // Prevent duplicate concurrent loading
    if (notificationsLoading) {
      return;
    }

    set({ notificationsLoading: true });

    try {
      // Load first page of notifications (latest 50)
      const response = await apiClient.getNotifications({
        page: 1,
        page_size: 50,
      });

      // Load stats
      const stats = await apiClient.getNotificationStats();

      set({
        notifications: response.items,
        unreadCount: stats.unread,
        notificationsLoaded: true,
        notificationsLoading: false,
      });
    } catch (error) {
      console.error('Failed to load notifications:', error);
      set({
        notificationsLoading: false,
      });
    }
  },

  /**
   * Refresh notification stats (unread count)
   */
  refreshNotificationStats: async () => {
    try {
      const stats = await apiClient.getNotificationStats();
      set({ unreadCount: stats.unread });
    } catch (error) {
      console.error('Failed to refresh notification stats:', error);
    }
  },

  /**
   * Add notification from WebSocket (task completion/failure)
   * This is called when receiving real-time notifications
   */
  addNotificationFromWebSocket: (notification: Notification) => {
    set((state) => {
      // Check if notification already exists
      const exists = state.notifications.some((n) => n.id === notification.id);
      if (exists) {
        return state;
      }

      // Add to beginning of list
      const notifications = [notification, ...state.notifications].slice(0, 100);

      // Update unread count if not read
      const unreadCount = notification.read_at ? state.unreadCount : state.unreadCount + 1;

      return {
        notifications,
        unreadCount,
      };
    });
  },

  /**
   * Mark notification as read (calls backend API)
   */
  markAsRead: async (id: string) => {
    try {
      await apiClient.markNotificationRead(id);

      set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        );
        const unreadCount = Math.max(0, state.unreadCount - 1);
        return { notifications, unreadCount };
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  /**
   * Mark all notifications as read (calls backend API)
   */
  markAllAsRead: async () => {
    try {
      await apiClient.markAllNotificationsRead();

      set((state) => {
        const now = new Date().toISOString();
        const notifications = state.notifications.map((n) => ({
          ...n,
          read_at: n.read_at || now,
        }));
        return { notifications, unreadCount: 0 };
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  },

  /**
   * Remove (dismiss) notification (calls backend API)
   */
  removeNotification: async (id: string) => {
    try {
      await apiClient.deleteNotification(id);

      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        const notifications = state.notifications.filter((n) => n.id !== id);

        // Decrease unread count if notification was unread
        const unreadCount = notification && !notification.read_at
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount;

        return { notifications, unreadCount };
      });
    } catch (error) {
      console.error('Failed to remove notification:', error);
    }
  },

  /**
   * Clear all notifications (calls backend API)
   */
  clearNotifications: async () => {
    try {
      await apiClient.clearAllNotifications();

      set({ notifications: [], unreadCount: 0 });
    } catch (error) {
      console.error('Failed to clear notifications:', error);
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

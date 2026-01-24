/**
 * User Zustand Store
 *
 * Manages current user state:
 * - User profile from /users/me API
 * - Admin status for permission checks
 */

import { create } from 'zustand';
import type { UserProfile } from '@/types/api';
import { createAPIClient } from '@/lib/api-client';

// ============================================================================
// Store Interface
// ============================================================================

interface UserStore {
  // ===== User Profile =====
  profile: UserProfile | null;
  isAdmin: boolean;
  profileLoaded: boolean;
  profileLoading: boolean;
  profileError: string | null;

  // ===== Actions =====
  loadProfile: () => Promise<void>;
  clearProfile: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useUserStore = create<UserStore>((set, get) => ({
  // ===== Initial State =====
  profile: null,
  isAdmin: false,
  profileLoaded: false,
  profileLoading: false,
  profileError: null,

  // ===== Actions =====

  loadProfile: async () => {
    // Avoid duplicate requests
    if (get().profileLoading) return;

    set({ profileLoading: true, profileError: null });

    try {
      const client = createAPIClient();
      const profile = await client.getCurrentUser();

      set({
        profile,
        isAdmin: profile.is_admin ?? false,
        profileLoaded: true,
        profileLoading: false,
      });
    } catch (error) {
      set({
        profileError: error instanceof Error ? error.message : 'Failed to load profile',
        profileLoading: false,
        profileLoaded: true,
      });
    }
  },

  clearProfile: () => {
    set({
      profile: null,
      isAdmin: false,
      profileLoaded: false,
      profileLoading: false,
      profileError: null,
    });
  },
}));

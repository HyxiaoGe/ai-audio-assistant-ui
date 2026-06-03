export type NotificationVariant = "success" | "error" | "info" | "warning";

/**
 * Map a backend notification `type` to a visual variant.
 *
 * Single source of truth shared by the in-app row (NotificationItem) and the
 * real-time toast presenter (use-global-websocket) so the two surfaces can
 * never disagree on color — a failure is red in both, an alert is amber in
 * both, etc. Keyed on `type` (not `priority`) on purpose: priority drives
 * ordering/urgency, the variant drives semantics/color.
 */
export function getNotificationVariant(type: string): NotificationVariant {
  switch (type) {
    case "task_completed":
      return "success";
    case "task_failed":
    case "visual_failed":
      return "error";
    case "quota_alert":
    case "youtube_reauth_required":
      return "warning";
    default:
      return "info";
  }
}

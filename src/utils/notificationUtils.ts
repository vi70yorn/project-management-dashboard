import { InAppNotification, AuthUser } from '../types';

/**
 * Checks if a notification is relevant / visible to the specified user.
 * - If targetUserIds is defined and non-empty, checks if user's memberId or id is in targetUserIds.
 * - If targetRoles is defined and non-empty, checks if user's role is in targetRoles.
 * - If both are defined, matches if either condition is met.
 * - If neither is defined, broadcast to everyone.
 */
export const isNotificationForUser = (notif: InAppNotification, user: AuthUser | null): boolean => {
  if (!user) return true;

  const hasUserTargets = Array.isArray(notif.targetUserIds) && notif.targetUserIds.length > 0;
  const hasRoleTargets = Array.isArray(notif.targetRoles) && notif.targetRoles.length > 0;

  // Broadcast to all if no target constraints specified
  if (!hasUserTargets && !hasRoleTargets) {
    return true;
  }

  // Targeted by specific memberId / user id
  if (hasUserTargets) {
    if (notif.targetUserIds!.includes(user.memberId) || notif.targetUserIds!.includes(user.id)) {
      return true;
    }
  }

  // Targeted by role ('admin' or 'staff')
  if (hasRoleTargets) {
    if (notif.targetRoles!.includes(user.role)) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if a notification is unread for the specified user.
 */
export const isNotificationUnread = (notif: InAppNotification, user: AuthUser | null): boolean => {
  if (!user) {
    return !Array.isArray(notif.readBy) || notif.readBy.length === 0;
  }
  const safeReadBy = Array.isArray(notif.readBy) ? notif.readBy : [];
  return !safeReadBy.includes(user.memberId) && !safeReadBy.includes(user.id);
};


import type { UserRole } from '@poker/game-contracts';

export function isAuditPrivilegedRole(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'OPERATOR';
}

export function resolveAuditScopeUserId(
  authenticatedUserId: number,
  authenticatedRole: UserRole,
  requestedUserId?: number,
): number | undefined {
  const canReadAllAudit = isAuditPrivilegedRole(authenticatedRole);

  if (requestedUserId !== undefined) {
    if (requestedUserId !== authenticatedUserId && !canReadAllAudit) {
      throw new Error('Cannot access audit logs for another user.');
    }
    return requestedUserId;
  }

  return canReadAllAudit ? undefined : authenticatedUserId;
}


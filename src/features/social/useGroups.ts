import { useCallback, useEffect, useState } from 'react';
import * as api from './api';
import { useNotificationEvents, useSocial } from './useSocial';
import type { GroupSummary } from './types';

/**
 * Les groupes du joueur et les invitations qui l'attendent.
 *
 * La liste se relit à chaque événement de groupe reçu (invitation, retrait,
 * suppression) : c'est ce qui fait disparaître en direct un groupe supprimé
 * par son créateur.
 */
export function useGroups() {
  const { active, groupInvitations, refreshInvitations } = useSocial();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!active) return;
    try {
      setGroups(await api.getMyGroups());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useNotificationEvents((event) => {
    if (event.kind.startsWith('group_')) void refresh();
  });

  const createGroup = useCallback(
    async (name: string, description: string, isPrivate: boolean) => {
      const group = await api.createGroup(name, description, isPrivate);
      await refresh();
      return group;
    },
    [refresh],
  );

  const joinGroup = useCallback(
    async (code: string) => {
      const id = await api.joinGroupByCode(code);
      await Promise.all([refresh(), refreshInvitations()]);
      return id;
    },
    [refresh, refreshInvitations],
  );

  const respondInvitation = useCallback(
    async (invitationId: string, accept: boolean) => {
      const id = await api.respondGroupInvitation(invitationId, accept);
      await Promise.all([refresh(), refreshInvitations()]);
      return id;
    },
    [refresh, refreshInvitations],
  );

  return {
    groups,
    invitations: groupInvitations,
    loading,
    error,
    refresh,
    createGroup,
    joinGroup,
    respondInvitation,
    inviteUser: api.inviteToGroup,
    sendMessage: api.sendGroupMessage,
  };
}

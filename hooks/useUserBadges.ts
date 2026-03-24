import { useState, useEffect, useCallback } from 'react';
import { getUserLeaderboardRanks, type UserBadges } from '../services/badges';

export function useUserBadges(address: string | undefined) {
  const [badges, setBadges] = useState<UserBadges | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      setBadges(null);
      return;
    }
    setLoading(true);
    try {
      const data = await getUserLeaderboardRanks(address);
      setBadges(data);
    } catch {
      setBadges(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { badges, loading, refresh };
}

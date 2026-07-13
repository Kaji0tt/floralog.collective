import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const NON_PERSISTED_QUERY_KEYS = new Set([
	'allDiscoveries',
	'allProfilesForStats',
	'allFriendRecordsForStats',
	'allRobotPlantsForStats',
	'globalScanLeaderboard',
	'highestScanResultsLeaderboard',
	'globalScanTaxonomyHighlights',
	'news',
	'friendsNews',
	// User-specific unlock state: must always be fresh on app start
	// to avoid showing items as "locked" that have already been unlocked.
	'userRewards',
	'homeUserRewards',
	'userAchievements',
]);

const shouldPersistQuery = (query) => {
	if (query.state.status !== 'success') return false;

	const queryKey = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey;
	if (typeof queryKey === 'string' && NON_PERSISTED_QUERY_KEYS.has(queryKey)) {
		return false;
	}

	return true;
};


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000,
			gcTime: 24 * 60 * 60 * 1000,
			refetchOnMount: false,
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: 1,
		},
	},
});

const canUseStorage = typeof window !== 'undefined' && !!window.localStorage;

if (canUseStorage) {
	const queryPersister = createSyncStoragePersister({
		storage: window.localStorage,
		key: 'floralog.reactQueryCache.v2',
		throttleTime: 1000,
	});

	persistQueryClient({
		queryClient: queryClientInstance,
		persister: queryPersister,
		maxAge: 24 * 60 * 60 * 1000,
		dehydrateOptions: {
			shouldDehydrateQuery: shouldPersistQuery,
		},
	});
}

import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';


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
		key: 'floralog.reactQueryCache.v1',
		throttleTime: 1000,
	});

	persistQueryClient({
		queryClient: queryClientInstance,
		persister: queryPersister,
		maxAge: 24 * 60 * 60 * 1000,
		dehydrateOptions: {
			shouldDehydrateQuery: (query) => query.state.status === 'success',
		},
	});
}
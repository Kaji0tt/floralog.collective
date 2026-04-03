// Supabase-based entity access
import { supabase } from './supabaseClient';

// Treat optional tables (e.g. CollectionQuest) as empty rather than crashing
const isMissingTableError = (error) => {
  if (!error) return false;
  const lowerMessage = (error.message || '').toLowerCase();
  return error.code === 'PGRST201' ||
    error.code === 'PGRST301' ||
    error.code === '42P01' || // postgres undefined_table
    lowerMessage.includes('does not exist') ||
    lowerMessage.includes('not found');
};

const handleMissingTable = (tableName, error) => {
  if (isMissingTableError(error)) {
    console.warn(`[Query] Table ${tableName} not available yet. Returning empty result.`);
    return [];
  }
  throw error;
};

const legacyIdTables = new Set([
  'UserQuest',
  'UserWeeklyQuest',
  'UserMonthlyQuest',
  'UserCollectionQuest',
  'UserAchievement',
  'UserRewards',
  'UserNotification',
  'ScanLike'
]);

const generateLegacyHexId = () => {
  try {
    if (typeof crypto?.getRandomValues === 'function') {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch (error) {
    console.warn('[Query] crypto.getRandomValues unavailable, falling back to Math.random()', error);
  }
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
};

const prepareInsertPayload = (tableName, record) => {
  if (!record) return record;
  if (legacyIdTables.has(tableName) && !record.id) {
    return { ...record, id: generateLegacyHexId() };
  }
  return record;
};

// Helper function to create entity queries
function createEntity(tableName) {
  return {
    list: async (orderBy = null, limit = null) => {
      let query = supabase.from(tableName).select('*');
      if (orderBy) {
        const [col, direction] = orderBy.startsWith('-') 
          ? [orderBy.slice(1), 'desc'] 
          : [orderBy, 'asc'];
        query = query.order(col, { ascending: direction === 'asc' });
      }
      if (limit) {
        query = query.limit(limit);
      }
      const { data, error } = await query;
      if (error) return handleMissingTable(tableName, error);
      return data || [];
    },
    filter: async (filters) => {
      let query = supabase.from(tableName).select('*');
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
      const { data, error } = await query;
      if (error) return handleMissingTable(tableName, error);
      return data || [];
    },
    create: async (record) => {
      const payload = prepareInsertPayload(tableName, record);
      const { data, error } = await supabase
        .from(tableName)
        .insert([payload])
        .select();
      if (error) throw error;
      return data?.[0] || payload;
    },
    update: async (id, record) => {
      const { data, error } = await supabase
        .from(tableName)
        .update(record)
        .eq('id', id)
        .select();
      if (error) throw error;
      return data?.[0] || record;
    },
    delete: async (id) => {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    },
    subscribe: (callback) => {
      const channel = supabase
        .channel(`public:${tableName}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          (payload) => {
            const eventType = payload.eventType?.toLowerCase() || 'unknown';
            const typeMap = {
              insert: 'create',
              update: 'update',
              delete: 'delete'
            };
            callback({
              type: typeMap[eventType] || eventType,
              data: payload.new || payload.old || null,
              old: payload.old || null,
              new: payload.new || null
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  };
}

// Export all tables as entities
// NOTE: Some DB tables use pluralized names (e.g. "Achievements").
// Where naming differs, we map them manually below.
const tables = [
  'Classroom', 'ClassroomMember', 'ClassroomQuest',
  'CollectionQuest', 'DailyQuest', 'Friend', 'MonthlyQuest',
  'News', 'Plant', 'PlantGenus', 'PublicProfile', 'Quest',
  'Referral', 'Rewards', 'ScanLike', 'SharedScan', 'UserAchievement',
  'UserCollectionQuest', 'UserDailyQuest', 'UserMonthlyQuest',
  'UserNotification', 'UserPlantDiscovery', 'UserQuest',
  'UserWeeklyQuest', 'WeeklyQuest',
  // Robot Plant core loop
  'RobotPlant', 'RobotPlantWalletLedger', 'RobotPlantZone',
  'RobotPlantUserZoneState', 'RobotPlantDailyChallenge', 'RobotPlantUserDailyChallenge',
  'RobotPlantShopItem', 'RobotPlantUserInventory', 'RobotPlantActiveEffect',
  // Collections & Classroom
  'Collection', 'CollectionItem', 'UserCollection',
  'ClassroomParticipant', 'ClassroomParticipantProgress'
];

const Query = {};
tables.forEach(table => {
  Query[table] = createEntity(table);
});

// Manual mappings for tables where the runtime name differs
// The SQL table is "public.Achievements" but the app uses Query.Achievement
Query.Achievement = createEntity('Achievements');
// The SQL table is "public.UserRewards" but the app uses Query.UserReward
Query.UserReward = createEntity('UserRewards');
// The SQL table is "public.Rewards" but the app uses Query.Reward
Query.Reward = createEntity('Rewards');

export { Query };
export const User = null; // Auth will be handled separately
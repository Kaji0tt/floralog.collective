// Supabase-based entity access
import { supabase } from './supabaseClient';

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
      if (error) throw error;
      return data || [];
    },
    filter: async (filters) => {
      let query = supabase.from(tableName).select('*');
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    create: async (record) => {
      const { data, error } = await supabase
        .from(tableName)
        .insert([record])
        .select();
      if (error) throw error;
      return data?.[0] || record;
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
    }
  };
}

// Export all tables as entities
const tables = [
  'Achievement', 'Classroom', 'ClassroomMember', 'ClassroomQuest',
  'CollectionQuest', 'DailyQuest', 'Friend', 'MonthlyQuest',
  'News', 'Plant', 'PlantGenus', 'PublicProfile', 'Quest',
  'Referral', 'Reward', 'ScanLike', 'SharedScan', 'UserAchievement',
  'UserCollectionQuest', 'UserDailyQuest', 'UserMonthlyQuest',
  'UserNotification', 'UserPlantDiscovery', 'UserQuest', 'UserReward',
  'UserWeeklyQuest', 'WeeklyQuest'
];

const Query = {};
tables.forEach(table => {
  Query[table] = createEntity(table);
});

export { Query };
export const User = null; // Auth will be handled separately
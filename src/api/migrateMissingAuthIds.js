import { supabase } from './supabaseClient';

export async function migrateMissingAuthIds(baseUser) {
  if (!baseUser?.auth_id || !baseUser?.email) return;

  async function migrateTable(table, emailField = 'created_by', authField = 'auth_id') {
    const { data: rows } = await supabase
      .from(table)
      .select('id')
      .is(authField, null)
      .eq(emailField, baseUser.email);
    if (rows && rows.length > 0) {
      for (const row of rows) {
        await supabase
          .from(table)
          .update({ [authField]: baseUser.auth_id })
          .eq('id', row.id);
      }
    }
  }

  await migrateTable('Friend');
  await migrateTable('PublicProfile');
  await migrateTable('Referral');
  await migrateTable('ScanLike');
  await migrateTable('UserAchievement');
  await migrateTable('UserMonthlyQuest');
  await migrateTable('UserNotification');
  await migrateTable('UserPlantDiscovery');
  await migrateTable('UserRewards');

  // SharedScan Spezialfall
  const { data: sharedFrom } = await supabase
    .from('SharedScan')
    .select('id')
    .is('auth_id_from', null)
    .eq('shared_by', baseUser.email);
  if (sharedFrom && sharedFrom.length > 0) {
    for (const row of sharedFrom) {
      await supabase
        .from('SharedScan')
        .update({ auth_id_from: baseUser.auth_id })
        .eq('id', row.id);
    }
  }
  const { data: sharedTo } = await supabase
    .from('SharedScan')
    .select('id')
    .is('auth_id_to', null)
    .eq('shared_to', baseUser.email);
  if (sharedTo && sharedTo.length > 0) {
    for (const row of sharedTo) {
      await supabase
        .from('SharedScan')
        .update({ auth_id_to: baseUser.auth_id })
        .eq('id', row.id);
    }
  }
}

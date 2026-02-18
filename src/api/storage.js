import { supabase } from './supabaseClient';

const DEFAULT_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'public';

export const uploadFile = async ({ file, bucket = DEFAULT_BUCKET, pathPrefix = 'uploads' } = {}) => {
  if (!file) {
    throw new Error('File is required');
  }

  const fileExt = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const fileName = `${pathPrefix}/${crypto.randomUUID()}.${fileExt}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream'
    });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return { file_url: data.publicUrl, path: fileName, bucket };
};

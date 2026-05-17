import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

export const db = createClient(config.supabase.url, config.supabase.serviceKey, {
  auth: { persistSession: false },
});

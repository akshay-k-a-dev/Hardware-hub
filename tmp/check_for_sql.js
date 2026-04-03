import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jdujbypzyrijkgcnzoog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWpieXB6eXJpamtnY256b29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MjEzMjcsImV4cCI6MjA4ODA5NzMyN30.IiQhZj9YmE19bD2SBFW71bUmbXtqYG1FypotwFSh5vY'
);

async function check() {
  try {
    const { data: items, error: iErr } = await supabase.from('hardware_items').select('id, name');
    if (iErr) console.error('Item Fetch Error:', iErr);
    console.log('--- HARDWARE ITEMS ---');
    console.log(JSON.stringify(items, null, 2));

    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, email, name');
    if (pErr) console.error('Profile Fetch Error:', pErr);
    console.log('--- PROFILES ---');
    console.log(JSON.stringify(profiles, null, 2));
  } catch (err) {
    console.error('Script Error:', err);
  }
}

check();

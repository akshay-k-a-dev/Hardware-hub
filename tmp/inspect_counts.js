import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jdujbypzyrijkgcnzoog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWpieXB6eXJpamtnY256b29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MjEzMjcsImV4cCI6MjA4ODA5NzMyN30.IiQhZj9YmE19bD2SBFW71bUmbXtqYG1FypotwFSh5vY'
);

async function inspect() {
  console.log("Checking hardware_items...");
  const { data: hi, error: e1 } = await supabase.from('hardware_items').select('count', { count: 'exact' });
  console.log("hardware_items count:", hi?.[0]?.count || 0, e1?.message || "");

  console.log("Checking requests...");
  const { data: req, error: e2 } = await supabase.from('requests').select('count', { count: 'exact' });
  console.log("requests count:", req?.[0]?.count || 0, e2?.message || "");

  console.log("List first 5 hardware_items names:");
  const { data: items } = await supabase.from('hardware_items').select('id, name').limit(5);
  console.log(items);
}

inspect();

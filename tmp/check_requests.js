import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jdujbypzyrijkgcnzoog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWpieXB6eXJpamtnY256b29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MjEzMjcsImV4cCI6MjA4ODA5NzMyN30.IiQhZj9YmE19bD2SBFW71bUmbXtqYG1FypotwFSh5vY'
);

async function inspect() {
  const { data: req, error } = await supabase.from('requests').select('*');
  console.log("Requests count:", req?.length || 0);
}

inspect();

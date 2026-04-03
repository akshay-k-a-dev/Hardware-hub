import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jdujbypzyrijkgcnzoog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWpieXB6eXJpamtnY256b29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MjEzMjcsImV4cCI6MjA4ODA5NzMyN30.IiQhZj9YmE19bD2SBFW71bUmbXtqYG1FypotwFSh5vY'
);

async function inspect() {
  console.log("Fetching hardware_items...");
  const { data, error } = await supabase.from('hardware_items').select('*');
  if (error) console.error("Error:", error);
  else console.log("Items found:", data.length);
  
  if (data && data.length > 0) {
    data.forEach(d => console.log(`- ${d.name} (${d.id})`));
  }
}

inspect();

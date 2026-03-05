import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  try {
    console.log('Starting seed script');

    const users = [
      { email: 'provider+dev@example.com', password: 'Password123!', name: 'Alice Provider', role: 'provider' },
      { email: 'student+dev@example.com', password: 'Password123!', name: 'Bob Student', role: 'student' },
    ];

    const createdUsers = [];

    for (const u of users) {
      console.log('Creating user:', u.email);
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        user_metadata: { name: u.name, role: u.role },
        email_confirm: true,
      });

      if (error) {
        console.error('Error creating user', u.email, error);
        continue;
      }

      const userId = data?.user?.id || data?.id || data?.user_id;
      console.log('Created user id:', userId);
      createdUsers.push({ ...u, id: userId });
    }

    // Wait for triggers to run and profiles to be created
    await new Promise((r) => setTimeout(r, 1500));

    // Fetch profiles
    const { data: profiles, error: profilesErr } = await supabase.from('profiles').select('*');
    if (profilesErr) {
      console.error('Error fetching profiles:', profilesErr);
    } else {
      console.log('Profiles in DB:', profiles.map((p) => ({ id: p.id, email: p.email, role: p.role })));
    }

    // Find provider and student profiles
    const providerProfile = profiles?.find((p) => p.email && p.email.includes('provider+dev')) || profiles?.find((p) => p.role === 'provider');
    const studentProfile = profiles?.find((p) => p.email && p.email.includes('student+dev')) || profiles?.find((p) => p.role === 'student');

    if (!providerProfile || !studentProfile) {
      console.warn('Could not find both provider and student profiles. Aborting hardware/request insertion.');
      return;
    }

    // Insert a sample hardware item owned by provider
    console.log('Inserting hardware item for provider:', providerProfile.id);
    const { data: hw, error: hwErr } = await supabase
      .from('hardware_items')
      .insert([
        {
          name: 'ESP32 DevKitC',
          category: 'Microcontroller',
          description: 'ESP32 development board for WiFi/Bluetooth projects',
          specs: { cores: 2, flash: '4MB' },
          owner_id: providerProfile.id,
          quantity_total: 5,
          quantity_available: 5,
          max_lending_days: 14,
          status: 'available',
        },
      ])
      .select()
      .single();

    if (hwErr) {
      console.error('Error inserting hardware:', hwErr);
      return;
    }

    console.log('Inserted hardware:', hw.id);

    // Insert a sample request from student for that hardware
    console.log('Inserting request from student:', studentProfile.id);
    const { data: req, error: reqErr } = await supabase
      .from('requests')
      .insert([
        {
          user_id: studentProfile.id,
          hardware_id: hw.id,
          quantity: 1,
          project_title: 'IoT Weather Station',
          project_description: 'Using ESP32 with sensors',
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (reqErr) {
      console.error('Error inserting request:', reqErr);
      return;
    }

    console.log('Inserted request:', req.id);
    console.log('Seed complete.');
  } catch (e) {
    console.error('Seed script failed:', e);
  }
}

run();

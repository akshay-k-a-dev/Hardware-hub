import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Using anon key might not work for bucket creation

async function setupStorage() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Attempting to create bucket: component-images');
    const { data, error } = await supabase.storage.createBucket('component-images', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif']
    });

    if (error) {
        if (error.message.includes('already exists')) {
            console.log('Bucket already exists.');
        } else {
            console.error('Error creating bucket:', error.message);
            console.log('NOTE: You may need to create the bucket manually in the Supabase Dashboard if the Anon key lacks permissions.');
        }
    } else {
        console.log('Bucket created successfully!');
    }
}

setupStorage();

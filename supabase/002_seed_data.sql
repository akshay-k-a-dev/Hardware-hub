-- ============================================================
-- HardwareHub — Seed Data
-- Run this in Supabase SQL Editor AFTER 001_initial_schema.sql
-- ============================================================
-- NOTE: You must first create 3 test users via Supabase Auth
-- (Dashboard → Authentication → Users → Add User) OR
-- sign up through the app. Then replace the UUIDs below with
-- the actual user IDs from your auth.users table.
--
-- Alternatively, run this block to auto-create users:
-- (Requires the handle_new_user trigger from 001_initial_schema.sql)

-- ─── Step 1: Create test users via auth.admin ────────────────
-- If you already signed up users through the app, skip this
-- and just update the variables below with their real UUIDs.

DO $$
DECLARE
  v_provider_id UUID;
  v_student_id  UUID;
  v_student2_id UUID;
  v_hw1 UUID;
  v_hw2 UUID;
  v_hw3 UUID;
  v_hw4 UUID;
  v_hw5 UUID;
  v_hw6 UUID;
  v_req1 UUID;
  v_req2 UUID;
BEGIN

  -- Look up existing users by email (they must already exist in profiles)
  SELECT id INTO v_provider_id FROM profiles WHERE email = 'provider@hardwarehub.com' LIMIT 1;
  SELECT id INTO v_student_id  FROM profiles WHERE email = 'student@hardwarehub.com'  LIMIT 1;
  SELECT id INTO v_student2_id FROM profiles WHERE email = 'student2@hardwarehub.com' LIMIT 1;

  -- If no provider found, try any provider
  IF v_provider_id IS NULL THEN
    SELECT id INTO v_provider_id FROM profiles WHERE role = 'provider' LIMIT 1;
  END IF;
  -- If still no provider, use any user
  IF v_provider_id IS NULL THEN
    SELECT id INTO v_provider_id FROM profiles LIMIT 1;
  END IF;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Please sign up at least one user through the app first.';
  END IF;

  -- Use student if exists, otherwise fall back to provider
  IF v_student_id IS NULL THEN
    SELECT id INTO v_student_id FROM profiles WHERE role = 'student' LIMIT 1;
  END IF;
  IF v_student_id IS NULL THEN
    v_student_id := v_provider_id;
  END IF;
  IF v_student2_id IS NULL THEN
    v_student2_id := v_student_id;
  END IF;

  -- ─── Hardware Items ──────────────────────────────────────
  INSERT INTO hardware_items (id, name, category, description, specs, owner_id, quantity_total, quantity_available, max_lending_days)
  VALUES
    (gen_random_uuid(), 'Arduino Uno R3', 'Microcontroller',
     'ATmega328P based microcontroller board with 14 digital I/O pins, 6 analog inputs, USB connection, and power jack. Perfect for beginners and prototyping.',
     '{"Processor": "ATmega328P", "Clock": "16 MHz", "Flash": "32 KB", "SRAM": "2 KB", "Voltage": "5V"}',
     v_provider_id, 25, 18, 30)
  RETURNING id INTO v_hw1;

  INSERT INTO hardware_items (id, name, category, description, specs, owner_id, quantity_total, quantity_available, max_lending_days)
  VALUES
    (gen_random_uuid(), 'Raspberry Pi 4 Model B', 'Single Board Computer',
     '4GB RAM variant with quad-core Cortex-A72 processor, dual micro-HDMI, USB 3.0, Gigabit Ethernet, and built-in WiFi/Bluetooth.',
     '{"RAM": "4 GB", "CPU": "Quad-core ARM Cortex-A72", "WiFi": "802.11ac", "Bluetooth": "5.0", "USB": "2x USB 3.0, 2x USB 2.0"}',
     v_provider_id, 15, 8, 21)
  RETURNING id INTO v_hw2;

  INSERT INTO hardware_items (id, name, category, description, specs, owner_id, quantity_total, quantity_available, max_lending_days)
  VALUES
    (gen_random_uuid(), 'HC-SR04 Ultrasonic Sensor', 'Sensor',
     'Ultrasonic distance measuring sensor module with 2cm to 400cm range and 3mm accuracy. Widely used in obstacle avoidance and distance measurement projects.',
     '{"Range": "2cm - 400cm", "Accuracy": "3mm", "Voltage": "5V", "Current": "15mA", "Frequency": "40kHz"}',
     v_provider_id, 40, 35, 30)
  RETURNING id INTO v_hw3;

  INSERT INTO hardware_items (id, name, category, description, specs, owner_id, quantity_total, quantity_available, max_lending_days)
  VALUES
    (gen_random_uuid(), 'NEMA 17 Stepper Motor', 'Motor',
     'Bipolar stepper motor with 1.8° step angle, commonly used in 3D printers, CNC machines, and robotics projects.',
     '{"Step Angle": "1.8°", "Holding Torque": "40 Ncm", "Voltage": "12V", "Current": "1.7A", "Shaft": "5mm"}',
     v_provider_id, 20, 16, 14)
  RETURNING id INTO v_hw4;

  INSERT INTO hardware_items (id, name, category, description, specs, owner_id, quantity_total, quantity_available, max_lending_days)
  VALUES
    (gen_random_uuid(), '0.96" OLED Display Module', 'Display',
     '128x64 pixel I2C OLED display module with SSD1306 driver. Ultra-thin, lightweight, and ideal for compact embedded projects.',
     '{"Resolution": "128x64", "Interface": "I2C", "Driver": "SSD1306", "Voltage": "3.3-5V", "Size": "0.96 inch"}',
     v_provider_id, 30, 28, 21)
  RETURNING id INTO v_hw5;

  INSERT INTO hardware_items (id, name, category, description, specs, owner_id, quantity_total, quantity_available, max_lending_days)
  VALUES
    (gen_random_uuid(), 'ESP32 DevKit V1', 'Microcontroller',
     'Dual-core 240MHz microcontroller with built-in WiFi and Bluetooth. Ideal for IoT projects with low power consumption and rich peripheral set.',
     '{"CPU": "Dual-core Xtensa LX6", "Clock": "240 MHz", "Flash": "4 MB", "WiFi": "802.11 b/g/n", "Bluetooth": "4.2 + BLE"}',
     v_provider_id, 20, 14, 21)
  RETURNING id INTO v_hw6;

  -- ─── Requests ──────────────────────────────────────────
  INSERT INTO requests (id, user_id, hardware_id, quantity, project_title, project_description, status, request_date)
  VALUES
    (gen_random_uuid(), v_student_id, v_hw1, 2, 'Smart Irrigation System',
     'Building an automated irrigation system for the campus garden using soil moisture sensors and Arduino. The system will monitor soil conditions and automatically water plants.',
     'pending', now() - interval '2 days')
  RETURNING id INTO v_req1;

  INSERT INTO requests (id, user_id, hardware_id, quantity, project_title, project_description, status, request_date, approval_date, issue_date, expected_return_date)
  VALUES
    (gen_random_uuid(), v_student_id, v_hw2, 1, 'Smart Irrigation – Edge Controller',
     'Using Raspberry Pi as the edge controller for the irrigation system with cloud connectivity and data logging dashboard.',
     'issued', now() - interval '10 days', now() - interval '9 days', now() - interval '8 days', now() + interval '13 days')
  RETURNING id INTO v_req2;

  -- Lending history for issued request
  INSERT INTO lending_history (request_id, condition_on_issue)
  VALUES (v_req2, 'Good – fully functional, includes power adapter and case');

  -- A returned request
  INSERT INTO requests (user_id, hardware_id, quantity, project_title, project_description, status, request_date, approval_date, issue_date, expected_return_date, actual_return_date)
  VALUES
    (v_student2_id, v_hw3, 3, 'Autonomous Robot Navigation',
     'Using ultrasonic sensors for obstacle detection and mapping in a line-following robot project.',
     'returned', now() - interval '30 days', now() - interval '29 days', now() - interval '28 days', now() - interval '14 days', now() - interval '16 days');

  -- A rejected request
  INSERT INTO requests (user_id, hardware_id, quantity, project_title, project_description, status, request_date, provider_notes)
  VALUES
    (v_student_id, v_hw4, 5, 'CNC Mini Plotter',
     'Building a small-scale CNC plotter for PCB etching.',
     'rejected', now() - interval '5 days', 'Sorry, we cannot lend 5 units at once. Please request 2 or fewer.');

  -- ─── Notifications ────────────────────────────────────
  INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES
    (v_provider_id, 'New Borrow Request', 'A student has requested 2x Arduino Uno R3 for "Smart Irrigation System". Please review.', 'approval', v_req1),
    (v_student_id, 'Hardware Issued', 'Hardware for "Smart Irrigation – Edge Controller" has been issued to you. Handle with care.', 'request_update', v_req2),
    (v_student_id, 'Request Rejected', 'Your request for "CNC Mini Plotter" was rejected. Check provider notes for details.', 'request_update', NULL),
    (v_student_id, 'Welcome to HardwareHub!', 'Start browsing available hardware components for your next project.', 'system', NULL);

  RAISE NOTICE '✅ Seed data inserted successfully!';
  RAISE NOTICE '   - 6 hardware items';
  RAISE NOTICE '   - 4 requests (pending, issued, returned, rejected)';
  RAISE NOTICE '   - 1 lending history record';
  RAISE NOTICE '   - 4 notifications';
END $$;

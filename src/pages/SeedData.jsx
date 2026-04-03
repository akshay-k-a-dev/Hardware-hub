import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Database, Loader2, CheckCircle } from 'lucide-react';

const DEMO_COMPONENTS = [
    {
        name: 'Arduino Uno R3',
        category: 'Microcontroller',
        description: 'The classic Arduino board, perfect for learning electronics and rapid prototyping.',
        specs: { 'MCU': 'ATmega328P', 'Voltage': '5V', 'Digital I/O': '14', 'Analog Input': '6' },
        quantity_total: 10,
        quantity_available: 10,
        location: 'Lab Shelf A1'
    },
    {
        name: 'Raspberry Pi 4 Model B (8GB)',
        category: 'Single Board Computer',
        description: 'High-performance single board computer for advanced projects and edge computing.',
        specs: { 'Processor': 'Broadcom BCM2711', 'RAM': '8GB LPDDR4', 'Bluetooth': '5.0', 'HDMI': '2x micro' },
        quantity_total: 5,
        quantity_available: 5,
        location: 'Storage Bin 4'
    },
    {
        name: 'HC-SR04 Ultrasonic Sensor',
        category: 'Sensor',
        description: 'Provides 2cm-400cm non-contact measurement function, ranging accuracy can reach up to 3mm.',
        specs: { 'Voltage': '5V', 'Current': '15mA', 'Frequency': '40Hz' },
        quantity_total: 20,
        quantity_available: 20,
        location: 'Sensors Box'
    },
    {
        name: 'L298N Motor Driver Module',
        category: 'Motor Driver',
        description: 'High voltage, high current dual full-bridge driver designed to accept standard TTL logic levels.',
        specs: { 'Operating Voltage': 'up to 46V', 'Total DC Current': '4A', 'Low Saturation Voltage': '1.2V' },
        quantity_total: 12,
        quantity_available: 12,
        location: 'Lab Shelf B2'
    },
    {
        name: 'ESP32 Development Board',
        category: 'Communication',
        description: 'Powerful, generic Wi-Fi+BT+BLE MCU module that targets a wide variety of applications.',
        specs: { 'Cores': 'Dual Core 240MHz', 'SRAM': '520KB', 'Flash': '4MB' },
        quantity_total: 15,
        quantity_available: 15,
        location: 'Wireless Bin'
    },
    {
        name: 'OLED Display 1.3 inch',
        category: 'Display',
        description: 'Compact 128x64 pixel monochrome OLED display with I2C interface.',
        specs: { 'Size': '1.3 inch', 'Resolution': '128x64', 'Driver': 'SH1106', 'Interface': 'I2C' },
        quantity_total: 8,
        quantity_available: 8,
        location: 'Display Cabinet'
    },
    {
        name: 'Digital Multimeter',
        category: 'Other',
        description: 'Professional grade digital multimeter for measuring voltage, current, and resistance.',
        specs: { 'Type': 'Auto-ranging', 'Display': 'LCD', 'Safety': 'CAT III 600V' },
        quantity_total: 4,
        quantity_available: 4,
        location: 'Equipment Rack'
    }
];

export default function SeedData() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [seeded, setSeeded] = useState(false);

    const seedData = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            const itemsToInsert = DEMO_COMPONENTS.map(item => ({
                ...item,
                owner_id: profile.id,
                is_active: true
            }));

            const { error } = await supabase
                .from('hardware_items')
                .insert(itemsToInsert);

            if (error) throw error;

            setSeeded(true);
            toast({
                title: "Success",
                description: "Seeded 7 demo components assigned to you.",
            });
        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: "Seeding failed",
                description: err.message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-8 border border-border/50 bg-card/60 backdrop-blur-xl rounded-3xl mt-20 text-center space-y-6">
            <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary border border-primary/20">
                <Database size={32} />
            </div>
            <div className="space-y-2">
                <h1 className="text-xl font-bold uppercase tracking-widest font-inter-tight">Seed Laboratory Data</h1>
                <p className="text-xs text-muted-foreground uppercase tracking-widest leading-relaxed">
                    This will add 7 realistic hardware components to your account for demonstration purposes.
                </p>
            </div>
            
            {seeded ? (
                <div className="flex items-center justify-center gap-2 text-emerald-500 font-bold uppercase text-[10px] tracking-[0.2em] bg-emerald-500/10 py-3 rounded-xl border border-emerald-500/20">
                    <CheckCircle size={14} />
                    Database Seeded Successfully
                </div>
            ) : (
                <Button 
                    onClick={seedData} 
                    disabled={loading || !profile}
                    className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold uppercase text-[10px] tracking-widest"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Seeding Protocol'}
                </Button>
            )}
            
            <p className="text-[9px] text-muted-foreground/40 uppercase tracking-tighter">
                Note: These items will be assigned to: {profile?.email || 'Unknown User'}
            </p>
        </div>
    );
}

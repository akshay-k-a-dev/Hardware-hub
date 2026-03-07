import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, MapPin, UploadCloud, Trash, Loader2 } from 'lucide-react';

const CATEGORIES = [
    'Microcontroller',
    'Single Board Computer',
    'Sensor',
    'Motor',
    'Motor Driver',
    'Display',
    'Communication',
    'Power Supply',
    'Other',
];

export default function AddComponentForm() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [form, setForm] = useState({
        name: '',
        category: 'Microcontroller',
        description: '',
        quantity_total: 1,
        max_lending_days: 14,
        specs: '',
    });

    const [delivery, setDelivery] = useState({ courier: false, offline: true });
    const [location, setLocation] = useState('');
    const [images, setImages] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [loading, setLoading] = useState(false);

    // Manage image previews to prevent memory leaks and performance issues
    useEffect(() => {
        if (images.length === 0) {
            setPreviews([]);
            return;
        }

        const newPreviews = images.map(file => ({
            file,
            url: URL.createObjectURL(file)
        }));

        setPreviews(newPreviews);

        // Cleanup function to revoke URLs
        return () => {
            newPreviews.forEach(p => URL.revokeObjectURL(p.url));
        };
    }, [images]);

    const handleChange = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleDeliveryChange = (field) => {
        setDelivery((prev) => ({ ...prev, [field]: !prev[field] }));
    };

    const handleFiles = (files) => {
        const arr = Array.from(files).slice(0, 5 - images.length);
        if (arr.length === 0) return;
        setImages((prev) => [...prev, ...arr].slice(0, 5));
    };

    const handleDrop = (e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    };

    const handleInputChange = (e) => {
        handleFiles(e.target.files);
    };

    const removeImage = (index) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const fillLocation = () => {
        if (!navigator.geolocation) {
            toast({
                variant: 'destructive',
                title: 'Geolocation Unsupported',
                description: 'Your browser does not support geolocation.',
            });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation(`${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
            },
            (err) => {
                toast({
                    variant: 'destructive',
                    title: 'Location Error',
                    description: err.message,
                });
            }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!profile) {
            toast({
                variant: 'destructive',
                title: 'Profile missing',
                description: 'Could not determine your user profile. Please reload and try again.',
            });
            return;
        }

        // check role for insert permission
        if (profile.role && !['provider', 'admin'].includes(profile.role)) {
            toast({
                variant: 'destructive',
                title: 'Permission denied',
                description: 'Only providers or admins may add components.',
            });
            return;
        }

        setLoading(true);

        try {
            console.log('[ADD_COMPONENT] Starting diagnostics...');
            console.log('[ADD_COMPONENT] Current profile:', profile);

            // Connection Test
            console.log('[ADD_COMPONENT] Connection Test: Fetching count...');
            try {
                const { count, error: countErr } = await Promise.race([
                    supabase.from('hardware_items').select('*', { count: 'exact', head: true }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('CONNECTION_TEST_TIMEOUT')), 10000))
                ]);

                if (countErr) {
                    console.error('[ADD_COMPONENT] Connection Test Result: ERROR', countErr);
                } else {
                    console.log('[ADD_COMPONENT] Connection Test Result: SUCCESS, Total items:', count);
                }
            } catch (ctErr) {
                console.error('[ADD_COMPONENT] Connection Test Result: FAILED (Hang/Timeout)', ctErr);
                toast({
                    variant: 'destructive',
                    title: 'Connection Issue',
                    description: 'Supabase is not responding. Please try hard-refreshing (Ctrl+F5) and ensure you only have ONE terminal running.',
                });
                return;
            }

            // parse specs
            let specsObj = {};
            if (form.specs.trim()) {
                const pairs = form.specs.split(/,|\n/);
                pairs.forEach((pair) => {
                    const colonIdx = pair.indexOf(':');
                    if (colonIdx > 0) {
                        const key = pair.substring(0, colonIdx).trim();
                        const val = pair.substring(colonIdx + 1).trim();
                        if (key && val) {
                            specsObj[key] = val;
                        }
                    }
                });
            }

            // prepared item data
            const itemData = {
                name: form.name,
                category: form.category,
                description: form.description,
                specs: specsObj,
                owner_id: profile.id,
                quantity_total: parseInt(form.quantity_total) || 1,
                quantity_available: parseInt(form.quantity_total) || 1,
                max_lending_days: parseInt(form.max_lending_days) || 14,
            };

            // 1. Insert item
            console.log('[ADD_COMPONENT] DB Insert START', {
                table: 'hardware_items',
                owner: profile.id,
                role: profile.role
            });

            // Create a timeout promise to catch hangs
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('DATABASE_INSERT_HANG: The request was sent but the database did not respond within 10 seconds. This usually happens due to RLS policy conflicts or browser extensions blocking the request.')), 10000);
            });

            const insertPromise = (async () => {
                try {
                    console.log('[ADD_COMPONENT] Executing insert...');
                    const result = await supabase
                        .from('hardware_items')
                        .insert(itemData)
                        .select('id');
                    console.log('[ADD_COMPONENT] Insert settled.');
                    return result;
                } catch (pe) {
                    console.error('[ADD_COMPONENT] Internal query error:', pe);
                    throw pe;
                }
            })();

            const { data: insertData, error: insertError } = await Promise.race([
                insertPromise,
                timeoutPromise
            ]);

            console.log('[ADD_COMPONENT] DB Insert RESPONSE', { data: insertData, error: insertError });

            if (insertError) {
                console.error('[ADD_COMPONENT] Supabase Error:', insertError);
                throw insertError;
            }

            const created = insertData && insertData.length > 0 ? insertData[0] : null;
            if (!created) {
                console.warn('[ADD_COMPONENT] No data returned');
                throw new Error('Record created but no ID returned. Please check if you have Provider permissions.');
            }

            console.log('[ADD_COMPONENT] Record created with ID:', created.id);

            // 2. Upload image if exists
            if (images.length > 0) {
                try {
                    console.log('[ADD_COMPONENT] Found images, starting upload...');
                    const file = images[0];
                    // Sanitize file name
                    const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                    const fileName = `${profile.id}/${Date.now()}-${cleanName}`;

                    console.log('[ADD_COMPONENT] Uploading to Storage bit:', fileName);
                    const { error: uploadError } = await supabase.storage
                        .from('component-images')
                        .upload(fileName, file, { cacheControl: '3600', upsert: false });

                    if (uploadError) throw uploadError;

                    console.log('[ADD_COMPONENT] Upload successful, getting public URL...');
                    const { data: { publicUrl } } = supabase.storage
                        .from('component-images')
                        .getPublicUrl(fileName);

                    // 3. Update item with image URL
                    console.log('[ADD_COMPONENT] Updating record with image URL:', publicUrl);
                    await supabase
                        .from('hardware_items')
                        .update({ image_url: publicUrl })
                        .eq('id', created.id);

                } catch (imgErr) {
                    console.error('[ADD_COMPONENT] Image sequence failed:', imgErr);
                    toast({
                        variant: 'default', // Using default since warning isn't supported
                        title: 'Component added without image',
                        description: 'The item was created but the image failed to upload.',
                    });
                }
            }

            console.log('[ADD_COMPONENT] Success! Navigating...');
            toast({
                title: 'Success',
                description: `${form.name} has been added to the lab.`,
            });

            navigate('/components');
        } catch (error) {
            console.error('[ADD_COMPONENT] Fatal Submit Error:', error);
            toast({
                variant: 'destructive',
                title: 'Add failed',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            console.log('[ADD_COMPONENT] Submission process finished.');
            setLoading(false);
        }
    };

    return (
        <Card className="border border-border bg-card shadow-lg rounded-[2.5rem] overflow-hidden relative">
            <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none">
                <PlusCircle size={250} />
            </div>
            <CardHeader className="py-8 px-10 border-b border-border bg-muted/20 relative">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                        <PlusCircle className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black tracking-tight">Hardware Details</CardTitle>
                        <CardDescription className="text-sm font-medium">
                            Tell us about this new device.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-10">
                <form id="add-component-form" onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <Label
                                htmlFor="name"
                                className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                            >
                                Item Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="name"
                                placeholder="e.g. NVIDIA Jetson Nano"
                                value={form.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                className="h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary/40 text-lg font-bold px-6 shadow-sm transition-colors"
                                required
                            />
                        </div>
                        <div className="space-y-3">
                            <Label
                                htmlFor="category"
                                className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                            >
                                Category <span className="text-destructive">*</span>
                            </Label>
                            <select
                                value={form.category}
                                onChange={(e) => handleChange('category', e.target.value)}
                                className="h-14 w-full rounded-2xl bg-muted/30 border border-border px-6 text-lg font-bold focus:outline-none focus-visible:ring-primary/20 focus-visible:border-primary/40 shadow-sm"
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* description and specs */}
                    <div className="space-y-3">
                        <Label
                            htmlFor="description"
                            className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                        >
                            Description
                        </Label>
                        <Textarea
                            id="description"
                            placeholder="Brief description or notes"
                            value={form.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            className="bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary/40 shadow-sm"
                            rows={3}
                        />
                    </div>
                    <div className="space-y-3">
                        <Label
                            htmlFor="specs"
                            className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                        >
                            Specifications
                        </Label>
                        <Input
                            id="specs"
                            placeholder="e.g. RAM: 8GB, Storage: 128GB"
                            value={form.specs}
                            onChange={(e) => handleChange('specs', e.target.value)}
                            className="h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary/40 text-lg font-bold px-6 shadow-sm transition-colors"
                        />
                    </div>

                    {/* delivery checkboxes */}
                    <div className="space-y-1">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Delivery Method(s)
                        </Label>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="courier"
                                    checked={delivery.courier}
                                    onCheckedChange={() => handleDeliveryChange('courier')}
                                />
                                <Label htmlFor="courier" className="text-sm">
                                    Courier Delivery
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="offline"
                                    checked={delivery.offline}
                                    onCheckedChange={() => handleDeliveryChange('offline')}
                                />
                                <Label htmlFor="offline" className="text-sm">
                                    Offline Pickup
                                </Label>
                            </div>
                        </div>
                    </div>

                    {/* location input */}
                    <div className="space-y-3">
                        <Label htmlFor="location" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Location
                        </Label>
                        <div className="flex gap-2 items-center">
                            <Input
                                id="location"
                                placeholder="City / Campus Name"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.preventDefault();
                                }}
                                className="h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary/40 text-lg font-bold px-6 shadow-sm transition-colors"
                            />
                            <Button variant="ghost" type="button" size="icon" onClick={fillLocation} title="Use My Location">
                                <MapPin className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {/* image upload */}
                    <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Images (optional)
                        </Label>
                        <div
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            className="border-dashed border-2 border-border rounded-2xl p-6 text-center cursor-pointer bg-muted/10"
                            onClick={() => document.getElementById('image-input').click()}
                        >
                            <input
                                type="file"
                                id="image-input"
                                className="hidden"
                                accept="image/*"
                                multiple
                                onChange={handleInputChange}
                            />
                            <UploadCloud className="mx-auto h-6 w-6 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Drag & drop or click to upload (max 5)
                            </p>
                        </div>
                        {previews.length > 0 && (
                            <div className="flex gap-4 flex-wrap">
                                {previews.map((preview, idx) => (
                                    <div key={idx} className="relative w-24 h-24">
                                        <img
                                            src={preview.url}
                                            alt="preview"
                                            className="object-cover w-full h-full rounded-lg"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full h-8 w-8 shadow-md hover:bg-destructive/90"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeImage(idx);
                                            }}
                                        >
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <CardFooter className="pt-4">
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                    Adding...
                                </>
                            ) : (
                                'Add component'
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </CardContent>
        </Card>
    );
}

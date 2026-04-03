import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, UploadCloud, Trash, Loader2 } from 'lucide-react';

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
        return () => newPreviews.forEach(p => URL.revokeObjectURL(p.url));
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
            toast({ variant: 'destructive', title: 'Geolocation Unsupported', description: 'Your browser does not support geolocation.' });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => setLocation(`${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`),
            (err) => toast({ variant: 'destructive', title: 'Location Error', description: err.message })
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!profile) {
            toast({ variant: 'destructive', title: 'Profile missing', description: 'Could not determine your user profile.' });
            return;
        }
        setLoading(true);
        try {
            let specsObj = {};
            if (form.specs.trim()) {
                const pairs = form.specs.split(/,|\n/);
                pairs.forEach((pair) => {
                    const colonIdx = pair.indexOf(':');
                    if (colonIdx > 0) {
                        const key = pair.substring(0, colonIdx).trim();
                        const val = pair.substring(colonIdx + 1).trim();
                        if (key && val) specsObj[key] = val;
                    }
                });
            }

            const itemData = {
                name: form.name,
                category: form.category,
                description: form.description,
                specs: specsObj,
                owner_id: profile.id,
                quantity_total: parseInt(form.quantity_total) || 1,
                quantity_available: parseInt(form.quantity_total) || 1,
                max_lending_days: parseInt(form.max_lending_days) || 14,
                location: location,
                delivery_courier: delivery.courier,
                delivery_offline: delivery.offline,
            };

            const { data: insertData, error: insertError } = await supabase
                .from('hardware_items')
                .insert(itemData)
                .select('id');

            if (insertError) throw insertError;
            const createdId = insertData?.[0]?.id;

            if (createdId && images.length > 0) {
                const file = images[0];
                const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                const fileName = `${profile.id}/${Date.now()}-${cleanName}`;
                const { error: uploadError } = await supabase.storage.from('component-images').upload(fileName, file);
                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage.from('component-images').getPublicUrl(fileName);
                    await supabase.from('hardware_items').update({ image_url: publicUrl }).eq('id', createdId);
                }
            }
            toast({ title: 'Success', description: `${form.name} has been added.` });
            navigate('/components');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Add failed', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    // Shared input classes
    const inputBase = "w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none transition-all";

    return (
        <div className="max-w-2xl mx-auto px-6 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-foreground">Hardware Details</h1>
                <p className="text-sm text-muted-foreground mt-1">Register new components or boards for the community.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Item Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-medium text-foreground">Item Name *</Label>
                    <Input
                        id="name"
                        placeholder="e.g. NVIDIA Jetson Nano"
                        value={form.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className={inputBase}
                        required
                    />
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                    <Label htmlFor="category" className="text-sm font-medium text-foreground">Category *</Label>
                    <select
                        id="category"
                        value={form.category}
                        onChange={(e) => handleChange('category', e.target.value)}
                        className={inputBase}
                    >
                        {CATEGORIES.map((c) => <option key={c} value={c} className="bg-card text-foreground">{c}</option>)}
                    </select>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-sm font-medium text-foreground">Description</Label>
                    <Textarea
                        id="description"
                        placeholder="Brief description or notes"
                        value={form.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        className={`${inputBase} min-h-[100px] h-auto py-2`}
                    />
                </div>

                {/* Specifications */}
                <div className="space-y-1.5">
                    <Label htmlFor="specs" className="text-sm font-medium text-foreground">Specifications</Label>
                    <Input
                        id="specs"
                        placeholder="e.g. RAM: 8GB, Storage: 128GB"
                        value={form.specs}
                        onChange={(e) => handleChange('specs', e.target.value)}
                        className={inputBase}
                    />
                </div>

                {/* Quantity and Days Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="quantity" className="text-sm font-medium text-foreground">No. of units *</Label>
                        <Input id="quantity" type="number" min="1" value={form.quantity_total} onChange={(e) => handleChange('quantity_total', e.target.value)} className={inputBase} required />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="days" className="text-sm font-medium text-foreground">Max Lending Days</Label>
                        <Input id="days" type="number" min="1" value={form.max_lending_days} onChange={(e) => handleChange('max_lending_days', e.target.value)} className={inputBase} />
                    </div>
                </div>

                {/* Delivery Options */}
                <div className="space-y-2 pt-2">
                    <Label className="text-sm font-medium text-foreground mb-1 block">Delivery Methods</Label>
                    <div className="flex flex-col gap-3 p-4 bg-muted/20 border border-border rounded-lg">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <Checkbox id="courier" checked={delivery.courier} onCheckedChange={() => handleDeliveryChange('courier')} />
                            <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors selection:bg-transparent">Courier Delivery</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <Checkbox id="offline" checked={delivery.offline} onCheckedChange={() => handleDeliveryChange('offline')} />
                            <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors selection:bg-transparent">Offline Pickup</span>
                        </label>
                    </div>
                </div>

                {/* Location */}
                <div className="space-y-1.5 pt-2">
                    <Label htmlFor="location" className="text-sm font-medium text-foreground">Location</Label>
                    <div className="relative group">
                        <Input
                            id="location"
                            placeholder="City / Campus Name"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className={`${inputBase} pr-10`}
                        />
                        <button type="button" onClick={fillLocation} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all">
                            <MapPin size={16} />
                        </button>
                    </div>
                </div>

                {/* Images */}
                <div className="space-y-2 pt-2">
                    <Label className="text-sm font-medium text-foreground">Images (optional)</Label>
                    <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => document.getElementById('image-input').click()}
                        className="border-dashed border-2 border-border rounded-lg p-8 text-center cursor-pointer bg-muted/10 hover:bg-muted/20 transition-all group"
                    >
                        <input type="file" id="image-input" className="hidden" accept="image/*" multiple onChange={handleInputChange} />
                        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground group-hover:text-foreground transition-colors mb-2" />
                        <p className="text-sm font-medium text-foreground group-hover:text-foreground">Drag & drop or click to upload</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Maximum 5 images supported</p>
                    </div>
                    {previews.length > 0 && (
                        <div className="flex gap-3 flex-wrap mt-4">
                            {previews.map((p, i) => (
                                <div key={i} className="relative w-20 h-20 group rounded-md overflow-hidden border border-border shadow-sm">
                                    <img src={p.url} className="w-full h-full object-cover" />
                                    <button onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash size={18} className="text-white" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Submit */}
                <div className="mt-8 pt-4">
                    <Button type="submit" disabled={loading} className="w-full h-11 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-widest text-xs shadow-lg transition-all active:scale-[0.98]">
                        {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                        {loading ? 'Adding component...' : 'Add component'}
                    </Button>
                </div>
            </form>
        </div>
    );
}

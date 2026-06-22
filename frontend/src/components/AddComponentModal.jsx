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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

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

export default function AddComponentModal({ open, onOpenChange }) {
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
        is_high_value: false,
    });

    const [delivery, setDelivery] = useState({ courier: false, offline: true });
    const [location, setLocation] = useState('');
    const [images, setImages] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

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
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
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
                is_high_value: form.is_high_value,
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
            onOpenChange(false);
            if (window.location.pathname === '/components') {
                window.location.reload();
            } else {
                navigate('/components');
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Add failed', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const inputBase = "w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none transition-all";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg w-full bg-background rounded-xl p-0 overflow-hidden border-border shadow-2xl">
                <DialogHeader className="p-5 border-b border-border bg-muted/20">
                    <DialogTitle className="text-xl font-bold text-foreground">Item Details</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">Add a new hardware item for others to borrow.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-sm font-medium text-foreground">Item Name *</Label>
                            <Input id="name" placeholder="e.g. Jetson Nano" value={form.name} onChange={(e) => handleChange('name', e.target.value)} className={inputBase} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="category" className="text-sm font-medium text-foreground">Category *</Label>
                            <select id="category" value={form.category} onChange={(e) => handleChange('category', e.target.value)} className={inputBase}>
                                {CATEGORIES.map((c) => <option key={c} value={c} className="bg-card text-foreground">{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="description" className="text-sm font-medium text-foreground">Description</Label>
                        <Textarea id="description" placeholder="Brief notes" value={form.description} onChange={(e) => handleChange('description', e.target.value)} className={`${inputBase} min-h-[70px] h-auto py-2`} />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="specs" className="text-sm font-medium text-foreground">Specifications</Label>
                        <Input id="specs" placeholder="e.g. RAM: 8GB" value={form.specs} onChange={(e) => handleChange('specs', e.target.value)} className={inputBase} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="quantity" className="text-sm font-medium text-foreground">Quantity</Label>
                            <Input id="quantity" type="number" min="1" value={form.quantity_total} onChange={(e) => handleChange('quantity_total', e.target.value)} className={inputBase} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="days" className="text-sm font-medium text-foreground">Max Borrow Days</Label>
                            <Input id="days" type="number" min="1" value={form.max_lending_days} onChange={(e) => handleChange('max_lending_days', e.target.value)} className={inputBase} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-foreground block">How to Get It</Label>
                            <div className="flex flex-col gap-1.5 p-2.5 bg-muted/20 border border-border rounded-lg">
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <Checkbox id="courier" checked={delivery.courier} onCheckedChange={() => handleDeliveryChange('courier')} />
                                    <span className="text-[10px] font-bold uppercase text-foreground/80 group-hover:text-foreground">Courier</span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <Checkbox id="offline" checked={delivery.offline} onCheckedChange={() => handleDeliveryChange('offline')} />
                                    <span className="text-[10px] font-bold uppercase text-foreground/80 group-hover:text-foreground">Pickup</span>
                                </label>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-foreground block">Item Value</Label>
                            <div className="flex flex-col gap-1.5 p-2.5 bg-muted/20 border border-border rounded-lg">
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <Checkbox id="high_value" checked={form.is_high_value} onCheckedChange={(val) => handleChange('is_high_value', val)} />
                                    <span className="text-[10px] font-bold uppercase text-amber-500/80 group-hover:text-amber-500">Expensive Item</span>
                                </label>
                                <p className="text-[9px] text-muted-foreground ml-6 leading-tight">Check this if the item is expensive and should have stricter borrow limits.</p>
                            </div>
                        </div>
                        <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <Label htmlFor="location" className="text-sm font-medium text-foreground">Location</Label>
                            <div className="relative group">
                                <Input id="location" placeholder="City / room" value={location} onChange={(e) => setLocation(e.target.value)} className={`${inputBase} pr-10`} />
                                <button type="button" onClick={fillLocation} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <MapPin size={13} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <Label className="text-sm font-medium text-foreground">Images (optional)</Label>
                        <div
                            onClick={() => document.getElementById('image-input-modal').click()}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={() => setIsDragging(false)}
                            className={`border-dashed border rounded-lg p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-foreground bg-muted/30' : 'border-border bg-muted/10 hover:bg-muted/20'}`}
                        >
                            <input type="file" id="image-input-modal" className="hidden" accept="image/*" multiple onChange={handleInputChange} />
                            <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-xs font-medium text-foreground">Drop, click, or paste image (Max 5)</p>
                        </div>
                        {previews.length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-2">
                                {previews.map((p, i) => (
                                    <div key={i} className="relative w-14 h-14 group rounded-md overflow-hidden border border-border">
                                        <img src={p.url} className="w-full h-full object-cover" />
                                        <button onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash size={14} className="text-white" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </form>

                <DialogFooter className="p-5 border-t border-border bg-muted/10">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs font-bold uppercase tracking-widest">Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="h-10 px-8 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-widest text-xs">
                        {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : 'Add Item'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

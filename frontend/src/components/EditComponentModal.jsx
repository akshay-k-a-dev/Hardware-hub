import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UploadCloud, Trash, MapPin } from 'lucide-react';

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

export default function EditComponentModal({ item, open, onOpenChange, onSave }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        category: '',
        description: '',
        quantity_total: 1,
        max_lending_days: 14,
        specs: '',
        location: '',
        delivery_courier: false,
        delivery_offline: true,
        is_active: true,
    });
    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    useEffect(() => {
        if (item && open) {
            setForm({
                name: item.name || '',
                category: item.category || 'Microcontroller',
                description: item.description || '',
                quantity_total: item.quantity_total || 1,
                max_lending_days: item.max_lending_days || 14,
                specs: item.specs ? Object.entries(item.specs).map(([k, v]) => `${k}:${v}`).join('\n') : '',
                location: item.location || '',
                delivery_courier: !!item.delivery_courier,
                delivery_offline: !!item.delivery_offline,
                is_active: item.is_active !== false,
            });
            setPreviewUrl(item.image_url);
            setImageFile(null);
        }
    }, [item, open]);

    const handleChange = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    // Global Paste Listener when modal is open
    useEffect(() => {
        if (!open) return;
        
        const handlePaste = (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.type.indexOf('image') === 0) {
                    const file = item.getAsFile();
                    setImageFile(file);
                    setPreviewUrl(URL.createObjectURL(file));
                    toast({ title: 'Image pasted', description: 'New item image added from clipboard.' });
                    break;
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [open]);
    const fillLocation = () => {
        if (!navigator.geolocation) {
            toast({ variant: 'destructive', title: 'Geolocation Unsupported', description: 'Your browser does not support geolocation.' });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => handleChange('location', `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
            (err) => toast({ variant: 'destructive', title: 'Location Error', description: err.message })
        );
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
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

            const { id: itemId, owner_id } = item;
            
            const updates = {
                name: form.name,
                category: form.category,
                description: form.description,
                specs: specsObj,
                quantity_total: parseInt(form.quantity_total),
                max_lending_days: parseInt(form.max_lending_days),
                location: form.location,
                delivery_courier: form.delivery_courier,
                delivery_offline: form.delivery_offline,
                is_active: form.is_active,
                updated_at: new Date().toISOString(),
            };

            // Calculate new quantity_available correctly
            const totalDiff = updates.quantity_total - item.quantity_total;
            updates.quantity_available = Math.max(0, item.quantity_available + totalDiff);

            // Handle image upload if new file
            if (imageFile) {
                const cleanName = imageFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
                const fileName = `${owner_id}/${Date.now()}-${cleanName}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('component-images')
                    .upload(fileName, imageFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('component-images')
                    .getPublicUrl(fileName);
                
                updates.image_url = publicUrl;
            }

            const { data, error } = await supabase
                .from('hardware_items')
                .update(updates)
                .eq('id', itemId)
                .select();

            if (error) throw error;
            
            toast({ title: 'Saved', description: 'Item updated successfully.' });
            onSave();
            onOpenChange(false);
        } catch (err) {
            console.error('Update failed:', err);
            toast({
                variant: 'destructive',
                title: 'Update failed',
                description: err.message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto bg-card border-border/50 text-foreground rounded-[var(--card-radius)] p-0 shadow-2xl backdrop-blur-xl">
                <DialogHeader className="p-6 border-b border-border/10 bg-muted/20">
                    <DialogTitle className="text-xl font-semibold tracking-tight font-inter-tight text-foreground">Edit Item</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-1">Update item details.</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Primary Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground/80">Item Name</Label>
                            <Input 
                                value={form.name} 
                                onChange={(e) => handleChange('name', e.target.value)}
                                className="h-10 bg-muted/30 border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground/80">Category</Label>
                            <select
                                value={form.category}
                                onChange={(e) => handleChange('category', e.target.value)}
                                className="h-10 w-full rounded-xl bg-muted/30 border-border/50 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 text-foreground"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground/80">Description</Label>
                        <Textarea 
                            value={form.description} 
                            onChange={(e) => handleChange('description', e.target.value)}
                            className="bg-muted/30 border-border/50 rounded-xl text-sm min-h-[90px] resize-none"
                            placeholder="Add a brief summary of the component..."
                        />
                    </div>

                    {/* Inventory & Rules */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground/80">Quantity</Label>
                            <Input 
                                type="number"
                                value={form.quantity_total} 
                                onChange={(e) => handleChange('quantity_total', e.target.value)}
                                className="h-10 bg-muted/30 border-border/50 rounded-xl text-sm text-foreground"
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground/80">Max Borrow Days</Label>
                            <Input 
                                type="number"
                                value={form.max_lending_days} 
                                onChange={(e) => handleChange('max_lending_days', e.target.value)}
                                className="h-10 bg-muted/30 border-border/50 rounded-xl text-sm text-foreground"
                            />
                        </div>
                    </div>

                    {/* Technical & Physical */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground/80">Specifications</Label>
                            <Input 
                                value={form.specs} 
                                onChange={(e) => handleChange('specs', e.target.value)}
                                className="h-10 bg-muted/30 border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40"
                                placeholder="e.g. RAM: 8GB, Pins: 40"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground/80">Location</Label>
                            <div className="relative group">
                                <Input 
                                    value={form.location} 
                                    onChange={(e) => handleChange('location', e.target.value)}
                                    className="h-10 bg-muted/30 border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 pr-10"
                                    placeholder="e.g. Lab 402, Shelf B"
                                />
                                <button 
                                    type="button" 
                                    onClick={fillLocation} 
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all"
                                    title="Get current location"
                                >
                                    <MapPin size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Availability & Delivery */}
                    <div className="grid grid-cols-3 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/5">
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                id="edit-courier"
                                checked={form.delivery_courier} 
                                onChange={(e) => handleChange('delivery_courier', e.target.checked)}
                                className="h-4 w-4 rounded-md border-border bg-background text-foreground focus:ring-1 focus:ring-foreground/20"
                            />
                            <Label htmlFor="edit-courier" className="text-xs font-semibold text-muted-foreground cursor-pointer">Courier</Label>
                        </div>
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                id="edit-offline"
                                checked={form.delivery_offline} 
                                onChange={(e) => handleChange('delivery_offline', e.target.checked)}
                                className="h-4 w-4 rounded-md border-border bg-background text-foreground focus:ring-1 focus:ring-foreground/20"
                            />
                            <Label htmlFor="edit-offline" className="text-xs font-semibold text-muted-foreground cursor-pointer">Offline</Label>
                        </div>
                        <div className="flex items-center gap-3 border-l border-border/10 pl-4">
                            <input 
                                type="checkbox" 
                                id="edit-active"
                                checked={form.is_active} 
                                onChange={(e) => handleChange('is_active', e.target.checked)}
                                className="h-4 w-4 rounded-md border-emerald-500/50 bg-background text-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                            />
                            <Label htmlFor="edit-active" className="text-xs font-bold text-foreground cursor-pointer tracking-tight">Active</Label>
                        </div>
                    </div>

                    {/* Media */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground/80">Upload Image</Label>
                        <div className="flex items-center gap-4">
                            {previewUrl && (
                                <div className="relative h-20 w-20 rounded-2xl overflow-hidden border border-border/20 shrink-0 shadow-lg">
                                    <img src={previewUrl} className="h-full w-full object-contain bg-zinc-950/20" />
                                    <button 
                                        type="button"
                                        onClick={() => { setPreviewUrl(null); setImageFile(null); }}
                                        className="absolute top-1.5 right-1.5 bg-background/80 hover:bg-background backdrop-blur-md text-foreground rounded-full p-1.5 transition-all shadow-sm"
                                    >
                                        <Trash className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                            <div 
                                onClick={() => document.getElementById('edit-image-input').click()}
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                className="flex-1 h-20 border-2 border-dashed border-border/40 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-muted/10 transition-all group relative overflow-hidden"
                            >
                                <div className="flex items-center gap-3 text-muted-foreground group-hover:text-foreground transition-colors">
                                    <UploadCloud className="h-5 w-5" />
                                    <span className="text-xs font-medium">Drop, click, or paste image</span>
                                </div>
                                <input id="edit-image-input" type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t border-border/10">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground font-medium rounded-xl">Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-foreground text-background hover:bg-foreground/90 rounded-xl h-11 px-8 font-bold shadow-xl shadow-foreground/5 transition-all active:scale-95">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

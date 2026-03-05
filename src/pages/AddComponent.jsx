import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    PlusCircle,
    ArrowLeft,
    Package,
    Settings,
    Activity,
    Zap,
    Wifi,
    Battery,
    Monitor,
    Radio,
    Box,
    ClipboardList,
    AlertCircle,
    HelpCircle,
    Clock,
    Briefcase,
    Server,
    Cpu,
    ArrowRightCircle,
    Loader2,
    Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

const CATEGORIES = [
    'Microcontroller', 'Single Board Computer', 'Sensor',
    'Motor', 'Motor Driver', 'Display', 'Communication',
    'Power Supply', 'Other',
];

export default function AddComponent() {
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
    const [loading, setLoading] = useState(false);

    const handleChange = (name, value) => {
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Parse specs string into JSON
        let specsObj = {};
        if (form.specs.trim()) {
            try {
                form.specs.split(/[,\n]/).forEach((pair) => {
                    const [key, ...vals] = pair.split(':');
                    if (key && vals.length) {
                        specsObj[key.trim()] = vals.join(':').trim();
                    }
                });
            } catch {
                toast({
                    variant: "destructive",
                    title: "Invalid specifications schema",
                    description: 'Ensure you use "Key: Value" formatting separated by commas or newlines.',
                });
                setLoading(false);
                return;
            }
        }

        try {
            const { error: insertError } = await supabase.from('hardware_items').insert({
                name: form.name,
                category: form.category,
                description: form.description,
                specs: specsObj,
                owner_id: profile.id,
                quantity_total: parseInt(form.quantity_total),
                quantity_available: parseInt(form.quantity_total),
                max_lending_days: parseInt(form.max_lending_days),
            });

            if (insertError) throw insertError;

            toast({
                title: "Component Added",
                description: `${form.name} is now available in the Hardware Lab.`,
            });
            navigate('/components');
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Failed to Add",
                description: error.message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 p-2 md:p-0">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="group h-12 px-6 rounded-2xl bg-card border border-border hover:bg-primary/5 hover:border-primary/20 hover:text-primary font-black text-xs uppercase tracking-widest transition-all shadow-sm"
                    onClick={() => navigate('/components')}
                >
                    <ArrowLeft className="h-4 w-4 mr-3 transition-transform group-hover:-translate-x-2" />
                    Back to Lab
                </Button>
            </header>

            <div className="flex items-center gap-5 px-1">
                <div className="h-16 w-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Box size={32} />
                </div>
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-1">Add to Lab</h1>
                    <p className="text-muted-foreground text-lg font-medium">Register new components or boards for students to use.</p>
                </div>
            </div>

            <Card className="border border-border bg-card shadow-lg rounded-[2.5rem] overflow-hidden group">
                <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                    <Cpu size={250} />
                </div>

                <CardHeader className="py-8 px-10 border-b border-border bg-muted/20 relative">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                            <PlusCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black tracking-tight">Hardware Details</CardTitle>
                            <CardDescription className="text-sm font-medium">Tell us about this new device.</CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-10 relative">
                    <form id="add-component-form" onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
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
                                <Label htmlFor="category" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                    Category <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={form.category}
                                    onValueChange={(val) => handleChange('category', val)}
                                >
                                    <SelectTrigger id="category" className="h-14 bg-muted/30 border border-border rounded-2xl focus:ring-primary/20 focus:border-primary/40 text-lg font-bold px-6 shadow-sm transition-colors">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border border-border rounded-2xl shadow-xl">
                                        {CATEGORIES.map((cat) => (
                                            <SelectItem key={cat} value={cat} className="font-bold py-3 cursor-pointer focus:bg-primary/10 focus:text-primary rounded-xl mx-1 my-0.5">
                                                {cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Detail the component's capabilities, intended applications, and general requirements..."
                                className="min-h-[140px] bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary/40 text-lg font-medium p-6 shadow-sm transition-colors leading-relaxed"
                                value={form.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="quantity_total" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                        Total Units <span className="text-destructive">*</span>
                                    </Label>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <HelpCircle className="h-4 w-4 text-muted-foreground/40 hover:text-primary transition-colors cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-card border-border/40 font-bold px-4 py-3 rounded-xl shadow-xl">
                                                <p className="w-64 text-sm leading-relaxed">How many of these units are we adding to the lab today?</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <Input
                                    id="quantity_total"
                                    type="number"
                                    min="1"
                                    value={form.quantity_total}
                                    onChange={(e) => handleChange('quantity_total', e.target.value)}
                                    className="h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary/40 text-lg font-bold px-6 shadow-sm transition-colors tabular-nums"
                                    required
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="max_lending_days" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                        Return Policy (Days) <span className="text-destructive">*</span>
                                    </Label>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <HelpCircle className="h-4 w-4 text-muted-foreground/40 hover:text-primary transition-colors cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-card border-border/40 font-bold px-4 py-3 rounded-xl shadow-xl">
                                                <p className="w-64 text-sm leading-relaxed">How many days can a student keep this item? They'll get an alert when it's due.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <Input
                                    id="max_lending_days"
                                    type="number"
                                    min="1"
                                    value={form.max_lending_days}
                                    onChange={(e) => handleChange('max_lending_days', e.target.value)}
                                    className="h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary/40 text-lg font-bold px-6 shadow-sm transition-colors tabular-nums"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-3 bg-muted/10 p-6 rounded-3xl border border-border">
                            <Label htmlFor="specs" className="flex items-center gap-3">
                                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Specifications</span>
                            </Label>
                            <Textarea
                                id="specs"
                                placeholder={"Architecture: ARM Cortex-A57\nCUDA Cores: 128\nMemory: 4GB 64-bit LPDDR4"}
                                className="min-h-[140px] font-mono text-sm bg-background/50 border border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary/40 p-6 shadow-sm transition-colors leading-loose placeholder:opacity-50"
                                value={form.specs}
                                onChange={(e) => handleChange('specs', e.target.value)}
                            />
                            <div className="flex items-center gap-3 mt-4 bg-primary/5 px-5 py-3 rounded-xl border border-primary/10">
                                <Info className="h-5 w-5 text-primary/60 shrink-0" />
                                <p className="text-xs text-muted-foreground font-black tracking-widest uppercase relative top-[1px]">
                                    Format: <span className="text-primary opacity-80">Attribute: Value</span> (one per line)
                                </p>
                            </div>
                        </div>
                    </form>
                </CardContent>

                <CardFooter className="bg-muted/10 border-t-2 border-border/40 p-8 flex justify-end gap-4 relative">
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-14 px-8 rounded-2xl font-black uppercase text-xs tracking-widest border-2 border-border/40 hover:bg-muted/40 transition-all"
                        onClick={() => navigate('/components')}
                    >
                        Discard
                    </Button>
                    <Button
                        form="add-component-form"
                        type="submit"
                        disabled={loading}
                        className="h-14 px-10 rounded-2xl font-black uppercase text-xs tracking-widest shadow-[0_15px_30px_-10px_rgba(var(--primary),0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-primary-foreground flex items-center gap-3"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                List Item
                                <ArrowRightCircle className="h-5 w-5" />
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

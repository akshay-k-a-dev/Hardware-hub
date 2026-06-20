import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Search,
    Cpu,
    Settings,
    Activity,
    Wifi,
    Battery,
    Monitor,
    Radio,
    Box,
    LayoutGrid,
    Trash2,
    ChevronDown,
    CheckCircle2,
    XCircle,
    Package,
    Clock,
    CheckSquare,
    LayoutDashboard,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ComponentCard from '@/components/ComponentCard';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const CATEGORIES = [
    { label: 'All', value: 'All', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { label: 'Microcontroller', value: 'Microcontroller', icon: <Cpu className="h-3.5 w-3.5" /> },
    { label: 'SBC', value: 'Single Board Computer', icon: <Monitor className="h-3.5 w-3.5" /> },
    { label: 'Sensor', value: 'Sensor', icon: <Activity className="h-3.5 w-3.5" /> },
    { label: 'Motor', value: 'Motor', icon: <Settings className="h-3.5 w-3.5" /> },
    { label: 'Motor Driver', value: 'Motor Driver', icon: <Radio className="h-3.5 w-3.5" /> },
    { label: 'Display', value: 'Display', icon: <Monitor className="h-3.5 w-3.5" /> },
    { label: 'Communication', value: 'Communication', icon: <Wifi className="h-3.5 w-3.5" /> },
    { label: 'Power Supply', value: 'Power Supply', icon: <Battery className="h-3.5 w-3.5" /> },
    { label: 'Other', value: 'Other', icon: <Box className="h-3.5 w-3.5" /> },
];

const AVAILABILITY_OPTIONS = [
    { label: 'All Items', value: 'all' },
    { label: 'In Stock', value: 'in_stock' },
    { label: 'Out of Stock', value: 'out_of_stock' },
];

export default function Components() {
    const navigate = useNavigate();
    const { isStudent, profile } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [availability, setAvailability] = useState('all');
    const [summary, setSummary] = useState({ total: 0, available: 0, myPending: 0 });

    const hasActiveFilters = search || category !== 'All' || availability !== 'all';

    const loadItems = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('hardware_items')
            .select('*, owner:profiles!hardware_items_owner_id_fkey(id, name, email, lab_name)')
            .order('created_at', { ascending: false });

        if (isStudent) query = query.eq('is_active', true);

        if (search.trim()) {
            query = query.or(`name.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
        }
        if (category !== 'All') {
            query = query.eq('category', category);
        }
        if (availability === 'in_stock') {
            query = query.gt('quantity_available', 0);
        } else if (availability === 'out_of_stock') {
            query = query.eq('quantity_available', 0);
        }

        const { data, error } = await query;
        if (error) {
            console.error(error);
            setItems([]);
            setLoading(false);
            return;
        }

        const filteredData = (data || []).filter(item => {
            // Must have a valid image URL (not empty, not placehold.it)
            if (!item.image_url || item.image_url.includes('placehold')) return false;

            // Name must be substantial and not sound like a test/placeholder
            const lowerName = (item.name || "").toLowerCase();
            const placeholderKeywords = ['test', 'sample', 'placeholder', 'asdf', 'demo', 'item'];
            if (placeholderKeywords.some(keyword => lowerName === keyword)) return false;

            // Description must be meaningful
            if (!item.description || item.description.length < 15) return false;

            return true;
        });

        // REPETITION CLEANUP: Deduplicate by name and owner (same component from same lab)
        const dedupedMap = new Map();
        filteredData.forEach(item => {
            const key = `${(item.name || "").toLowerCase().trim()}_${item.owner_id}`;
            if (!dedupedMap.has(key)) {
                dedupedMap.set(key, item);
            }
        });

        setItems(Array.from(dedupedMap.values()));
        setLoading(false);
    }, [search, category, availability, isStudent]);

    // Load summary stats once on mount
    const loadSummary = useCallback(async () => {
        if (!profile) return;
        const [{ count: total }, { count: available }, { count: myPending }] = await Promise.all([
            supabase.from('hardware_items').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('hardware_items').select('*', { count: 'exact', head: true }).eq('is_active', true).gt('quantity_available', 0),
            supabase.from('requests').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status', 'pending'),
        ]);
        setSummary({ total: total || 0, available: available || 0, myPending: myPending || 0 });
    }, [profile]);

    useEffect(() => { loadSummary(); }, [loadSummary]);

    useEffect(() => {
        const timer = setTimeout(() => loadItems(), search ? 350 : 0);
        return () => clearTimeout(timer);
    }, [loadItems, search]);

    const clearFilters = () => {
        setSearch('');
        setCategory('All');
        setAvailability('all');
    };

    const activeAvailabilityLabel = AVAILABILITY_OPTIONS.find(o => o.value === availability)?.label;

    return (
        <div className="flex flex-col gap-0 max-w-[1400px] mx-auto animate-in fade-in duration-500 relative p-0 md:p-6 lg:px-0 bg-background/50">
            {/* Ambient Background Accents */}
            <div className="absolute -top-40 -left-40 h-80 w-80 bg-white/[0.02] rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute top-1/2 -right-40 h-80 w-80 bg-white/[0.015] rounded-full blur-[100px] pointer-events-none" />
            
            {/* ── Mobile/Desktop Header (Non-sticky for better visibility) ── */}
            <div className="relative z-10 p-4 md:p-0">
                <div className="flex flex-col gap-3">
                    
                    {/* Header Row: Title & Total */}
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg md:text-2xl font-black tracking-tight text-foreground uppercase tracking-widest flex items-center gap-2">
                                <LayoutDashboard className="h-5 w-5 md:hidden" />
                                Available Items
                            </h1>
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted/20 px-2 py-0.5 rounded-full border border-border/40 uppercase tracking-widest">
                                {summary.total}
                            </span>
                        </div>
                    </div>

                    {/* Search Row: Centered Focus */}
                    <div className="w-full md:max-w-2xl">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                            <Input
                                placeholder="Search items..."
                                className="pl-11 h-12 md:h-11 text-xs bg-muted/40 border-border/50 shadow-none rounded-2xl md:rounded-xl focus-visible:ring-1 focus-visible:ring-foreground transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all"
                                >
                                    <XCircle className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Desktop-only Filters */}
                    <div className="hidden md:flex items-center gap-2">
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`h-11 px-4 gap-2 text-[10px] font-semibold uppercase tracking-widest border-border rounded-xl shadow-none whitespace-nowrap transition-all ${availability !== 'all' ? 'border-foreground bg-foreground/5' : ''}`}
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>{availability === 'all' ? 'Status' : activeAvailabilityLabel}</span>
                                    <ChevronDown className="h-3 w-3 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 p-1">
                                <DropdownMenuRadioGroup value={availability} onValueChange={setAvailability}>
                                    {AVAILABILITY_OPTIONS.map(opt => (
                                        <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs font-bold uppercase cursor-pointer">
                                            {opt.label}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Scrolling Mobile Pills: Category + Status */}
                    <div className="flex gap-1.5 md:gap-2.5 overflow-x-auto pb-1.5 md:pb-0 -mx-4 md:mx-0 px-4 md:px-0 scrollbar-none items-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className={`md:hidden flex items-center gap-1.5 px-2.5 h-7 text-[9px] font-black uppercase tracking-tight rounded-lg border whitespace-nowrap transition-all shrink-0
                                        ${availability !== 'all' 
                                            ? 'bg-foreground/10 border-foreground text-foreground shadow-sm' 
                                            : 'bg-card/40 border-border/50 text-muted-foreground'
                                        }`}
                                >
                                    <CheckCircle2 className="h-3 w-3" />
                                    {availability === 'all' ? 'Status' : activeAvailabilityLabel}
                                    <ChevronDown className="h-2.5 w-2.5 opacity-40" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-44 p-1">
                                <DropdownMenuRadioGroup value={availability} onValueChange={setAvailability}>
                                    {AVAILABILITY_OPTIONS.map(opt => (
                                        <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs font-bold uppercase cursor-pointer">
                                            {opt.label}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="w-[1px] h-4 bg-border/40 md:hidden shrink-0" />

                        {CATEGORIES.map(cat => {
                            const isActive = category === cat.value;
                            return (
                                <button
                                    key={cat.value}
                                    onClick={() => setCategory(cat.value)}
                                    className={`flex items-center gap-1.5 md:gap-2.5 px-2.5 md:px-4 h-7 md:h-11 text-[9px] md:text-[10px] font-black md:font-semibold uppercase tracking-tight md:tracking-widest rounded-lg md:rounded-xl border whitespace-nowrap transition-all shrink-0
                                        ${isActive
                                            ? 'bg-foreground text-background border-foreground shadow-md'
                                            : 'bg-card/40 text-muted-foreground border-border/50'
                                        }`}
                                >
                                    <span className="opacity-70 scale-90 md:scale-100">{cat.icon}</span>
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Active Constraints Row */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 p-4 pt-1 pb-0 overflow-x-auto scrollbar-none md:mt-1">
                    <span className="text-[9px] uppercase font-black text-muted-foreground tracking-tighter mr-2 shrink-0">Active:</span>
                    <div className="flex gap-1.5 flex-nowrap">
                        {category !== 'All' && (
                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest h-6 px-2 border border-border/60" onClick={() => setCategory('All')}>
                                {category} ×
                            </Badge>
                        )}
                        {availability !== 'all' && (
                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest h-6 px-2 border border-border/60" onClick={() => setAvailability('all')}>
                                {activeAvailabilityLabel} ×
                            </Badge>
                        )}
                    </div>
                    <Button
                        variant="link"
                        size="sm"
                        onClick={clearFilters}
                        className="h-6 text-[10px] font-black uppercase text-muted-foreground p-0 ml-auto"
                    >
                        Reset
                    </Button>
                </div>
            )}

            {/* ── Product Results ── */}
            <div className="p-2 md:p-6 md:pt-5">
                {loading ? (
                    <div className="grid gap-2 md:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="flex flex-col gap-2">
                                <Skeleton className="h-44 w-full rounded-xl" />
                                <Skeleton className="h-4 w-3/4 rounded-lg" />
                                <Skeleton className="h-10 w-full rounded-xl" />
                            </div>
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border/40 rounded-3xl bg-card/50 m-2">
                        <div className="p-6 border border-border/50 rounded-2xl mb-4 bg-background shadow-xl">
                            <Package className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-xl font-black text-foreground tracking-tight uppercase">No Items</h3>
                        <p className="text-muted-foreground max-w-sm mt-3 text-xs font-medium leading-relaxed px-6">
                            No items match your search.
                        </p>
                        {hasActiveFilters && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-8 h-12 px-8 text-xs font-bold border-2 border-border/60 rounded-xl"
                                onClick={clearFilters}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-2.5 md:gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 pb-24">
                        {items.map(item => (
                            <ComponentCard
                                key={item.id}
                                item={item}
                                onClick={() => navigate(`/components/${item.id}`)}
                                onUpdate={loadItems}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

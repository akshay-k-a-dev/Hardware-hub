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
        if (error) console.error(error);
        setItems(data || []);
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
        <div className="flex flex-col gap-0 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            {/* ── Filter Bar ── */}
            <div className="flex flex-col gap-4 mb-6 pb-2 border-b border-border">
                
                {/* Header & Main Search Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase tracking-widest">Hardware Lab</h1>
                        <span className="text-[10px] font-black text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-sm border border-border/50 uppercase tracking-widest">
                            {summary.total} ITEMS
                        </span>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto md:min-w-[420px]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                            <Input
                                placeholder="Search hardware lab..."
                                className="pl-9 h-9 text-xs bg-background border-border shadow-none rounded-sm focus-visible:ring-1 focus-visible:ring-foreground transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <XCircle className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`h-9 px-3 gap-2 text-[10px] font-bold uppercase tracking-widest border-border rounded-sm shadow-none whitespace-nowrap transition-all ${availability !== 'all' ? 'border-foreground text-foreground bg-muted/20' : 'text-foreground'}`}
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{availability === 'all' ? 'Filter status' : activeAvailabilityLabel}</span>
                                    <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 rounded-sm border-border shadow-xl p-1 animate-in zoom-in-95 duration-200">
                                <DropdownMenuRadioGroup value={availability} onValueChange={setAvailability}>
                                    {AVAILABILITY_OPTIONS.map(opt => (
                                        <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs font-bold uppercase tracking-wider cursor-pointer rounded-sm py-2">
                                            {opt.label}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Category Pills */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-nowrap items-center">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter mr-2 shrink-0">Categories:</span>
                    {CATEGORIES.map(cat => {
                        const isActive = category === cat.value;
                        return (
                            <button
                                key={cat.value}
                                onClick={() => setCategory(cat.value)}
                                className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm border whitespace-nowrap transition-all duration-200 shrink-0
                                    ${isActive
                                        ? 'bg-foreground text-background border-foreground shadow-md'
                                        : 'bg-card text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
                                    }`}
                            >
                                <span className="opacity-70">{cat.icon}</span>
                                {cat.label}
                            </button>
                        );
                    })}
                </div>

                {/* Active Filters Row (if any) */}
                {hasActiveFilters && (
                    <div className="flex items-center gap-2 pt-2 mt-1">
                        <span className="text-[9px] uppercase font-black text-muted-foreground tracking-tighter pl-1">Selected:</span>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                            {category !== 'All' && (
                                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest h-5 px-2 gap-1 cursor-pointer hover:bg-muted border border-border/60 text-foreground" onClick={() => setCategory('All')}>
                                    {category} ×
                                </Badge>
                            )}
                            {availability !== 'all' && (
                                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest h-5 px-2 gap-1 cursor-pointer hover:bg-muted border border-border/60 text-foreground" onClick={() => setAvailability('all')}>
                                    {activeAvailabilityLabel} ×
                                </Badge>
                            )}
                            {search && (
                                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest h-5 px-2 gap-1 cursor-pointer hover:bg-muted border border-border/60 text-foreground max-w-[160px] truncate" onClick={() => setSearch('')}>
                                    "{search}" ×
                                </Badge>
                            )}
                        </div>
                        <Button
                            variant="link"
                            size="sm"
                            onClick={clearFilters}
                            className="h-6 px-2 text-[10px] font-black uppercase tracking-tighter text-muted-foreground hover:text-foreground p-0"
                        >
                            Reset all
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Results ── */}
            <div className="pt-5">
                {loading ? (
                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="flex flex-col gap-2">
                                <Skeleton className="h-44 w-full rounded-md" />
                                <Skeleton className="h-4 w-3/4 rounded" />
                                <Skeleton className="h-3 w-1/2 rounded" />
                                <Skeleton className="h-8 w-full rounded-md" />
                            </div>
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-lg bg-card/50">
                        <div className="p-4 border border-border rounded-lg mb-4 bg-background">
                            <Package className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-black text-foreground tracking-tight">No Hardware Found</h3>
                        <p className="text-muted-foreground max-w-sm mt-2 text-sm font-medium leading-relaxed">
                            {hasActiveFilters
                                ? "No items match your current filters. Try adjusting your search or category."
                                : "No hardware items are currently available in the lab."}
                        </p>
                        {hasActiveFilters && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-5 h-8 px-4 text-xs font-bold border-border rounded-md"
                                onClick={clearFilters}
                            >
                                Clear All Filters
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {items.map(item => (
                            <ComponentCard
                                key={item.id}
                                item={item}
                                onClick={() => navigate(`/components/${item.id}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

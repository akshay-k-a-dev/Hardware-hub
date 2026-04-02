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
        <div className="flex flex-col gap-0 max-w-[1400px] mx-auto">

            {/* ── Mini Summary Strip ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border mb-4">
                <div>
                    <h1 className="text-lg font-bold tracking-tight text-foreground">Hardware Lab</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Browse boards, sensors, and modules for your projects</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">{summary.total}</span>
                        <span className="text-xs text-muted-foreground">total</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-xs font-semibold text-foreground">{summary.available}</span>
                        <span className="text-xs text-muted-foreground">in stock</span>
                    </div>
                    {isStudent && summary.myPending > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            <span className="text-xs font-semibold text-amber-700">{summary.myPending} pending</span>
                        </div>
                    )}
                    <Link to="/dashboard" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        Dashboard
                    </Link>
                </div>
            </div>

            {/* ── Filter Bar (sticky header) ── */}
            <div className="sticky top-0 z-10 flex flex-col gap-2.5 mb-5 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border -mx-4 px-4 md:-mx-6 md:px-6">

                {/* Search + Secondary Filters Row */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search hardware by name or description..."
                            className="pl-9 h-9 text-sm bg-card border-border rounded-md focus-visible:ring-1 focus-visible:ring-foreground"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <XCircle className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Availability Filter Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className={`h-9 gap-1.5 text-xs font-bold border-border rounded-md whitespace-nowrap ${availability !== 'all' ? 'border-foreground bg-foreground text-background' : ''}`}
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {activeAvailabilityLabel}
                                <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-md">
                            <DropdownMenuRadioGroup value={availability} onValueChange={setAvailability}>
                                {AVAILABILITY_OPTIONS.map(opt => (
                                    <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-sm font-medium cursor-pointer">
                                        {opt.label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="h-9 gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-md"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Clear
                        </Button>
                    )}
                </div>

                {/* Category Pills */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-wrap sm:flex-nowrap">
                    {CATEGORIES.map(cat => {
                        const isActive = category === cat.value;
                        return (
                            <button
                                key={cat.value}
                                onClick={() => setCategory(cat.value)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border whitespace-nowrap transition-all duration-150 shrink-0
                                    ${isActive
                                        ? 'bg-foreground text-background border-foreground'
                                        : 'bg-card text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                                    }`}
                            >
                                {cat.icon}
                                {cat.label}
                            </button>
                        );
                    })}
                </div>

                {/* Active Filter Tags */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Filters:</span>
                        {category !== 'All' && (
                            <Badge
                                variant="secondary"
                                className="text-[10px] font-bold h-5 px-2 gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive rounded-sm"
                                onClick={() => setCategory('All')}
                            >
                                {category} ×
                            </Badge>
                        )}
                        {availability !== 'all' && (
                            <Badge
                                variant="secondary"
                                className="text-[10px] font-bold h-5 px-2 gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive rounded-sm"
                                onClick={() => setAvailability('all')}
                            >
                                {activeAvailabilityLabel} ×
                            </Badge>
                        )}
                        {search && (
                            <Badge
                                variant="secondary"
                                className="text-[10px] font-bold h-5 px-2 gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive rounded-sm max-w-[160px] truncate"
                                onClick={() => setSearch('')}
                            >
                                "{search}" ×
                            </Badge>
                        )}
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

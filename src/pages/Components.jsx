import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Cpu,
    Settings,
    Activity,
    Zap,
    Wifi,
    Battery,
    Monitor,
    Radio,
    Box,
    LayoutGrid,
    Filter,
    ArrowRight,
    SlidersHorizontal,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import StatusBadge from '@/components/StatusBadge';
import ComponentCard from '@/components/ComponentCard';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const CATEGORIES = ['All', 'Microcontroller', 'Single Board Computer', 'Sensor', 'Motor', 'Motor Driver', 'Display', 'Communication', 'Power Supply', 'Other'];

const categoryIcons = {
    Microcontroller: <Cpu className="h-5 w-5" />,
    'Single Board Computer': <Monitor className="h-5 w-5" />,
    Sensor: <Activity className="h-5 w-5" />,
    Motor: <Settings className="h-5 w-5" />,
    'Motor Driver': <Radio className="h-5 w-5" />,
    Display: <Monitor className="h-5 w-5" />,
    Communication: <Wifi className="h-5 w-5" />,
    'Power Supply': <Battery className="h-5 w-5" />,
    Other: <Box className="h-5 w-5" />,
};

export default function Components() {
    const navigate = useNavigate();
    const { isStudent } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');

    useEffect(() => {
        loadItems();
    }, [search, category]);

    const loadItems = async () => {
        setLoading(true);
        let query = supabase
            .from('hardware_items')
            .select('*, owner:profiles!hardware_items_owner_id_fkey(id, name, email, lab_name)')
            .order('created_at', { ascending: false });

        if (isStudent) {
            query = query.eq('is_active', true);
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
        }
        if (category !== 'All') {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error) console.error(error);
        setItems(data || []);
        setLoading(false);
    };

    const clearFilters = () => {
        setSearch('');
        setCategory('All');
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto">
            <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between px-1">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 md:gap-3 text-primary mb-1">
                        <div className="p-1.5 md:p-2 rounded-xl bg-primary/10">
                            <Box className="h-5 w-5 md:h-6 md:h-6" />
                        </div>
                        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-foreground">Hardware Lab</h1>
                    </div>
                    <p className="text-muted-foreground text-sm md:text-lg font-medium max-w-2xl">
                        Find the boards, sensors, and modules you need for your project.
                    </p>
                </div>
                {(search || category !== 'All') && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-destructive h-9 md:h-10 px-3 md:px-4 rounded-xl font-bold bg-muted/20 text-xs">
                        <Trash2 className="mr-2 h-4 w-4" /> Reset Filters
                    </Button>
                )}
            </header>

            {/* Filtering Controls */}
            <div className="flex flex-col gap-4 md:gap-6 bg-card border border-border p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-125 transition-transform duration-1000">
                    <Filter size={120} />
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center gap-4 md:gap-6 relative">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 md:h-5 md:h-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Find hardware..."
                            className="h-11 md:h-14 pl-11 md:pl-12 bg-muted/30 border-border rounded-xl md:rounded-2xl text-sm md:text-base focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-all shadow-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <ScrollArea className="w-full lg:w-auto overflow-hidden">
                        <Tabs value={category} onValueChange={setCategory} className="w-full">
                            <TabsList className="bg-muted/40 p-1 rounded-xl md:rounded-2xl h-11 md:h-14 border border-border/40">
                                {CATEGORIES.map(cat => (
                                    <TabsTrigger
                                        key={cat}
                                        value={cat}
                                        className="h-full px-4 md:px-6 rounded-lg md:rounded-xl font-bold text-xs md:text-sm tracking-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                                    >
                                        {cat}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                        <ScrollBar orientation="horizontal" className="h-2" />
                    </ScrollArea>
                </div>
            </div>

            {loading ? (
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <Card key={i} className="overflow-hidden border border-border bg-card rounded-3xl h-[400px]">
                            <CardHeader className="pb-4 space-y-4">
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-12 w-12 rounded-2xl" />
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                </div>
                                <Skeleton className="h-8 w-full rounded-lg" />
                                <Skeleton className="h-4 w-1/2 rounded-lg" />
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <Skeleton className="h-24 w-full rounded-2xl" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center border-4 border-dashed border-border/40 rounded-[3rem] bg-card/20 backdrop-blur-sm animate-in zoom-in-95 duration-500">
                    <div className="p-8 rounded-[2rem] bg-muted/40 mb-8 ring-8 ring-muted/20">
                        <LayoutGrid className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-3xl font-black text-foreground tracking-tight">No Items Found</h3>
                    <p className="text-muted-foreground max-w-md mt-4 text-lg font-medium leading-relaxed">
                        We couldn't find any components matching your search. Try a different category or name.
                    </p>
                    <Button variant="outline" size="lg" className="mt-10 h-14 px-10 rounded-2xl font-bold border-2 hover:bg-muted/40 border-border/60" onClick={clearFilters}>
                        View All Items
                    </Button>
                </div>
            ) : (
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="cursor-pointer"
                            onClick={() => navigate(`/components/${item.id}`)}
                        >
                            <ComponentCard item={item} />
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}

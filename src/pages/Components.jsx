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
    Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import StatusBadge from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
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
            .select('*, owner:profiles!owner_id(id, name)')
            .order('created_at', { ascending: false });

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
                    <div className="flex items-center gap-3 text-primary mb-1">
                        <div className="p-2 rounded-xl bg-primary/10">
                            <Box className="h-6 w-6" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Hardware Lab</h1>
                    </div>
                    <p className="text-muted-foreground text-lg font-medium max-w-2xl">
                        Find the boards, sensors, and modules you need for your project.
                    </p>
                </div>
                {(search || category !== 'All') && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-destructive h-10 px-4 rounded-xl font-bold bg-muted/20">
                        <Trash2 className="mr-2 h-4 w-4" /> Reset Filters
                    </Button>
                )}
            </header>

            {/* Filtering Controls */}
            <div className="flex flex-col gap-6 bg-card border border-border p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-125 transition-transform duration-1000">
                    <Filter size={120} />
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center gap-6 relative">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Find specific hardware, modules, or sensors..."
                            className="h-14 pl-12 bg-muted/30 border-border rounded-2xl text-base focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-all shadow-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <ScrollArea className="w-full lg:w-auto overflow-hidden">
                        <Tabs value={category} onValueChange={setCategory} className="w-full">
                            <TabsList className="bg-muted/40 p-1 rounded-2xl h-14 border border-border/40">
                                {CATEGORIES.map(cat => (
                                    <TabsTrigger
                                        key={cat}
                                        value={cat}
                                        className="h-full px-6 rounded-xl font-bold text-sm tracking-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
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
                    {items.map((item, idx) => (
                        <Card
                            key={item.id}
                            className="group flex flex-col border border-border bg-card hover:border-primary/50 hover:shadow-xl transition-all duration-500 cursor-pointer overflow-hidden rounded-[2.5rem] animate-in fade-in slide-in-from-bottom-8 duration-700"
                            style={{ animationDelay: `${idx * 50}ms` }}
                            onClick={() => navigate(`/components/${item.id}`)}
                        >
                            <CardHeader className="relative pb-6 px-7 pt-7">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="p-3.5 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:shadow-[0_0_20px_rgba(var(--primary),0.4)] group-hover:text-primary-foreground transition-all duration-500 scale-110 group-hover:scale-125">
                                        {categoryIcons[item.category] || <Box className="h-6 w-6" />}
                                    </div>
                                    <StatusBadge status={item.status} className="shadow-2xl h-7 px-3 font-black text-[10px]" />
                                </div>
                                <CardTitle className="text-2xl font-black leading-tight group-hover:text-primary transition-colors line-clamp-2 tracking-tight">
                                    {item.name}
                                </CardTitle>
                                <CardDescription className="text-xs font-black uppercase tracking-[0.2em] text-primary/50 mt-1">{item.category}</CardDescription>
                            </CardHeader>

                            <CardContent className="flex-1 px-7 space-y-6">
                                <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed font-medium">
                                    {item.description}
                                </p>

                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(item.specs || {}).slice(0, 4).map(([key, val]) => (
                                        <Badge key={key} variant="secondary" className="bg-primary/5 border border-primary/10 text-[11px] font-bold py-0.5 px-3 h-6 hover:bg-primary/10 transition-colors">
                                            {val}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>

                            <CardFooter className="p-7 flex flex-col gap-6 border-t border-border bg-muted/10 relative">
                                <div className="w-full space-y-3">
                                    <div className="flex justify-between items-end text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                                        <span>In Stock</span>
                                        <span className="text-foreground">{item.quantity_available} / {item.quantity_total} UNITS</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden border border-border/20">
                                        <div
                                            className={`h-full transition-all duration-1000 ease-out rounded-full ${(item.quantity_available / item.quantity_total) > 0.5 ? 'bg-gradient-to-r from-emerald-500 to-green-400' :
                                                (item.quantity_available / item.quantity_total) > 0.2 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-destructive to-red-400'
                                                }`}
                                            style={{ width: `${(item.quantity_available / item.quantity_total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <Button variant="ghost" className="w-full h-14 rounded-2xl justify-between group/btn text-muted-foreground hover:text-primary hover:bg-primary/5 font-black uppercase tracking-widest text-[11px] px-6 border border-border/50 hover:border-primary/20">
                                    View Details
                                    <ArrowRight className="h-5 w-5 transform group-hover/btn:translate-x-1.5 transition-transform" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList,
    Calendar,
    Package,
    Trash2,
    AlertCircle,
    Clock,
    CheckCircle2,
    XCircle,
    Filter as FilterIcon,
    History,
    ArrowRight,
    Search,
    Info,
    AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function MyRequests() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        loadRequests();
    }, [profile, filter]);

    const loadRequests = async () => {
        if (!profile) return;
        setLoading(true);

        try {
            let query = supabase
                .from('requests')
                .select('*, hardware:hardware_items(id, name, category, image_url)')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false });

            if (filter !== 'all') query = query.eq('status', filter);

            const { data, error } = await query;
            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error loading requests:', error);
            toast({
                variant: "destructive",
                title: "Load Failed",
                description: "Could not retrieve your request history.",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (requestId) => {
        const { error } = await supabase.rpc('cancel_request', { p_request_id: requestId });
        if (error) {
            toast({
                variant: "destructive",
                title: "Cancellation Error",
                description: error.message,
            });
        } else {
            toast({
                title: "Request Cancelled",
                description: "Your request has been removed.",
            });
            loadRequests();
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const FILTERS = ['all', 'pending', 'approved', 'issued', 'returned', 'rejected', 'cancelled'];

    if (loading && requests.length === 0) {
        return (
            <div className="space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-64 rounded-lg" />
                    <Skeleton className="h-4 w-[450px]" />
                </div>
                <div className="grid gap-6">
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-[500px] w-full rounded-[2.5rem]" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0 max-w-[1400px] mx-auto animate-in fade-in duration-500 relative p-4 md:p-6 lg:px-0">
            {/* Subtle background ambient light */}
            <div className="absolute -top-40 -left-40 h-80 w-80 bg-white/[0.02] rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute top-1/2 -right-40 h-80 w-80 bg-white/[0.015] rounded-full blur-[100px] pointer-events-none" />
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4 pb-3 border-b border-border/40 px-1">
                <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => navigate('/components')}
                                className="h-9 w-9 rounded-full bg-muted/40 flex items-center justify-center hover:bg-foreground hover:text-background transition-all shrink-0 border border-border/40"
                            >
                                <ArrowRight className="h-4 w-4 rotate-180" />
                            </button>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2.5">
                                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground uppercase leading-none tracking-widest">My Activity</h1>
                                </div>
                                <p className="text-[9px] font-black text-muted-foreground uppercase opacity-40 mt-1.5 tracking-tight">
                                    Laboratory Assignment History
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted/20 px-3 py-1 rounded-full border border-border/40 uppercase tracking-widest shrink-0">
                            {requests.length} Logs
                        </span>
                    </div>
                </div>
            </header>

            <div className="flex flex-col gap-4 bg-card border border-border p-3 rounded-2xl shadow-sm overflow-hidden group">
                <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4">
                    <Tabs value={filter} onValueChange={setFilter} className="w-full">
                        <TabsList className="bg-transparent p-0 h-auto w-full justify-start gap-2 flex-nowrap">
                            {FILTERS.map((f) => (
                                <TabsTrigger
                                    key={f}
                                    value={f}
                                    className="capitalize px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-tight border border-border/60 data-[state=active]:bg-foreground data-[state=active]:text-background transition-all shrink-0"
                                >
                                    {f}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <ScrollBar orientation="horizontal" className="hidden" />
                </ScrollArea>
            </div>

            <Card className="border border-border bg-card shadow-sm rounded-2xl overflow-hidden animate-in zoom-in-95 duration-700">
                <CardHeader className="py-4 px-6 border-b border-border bg-muted/10">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                            Request History
                        </CardTitle>
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/10 bg-primary/5 text-primary h-5">
                            {requests.length} Entries
                        </Badge>
                    </div>
                    <CardDescription className="text-[9px] font-bold uppercase opacity-40 mt-0.5">
                        Chronological breakdown of your research project requests.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {requests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 px-10 text-center bg-muted/5">
                            <div className="p-8 rounded-[2rem] bg-muted/40 mb-8 ring-8 ring-muted/20">
                                <ClipboardList className="h-20 w-20 text-muted-foreground/20" />
                            </div>
                            <h3 className="text-3xl font-black text-foreground tracking-tight">Nothing found</h3>
                            <p className="text-muted-foreground max-w-md mt-4 text-lg font-medium leading-relaxed">
                                {filter === 'all'
                                    ? "Your request history is currently empty. Head over to the inventory to start your first research project."
                                    : `We couldn't find any request logs with the status "${filter}". Try resetting your filters.`}
                            </p>
                            {filter !== 'all' && (
                                <Button variant="ghost" className="mt-8 font-black uppercase tracking-widest text-xs hover:bg-muted/40 h-12 px-8 rounded-xl border border-border/60" onClick={() => setFilter('all')}>
                                    Full History View
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div>
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto selection:bg-primary/20">
                                <Table>
                                    <TableHeader className="bg-muted/30 border-b border-border">
                                        <TableRow className="hover:bg-transparent border-none h-16">
                                            <TableHead className="font-black px-10 text-xs uppercase tracking-[0.2em] text-muted-foreground">Project Title</TableHead>
                                            <TableHead className="font-black px-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">Submission Date</TableHead>
                                            <TableHead className="font-black px-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">Due Date</TableHead>
                                            <TableHead className="font-black px-6 text-xs uppercase tracking-[0.2em] text-muted-foreground text-center w-40">Status</TableHead>
                                            <TableHead className="font-black text-right pr-10 text-xs uppercase tracking-[0.2em] text-muted-foreground">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {requests.map((req, idx) => (
                                            <TableRow
                                                key={req.id}
                                                className="border-b border-border/10 hover:bg-muted/10 transition-all duration-300 group animate-in slide-in-from-right-8 duration-700 h-20"
                                                style={{ animationDelay: `${idx * 80}ms` }}
                                            >
                                                <TableCell className="px-10">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
                                                            <Package className="h-5 w-5" />
                                                        </div>
                                                        <div className="flex flex-col gap-1.5 min-w-0 max-w-[300px]">
                                                            <span className="font-black text-lg text-foreground group-hover:text-primary transition-colors truncate">{req.project_title}</span>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="secondary" className="bg-muted/80 text-[10px] h-5 px-2 font-black tracking-widest border border-border">
                                                                    {req.hardware?.name}
                                                                </Badge>
                                                                <span className="text-xs font-bold text-muted-foreground/60">× {req.quantity} UNITS</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                                                            <Calendar className="h-4 w-4 text-primary/40" />
                                                            {formatDate(req.request_date)}
                                                        </div>
                                                        <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-tighter">TIMESTAMPED</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6">
                                                    {req.expected_return_date ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                                                                <Clock className="h-4 w-4 text-primary/20 group-hover:text-primary/40 transition-colors" />
                                                                {formatDate(req.expected_return_date)}
                                                            </div>
                                                            <span className="text-[10px] font-black text-amber-500/40 uppercase tracking-tighter">SCHEDULED RETURN</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-muted-foreground/20 italic text-sm font-bold px-4">
                                                            <Info className="h-4 w-4" />
                                                            Pending Schedule
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-6 text-center">
                                                    <StatusBadge status={req.status} className="h-9 px-6 font-black" />
                                                </TableCell>
                                                <TableCell className="text-right pr-10">
                                                    {(req.status === 'pending' || req.status === 'approved') ? (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="rounded-xl border-border hover:border-destructive/40 hover:bg-destructive/10 text-muted-foreground hover:text-destructive font-black text-xs uppercase h-10 px-5 transition-all group/cancel"
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2 group-hover/cancel:scale-110 transition-transform" />
                                                                    Retract
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="bg-card border border-border rounded-[2rem] shadow-xl p-10 animate-in zoom-in-95 duration-300">
                                                                <AlertDialogHeader>
                                                                    <div className="p-4 w-fit rounded-2xl bg-destructive/10 text-destructive mb-4">
                                                                        <AlertTriangle className="h-8 w-8" />
                                                                    </div>
                                                                    <AlertDialogTitle className="text-3xl font-black tracking-tight text-foreground mb-2 leading-none">Withdraw Request?</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed">
                                                                        This action will withdraw your request for <strong>"{req.hardware?.name}"</strong>. Are you sure?
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter className="mt-10 gap-4">
                                                                    <AlertDialogCancel className="h-14 px-8 rounded-2xl font-black text-xs uppercase border-2 border-border/60 hover:bg-muted/20">No, Keep It</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        className="h-14 px-10 rounded-2xl font-black text-xs uppercase bg-destructive hover:bg-destructive/90 shadow-xl shadow-destructive/20"
                                                                        onClick={() => handleCancel(req.id)}
                                                                    >
                                                                        Yes, Cancel
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    ) : (
                                                        <Button disabled variant="ghost" className="h-10 px-5 text-[10px] font-black uppercase text-muted-foreground/20 cursor-not-allowed">
                                                            NO ACTIONS
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                        <div className="md:hidden flex flex-col gap-3 p-4 bg-muted/5">
                            {requests.map((req, idx) => (
                                <div
                                    key={req.id}
                                    className="bg-card border border-border/60 rounded-[20px] p-4 shadow-sm animate-in slide-in-from-bottom-4 duration-500 relative overflow-hidden"
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    {/* Abstract background accent */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-foreground/[0.02] rounded-full -mr-10 -mt-10" />

                                    <div className="flex justify-between items-start mb-2.5 relative z-10">
                                        <div className="flex flex-col gap-0">
                                            <h3 className="text-[11px] font-black uppercase tracking-tight text-foreground">
                                                ID: #{req.id.slice(0, 8)}
                                            </h3>
                                            <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">
                                                {formatDate(req.request_date)}
                                            </span>
                                        </div>
                                        <StatusBadge status={req.status} className="h-5 px-2.5 text-[8px] font-black rounded-lg" />
                                    </div>

                                    <div className="space-y-1.5 mb-3 relative z-10">
                                        <div className="flex flex-col gap-0">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 leading-none">Hardware Item</span>
                                            <span className="text-[11px] font-black text-foreground uppercase mt-0.5">{req.hardware?.name || 'Unknown Item'}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex flex-col gap-0">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 leading-none">Units</span>
                                                <span className="text-[11px] font-black text-foreground">{req.quantity} UNITS</span>
                                            </div>
                                            <div className="flex flex-col gap-0">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 leading-none">Due Date</span>
                                                <span className={`text-[11px] font-black tabular-nums ${req.status === 'overdue' ? 'text-destructive' : 'text-foreground'}`}>
                                                    {req.expected_return_date ? formatDate(req.expected_return_date) : 'PENDING'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-0">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 leading-none">Project Title</span>
                                            <p className="text-[10px] font-black text-foreground/80 bg-muted/30 p-2 rounded-lg italic border border-border/40 mt-0.5">
                                                "{req.project_title}"
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 relative z-10">
                                        {(req.status === 'pending' || req.status === 'approved') && (
                                            <Button
                                                variant="outline"
                                                className="flex-1 h-9 rounded-lg border-destructive/20 bg-destructive/5 text-destructive font-black uppercase text-[9px] tracking-widest hover:bg-destructive/10"
                                                onClick={() => handleCancel(req.id)}
                                            >
                                                Retract
                                            </Button>
                                        )}
                                        <button 
                                            className="flex-1 h-9 rounded-lg border border-border bg-muted/10 text-foreground font-black uppercase text-[9px] tracking-widest hover:bg-muted/20"
                                            onClick={() => navigate(`/components/${req.hardware_id}`)}
                                        >
                                            Details
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="mt-4 p-4 rounded-xl bg-primary/[0.03] border border-primary/10 flex flex-col md:flex-row items-center gap-4 animate-in slide-in-from-bottom-8 duration-700">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                    <Info size={20} />
                </div>
                <div className="space-y-0.5 flex-1 text-center md:text-left">
                    <h4 className="text-sm font-bold text-primary tracking-tight font-inter-tight">Need help?</h4>
                    <p className="text-[10px] text-muted-foreground font-medium leading-relaxed max-w-3xl">
                        Return items on time. Overdue items impact your record and limit future borrowing.
                    </p>
                </div>
                <Button variant="outline" className="h-8 px-5 border-primary/20 hover:bg-primary/10 text-primary font-bold rounded-lg uppercase text-[9px] tracking-widest whitespace-nowrap">
                    Policies
                </Button>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
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
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto">
            <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between px-1">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 text-primary mb-1">
                        <div className="p-2 rounded-xl bg-primary/10">
                            <History className="h-6 w-6" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">My Requests</h1>
                    </div>
                    <p className="text-muted-foreground text-lg font-medium max-w-2xl">
                        Monitor your hardware requests and view your borrowing history.
                    </p>
                </div>
            </header>

            <div className="flex flex-col gap-6 bg-card border border-border p-5 rounded-3xl shadow-sm overflow-hidden group">
                <ScrollArea className="w-full whitespace-nowrap">
                    <Tabs value={filter} onValueChange={setFilter} className="w-full">
                        <TabsList className="bg-muted/30 p-1.5 rounded-2xl h-14 border border-border w-full justify-start">
                            {FILTERS.map((f) => (
                                <TabsTrigger
                                    key={f}
                                    value={f}
                                    className="capitalize h-full px-8 rounded-xl font-bold text-sm tracking-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                                >
                                    {f}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <ScrollBar orientation="horizontal" className="h-2" />
                </ScrollArea>
            </div>

            <Card className="border border-border bg-card shadow-sm rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 duration-700">
                <CardHeader className="py-8 px-10 border-b border-border bg-muted/20">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-black flex items-center gap-2">
                            Request History
                        </CardTitle>
                        <Badge variant="outline" className="font-bold border-primary/20 bg-primary/5 text-primary">
                            {requests.length} LOG ENTRIES
                        </Badge>
                    </div>
                    <CardDescription className="text-sm font-medium mt-1">
                        Detailed breakdown of all {filter !== 'all' ? filter : ''} lab requests in chronological order.
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
                        <div className="overflow-x-auto selection:bg-primary/20">
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
                                            className="border-b border-border/10 hover:bg-muted/20 transition-all duration-300 group animate-in slide-in-from-right-8 duration-700 h-24"
                                            style={{ animationDelay: `${idx * 80}ms` }}
                                        >
                                            <TableCell className="px-10">
                                                <div className="flex items-center gap-5">
                                                    <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-primary-foreground/60 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
                                                        <Package className="h-6 w-6" />
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
                    )}
                </CardContent>
            </Card>

            <div className="mt-6 p-10 rounded-[2.5rem] bg-primary/5 border border-primary/10 flex flex-col md:flex-row items-center gap-10 animate-in slide-in-from-bottom-8 duration-1000">
                <div className="h-20 w-20 shrink-0 rounded-[1.5rem] bg-primary/20 flex items-center justify-center text-primary border border-primary/10">
                    <Info size={40} />
                </div>
                <div className="space-y-2 flex-1 text-center md:text-left">
                    <h4 className="text-xl font-black text-primary tracking-tight italic">Need help?</h4>
                    <p className="text-sm text-muted-foreground font-bold leading-relaxed max-w-3xl">
                        Remember to return items on time. Overdue items will impact your lab record and may limit future borrowing capacity.
                    </p>
                </div>
                <Button variant="outline" className="h-14 px-10 border-primary/20 hover:bg-primary/10 text-primary font-black rounded-2xl uppercase text-[11px] tracking-widest whitespace-nowrap">
                    View Lab Policies
                </Button>
            </div>
        </div>
    );
}

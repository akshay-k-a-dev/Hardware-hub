import { useEffect, useState } from 'react';
import {
    ClipboardCheck,
    User,
    Package,
    MoreHorizontal,
    CheckCircle2,
    XCircle,
    PackageCheck,
    CornerUpLeft,
    Calendar,
    Search,
    AlertCircle,
    SlidersHorizontal,
    ArrowUpRight,
    ArrowDownLeft,
    Layers,
    History,
    Users,
    ChevronRight,
    Loader2,
    Star,
    MessageSquare,
    ThumbsUp,
    Inbox
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ManageRequests() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const [ratingDialog, setRatingDialog] = useState({ open: false, requestId: null, borrowerId: null, borrowerName: '' });
    const [ratingValue, setRatingValue] = useState(5);
    const [ratingComment, setRatingComment] = useState('');
    const [borrowerRatings, setBorrowerRatings] = useState({});
    const [actionLoading, setActionLoading] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadRequests();
    }, [profile, filter]);

    const loadRequests = async () => {
        if (!profile) return;
        setLoading(true);

        try {
            const { data: hwItems } = await supabase
                .from('hardware_items')
                .select('id')
                .eq('owner_id', profile.id);

            const hwIds = (hwItems || []).map(h => h.id);
            if (hwIds.length === 0) {
                setRequests([]);
                setLoading(false);
                return;
            }

            let query = supabase
                .from('requests')
                .select('*, borrower:profiles!requests_user_id_fkey(id, name, email), hardware:hardware_items!requests_hardware_id_fkey(id, name, category)')
                .in('hardware_id', hwIds)
                .order('created_at', { ascending: false });

            if (filter !== 'all') query = query.eq('status', filter);

            const { data, error } = await query;
            if (error) throw error;
            setRequests(data || []);

            // Optimization: Fetch ratings for all unique borrowers in the list
            const uniqueBorrowerIds = [...new Set((data || []).map(r => r.user_id))];
            if (uniqueBorrowerIds.length > 0) {
                const { data: ratingsData } = await supabase.rpc('get_multiple_user_ratings', { p_user_ids: uniqueBorrowerIds });
                if (ratingsData) {
                    const ratingMap = {};
                    ratingsData.forEach(r => ratingMap[r.user_id] = r);
                    setBorrowerRatings(ratingMap);
                }
            }
        } catch (error) {
            console.error('Error loading request inbox:', error);
            toast({
                variant: 'destructive',
                title: 'Sync Error',
                description: 'Could not update your request inbox.',
            });
        } finally {
            setLoading(false);
        }
    };

    const submitRating = async () => {
        try {
            const { error } = await supabase.from('user_ratings').insert({
                request_id: ratingDialog.requestId,
                rater_id: profile.id,
                ratee_id: ratingDialog.borrowerId,
                rating: ratingValue,
                comment: ratingComment
            });

            if (error) throw error;

            toast({ title: 'Rating Submitted', description: `Thanks for rating ${ratingDialog.borrowerName}!` });
            setRatingDialog({ open: false, requestId: null, borrowerId: null, borrowerName: '' });
            loadRequests(); // Refresh to update avg rating if displayed
        } catch (error) {
            toast({ variant: 'destructive', title: 'Rating Failed', description: error.message });
        }
    };

    const handleAction = async (action, requestId) => {
        setActionLoading(requestId);
        const rpcMap = {
            approve: 'approve_request',
            reject: 'reject_request',
            issue: 'issue_request',
            return: 'return_request',
        };

        const { error } = await supabase.rpc(rpcMap[action], { p_request_id: requestId });
        if (error) {
            toast({
                variant: 'destructive',
                title: 'Transaction Error',
                description: error.message,
            });
        } else {
            toast({
                title: 'Status Updated',
                description: `The request status has been updated.`,
            });
            loadRequests();
        }
        setActionLoading(null);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const FILTERS = ['pending', 'approved', 'issued', 'returned', 'rejected', 'all'];

    const filteredRequests = requests.filter(req =>
        req.project_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.borrower?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.hardware?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && requests.length === 0) {
        return (
            <div className="space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-80 rounded-lg" />
                    <Skeleton className="h-4 w-[500px]" />
                </div>
                <div className="grid gap-6">
                    <div className="flex gap-4">
                        <Skeleton className="h-14 flex-1 rounded-2xl" />
                        <Skeleton className="h-14 w-80 rounded-2xl" />
                    </div>
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
                            <Layers className="h-6 w-6" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Manage Requests</h1>
                    </div>
                    <p className="text-muted-foreground text-lg font-medium max-w-2xl">
                        Review and approve student hardware requests.
                    </p>
                </div>
            </header>

            <div className="flex flex-col gap-6 bg-card border border-border p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-125 transition-transform duration-1000">
                    <SlidersHorizontal size={120} />
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center gap-6 relative">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Find borrower, project, or hardware..."
                            className="h-14 pl-12 bg-muted/30 border-border rounded-2xl text-base focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <ScrollArea className="w-full lg:w-auto overflow-hidden">
                        <Tabs value={filter} onValueChange={setFilter} className="w-full">
                            <TabsList className="bg-muted/30 p-1.5 rounded-2xl h-14 border border-border">
                                {FILTERS.map((f) => (
                                    <TabsTrigger
                                        key={f}
                                        value={f}
                                        className="capitalize h-full px-6 rounded-xl font-bold text-sm tracking-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                                    >
                                        {f}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                        <ScrollBar orientation="horizontal" className="h-2" />
                    </ScrollArea>
                </div>
            </div>

            <Card className="border border-border bg-card shadow-sm rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 duration-700">
                <CardHeader className="py-8 px-10 border-b border-border bg-muted/20">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-black flex items-center gap-2">
                            Request Inbox
                        </CardTitle>
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-bold border-primary/20 bg-primary/5 text-primary h-7">
                                {filteredRequests.length} TOTAL REQUESTS
                            </Badge>
                        </div>
                    </div>
                    <CardDescription className="text-sm font-medium mt-1">
                        Review student borrow requests and update their lab status.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 px-10 text-center bg-muted/5">
                            <div className="p-8 rounded-[2rem] bg-muted/40 mb-8 ring-8 ring-muted/20">
                                <ClipboardCheck className="h-20 w-20 text-muted-foreground/20" />
                            </div>
                            <h3 className="text-3xl font-black text-foreground tracking-tight">Queue Clear</h3>
                            <p className="text-muted-foreground max-w-md mt-4 text-lg font-medium leading-relaxed">
                                {searchTerm ? "No specific records match your search query." : "There are currently no active requests requiring manual intervention in this category."}
                            </p>
                        </div>
                    ) : (
                        <div>
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30 border-b border-border">
                                        <TableRow className="hover:bg-transparent border-none h-16">
                                            <TableHead className="font-black px-10 text-xs uppercase tracking-[0.2em] text-muted-foreground">Student / Project</TableHead>
                                            <TableHead className="font-black px-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">Hardware Item</TableHead>
                                            <TableHead className="font-black px-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">Request Dates</TableHead>
                                            <TableHead className="font-black px-6 text-xs uppercase tracking-[0.2em] text-muted-foreground text-center w-40">Status</TableHead>
                                            <TableHead className="font-black text-right pr-10 text-xs uppercase tracking-[0.2em] text-muted-foreground">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRequests.map((req, idx) => (
                                            <TableRow
                                                key={req.id}
                                                className="border-b border-border/10 hover:bg-muted/20 transition-all duration-300 group animate-in slide-in-from-left-8 duration-700 h-28"
                                                style={{ animationDelay: `${idx * 80}ms` }}
                                            >
                                                <TableCell className="px-10">
                                                    <div className="flex items-center gap-6">
                                                        <div className="relative group/avatar">
                                                            <div className="h-14 w-14 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-black text-xl group-hover/avatar:scale-110 group-hover/avatar:bg-primary transition-all duration-500 group-hover/avatar:text-primary-foreground">
                                                                {req.borrower?.name?.charAt(0)}
                                                            </div>
                                                            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-background" title="Identity Verified" />
                                                        </div>
                                                        <div className="flex flex-col gap-1 min-w-0 max-w-[280px]">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-lg text-foreground group-hover:text-primary transition-colors truncate tracking-tight">{req.project_title}</span>
                                                                {borrowerRatings[req.user_id] && (
                                                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                                                        <Star size={10} className="fill-amber-500" />
                                                                        <span className="text-[10px] font-black">{borrowerRatings[req.user_id].average_rating.toFixed(1)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/60">
                                                                <Users size={12} className="text-primary/40" />
                                                                {req.borrower?.name}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <Package className="h-4 w-4 text-primary/60" />
                                                            <span className="text-base font-bold text-foreground tracking-tight">{req.hardware?.name}</span>
                                                        </div>
                                                        <Badge variant="outline" className="w-fit text-[10px] font-black tracking-[0.1em] px-3 h-5 bg-muted/40 border-border/60">
                                                            UNITS: {req.quantity}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-2.5 text-sm font-bold text-muted-foreground">
                                                            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500/50" />
                                                            <span className="tabular-nums">REQ: {formatDate(req.request_date)}</span>
                                                        </div>
                                                        {req.expected_return_date && (
                                                            <div className="flex items-center gap-2.5 text-sm font-black text-primary/70">
                                                                <ArrowUpRight className="h-3.5 w-3.5 text-primary/50" />
                                                                <span className="tabular-nums uppercase">DUE: {formatDate(req.expected_return_date)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6 text-center">
                                                    <StatusBadge status={req.status} className="h-9 px-6 font-black" />
                                                </TableCell>
                                                <TableCell className="text-right pr-10">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                disabled={actionLoading === req.id}
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-12 w-12 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 relative"
                                                            >
                                                                {actionLoading === req.id ? (
                                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                                ) : (
                                                                    <MoreHorizontal className="h-6 w-6" />
                                                                )}
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-64 p-2 bg-card border border-border rounded-2xl animate-in zoom-in-95 duration-200">
                                                            <DropdownMenuLabel className="px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Quick Actions</DropdownMenuLabel>
                                                            <DropdownMenuSeparator className="bg-border/40 mx-2" />

                                                            {req.status === 'pending' && (
                                                                <>
                                                                    <DropdownMenuItem onClick={() => handleAction('approve', req.id)} className="h-12 rounded-xl focus:bg-emerald-500/10 focus:text-emerald-500 font-bold px-4 cursor-pointer gap-3 mb-1">
                                                                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                                            <CheckCircle2 size={18} />
                                                                        </div>
                                                                        Approve
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleAction('reject', req.id)} className="h-12 rounded-xl focus:bg-destructive/10 focus:text-destructive font-bold px-4 cursor-pointer gap-3">
                                                                        <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                                                                            <XCircle size={18} />
                                                                        </div>
                                                                        Reject
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}

                                                            {req.status === 'approved' && (
                                                                <DropdownMenuItem onClick={() => handleAction('issue', req.id)} className="h-12 rounded-xl focus:bg-primary/10 focus:text-primary font-bold px-4 cursor-pointer gap-3">
                                                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                                        <PackageCheck size={18} />
                                                                    </div>
                                                                    Mark as Issued
                                                                </DropdownMenuItem>
                                                            )}

                                                            {(req.status === 'issued' || req.status === 'overdue') && (
                                                                <DropdownMenuItem onClick={() => handleAction('return', req.id)} className="h-12 rounded-xl focus:bg-amber-500/10 focus:text-amber-500 font-bold px-4 cursor-pointer gap-3">
                                                                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                                                        <CornerUpLeft size={18} />
                                                                    </div>
                                                                    Confirm Return
                                                                </DropdownMenuItem>
                                                            )}

                                                            {req.status === 'returned' && (
                                                                <DropdownMenuItem onClick={() => setRatingDialog({ open: true, requestId: req.id, borrowerId: req.user_id, borrowerName: req.borrower.name })} className="h-12 rounded-xl focus:bg-amber-500/10 focus:text-amber-500 font-bold px-4 cursor-pointer gap-3">
                                                                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                                                        <ThumbsUp size={18} />
                                                                    </div>
                                                                    Rate Student
                                                                </DropdownMenuItem>
                                                            )}

                                                            <DropdownMenuSeparator className="bg-border/40 mx-2 my-1" />
                                                            <DropdownMenuItem className="h-12 rounded-xl font-bold px-4 cursor-pointer gap-3 group/item">
                                                                <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center group-hover/item:bg-primary/20 transition-colors">
                                                                    <ChevronRight size={18} />
                                                                </div>
                                                                Full Transaction Detail
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden flex flex-col divide-y divide-border">
                                {filteredRequests.map((req, idx) => (
                                    <div key={req.id} className="p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black">
                                                    {req.borrower?.name?.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground leading-tight">{req.project_title}</span>
                                                    <span className="text-xs text-muted-foreground">{req.borrower?.name}</span>
                                                </div>
                                            </div>
                                            <StatusBadge status={req.status} className="h-7 px-3 text-[10px]" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/30 border border-border">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Hardware</span>
                                                <span className="text-sm font-bold truncate">{req.hardware?.name}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/30 border border-border">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Quantity</span>
                                                <span className="text-sm font-bold">{req.quantity} Units</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-muted-foreground uppercase opacity-40">Requested On</span>
                                                <span className="text-xs font-bold">{formatDate(req.request_date)}</span>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="h-10 rounded-xl px-4 font-black uppercase text-[10px] tracking-widest gap-2">
                                                        Manage <MoreHorizontal size={14} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl">
                                                    {/* Same actions as desktop */}
                                                    {req.status === 'pending' && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => handleAction('approve', req.id)}>Approve</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleAction('reject', req.id)}>Reject</DropdownMenuItem>
                                                        </>
                                                    )}
                                                    {req.status === 'approved' && (
                                                        <DropdownMenuItem onClick={() => handleAction('issue', req.id)}>Mark as Issued</DropdownMenuItem>
                                                    )}
                                                    {(req.status === 'issued' || req.status === 'overdue') && (
                                                        <DropdownMenuItem onClick={() => handleAction('return', req.id)}>Confirm Return</DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-4 md:space-y-6">
                <div className="flex items-center gap-2 md:gap-3 text-primary mb-1">
                    <div className="p-1.5 md:p-2 rounded-xl bg-primary/10">
                        <Inbox className="h-5 w-5 md:h-6 md:h-6" />
                    </div>
                    <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-foreground">Management</h1>
                </div>
                <p className="text-muted-foreground text-sm md:text-lg font-medium max-w-2xl">
                    Approve, track, and manage all hardware deployments from your central hub.
                </p>
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                <Card className="flex-1 border border-border bg-card shadow-sm rounded-3xl md:rounded-[2rem] p-6 md:p-8 flex items-center gap-6 md:gap-8 group">
                    <div className="h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl bg-primary/5 border-2 border-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform flex-shrink-0">
                        <History size={24} className="md:w-8 md:h-8" />
                    </div>
                    <div>
                        <h4 className="text-base md:text-lg font-black tracking-tight text-foreground mb-1">Usage Insights</h4>
                        <p className="text-xs md:text-sm text-muted-foreground font-medium leading-relaxed max-w-sm">
                            Analyze borrow rates and demand patterns across your portfolio.
                        </p>
                    </div>
                </Card>
                <Card className="flex-1 border border-border bg-card shadow-sm rounded-3xl md:rounded-[2rem] p-6 md:p-8 flex items-center gap-6 md:gap-8 group">
                    <div className="h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl bg-amber-500/5 border-2 border-amber-500/10 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform flex-shrink-0">
                        <AlertCircle size={24} className="md:w-8 md:h-8" />
                    </div>
                    <div>
                        <h4 className="text-base md:text-lg font-black tracking-tight text-foreground mb-1">Inventory Health</h4>
                        <p className="text-xs md:text-sm text-muted-foreground font-medium leading-relaxed max-w-sm">
                            Flag technical issues during the hardware return workflow.
                        </p>
                    </div>
                </Card>
            </div>
            <Dialog open={ratingDialog.open} onValueChange={(v) => !v && setRatingDialog({ ...ratingDialog, open: false })}>
                <DialogContent className="sm:max-w-[500px] rounded-[2rem]">
                    <DialogHeader>
                        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
                            <Star size={28} className="fill-amber-500" />
                        </div>
                        <DialogTitle className="text-3xl font-black tracking-tight">Rate Borrower</DialogTitle>
                        <DialogDescription className="text-base font-medium">
                            How was your experience with <strong>{ratingDialog.borrowerName}</strong>? This helps other lenders trust this student.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 space-y-8">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rating Quality</Label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRatingValue(star)}
                                        className={`p-3 rounded-xl transition-all ${ratingValue >= star ? 'bg-amber-500 text-white' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'}`}
                                    >
                                        <Star size={24} className={ratingValue >= star ? 'fill-white' : ''} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Optional Comments</Label>
                            <Textarea
                                placeholder="e.g. Returned in perfect condition, very communicative..."
                                value={ratingComment}
                                onChange={(e) => setRatingComment(e.target.value)}
                                className="min-h-[120px] rounded-2xl bg-muted/20 border-border focus:ring-amber-500/20"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-4">
                        <Button variant="ghost" onClick={() => setRatingDialog({ ...ratingDialog, open: false })} className="h-12 rounded-xl flex-1 font-bold">Cancel</Button>
                        <Button onClick={submitRating} className="h-12 rounded-xl flex-1 font-black uppercase tracking-widest text-xs bg-amber-500 hover:bg-amber-600">Submit Rating</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

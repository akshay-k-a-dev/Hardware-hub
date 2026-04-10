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
    const [returnDialog, setReturnDialog] = useState({ open: false, requestId: null, condition: 'Good', notes: '' });
    const [ratingValue, setRatingValue] = useState(5);
    const [ratingComment, setRatingComment] = useState('');
    const [borrowerRatings, setBorrowerRatings] = useState({});
    const [borrowerTrust, setBorrowerTrust] = useState({});
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
                
                const { data: trustData } = await supabase.from('trust_scores').select('user_id, score, band, on_time_returns, late_returns, damages_reported').in('user_id', uniqueBorrowerIds);
                if (trustData) {
                    const trustMap = {};
                    trustData.forEach(t => trustMap[t.user_id] = t);
                    setBorrowerTrust(trustMap);
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

    const submitReturn = async () => {
        setActionLoading(returnDialog.requestId);
        try {
            const { error } = await supabase.rpc('return_request', { 
                p_request_id: returnDialog.requestId,
                p_notes: returnDialog.notes,
                p_condition: returnDialog.condition
            });
            if (error) throw error;
            
            toast({ title: 'Hardware Returned', description: 'The item has been returned and logged.' });
            setReturnDialog({ open: false, requestId: null, condition: 'Good', notes: '' });
            loadRequests();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Return Failed', description: error.message });
        }
        setActionLoading(null);
    };

    const handleAction = async (action, requestId) => {
        if (action === 'return') {
            setReturnDialog({ open: true, requestId, condition: 'Good', notes: '' });
            return;
        }

        setActionLoading(requestId);
        const rpcMap = {
            approve: 'approve_request',
            reject: 'reject_request',
            issue: 'issue_request',
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
            <div className="flex flex-col gap-10 animate-in fade-in duration-500 max-w-[1400px] mx-auto p-4 md:p-6 lg:px-0">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-80 rounded-lg" />
                    <Skeleton className="h-4 w-[500px]" />
                </div>
                <div className="grid gap-6">
                    <div className="flex gap-4">
                        <Skeleton className="h-14 flex-1 rounded-2xl" />
                        <Skeleton className="h-14 w-80 rounded-2xl" />
                    </div>
                    <Skeleton className="h-[500px] w-full rounded-md" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto p-4 md:p-6 lg:px-0">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
                <div>
                    <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase tracking-widest">Manage Requests</h1>
                    <p className="text-[10px] md:text-xs font-black text-muted-foreground mt-0.5 uppercase tracking-tight opacity-70">
                        Review and approve student hardware requests
                    </p>
                </div>
            </header>

            <div className="flex flex-col gap-2.5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-2 relative">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Find borrower, project, or hardware..."
                            className="h-9 pl-10 bg-card border-border rounded-md text-sm font-medium focus-visible:ring-1 focus-visible:ring-foreground"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <ScrollArea className="w-full lg:w-auto overflow-hidden">
                        <Tabs value={filter} onValueChange={setFilter} className="w-full">
                            <TabsList className="bg-muted/40 p-1 border border-border rounded-md h-9">
                                {FILTERS.map((f) => (
                                    <TabsTrigger
                                        key={f}
                                        value={f}
                                        className="capitalize h-full px-3 rounded-sm font-medium text-xs tracking-wide data-[state=active]:bg-foreground data-[state=active]:text-background"
                                    >
                                        {f}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                        <ScrollBar orientation="horizontal" className="h-1.5" />
                    </ScrollArea>
                </div>
            </div>

            <Card className="border border-border bg-background shadow-none rounded-none overflow-hidden animate-in zoom-in-95 duration-700">
                <CardHeader className="py-4 px-6 md:py-6 md:px-8 border-b border-border bg-background">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl md:text-2xl font-black flex items-center gap-2 text-foreground">
                            Request Inbox
                        </CardTitle>
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-black uppercase tracking-widest border border-border bg-background text-foreground h-6 text-[8px] md:text-[10px] rounded-none">
                                {filteredRequests.length} TOTAL
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-background border-t border-border">
                            <div className="p-4 border border-border mb-6">
                                <ClipboardCheck className="h-12 w-12 text-foreground" />
                            </div>
                            <h3 className="text-2xl font-black text-foreground tracking-tight">Queue Clear</h3>
                            <p className="text-foreground max-w-sm mt-3 text-sm font-bold leading-relaxed">
                                {searchTerm ? "No specific records match your search query." : "There are currently no active requests requiring manual intervention in this category."}
                            </p>
                        </div>
                    ) : (
                        <div>
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-background border-b border-border">
                                        <TableRow className="hover:bg-transparent border-none h-12">
                                            <TableHead className="font-black px-6 text-[10px] uppercase tracking-[0.2em] text-foreground">Student / Project</TableHead>
                                            <TableHead className="font-black px-6 text-[10px] uppercase tracking-[0.2em] text-foreground">Hardware Item</TableHead>
                                            <TableHead className="font-black px-6 text-[10px] uppercase tracking-[0.2em] text-foreground">Request Dates</TableHead>
                                            <TableHead className="font-black px-6 text-[10px] uppercase tracking-[0.2em] text-foreground text-center w-32">Status</TableHead>
                                            <TableHead className="font-black text-right pr-6 text-[10px] uppercase tracking-[0.2em] text-foreground w-24">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRequests.map((req, idx) => (
                                            <TableRow
                                                key={req.id}
                                                className="border-b border-border/40 hover:bg-muted/30 transition-colors group h-20"
                                            >
                                                <TableCell className="px-6 py-4 align-middle">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 border border-border bg-background flex items-center justify-center text-foreground font-black group-hover:bg-foreground group-hover:text-background transition-colors rounded-full">
                                                            {req.borrower?.name?.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col gap-0.5 min-w-0 max-w-[280px]">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-sm md:text-base text-inherit truncate tracking-tight">{req.project_title}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-xs font-bold text-inherit opacity-80">{req.borrower?.name}</span>
                                                                {borrowerTrust[req.user_id] && (
                                                                    <div className="flex items-center gap-1.5 opacity-90">
                                                                        <Badge variant="outline" className={`text-[8px] h-[18px] px-1.5 font-bold border-dashed ${borrowerTrust[req.user_id].score >= 70 ? 'text-emerald-500 border-emerald-500/40' : borrowerTrust[req.user_id].score >= 40 ? 'text-amber-500 border-amber-500/40' : 'text-destructive border-destructive/40'}`}>
                                                                            Score: {borrowerTrust[req.user_id].score}
                                                                        </Badge>
                                                                        <span className="text-[9px] font-bold text-muted-foreground flex gap-1">
                                                                            <span className="text-emerald-500" title="On-Time Returns">{borrowerTrust[req.user_id].on_time_returns}✓</span>
                                                                            <span className="text-amber-500" title="Late Returns">{borrowerTrust[req.user_id].late_returns}⚠</span>
                                                                            <span className="text-destructive" title="Damages Reported">{borrowerTrust[req.user_id].damages_reported}✗</span>
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-sm font-bold text-inherit tracking-tight">{req.hardware?.name}</span>
                                                        <span className="text-[10px] font-black tracking-widest uppercase opacity-70">
                                                            {req.quantity} UNITS
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs font-bold text-inherit tabular-nums">REQ: {formatDate(req.request_date)}</span>
                                                        {req.expected_return_date && (
                                                            <span className="text-xs font-black text-inherit opacity-80 tabular-nums uppercase">DUE: {formatDate(req.expected_return_date)}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6 py-4 align-middle text-center">
                                                    <div className="flex justify-center">
                                                        <StatusBadge status={(req.status === 'issued' && req.expected_return_date && new Date(req.expected_return_date) < new Date()) ? 'overdue' : req.status} className="h-6 px-3" />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6 py-4 align-middle">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                disabled={actionLoading === req.id}
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-10 w-10 rounded-none hover:bg-background hover:text-foreground transition-none border-2 border-transparent hover:border-background group-hover:hover:bg-background group-hover:hover:text-foreground relative"
                                                            >
                                                                {actionLoading === req.id ? (
                                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                                ) : (
                                                                    <MoreHorizontal className="h-6 w-6" />
                                                                )}
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-56 p-1 bg-card border border-border rounded-sm animate-in zoom-in-95 duration-200">
                                                            <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quick Actions</DropdownMenuLabel>
                                                            <DropdownMenuSeparator className="bg-border/40" />

                                                            {req.status === 'pending' && (
                                                                <>
                                                                    <DropdownMenuItem onClick={() => handleAction('approve', req.id)} className="h-9 rounded-sm focus:bg-foreground focus:text-background font-bold px-3 cursor-pointer gap-2">
                                                                        <CheckCircle2 size={14} />
                                                                        Approve
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleAction('reject', req.id)} className="h-9 rounded-sm focus:bg-destructive focus:text-destructive-foreground font-bold px-3 cursor-pointer gap-2">
                                                                        <XCircle size={14} />
                                                                        Reject
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}

                                                            {req.status === 'approved' && (
                                                                <DropdownMenuItem onClick={() => handleAction('issue', req.id)} className="h-10 rounded-sm focus:bg-foreground focus:text-background font-bold px-3 cursor-pointer gap-2">
                                                                    <PackageCheck size={14} />
                                                                    Mark as Issued
                                                                </DropdownMenuItem>
                                                            )}

                                                            {(req.status === 'issued' || req.status === 'overdue') && (
                                                                <DropdownMenuItem onClick={() => handleAction('return', req.id)} className="h-10 rounded-sm focus:bg-foreground focus:text-background font-bold px-3 cursor-pointer gap-2">
                                                                    <CornerUpLeft size={14} />
                                                                    Confirm Return
                                                                </DropdownMenuItem>
                                                            )}

                                                            {req.status === 'returned' && (
                                                                <DropdownMenuItem onClick={() => setRatingDialog({ open: true, requestId: req.id, borrowerId: req.user_id, borrowerName: req.borrower.name })} className="h-10 rounded-sm focus:bg-foreground focus:text-background font-bold px-3 cursor-pointer gap-2">
                                                                    <ThumbsUp size={14} />
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

                            {/* Mobile Card View (Redesigned) */}
                            <div className="md:hidden flex flex-col gap-4 p-4">
                                {filteredRequests.map((req, idx) => (
                                    <div 
                                        key={req.id} 
                                        className="bg-card border border-border/40 p-5 rounded-[2rem] shadow-sm animate-in slide-in-from-bottom-2 duration-500" 
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-foreground font-black text-xs border border-border/20 shadow-sm">
                                                    {req.borrower?.name?.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black uppercase tracking-tight leading-none">{req.project_title}</span>
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-80">{req.borrower?.name}</span>
                                                        {borrowerTrust[req.user_id] && (
                                                            <Badge variant="outline" className={`text-[8px] h-3 px-1 border-dashed ${borrowerTrust[req.user_id].score >= 70 ? 'text-emerald-500 border-emerald-500/40' : 'text-amber-500 border-amber-500/40'}`}>
                                                                {borrowerTrust[req.user_id].score} TS
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <StatusBadge status={(req.status === 'issued' && req.expected_return_date && new Date(req.expected_return_date) < new Date()) ? 'overdue' : req.status} className="h-5 px-3 text-[9px] font-black" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-5">
                                            <div className="flex flex-col gap-1 p-3 rounded-2xl bg-muted/20 border border-border/10">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Hardware</span>
                                                <span className="text-[11px] font-bold truncate leading-none">{req.hardware?.name}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 p-3 rounded-2xl bg-muted/20 border border-border/10">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Units</span>
                                                <span className="text-[11px] font-bold leading-none">{req.quantity} Quantity</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-border/20">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">Requested</span>
                                                <span className="text-[10px] font-bold lowercase">{formatDate(req.request_date)}</span>
                                            </div>
                                            
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="h-9 rounded-xl px-4 font-black uppercase text-[9px] tracking-widest gap-2 border-border/60 hover:bg-foreground hover:text-background transition-all">
                                                        Manage <ChevronRight size={12} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
                                                    <DropdownMenuLabel className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Contextual Actions</DropdownMenuLabel>
                                                    <DropdownMenuSeparator className="bg-border/40" />

                                                    {req.status === 'pending' && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => handleAction('approve', req.id)} className="font-bold text-xs rounded-lg py-2">Approve Request</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleAction('reject', req.id)} className="font-bold text-xs text-destructive rounded-lg py-2">Reject Request</DropdownMenuItem>
                                                        </>
                                                    )}
                                                    {req.status === 'approved' && (
                                                        <DropdownMenuItem onClick={() => handleAction('issue', req.id)} className="font-bold text-xs rounded-lg py-2">Mark as Issued</DropdownMenuItem>
                                                    )}
                                                    {(req.status === 'issued' || req.status === 'overdue') && (
                                                        <DropdownMenuItem onClick={() => handleAction('return', req.id)} className="font-bold text-xs rounded-lg py-2">Confirm Return</DropdownMenuItem>
                                                    )}
                                                    {req.status === 'returned' && (
                                                        <DropdownMenuItem onClick={() => setRatingDialog({ open: true, requestId: req.id, borrowerId: req.user_id, borrowerName: req.borrower.name })} className="font-bold text-xs rounded-lg py-2">Rate Performance</DropdownMenuItem>
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


            <Dialog open={ratingDialog.open} onOpenChange={(v) => !v && setRatingDialog({ ...ratingDialog, open: false })}>
                <DialogContent className="sm:max-w-md rounded-lg">
                    <DialogHeader>
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground mb-4">
                            <Star size={24} className="fill-muted-foreground" />
                        </div>
                        <DialogTitle className="text-xl font-bold tracking-tight">Rate Borrower</DialogTitle>
                        <DialogDescription className="text-sm">
                            How was your experience with <strong>{ratingDialog.borrowerName}</strong>? This helps other lenders trust this student.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rating Quality</Label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRatingValue(star)}
                                        className={`p-1 transition-all hover:scale-110 ${ratingValue >= star ? 'text-foreground' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}
                                    >
                                        <Star size={32} strokeWidth={1.5} className={ratingValue >= star ? 'fill-foreground' : 'fill-transparent'} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Optional Comments</Label>
                            <Textarea
                                placeholder="e.g. Returned in perfect condition, very communicative..."
                                value={ratingComment}
                                onChange={(e) => setRatingComment(e.target.value)}
                                className="min-h-[100px] rounded-md bg-background border-border text-sm focus-visible:ring-1 focus-visible:ring-foreground"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:space-x-0">
                        <Button variant="outline" onClick={() => setRatingDialog({ ...ratingDialog, open: false })} className="h-9 flex-1 font-bold rounded-sm border-border hover:bg-muted text-xs uppercase tracking-widest">Cancel</Button>
                        <Button onClick={submitRating} className="h-9 flex-1 font-black text-xs bg-foreground text-background hover:bg-foreground/90 transition-all rounded-sm uppercase tracking-widest">Submit Rating</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Post-Return Condition Dialog */}
            <Dialog open={returnDialog.open} onOpenChange={(v) => !v && setReturnDialog({ ...returnDialog, open: false })}>
                <DialogContent className="sm:max-w-md rounded-lg">
                    <DialogHeader>
                        <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                            <CornerUpLeft size={24} className="text-emerald-600" />
                        </div>
                        <DialogTitle className="text-xl font-bold tracking-tight">Confirm Return</DialogTitle>
                        <DialogDescription className="text-sm">
                            Marking this hardware as returned. Please note the condition of the item. This affects the student's trust score.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Return Condition</Label>
                            <select 
                                value={returnDialog.condition}
                                onChange={(e) => setReturnDialog({ ...returnDialog, condition: e.target.value })}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
                            >
                                <option value="Good">Good (No new issues)</option>
                                <option value="Poor">Poor (Minor wear or missing small parts)</option>
                                <option value="Broken">Broken / Damaged</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Provider Notes</Label>
                            <Textarea
                                placeholder="Any additional notes about the return..."
                                value={returnDialog.notes}
                                onChange={(e) => setReturnDialog({ ...returnDialog, notes: e.target.value })}
                                className="min-h-[80px] rounded-md bg-background border-border text-sm"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:space-x-0">
                        <Button variant="outline" onClick={() => setReturnDialog({ ...returnDialog, open: false })} disabled={actionLoading} className="h-9 flex-1 font-bold rounded-sm border-border hover:bg-muted text-xs uppercase tracking-widest">Cancel</Button>
                        <Button onClick={submitReturn} disabled={actionLoading} className="h-9 flex-1 font-black text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition-all rounded-sm uppercase tracking-widest">
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Return"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

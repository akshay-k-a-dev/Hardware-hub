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
                    <Skeleton className="h-[500px] w-full rounded-md" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
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
                                                className="border-b-[1px] border-foreground hover:bg-foreground hover:text-background transition-none duration-300 group h-20"
                                            >
                                                <TableCell className="px-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 border border-border bg-background flex items-center justify-center text-foreground font-black group-hover:border-background group-hover:text-background group-hover:bg-foreground transition-none">
                                                            {req.borrower?.name?.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col gap-0.5 min-w-0 max-w-[280px]">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-sm md:text-base text-inherit truncate tracking-tight">{req.project_title}</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-inherit opacity-80">{req.borrower?.name}</span>
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
                                                <TableCell className="px-6 text-center">
                                                    <StatusBadge status={req.status} className="h-7 px-4 text-[9px] font-black" />
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
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
                                            <div className="flex flex-col gap-1 p-3 rounded-md bg-muted/30 border border-border">
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
                                                    <Button variant="outline" className="h-10 rounded-md px-4 font-black uppercase text-[10px] tracking-widest gap-2">
                                                        Manage <MoreHorizontal size={14} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56 p-2 rounded-md">
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
                                        className={`p-2 rounded-md transition-all ${ratingValue >= star ? 'bg-foreground text-background' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                                    >
                                        <Star size={20} className={ratingValue >= star ? 'fill-background' : ''} />
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
        </div>
    );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Calendar,
    User,
    Info,
    ShieldCheck,
    Package,
    Clock,
    CheckCircle2,
    AlertCircle,
    Cpu,
    Zap,
    History,
    FileText,
    ArrowRightCircle,
    Layout,
    MapPin,
    Bell,
    BookmarkCheck,
    Timer,
    Hourglass,
    Users,
    EyeOff,
    Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function ComponentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profile, isStudent, isAdmin } = useAuth();
    const { toast } = useToast();

    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [requestForm, setRequestForm] = useState({ quantity: 1, project_title: '', project_description: '' });
    const [submitting, setSubmitting] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [borrowCheck, setBorrowCheck] = useState(null);

    // Pre-book state
    const [prebookInfo, setPrebookInfo] = useState(null); // { in_queue, prebook_id, position, status, hold_expires_at }
    const [prebookCount, setPrebookCount] = useState(0);
    const [prebooking, setPrebooking] = useState(false);

    const getBorrowErrorMessage = (error) => {
        const message = error?.message || '';
        if (message.includes('User profile not found')) {
            return 'Your profile is not ready yet. Please refresh and try again.';
        }
        if (message.includes('account has been suspended')) {
            return 'Your account cannot borrow items right now.';
        }
        if (message.includes('trust score is too low')) {
            return 'Your account cannot borrow items right now.';
        }
        if (message.includes('1 active request at a time')) {
            return 'Please finish your current request before borrowing another item.';
        }
        if (message.includes('Only students can create borrow requests')) {
            return 'Only student accounts can borrow items.';
        }
        if (message.includes('Maximum concurrent active requests reached')) {
            return 'You already have the maximum number of active requests.';
        }
        if (message.includes('Caution band users cannot borrow High-Value items')) {
            return 'Your account cannot borrow expensive items right now.';
        }
        if (message.includes('Too many requests')) {
            return 'You sent too many requests quickly. Please try again in a minute.';
        }
        if (message.includes('row-level security')) {
            return 'Your account is not allowed to send this request right now.';
        }
        if (message.includes('violates check constraint')) {
            return 'Please check the quantity and try again.';
        }
        return message || 'Something went wrong while sending your request.';
    };

    const readRecentBorrowAttempts = () => {
        try {
            const cutoff = Date.now() - 60_000;
            return JSON.parse(localStorage.getItem('borrow_request_attempts') || '[]')
                .filter((timestamp) => Number.isFinite(timestamp) && timestamp > cutoff);
        } catch {
            return [];
        }
    };

    const rememberBorrowAttempt = () => {
        const attempts = [...readRecentBorrowAttempts(), Date.now()];
        localStorage.setItem('borrow_request_attempts', JSON.stringify(attempts));
    };

    const getBorrowPreflightError = async () => {
        const recentAttempts = readRecentBorrowAttempts();
        if (recentAttempts.length >= 5) {
            return 'You sent too many requests quickly. Please try again in a minute.';
        }

        const { data: gate, error: gateError } = await supabase.rpc('can_user_borrow', {
            p_user_id: profile.id,
        });

        if (gateError) {
            return 'Could not check your borrowing status. Please try again.';
        }

        setBorrowCheck(gate);

        if (gate && gate.allowed === false) {
            return getBorrowErrorMessage({ message: gate.reason });
        }

        if (item.is_high_value && gate?.band === 'caution') {
            return 'Your account cannot borrow expensive items right now.';
        }

        const { data: limits } = await supabase
            .from('platform_limits')
            .select('max_active_requests')
            .eq('id', 1)
            .maybeSingle();

        const maxActiveRequests = limits?.max_active_requests ?? 10;
        if ((gate?.active_requests ?? 0) >= maxActiveRequests) {
            return 'You already have the maximum number of active requests.';
        }

        return null;
    };

    useEffect(() => {
        loadItem();
    }, [id]);

    useEffect(() => {
        if (item && profile && isStudent) {
            loadPrebookInfo();
        }
    }, [item, profile]);

    const loadItem = async () => {
        try {
            const { data, error } = await supabase
                .from('hardware_items')
                .select('*, owner:profiles!hardware_items_owner_id_fkey(id, name, email, lab_name)')
                .eq('id', id)
                .single();

            if (error || !data) throw error;
            setItem(data);
        } catch (error) {
            console.error('Error loading component details:', error);
            navigate('/components');
        } finally {
            setLoading(false);
        }
    };

    const loadPrebookInfo = async () => {
        try {
            // Get user's queue position
            const { data: posData } = await supabase.rpc('get_user_prebook_position', {
                p_hardware_id: id,
                p_user_id: profile.id,
            });
            setPrebookInfo(posData);

            // Get total queue count
            const { data: countData } = await supabase.rpc('get_prebook_count', {
                p_hardware_id: id,
            });
            setPrebookCount(countData || 0);
        } catch (err) {
            console.error('Error loading prebook info:', err);
        }
    };

    const handlePrebook = async () => {
        setPrebooking(true);
        try {
            const { data, error } = await supabase.rpc('prebook_item', {
                p_hardware_id: id,
            });
            if (error) throw error;
            toast({
                title: "Joined Waitlist",
                description: `You are #${data.position} in the waitlist. We'll notify you when it's available.`,
            });
            loadPrebookInfo();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Waitlist Failed",
                description: error.message,
            });
        } finally {
            setPrebooking(false);
        }
    };

    const handleCancelPrebook = async () => {
        if (!prebookInfo?.prebook_id) return;
        setPrebooking(true);
        try {
            const { data, error } = await supabase.rpc('cancel_prebook', {
                p_prebook_id: prebookInfo.prebook_id,
            });
            if (error) throw error;
            toast({
                title: "Waitlist Cancelled",
                description: data?.message || "Your reservation has been removed.",
            });
            setPrebookInfo(null);
            loadPrebookInfo();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Cancellation Failed",
                description: error.message,
            });
        } finally {
            setPrebooking(false);
        }
    };

    const handleToggleActive = async () => {
        try {
            const newStatus = !item.is_active;
            const { error } = await supabase
                .from('hardware_items')
                .update({ is_active: newStatus })
                .eq('id', item.id);
            if (error) throw error;
            
            setItem(prev => ({ ...prev, is_active: newStatus }));
            toast({
                title: newStatus ? "Component Activated" : "Component Deactivated",
                description: newStatus ? "Item is now visible to students in search." : "Item is now hidden from student search.",
            });
        } catch (error) {
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        }
    };

    const handleRequest = async (e) => {
        e.preventDefault();
        if (!profile) {
            toast({
                variant: "destructive",
                title: "Please sign in",
                description: "Sign in before sending a borrow request.",
            });
            return;
        }

        if (profile.role !== 'student') {
            toast({
                variant: "destructive",
                title: "Cannot send request",
                description: "Only student accounts can borrow items.",
            });
            return;
        }

        if (profile.status && profile.status !== 'active') {
            toast({
                variant: "destructive",
                title: "Cannot send request",
                description: "Your account must be active before you can borrow items.",
            });
            return;
        }

        const quantity = Number.parseInt(requestForm.quantity, 10);
        if (!Number.isFinite(quantity) || quantity < 1 || quantity > item.quantity_available) {
            toast({
                variant: "destructive",
                title: "Check quantity",
                description: `Choose between 1 and ${item.quantity_available}.`,
            });
            return;
        }

        if (!requestForm.project_title.trim()) {
            toast({
                variant: "destructive",
                title: "Add project name",
                description: "Please add a short project name before sending.",
            });
            return;
        }

        setSubmitting(true);

        const preflightError = await getBorrowPreflightError();
        if (preflightError) {
            toast({
                variant: "destructive",
                title: "Request not sent",
                description: preflightError,
            });
            setSubmitting(false);
            return;
        }

        rememberBorrowAttempt();
        const { error } = await supabase.from('requests').insert({
            user_id: profile.id,
            hardware_id: item.id,
            quantity,
            project_title: requestForm.project_title.trim(),
            project_description: requestForm.project_description.trim(),
        });

        if (error) {
            toast({
                variant: "destructive",
                title: "Request not sent",
                description: getBorrowErrorMessage(error),
            });
        } else {
            toast({
                title: "Request Sent",
                description: "Your borrow request is waiting for lab approval.",
            });
            setShowRequestForm(false);
            setRequestForm({ quantity: 1, project_title: '', project_description: '' });
        }
        setSubmitting(false);
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto space-y-8 animate-pulse p-4">
                <Skeleton className="h-10 w-48 rounded-md" />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-8">
                        <Skeleton className="h-[250px] w-full rounded-md" />
                        <Skeleton className="h-[400px] w-full rounded-md" />
                    </div>
                    <div className="lg:col-span-4 self-start">
                        <Skeleton className="h-[500px] w-full rounded-md" />
                    </div>
                </div>
            </div>
        );
    }

    const availRatio = item.quantity_available / item.quantity_total;

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000 p-4 md:p-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="group h-9 px-3 rounded-md bg-card border border-border hover:bg-muted font-bold text-xs uppercase tracking-widest transition-all"
                    onClick={() => navigate('/components')}
                >
                    <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    Back
                </Button>

                <div className="flex items-center gap-3">
                    {(profile?.id === item.owner_id || isAdmin) && (
                        <Button
                            variant={item.is_active ? "outline" : "default"}
                            size="sm"
                            className={`h-10 px-4 rounded-md font-bold text-xs uppercase tracking-widest ${!item.is_active ? 'bg-foreground text-background hover:bg-foreground/90' : 'text-foreground hover:bg-muted'}`}
                            onClick={handleToggleActive}
                        >
                            {item.is_active ? (
                                <><EyeOff className="h-4 w-4 mr-2" /> Deactivate</>
                            ) : (
                                <><Eye className="h-4 w-4 mr-2" /> Activate</>
                            )}
                        </Button>
                    )}

                    <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-md shadow-sm">
                        <History size={14} className="text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ID: </span>
                        <span className="text-[10px] font-bold uppercase text-foreground tabular-nums">{item.id.split('-')[0]}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-6">
                    <section className="bg-card border border-border rounded-md shadow-sm overflow-hidden group">
                        <div className="grid grid-cols-1 md:grid-cols-2">
                            {/* Image Container */}
                            <div className="relative h-[250px] md:h-full min-h-[300px] overflow-hidden bg-muted/20 border-b md:border-b-0 md:border-r border-border">
                                {item.image_url && !imgError ? (
                                    <img
                                        src={item.image_url}
                                        alt={item.name}
                                        className="absolute inset-0 w-full h-full object-contain transition-transform duration-[2000ms] group-hover:scale-110"
                                        onError={() => setImgError(true)}
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                                        <div className="p-6 rounded-md bg-muted border border-border mb-4">
                                            <Cpu size={48} className="text-muted-foreground" />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">No image</p>
                                    </div>
                                )}
                            </div>

                            {/* Content Side */}
                            <div className="p-6 md:p-8 flex flex-col justify-center relative">
                                <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                                    <Zap size={160} />
                                </div>

                                <div className="relative space-y-8">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {item.is_high_value && (
                                            <Badge variant="outline" className="h-6 px-3 font-black uppercase tracking-widest border-amber-500 text-amber-600 bg-amber-500/10">
                                                Expensive
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="h-6 px-3 font-bold uppercase tracking-widest border-border bg-muted">
                                            {item.category}
                                        </Badge>
                                        <StatusBadge status={item.status} className="h-6 px-3 font-bold" />
                                        {item.is_active === false && (
                                            <Badge variant="outline" className="h-6 px-3 font-bold uppercase tracking-widest border-border text-muted-foreground">
                                                Deactivated
                                            </Badge>
                                        )}
                                    </div>

                                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-tight uppercase tracking-widest">
                                        {item.name}
                                    </h1>

                                    <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-3xl border-l-2 border-border pl-4">
                                        {item.description || "No description provided."}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-4 pt-2">
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border">
                                            <MapPin size={12} className="text-muted-foreground" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location: </span>
                                            <span className="text-[10px] font-bold uppercase text-foreground">{item.location || item.owner?.lab_name || 'Main Room'}</span>
                                        </div>
                                        
                                        {(item.delivery_courier || item.delivery_offline) && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border">
                                                <Package size={12} className="text-muted-foreground" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Delivery: </span>
                                                <div className="flex gap-1">
                                                     {item.delivery_courier && <Badge variant="outline" className="text-[9px] h-4 px-1 border-border font-black uppercase text-foreground">Courier</Badge>}
                                                     {item.delivery_offline && <Badge variant="outline" className="text-[9px] h-4 px-1 border-border font-black uppercase text-foreground">Pickup</Badge>}
                                                 </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="bg-card border border-border rounded-md overflow-hidden shadow-sm">
                        <div className="py-4 px-6 border-b border-border bg-muted/50">
                            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <span className="p-1 px-1.5 rounded-sm bg-muted text-muted-foreground border border-border">
                                    <ShieldCheck className="h-4 w-4" />
                                </span>
                                Details
                            </h3>
                        </div>

                        <div className="p-6">
                            {item.specs && Object.keys(item.specs).length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {Object.entries(item.specs).map(([key, val]) => (
                                        <div
                                            className="flex flex-col p-4 rounded-md bg-muted/30 border border-border"
                                            key={key}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{key}</span>
                                            </div>
                                            <span className="text-sm font-semibold text-foreground">{val}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 bg-muted/10 rounded-md border border-dashed border-border opacity-80">
                                    <Info size={24} className="text-muted-foreground mb-2" />
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">No details added</p>
                                </div>
                            )}

                            <div className="mt-6 p-4 rounded-md bg-muted/50 border border-border flex items-start gap-4">
                                <div className="p-2 rounded-md bg-background border border-border text-foreground shrink-0">
                                    <FileText size={16} />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm tracking-tight">Important Note</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Use ESD protection when handling. Make sure you've read the basic setup guide before borrowing.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-10 self-start">
                    <Card className="border border-border bg-card shadow-sm rounded-md overflow-hidden">
                        <CardHeader className="py-4 px-6 border-b border-border bg-muted/50">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-foreground">Availability</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="relative text-center p-6 rounded-md bg-muted/30 border border-border shadow-sm">
                                <div className="text-4xl font-bold tracking-tight mb-1 text-foreground tabular-nums">
                                    {item.quantity_available}
                                </div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    Available
                                </div>
                                <div className="mt-6 h-2 w-full bg-border rounded-full overflow-hidden">
                                    <div
                                         className={`h-full rounded-full transition-all duration-1000 ease-out shadow-lg ${availRatio > 0.5 ? 'bg-foreground' :
                                             availRatio > 0.1 ? 'bg-yellow-500' : 'bg-destructive'
                                             }`}
                                         style={{ width: `${availRatio * 100}%` }}
                                     />
                                </div>
                                <div className="mt-3 flex items-center justify-between px-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Total: {item.quantity_total}</span>
                                    <span className="text-[10px] font-bold text-foreground uppercase">{Math.round(availRatio * 100)}% Available</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border border-border">
                                    <div className="h-8 w-8 shrink-0 rounded-md bg-background border border-border flex items-center justify-center text-foreground">
                                        <Clock size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Borrow Period</span>
                                        <span className="text-sm font-semibold text-foreground">{item.max_lending_days} Days</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border border-border">
                                    <div className="h-8 w-8 shrink-0 rounded-md bg-background border border-border flex items-center justify-center text-foreground">
                                        <User size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Owner</span>
                                        <span className="text-sm font-semibold text-foreground">{item.owner?.name}</span>
                                    </div>
                                </div>
                                {borrowCheck?.active_requests > 0 && (
                                    <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border border-border">
                                        <div className="h-8 w-8 shrink-0 rounded-md bg-background border border-border flex items-center justify-center text-foreground">
                                            <History size={16} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Current Requests</span>
                                            <span className="text-sm font-semibold text-foreground">{borrowCheck.active_requests}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="p-6 pt-0">
                            {isStudent && item.status === 'available' && item.quantity_available > 0 ? (
                                <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full h-10 text-xs font-bold uppercase tracking-widest rounded-sm bg-foreground text-background hover:bg-foreground/90 transition-colors">
                                            Borrow Item
                                            <ArrowRightCircle className="ml-2 h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[420px] bg-background border border-border rounded-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                                        <form onSubmit={handleRequest} className="space-y-6">
                                            <DialogHeader className="space-y-2">
                                                <DialogTitle className="text-xl font-bold tracking-tight text-foreground uppercase tracking-widest">Borrow Request</DialogTitle>
                                                <DialogDescription className="text-xs text-muted-foreground font-medium uppercase tracking-tighter">
                                                    Briefly describe your project for quick approval.
                                                </DialogDescription>
                                            </DialogHeader>

                                            <div className="grid gap-4">
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="quantity" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantity (Max: {item.quantity_available})</Label>
                                                    <Input
                                                        id="quantity"
                                                        type="number"
                                                        min="1"
                                                        max={item.quantity_available}
                                                        value={requestForm.quantity}
                                                        onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })}
                                                        required
                                                        className="h-9 bg-transparent border border-border rounded-sm focus-visible:ring-1 focus-visible:ring-foreground text-sm px-3 tabular-nums"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Project Name</Label>
                                                    <Input
                                                        id="title"
                                                        placeholder="e.g. Robotics Controller"
                                                        value={requestForm.project_title}
                                                        onChange={(e) => setRequestForm({ ...requestForm, project_title: e.target.value })}
                                                        required
                                                        className="h-9 bg-transparent border border-border rounded-sm focus-visible:ring-1 focus-visible:ring-foreground text-sm px-3"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Project Description</Label>
                                                    <Textarea
                                                        id="description"
                                                        placeholder="Briefly explain your use case."
                                                        className="min-h-[80px] bg-transparent border border-border rounded-sm focus-visible:ring-1 focus-visible:ring-foreground text-sm p-3 resize-none"
                                                        value={requestForm.project_description}
                                                        onChange={(e) => setRequestForm({ ...requestForm, project_description: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <DialogFooter className="gap-2 sm:space-x-0">
                                                <Button type="button" variant="outline" className="h-9 w-full rounded-sm font-black uppercase tracking-widest text-[10px] border border-border hover:bg-muted" onClick={() => setShowRequestForm(false)}>
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={submitting}
                                                    className="h-9 w-full rounded-sm font-black uppercase tracking-widest text-[10px] bg-foreground text-background hover:bg-foreground/90 flex items-center justify-center gap-2 transition-colors"
                                                >
                                                    {submitting ? 'Processing...' : 'Submit Request'}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            ) : isStudent && item.quantity_available === 0 ? (
                                <div className="w-full space-y-5">
                                    {/* Out of Stock Label */}
                                    <div className="flex items-center justify-center gap-3 p-4 rounded-sm bg-muted/20 border border-border">
                                        <AlertCircle size={18} className="text-muted-foreground" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Out of Stock</span>
                                    </div>

                                    {/* Queue Info */}
                                    {prebookCount > 0 && (
                                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                            <Users size={14} className="text-foreground/40" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">
                                                {prebookCount} {prebookCount === 1 ? 'person' : 'people'} in waitlist
                                            </span>
                                        </div>
                                    )}

                                    {/* Pre-Book Actions */}
                                    {prebookInfo?.in_queue ? (
                                        <div className="space-y-4">
                                            <div className="p-4 rounded-sm bg-muted/30 border border-border space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 shrink-0 rounded-sm bg-background border border-border flex items-center justify-center text-foreground">
                                                        <BookmarkCheck size={16} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Queue Position</span>
                                                        <span className="font-black text-foreground text-sm tabular-nums">#{prebookInfo.position}</span>
                                                    </div>
                                                </div>
                                                {prebookInfo.status === 'notified' && prebookInfo.hold_expires_at && (
                                                    <div className="flex items-center gap-2 p-2 rounded-sm bg-yellow-500/10 border border-yellow-200">
                                                        <Timer size={14} className="text-yellow-700" />
                                                        <span className="text-[9px] font-bold text-yellow-800 uppercase tracking-tighter">
                                                            Hold active — claim now
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {prebookInfo.status === 'notified' ? (
                                                <Button
                                                    className="w-full h-10 rounded-sm font-black uppercase text-xs tracking-widest bg-foreground text-background hover:bg-foreground/90 transition-colors"
                                                    onClick={() => navigate('/my-prebooks')}
                                                >
                                                    <Zap size={14} className="mr-2" />
                                                    Go Claim Now
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    className="w-full h-10 rounded-sm border-border font-black uppercase text-[10px] tracking-widest transition-all hover:bg-muted"
                                                    onClick={handleCancelPrebook}
                                                    disabled={prebooking}
                                                >
                                                    {prebooking ? 'Cancelling...' : 'Leave Waitlist'}
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <Button
                                            className="w-full h-10 text-xs font-black uppercase tracking-widest rounded-sm bg-foreground text-background hover:bg-foreground/90 transition-colors"
                                            onClick={handlePrebook}
                                            disabled={prebooking}
                                        >
                                            {prebooking ? (
                                                <>Joining Waitlist...</>
                                            ) : (
                                                <>
                                                    <BookmarkCheck className="mr-2 h-4 w-4" />
                                                    Join Waitlist
                                                </>
                                            )}
                                        </Button>
                                    )}

                                    <p className="text-[9px] text-center font-bold uppercase tracking-tighter text-muted-foreground leading-tight px-4">
                                        Join the waitlist to get notified when this item becomes available in the lab.
                                    </p>
                                </div>
                            ) : (
                                <div className="w-full space-y-4">
                                    <Button variant="secondary" className="w-full h-10 rounded-md opacity-40 cursor-not-allowed font-bold uppercase text-xs tracking-widest" disabled>
                                        {item.quantity_available === 0 ? 'Out of Stock' : 'Admin Only'}
                                    </Button>
                                    <p className="text-[10px] text-center font-bold uppercase tracking-widest text-muted-foreground leading-tight">
                                        Only the owner can manage this.
                                    </p>
                                </div>
                            )}
                        </CardFooter>
                    </Card>
                </aside>
            </div >
        </div >
    );
}

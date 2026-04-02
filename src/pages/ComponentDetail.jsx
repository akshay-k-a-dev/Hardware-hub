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

    // Pre-book state
    const [prebookInfo, setPrebookInfo] = useState(null); // { in_queue, prebook_id, position, status, hold_expires_at }
    const [prebookCount, setPrebookCount] = useState(0);
    const [prebooking, setPrebooking] = useState(false);

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
                title: "Pre-Book Confirmed!",
                description: `You are #${data.position} in the waitlist. We'll notify you when it's available.`,
            });
            loadPrebookInfo();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Pre-Book Failed",
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
                title: "Pre-Book Cancelled",
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
        setSubmitting(true);

        const { error } = await supabase.from('requests').insert({
            user_id: profile.id,
            hardware_id: item.id,
            quantity: parseInt(requestForm.quantity),
            project_title: requestForm.project_title,
            project_description: requestForm.project_description,
        });

        if (error) {
            toast({
                variant: "destructive",
                title: "Request Failed",
                description: error.message,
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
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 p-4 md:p-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="group h-10 px-4 rounded-md bg-card border border-border hover:bg-muted font-bold text-xs uppercase tracking-widest transition-all"
                    onClick={() => navigate('/components')}
                >
                    <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    Back to Lab
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
                                {item.image_url ? (
                                    <img
                                        src={item.image_url}
                                        alt={item.name}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                                        <div className="p-6 rounded-md bg-muted border border-border mb-4">
                                            <Cpu size={48} className="text-muted-foreground" />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Visual reference unavailable</p>
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

                                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
                                        {item.name}
                                    </h1>

                                    <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-3xl border-l-2 border-border pl-4">
                                        {item.description || "Experimental hardware reserved for advanced laboratory research and development projects."}
                                    </p>

                                    <div className="flex items-center gap-4 pt-2">
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border">
                                            <MapPin size={12} className="text-muted-foreground" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location: </span>
                                            <span className="text-[10px] font-bold uppercase text-foreground">{item.owner?.lab_name || 'Main Lab'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="bg-card border border-border rounded-md overflow-hidden shadow-sm">
                        <div className="py-4 px-6 border-b border-border bg-muted/50">
                            <h3 className="text-lg font-bold flex items-center gap-2 tracking-tight">
                                <span className="p-1.5 rounded-md bg-muted text-muted-foreground">
                                    <ShieldCheck className="h-4 w-4" />
                                </span>
                                Technical Specs
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
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Specifics not listed</p>
                                </div>
                            )}

                            <div className="mt-6 p-4 rounded-md bg-muted/50 border border-border flex items-start gap-4">
                                <div className="p-2 rounded-md bg-background border border-border text-foreground shrink-0">
                                    <FileText size={16} />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm tracking-tight">Laboratory Note</h4>
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
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-foreground">Live Lab Stock</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="relative text-center p-6 rounded-md bg-muted/30 border border-border shadow-sm">
                                <div className="text-4xl font-bold tracking-tight mb-1 text-foreground tabular-nums">
                                    {item.quantity_available}
                                </div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    Units in Lab
                                </div>
                                <div className="mt-6 h-2 w-full bg-border rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-lg ${availRatio > 0.5 ? 'bg-emerald-500' :
                                            availRatio > 0.2 ? 'bg-amber-500' : 'bg-destructive'
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
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Loan Duration</span>
                                        <span className="text-sm font-semibold text-foreground">{item.max_lending_days} Days</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border border-border">
                                    <div className="h-8 w-8 shrink-0 rounded-md bg-background border border-border flex items-center justify-center text-foreground">
                                        <User size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Lab In Charge</span>
                                        <span className="text-sm font-semibold text-foreground">{item.owner?.name}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="p-6 pt-0">
                            {isStudent && item.status === 'available' && item.quantity_available > 0 ? (
                                <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full h-10 text-xs font-bold uppercase tracking-widest rounded-md bg-foreground text-background">
                                            Borrow Item
                                            <ArrowRightCircle className="ml-2 h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[420px] bg-background border border-border rounded-none p-6 shadow-none animate-in zoom-in-95 duration-200">
                                        <form onSubmit={handleRequest} className="space-y-6">
                                            <DialogHeader className="space-y-2">
                                                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Borrow Request</DialogTitle>
                                                <DialogDescription className="text-sm text-muted-foreground">
                                                    Briefly describe your project for quick approval.
                                                </DialogDescription>
                                            </DialogHeader>

                                            <div className="grid gap-4">
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="quantity" className="text-xs font-semibold text-foreground">Quantity Needed (Max: {item.quantity_available})</Label>
                                                    <Input
                                                        id="quantity"
                                                        type="number"
                                                        min="1"
                                                        max={item.quantity_available}
                                                        value={requestForm.quantity}
                                                        onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })}
                                                        required
                                                        className="h-9 bg-transparent border border-border rounded-none focus-visible:ring-1 focus-visible:ring-foreground text-sm px-3 tabular-nums"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="title" className="text-xs font-semibold text-foreground">Project Name</Label>
                                                    <Input
                                                        id="title"
                                                        placeholder="e.g. Robotics Controller"
                                                        value={requestForm.project_title}
                                                        onChange={(e) => setRequestForm({ ...requestForm, project_title: e.target.value })}
                                                        required
                                                        className="h-9 bg-transparent border border-border rounded-none focus-visible:ring-1 focus-visible:ring-foreground text-sm px-3"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="description" className="text-xs font-semibold text-foreground">Project Description</Label>
                                                    <Textarea
                                                        id="description"
                                                        placeholder="Briefly explain your use case."
                                                        className="min-h-[80px] bg-transparent border border-border rounded-none focus-visible:ring-1 focus-visible:ring-foreground text-sm p-3 resize-none"
                                                        value={requestForm.project_description}
                                                        onChange={(e) => setRequestForm({ ...requestForm, project_description: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <DialogFooter className="gap-2 sm:space-x-0">
                                                <Button type="button" variant="outline" className="h-9 w-full rounded-none font-semibold text-xs border border-border hover:bg-accent" onClick={() => setShowRequestForm(false)}>
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={submitting}
                                                    className="h-9 w-full rounded-none font-semibold text-xs bg-foreground text-background hover:bg-foreground/90 flex items-center justify-center gap-2"
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
                                    <div className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-destructive/5 border border-destructive/20">
                                        <AlertCircle size={18} className="text-destructive" />
                                        <span className="text-sm font-black uppercase tracking-widest text-destructive">Out of Stock</span>
                                    </div>

                                    {/* Queue Info */}
                                    {prebookCount > 0 && (
                                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                            <Users size={14} className="text-primary/60" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                {prebookCount} {prebookCount === 1 ? 'person' : 'people'} in waitlist
                                            </span>
                                        </div>
                                    )}

                                    {/* Pre-Book Actions */}
                                    {prebookInfo?.in_queue ? (
                                        <div className="space-y-4">
                                            <div className="p-4 rounded-md bg-muted/30 border border-border space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 shrink-0 rounded-md bg-background border border-border flex items-center justify-center text-foreground">
                                                        <BookmarkCheck size={16} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Your Queue Position</span>
                                                        <span className="font-semibold text-foreground text-sm">#{prebookInfo.position}</span>
                                                    </div>
                                                </div>
                                                {prebookInfo.status === 'notified' && prebookInfo.hold_expires_at && (
                                                    <div className="flex items-center gap-2 p-2 rounded-md bg-background border border-border">
                                                        <Timer size={14} className="text-foreground" />
                                                        <span className="text-[10px] font-bold text-foreground">
                                                            Hold active — claim before it expires!
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {prebookInfo.status === 'notified' ? (
                                                <Button
                                                    className="w-full h-10 rounded-md font-bold uppercase text-xs tracking-widest bg-foreground text-background"
                                                    onClick={() => navigate('/my-prebooks')}
                                                >
                                                    <Zap size={14} className="mr-2" />
                                                    Go Claim Now
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    className="w-full h-10 rounded-md border-border font-bold uppercase text-[10px] tracking-widest transition-all"
                                                    onClick={handleCancelPrebook}
                                                    disabled={prebooking}
                                                >
                                                    {prebooking ? 'Cancelling...' : 'Cancel Pre-Book'}
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <Button
                                            className="w-full h-10 text-xs font-bold uppercase tracking-widest rounded-md bg-foreground text-background hover:bg-foreground/90"
                                            onClick={handlePrebook}
                                            disabled={prebooking}
                                        >
                                            {prebooking ? (
                                                <>Joining Waitlist...</>
                                            ) : (
                                                <>
                                                    <BookmarkCheck className="mr-2 h-4 w-4" />
                                                    Pre-Book / Hold Item
                                                </>
                                            )}
                                        </Button>
                                    )}

                                    <p className="text-[10px] text-center font-bold uppercase tracking-widest text-muted-foreground leading-tight">
                                        Join the waitlist to get notified when this item becomes available.
                                    </p>
                                </div>
                            ) : (
                                <div className="w-full space-y-4">
                                    <Button variant="secondary" className="w-full h-10 rounded-md opacity-40 cursor-not-allowed font-bold uppercase text-xs tracking-widest" disabled>
                                        {item.quantity_available === 0 ? 'Out of Stock' : 'Admin Only'}
                                    </Button>
                                    <p className="text-[10px] text-center font-bold uppercase tracking-widest text-muted-foreground leading-tight">
                                        Laboratory access restricted for this item.
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

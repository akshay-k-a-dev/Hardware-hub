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
    Users
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
    const { profile, isStudent } = useAuth();
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
            <div className="max-w-7xl mx-auto space-y-10 animate-pulse p-4">
                <Skeleton className="h-10 w-48 rounded-xl" />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-8 space-y-10">
                        <Skeleton className="h-[250px] w-full rounded-[2.5rem]" />
                        <Skeleton className="h-[400px] w-full rounded-[2.5rem]" />
                    </div>
                    <div className="lg:col-span-4 self-start">
                        <Skeleton className="h-[500px] w-full rounded-[2.5rem]" />
                    </div>
                </div>
            </div>
        );
    }

    const availRatio = item.quantity_available / item.quantity_total;

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 p-2 md:p-0">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="group h-12 px-6 rounded-2xl bg-card border border-border hover:bg-primary/5 hover:border-primary/20 hover:text-primary font-black text-xs uppercase tracking-widest transition-all"
                    onClick={() => navigate('/components')}
                >
                    <ArrowLeft className="h-4 w-4 mr-3 transition-transform group-hover:-translate-x-2" />
                    Back to Lab
                </Button>

                <div className="flex items-center gap-3 bg-card border border-border px-5 py-2.5 rounded-2xl shadow-sm">
                    <History size={16} className="text-primary/60" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ID: </span>
                    <span className="text-[10px] font-black uppercase text-primary tabular-nums">{item.id.split('-')[0]}</span>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                <div className="lg:col-span-8 space-y-10">
                    <section className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden group">
                        <div className="grid grid-cols-1 md:grid-cols-2">
                            {/* Image Container */}
                            <div className="relative h-[300px] md:h-full min-h-[400px] overflow-hidden bg-muted/20">
                                {item.image_url ? (
                                    <img
                                        src={item.image_url}
                                        alt={item.name}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                                        <div className="p-8 rounded-[2rem] bg-primary/5 border border-primary/10 mb-6">
                                            <Cpu size={64} className="text-primary/20" />
                                        </div>
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/40">Visual reference unavailable</p>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                            </div>

                            {/* Content Side */}
                            <div className="p-10 md:p-12 flex flex-col justify-center relative">
                                <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                                    <Zap size={160} />
                                </div>

                                <div className="relative space-y-8">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <Badge variant="outline" className="h-7 px-4 font-black uppercase tracking-widest border-primary/20 bg-primary/5 text-primary">
                                            {item.category}
                                        </Badge>
                                        <StatusBadge status={item.status} className="h-7 px-4 font-black" />
                                    </div>

                                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-foreground leading-[0.9]">
                                        {item.name}
                                    </h1>

                                    <p className="text-lg text-muted-foreground/80 font-medium leading-relaxed max-w-3xl border-l-4 border-primary/20 pl-8 ml-1">
                                        {item.description || "Experimental hardware reserved for advanced laboratory research and development projects."}
                                    </p>

                                    <div className="flex items-center gap-4 pt-4">
                                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/30 border border-border">
                                            <MapPin size={14} className="text-primary/60" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Location: </span>
                                            <span className="text-[10px] font-black uppercase text-foreground">{item.owner?.lab_name || 'Main Lab'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-sm">
                        <div className="py-8 px-10 border-b border-border bg-muted/20">
                            <h3 className="text-2xl font-black flex items-center gap-4 tracking-tight">
                                <span className="p-3 rounded-2xl bg-primary/10 text-primary">
                                    <ShieldCheck className="h-6 w-6" />
                                </span>
                                Technical Specs
                            </h3>
                        </div>

                        <div className="p-10">
                            {item.specs && Object.keys(item.specs).length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {Object.entries(item.specs).map(([key, val]) => (
                                        <div
                                            className="group flex flex-col p-6 rounded-3xl bg-muted/20 border border-border hover:border-primary/40 hover:bg-primary/5 transition-all duration-500"
                                            key={key}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-8 w-8 rounded-xl bg-background/60 flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
                                                    <Zap size={14} />
                                                </div>
                                                <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">{key}</span>
                                            </div>
                                            <span className="text-lg font-bold text-foreground pl-1">{val}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-[2rem] border border-dashed border-border/40 opacity-60">
                                    <Info size={40} className="text-muted-foreground/30 mb-4" />
                                    <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">Specifics not listed</p>
                                </div>
                            )}

                            <div className="mt-10 p-8 rounded-3xl bg-primary/5 border border-primary/10 flex items-start gap-6">
                                <div className="p-3 rounded-2xl bg-primary/10 text-primary shrink-0">
                                    <FileText size={24} />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-black text-primary tracking-tight italic">Laboratory Note</h4>
                                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                                        Use ESD protection when handling. Make sure you've read the basic setup guide before borrowing.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="lg:col-span-4 space-y-8 lg:sticky lg:top-10 self-start">
                    <Card className="border border-border bg-card shadow-lg rounded-[2.5rem] overflow-hidden group/sidebar">
                        <CardHeader className="py-8 px-10 border-b border-border bg-muted/20">
                            <CardTitle className="text-xl font-black uppercase tracking-tight text-primary/80">Live Lab Stock</CardTitle>
                        </CardHeader>
                        <CardContent className="p-10 space-y-10">
                            <div className="relative text-center p-10 rounded-[2.5rem] bg-gradient-to-br from-muted/50 to-muted/20 border-2 border-border/40 shadow-inner group-hover/sidebar:border-primary/20 transition-all duration-500">
                                <div className="absolute top-4 right-4 animate-pulse">
                                    <div className="h-3 w-3 rounded-full bg-primary shadow-lg shadow-primary/40" />
                                </div>
                                <div className="text-7xl font-black tracking-tighter mb-2 text-foreground tabular-nums">
                                    {item.quantity_available}
                                </div>
                                <div className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
                                    Units in Lab
                                </div>
                                <div className="mt-10 h-4 w-full bg-background rounded-full overflow-hidden p-1 shadow-inner">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-lg ${availRatio > 0.5 ? 'bg-emerald-500' :
                                            availRatio > 0.2 ? 'bg-amber-500' : 'bg-destructive'
                                            }`}
                                        style={{ width: `${availRatio * 100}%` }}
                                    />
                                </div>
                                <div className="mt-4 flex items-center justify-between px-2">
                                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase">Total: {item.quantity_total}</span>
                                    <span className="text-[10px] font-black text-primary uppercase">{Math.round(availRatio * 100)}% Available</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4 p-5 rounded-3xl bg-muted/20 border border-border group/info hover:border-primary/20 transition-all">
                                    <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover/info:bg-primary group-hover/info:text-primary-foreground transition-all">
                                        <Clock size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Loan Duration</span>
                                        <span className="font-bold text-foreground">{item.max_lending_days} Days</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-5 rounded-3xl bg-muted/20 border border-border group/info hover:border-blue-500/20 transition-all">
                                    <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover/info:bg-blue-500 group-hover/info:text-white transition-all">
                                        <User size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Lab In Charge</span>
                                        <span className="font-bold text-foreground">{item.owner?.name}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="p-10 pt-0">
                            {isStudent && item.status === 'available' && item.quantity_available > 0 ? (
                                <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full h-16 text-sm font-black uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all rounded-3xl bg-primary text-primary-foreground">
                                            Borrow Item
                                            <ArrowRightCircle className="ml-3 h-5 w-5" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[600px] bg-card border border-border rounded-[2.5rem] p-10 shadow-xl animate-in zoom-in-95 duration-300">
                                        <form onSubmit={handleRequest} className="space-y-10">
                                            <DialogHeader className="space-y-4">
                                                <div className="h-16 w-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary mb-2">
                                                    <Layout size={32} />
                                                </div>
                                                <DialogTitle className="text-4xl font-black tracking-tight text-foreground leading-none">Borrow Request</DialogTitle>
                                                <DialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed">
                                                    Briefly describe your project to help us approve your request faster.
                                                </DialogDescription>
                                            </DialogHeader>

                                            <div className="grid gap-8">
                                                <div className="space-y-3">
                                                    <Label htmlFor="quantity" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Quantity Needed (Max: {item.quantity_available})</Label>
                                                    <Input
                                                        id="quantity"
                                                        type="number"
                                                        min="1"
                                                        max={item.quantity_available}
                                                        value={requestForm.quantity}
                                                        onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })}
                                                        required
                                                        className="h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-lg font-bold px-6 tabular-nums"
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label htmlFor="title" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Project Name</Label>
                                                    <Input
                                                        id="title"
                                                        placeholder="e.g. Robotics Controller"
                                                        value={requestForm.project_title}
                                                        onChange={(e) => setRequestForm({ ...requestForm, project_title: e.target.value })}
                                                        required
                                                        className="h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-lg font-bold px-6"
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Project Description</Label>
                                                    <Textarea
                                                        id="description"
                                                        placeholder="Briefly explain how you'll use this for your project."
                                                        className="min-h-[150px] bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-lg font-bold p-6 leading-relaxed"
                                                        value={requestForm.project_description}
                                                        onChange={(e) => setRequestForm({ ...requestForm, project_description: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <DialogFooter className="gap-4">
                                                <Button type="button" variant="ghost" className="h-14 flex-1 rounded-2xl font-black uppercase text-xs border border-border hover:bg-muted/30" onClick={() => setShowRequestForm(false)}>
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={submitting}
                                                    className="h-14 px-10 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-3"
                                                >
                                                    {submitting ? (
                                                        <>Processing...</>
                                                    ) : (
                                                        <>Submit Request <ArrowRightCircle size={18} /></>
                                                    )}
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
                                            <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                        <BookmarkCheck size={20} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Your Queue Position</span>
                                                        <span className="font-bold text-foreground text-lg">#{prebookInfo.position}</span>
                                                    </div>
                                                </div>
                                                {prebookInfo.status === 'notified' && prebookInfo.hold_expires_at && (
                                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 animate-pulse">
                                                        <Timer size={14} className="text-blue-500" />
                                                        <span className="text-xs font-bold text-blue-600">
                                                            Hold active — claim before it expires!
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {prebookInfo.status === 'notified' ? (
                                                <Button
                                                    className="w-full h-14 rounded-3xl font-black uppercase text-xs tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-primary-foreground"
                                                    onClick={() => navigate('/my-prebooks')}
                                                >
                                                    <Zap size={16} className="mr-2" />
                                                    Go Claim Now
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    className="w-full h-14 rounded-3xl border-destructive/30 text-destructive hover:bg-destructive/10 font-black uppercase text-[10px] tracking-widest transition-all"
                                                    onClick={handleCancelPrebook}
                                                    disabled={prebooking}
                                                >
                                                    {prebooking ? 'Cancelling...' : 'Cancel Pre-Book'}
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <Button
                                            className="w-full h-16 text-sm font-black uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:from-amber-600 hover:to-orange-600"
                                            onClick={handlePrebook}
                                            disabled={prebooking}
                                        >
                                            {prebooking ? (
                                                <>Joining Waitlist...</>
                                            ) : (
                                                <>
                                                    <BookmarkCheck className="mr-3 h-5 w-5" />
                                                    Pre-Book / Hold Item
                                                </>
                                            )}
                                        </Button>
                                    )}

                                    <p className="text-[10px] text-center font-black uppercase tracking-tighter text-muted-foreground/40 leading-tight">
                                        Join the waitlist to get notified when this item becomes available.
                                    </p>
                                </div>
                            ) : (
                                <div className="w-full space-y-4">
                                    <Button variant="secondary" className="w-full h-16 rounded-3xl opacity-40 cursor-not-allowed font-black uppercase text-xs tracking-widest" disabled>
                                        {item.quantity_available === 0 ? 'Out of Stock' : 'Admin Only'}
                                    </Button>
                                    <p className="text-[10px] text-center font-black uppercase tracking-tighter text-muted-foreground/40 leading-tight">
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

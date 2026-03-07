import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookmarkCheck,
    Clock,
    Package,
    Trash2,
    AlertTriangle,
    Bell,
    CheckCircle2,
    XCircle,
    Timer,
    ArrowRight,
    Info,
    Hourglass,
    Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const prebookStatusConfig = {
    waiting: { color: 'bg-amber-500/5 text-amber-600 border-amber-500/20', icon: Clock, label: 'In Queue' },
    notified: { color: 'bg-blue-500/5 text-blue-600 border-blue-500/20', icon: Bell, label: 'Ready to Claim' },
    claimed: { color: 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10', icon: CheckCircle2, label: 'Claimed' },
    expired: { color: 'bg-muted text-muted-foreground border-border', icon: Timer, label: 'Expired' },
    cancelled: { color: 'bg-muted text-muted-foreground border-border', icon: XCircle, label: 'Cancelled' },
};

function PrebookStatusBadge({ status, className = '' }) {
    const config = prebookStatusConfig[status] || prebookStatusConfig.waiting;
    const Icon = config.icon;
    return (
        <Badge
            variant="outline"
            className={`font-black text-[10px] uppercase tracking-widest flex items-center gap-2 w-fit h-7 px-3 rounded-xl border transition-all duration-300 ${config.color} ${className}`}
        >
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}

export default function MyPreBooks() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [prebooks, setPrebooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [claimDialog, setClaimDialog] = useState({ open: false, prebook: null });
    const [claimForm, setClaimForm] = useState({ project_title: '', project_description: '' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (profile) loadPrebooks();
    }, [profile]);

    const loadPrebooks = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('prebook_queue')
                .select('*, hardware:hardware_items(id, name, category, image_url)')
                .eq('user_id', profile.id)
                .order('requested_at', { ascending: false });

            if (error) throw error;
            setPrebooks(data || []);
        } catch (error) {
            console.error('Error loading prebooks:', error);
            toast({
                variant: "destructive",
                title: "Load Failed",
                description: "Could not retrieve your pre-books.",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (prebookId) => {
        try {
            const { data, error } = await supabase.rpc('cancel_prebook', { p_prebook_id: prebookId });
            if (error) throw error;
            toast({
                title: "Pre-Book Cancelled",
                description: data?.message || "Your reservation has been removed.",
            });
            loadPrebooks();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Cancellation Failed",
                description: error.message,
            });
        }
    };

    const handleClaim = async (e) => {
        e.preventDefault();
        if (!claimDialog.prebook) return;
        setSubmitting(true);

        try {
            const { data, error } = await supabase.rpc('claim_prebook', {
                p_prebook_id: claimDialog.prebook.id,
                p_project_title: claimForm.project_title || 'Pre-Booked Item',
                p_project_description: claimForm.project_description || null,
            });
            if (error) throw error;
            toast({
                title: "Item Claimed!",
                description: "Your borrow request has been created and is pending approval.",
            });
            setClaimDialog({ open: false, prebook: null });
            setClaimForm({ project_title: '', project_description: '' });
            loadPrebooks();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Claim Failed",
                description: error.message,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getTimeRemaining = (expiresAt) => {
        if (!expiresAt) return null;
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry - now;
        if (diff <= 0) return 'Expired';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m remaining`;
    };

    const activePrebooks = prebooks.filter(p => ['waiting', 'notified'].includes(p.status));
    const pastPrebooks = prebooks.filter(p => ['claimed', 'expired', 'cancelled'].includes(p.status));

    if (loading && prebooks.length === 0) {
        return (
            <div className="space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-64 rounded-lg" />
                    <Skeleton className="h-4 w-[450px]" />
                </div>
                <div className="grid gap-6">
                    <Skeleton className="h-[200px] w-full rounded-[2.5rem]" />
                    <Skeleton className="h-[200px] w-full rounded-[2.5rem]" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto">
            <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pb-2 px-1">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 md:gap-3 text-primary mb-1">
                        <div className="p-1.5 md:p-2 rounded-xl bg-primary/10">
                            <BookmarkCheck className="h-5 w-5 md:h-6 md:w-6" />
                        </div>
                        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-foreground">My Pre-Books</h1>
                    </div>
                    <p className="text-muted-foreground text-sm md:text-lg font-medium">
                        Track your waitlist reservations and claim items when they become available.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-10 md:h-12 px-4 md:px-6 rounded-xl md:rounded-2xl bg-muted/30 border border-border flex items-center gap-3">
                        <Hourglass size={16} className="text-primary/60" />
                        <span className="text-[10px] md:text-xs font-black text-muted-foreground uppercase tracking-wider">
                            {activePrebooks.length} Active
                        </span>
                    </div>
                </div>
            </header>

            {/* Active Pre-Books */}
            {activePrebooks.length > 0 && (
                <div className="space-y-6">
                    <h2 className="text-lg font-black uppercase tracking-widest text-muted-foreground/60 px-1">Active Reservations</h2>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {activePrebooks.map((pb, idx) => (
                            <Card
                                key={pb.id}
                                className={`border border-border bg-card rounded-[2rem] overflow-hidden group/card relative transition-all duration-500 hover:shadow-lg hover:border-primary/30 animate-in slide-in-from-bottom-6 duration-700 ${pb.status === 'notified' ? 'ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10' : ''}`}
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                {pb.status === 'notified' && (
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-primary to-blue-500 animate-pulse" />
                                )}

                                {/* Image / Visual Header */}
                                <div className="relative h-32 overflow-hidden bg-gradient-to-br from-muted/30 to-muted/10">
                                    {pb.hardware?.image_url ? (
                                        <img
                                            src={pb.hardware.image_url}
                                            alt={pb.hardware?.name}
                                            className="w-full h-full object-cover opacity-60 group-hover/card:opacity-80 transition-opacity"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package size={40} className="text-muted-foreground/10" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                                    <div className="absolute top-3 right-3">
                                        <PrebookStatusBadge status={pb.status} />
                                    </div>
                                    <div className="absolute bottom-3 left-4">
                                        <Badge variant="secondary" className="bg-background/80 backdrop-blur-md text-[8px] font-black uppercase tracking-widest border border-border/40 py-1 px-2">
                                            #{pb.position} in Queue
                                        </Badge>
                                    </div>
                                </div>

                                <CardContent className="p-6 space-y-5">
                                    <div>
                                        <h3
                                            className="text-xl font-black tracking-tight text-foreground group-hover/card:text-primary transition-colors cursor-pointer line-clamp-1"
                                            onClick={() => navigate(`/components/${pb.hardware?.id}`)}
                                        >
                                            {pb.hardware?.name || 'Unknown Item'}
                                        </h3>
                                        <p className="text-xs text-muted-foreground font-medium mt-1">
                                            Requested {formatDate(pb.requested_at)}
                                        </p>
                                    </div>

                                    {pb.status === 'notified' && pb.hold_expires_at && (
                                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 animate-pulse">
                                            <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                <Timer size={20} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Hold Timer</span>
                                                <span className="font-bold text-sm text-foreground">{getTimeRemaining(pb.hold_expires_at)}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        {pb.status === 'notified' && (
                                            <Button
                                                className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
                                                onClick={() => {
                                                    setClaimDialog({ open: true, prebook: pb });
                                                    setClaimForm({ project_title: '', project_description: '' });
                                                }}
                                            >
                                                <Zap size={14} className="mr-2" />
                                                Claim Now
                                            </Button>
                                        )}

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={`h-12 rounded-2xl border-border hover:border-destructive/40 hover:bg-destructive/10 text-muted-foreground hover:text-destructive font-black text-[10px] uppercase tracking-widest transition-all ${pb.status === 'notified' ? 'px-4' : 'flex-1'}`}
                                                >
                                                    <Trash2 size={14} className={pb.status === 'notified' ? '' : 'mr-2'} />
                                                    {pb.status === 'notified' ? '' : 'Cancel'}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="bg-card border border-border rounded-[2rem] shadow-xl p-10 animate-in zoom-in-95 duration-300">
                                                <AlertDialogHeader>
                                                    <div className="p-4 w-fit rounded-2xl bg-destructive/10 text-destructive mb-4">
                                                        <AlertTriangle className="h-8 w-8" />
                                                    </div>
                                                    <AlertDialogTitle className="text-3xl font-black tracking-tight text-foreground mb-2 leading-none">Cancel Pre-Book?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed">
                                                        You'll lose your #{pb.position} position in the queue for <strong>"{pb.hardware?.name}"</strong>. This cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="mt-10 gap-4">
                                                    <AlertDialogCancel className="h-14 px-8 rounded-2xl font-black text-xs uppercase border-2 border-border/60 hover:bg-muted/20">Keep Reservation</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        className="h-14 px-10 rounded-2xl font-black text-xs uppercase bg-destructive hover:bg-destructive/90 shadow-xl shadow-destructive/20"
                                                        onClick={() => handleCancel(pb.id)}
                                                    >
                                                        Yes, Cancel
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {activePrebooks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center border-4 border-dashed border-border/40 rounded-[3rem] bg-card/20 backdrop-blur-sm animate-in zoom-in-95 duration-500">
                    <div className="p-8 rounded-[2rem] bg-muted/40 mb-8 ring-8 ring-muted/20">
                        <BookmarkCheck className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-3xl font-black text-foreground tracking-tight">No Active Pre-Books</h3>
                    <p className="text-muted-foreground max-w-md mt-4 text-lg font-medium leading-relaxed">
                        When items are out of stock, you can pre-book them to join the waitlist. You'll be notified when they're available.
                    </p>
                    <Button
                        variant="outline"
                        size="lg"
                        className="mt-10 h-14 px-10 rounded-2xl font-bold border-2 hover:bg-muted/40 border-border/60"
                        onClick={() => navigate('/components')}
                    >
                        Browse Hardware Lab
                    </Button>
                </div>
            )}

            {/* Past Pre-Books */}
            {pastPrebooks.length > 0 && (
                <div className="space-y-6">
                    <h2 className="text-lg font-black uppercase tracking-widest text-muted-foreground/60 px-1">Past Reservations</h2>
                    <Card className="border border-border bg-card shadow-sm rounded-[2.5rem] overflow-hidden">
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/20">
                                {pastPrebooks.map((pb, idx) => (
                                    <div
                                        key={pb.id}
                                        className="flex items-center justify-between p-6 hover:bg-muted/10 transition-colors animate-in slide-in-from-right-4 duration-500"
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-muted/30 border border-border flex items-center justify-center">
                                                <Package size={20} className="text-muted-foreground/40" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span
                                                    className="font-bold text-foreground hover:text-primary cursor-pointer transition-colors"
                                                    onClick={() => navigate(`/components/${pb.hardware?.id}`)}
                                                >
                                                    {pb.hardware?.name || 'Unknown Item'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    Requested {formatDate(pb.requested_at)}
                                                </span>
                                            </div>
                                        </div>
                                        <PrebookStatusBadge status={pb.status} />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Info Banner */}
            <div className="p-10 rounded-[2.5rem] bg-primary/5 border border-primary/10 flex flex-col md:flex-row items-center gap-10 animate-in slide-in-from-bottom-8 duration-1000">
                <div className="h-20 w-20 shrink-0 rounded-[1.5rem] bg-primary/20 flex items-center justify-center text-primary border border-primary/10">
                    <Info size={40} />
                </div>
                <div className="space-y-2 flex-1 text-center md:text-left">
                    <h4 className="text-xl font-black text-primary tracking-tight italic">How Pre-Booking Works</h4>
                    <p className="text-sm text-muted-foreground font-bold leading-relaxed max-w-3xl">
                        When an item is out of stock, join the waitlist. When it's returned, you'll be notified and given a 24-hour window to claim it. If you don't claim it in time, it moves to the next person.
                    </p>
                </div>
            </div>

            {/* Claim Dialog */}
            <Dialog open={claimDialog.open} onOpenChange={(open) => setClaimDialog({ ...claimDialog, open })}>
                <DialogContent className="sm:max-w-[600px] bg-card border border-border rounded-[2.5rem] p-10 shadow-xl animate-in zoom-in-95 duration-300">
                    <form onSubmit={handleClaim} className="space-y-10">
                        <DialogHeader className="space-y-4">
                            <div className="h-16 w-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary mb-2">
                                <Zap size={32} />
                            </div>
                            <DialogTitle className="text-4xl font-black tracking-tight text-foreground leading-none">Claim Your Item</DialogTitle>
                            <DialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed">
                                Almost there! Describe your project and we'll create a borrow request for <strong>"{claimDialog.prebook?.hardware?.name}"</strong>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-8">
                            <div className="space-y-3">
                                <Label htmlFor="claim-title" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Project Name</Label>
                                <Input
                                    id="claim-title"
                                    placeholder="e.g. IoT Sensor Network"
                                    value={claimForm.project_title}
                                    onChange={(e) => setClaimForm({ ...claimForm, project_title: e.target.value })}
                                    required
                                    className="h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-lg font-bold px-6"
                                />
                            </div>
                            <div className="space-y-3">
                                <Label htmlFor="claim-desc" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Project Description (Optional)</Label>
                                <Textarea
                                    id="claim-desc"
                                    placeholder="Briefly explain how you'll use this for your project."
                                    className="min-h-[120px] bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-lg font-bold p-6 leading-relaxed"
                                    value={claimForm.project_description}
                                    onChange={(e) => setClaimForm({ ...claimForm, project_description: e.target.value })}
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-4">
                            <Button type="button" variant="ghost" className="h-14 flex-1 rounded-2xl font-black uppercase text-xs border border-border hover:bg-muted/30" onClick={() => setClaimDialog({ open: false, prebook: null })}>
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
                                    <>Claim & Request <ArrowRight size={18} /></>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

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
            <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
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
        <div className="flex flex-col gap-0 max-w-[1400px] mx-auto animate-in fade-in duration-500 relative p-4 md:p-6 lg:px-0">
            {/* Subtle background ambient light */}
            <div className="absolute -top-40 -left-40 h-80 w-80 bg-white/[0.02] rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute top-1/2 -right-40 h-80 w-80 bg-white/[0.015] rounded-full blur-[100px] pointer-events-none" />
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 mb-4 pb-3 border-b border-border/40 px-1">
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
                                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground uppercase leading-none tracking-widest">Pre-Book Queue</h1>
                                </div>
                                <p className="text-[9px] font-black text-muted-foreground uppercase opacity-40 mt-1.5 tracking-tight">
                                    Track waitlist reservations & claim ready items
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted/20 px-3 py-1 rounded-full border border-border/40 uppercase tracking-widest shrink-0">
                            {prebooks.length} Entries
                        </span>
                    </div>
                </div>
            </header>

            {/* Active Pre-Books */}
            {activePrebooks.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">Active Reservations</h2>
                    <div className="grid gap-3.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 pb-8 px-1">
                        {activePrebooks.map((pb, idx) => (
                            <Card
                                key={pb.id}
                                className={`h-full flex flex-col border border-border/50 bg-card/60 backdrop-blur-xl hover:bg-card/80 hover:border-foreground/20 hover:shadow-2xl transition-all duration-500 rounded-2xl overflow-hidden relative group/card animate-in slide-in-from-bottom-6 duration-700 ${pb.status === 'notified' ? 'ring-1 ring-blue-500/40' : ''}`}
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                {/* Visual Header */}
                                <div className="relative aspect-[16/10] overflow-hidden bg-muted/20 border-b border-border/10">
                                    {pb.hardware?.image_url ? (
                                        <img
                                            src={pb.hardware.image_url}
                                            alt={pb.hardware?.name}
                                            className="w-full h-full object-contain transition-transform duration-1000 group-hover/card:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center opacity-20">
                                            <Package size={24} className="text-foreground animate-pulse" />
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-end">
                                        <PrebookStatusBadge status={pb.status} className="h-6 px-2 text-[8px]" />
                                    </div>
                                    <div className="absolute bottom-2 left-2">
                                        <Badge variant="secondary" className="bg-background/80 backdrop-blur-md text-[8px] font-black uppercase tracking-widest border border-border/40 py-0.5 px-1.5">
                                            #{pb.position} in Queue
                                        </Badge>
                                    </div>
                                </div>

                                <CardContent className="flex flex-col flex-1 p-4 sm:p-5 gap-3">
                                    <div className="space-y-1.5">
                                        <h3
                                            className="text-sm font-bold text-foreground group-hover/card:text-primary transition-colors cursor-pointer line-clamp-1 leading-tight tracking-tight"
                                            onClick={() => navigate(`/components/${pb.hardware?.id}`)}
                                        >
                                            {pb.hardware?.name || 'Unknown Item'}
                                        </h3>
                                        <div className="flex flex-col gap-1">
                                             <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                                                Requested {new Date(pb.requested_at).toLocaleDateString()}
                                            </p>
                                            {pb.status === 'notified' && pb.hold_expires_at && (
                                                <p className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">
                                                    Hold: {getTimeRemaining(pb.hold_expires_at)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-auto flex gap-2">
                                        {pb.status === 'notified' ? (
                                            <Button
                                                className="flex-1 h-9 rounded-xl font-black uppercase text-[9px] tracking-widest bg-primary text-primary-foreground hover:bg-primary/90"
                                                onClick={() => {
                                                    setClaimDialog({ open: true, prebook: pb });
                                                    setClaimForm({ project_title: '', project_description: '' });
                                                }}
                                            >
                                                Claim
                                            </Button>
                                        ) : (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 h-9 rounded-xl border-border hover:border-destructive/40 hover:bg-destructive/10 text-muted-foreground hover:text-destructive font-black text-[9px] uppercase tracking-widest transition-all"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="bg-card border border-border rounded-2xl shadow-xl p-8 animate-in zoom-in-95 duration-300">
                                                    <AlertDialogHeader>
                                                        <div className="p-4 w-fit rounded-2xl bg-destructive/10 text-destructive mb-4">
                                                            <AlertTriangle className="h-8 w-8" />
                                                        </div>
                                                        <AlertDialogTitle className="text-xl font-black tracking-tight text-foreground mb-2 leading-none">Cancel Pre-Book?</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-sm font-medium text-muted-foreground leading-relaxed">
                                                            You'll lose your #{pb.position} position in the queue for <strong>"{pb.hardware?.name}"</strong>. This cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter className="mt-10 gap-4">
                                                        <AlertDialogCancel className="h-12 px-8 rounded-2xl font-black text-xs uppercase border-2 border-border/60 hover:bg-muted/20">Keep Reservation</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            className="h-12 px-10 rounded-2xl font-black text-xs uppercase bg-destructive hover:bg-destructive/90 shadow-xl shadow-destructive/20"
                                                            onClick={() => handleCancel(pb.id)}
                                                        >
                                                            Yes, Cancel
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                        
                                        {pb.status === 'notified' && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9 shrink-0 rounded-xl border-border text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                                onClick={() => handleCancel(pb.id)}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {activePrebooks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/40 rounded-3xl bg-card/20 backdrop-blur-sm animate-in zoom-in-95 duration-500">
                    <div className="p-6 rounded-2xl bg-muted/40 mb-6 ring-4 ring-muted/10">
                        <BookmarkCheck className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-xl font-black text-foreground tracking-tight uppercase">No Active Pre-Books</h3>
                    <p className="text-muted-foreground max-w-sm mt-4 text-[10px] font-black uppercase leading-relaxed opacity-60">
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
                <div className="space-y-4">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">Past Reservations</h2>
                    <Card className="border border-border bg-card shadow-sm rounded-2xl overflow-hidden">
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/20">
                                {pastPrebooks.map((pb, idx) => (
                                    <div
                                        key={pb.id}
                                        className="flex items-center justify-between p-4 px-6 hover:bg-muted/10 transition-colors animate-in slide-in-from-right-4 duration-500"
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
            <div className="mt-4 p-4 rounded-xl bg-primary/[0.03] border border-primary/10 flex flex-col md:flex-row items-center gap-4 animate-in slide-in-from-bottom-8 duration-700">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                    <Info size={20} />
                </div>
                <div className="space-y-0.5 flex-1 text-center md:text-left">
                    <h4 className="text-sm font-bold text-primary tracking-tight font-inter-tight uppercase leading-none">How Pre-Booking Works</h4>
                    <p className="text-[10px] text-muted-foreground font-medium leading-relaxed max-w-3xl">
                        Join waitlists for out-of-stock items. When notified, you have a 24-hour window to claim it before it moves to the next person.
                    </p>
                </div>
            </div>

            {/* Claim Dialog */}
            <Dialog open={claimDialog.open} onOpenChange={(open) => setClaimDialog({ ...claimDialog, open })}>
                <DialogContent className="sm:max-w-[500px] bg-card border border-border rounded-3xl p-8 shadow-xl animate-in zoom-in-95 duration-300">
                    <form onSubmit={handleClaim} className="space-y-8">
                        <DialogHeader className="space-y-3">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                                <Zap size={24} />
                            </div>
                            <DialogTitle className="text-2xl font-black tracking-tight text-foreground leading-none uppercase">Claim Your Item</DialogTitle>
                            <DialogDescription className="text-sm font-medium text-muted-foreground leading-relaxed">
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
                                    className="h-12 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-sm font-bold px-6"
                                />
                            </div>
                            <div className="space-y-3">
                                <Label htmlFor="claim-desc" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Project Description (Optional)</Label>
                                <Textarea
                                    id="claim-desc"
                                    placeholder="Briefly explain how you'll use this for your project."
                                    className="min-h-[100px] bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-sm font-bold p-6 leading-relaxed"
                                    value={claimForm.project_description}
                                    onChange={(e) => setClaimForm({ ...claimForm, project_description: e.target.value })}
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-3">
                            <Button type="button" variant="ghost" className="h-12 flex-1 rounded-2xl font-black uppercase text-xs border border-border hover:bg-muted/30" onClick={() => setClaimDialog({ open: false, prebook: null })}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="h-12 px-10 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-3"
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

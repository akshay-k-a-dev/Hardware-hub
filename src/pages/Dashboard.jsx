import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Package,
    Clock,
    CheckCircle2,
    ClipboardList,
    ArrowRight,
    Plus,
    Search,
    AlertCircle,
    Wrench,
    User,
    TrendingUp,
    LayoutDashboard,
    Zap,
    History,
    Star,
    MapPin
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
    const { profile, isProvider, isAdmin, updateProfile } = useAuth();
    const { toast } = useToast();
    const [stats, setStats] = useState({ available: 0, pending: 0, active: 0, total: 0 });
    const [recentRequests, setRecentRequests] = useState([]);
    const [borrowerRatings, setBorrowerRatings] = useState({});
    const [loading, setLoading] = useState(true);
    const [showLabSettings, setShowLabSettings] = useState(false);
    const [labName, setLabName] = useState(profile?.lab_name || '');

    useEffect(() => {
        loadDashboard();
        if (profile) setLabName(profile.lab_name || '');
    }, [profile]);

    const loadDashboard = async () => {
        if (!profile) return;
        setLoading(true);

        try {
            if (isProvider || isAdmin) {
                await loadProviderDashboard();
            } else {
                await loadStudentDashboard();
            }
        } catch (err) {
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadStudentDashboard = async () => {
        const [
            { count: available },
            { count: pending },
            { count: active },
            { count: total },
            { data: recent },
        ] = await Promise.all([
            supabase.from('hardware_items').select('*', { count: 'exact', head: true }).eq('status', 'available').gt('quantity_available', 0),
            supabase.from('requests').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status', 'pending'),
            supabase.from('requests').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).in('status', ['issued', 'overdue']),
            supabase.from('requests').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
            supabase.from('requests').select('*, hardware:hardware_items!requests_hardware_id_fkey(id, name, category)').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(5),
        ]);

        setStats({ available: available || 0, pending: pending || 0, active: active || 0, total: total || 0 });
        setRecentRequests(recent || []);
    };

    const loadProviderDashboard = async () => {
        const { data: hwItems } = await supabase.from('hardware_items').select('id').eq('owner_id', profile.id);
        const hwIds = (hwItems || []).map(h => h.id);

        if (hwIds.length === 0) {
            setStats({ available: 0, pending: 0, active: 0, total: 0 });
            setRecentRequests([]);
            return;
        }

        const [
            { count: pending },
            { count: active },
            { count: total },
            { data: recent },
        ] = await Promise.all([
            supabase.from('requests').select('*', { count: 'exact', head: true }).in('hardware_id', hwIds).eq('status', 'pending'),
            supabase.from('requests').select('*', { count: 'exact', head: true }).in('hardware_id', hwIds).in('status', ['issued', 'overdue']),
            supabase.from('requests').select('*', { count: 'exact', head: true }).in('hardware_id', hwIds),
            supabase.from('requests').select('*, borrower:profiles!requests_user_id_fkey(id, name, email), hardware:hardware_items!requests_hardware_id_fkey(id, name, category)').in('hardware_id', hwIds).order('created_at', { ascending: false }).limit(5),
        ]);

        setStats({ available: hwIds.length, pending: pending || 0, active: active || 0, total: total || 0 });
        setRecentRequests(recent || []);

        const uniqueBorrowerIds = [...new Set((recent || []).map(r => r.user_id))];
        if (uniqueBorrowerIds.length > 0) {
            const { data: ratingsData } = await supabase.rpc('get_multiple_user_ratings', { p_user_ids: uniqueBorrowerIds });
            if (ratingsData) {
                const ratingMap = {};
                ratingsData.forEach(r => ratingMap[r.user_id] = r);
                setBorrowerRatings(ratingMap);
            }
        }
    };

    const handleUpdateLabName = async () => {
        try {
            await updateProfile({ lab_name: labName });
            toast({ title: 'Profile Updated', description: 'Your lab branding has been set.' });
            setShowLabSettings(false);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
        }
    };

    const studentStats = [
        { label: 'Available Lab Stock', value: stats.available, icon: <Package className="h-4 w-4" />, color: "blue" },
        { label: 'Pending Approval', value: stats.pending, icon: <Clock className="h-4 w-4" />, color: "amber" },
        { label: 'Currently Borrowed', value: stats.active, icon: <CheckCircle2 className="h-4 w-4" />, color: "emerald" },
        { label: 'Activity History', value: stats.total, icon: <TrendingUp className="h-4 w-4" />, color: "indigo" },
    ];

    const providerStats = [
        { label: 'Managed Items', value: stats.available, icon: <Package className="h-4 w-4" />, color: "blue" },
        { label: 'Pending Approval', value: stats.pending, icon: <Clock className="h-4 w-4" />, color: "amber" },
        { label: 'Issued Items', value: stats.active, icon: <CheckCircle2 className="h-4 w-4" />, color: "emerald" },
        { label: 'Total Stock', value: stats.total, icon: <TrendingUp className="h-4 w-4" />, color: "indigo" },
    ];

    const displayStats = (isProvider || isAdmin) ? providerStats : studentStats;

    const getColorClasses = (color) => {
        return "bg-background text-foreground border border-border";
    };

    if (loading) {
        return (
            <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-80 rounded-lg" />
                    <Skeleton className="h-4 w-[500px]" />
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                    ))}
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                    <Skeleton className="md:col-span-4 h-[450px] rounded-2xl" />
                    <Skeleton className="md:col-span-3 h-[450px] rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
                <div>
                    <h1 className="text-lg font-bold tracking-tight text-foreground">
                        Welcome back, {profile?.name?.split(' ')[0]}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {isProvider ? 'Lab admin overview' : 'Your hardware activity at a glance'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isProvider && (
                        <Badge
                            variant="outline"
                            className="text-[10px] font-semibold border-border bg-muted/30 text-muted-foreground cursor-pointer hover:bg-muted"
                            onClick={() => setShowLabSettings(true)}
                        >
                            {profile.lab_name || 'Set Lab Name'} · Settings
                        </Badge>
                    )}
                    {!isProvider && (
                        <Button asChild size="sm" className="h-8 px-4 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-md shadow-none">
                            <Link to="/components">
                                <Search className="mr-1.5 h-3.5 w-3.5" /> Browse Hardware
                            </Link>
                        </Button>
                    )}
                </div>
            </header>

            {/* Stats Overview */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {displayStats.map((s) => (
                    <Card
                        key={s.label}
                        className="border border-border bg-card hover:shadow-sm transition-shadow"
                    >
                        <CardContent className="p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
                            <p className="text-2xl font-bold text-foreground tabular-nums">{s.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Recent Activity List */}
                <Card className="lg:col-span-4 border border-border bg-card shadow-none overflow-hidden">
                    <CardHeader className="flex flex-row items-center p-4 border-b border-border">
                        <div className="grid gap-1 flex-1">
                            <CardTitle className="text-base font-bold text-foreground">Recent Activity</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">Latest hardware request updates</CardDescription>
                        </div>
                        <Button asChild variant="ghost" size="sm" className="ml-auto h-8 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-md">
                            <Link to={isProvider ? '/manage-requests' : '/my-requests'}>
                                View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentRequests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                <AlertCircle className="h-8 w-8 text-muted-foreground/30 mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    {isProvider ? 'No pending requests.' : 'No requests yet. Browse hardware to get started.'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {recentRequests.map((req) => (
                                    <div
                                        key={req.id}
                                        className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                                            <span className="text-base font-bold truncate text-foreground">{req.project_title}</span>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                                <span className="truncate">{req.hardware?.name}</span>
                                                <span>·</span>
                                                <span>Qty {req.quantity}</span>
                                                {req.borrower && <span className="hidden sm:inline">· {req.borrower.name}</span>}
                                            </div>
                                        </div>
                                        <div className="ml-3 shrink-0">
                                            <StatusBadge status={req.status} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Access Menu */}
                <Card className="lg:col-span-3 border border-border bg-card shadow-none overflow-hidden">
                    <CardHeader className="p-4 border-b border-border">
                        <CardTitle className="text-base font-bold text-foreground">Quick Actions</CardTitle>
                        <CardDescription className="text-sm text-muted-foreground font-medium">Navigate to core features</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 grid gap-2">
                        <Button asChild variant="ghost" className="justify-start h-10 rounded-md border border-border bg-background hover:bg-muted group px-3 text-sm font-medium">
                            <Link to="/components" className="flex items-center w-full">
                                <Wrench className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                                Hardware Lab
                                <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                            </Link>
                        </Button>

                        <Button asChild variant="ghost" className="justify-start h-10 rounded-md border border-border bg-background hover:bg-muted group px-3 text-sm font-medium">
                            <Link to={isProvider ? '/manage-requests' : '/my-requests'} className="flex items-center w-full">
                                <ClipboardList className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                                {isProvider ? 'Manage Requests' : 'My Requests'}
                                <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                            </Link>
                        </Button>

                        {isProvider && (
                            <Button asChild variant="ghost" className="justify-start h-10 rounded-md border border-border bg-background hover:bg-muted group px-3 text-sm font-medium">
                                <Link to="/add-component" className="flex items-center w-full">
                                    <Plus className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                                    Add Hardware
                                    <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                </Link>
                            </Button>
                        )}

                        <div className="mt-2 p-4 rounded-md bg-muted/40 border border-border">
                            <h4 className="text-xs font-semibold text-foreground mb-1">Reminder</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Inspect all hardware for damage before confirming returns. Early returns are appreciated.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={showLabSettings} onOpenChange={setShowLabSettings}>
                <DialogContent className="sm:max-w-md rounded-none border border-border bg-background p-0">
                    <DialogHeader className="p-6 border-b border-border">
                        <DialogTitle className="text-2xl font-black tracking-tight text-foreground">Lab Identity</DialogTitle>
                        <DialogDescription className="text-sm font-bold text-foreground opacity-80">
                            Set your laboratory or community name to brand your hardware listings.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 px-6 border-b border-border">
                        <div className="space-y-2">
                            <Label htmlFor="labName" className="text-xs font-black uppercase tracking-widest text-foreground">Lab Name</Label>
                            <Input
                                id="labName"
                                placeholder="e.g. Robotics Innovation Lab"
                                value={labName}
                                onChange={(e) => setLabName(e.target.value)}
                                className="h-12 border border-border bg-background rounded-none text-foreground placeholder-foreground/50"
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-background">
                        <Button variant="ghost" onClick={() => setShowLabSettings(false)} className="rounded-none font-black text-foreground hover:bg-foreground hover:text-background border-2 border-transparent hover:border-foreground">Cancel</Button>
                        <Button onClick={handleUpdateLabName} className="h-12 px-8 rounded-none font-black uppercase tracking-widest text-xs bg-foreground text-background border border-border hover:bg-background hover:text-foreground shadow-none">Save Branding</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

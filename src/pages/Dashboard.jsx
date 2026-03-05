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
    History
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

export default function Dashboard() {
    const { profile, isProvider, isAdmin } = useAuth();
    const [stats, setStats] = useState({ available: 0, pending: 0, active: 0, total: 0 });
    const [recentRequests, setRecentRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
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
            supabase.from('requests').select('*, hardware:hardware_items(id, name, category)').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(5),
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
            supabase.from('requests').select('*, borrower:profiles!user_id(id, name, email), hardware:hardware_items(id, name, category)').in('hardware_id', hwIds).order('created_at', { ascending: false }).limit(5),
        ]);

        setStats({ available: hwIds.length, pending: pending || 0, active: active || 0, total: total || 0 });
        setRecentRequests(recent || []);
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
        const variants = {
            blue: "bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-blue-500/5",
            amber: "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/5",
            emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5",
            indigo: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20 shadow-indigo-500/5",
        };
        return variants[color] || variants.blue;
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
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto">
            <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pb-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 text-primary mb-1">
                        <div className="p-2 rounded-xl bg-primary/10">
                            <LayoutDashboard className="h-6 w-6" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
                            Welcome, {profile?.name?.split(' ')[0]}
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-lg font-medium">
                        Insights and activity for your {isProvider ? 'admin' : 'lab'} account
                    </p>
                </div>
                {!isProvider && (
                    <Button asChild size="lg" className="h-14 px-8 rounded-2xl font-bold shadow-md hover:scale-105 transition-transform active:scale-95 bg-primary text-primary-foreground">
                        <Link to="/components">
                            <Search className="mr-3 h-5 w-5" /> Explore Lab
                        </Link>
                    </Button>
                )}
            </header>

            {/* Stats Overview */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {displayStats.map((s, idx) => (
                    <Card
                        key={s.label}
                        className={`group border border-border bg-card hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden relative animate-in zoom-in-95 fade-in duration-700 delay-${idx * 100}`}
                    >
                        <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-5 ${getColorClasses(s.color).split(' ')[0]}`} />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
                            <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest">{s.label}</CardTitle>
                            <div className={`p-2.5 rounded-xl border ring-1 ring-white/5 ${getColorClasses(s.color)} group-hover:scale-110 transition-transform duration-500`}>
                                {s.icon}
                            </div>
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-4xl font-black tracking-tighter tabular-nums">{s.value}</div>
                            <div className="flex items-center gap-1.5 mt-2">
                                <Badge variant="secondary" className="bg-muted/50 text-[10px] font-bold py-0 h-5">LIVE DATA</Badge>
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
                {/* Recent Activity List */}
                <Card className="lg:col-span-4 border border-border bg-card shadow-sm rounded-3xl overflow-hidden animate-in slide-in-from-left-6 duration-1000">
                    <CardHeader className="flex flex-row items-center py-6 px-8 border-b border-border bg-muted/30">
                        <div className="grid gap-1 flex-1">
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                <History className="h-6 w-6 text-primary/80" />
                                Recent Activity
                            </CardTitle>
                            <CardDescription className="text-sm font-medium">Tracking the latest status of hardware requests</CardDescription>
                        </div>
                        <Button asChild variant="secondary" size="sm" className="ml-auto rounded-xl font-bold hover:bg-muted/80">
                            <Link to={isProvider ? '/manage-requests' : '/my-requests'}>
                                Full History <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentRequests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-muted/5">
                                <div className="p-4 rounded-full bg-muted/20 mb-6">
                                    <AlertCircle className="h-12 w-12 text-muted-foreground/20" />
                                </div>
                                <h3 className="text-xl font-bold text-muted-foreground">No operations recorded</h3>
                                <p className="text-sm text-muted-foreground/60 max-w-xs mt-2 font-medium">
                                    {isProvider ? 'All clear! No incoming requests require your attention right now.' : 'Looks quiet here. Start exploring hardware to initiate your first request.'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/20">
                                {recentRequests.map((req, idx) => (
                                    <div
                                        key={req.id}
                                        className="flex items-center justify-between p-6 hover:bg-muted/20 transition-all duration-300 group cursor-default animate-in fade-in duration-500"
                                        style={{ animationDelay: `${idx * 150}ms` }}
                                    >
                                        <div className="flex items-center gap-12 flex-1">
                                            <div className="hidden sm:flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/5 border border-primary/10 group-hover:scale-110 transition-transform duration-500">
                                                <Zap className="h-6 w-6 text-primary/60" />
                                            </div>
                                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                <span className="font-bold text-lg truncate group-hover:text-primary transition-colors">{req.project_title}</span>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <Badge variant="outline" className="font-bold border-border/60 bg-muted/20 text-xs px-2.5">
                                                        {req.hardware?.name}
                                                    </Badge>
                                                    <span className="text-xs font-black text-muted-foreground/40 hidden sm:inline">•</span>
                                                    <span className="text-sm font-bold text-muted-foreground/80">Qty: {req.quantity}</span>
                                                    {req.borrower && (
                                                        <>
                                                            <span className="text-xs font-black text-muted-foreground/40 hidden md:inline">•</span>
                                                            <span className="flex items-center gap-1.5 text-sm font-semibold text-primary/70">
                                                                <User size={14} className="text-primary/40" /> {req.borrower.name}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ml-4 shrink-0">
                                            <StatusBadge status={req.status} className="h-8 px-4 font-black shadow-sm" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Access Menu */}
                <Card className="lg:col-span-3 border border-border bg-card shadow-sm rounded-3xl overflow-hidden animate-in slide-in-from-right-6 duration-1000">
                    <CardHeader className="py-6 px-8 border-b border-border bg-muted/30">
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            <Zap className="h-6 w-6 text-amber-500" />
                            Quick Actions
                        </CardTitle>
                        <CardDescription className="text-sm font-medium">Quick navigation to core features</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 grid gap-4">
                        <Button asChild variant="ghost" className="justify-start h-16 rounded-2xl border border-border hover:bg-primary/5 hover:border-primary/30 group px-6 transition-all duration-300">
                            <Link to="/components" className="flex items-center w-full">
                                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 mr-4 group-hover:scale-110 transition-transform">
                                    <Wrench className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="font-bold text-foreground">Hardware Lab</span>
                                    <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Browse Hardware</span>
                                </div>
                                <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        </Button>

                        <Button asChild variant="ghost" className="justify-start h-16 rounded-2xl border border-border hover:bg-primary/5 hover:border-primary/30 group px-6 transition-all duration-300">
                            <Link to={isProvider ? '/manage-requests' : '/my-requests'} className="flex items-center w-full">
                                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 mr-4 group-hover:scale-110 transition-transform">
                                    <ClipboardList className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="font-bold text-foreground">{isProvider ? 'Requests' : 'My Requests'}</span>
                                    <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Manage Requests</span>
                                </div>
                                <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        </Button>

                        {isProvider && (
                            <Button asChild variant="ghost" className="justify-start h-16 rounded-2xl border border-border hover:bg-primary/5 hover:border-primary/30 group px-6 transition-all duration-300">
                                <Link to="/add-component" className="flex items-center w-full">
                                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 mr-4 group-hover:scale-110 transition-transform">
                                        <Plus className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold text-foreground">Add Hardware</span>
                                        <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Expand Inventory</span>
                                    </div>
                                    <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            </Button>
                        )}

                        <div className="mt-6 p-6 rounded-3xl bg-primary/5 border-2 border-primary/10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-700">
                                <AlertCircle size={64} />
                            </div>
                            <h4 className="text-base font-black mb-2 text-primary tracking-tight italic">System Advisory</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed font-bold">
                                Please ensure all hardware items are inspected for damages before confirming the return status. Early returns are always appreciated!
                            </p>
                            <Button variant="link" className="p-0 h-auto text-[10px] font-black uppercase tracking-tighter mt-4 text-primary/60 hover:text-primary">
                                VIEW GUIDELINES
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

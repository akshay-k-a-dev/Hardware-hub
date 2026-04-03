import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    MapPin,
    Bell,
    ArrowUpRight,
    SearchCode
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
    const navigate = useNavigate();
    const { profile, isProvider, isAdmin, updateProfile } = useAuth();
    const { toast } = useToast();
    const [stats, setStats] = useState({ available: 0, pending: 0, active: 0, total: 0 });
    const [activeHardware, setActiveHardware] = useState([]);
    const [recentRequests, setRecentRequests] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [borrowerRatings, setBorrowerRatings] = useState({});
    const [loading, setLoading] = useState(true);
    const [showLabSettings, setShowLabSettings] = useState(false);
    const [labName, setLabName] = useState(profile?.lab_name || '');
    const [searchQuery, setSearchQuery] = useState('');

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
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        
        const nextThreeDays = new Date();
        nextThreeDays.setDate(nextThreeDays.getDate() + 3);

        const [
            { count: pendingCount },
            { count: activeCount },
            { data: activeHw },
            { data: recentApproved },
            { data: dueSoon },
        ] = await Promise.all([
            supabase.from('requests').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status', 'pending'),
            supabase.from('requests').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).in('status', ['issued', 'overdue']),
            supabase.from('requests').select('*, hardware:hardware_items!requests_hardware_id_fkey(id, name, category)').eq('user_id', profile.id).in('status', ['issued', 'overdue']).order('expected_return_date', { ascending: true }),
            supabase.from('requests').select('*, hardware:hardware_items!requests_hardware_id_fkey(id, name)').eq('user_id', profile.id).eq('status', 'approved').gte('updated_at', threeDaysAgo.toISOString()),
            supabase.from('requests').select('*, hardware:hardware_items!requests_hardware_id_fkey(id, name)').eq('user_id', profile.id).eq('status', 'issued').lte('expected_return_date', nextThreeDays.toISOString()),
        ]);

        setStats({ pending: pendingCount || 0, active: activeCount || 0 });
        setActiveHardware(activeHw || []);

        const dynamicAlerts = [];
        (activeHw || []).filter(r => r.status === 'overdue').forEach(r => {
            dynamicAlerts.push({ id: `ov-${r.id}`, type: 'destructive', message: `OVERDUE: Return ${r.hardware.name} now.`, icon: <AlertCircle className="h-3 w-3" /> });
        });
        (dueSoon || []).forEach(r => {
            dynamicAlerts.push({ id: `due-${r.id}`, type: 'warning', message: `${r.hardware.name} is due within 72h.`, icon: <Bell className="h-3 w-3" /> });
        });
        (recentApproved || []).forEach(r => {
            dynamicAlerts.push({ id: `app-${r.id}`, type: 'success', message: `${r.hardware.name} request was approved!`, icon: <CheckCircle2 className="h-3 w-3" /> });
        });
        setAlerts(dynamicAlerts);
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

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/components?search=${encodeURIComponent(searchQuery.trim())}`);
        } else {
            navigate('/components');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <Skeleton className="h-48 w-full rounded-sm" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-32 w-full rounded-sm" />
                    <Skeleton className="h-32 w-full rounded-sm" />
                </div>
            </div>
        );
    }

    if (isProvider || isAdmin) {
        // Provider Dashboard View (Keep existing logic but apply minimal styling)
        return (
            <div className="space-y-6 max-w-7xl mx-auto">
                <header className="flex items-center justify-between pb-4 border-b border-border">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase tracking-widest">Lab Administrator</h1>
                        <p className="text-[10px] md:text-xs font-black uppercase text-muted-foreground mt-0.5 tracking-tight opacity-70">Inventory and Request Management Console</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] font-black uppercase tracking-widest rounded-sm border-border bg-muted/30"
                        onClick={() => setShowLabSettings(true)}
                    >
                        {profile.lab_name || 'Set Lab Name'} · Settings
                    </Button>
                </header>

                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: 'Managed Items', value: stats.available, icon: <Package size={14} /> },
                        { label: 'Pending Approval', value: stats.pending, icon: <Clock size={14} /> },
                        { label: 'Issued Items', value: stats.active, icon: <CheckCircle2 size={14} /> },
                        { label: 'Total Logs', value: stats.total, icon: <History size={14} /> }
                    ].map((s) => (
                        <Card key={s.label} className="border border-border bg-card shadow-sm rounded-sm">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                                    <div className="text-muted-foreground/40">{s.icon}</div>
                                </div>
                                <p className="text-2xl font-black text-foreground tabular-nums">{s.value}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-7">
                    <Card className="lg:col-span-4 border border-border bg-card rounded-sm overflow-hidden">
                        <CardHeader className="p-4 border-b border-border bg-muted/20">
                            <CardTitle className="text-xs font-black uppercase tracking-widest">Recent Activity Pool</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {recentRequests.length === 0 ? (
                                <div className="p-12 text-center">
                                    <AlertCircle className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Queue is currently clear</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {recentRequests.map((req) => (
                                        <div key={req.id} className="p-4 flex items-center justify-between hover:bg-muted/30 cursor-pointer">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-black uppercase tracking-tight text-foreground">{req.project_title}</span>
                                                <span className="text-[10px] font-black uppercase text-muted-foreground opacity-70">{req.hardware?.name} · {req.borrower?.name}</span>
                                            </div>
                                            <StatusBadge status={req.status} className="h-5 px-2 text-[8px] font-black" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <div className="lg:col-span-3 space-y-4">
                        <Card className="border border-border rounded-sm">
                            <CardHeader className="p-4 border-b border-border bg-muted/20"><CardTitle className="text-xs font-black uppercase tracking-widest">Actions</CardTitle></CardHeader>
                            <CardContent className="p-3 grid gap-2">
                                <Button asChild variant="outline" className="w-full justify-start h-9 rounded-sm border-border hover:bg-muted text-[10px] font-black uppercase tracking-widest">
                                    <Link to="/add-component"><Plus size={14} className="mr-2" /> Add Hardware</Link>
                                </Button>
                                <Button asChild variant="outline" className="w-full justify-start h-9 rounded-sm border-border hover:bg-muted text-[10px] font-black uppercase tracking-widest">
                                    <Link to="/manage-requests"><ClipboardList size={14} className="mr-2" /> Manage All Requests</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Lab Name Dialog */}
                <Dialog open={showLabSettings} onOpenChange={setShowLabSettings}>
                    <DialogContent className="sm:max-w-md rounded-sm border border-border bg-background p-0">
                        <DialogHeader className="p-6 border-b border-border">
                            <DialogTitle className="text-xl font-black uppercase tracking-tighter">Lab Settings</DialogTitle>
                        </DialogHeader>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lab Branding Name</Label>
                                <Input value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="Robotics Lab" className="h-10 rounded-sm border-border bg-background uppercase font-black" />
                            </div>
                        </div>
                        <DialogFooter className="p-4 bg-muted/20 border-t border-border">
                            <Button onClick={handleUpdateLabName} className="w-full h-10 rounded-sm bg-foreground text-background font-black uppercase tracking-widest text-xs">Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // Student Dashboard View (Action-Driven & Minimal)
    return (
        <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-8 sm:pb-12">
            
            {/* 1. Hero Action Section */}
            <div className="relative overflow-hidden bg-foreground text-background rounded-sm p-5 sm:p-8 md:p-12 flex flex-col items-center text-center gap-5 sm:gap-8 shadow-2xl border border-border">
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-0 right-0 w-60 sm:w-96 h-60 sm:h-96 bg-white rounded-full -mr-32 sm:-mr-48 -mt-32 sm:-mt-48 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-60 sm:w-96 h-60 sm:h-96 bg-white rounded-full -ml-32 sm:-ml-48 -mb-32 sm:-mb-48 blur-3xl"></div>
                </div>

                <div className="relative space-y-1.5 sm:space-y-2">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none italic">
                        Hardware Inventory
                    </h2>
                    <p className="text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] opacity-60">
                        Microcontrollers, Sensors, and Lab Equipment
                    </p>
                </div>

                <form onSubmit={handleSearch} className="w-full max-w-2xl relative group">
                    <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                    <Input 
                        placeholder="Search components..." 
                        className="h-11 sm:h-14 pl-11 sm:pl-14 pr-3 sm:pr-28 bg-background border-none text-foreground placeholder:text-muted-foreground/50 text-sm rounded-sm focus-visible:ring-4 focus-visible:ring-white/10 shadow-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <Button type="submit" size="sm" className="h-8 sm:h-10 px-3 sm:px-4 bg-foreground text-background hover:bg-foreground/90 font-bold uppercase text-[10px] tracking-widest rounded-sm hidden sm:flex">
                            Explore
                        </Button>
                    </div>
                </form>
            </div>

            {/* 2. Simplified Stats Row */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2">
                <Card className="border border-border bg-card shadow-sm rounded-sm overflow-hidden group hover:border-foreground/30 transition-all duration-300">
                    <CardContent className="p-4 sm:p-6 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 sm:space-y-1 min-w-0">
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-[0.2em] text-muted-foreground truncate">Pending</p>
                            <p className="text-2xl sm:text-4xl font-black text-foreground tabular-nums">{stats.pending}</p>
                        </div>
                        <div className="p-2.5 sm:p-4 rounded-sm bg-muted text-muted-foreground group-hover:bg-foreground group-hover:text-background transition-colors shrink-0">
                            <Clock className="h-5 w-5 sm:h-8 sm:w-8" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-border bg-card shadow-sm rounded-sm overflow-hidden group hover:border-foreground/30 transition-all duration-300">
                    <CardContent className="p-4 sm:p-6 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 sm:space-y-1 min-w-0">
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-[0.2em] text-muted-foreground truncate">Borrowed</p>
                            <p className="text-2xl sm:text-4xl font-black text-foreground tabular-nums">{stats.active}</p>
                        </div>
                        <div className="p-2.5 sm:p-4 rounded-sm bg-muted text-muted-foreground group-hover:bg-foreground group-hover:text-background transition-colors shrink-0">
                            <Package className="h-5 w-5 sm:h-8 sm:w-8" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 sm:gap-8 lg:grid-cols-12">
                
                {/* 3. Your Active Hardware (Main Focus) */}
                <div className="lg:col-span-8 space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                            <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Active Hardware
                        </h3>
                        <Button asChild variant="link" size="sm" className="h-auto p-0 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
                            <Link to="/my-requests">History <ArrowRight className="ml-1 h-3 w-3" /></Link>
                        </Button>
                    </div>

                    <Card className="border border-border bg-card shadow-none rounded-sm overflow-hidden">
                        <CardContent className="p-0">
                            {activeHardware.length === 0 ? (
                                <div className="p-10 sm:p-16 text-center bg-muted/10">
                                    <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-sm bg-muted border border-border flex items-center justify-center mx-auto mb-4 sm:mb-6 text-muted-foreground/30 italic">
                                        <Package size={24} className="sm:hidden" />
                                        <Package size={32} className="hidden sm:block" />
                                    </div>
                                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-foreground">No active loans</h4>
                                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight text-muted-foreground mt-2 max-w-[240px] mx-auto opacity-60">
                                        Browse the lab to reserve equipment.
                                    </p>
                                    <Button asChild variant="outline" size="sm" className="mt-5 sm:mt-6 rounded-sm border-foreground hover:bg-foreground hover:text-background text-[10px] font-bold uppercase tracking-widest px-6 sm:px-8">
                                        <Link to="/components">Request Now</Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/60">
                                    {activeHardware.map((hw) => (
                                        <div key={hw.id} className="p-3 sm:p-5 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-muted/40 rounded-sm flex items-center justify-center text-foreground font-black border border-border group-hover:bg-foreground group-hover:text-background transition-colors uppercase text-sm sm:text-lg italic shrink-0">
                                                    {hw.hardware?.name?.[0]}
                                                </div>
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <span className="text-xs sm:text-sm font-black uppercase tracking-tight text-foreground truncate">{hw.hardware?.name}</span>
                                                    <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-bold uppercase text-muted-foreground">
                                                        <span className="shrink-0">Due: {formatDate(hw.expected_return_date)}</span>
                                                        <span className="hidden sm:inline">•</span>
                                                        <span className={`hidden sm:inline ${hw.status === 'overdue' ? 'text-destructive' : 'text-foreground'}`}>
                                                            {hw.status === 'overdue' ? 'Overdue' : 'In Possession'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button asChild size="sm" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-sm opacity-50 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <Link to={`/components/${hw.hardware_id}`}><ArrowUpRight size={14} /></Link>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* 4. Actions & Dynamic Alerts */}
                <div className="lg:col-span-4 space-y-6 sm:space-y-8">
                    
                    {/* Dynamic Alerts */}
                    {alerts.length > 0 && (
                        <div className="space-y-2 sm:space-y-3">
                            <h3 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Recent Updates</h3>
                            <div className="space-y-2">
                                {alerts.map((alert) => (
                                    <div 
                                        key={alert.id} 
                                        className={`p-2.5 sm:p-3 rounded-sm border flex items-start gap-2.5 sm:gap-3 animate-in slide-in-from-right-4 duration-500
                                            ${alert.type === 'destructive' ? 'bg-destructive/10 border-destructive/20 text-destructive' : 
                                              alert.type === 'warning' ? 'bg-yellow-500/10 border-yellow-200 text-yellow-700' : 
                                              'bg-foreground/5 border-border text-foreground'}`}
                                    >
                                        <div className="mt-0.5 shrink-0">{alert.icon}</div>
                                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight leading-tight flex-1">
                                            {alert.message}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Navigation */}
                    <div className="space-y-3 sm:space-y-4">
                        <h3 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Quick Actions</h3>
                        <div className="grid gap-2">
                            <Button asChild variant="outline" className="w-full justify-start h-10 sm:h-12 rounded-sm border-border bg-card hover:bg-foreground hover:text-background transition-all group px-3 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                                <Link to="/components" className="flex items-center w-full">
                                    <SearchCode className="mr-2.5 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-50 group-hover:opacity-100 shrink-0" />
                                    <span className="truncate">Request Hardware</span>
                                    <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all shrink-0" />
                                </Link>
                            </Button>

                            <Button asChild variant="outline" className="w-full justify-start h-10 sm:h-12 rounded-sm border-border bg-card hover:bg-foreground hover:text-background transition-all group px-3 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                                <Link to="/my-requests" className="flex items-center w-full">
                                    <History className="mr-2.5 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-50 group-hover:opacity-100 shrink-0" />
                                    <span className="truncate">View My Items</span>
                                    <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all shrink-0" />
                                </Link>
                            </Button>

                            <Button asChild variant="outline" className="w-full justify-start h-10 sm:h-12 rounded-sm border-border bg-card hover:bg-foreground hover:text-background transition-all group px-3 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                                <Link to="/my-prebooks" className="flex items-center w-full">
                                    <ClipboardList className="mr-2.5 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-50 group-hover:opacity-100 shrink-0" />
                                    <span className="truncate">My Pre-Books</span>
                                    <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all shrink-0" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

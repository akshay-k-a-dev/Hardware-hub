import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    Package, Clock, CheckCircle2, ClipboardList, ArrowRight, Plus, Search, AlertCircle, Wrench, User, TrendingUp, LayoutDashboard, Zap, History, Star, MapPin, Bell, ArrowUpRight, SearchCode, ChevronDown, CircuitBoard, BatteryCharging, Cable, Cpu, AlertTriangle, Inbox, PackageCheck, CircleCheck, ChevronRight, ArrowUp, MoreHorizontal
} from 'lucide-react';
// Force Vite Refresh: Redesign Applied
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
    const { pathname } = useLocation();
    
    const CATEGORIES = [
        { label: 'MCU', value: 'Microcontroller', icon: <Cpu size={20} /> },
        { label: 'SBC', value: 'Single Board Computer', icon: <CircuitBoard size={20} /> },
        { label: 'Sensor', value: 'Sensor', icon: <Zap size={20} /> },
        { label: 'Motor', value: 'Motor', icon: <Wrench size={20} /> },
        { label: 'Power', value: 'Power Supply', icon: <BatteryCharging size={20} /> },
        { label: 'Radio', value: 'Communication', icon: <ArrowUpRight size={20} /> },
    ];

    const { profile, isProvider, isAdmin, updateProfile } = useAuth();
    const { toast } = useToast();
    const [stats, setStats] = useState({ available: 0, pending: 0, active: 0, total: 0, overdue: 0, totalHistory: 0 });
    const [activeHardware, setActiveHardware] = useState([]);
    const [recentRequests, setRecentRequests] = useState([]);
    const [activityHistory, setActivityHistory] = useState([]);
    const [featuredHardware, setFeaturedHardware] = useState([]);
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
            { data: pendingReqs },
            { data: historyData },
            { data: featuredHw }
        ] = await Promise.all([
            supabase.from('requests').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status', 'pending'),
            supabase.from('requests').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).in('status', ['issued', 'overdue']),
            supabase.from('requests').select('*, hardware:hardware_items!requests_hardware_id_fkey(id, name, category, specs, image_url)').eq('user_id', profile.id).in('status', ['issued', 'overdue']).order('expected_return_date', { ascending: true }),
            supabase.from('requests').select('*, hardware:hardware_items!requests_hardware_id_fkey(id, name)').eq('user_id', profile.id).eq('status', 'approved').gte('updated_at', threeDaysAgo.toISOString()),
            supabase.from('requests').select('*, hardware:hardware_items!requests_hardware_id_fkey(id, name)').eq('user_id', profile.id).eq('status', 'issued').lte('expected_return_date', nextThreeDays.toISOString()),
            supabase.from('requests').select('*, hardware:hardware_items!requests_hardware_id_fkey(id, name, category, specs, image_url)').eq('user_id', profile.id).eq('status', 'pending').order('created_at', { ascending: false }),
            supabase.from('requests').select('*, hardware:hardware_items!requests_hardware_id_fkey(id, name, category)').eq('user_id', profile.id).in('status', ['returned', 'rejected', 'cancelled']).order('updated_at', { ascending: false }).limit(5),
            supabase.from('hardware_items').select('*').limit(4)
        ]);

        const overdueCount = (activeHw || []).filter(r => r.status === 'overdue').length;

        setStats({ 
            pending: pendingCount || 0, 
            active: activeCount || 0,
            overdue: overdueCount || 0,
            totalHistory: (historyData || []).length 
        });
        
        setActiveHardware(activeHw || []);
        setRecentRequests(pendingReqs || []);
        
        const activities = (historyData || []).map(h => ({
            id: h.id,
            type: 'history',
            message: `${h.hardware?.name} was ${h.status}`,
            date: h.updated_at,
            icon: <History className="h-3 w-3" />
        }));

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
        setActivityHistory(activities);
        setFeaturedHardware(featuredHw || []);
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
            { data: activeLoans },
            { data: recent },
        ] = await Promise.all([
            supabase.from('requests').select('*', { count: 'exact', head: true }).in('hardware_id', hwIds).eq('status', 'pending'),
            supabase.from('requests').select('*', { count: 'exact', head: true }).in('hardware_id', hwIds).in('status', ['issued', 'overdue']),
            supabase.from('requests').select('*', { count: 'exact', head: true }).in('hardware_id', hwIds),
            supabase.from('requests').select('*, borrower:profiles!requests_user_id_fkey(id, name, email), hardware:hardware_items!requests_hardware_id_fkey(id, name, category)').in('hardware_id', hwIds).in('status', ['issued', 'overdue']).order('expected_return_date', { ascending: true }),
            supabase.from('requests').select('*, borrower:profiles!requests_user_id_fkey(id, name, email), hardware:hardware_items!requests_hardware_id_fkey(id, name, category)').in('hardware_id', hwIds).order('created_at', { ascending: false }).limit(5),
        ]);

        setStats({ 
            available: hwIds.length, 
            pending: pending || 0, 
            active: active || 0, 
            total: total || 0,
            overdue: (activeLoans || []).filter(l => l.status === 'overdue').length
        });
        setActiveHardware(activeLoans || []);
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
            <div className="flex flex-col gap-8 max-w-[1400px] mx-auto animate-in fade-in duration-500 p-4 md:p-6 lg:px-0">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
            </div>
        );
    }

    if (isProvider || isAdmin) {
        return (
            <div className="flex flex-col gap-6 max-w-[1400px] mx-auto p-4 md:p-6 lg:px-0">
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

                {/* ── Admin Overview Horizontal Pills ── */}
                <div className="md:hidden space-y-4 px-1">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Overview</h2>
                        <Badge variant="outline" className="rounded-full border-border/40 text-[9px] font-black uppercase tracking-widest px-2 h-5">
                            Lab Capacity: {stats.available + stats.active}
                        </Badge>
                    </div>
                    
                    <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 no-scrollbar">
                        {[
                            { label: 'Borrowed', value: stats.active, icon: <CheckCircle2 size={16} />, color: 'bg-foreground text-background shadow-foreground/10' },
                            { label: 'Pending', value: stats.pending, icon: <Clock size={16} />, color: 'bg-amber-500 text-white shadow-amber-500/20' },
                            { label: 'Overdue', value: stats.overdue, icon: <AlertTriangle size={16} />, color: 'bg-destructive text-destructive-foreground shadow-destructive/20' }
                        ].map((s, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-muted/30 border border-border/40 p-3 pr-6 rounded-[1.5rem] min-w-[130px] shrink-0 transition-all active:scale-95">
                                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-lg ${s.color}`}>
                                    {s.icon}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-lg font-black leading-none">{s.value}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{s.label}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Desktop Stats Grid ── */}
                <div className="hidden md:grid gap-4 grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: 'Managed Items', value: stats.available, icon: <Package size={14} /> },
                        { label: 'Pending Approval', value: stats.pending, icon: <Clock size={14} /> },
                        { label: 'Issued Items', value: stats.active, icon: <CheckCircle2 size={14} /> },
                        { label: 'Total Logs', value: stats.total, icon: <History size={14} /> }
                    ].map((stat, i) => (
                        <Card key={i} className="border border-border/40 bg-card/60 backdrop-blur-xl hover:bg-card/80 transition-all duration-300 rounded-2xl group">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground transition-colors">{stat.label}</CardTitle>
                                <div className="p-2 rounded-lg bg-muted/50 text-foreground group-hover:bg-foreground group-hover:text-background transition-all">
                                    {stat.icon}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black tracking-tight">{stat.value}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-7">
                    {/* ── Requests Section (Responsive Layout) ── */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Pending Requests</h2>
                            <Button variant="ghost" className="h-6 text-[9px] font-bold uppercase tracking-tight gap-1 opacity-50 hover:opacity-100" onClick={() => navigate('/manage-requests')}>
                                View All <ChevronRight size={12} />
                            </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-1">
                            {recentRequests.length > 0 ? (
                                recentRequests.map((req) => (
                                    <div key={req.id} className="bg-card border border-border/40 p-4 rounded-[2rem] hover:bg-muted/10 transition-all group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center text-foreground font-black text-sm border-2 border-background shadow-sm">
                                                {req.borrower?.name?.charAt(0)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black uppercase tracking-tight">{req.project_title}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70 italic">{req.borrower?.name} · {req.hardware?.name}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:self-center">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="flex-1 sm:flex-none h-9 px-6 rounded-2xl border-border font-black text-[9px] uppercase tracking-widest hover:bg-destructive/5 hover:text-destructive transition-all"
                                                onClick={() => navigate('/manage-requests')}
                                            >
                                                Reject
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                className="flex-1 sm:flex-none h-9 px-6 rounded-2xl bg-foreground text-background font-black text-[9px] uppercase tracking-widest hover:bg-foreground/90 transition-all shadow-lg shadow-black/10"
                                                onClick={() => navigate('/manage-requests')}
                                            >
                                                Approve
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="border-2 border-dashed border-border/20 rounded-[2.5rem] p-10 text-center flex flex-col items-center gap-2">
                                    <Inbox className="h-8 w-8 text-muted-foreground/20" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Queue Clear</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-3 space-y-4">
                         <div className="flex items-center justify-between px-1">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Issued Items</h2>
                            <Badge className="bg-muted p-0 h-5 px-3 rounded-full border border-border/20 text-[8px] font-black uppercase tracking-widest">{activeHardware.length} Active</Badge>
                        </div>

                        <div className="grid gap-3 overflow-y-auto max-h-[500px] no-scrollbar pb-4">
                            {activeHardware.length > 0 ? (
                                activeHardware.map((loan) => {
                                    const isOverdue = loan.status === 'overdue';
                                    return (
                                        <div key={loan.id} className="bg-card/40 border border-border/40 p-4 rounded-[1.75rem] flex items-center justify-between hover:bg-muted/5 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground border border-border/20">
                                                    <PackageCheck size={18} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black uppercase leading-none">{loan.hardware?.name}</span>
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase mt-1 opacity-60 italic">{loan.borrower?.name}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${isOverdue ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-foreground/5 text-foreground border-border/40'}`}>
                                                    {isOverdue ? 'Overdue' : 'Due ' + formatDate(loan.expected_return_date)}
                                                </span>
                                                <Button size="sm" variant="ghost" className="h-7 text-[8px] font-black uppercase tracking-widest p-0 px-2 opacity-50 hover:opacity-100" onClick={() => navigate('/manage-requests')}>
                                                    Manage
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-12 text-center bg-muted/10 rounded-[2rem] border border-dashed border-border/40 flex flex-col items-center gap-2">
                                    <CircleCheck className="h-8 w-8 text-muted-foreground/10" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 italic">No Issued Units</span>
                                </div>
                            )}
                        </div>

                        {/* Quick Dashboard Controls */}
                        <div className="pt-4 grid grid-cols-2 gap-3">
                             <Button asChild variant="outline" className="h-11 rounded-2xl border-border/60 text-[10px] font-black uppercase tracking-[0.1em] gap-2">
                                <Link to="/add-component"><Plus size={14} /> Add Info</Link>
                            </Button>
                            <Button asChild className="h-11 rounded-2xl bg-foreground text-background text-[10px] font-black uppercase tracking-[0.1em] gap-2">
                                <Link to="/manage-requests"><ClipboardList size={14} /> Requests</Link>
                            </Button>
                        </div>
                    </div>
                </div>

                <Dialog open={showLabSettings} onOpenChange={setShowLabSettings}>
                    <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none bg-card p-0 shadow-2xl">
                        <DialogHeader className="p-6 pb-2">
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">Lab Management</DialogTitle>
                            <DialogDescription className="text-xs">Update your branding and operational settings.</DialogDescription>
                        </DialogHeader>
                        <div className="p-8 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60 ml-1">Lab Branding Name</Label>
                                <Input value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="Robotics Lab" className="h-14 rounded-3xl border-border bg-background/50 px-6 font-black text-sm uppercase focus-visible:ring-1 focus-visible:ring-foreground" />
                            </div>
                        </div>
                        <DialogFooter className="p-6 pt-0">
                            <Button onClick={handleUpdateLabName} className="w-full h-14 rounded-3xl bg-foreground text-background font-black uppercase tracking-widest text-xs shadow-xl shadow-black/10">Save Configuration</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0 max-w-[1400px] mx-auto animate-in fade-in duration-700 relative pb-20 md:p-8 lg:px-0 bg-background/50">
            
            <div className="md:hidden flex flex-col gap-3 p-4 pb-5 bg-foreground text-background rounded-b-[40px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-muted/10 rounded-full -mr-10 -mt-10 blur-3xl pointer-events-none" />
                
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Location</span>
                        <div className="flex items-center gap-1.5 ">
                            <MapPin className="h-3 w-3 text-emerald-400" />
                            <span className="text-xs font-black uppercase tracking-tight">{profile?.lab_name || 'Main Hardware Hub'}</span>
                            <ChevronDown className="h-3 w-3 opacity-40" />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-1 mt-1.5">
                    <h1 className="text-2xl font-black tracking-tight uppercase leading-none">
                        Hello, {profile?.name?.split(' ')[0] || 'Maker'}
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Ready to build something new today?</p>
                </div>

                <form onSubmit={handleSearch} className="relative mt-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-background/60" />
                    <Input 
                        placeholder="Search hardware..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-12 w-full bg-background/10 border-none rounded-2xl pl-11 text-xs font-black placeholder:text-background/40 focus-visible:ring-1 focus-visible:ring-background/20 transition-all text-background"
                    />
                </form>
            </div>

            {/* ── Desktop-Only Header ── */}
            <div className="hidden md:flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight uppercase">Hardware Hub</h1>
                        <p className="text-[12px] font-black uppercase tracking-[0.2em] opacity-40">Borrow what you need. Build what matters.</p>
                    </div>
                </div>
                
                <div className="grid gap-4 md:grid-cols-4">
                    {[
                        { label: 'Borrowed', value: stats.active, icon: <Package size={16} />, color: 'text-foreground' },
                        { label: 'Pending', value: stats.pending, icon: <Clock size={16} />, color: 'text-amber-500' },
                        { label: 'Overdue', value: stats.overdue, icon: <AlertCircle size={16} />, color: 'text-destructive' },
                        { label: 'Activity', value: stats.totalHistory, icon: <TrendingUp size={16} />, color: 'text-foreground/40' }
                    ].map((s) => (
                        <Card key={s.label} className="border border-border bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden group hover:border-foreground/20 transition-all duration-300">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">{s.label}</p>
                                    <div className={`${s.color} opacity-30 group-hover:opacity-100 transition-opacity`}>{s.icon}</div>
                                </div>
                                <p className={`text-3xl font-black tabular-nums tracking-tighter ${s.value > 0 && s.label === 'Overdue' ? 'text-destructive animate-pulse' : 'text-foreground'}`}>
                                    {s.value}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* ── Mobile Borrowed Hub (Redesigned) ── */}
            <div className="md:hidden flex flex-col gap-4 mt-6">
                <div className="flex items-center justify-between px-5">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Borrowed Items</h3>
                    <Link to="/my-requests" className="text-[10px] font-bold text-muted-foreground opacity-50">View All</Link>
                </div>
                
                {/* Main Card: Active Item */}
                <div className="px-5 w-full flex flex-col gap-4">
                    {activeHardware.length > 0 ? (
                        <div className="w-full bg-card border border-border/60 rounded-[28px] p-5 flex flex-col gap-5 shadow-sm relative overflow-hidden group">
                            {/* Abstract Minimal Accent */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-foreground/[0.03] rounded-full -mr-8 -mt-8" />
                            
                            <div className="flex justify-between items-start z-10">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Currently With You</span>
                                    <h4 className="text-sm font-black uppercase tracking-tight text-foreground truncate max-w-[200px]">
                                        {activeHardware[0].hardware?.name}
                                    </h4>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-foreground text-background rounded-full">
                                    <CheckCircle2 size={10} className="fill-background text-foreground" />
                                    <span className="text-[8px] font-black uppercase tracking-widest">Borrowed</span>
                                </div>
                            </div>

                            <div className="flex items-end justify-between z-10">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Due Date</span>
                                    <span className={`text-xs font-black tabular-nums ${activeHardware[0].status === 'overdue' ? 'text-destructive' : 'text-foreground'}`}>
                                        {formatDate(activeHardware[0].expected_return_date)}
                                    </span>
                                </div>
                                <Button size="sm" className="h-10 rounded-2xl bg-foreground text-background px-8 font-black uppercase text-[9px] tracking-widest shadow-xl shadow-foreground/10 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                    Return Item
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-32 bg-muted/20 border border-dashed border-border/60 rounded-[28px] flex flex-col items-center justify-center text-center p-4">
                            <Package className="h-6 w-6 text-muted-foreground/20 mb-2" />
                            <p className="text-[10px] font-black uppercase text-muted-foreground opacity-40">Your lab inventory is empty</p>
                            <Button asChild variant="link" className="text-[9px] font-black uppercase tracking-widest mt-2 p-0 h-auto">
                                <Link to="/components">Browse Lab →</Link>
                            </Button>
                        </div>
                    )}

                    {/* Horizontal Count Overview */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Borrowed', value: stats.active, icon: <CheckCircle2 size={12} />, color: 'bg-muted/30 border-border/40' },
                            { label: 'Pending', value: stats.pending, icon: <Clock size={12} />, color: 'bg-amber-500/5 border-amber-500/10' },
                            { label: 'Overdue', value: stats.overdue, icon: <AlertCircle size={12} />, color: 'bg-destructive/5 border-destructive/10' }
                        ].map((stat) => (
                            <div key={stat.label} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border ${stat.color}`}>
                                <div className="flex items-center gap-1.5 opacity-40">
                                    {stat.icon}
                                    <span className="text-[8px] font-black uppercase tracking-widest">{stat.label}</span>
                                </div>
                                <span className={`text-lg font-black tabular-nums leading-none ${stat.label === 'Overdue' && stat.value > 0 ? 'text-destructive' : 'text-foreground'}`}>
                                    {stat.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Category Section (Reference Alignment) ── */}
            <div className="md:hidden flex flex-col gap-3 mt-3">
                <div className="flex items-center justify-between px-5">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Categories</h3>
                    <Link to="/components" className="text-[10px] font-bold text-muted-foreground">See All</Link>
                </div>
                <div className="flex gap-5 overflow-x-auto px-5 pb-5 scrollbar-none items-start">
                    {CATEGORIES.map(cat => (
                        <button 
                            key={cat.label} 
                            onClick={() => navigate(`/components?category=${encodeURIComponent(cat.value)}`)}
                            className="flex flex-col items-center gap-2.5 shrink-0 group"
                        >
                            <div className="w-14 h-14 rounded-full bg-card border border-border/40 flex items-center justify-center group-hover:border-foreground/20 transition-all shadow-sm">
                                <div className="text-foreground group-hover:scale-110 transition-transform">
                                    {cat.icon}
                                </div>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground group-hover:text-foreground">{cat.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main Lists Stacking ── */}
            <div className="flex flex-col px-5 gap-6 mt-3 md:hidden">
                {/* Pending List */}
                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Pending Requests</h3>
                        <span className="text-[9px] font-bold py-1 px-2.5 bg-amber-500/10 text-amber-500 rounded-lg">{stats.pending} Items</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {recentRequests.length > 0 ? recentRequests.map(req => (
                            <div key={req.id} className="p-3.5 bg-card border border-border/40 rounded-[20px] flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="bg-muted p-2 rounded-xl">
                                        <Clock className="h-4 w-4 text-amber-500" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[11px] font-black uppercase truncate max-w-[140px]">{req.hardware?.name}</span>
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">{formatDate(req.created_at)}</span>
                                    </div>
                                </div>
                                <StatusBadge status={req.status} className="h-7 px-4 rounded-xl text-[9px] font-bold" />
                            </div>
                        )) : (
                            <div className="py-6 text-center border-border/20 border-b">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase italic opacity-20">No pending items</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Activity Stays Desktop-First on md+, stacked on mobile */}
            </div>

            {/* ── Standard Desktop Grid ── */}
            <div className="hidden md:grid gap-10 lg:grid-cols-12 px-0">
                
                {/* Left Column: Inventory & Requests */}
                <div className="lg:col-span-8 space-y-10">
                    
                    {/* Hardware Catalog / Browse (Snapshot) */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                                <SearchCode size={14} /> Hardware Catalog
                            </h3>
                            <Link to="/components" className="text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground py-2 px-3 bg-muted/20 rounded-lg">Explore Lab →</Link>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {featuredHardware.slice(0, 4).map(item => (
                                <Card key={item.id} className="border border-border/60 bg-card hover:border-foreground/20 transition-all rounded-xl overflow-hidden flex h-28 group">
                                    <div className="w-28 bg-muted/30 flex items-center justify-center border-r border-border/40 overflow-hidden">
                                        {item.image_url ? (
                                            <img 
                                                src={item.image_url} 
                                                alt={item.name} 
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.closest('.w-28').innerHTML = '<div class="flex items-center justify-center w-full h-full bg-muted/20 text-muted-foreground/20"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package"><path d="M12 3L2 8V16L12 21L22 16V8L12 3Z"/><path d="M2.5 8.5L12 13.5L21.5 8.5"/><path d="M12 21V13.5"/></svg></div>';
                                                }}
                                            />
                                        ) : (
                                            <Package size={24} className="text-muted-foreground/20" />
                                        )}
                                    </div>
                                    <CardContent className="flex-1 p-4 flex flex-col justify-between min-w-0">
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-black uppercase truncate group-hover:text-primary transition-colors">{item.name}</h4>
                                            <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60 truncate">
                                                {item.category} • {item.specs ? Object.values(item.specs).join(' • ').slice(0, 30) : 'Standard Specs'}...
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[10px] font-black uppercase opacity-40">Qty: {item.quantity}</span>
                                            <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-[8px] font-black uppercase tracking-widest rounded-sm border border-border group-hover:bg-foreground group-hover:text-background">
                                                <Link to={`/components/${item.id}`}>Request</Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>

                    {/* Current Borrowings / My Items */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                                <Zap size={14} className="text-blue-500" /> Current Borrowings
                            </h3>
                             <span className="text-[11px] font-black uppercase text-muted-foreground opacity-40">{activeHardware.length} Items Total</span>
                        </div>
                        {activeHardware.length === 0 ? (
                            <Card className="border border-dashed border-border bg-transparent rounded-2xl h-32 flex items-center justify-center">
                                <div className="text-center italic opacity-30">
                                    <p className="text-[10px] font-black uppercase tracking-widest">No active loans found</p>
                                </div>
                            </Card>
                        ) : (
                            <div className="grid gap-3">
                                {activeHardware.map(hw => (
                                    <Card key={hw.id} className={`border rounded-xl overflow-hidden ${hw.status === 'overdue' ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'}`}>
                                        <CardContent className="p-4 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-black text-sm italic shrink-0 border ${hw.status === 'overdue' ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-muted border-border'}`}>
                                                    {hw.hardware?.name?.[0]}
                                                </div>
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <span className="text-sm font-black uppercase truncate">{hw.hardware?.name}</span>
                                                    <div className="flex items-center gap-2 text-[11px] font-black uppercase opacity-60">
                                                        <span>Due {formatDate(hw.expected_return_date)}</span>
                                                        <span className="opacity-30">•</span>
                                                        <span className={hw.status === 'overdue' ? 'text-destructive' : 'text-foreground'}>{hw.status}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" className="h-8 rounded-sm text-[8px] font-black uppercase border-border">Extend</Button>
                                                <Button size="sm" className="h-8 rounded-sm text-[8px] font-black uppercase bg-foreground text-background">Return</Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                {/* Right Column: Activity Snapshot */}
                <div className="lg:col-span-4 space-y-10">
                     <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2 px-1">
                            <Clock size={14} className="text-amber-500" /> Pending Queue
                        </h3>
                        <div className="grid gap-2">
                            {recentRequests.map(req => (
                                <div key={req.id} className="p-3 bg-muted/20 border border-border/40 rounded-xl flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase truncate">{req.hardware?.name}</span>
                                    <StatusBadge status={req.status} className="h-7 px-4 text-[10px] font-black uppercase" />
                                </div>
                            ))}
                        </div>
                    </section>
                    
                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2 px-1">
                            <History size={14} /> Interaction History
                        </h3>
                        <div className="space-y-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[1px] before:bg-border/60">
                            {activityHistory.map(act => (
                                <div key={act.id} className="relative pl-6 flex flex-col gap-1">
                                    <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-background border-2 border-border z-10" />
                                    <span className="text-[12px] font-black uppercase tracking-tight text-foreground leading-tight">{act.message}</span>
                                    <span className="text-[10px] font-black uppercase opacity-40">{formatDate(act.date)}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>

        </div>
    );
}

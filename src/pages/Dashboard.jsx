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
        
        // Use history data for activities
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
        // Provider Dashboard View (Keep existing logic but apply minimal styling)
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

                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: 'Managed Items', value: stats.available, icon: <Package size={14} /> },
                        { label: 'Pending Approval', value: stats.pending, icon: <Clock size={14} /> },
                        { label: 'Issued Items', value: stats.active, icon: <CheckCircle2 size={14} /> },
                        { label: 'Total Logs', value: stats.total, icon: <History size={14} /> }
                    ].map((s) => (
                        <Card key={s.label} className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
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
                    <Card className="lg:col-span-4 border border-border bg-card rounded-xl overflow-hidden">
                        <CardHeader className="p-4 border-b border-border bg-muted/20">
                            <CardTitle className="text-xs font-semibold uppercase tracking-widest leading-none text-muted-foreground">Recent Activity Pool</CardTitle>
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
                        <Card className="border border-border rounded-xl overflow-hidden bg-card">
                            <CardHeader className="p-4 border-b border-border bg-muted/20">
                                <CardTitle className="text-xs font-semibold uppercase tracking-widest leading-none text-muted-foreground">Quick Actions</CardTitle>
                            </CardHeader>
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
        <div className="flex flex-col gap-10 max-w-[1400px] mx-auto p-4 md:p-8 lg:px-0 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* 1. Overview / At-a-Glance */}
            <div className="flex flex-col gap-6">
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase italic">Hardware Hub</h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Borrow what you need. Build what matters.</p>
                    </div>
                    <div className="hidden md:flex gap-2">
                        <Button asChild variant="outline" size="sm" className="rounded-sm border-border text-[9px] font-black uppercase tracking-widest h-8">
                            <Link to="/settings"><User size={12} className="mr-2" /> Profile</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="rounded-sm border-border text-[9px] font-black uppercase tracking-widest h-8">
                            <Link to="/history"><History size={12} className="mr-2" /> Full History</Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                    {[
                        { label: 'Borrowed', value: stats.active, icon: <Package size={16} />, color: 'text-foreground' },
                        { label: 'Pending', value: stats.pending, icon: <Clock size={16} />, color: 'text-amber-500' },
                        { label: 'Overdue', value: stats.overdue, icon: <AlertCircle size={16} />, color: 'text-destructive' },
                        { label: 'Activity', value: stats.totalHistory, icon: <TrendingUp size={16} />, color: 'text-foreground/40' }
                    ].map((s) => (
                        <Card key={s.label} className="border border-border bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden group hover:border-foreground/20 transition-all duration-300">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{s.label}</p>
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

            {/* 2. Quick Actions / Shortcuts */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <Button asChild className="h-16 rounded-xl bg-foreground text-background hover:scale-[1.02] active:scale-95 transition-all font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3">
                    <Link to="/components"><Zap size={18} fill="currentColor" /> Borrow Hardware Now</Link>
                </Button>
                <Button asChild variant="outline" className="h-16 rounded-xl border-2 border-border hover:border-foreground hover:bg-transparent transition-all font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3">
                    <Link to="/my-requests"><CheckCircle2 size={18} /> Return Items</Link>
                </Button>
                <Button variant="outline" onClick={() => toast({ title: "Coming Soon", description: "Batch renewal will be implemented in the next interaction." })} className="h-16 rounded-xl border-dashed border-2 border-border hover:border-foreground hover:bg-transparent transition-all font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3">
                    <History size={18} /> Renew All active
                </Button>
            </div>

            <div className="grid gap-10 lg:grid-cols-12">
                
                {/* Left Column: Inventory & Requests */}
                <div className="lg:col-span-8 space-y-10">
                    
                    {/* Hardware Catalog / Browse (Snapshot) */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                                <SearchCode size={14} /> Hardware Catalog
                            </h3>
                            <Link to="/components" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">Explore Lab →</Link>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {featuredHardware.slice(0, 4).map(item => (
                                <Card key={item.id} className="border border-border/60 bg-card hover:border-foreground/20 transition-all rounded-xl overflow-hidden flex h-28 group">
                                    <div className="w-28 bg-muted/30 flex items-center justify-center border-r border-border/40 overflow-hidden">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                                        ) : (
                                            <Package size={24} className="text-muted-foreground/20" />
                                        )}
                                    </div>
                                    <CardContent className="flex-1 p-4 flex flex-col justify-between min-w-0">
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-black uppercase truncate group-hover:text-primary transition-colors">{item.name}</h4>
                                            <p className="text-[8px] font-black uppercase text-muted-foreground opacity-60 truncate">
                                                {item.category} • {item.specs ? Object.values(item.specs).join(' • ').slice(0, 30) : 'Standard Specs'}...
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[9px] font-black uppercase opacity-40">Qty: {item.quantity}</span>
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
                            <span className="text-[9px] font-black uppercase text-muted-foreground opacity-40">{activeHardware.length} Items Total</span>
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
                                                    <div className="flex items-center gap-2 text-[9px] font-black uppercase opacity-60">
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

                {/* Right Column: Pending & Activity */}
                <div className="lg:col-span-4 space-y-10">
                    
                    {/* Pending Requests */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2 px-1">
                            <Clock size={14} className="text-amber-500" /> Pending Requests
                        </h3>
                        <div className="grid gap-2">
                            {recentRequests.length === 0 ? (
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-30 italic p-4 text-center border border-dashed border-border rounded-xl">Queue Clear</p>
                            ) : (
                                recentRequests.map(req => (
                                    <div key={req.id} className="p-3 bg-muted/20 border border-border/40 rounded-xl flex items-center justify-between group">
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                            <span className="text-[10px] font-black uppercase truncate">{req.hardware?.name}</span>
                                            <span className="text-[8px] font-black uppercase opacity-40">Req: {formatDate(req.created_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={req.status} className="h-4 px-1.5 text-[7px] font-black uppercase" />
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive opacity-0 group-hover:opacity-100"><Plus className="rotate-45 h-3 w-3" /></Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Notifications / Alerts */}
                    {alerts.length > 0 && (
                        <section className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2 px-1">
                                <Bell size={14} /> Notifications
                            </h3>
                            <div className="grid gap-2">
                                {alerts.map(alert => (
                                    <div key={alert.id} className={`p-3 rounded-xl border flex items-start gap-3 ${alert.type === 'destructive' ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-amber-500/10 border-amber-500/20 text-amber-600'}`}>
                                        <div className="mt-0.5">{alert.icon}</div>
                                        <p className="text-[9px] font-black uppercase leading-tight tracking-tight">{alert.message}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Activity History Snapshot */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2 px-1">
                            <History size={14} /> History
                        </h3>
                        <div className="space-y-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[1px] before:bg-border/60">
                            {activityHistory.length === 0 ? (
                                <p className="text-[10px] font-black uppercase opacity-20 pl-6">No recent interactions</p>
                            ) : (
                                activityHistory.map(act => (
                                    <div key={act.id} className="relative pl-6 flex flex-col gap-1">
                                        <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-background border-2 border-border z-10" />
                                        <span className="text-[10px] font-black uppercase tracking-tight text-foreground leading-tight">{act.message}</span>
                                        <span className="text-[8px] font-black uppercase opacity-40">{formatDate(act.date)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        {activityHistory.length > 0 && (
                            <Button variant="outline" className="w-full h-8 rounded-sm text-[8px] font-black uppercase tracking-widest border-border hover:bg-muted">
                                <ArrowRight size={12} className="mr-2" /> Export Interaction Log
                            </Button>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

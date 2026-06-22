import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { 
    Users, 
    ShieldAlert, 
    Globe, 
    Plus, 
    Trash2, 
    UserCheck, 
    TrendingDown, 
    TrendingUp, 
    AlertCircle, 
    Sliders,
    Search,
    BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('users');
    
    // Stats state
    const [stats, setStats] = useState({
        totalUsers: 0,
        suspendedUsers: 0,
        totalDomains: 0,
        totalItems: 0
    });

    // Users state
    const [usersList, setUsersList] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [scoreAdjustment, setScoreAdjustment] = useState('');
    const [adjustmentReason, setAdjustmentReason] = useState('');

    // Domains state
    const [domains, setDomains] = useState([]);
    const [newDomain, setNewDomain] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Fetch Profiles
            const { data: profiles, error: pError } = await supabase
                .from('profiles')
                .select('*, trust_scores(*)');
            if (pError) throw pError;

            // Fetch Domains
            const { data: instDomains, error: dError } = await supabase
                .from('institutional_domains')
                .select('*');
            if (dError) throw dError;

            // Fetch Hardware Count
            const { data: items, error: iError } = await supabase
                .from('hardware_items')
                .select('id');
            if (iError) throw iError;

            // Merge profile & trust scores manually if needed
            const formattedUsers = profiles.map(u => {
                const ts = u.trust_scores?.[0] || u.trust_scores || { score: 100, band: 'trusted', total_borrows: 0 };
                return {
                    ...u,
                    trustScore: ts.score ?? 100,
                    trustBand: ts.band ?? 'trusted',
                    totalBorrows: ts.total_borrows ?? 0
                };
            });

            setUsersList(formattedUsers);
            setDomains(instDomains || []);
            
            setStats({
                totalUsers: formattedUsers.length,
                suspendedUsers: formattedUsers.filter(u => u.status === 'suspended').length,
                totalDomains: (instDomains || []).length,
                totalItems: (items || []).length
            });
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Failed to load dashboard data",
                description: err.message
            });
        }
    };

    // User Actions
    const handleUpdateStatus = async (userId, newStatus) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ status: newStatus })
                .eq('id', userId);

            if (error) throw error;

            toast({
                title: `User status updated`,
                description: `Successfully marked user as ${newStatus}.`
            });
            loadData();
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Failed to update status",
                description: err.message
            });
        }
    };

    const handleUpdateRole = async (userId, newRole) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            toast({
                title: `User role updated`,
                description: `Successfully changed user role to ${newRole}.`
            });
            loadData();
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Failed to update role",
                description: err.message
            });
        }
    };

    const handleAdjustTrust = async (e) => {
        e.preventDefault();
        if (!selectedUser) return;
        const delta = parseInt(scoreAdjustment);
        if (isNaN(delta)) {
            toast({
                variant: "destructive",
                title: "Invalid Score",
                description: "Please enter a valid numeric value for trust adjustment."
            });
            return;
        }

        try {
            const currentScore = selectedUser.trustScore;
            const newScore = Math.max(0, Math.min(100, currentScore + delta));
            let newBand = 'trusted';
            if (newScore < 40) newBand = 'blocked';
            else if (newScore < 70) newBand = 'caution';

            // Update score
            const { error: tsError } = await supabase
                .from('trust_scores')
                .update({
                    score: newScore,
                    band: newBand,
                    manual_adjustments: { increment: 1 }
                })
                .eq('user_id', selectedUser.id);
            
            if (tsError) throw tsError;

            // Log event
            const { error: logError } = await supabase
                .from('trust_events')
                .insert({
                    user_id: selectedUser.id,
                    delta: delta,
                    reason: adjustmentReason || 'Manual Administrator Adjustment',
                    score_after: newScore
                });

            if (logError) throw logError;

            toast({
                title: "Trust score adjusted",
                description: `Updated score to ${newScore} (${newBand}).`
            });
            
            setSelectedUser(null);
            setScoreAdjustment('');
            setAdjustmentReason('');
            loadData();
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Failed to adjust trust",
                description: err.message
            });
        }
    };

    // Domain Actions
    const handleAddDomain = async (e) => {
        e.preventDefault();
        if (!newDomain.trim()) return;

        try {
            const { error } = await supabase
                .from('institutional_domains')
                .insert({ domain_pattern: newDomain.trim().toLowerCase() });

            if (error) throw error;

            toast({
                title: "Domain added",
                description: `Successfully added ${newDomain} to institutional allowlist.`
            });
            setNewDomain('');
            loadData();
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Failed to add domain",
                description: err.message
            });
        }
    };

    const handleDeleteDomain = async (pattern) => {
        try {
            const { error } = await supabase
                .from('institutional_domains')
                .delete()
                .eq('domain_pattern', pattern);

            if (error) throw error;

            toast({
                title: "Domain removed",
                description: `Successfully removed ${pattern} from allowlist.`
            });
            loadData();
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Failed to delete domain",
                description: err.message
            });
        }
    };

    const filteredUsers = usersList.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 font-sans max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col gap-2 border-b border-border pb-6">
                <h1 className="text-2xl font-black uppercase tracking-wider text-foreground">Admin Control Panel</h1>
                <p className="text-xs text-muted-foreground">Manage user permissions, update institutional domains, and adjust trust reliability metrics.</p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border border-border p-4 bg-muted/40 rounded-sm">
                    <div className="flex justify-between items-center text-muted-foreground mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Total Members</span>
                        <Users size={16} />
                    </div>
                    <div className="text-2xl font-black text-foreground">{stats.totalUsers}</div>
                </div>
                
                <div className="border border-border p-4 bg-muted/40 rounded-sm">
                    <div className="flex justify-between items-center text-muted-foreground mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Suspended</span>
                        <ShieldAlert size={16} className={stats.suspendedUsers > 0 ? "text-destructive" : ""} />
                    </div>
                    <div className="text-2xl font-black text-foreground">{stats.suspendedUsers}</div>
                </div>

                <div className="border border-border p-4 bg-muted/40 rounded-sm">
                    <div className="flex justify-between items-center text-muted-foreground mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Verifiable Domains</span>
                        <Globe size={16} />
                    </div>
                    <div className="text-2xl font-black text-foreground">{stats.totalDomains}</div>
                </div>

                <div className="border border-border p-4 bg-muted/40 rounded-sm">
                    <div className="flex justify-between items-center text-muted-foreground mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Lab Hardware</span>
                        <BookOpen size={16} />
                    </div>
                    <div className="text-2xl font-black text-foreground">{stats.totalItems}</div>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-2 border-b border-border pb-1">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                        activeTab === 'users' 
                        ? 'border-foreground text-foreground' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                    User Management
                </button>
                <button
                    onClick={() => setActiveTab('domains')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                        activeTab === 'domains' 
                        ? 'border-foreground text-foreground' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                    Allowed Domains
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    {/* User Directory Filters */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 text-xs"
                            />
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="border border-border rounded-sm overflow-hidden bg-card">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border bg-muted/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        <th className="p-4">Name / Email</th>
                                        <th className="p-4">Role</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Trust Score</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-xs">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center text-muted-foreground font-semibold">
                                                No profiles found matching search filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((u) => (
                                            <tr key={u.id} className="hover:bg-muted/10">
                                                <td className="p-4">
                                                    <div className="font-bold text-foreground">{u.name}</div>
                                                    <div className="text-[10px] text-muted-foreground">{u.email}</div>
                                                </td>
                                                <td className="p-4">
                                                    <select
                                                        value={u.role}
                                                        onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                                        className="bg-transparent border border-border rounded-sm px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                                                    >
                                                        <option value="student">Student</option>
                                                        <option value="provider">Provider</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                                        u.status === 'active' 
                                                        ? 'bg-emerald-500/10 text-emerald-500' 
                                                        : 'bg-destructive/10 text-destructive'
                                                    }`}>
                                                        {u.status}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold ${
                                                            u.trustBand === 'blocked' ? 'text-destructive' :
                                                            u.trustBand === 'caution' ? 'text-amber-500' : 'text-emerald-500'
                                                        }`}>
                                                            {u.trustScore}
                                                        </span>
                                                        <span className="text-[9px] uppercase font-black text-muted-foreground tracking-tighter">
                                                            ({u.trustBand})
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right space-x-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-[10px] font-bold uppercase"
                                                        onClick={() => setSelectedUser(u)}
                                                    >
                                                        <Sliders size={12} className="mr-1" /> Adjust Trust
                                                    </Button>
                                                    
                                                    {u.status === 'active' ? (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="h-7 text-[10px] font-bold uppercase"
                                                            onClick={() => handleUpdateStatus(u.id, 'suspended')}
                                                        >
                                                            Suspend
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-[10px] font-bold uppercase border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                                                            onClick={() => handleUpdateStatus(u.id, 'active')}
                                                        >
                                                            Activate
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Trust Adjustment Modal */}
                    {selectedUser && (
                        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-card border border-border p-6 rounded-md w-full max-w-md space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-base text-foreground">Adjust Trust Metrics</h3>
                                        <p className="text-xs text-muted-foreground">User: {selectedUser.name}</p>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedUser(null)}
                                        className="text-muted-foreground hover:text-foreground font-black text-sm"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <form onSubmit={handleAdjustTrust} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score Adjustment</label>
                                        <Input
                                            type="number"
                                            placeholder="e.g. -15 or +10"
                                            value={scoreAdjustment}
                                            onChange={(e) => setScoreAdjustment(e.target.value)}
                                            required
                                            className="text-xs"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Adjustment Reason</label>
                                        <Input
                                            placeholder="e.g. Late fee paid, manual restoration"
                                            value={adjustmentReason}
                                            onChange={(e) => setAdjustmentReason(e.target.value)}
                                            required
                                            className="text-xs"
                                        />
                                    </div>

                                    <div className="flex gap-2 justify-end pt-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="text-xs"
                                            onClick={() => setSelectedUser(null)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="text-xs font-bold uppercase"
                                        >
                                            Submit Adjustment
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'domains' && (
                <div className="grid md:grid-cols-3 gap-8">
                    {/* Add Domain Form */}
                    <div className="border border-border p-5 rounded-sm bg-card h-fit space-y-4">
                        <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
                            <Plus size={16} /> Allow Institutional Domain
                        </h2>
                        <p className="text-[11px] text-muted-foreground">
                            Users registering with matching institutional emails are automatically validated and granted borrowing permissions.
                        </p>
                        
                        <form onSubmit={handleAddDomain} className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Domain Pattern</label>
                                <Input
                                    placeholder="e.g., %.edu or %.ac.in"
                                    value={newDomain}
                                    onChange={(e) => setNewDomain(e.target.value)}
                                    required
                                    className="text-xs"
                                />
                                <span className="text-[9px] text-muted-foreground block">
                                    Use <b>%</b> as a wildcard matching subdomains.
                                </span>
                            </div>
                            <Button type="submit" className="w-full text-xs font-bold uppercase">
                                Add Domain Pattern
                            </Button>
                        </form>
                    </div>

                    {/* Domains List */}
                    <div className="md:col-span-2 border border-border rounded-sm bg-card overflow-hidden">
                        <div className="p-4 border-b border-border bg-muted/30">
                            <h2 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Currently Allowlisted Patterns</h2>
                        </div>
                        <div className="divide-y divide-border text-xs">
                            {domains.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground font-semibold">
                                    No domains allowlisted. All student accounts will require manual approval.
                                </div>
                            ) : (
                                domains.map((d) => (
                                    <div key={d.domain_pattern} className="flex justify-between items-center p-4 hover:bg-muted/10">
                                        <div className="flex items-center gap-3">
                                            <Globe size={14} className="text-muted-foreground" />
                                            <span className="font-bold text-foreground">{d.domain_pattern}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteDomain(d.domain_pattern)}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

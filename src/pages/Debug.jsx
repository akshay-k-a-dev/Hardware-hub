import { useState, useEffect } from 'react';
import {
    Bug,
    RefreshCcw,
    Trash2,
    CheckCircle2,
    XCircle,
    Database,
    User,
    Shield,
    History,
    Search,
    AlertCircle,
    Server,
    Clock,
    UserPlus,
    Activity,
    Code2
} from 'lucide-react';
import { getDbLogs, clearDbLogs } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Alert,
    AlertDescription,
    AlertTitle
} from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export default function Debug() {
    const [logs, setLogs] = useState([]);
    const [filter, setFilter] = useState('');
    const [session, setSession] = useState(null);
    const [profiles, setProfiles] = useState([]);
    const [rpcStatus, setRpcStatus] = useState('checking');
    const [showProfiles, setShowProfiles] = useState(false);

    useEffect(() => {
        // Get session info
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
        });

        // Check if RPC function exists
        const checkRPC = async () => {
            try {
                const { data, error } = await supabase.rpc('create_user_profile', {
                    user_id: '00000000-0000-0000-0000-000000000099',
                    user_name: 'Test',
                    user_email: 'test@example.com',
                    user_role: 'student',
                });

                if (error && error.message.includes('does not exist')) {
                    setRpcStatus('missing');
                } else {
                    setRpcStatus('ready');
                }
            } catch (e) {
                if (e.message?.includes('does not exist')) {
                    setRpcStatus('missing');
                } else {
                    setRpcStatus('ready');
                }
            }
        };

        checkRPC();

        // Fetch recent profiles
        const fetchProfiles = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                console.error('Error fetching profiles:', error);
            } else {
                setProfiles(data || []);
            }
        };

        fetchProfiles();

        // Refresh logs every 2 seconds
        const interval = setInterval(() => {
            setLogs(getDbLogs());
        }, 2000);

        setLogs(getDbLogs());
        return () => clearInterval(interval);
    }, []);

    const filteredLogs = logs.filter(
        (log) =>
            filter === '' ||
            log.operation.toLowerCase().includes(filter.toLowerCase()) ||
            log.table.toLowerCase().includes(filter.toLowerCase()) ||
            log.status.toLowerCase().includes(filter.toLowerCase())
    );

    const handleClearLogs = () => {
        clearDbLogs();
        setLogs([]);
    };

    const errorLogs = logs.filter(log => log.status === 'ERROR');
    const successLogs = logs.filter(log => log.status === 'SUCCESS');

    return (
        <div className="min-h-screen bg-background border-l border-border/40 font-sans p-6 space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                            <Activity className="h-6 w-6" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight">System Diagnostics</h1>
                    </div>
                    <p className="text-muted-foreground text-lg font-medium">Monitor system health and database operations.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh Data
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleClearLogs} disabled={logs.length === 0}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Logs
                    </Button>
                </div>
            </header>

            {/* Critical Alerts */}
            {rpcStatus === 'missing' && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 animate-in slide-in-from-top-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-bold">RPC Function Missing</AlertTitle>
                    <AlertDescription>
                        The <code className="bg-destructive/20 px-1 rounded">create_user_profile</code> function is not set up.
                        Please run the SQL from <code className="bg-destructive/20 px-1 rounded">supabase/003_create_profile_rpc.sql</code> in your Supabase Editor.
                    </AlertDescription>
                </Alert>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card/40 backdrop-blur-sm border-border/40">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Logs</CardTitle>
                        <History className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-foreground">{logs.length}</div>
                        <p className="text-xs text-muted-foreground mt-1 font-bold uppercase tracking-widest">Recorded Operations</p>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 backdrop-blur-sm border-border/40">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Success Rate</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">{successLogs.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Normal functioning</p>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 backdrop-blur-sm border-border/40">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Failed Operations</CardTitle>
                        <XCircle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{errorLogs.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Requiring attention</p>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 backdrop-blur-sm border-border/40">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">RPC Interface</CardTitle>
                        <Server className={`h-4 w-4 ${rpcStatus === 'ready' ? 'text-emerald-500' : 'text-destructive'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${rpcStatus === 'ready' ? 'text-emerald-500' : 'text-destructive'}`}>
                            {rpcStatus === 'ready' ? 'Ready' : 'Missing'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Database connection</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Session & Profiles */}
                <div className="space-y-6 lg:col-span-1">
                    <Card className="bg-card/60 backdrop-blur-xl border-border/40 shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
                        <CardHeader className="pb-3 border-b border-border/40">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Shield className="h-5 w-5 text-primary" />
                                Session Context
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5 space-y-4">
                            {session ? (
                                <>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between group">
                                            <span className="text-sm font-medium text-muted-foreground">User ID</span>
                                            <span className="text-sm font-mono truncate max-w-[140px] text-primary bg-primary/5 px-2 py-0.5 rounded" title={session.user?.id}>
                                                {session.user?.id}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">Auth Role</span>
                                            <Badge variant="outline" className="capitalize bg-muted/30">
                                                {session.user?.user_metadata?.role || 'Basic User'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">Started</span>
                                            <span className="text-sm text-right flex items-center gap-1.5 font-medium">
                                                <Clock className="h-3 w-3 text-muted-foreground" />
                                                {new Date(session.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                    <Separator className="bg-border/40" />
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Email Address</div>
                                        <div className="text-sm border border-border/40 rounded-lg p-3 bg-muted/20 flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            {session.user?.email}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="py-6 text-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/40">
                                    <XCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm italic">No active session detected</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-card/60 backdrop-blur-xl border-border/40 shadow-xl">
                        <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
                            <div className="space-y-0.5">
                                <CardTitle className="text-lg">Database Profiles</CardTitle>
                                <CardDescription>Recent registrations</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowProfiles(!showProfiles)}>
                                <Activity className={`h-4 w-4 transition-colors ${showProfiles ? 'text-primary' : 'text-muted-foreground'}`} />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {showProfiles ? (
                                <div className="divide-y divide-border/40 max-h-[400px] overflow-auto">
                                    {profiles.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground italic text-sm">No profiles found</div>
                                    ) : (
                                        profiles.map((profile) => (
                                            <div key={profile.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between group">
                                                <div className="space-y-1 min-w-0">
                                                    <div className="font-semibold text-sm truncate flex items-center gap-2">
                                                        {profile.name}
                                                        <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1 font-bold">
                                                            {profile.role}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate">{profile.email}</div>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground/60 text-right font-mono tabular-nums">
                                                    {new Date(profile.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="p-10 text-center space-y-3">
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                                        <UserPlus className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">Database View Hidden</p>
                                        <p className="text-xs text-muted-foreground">Click the top-right icon to show profiles</p>
                                    </div>
                                    <Button size="sm" variant="outline" className="w-full" onClick={() => setShowProfiles(true)}>Enable Snapshot View</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Database Operations Logs */}
                <div className="lg:col-span-2 space-y-4">
                    <Card className="bg-card/60 backdrop-blur-xl border-border/40 shadow-xl flex flex-col h-[700px]">
                        <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <Code2 className="h-5 w-5 text-indigo-400" />
                                    Operation Logs
                                </CardTitle>
                                <CardDescription>Real-time database activity tracking</CardDescription>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative w-64 md:w-80">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Filter operations..."
                                        className="pl-9 h-9 bg-muted/40 border-border/40 text-sm"
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-hidden">
                            <ScrollArea className="h-full w-full">
                                {filteredLogs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 opacity-40">
                                        <Database className="h-16 w-16 text-muted-foreground" />
                                        <div className="space-y-1">
                                            <p className="text-xl font-bold">Waiting for events...</p>
                                            <p className="text-sm italic">Perform some actions to see database traffic</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/20">
                                        {filteredLogs.slice().reverse().map((log, idx) => (
                                            <div key={idx} className="p-5 hover:bg-muted/20 transition-colors group space-y-3 font-mono">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <Badge variant="outline" className="bg-indigo-500/5 text-indigo-400 border-indigo-400/20 text-[11px] px-1.5 h-6">
                                                            {log.timestamp}
                                                        </Badge>
                                                        <span className="text-xs font-bold text-muted-foreground/40 hidden sm:inline">•</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-yellow-500/90 tracking-wide">{log.operation}</span>
                                                            <span className="text-xs text-muted-foreground/60 tracking-wider">ON</span>
                                                            <span className="text-sm font-bold text-indigo-300 tracking-tight underline underline-offset-4 decoration-indigo-500/30">{log.table}</span>
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        variant={log.status === 'ERROR' ? 'destructive' : 'secondary'}
                                                        className={`text-[10px] font-black h-5 uppercase tracking-tighter ${log.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20' : ''}`}
                                                    >
                                                        {log.status}
                                                    </Badge>
                                                </div>

                                                <div className="grid grid-cols-1 gap-2">
                                                    {Object.keys(log.details).length > 0 && (
                                                        <div className="text-[12px] bg-black/40 p-3 rounded-lg border border-border/10 overflow-hidden whitespace-pre-wrap break-all text-muted-foreground leading-relaxed">
                                                            <span className="text-indigo-400/60 font-bold mr-2">DETAILS:</span>
                                                            {JSON.stringify(log.details, null, 2)}
                                                        </div>
                                                    )}
                                                    {log.error && (
                                                        <div className="text-[12px] bg-destructive/10 p-3 rounded-lg border border-destructive/20 text-red-400 font-bold flex items-start gap-2">
                                                            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                            <div className="space-y-1">
                                                                <span className="uppercase text-[10px] tracking-widest opacity-60">Critical Error</span>
                                                                <p className="leading-tight">{log.error}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                        <div className="px-6 py-3 bg-muted/20 border-t border-border/40 text-[10px] text-muted-foreground/60 flex items-center justify-between">
                            <p>AUTOREFRESH ACTIVE (2S)</p>
                            <p className="font-mono">{filteredLogs.length} OPS FILTERED</p>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Help/Troubleshooting */}
            <Card className="bg-muted/5 border-dashed border-border/60">
                <CardHeader className="pb-3 border-b border-border/20 border-dashed">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Troubleshooting Guide
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                    <div className="space-y-4">
                        <div className="bg-primary/5 p-4 rounded-xl space-y-3">
                            <h3 className="font-bold text-primary flex items-center gap-2">
                                <span className="w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px]">1</span>
                                Preparation
                            </h3>
                            <ul className="space-y-2 list-inside list-disc text-muted-foreground text-xs leading-relaxed">
                                <li>Run <code className="bg-primary/10 px-1 rounded">002_fix_signup_trigger.sql</code></li>
                                <li>Run <code className="bg-primary/10 px-1 rounded">003_create_profile_rpc.sql</code></li>
                                <li>Verify <span className="text-emerald-500 font-bold">RPC READY</span> above</li>
                            </ul>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-indigo-500/5 p-4 rounded-xl space-y-3">
                            <h3 className="font-bold text-indigo-400 flex items-center gap-2">
                                <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                                Analysis Workflow
                            </h3>
                            <ul className="space-y-2 list-inside list-disc text-muted-foreground text-xs leading-relaxed">
                                <li>Open browser DevTools (F12) Console</li>
                                <li>Watch <span className="text-yellow-400 font-bold">[AUTH]</span> prefixed logs</li>
                                <li>Check <span className="text-indigo-400 font-bold">DETAILS</span> in the log stream above</li>
                                <li>Check Supabase Dashboard log tab for PG errors</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

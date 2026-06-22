import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
    ShieldCheck,
    Mail,
    Lock,
    ArrowRight,
    AlertCircle,
    Loader2,
    Cpu,
    CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Login() {
    const { signIn, resetPassword, user } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [resetSent, setResetSent] = useState(false);
    const [loading, setLoading] = useState(false);

    if (user) return <Navigate to="/" replace />;

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Please enter your email address first');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await resetPassword(email);
            setResetSent(true);
        } catch (err) {
            setError(err.message || 'Failed to send reset email');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signIn({ email, password });
        } catch (err) {
            const errorMsg = err.message || 'Login failed';
            if (errorMsg.includes('Invalid login credentials')) {
                setError('Invalid email or password');
            } else if (errorMsg.includes('Email not confirmed')) {
                setError('Please confirm your email before signing in');
            } else {
                setError(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dark min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden font-sans">
            {/* ── Ambient background gradients ────────────────── */}
            <div className="pointer-events-none absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] h-[40vh] w-[40vh] rounded-full bg-white/[0.03] blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] h-[30vh] w-[30vh] rounded-full bg-white/[0.02] blur-[80px]" />
            </div>

            <Card className="w-full max-w-sm mx-4 border border-border bg-card/50 backdrop-blur-xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500 rounded-xl overflow-hidden">
                <CardHeader className="space-y-4 pt-10 pb-8 text-center border-b border-border/50">
                    <div className="flex justify-center">
                        <div className="p-3 bg-white text-black rounded-xl shadow-lg">
                            <Cpu className="h-6 w-6" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <CardTitle className="text-2xl font-bold tracking-tight text-foreground font-inter-tight uppercase tracking-widest leading-none">HardwareHub</CardTitle>
                        <CardDescription className="text-xs font-medium text-muted-foreground mt-2 uppercase tracking-wide opacity-60">Sign in to the laboratory</CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="px-8 pb-8 pt-8">
                    {error && (
                        <Alert variant="destructive" className="mb-6 border border-destructive/20 bg-destructive/10 text-destructive rounded-lg animate-in slide-in-from-top-2 duration-200">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs font-semibold">{error}</AlertDescription>
                        </Alert>
                    )}

                    {resetSent && (
                        <Alert className="mb-6 border border-border bg-muted/30 rounded-lg animate-in slide-in-from-top-2 duration-200">
                            <CheckCircle2 className="h-4 w-4 text-foreground" />
                            <AlertDescription className="text-xs font-semibold text-foreground">
                                Check your inbox for the password reset link.
                            </AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-0.5">University Email</Label>
                            <div className="relative group">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@university.edu"
                                    className="pl-11 h-11 bg-muted/20 border-border rounded-lg focus-visible:ring-1 focus-visible:ring-foreground text-sm font-medium transition-all"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between pl-0.5">
                                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Access Code</Label>
                                <Button
                                    variant="link"
                                    className="px-0 text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground h-auto tracking-widest"
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                >
                                    Forgot?
                                </Button>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-11 h-11 bg-muted/20 border-border rounded-lg focus-visible:ring-1 focus-visible:ring-foreground text-sm font-medium transition-all"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            className="w-full h-11 rounded-full font-bold text-sm bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 shadow-xl"
                            disabled={loading}
                            type="submit"
                        >
                            {loading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                            ) : (
                                <>Enter Lab <ArrowRight className="h-4 w-4" /></>
                            )}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex flex-col gap-4 border-t border-border/50 bg-muted/5 px-8 py-6">
                    <p className="text-[11px] text-center text-muted-foreground font-medium">
                        New to HardwareHub?{' '}
                        <Link to="/register" className="font-bold text-foreground hover:underline underline-offset-4">
                            Register now
                        </Link>
                    </p>
                    <div className="flex items-center justify-center gap-1.5 text-[9px] uppercase font-bold tracking-widest text-muted-foreground/50">
                        <ShieldCheck className="h-3 w-3" />
                        Encrypted Connection
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

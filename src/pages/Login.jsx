import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
    ShieldCheck,
    Mail,
    Lock,
    ArrowRight,
    AlertCircle,
    Loader2,
    Cpu
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Login() {
    const { signIn, user } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (user) return <Navigate to="/" replace />;

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
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans">
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[150px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[120px]" />
            </div>

            <Card className="w-full max-w-[460px] mx-4 border border-border bg-card shadow-xl relative z-10 animate-in fade-in zoom-in-95 duration-700 rounded-[2.5rem] overflow-hidden">
                <CardHeader className="space-y-6 pt-12 pb-8 text-center bg-muted/5 border-b border-border relative">
                    <div className="flex justify-center">
                        <div className="p-4 rounded-3xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                            <Cpu className="h-10 w-10" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-4xl font-black tracking-tight text-foreground">HardwareHub</CardTitle>
                        <CardDescription className="text-lg font-medium text-muted-foreground">Welcome back to the Lab</CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="px-10 pb-10 pt-8">
                    {error && (
                        <Alert variant="destructive" className="mb-8 border-none bg-destructive/10 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                            <AlertCircle className="h-5 w-5" />
                            <AlertTitle className="font-bold tracking-tight">Login Error</AlertTitle>
                            <AlertDescription className="font-medium text-xs">{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Student / Faculty Email</Label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-focus-within:text-primary transition-colors">
                                    <Mail className="h-4 w-4" />
                                </span>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@university.edu"
                                    className="pl-16 h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-lg font-bold shadow-sm transition-colors"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Password</Label>
                                <Button variant="link" className="px-0 font-bold text-xs text-muted-foreground hover:text-primary transition-colors h-auto" type="button">
                                    Forgot?
                                </Button>
                            </div>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-focus-within:text-primary transition-colors">
                                    <Lock className="h-4 w-4" />
                                </span>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-16 h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-lg font-bold shadow-sm transition-colors tracking-widest"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            className="w-full mt-4 h-16 rounded-2xl font-black uppercase text-sm tracking-widest shadow-[0_20px_40px_-15px_rgba(var(--primary),0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-primary-foreground flex items-center gap-3"
                            disabled={loading}
                            type="submit"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    Enter the Lab
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex flex-col gap-5 border-t border-border bg-muted/5 px-10 py-8">
                    <p className="text-sm text-center font-medium text-muted-foreground">
                        New to the lab?{' '}
                        <Link to="/register" className="font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider ml-2">
                            Create Account
                        </Link>
                    </p>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/60 uppercase tracking-[0.2em] font-black">
                        <ShieldCheck className="h-4 w-4" />
                        Secure Encrypted Channel
                    </div>
                </CardFooter>
            </Card>
        </div >
    );
}

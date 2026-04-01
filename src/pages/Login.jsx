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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
        <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden font-sans">
            <Card className="w-full max-w-sm mx-4 border border-border bg-card shadow-sm rounded-lg overflow-hidden">
                <CardHeader className="space-y-4 pt-8 pb-6 text-center border-b border-border">
                    <div className="flex justify-center">
                        <div className="p-2.5 bg-foreground text-background border border-foreground rounded-md">
                            <Cpu className="h-6 w-6" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-bold tracking-tight text-foreground">HardwareHub</CardTitle>
                        <CardDescription className="text-xs font-medium text-muted-foreground">Sign in to access the lab</CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="px-6 pb-6 pt-6 bg-card">
                    {error && (
                        <Alert variant="destructive" className="mb-4 border border-destructive/20 bg-destructive/5 text-destructive rounded-md animate-in slide-in-from-top-2 duration-200">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                        </Alert>
                    )}

                    {resetSent && (
                        <Alert className="mb-4 border border-border bg-muted/30 rounded-md animate-in slide-in-from-top-2 duration-200">
                            <CheckCircle2 className="h-4 w-4 text-foreground" />
                            <AlertDescription className="text-xs font-medium text-foreground">
                                Check your inbox for the password reset link.
                            </AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs font-semibold text-foreground">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@university.edu"
                                    className="pl-10 h-10 bg-background border-border rounded-md focus-visible:ring-1 focus-visible:ring-foreground text-sm"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-xs font-semibold text-foreground">Password</Label>
                                <Button
                                    variant="link"
                                    className="px-0 text-xs font-medium text-muted-foreground hover:text-foreground h-auto"
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                >
                                    Forgot password?
                                </Button>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-10 h-10 bg-background border-border rounded-md focus-visible:ring-1 focus-visible:ring-foreground text-sm"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            className="w-full h-10 rounded-md font-semibold text-sm bg-foreground text-background hover:bg-foreground/90 flex items-center gap-2 mt-2"
                            disabled={loading}
                            type="submit"
                        >
                            {loading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
                            ) : (
                                <>Sign In <ArrowRight className="h-4 w-4" /></>
                            )}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex flex-col gap-3 border-t border-border bg-muted/20 px-6 py-5">
                    <p className="text-xs text-center text-muted-foreground">
                        Don't have an account?{' '}
                        <Link to="/register" className="font-semibold text-foreground hover:underline">
                            Create one
                        </Link>
                    </p>
                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                        <ShieldCheck className="h-3 w-3" />
                        Secure encrypted connection
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

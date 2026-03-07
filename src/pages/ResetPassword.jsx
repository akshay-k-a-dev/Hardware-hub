import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
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
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ResetPassword() {
    const { updatePassword, user } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // If no user is present, it means the recovery link didn't work or expired
    // However, Supabase usually logs the user in automatically when they click the recovery link
    // We'll check for user in a bit.

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            return setError('Password must be at least 6 characters');
        }

        if (password !== confirmPassword) {
            return setError('Passwords do not match');
        }

        setLoading(true);
        try {
            await updatePassword(password);
            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            setError(err.message || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans">
                <Card className="w-full max-w-[460px] mx-4 border border-border bg-card shadow-xl relative z-10 rounded-[2.5rem] overflow-hidden text-center p-12">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 rounded-3xl bg-green-500/10 text-green-600 border border-green-500/20 shadow-sm">
                            <CheckCircle2 className="h-10 w-10" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-black mb-4">Password Updated!</h2>
                    <p className="text-muted-foreground font-medium mb-8">Your security credentials have been successfully reset. Redirecting you to the lab entrance...</p>
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </Card>
            </div>
        );
    }

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
                        <CardTitle className="text-4xl font-black tracking-tight text-foreground">Secure Reset</CardTitle>
                        <CardDescription className="text-lg font-medium text-muted-foreground">Set your new laboratory access code</CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="px-10 pb-10 pt-8">
                    {error && (
                        <Alert variant="destructive" className="mb-8 border-none bg-destructive/10 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                            <AlertCircle className="h-5 w-5" />
                            <AlertTitle className="font-bold tracking-tight">System Error</AlertTitle>
                            <AlertDescription className="font-medium text-xs">{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="password" className="text-xs font-black uppercase tracking-widest text-muted-foreground">New Access Code</Label>
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

                        <div className="space-y-3">
                            <Label htmlFor="confirmPassword" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Verify Code</Label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-focus-within:text-primary transition-colors">
                                    <Lock className="h-4 w-4" />
                                </span>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-16 h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-lg font-bold shadow-sm transition-colors tracking-widest"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                                    Updating...
                                </>
                            ) : (
                                <>
                                    Update Credentials
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div >
    );
}

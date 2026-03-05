import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
    UserPlus,
    Mail,
    Lock,
    User,
    Briefcase,
    ArrowRight,
    AlertCircle,
    Loader2,
    Cpu,
    ShieldCheck
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Register() {
    const { signUp, user } = useAuth();
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    if (user) return <Navigate to="/" replace />;

    const handleChange = (name, value) => setForm({ ...form, [name]: value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitted) return;
        setError('');

        if (form.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (!form.name.trim()) {
            setError('Full name is required');
            return;
        }

        setLoading(true);
        setSubmitted(true);
        try {
            await signUp(form);
        } catch (err) {
            setError(err.message || 'Registration failed. Please attempt procedure again.');
            setSubmitted(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans py-16">
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[150px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[120px]" />
            </div>

            <Card className="w-full max-w-[500px] mx-4 border border-border bg-card shadow-xl relative z-10 animate-in fade-in zoom-in-95 duration-700 rounded-[2.5rem] overflow-hidden">
                <CardHeader className="space-y-6 pt-12 pb-8 text-center bg-muted/5 border-b border-border relative">
                    <div className="flex justify-center">
                        <div className="p-4 rounded-3xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                            <UserPlus className="h-10 w-10" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Cpu className="h-5 w-5 text-primary opacity-80" />
                            <span className="font-black tracking-widest uppercase text-lg text-primary/80">HardwareHub</span>
                        </div>
                        <CardTitle className="text-4xl font-black tracking-tight text-foreground">Create Account</CardTitle>
                        <CardDescription className="text-lg font-medium text-muted-foreground">Become a Lab Member</CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="px-10 pb-10 pt-8">
                    {error && (
                        <Alert variant="destructive" className="mb-8 border-none bg-destructive/10 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                            <AlertCircle className="h-5 w-5" />
                            <AlertTitle className="font-bold tracking-tight">Registration Error</AlertTitle>
                            <AlertDescription className="font-medium text-xs">{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Full Name</Label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-focus-within:text-primary transition-colors">
                                    <User className="h-4 w-4" />
                                </span>
                                <Input
                                    id="name"
                                    placeholder="Alex Johnson"
                                    className="pl-16 h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-lg font-bold shadow-sm transition-colors"
                                    value={form.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

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
                                    value={form.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="password" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Password</Label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-focus-within:text-primary transition-colors">
                                    <Lock className="h-4 w-4" />
                                </span>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Min. 6 characters"
                                    className="pl-16 h-14 bg-muted/30 border border-border rounded-2xl focus-visible:ring-primary/20 text-lg font-bold shadow-sm transition-colors tracking-widest"
                                    value={form.password}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="role" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Account Type</Label>
                            <Select value={form.role} onValueChange={(val) => handleChange('role', val)}>
                                <SelectTrigger className="h-14 bg-muted/30 border border-border rounded-2xl focus:ring-primary/20 focus:border-primary/40 text-lg font-bold px-6 shadow-sm relative cursor-pointer group hover:bg-muted/40 transition-colors">
                                    <SelectValue placeholder="Select account type" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border border-border rounded-2xl shadow-xl">
                                    <SelectItem value="student" className="font-bold py-3 cursor-pointer focus:bg-primary/10 focus:text-primary rounded-xl mx-1 my-0.5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                <User className="h-4 w-4" />
                                            </div>
                                            <span>Student</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="provider" className="font-bold py-3 cursor-pointer focus:bg-blue-500/10 focus:text-blue-500 rounded-xl mx-1 my-0.5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                <Briefcase className="h-4 w-4" />
                                            </div>
                                            <span>Faculty / Lab Admin</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="pt-6">
                            <Button
                                className="w-full h-16 rounded-2xl font-black uppercase text-sm tracking-widest shadow-[0_20px_40px_-15px_rgba(var(--primary),0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-primary-foreground flex items-center gap-3"
                                disabled={loading || submitted}
                                type="submit"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Computing...
                                    </>
                                ) : (
                                    <>
                                        Join the Hub
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>

                <CardFooter className="flex flex-col gap-6 border-t border-border bg-muted/5 px-10 py-8 text-center">
                    <p className="text-sm font-medium text-muted-foreground">
                        Already have an account?{' '}
                        <Link to="/login" className="font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider ml-2">
                            Sign In Here
                        </Link>
                    </p>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/60 uppercase tracking-[0.2em] font-black">
                        <ShieldCheck className="h-4 w-4" />
                        Secure Account Registration
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

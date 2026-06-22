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
import { Alert, AlertDescription } from '@/components/ui/alert';

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
            setError(err.message || 'Registration failed. Please try again.');
            setSubmitted(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dark min-h-screen w-full flex items-center justify-center bg-background font-sans py-12 relative overflow-hidden">
            {/* ── Ambient background gradients ────────────────── */}
            <div className="pointer-events-none absolute inset-0 z-0">
                <div className="absolute top-[-10%] right-[-10%] h-[50vh] w-[50vh] rounded-full bg-white/[0.03] blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] h-[35vh] w-[35vh] rounded-full bg-white/[0.02] blur-[100px]" />
            </div>

            <Card className="w-full max-w-sm mx-4 border border-border bg-card/50 backdrop-blur-xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500 rounded-xl overflow-hidden">
                <CardHeader className="space-y-4 pt-10 pb-8 text-center border-b border-border/50">
                    <div className="flex justify-center">
                        <div className="p-3 bg-white text-black rounded-xl shadow-lg">
                            <UserPlus className="h-6 w-6" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <CardTitle className="text-2xl font-bold tracking-tight text-foreground font-inter-tight uppercase tracking-widest leading-none">Register</CardTitle>
                        <CardDescription className="text-xs font-medium text-muted-foreground mt-2 uppercase tracking-wide opacity-60">
                            Join the HardwareHub community
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="px-8 pb-8 pt-8">
                    {error && (
                        <Alert variant="destructive" className="mb-6 border border-destructive/20 bg-destructive/10 text-destructive rounded-lg animate-in slide-in-from-top-2 duration-200">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs font-semibold">{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Full Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-0.5">Full Name</Label>
                            <div className="relative group">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                                <Input
                                    id="name"
                                    placeholder="Alex Johnson"
                                    className="pl-11 h-10 bg-muted/20 border-border rounded-lg focus-visible:ring-1 focus-visible:ring-foreground text-sm font-medium transition-all"
                                    value={form.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-0.5">University Email</Label>
                            <div className="relative group">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@university.edu"
                                    className="pl-11 h-10 bg-muted/20 border-border rounded-lg focus-visible:ring-1 focus-visible:ring-foreground text-sm font-medium transition-all"
                                    value={form.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-0.5">Secure Password</Label>
                            <div className="relative group">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Min. 6 characters"
                                    className="pl-11 h-10 bg-muted/20 border-border rounded-lg focus-visible:ring-1 focus-visible:ring-foreground text-sm font-medium transition-all"
                                    value={form.password}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Role */}
                        <div className="space-y-1.5 pt-0.5">
                            <Label htmlFor="role" className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-0.5">Account Role</Label>
                            <Select value={form.role} onValueChange={(val) => handleChange('role', val)}>
                                <SelectTrigger className="h-10 bg-muted/20 border-border rounded-lg focus:ring-1 focus:ring-foreground text-sm font-medium px-3 shadow-none">
                                    <SelectValue placeholder="Select account type" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border border-border shadow-2xl rounded-lg overflow-hidden animate-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200">
                                    <SelectItem value="student" className="py-2.5 px-4 cursor-pointer focus:bg-muted font-medium transition-colors">
                                        <div className="flex items-center gap-2.5">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <span>Student Researcher</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="provider" className="py-2.5 px-4 cursor-pointer focus:bg-muted font-medium transition-colors">
                                        <div className="flex items-center gap-2.5">
                                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                                            <span>Faculty / Lab Manager</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            className="w-full h-11 rounded-full font-bold text-sm bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 shadow-xl"
                            disabled={loading || submitted}
                            type="submit"
                        >
                            {loading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Finalizing...</>
                            ) : (
                                <>Create Account <ArrowRight className="h-4 w-4" /></>
                            )}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex flex-col gap-4 border-t border-border/50 bg-muted/5 px-8 py-6">
                    <p className="text-[11px] text-center text-muted-foreground font-medium">
                        Already registered?{' '}
                        <Link to="/login" className="font-bold text-foreground hover:underline underline-offset-4">
                            Sign in to lab
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

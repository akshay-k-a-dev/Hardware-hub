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
        <div className="min-h-screen w-full flex items-center justify-center bg-background font-sans py-8">
            <Card className="w-full max-w-sm mx-4 border border-border bg-card shadow-sm rounded-lg overflow-hidden">
                <CardHeader className="space-y-4 pt-8 pb-6 text-center border-b border-border">
                    <div className="flex justify-center">
                        <div className="p-2.5 bg-foreground text-background border border-foreground rounded-md">
                            <UserPlus className="h-6 w-6" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-bold tracking-tight text-foreground">Create Account</CardTitle>
                        <CardDescription className="text-xs font-medium text-muted-foreground">
                            Join HardwareHub to access the lab
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="px-6 pb-6 pt-6 bg-card">
                    {error && (
                        <Alert variant="destructive" className="mb-4 border border-destructive/20 bg-destructive/5 text-destructive rounded-md animate-in slide-in-from-top-2 duration-200">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Full Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-xs font-semibold text-foreground">Full Name</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="name"
                                    placeholder="Alex Johnson"
                                    className="pl-10 h-10 bg-background border-border rounded-md focus-visible:ring-1 focus-visible:ring-foreground text-sm"
                                    value={form.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs font-semibold text-foreground">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@university.edu"
                                    className="pl-10 h-10 bg-background border-border rounded-md focus-visible:ring-1 focus-visible:ring-foreground text-sm"
                                    value={form.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-xs font-semibold text-foreground">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Min. 6 characters"
                                    className="pl-10 h-10 bg-background border-border rounded-md focus-visible:ring-1 focus-visible:ring-foreground text-sm"
                                    value={form.password}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Role */}
                        <div className="space-y-1.5">
                            <Label htmlFor="role" className="text-xs font-semibold text-foreground">Account Type</Label>
                            <Select value={form.role} onValueChange={(val) => handleChange('role', val)}>
                                <SelectTrigger className="h-10 bg-background border-border rounded-md focus:ring-1 focus:ring-foreground text-sm px-3 shadow-none">
                                    <SelectValue placeholder="Select account type" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border border-border rounded-md shadow-md text-foreground">
                                    <SelectItem value="student" className="text-sm py-2 cursor-pointer focus:bg-muted rounded-sm">
                                        <div className="flex items-center gap-2">
                                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span>Student</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="provider" className="text-sm py-2 cursor-pointer focus:bg-muted rounded-sm">
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span>Faculty / Lab Admin</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            className="w-full h-10 rounded-md font-semibold text-sm bg-foreground text-background hover:bg-foreground/90 flex items-center gap-2 mt-2"
                            disabled={loading || submitted}
                            type="submit"
                        >
                            {loading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</>
                            ) : (
                                <>Create Account <ArrowRight className="h-4 w-4" /></>
                            )}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex flex-col gap-3 border-t border-border bg-muted/20 px-6 py-5 text-center">
                    <p className="text-xs text-muted-foreground">
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-foreground hover:underline">
                            Sign in
                        </Link>
                    </p>
                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                        <ShieldCheck className="h-3 w-3" />
                        Secure encrypted registration
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

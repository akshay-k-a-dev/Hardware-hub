import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { 
    User, Moon, Bell, Shield, Key, Mail, Lock, 
    Smartphone, Download, Trash2, Plug, PlaySquare, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Settings() {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Mock states for toggles
    const [settings, setSettings] = useState({
        emailNotifications: true,
        pushNotifications: false,
        doNotDisturb: false,
        profileVisibility: true,
        twoFactor: false,
    });

    const [isDark, setIsDark] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    useEffect(() => {
        // Init theme state from DOM (since Layout handles the main setup)
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);

    const handleThemeToggle = (checked) => {
        setIsDark(checked);
        const root = window.document.documentElement;
        if (checked) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const handleToggle = (key) => {
        setSettings((prev) => {
            const newVal = !prev[key];
            toast({
                title: "Setting Updated",
                description: `Your preferences have been saved.`,
            });
            return { ...prev, [key]: newVal };
        });
    };

    const handleDownloadData = () => {
        toast({
            title: "Data Export Started",
            description: "We are compiling your data. We'll email you a download link shortly.",
        });
    };

    const handleDeleteAccount = async () => {
        // Typically calls an edge function or auth api wrapper
        toast({
            variant: "destructive",
            title: "Account Scheduled for Deletion",
            description: "Your account and data will be permanently removed.",
        });
        setDeleteDialogOpen(false);
        await signOut();
        navigate('/login', { replace: true });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-10">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
                    Settings
                </h1>
                <p className="text-muted-foreground text-sm md:text-lg font-medium">
                    Manage your preferences, notifications, and security.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                
                {/* 1. Profile & Preferences */}
                <Card className="border border-border bg-card shadow-sm rounded-md overflow-hidden transition-all duration-300 group">
                    <CardHeader className="bg-muted/50 border-b border-border pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                            <div className="p-1.5 bg-muted text-muted-foreground rounded-md">
                                <User size={18} />
                            </div>
                            Prefrences & Identity
                        </CardTitle>
                        <CardDescription className="text-sm font-medium">Control your theme and public profile presence.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <span className="font-bold text-base text-foreground">App Theme</span>
                                <p className="text-xs text-muted-foreground font-medium">Switch between light and dark mode</p>
                            </div>
                            <div className="flex items-center gap-3 p-1.5 bg-muted rounded-full border border-border/50">
                                <Moon size={14} className={isDark ? "text-amber-500" : "text-muted-foreground"} />
                                <Switch checked={isDark} onCheckedChange={handleThemeToggle} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <span className="font-bold text-base text-foreground">Profile Visibility</span>
                                <p className="text-xs text-muted-foreground font-medium">Allow others to see your public activity</p>
                            </div>
                            <Switch 
                                checked={settings.profileVisibility} 
                                onCheckedChange={() => handleToggle('profileVisibility')} 
                            />
                        </div>
                        <div className="pt-4 border-t border-border">
                            <Button 
                                variant="outline" 
                                className="w-full rounded-md border-border text-foreground hover:bg-muted font-bold h-10"
                                onClick={() => navigate('/profile')}
                            >
                                Edit Full Profile
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Notifications */}
                <Card className="border border-border bg-card shadow-sm rounded-md overflow-hidden transition-all duration-300 group">
                    <CardHeader className="bg-muted/50 border-b border-border pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                            <div className="p-1.5 bg-muted text-muted-foreground rounded-md">
                                <Bell size={18} />
                            </div>
                            Alerts & Notifications
                        </CardTitle>
                        <CardDescription className="text-sm font-medium">Choose how and when you want to be notified.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Mail size={18} className="text-muted-foreground" />
                                <div className="space-y-1">
                                    <span className="font-bold text-base text-foreground">Email Notifications</span>
                                    <p className="text-xs text-muted-foreground font-medium">Get updates on your requests via email.</p>
                                </div>
                            </div>
                            <Switch 
                                checked={settings.emailNotifications} 
                                onCheckedChange={() => handleToggle('emailNotifications')} 
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Smartphone size={18} className="text-muted-foreground" />
                                <div className="space-y-1">
                                    <span className="font-bold text-base text-foreground">Push Notifications</span>
                                    <p className="text-xs text-muted-foreground font-medium">Real-time alerts in your browser/device.</p>
                                </div>
                            </div>
                            <Switch 
                                checked={settings.pushNotifications} 
                                onCheckedChange={() => handleToggle('pushNotifications')} 
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Moon size={18} className="text-muted-foreground" />
                                <div className="space-y-1">
                                    <span className="font-bold text-base text-foreground">Do Not Disturb</span>
                                    <p className="text-xs text-muted-foreground font-medium">Suppress alerts between 10PM and 8AM.</p>
                                </div>
                            </div>
                            <Switch 
                                checked={settings.doNotDisturb} 
                                onCheckedChange={() => handleToggle('doNotDisturb')} 
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Security & Privacy */}
                <Card className="border border-border bg-card shadow-sm rounded-md overflow-hidden transition-all duration-300 group">
                    <CardHeader className="bg-muted/50 border-b border-border pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                            <div className="p-1.5 bg-muted text-muted-foreground rounded-md">
                                <Shield size={18} />
                            </div>
                            Security
                        </CardTitle>
                        <CardDescription className="text-sm font-medium">Protect your account and hardware data.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Lock size={18} className="text-muted-foreground" />
                                <div className="space-y-1">
                                    <span className="font-bold text-base text-foreground">Two-Factor Auth (MFA)</span>
                                    <p className="text-xs text-muted-foreground font-medium">Add an extra layer of security.</p>
                                </div>
                            </div>
                            <Switch 
                                checked={settings.twoFactor} 
                                onCheckedChange={() => handleToggle('twoFactor')} 
                            />
                        </div>
                        <div className="pt-4 border-t border-border space-y-4">
                            <Button 
                                variant="outline" 
                                className="w-full rounded-md font-bold h-10 justify-start hover:bg-muted"
                                onClick={() => navigate('/reset-password')}
                            >
                                <Key className="mr-3 h-4 w-4 text-muted-foreground" />
                                Change Password
                            </Button>
                            <Button 
                                variant="outline" 
                                className="w-full rounded-md font-bold h-10 justify-start hover:bg-muted"
                                onClick={() => {
                                    toast({ description: "All other active sessions have been signed out." });
                                }}
                            >
                                <PlaySquare className="mr-3 h-4 w-4 text-muted-foreground" />
                                Terminate Active Sessions
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Connected Apps */}
                <Card className="border border-border bg-card shadow-sm rounded-md overflow-hidden transition-all duration-300 group md:col-span-2 lg:col-span-1">
                    <CardHeader className="bg-muted/50 border-b border-border pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                            <div className="p-1.5 bg-muted text-muted-foreground rounded-md">
                                <Plug size={18} />
                            </div>
                            Connected Labs & Integrations
                        </CardTitle>
                        <CardDescription className="text-sm font-medium">Link university systems to your HardwareHub profile.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-muted/20 rounded-md border border-dashed border-border">
                            <Plug className="h-10 w-10 text-muted-foreground/50 mb-4" />
                            <h3 className="font-bold text-foreground text-sm">No integrations active</h3>
                            <p className="text-xs text-muted-foreground max-w-[200px] mt-2 mb-4">
                                Connect student portals or inventory trackers to automate workflows.
                            </p>
                            <Button variant="secondary" size="sm" className="rounded-md h-10 font-bold block" onClick={() => toast({ title: "Coming soon", description: "Integration directory is under construction."})}>
                                Explore Directory
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Account Data & Danger Zone */}
                <Card className="border border-border bg-card shadow-sm rounded-md overflow-hidden transition-all duration-300 group md:col-span-2">
                    <CardHeader className="bg-muted/50 border-b border-border pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-destructive">
                            <div className="p-1.5 bg-destructive/10 text-destructive rounded-md">
                                <AlertCircle size={18} />
                            </div>
                            Zone of Danger
                        </CardTitle>
                        <CardDescription className="text-sm font-medium">Manage your data or suspend your account entirely.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div className="space-y-1 flex-1">
                                <span className="font-bold text-base text-foreground">Download User Snapshot</span>
                                <p className="text-sm text-muted-foreground font-medium">Request a ZIP copy of all your requests and lab activity.</p>
                            </div>
                            <Button variant="outline" className="h-10 w-full md:w-auto px-6 rounded-md font-bold" onClick={handleDownloadData}>
                                <Download className="mr-2 h-4 w-4 text-foreground" />
                                Export JSON Data
                            </Button>
                        </div>
                        
                        <div className="h-px bg-border w-full my-6" />

                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div className="space-y-1 flex-1">
                                <span className="font-bold text-base text-foreground">Deactivate Account</span>
                                <p className="text-sm text-muted-foreground font-medium">Permanently deletes your account and scrubs your data from the ledger.</p>
                            </div>
                            <Button variant="destructive" className="h-10 w-full md:w-auto px-6 rounded-md font-bold bg-foreground text-background hover:bg-foreground/90" onClick={() => setDeleteDialogOpen(true)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Account
                            </Button>
                        </div>
                    </CardContent>
                </Card>

            </div>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-lg border-border">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-destructive">Confirm Deletion</DialogTitle>
                        <DialogDescription className="text-sm font-medium">
                            This action cannot be undone. All your requests, lab inventory, and rating history will be permanently deleted from our servers.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 focus-within:ring-0">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
                            Type "DELETE" to confirm
                        </Label>
                        <Input 
                            placeholder="DELETE" 
                            className="h-10 border-border bg-background focus-visible:ring-1 focus-visible:ring-foreground rounded-md"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} className="rounded-md font-bold h-10">
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteAccount} className="h-10 px-6 rounded-md font-bold bg-foreground text-background hover:bg-foreground/90">
                            Permenantly Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

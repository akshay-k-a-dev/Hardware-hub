import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Wrench,
    ClipboardList,
    FileCheck,
    PlusSquare,
    BookmarkCheck,
    LogOut,
    Search,
    Settings,
    User,
    Sun,
    Moon
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarProvider,
    SidebarInset,
    SidebarTrigger
} from '@/components/ui/sidebar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NotificationBell from './NotificationBell';
import { Toaster } from '@/components/ui/toaster';

export default function Layout() {
    const { profile, signOut, isProvider, isAdmin } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // ── Theme: system pref + localStorage persistence ─────────
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('theme');
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };

    const studentLinks = [
        { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
        { to: '/components', icon: <Wrench size={18} />, label: 'Hardware Lab' },
        { to: '/my-requests', icon: <ClipboardList size={18} />, label: 'My Requests' },
        { to: '/my-prebooks', icon: <BookmarkCheck size={18} />, label: 'My Pre-Books' },
    ];

    const providerLinks = [
        { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
        { to: '/components', icon: <Wrench size={18} />, label: 'Hardware Lab' },
        { to: '/manage-requests', icon: <FileCheck size={18} />, label: 'Manage Requests' },
        { to: '/add-component', icon: <PlusSquare size={18} />, label: 'Inventory Entry' },
    ];

    const links = (isProvider || isAdmin) ? providerLinks : studentLinks;
    const initial = profile?.name?.charAt(0)?.toUpperCase() || '?';

    return (
        <SidebarProvider>
            <div className="flex h-screen w-full overflow-hidden bg-background">
                {/* ── Sidebar ──────────────────────────────────── */}
                <Sidebar variant="inset" className="border-r border-border">
                    <SidebarHeader className="flex flex-row items-center gap-3 px-6 py-6 md:py-8">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                            <Wrench size={22} />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-foreground truncate">
                            HardwareHub
                        </span>
                    </SidebarHeader>

                    <SidebarContent className="px-3">
                        <SidebarMenu className="space-y-1">
                            {links.map((link) => (
                                <SidebarMenuItem key={link.to}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={location.pathname === link.to}
                                        className="py-6 px-4 rounded-xl hover:bg-muted/80 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-bold"
                                    >
                                        <NavLink to={link.to} end={link.to === '/'}>
                                            <span className="mr-3 shrink-0">{link.icon}</span>
                                            <span className="font-medium truncate">{link.label}</span>
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarContent>

                    <SidebarFooter className="p-4 border-t border-border">
                        <div className="flex items-center gap-3 px-3 py-3 mb-3 rounded-xl bg-muted/40 border border-border/50">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold shadow-inner">
                                {initial}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-sm font-bold truncate text-foreground">
                                    {profile?.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">
                                    {profile?.role === 'provider' ? 'Lab Admin' : profile?.role}
                                </span>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                            onClick={handleSignOut}
                        >
                            <LogOut size={16} className="mr-3 shrink-0" />
                            Sign Out
                        </Button>
                    </SidebarFooter>
                </Sidebar>

                {/* ── Main area ────────────────────────────────── */}
                <SidebarInset className="flex flex-col overflow-hidden w-full">
                    {/* Top Navbar — glassmorphism on scroll */}
                    <header className="flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4 md:px-6 shrink-0 z-10 supports-[backdrop-filter]:bg-background/60">
                        <div className="flex items-center gap-3 md:gap-4 flex-1">
                            <SidebarTrigger className="hover:bg-muted/60 rounded-xl shrink-0" />

                            {/* Search — hidden on mobile */}
                            <div className="relative w-full max-w-sm lg:max-w-md hidden md:flex items-center group">
                                <Search className="absolute left-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                                <Input
                                    placeholder="Search hardware..."
                                    className="pl-10 h-10 w-full bg-muted/30 border-border/40 focus-visible:bg-background focus-visible:border-primary/40 focus-visible:ring-primary/20 rounded-xl shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-1 md:gap-2">
                            {/* Theme toggle */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsDark(prev => !prev)}
                                className="rounded-full w-10 h-10 hover:bg-muted/60"
                                aria-label="Toggle theme"
                            >
                                {isDark ? (
                                    <Sun size={18} className="text-amber-400" />
                                ) : (
                                    <Moon size={18} className="text-slate-500" />
                                )}
                            </Button>

                            <NotificationBell />

                            {/* Avatar dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-full ml-1 w-10 h-10 hover:bg-muted/60"
                                    >
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                                            {initial}
                                        </div>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-56 rounded-2xl border-border/50 shadow-xl p-2"
                                >
                                    <DropdownMenuLabel className="px-3 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                        My Account
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="opacity-40" />
                                    <DropdownMenuItem
                                        onClick={() => navigate('/profile')}
                                        className="rounded-xl cursor-pointer p-3 hover:bg-primary/5 focus:bg-primary/5"
                                    >
                                        <User className="mr-3 h-4 w-4 text-primary" />
                                        Profile
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="rounded-xl cursor-pointer p-3 hover:bg-primary/5 focus:bg-primary/5">
                                        <Settings className="mr-3 h-4 w-4 text-primary" />
                                        Settings
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="opacity-40" />
                                    <DropdownMenuItem
                                        onClick={handleSignOut}
                                        className="rounded-xl cursor-pointer p-3 mt-1 text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                        <LogOut className="mr-3 h-4 w-4" />
                                        Sign Out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>

                    {/* Page content */}
                    <main className="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-8 lg:p-10 scroll-smooth">
                        <Outlet />
                    </main>
                </SidebarInset>
            </div>
            <Toaster />
        </SidebarProvider>
    );
}

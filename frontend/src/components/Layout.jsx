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
    Moon,
    History
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
    SidebarTrigger,
    useSidebar
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

// ─── useSidebar must be consumed INSIDE <SidebarProvider>.
// We wrap with a shell component so LayoutInner can safely call useSidebar.
export default function Layout() {
    return (
        <SidebarProvider defaultOpen={false}>
            <LayoutInner />
        </SidebarProvider>
    );
}

function LayoutInner() {
    const { profile, signOut, isProvider, isAdmin } = useAuth();
    const { setOpenMobile, isMobile } = useSidebar(); 
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

    const handleNavClick = () => {
        if (isMobile) setOpenMobile(false);
    };

    const studentLinks = [
        { to: '/dashboard', icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
        { to: '/', icon: <Wrench size={15} />, label: 'Items' },
        { to: '/my-requests', icon: <ClipboardList size={15} />, label: 'My Requests' },
        { to: '/my-prebooks', icon: <BookmarkCheck size={15} />, label: 'My Waitlist' },
    ];

    const providerLinks = [
        { to: '/dashboard', icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
        { to: '/', icon: <Wrench size={15} />, label: 'Items' },
        { to: '/manage-requests', icon: <FileCheck size={15} />, label: 'Manage Requests' },
        { to: '/add-component', icon: <PlusSquare size={15} />, label: 'Add Item' },
    ];

    const adminLinks = [
        { to: '/dashboard', icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
        { to: '/', icon: <Wrench size={15} />, label: 'Items' },
        { to: '/admin', icon: <Settings size={15} />, label: 'Admin Control' },
        { to: '/manage-requests', icon: <FileCheck size={15} />, label: 'Manage Requests' },
        { to: '/add-component', icon: <PlusSquare size={15} />, label: 'Add Item' },
    ];

    const links = isAdmin ? adminLinks : (isProvider ? providerLinks : studentLinks);
    const initial = profile?.name?.charAt(0)?.toUpperCase() || '?';

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* ── Sidebar ──────────────────────────────────── */}
            <Sidebar variant="inset" collapsible="icon" className="border-r border-border bg-background">
                <SidebarHeader className="flex flex-row items-center gap-2 px-3 py-2.5 border-b border-border group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center border border-border bg-foreground text-background rounded-sm">
                        <Wrench size={10} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground truncate group-data-[collapsible=icon]:hidden">
                        HUB
                    </span>
                </SidebarHeader>

                <SidebarContent className="px-2 py-2">
                    <SidebarMenu className="space-y-1">
                        {links.map((link) => (
                            <SidebarMenuItem key={link.to}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname === link.to}
                                    tooltip={link.label}
                                    className="h-9 px-2.5 text-xs hover:bg-muted hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:font-bold rounded-sm transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                                >
                                    <NavLink
                                        to={link.to}
                                        end={link.to === '/'}
                                        onClick={handleNavClick}
                                    >
                                        <span className="shrink-0 opacity-80 group-data-[collapsible=icon]:mr-0">{link.icon}</span>
                                        <span className="font-semibold truncate group-data-[collapsible=icon]:hidden ml-2">{link.label}</span>
                                    </NavLink>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarContent>

                <SidebarFooter className="p-2 border-t border-border group-data-[collapsible=icon]:p-1.5">
                    <div className="flex items-center gap-2 px-2.5 py-2 mb-1.5 border border-border rounded-sm bg-muted/40 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:justify-center">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-border bg-background text-foreground font-black text-[10px] rounded-sm">
                            {initial}
                        </div>
                        <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                            <span className="text-[10px] font-bold truncate text-foreground leading-none">
                                {profile?.name?.split(' ')[0]}
                            </span>
                            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter mt-0.5">
                                {profile?.role === 'provider' ? 'ADMIN' : 'STUDENT'}
                            </span>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:h-8"
                        onClick={handleSignOut}
                    >
                        <LogOut size={13} className="mr-2.5 shrink-0 group-data-[collapsible=icon]:mr-0" />
                        <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
                    </Button>
                </SidebarFooter>
            </Sidebar>

            {/* ── Main area ────────────────────────────────── */}
            <SidebarInset className="flex flex-col overflow-hidden w-full">
                {/* Topbar — ultra compact e-commerce header */}
                <header className="flex h-10 items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur-md px-4 md:px-6 shrink-0 z-20">
                    <div className="flex items-center gap-2 flex-1">
                        <SidebarTrigger className="hover:bg-muted hover:text-foreground shrink-0 text-foreground h-7 w-7 transition-colors rounded-sm" />
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Theme toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsDark(prev => !prev)}
                            className="h-7 w-7 hover:bg-muted text-foreground transition-all duration-200"
                            aria-label="Toggle theme"
                        >
                            <div className="relative flex items-center justify-center h-4 w-4">
                                <Sun size={15} className={`absolute transition-all duration-500 ${isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100 text-amber-500'}`} />
                                <Moon size={15} className={`absolute transition-all duration-500 ${isDark ? 'rotate-0 scale-100 opacity-100 text-blue-400' : '-rotate-90 scale-0 opacity-0'}`} />
                            </div>
                        </Button>

                        <NotificationBell />

                        {/* Avatar dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 hover:bg-muted text-foreground border border-border rounded-sm transition-all duration-200"
                                >
                                    <span className="text-[10px] font-black">{initial}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="w-48 border border-border bg-card rounded-md shadow-lg p-1 animate-in slide-in-from-top-1 duration-200"
                            >
                                <DropdownMenuLabel className="px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                    {profile?.name}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-border/60" />
                                <DropdownMenuItem
                                    onClick={() => navigate('/profile')}
                                    className="cursor-pointer text-xs font-semibold px-2 py-1.5 rounded-sm hover:bg-muted transition-colors"
                                >
                                    <User className="mr-2 h-3.5 w-3.5" />
                                    Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => navigate('/settings')}
                                    className="cursor-pointer text-xs font-semibold px-2 py-1.5 rounded-sm hover:bg-muted transition-colors"
                                >
                                    <Settings className="mr-2 h-3.5 w-3.5" />
                                    Settings
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-border/60" />
                                <DropdownMenuItem
                                    onClick={handleSignOut}
                                    className="cursor-pointer text-xs font-semibold px-2 py-1.5 rounded-sm hover:bg-muted text-muted-foreground transition-colors"
                                >
                                    <LogOut className="mr-2 h-3.5 w-3.5" />
                                    Sign Out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Page content */}
                <main className={`flex-1 overflow-y-auto bg-background p-4 md:p-6 scroll-smooth ${location.pathname === '/dashboard' ? 'pb-24' : 'pb-8'}`}>
                    <Outlet />
                </main>
            </SidebarInset>
            
            {/* ── Mobile Downbar (Professional Full-width Version) ── */}
            {location.pathname === '/dashboard' && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-between px-6 z-[100] pb-safe">
                    {[
                        { label: 'Dash', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
                        { label: 'Items', path: '/', icon: <Wrench size={20} /> },
                        { label: 'Activity', path: '/my-requests', icon: <History size={20} /> },
                        { label: 'Profile', path: '/profile', icon: <User size={20} /> }
                    ].map((item) => {
                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                        return (
                            <button 
                                key={item.label}
                                onClick={() => navigate(item.path)}
                                className={`flex flex-col items-center gap-1 transition-all flex-1 py-1 ${isActive ? 'text-foreground' : 'text-foreground/70 hover:text-foreground/90'}`}
                            >
                                <div className={`p-1.5 transition-all ${isActive ? 'scale-110' : ''}`}>
                                    {item.icon}
                                </div>
                                <span className={`text-[8.5px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-80'}`}>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <Toaster />
        </div>
    );
}

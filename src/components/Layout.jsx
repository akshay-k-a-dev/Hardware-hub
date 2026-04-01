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
        <SidebarProvider>
            <LayoutInner />
        </SidebarProvider>
    );
}

function LayoutInner() {
    const { profile, signOut, isProvider, isAdmin } = useAuth();
    const { setOpenMobile, isMobile } = useSidebar(); // ← close sheet on mobile nav
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

    // Close the mobile Sheet drawer when a nav link is tapped
    const handleNavClick = () => {
        if (isMobile) setOpenMobile(false);
    };

    const studentLinks = [
        { to: '/dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
        { to: '/', icon: <Wrench size={16} />, label: 'Hardware Lab' },
        { to: '/my-requests', icon: <ClipboardList size={16} />, label: 'My Requests' },
        { to: '/my-prebooks', icon: <BookmarkCheck size={16} />, label: 'My Pre-Books' },
    ];

    const providerLinks = [
        { to: '/dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
        { to: '/', icon: <Wrench size={16} />, label: 'Hardware Lab' },
        { to: '/manage-requests', icon: <FileCheck size={16} />, label: 'Manage Requests' },
        { to: '/add-component', icon: <PlusSquare size={16} />, label: 'Add Hardware' },
    ];

    const links = (isProvider || isAdmin) ? providerLinks : studentLinks;
    const initial = profile?.name?.charAt(0)?.toUpperCase() || '?';

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* ── Sidebar ──────────────────────────────────── */}
            <Sidebar variant="inset" collapsible="icon" className="border-r border-border">
                <SidebarHeader className="flex flex-row items-center gap-2.5 px-4 py-3.5 border-b border-border group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-foreground text-background">
                        <Wrench size={14} />
                    </div>
                    <span className="text-sm font-bold tracking-tight text-foreground truncate group-data-[collapsible=icon]:hidden">
                        HardwareHub
                    </span>
                </SidebarHeader>

                <SidebarContent className="px-2 py-2">
                    <SidebarMenu className="space-y-0.5">
                        {links.map((link) => (
                            <SidebarMenuItem key={link.to}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname === link.to}
                                    tooltip={link.label}
                                    className="py-2 px-3 text-sm hover:bg-muted hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:font-semibold rounded-md transition-colors duration-150 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                                >
                                    <NavLink
                                        to={link.to}
                                        end={link.to === '/'}
                                        onClick={handleNavClick}
                                    >
                                        <span className="mr-2.5 shrink-0 opacity-70 group-data-[collapsible=icon]:mr-0">{link.icon}</span>
                                        <span className="font-medium truncate group-data-[collapsible=icon]:hidden">{link.label}</span>
                                    </NavLink>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarContent>

                <SidebarFooter className="p-3 border-t border-border group-data-[collapsible=icon]:p-2">
                    <div className="flex items-center gap-2.5 px-3 py-2.5 mb-2 border border-border rounded-md bg-muted/40 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:justify-center">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-background text-foreground font-bold text-xs rounded-sm">
                            {initial}
                        </div>
                        <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                            <span className="text-xs font-semibold truncate text-foreground">
                                {profile?.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                                {profile?.role === 'provider' ? 'Lab Admin' : profile?.role}
                            </span>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:h-9"
                        onClick={handleSignOut}
                        title="Sign Out"
                    >
                        <LogOut size={14} className="mr-2.5 shrink-0 group-data-[collapsible=icon]:mr-0 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
                    </Button>
                </SidebarFooter>
            </Sidebar>

            {/* ── Main area ────────────────────────────────── */}
            <SidebarInset className="flex flex-col overflow-hidden w-full">
                {/* Topbar — compact h-12, no white gap */}
                <header className="flex h-12 items-center justify-between border-b border-border bg-background px-4 md:px-5 shrink-0 z-10">
                    <div className="flex items-center gap-2 flex-1">
                        <SidebarTrigger className="hover:bg-muted hover:text-foreground shrink-0 text-foreground h-8 w-8" />
                        {/* Global search removed from topbar — lives in Hardware Lab page */}
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Theme toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsDark(prev => !prev)}
                            className="h-8 w-8 hover:bg-muted text-foreground"
                            aria-label="Toggle theme"
                        >
                            {isDark ? <Sun size={15} /> : <Moon size={15} />}
                        </Button>

                        <NotificationBell />

                        {/* Avatar dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-muted text-foreground border border-border rounded-sm"
                                >
                                    <span className="text-xs font-bold">{initial}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="w-48 border border-border bg-card rounded-md shadow-md p-1"
                            >
                                <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    {profile?.name}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-border" />
                                <DropdownMenuItem
                                    onClick={() => navigate('/profile')}
                                    className="cursor-pointer text-sm px-2 py-1.5 rounded-sm hover:bg-muted"
                                >
                                    <User className="mr-2 h-3.5 w-3.5" />
                                    Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => navigate('/settings')}
                                    className="cursor-pointer text-sm px-2 py-1.5 rounded-sm hover:bg-muted"
                                >
                                    <Settings className="mr-2 h-3.5 w-3.5" />
                                    Settings
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-border" />
                                <DropdownMenuItem
                                    onClick={handleSignOut}
                                    className="cursor-pointer text-sm px-2 py-1.5 rounded-sm hover:bg-muted text-muted-foreground"
                                >
                                    <LogOut className="mr-2 h-3.5 w-3.5" />
                                    Sign Out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 scroll-smooth">
                    <Outlet />
                </main>
            </SidebarInset>
            <Toaster />
        </div>
    );
}

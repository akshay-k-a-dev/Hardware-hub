import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Wrench,
    ClipboardList,
    FileCheck,
    PlusSquare,
    BookmarkCheck,
    LogOut,
    Bell,
    Search,
    Settings,
    User
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
            <div className="flex h-screen w-full overflow-hidden">
                <Sidebar variant="inset" className="border-r border-border">
                    <SidebarHeader className="flex flex-row items-center gap-2 px-6 py-8">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                            <Wrench size={22} />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-foreground">HardwareHub</span>
                    </SidebarHeader>

                    <SidebarContent className="px-3">
                        <SidebarMenu>
                            {links.map((link) => (
                                <SidebarMenuItem key={link.to}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={location.pathname === link.to}
                                        className="py-6 px-4"
                                    >
                                        <NavLink to={link.to} end={link.to === '/'}>
                                            <span className="mr-3">{link.icon}</span>
                                            <span className="font-medium">{link.label}</span>
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarContent>

                    <SidebarFooter className="p-4 border-t border-border">
                        <div className="flex items-center gap-3 px-2 py-3 mb-2 rounded-lg bg-muted/20 border border-border/10">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shadow-sm">
                                {initial}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-sm font-bold truncate text-foreground">{profile?.name}</span>
                                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">
                                    {profile?.role === 'provider' ? 'Lab Admin' : profile?.role}
                                </span>
                            </div>
                        </div>
                        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleSignOut}>
                            <LogOut size={16} className="mr-3" />
                            Sign Out
                        </Button>
                    </SidebarFooter>
                </Sidebar>

                <SidebarInset className="flex flex-col overflow-hidden">
                    {/* Top Navbar */}
                    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6 shrink-0">
                        <div className="flex items-center gap-4 flex-1">
                            <SidebarTrigger />
                            <div className="relative w-full max-w-md hidden md:block">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search hardware components..."
                                    className="pl-10 h-9 bg-muted/50 border-transparent focus-visible:bg-background transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <NotificationBell />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="rounded-full">
                                        <User size={20} className="text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                        <User className="mr-2 h-4 w-4" /> Profile
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <Settings className="mr-2 h-4 w-4" /> Settings
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                                        <LogOut className="mr-2 h-4 w-4" /> Sign Out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>

                    {/* Main Content Area */}
                    <main className="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-10">
                        <Outlet />
                    </main>
                </SidebarInset>
            </div>
            <Toaster />
        </SidebarProvider>
    );
}

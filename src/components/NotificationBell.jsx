import { useEffect, useState } from 'react';
import { Bell, Check, Clock, Box, Zap, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

export default function NotificationBell() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        // Request permission for system-level notifications
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        fetchNotifications();

        // Subscribe to real-time notifications
        const channel = supabase
            .channel('public:notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    setNotifications((prev) => [payload.new, ...prev]);
                    setUnreadCount((prev) => prev + 1);

                    // 1. In-app Popup (Toast)
                    toast({
                        title: payload.new.title,
                        description: payload.new.message,
                    });

                    // 2. Browser/System Level Notification (Works even if tab is in background)
                    if (Notification.permission === 'granted') {
                        const notification = new Notification(payload.new.title, {
                            body: payload.new.message,
                            icon: '/favicon.ico', // Ensure this exists or use a generic icon URL
                            tag: payload.new.id, // Prevent duplicate notifications
                            requireInteraction: false
                        });

                        notification.onclick = () => {
                            window.focus();
                            notification.close();
                        };
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchNotifications = async () => {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (!error) {
            setNotifications(data || []);
            setUnreadCount(data.filter((n) => !n.is_read).length);
        }
    };

    const markAsRead = async (id) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (!error) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }
    };

    const markAllRead = async () => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (!error) {
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'approval': return <Check className="h-4 w-4 text-emerald-500" />;
            case 'reminder': return <Clock className="h-4 w-4 text-amber-500" />;
            case 'request_update': return <Box className="h-4 w-4 text-blue-500" />;
            default: return <Zap className="h-4 w-4 text-primary" />;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-muted/30 rounded-xl transition-all h-10 w-10">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-black text-white px-1 shadow-sm ring-2 ring-background">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] p-0 rounded-3xl shadow-2xl border-border bg-card overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 bg-muted/20 border-b border-border">
                    <div className="flex items-center gap-2">
                        <DropdownMenuLabel className="p-0 text-lg font-black tracking-tight">Activity Feed</DropdownMenuLabel>
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] font-black px-2">{unreadCount} NEW</Badge>
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={markAllRead}
                            className="h-8 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
                        >
                            Mark All Read
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-[400px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-8 text-center opacity-40">
                            <Bell size={48} className="mb-4 text-muted-foreground/30" />
                            <p className="text-sm font-bold">Your feed is empty.</p>
                            <p className="text-xs font-medium">Any lab activity or status updates will appear here.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={`p-6 border-b border-border/40 hover:bg-muted/30 transition-colors relative group ${!n.is_read ? 'bg-primary/[0.02]' : ''}`}
                                    onClick={() => !n.is_read && markAsRead(n.id)}
                                >
                                    {!n.is_read && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                                    )}
                                    <div className="flex gap-4">
                                        <div className={`mt-1 h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${!n.is_read ? 'bg-background shadow-sm border border-border' : 'bg-muted/40 opacity-60'}`}>
                                            {getIcon(n.type)}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <p className={`text-sm font-black tracking-tight ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    {n.title}
                                                </p>
                                                <span className="text-[10px] font-bold text-muted-foreground italic">
                                                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2">
                                                {n.message}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-3 bg-muted/10">
                    <Button variant="ghost" className="w-full text-xs font-black uppercase tracking-widest py-6 rounded-2xl group border border-transparent hover:border-border hover:bg-background">
                        View All Notifications
                        <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

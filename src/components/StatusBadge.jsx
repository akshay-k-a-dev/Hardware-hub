import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    Clock,
    CheckCircle2,
    PackageCheck,
    History,
    XCircle,
    AlertTriangle
} from 'lucide-react';

const statusConfig = {
    pending: { color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-sm shadow-amber-500/5', icon: Clock, label: 'Pending Approval' },
    approved: { color: 'bg-blue-500/10 text-blue-600 border-blue-500/20 shadow-sm shadow-blue-500/5', icon: CheckCircle2, label: 'Approved' },
    issued: { color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 shadow-sm shadow-indigo-500/5', icon: PackageCheck, label: 'Handed Over' },
    returned: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-sm shadow-emerald-500/5', icon: History, label: 'Returned' },
    rejected: { color: 'bg-destructive/5 text-destructive border-destructive/10 shadow-sm', icon: XCircle, label: 'Rejected' },
    cancelled: { color: 'bg-muted/40 text-muted-foreground border-border shadow-sm', icon: XCircle, label: 'Cancelled' },
    overdue: { color: 'bg-red-500/10 text-red-600 border-red-500/20 shadow-md shadow-red-500/10 animate-pulse', icon: AlertTriangle, label: 'Overdue!' },
    available: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-sm shadow-emerald-500/5', icon: CheckCircle2, label: 'In Lab (Ready)' },
    borrowed: { color: 'bg-purple-500/10 text-purple-600 border-purple-500/20 shadow-sm shadow-purple-500/5', icon: PackageCheck, label: 'Borrowed' },
};

export default function StatusBadge({ status, className }) {
    const s = status?.toLowerCase() || 'pending';
    const config = statusConfig[s] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                "font-black text-[10px] uppercase tracking-widest flex items-center gap-2 w-fit h-7 px-3 rounded-xl border transition-all duration-300",
                config.color,
                className
            )}
        >
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}

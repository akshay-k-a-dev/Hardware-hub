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
    pending: { color: 'bg-yellow-500/5 text-yellow-700 border-yellow-200', icon: Clock, label: 'Pending Approval' },
    approved: { color: 'bg-foreground/5 text-foreground border-border', icon: CheckCircle2, label: 'Approved' },
    issued: { color: 'bg-foreground/5 text-foreground border-border', icon: PackageCheck, label: 'In Possession' },
    returned: { color: 'bg-muted text-muted-foreground border-border', icon: History, label: 'Returned' },
    rejected: { color: 'bg-destructive/5 text-destructive border-destructive/10', icon: XCircle, label: 'Rejected' },
    cancelled: { color: 'bg-muted text-muted-foreground border-border', icon: XCircle, label: 'Cancelled' },
    overdue: { color: 'bg-destructive/10 text-destructive border-destructive/20 font-black', icon: AlertTriangle, label: 'Overdue!' },
    available: { color: 'bg-yellow-500/5 text-yellow-700 border-yellow-200', icon: CheckCircle2, label: 'In Lab (Ready)' },
    borrowed: { color: 'bg-foreground/5 text-foreground border-border', icon: PackageCheck, label: 'Borrowed' },
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

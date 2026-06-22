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
    pending: { color: 'bg-amber-500/15 text-amber-500 border-amber-500/20', icon: Clock, label: 'Pending' },
    approved: { color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20', icon: CheckCircle2, label: 'Approved' },
    issued: { color: 'bg-blue-500/15 text-blue-500 border-blue-500/20', icon: PackageCheck, label: 'Issued' },
    returned: { color: 'bg-slate-500/15 text-slate-500 border-slate-500/20', icon: History, label: 'Returned' },
    rejected: { color: 'bg-rose-500/15 text-rose-500 border-rose-500/20', icon: XCircle, label: 'Rejected' },
    cancelled: { color: 'bg-slate-500/15 text-slate-500 border-slate-500/20', icon: XCircle, label: 'Cancelled' },
    overdue: { color: 'bg-rose-500/20 text-rose-600 border-rose-500/30 font-bold animate-pulse', icon: AlertTriangle, label: 'Overdue' },
    available: { color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20', icon: CheckCircle2, label: 'Available' },
    borrowed: { color: 'bg-blue-500/15 text-blue-500 border-blue-500/20', icon: PackageCheck, label: 'Borrowed' },
};

export default function StatusBadge({ status, className }) {
    const s = status?.toLowerCase() || 'pending';
    const config = statusConfig[s] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                "font-semibold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 w-fit h-7 px-5 rounded-full border transition-all duration-300 leading-none backdrop-blur-sm",
                config.color,
                className
            )}
        >
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}

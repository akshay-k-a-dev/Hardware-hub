import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cpu, ArrowRight, BookmarkCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_CONFIG = {
    available: { label: 'In Stock', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    out_of_stock: { label: 'Out of Stock', className: 'bg-red-50 text-red-600 border-red-200' },
    deactivated: { label: 'Unavailable', className: 'bg-muted text-muted-foreground border-border' },
};

export default function ComponentCard({ item = {}, onClick }) {
    const { id, name, category, image_url, description, quantity_available, owner, is_active } = item;

    const isOutOfStock = quantity_available === 0;
    const isDeactivated = is_active === false;

    const statusKey = isDeactivated ? 'deactivated' : isOutOfStock ? 'out_of_stock' : 'available';
    const status = STATUS_CONFIG[statusKey];

    const handleClick = (e) => {
        if (onClick) {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <Link to={`/components/${id}`} onClick={handleClick} className="group block focus-visible:outline-none">
            <Card className="h-full flex flex-col border border-border bg-card hover:bg-white hover:border-rose-500/20 hover:shadow-xl hover:shadow-rose-500/5 transition-all duration-300 rounded-sm overflow-hidden relative group-hover:-translate-y-1">

                {/* Product Image */}
                <div className="relative aspect-square sm:aspect-[4/3] overflow-hidden bg-muted/20 border-b border-border/40 group-hover:bg-muted/10 transition-colors">
                    {image_url ? (
                        <img
                            src={image_url}
                            alt={name}
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-20">
                            <Cpu className="h-8 w-8 text-foreground" />
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div className="flex flex-col flex-1 p-3.5 gap-2">
                    {/* Title */}
                    <h3 className="text-[11px] font-black text-foreground tracking-widest line-clamp-1 group-hover:text-rose-600 transition-colors uppercase">
                        {name}
                    </h3>
                    
                    {/* Category & Lab */}
                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-black uppercase tracking-tighter truncate opacity-80">
                        <span>{category}</span>
                        {(owner?.lab_name || item.location) && (
                            <>
                                <span>•</span>
                                <span className="truncate">{owner?.lab_name || item.location}</span>
                            </>
                        )}
                    </div>

                    {/* Status + Units */}
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/30">
                        <Badge
                            variant="outline"
                            className={`text-[8px] font-black uppercase tracking-[0.1em] h-5 px-2 rounded-sm border-none shadow-none ${statusKey === 'available' ? 'bg-yellow-500/10 text-yellow-700' : 'bg-muted text-muted-foreground'}`}
                        >
                            {status.label}
                        </Badge>
                        {!isDeactivated && (
                            <span className="text-[10px] font-black text-foreground/40 tabular-nums uppercase tracking-widest">
                                {quantity_available > 0 ? `${quantity_available} Qty` : 'N/A'}
                            </span>
                        )}
                    </div>

                    {/* CTA */}
                    <Button
                        variant="default"
                        size="sm"
                        className="w-full h-8 mt-1.5 text-[9px] font-black uppercase tracking-[0.2em] bg-foreground text-background hover:bg-rose-600 focus:bg-rose-600 transition-all duration-300 rounded-sm shadow-sm"
                        tabIndex={-1}
                    >
                        {isOutOfStock ? 'Waitlist' : 'Request'}
                    </Button>
                </div>
            </Card>
        </Link>
    );
}

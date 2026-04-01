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
        <Link to={`/components/${id}`} onClick={handleClick} className="group block h-full">
            <Card className="h-full flex flex-col border border-border bg-card hover:shadow-md hover:border-foreground/20 transition-all duration-200 rounded-md overflow-hidden">

                {/* Product Image */}
                <div className="relative aspect-[4/3] overflow-hidden bg-muted/30 border-b border-border">
                    {image_url ? (
                        <img
                            src={image_url}
                            alt={name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted/20">
                            <Cpu className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                    )}

                    {/* Category Badge */}
                    <div className="absolute top-2 left-2">
                        <Badge
                            variant="secondary"
                            className="text-[10px] font-bold uppercase tracking-widest bg-background/90 backdrop-blur-sm text-foreground border border-border/60 py-0.5 px-2 rounded-sm shadow-sm"
                        >
                            {category}
                        </Badge>
                    </div>

                    {/* Out of Stock / Pre-book overlay */}
                    {isOutOfStock && !isDeactivated && (
                        <div className="absolute bottom-0 inset-x-0 bg-background/80 backdrop-blur-sm py-2 px-3 flex items-center gap-1.5 border-t border-border/60">
                            <BookmarkCheck className="h-4 w-4 text-foreground shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Pre-book Available</span>
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div className="flex flex-col flex-1 p-4 gap-3">
                    {/* Name */}
                    <div>
                        <h3 className="text-base font-bold text-foreground tracking-tight line-clamp-1 group-hover:text-foreground">
                            {name}
                        </h3>
                        <p className="text-xs text-muted-foreground font-medium mt-1 line-clamp-2 leading-relaxed">
                            {description || 'Hardware component for research and development.'}
                        </p>
                    </div>

                    {/* Status + Units */}
                    <div className="flex items-center justify-between mt-auto pt-2">
                        <Badge
                            variant="outline"
                            className={`text-[10px] font-bold uppercase tracking-widest h-6 px-2 rounded-sm border ${status.className}`}
                        >
                            {status.label}
                        </Badge>
                        {!isDeactivated && (
                            <span className="text-xs font-bold text-muted-foreground">
                                {quantity_available} units
                            </span>
                        )}
                    </div>

                    {/* Lab */}
                    {owner?.lab_name && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate border-t border-border pt-2">
                            {owner.lab_name}
                        </p>
                    )}

                    {/* CTA */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-9 text-xs font-bold uppercase tracking-widest border-border rounded-sm group-hover:bg-foreground group-hover:text-background group-hover:border-foreground transition-all duration-200 mt-1"
                        tabIndex={-1}
                    >
                        {isOutOfStock ? 'Pre-Book' : 'View Details'}
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                </div>
            </Card>
        </Link>
    );
}

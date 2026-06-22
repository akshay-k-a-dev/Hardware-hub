import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cpu, Zap, BookmarkCheck, Edit3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import EditComponentModal from './EditComponentModal';

const STATUS_CONFIG = {
    available: { label: 'In Stock', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    out_of_stock: { label: 'Out of Stock', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    deactivated: { label: 'Unavailable', color: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-border' },
};

export default function ComponentCard({ item = {}, onClick, onUpdate }) {
    const { id, name, category, image_url, quantity_available, quantity_total, owner, is_active } = item;
    const { profile } = useAuth();
    const [editOpen, setEditOpen] = useState(false);
    const isOwner = profile?.id === owner?.id;

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

    const [imgError, setImgError] = useState(false);

    return (
        <>
            <Link to={`/components/${id}`} onClick={handleClick} className="group block focus-visible:outline-none">
                {/* 
                * CLEANER CARD DESIGN:
                * - Increased surface contrast (bg-zinc-900/40)
                * - Subtle elevation and border
                * - No stock label overlay on image
                */}
                <Card className="h-full flex flex-col border border-border/30 bg-card/40 backdrop-blur-xl hover:bg-card/80 hover:border-foreground/20 hover:shadow-2xl transition-all duration-500 rounded-3xl md:rounded-[var(--card-radius)] overflow-hidden relative group-hover:-translate-y-1">


                    {/* Product Image - Product Centric on Mobile */}
                    <div className="relative aspect-square md:aspect-[16/10] overflow-hidden bg-muted/20 border-b border-border/10 group-hover:bg-muted/30 transition-colors">
                        {image_url && !imgError ? (
                            <img
                                src={image_url}
                                alt={name}
                                className="w-full h-full object-contain transition-transform duration-1000 group-hover:scale-105"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-20 bg-zinc-950/20">
                                <Cpu className="h-12 w-12 text-foreground animate-pulse" />
                            </div>
                        )}
                    </div>

                    {/* Edit Button for Providers */}
                    {isOwner && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditOpen(true);
                            }}
                            className="absolute top-4 right-4 h-9 w-9 rounded-xl bg-card border-border hover:bg-foreground hover:text-background z-20 transition-all opacity-0 group-hover:opacity-100 shadow-xl"
                        >
                            <Edit3 className="h-4 w-4" />
                        </Button>
                    )}

                    {/* Product Info */}
                    <div className="flex flex-col flex-1 p-3 sm:p-5 gap-2 md:gap-3">
                        <div className="space-y-1 md:space-y-1.5">
                            {/* Category & Lab */}
                            <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em] md:tracking-[0.2em]">
                                {item.is_high_value && (
                                    <Badge variant="outline" className="text-[7px] h-4 px-1 border-amber-500 text-amber-600 bg-amber-500/10 tracking-widest font-black uppercase shrink-0 rounded-sm">
                                        Expensive
                                    </Badge>
                                )}
                                <span className="truncate">{category}</span>
                                {(owner?.lab_name || item.location) && (
                                    <>
                                        <span className="h-1 w-1 rounded-full bg-border shrink-0" />
                                        <span className="truncate md:max-w-none max-w-[50px]">{owner?.lab_name || item.location}</span>
                                    </>
                                )}
                            </div>


                            {/* Title & Stock Status — ALIGNED HORIZONTAL LAYOUT */}
                            <div className="flex flex-col gap-0.5 md:gap-1">
                                <h3 className="text-xs md:text-sm font-bold text-foreground tracking-tight line-clamp-2 md:line-clamp-1 group-hover:text-primary transition-colors font-inter-tight leading-none min-h-0">
                                    {name}
                                </h3>
                                <div className={`flex items-center gap-1 text-[8px] md:text-[9px] font-black uppercase tracking-wider ${status.color}`}>
                                    <span className={`h-1 w-1 md:h-1.5 md:w-1.5 rounded-full ${status.bg.replace('/10', '')} animate-pulse`} />
                                    {status.label}
                                </div>
                            </div>
                        </div>


                        {/* Action Row — FULL WIDTH BUTTON ON MOBILE */}
                        <div className="mt-auto pt-3 md:pt-4 border-t border-white/[0.05] flex items-center justify-between gap-3">
                            {isDeactivated ? (
                                <Button disabled className="w-full h-10 md:h-11 rounded-2xl md:rounded-2xl bg-muted text-muted-foreground border border-border font-bold uppercase text-[9px] md:text-[10px] tracking-widest">
                                    Deactivated
                                </Button>
                            ) : isOutOfStock ? (
                                <Button className="w-full h-10 md:h-11 rounded-lg md:rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-black font-bold uppercase text-[9px] md:text-[10px] tracking-widest transition-all duration-300">
                                    <BookmarkCheck className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-2" />
                                    <span className="hidden sm:inline">Join Waitlist</span>
                                    <span className="sm:hidden">Waitlist</span>
                                </Button>
                            ) : (
                                <Button className="w-full h-10 md:h-11 rounded-lg md:rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold uppercase text-[10px] tracking-widest transition-all duration-300 shadow-xl shadow-foreground/5">
                                    Request
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>
            </Link>

            <EditComponentModal 
                item={item} 
                open={editOpen} 
                onOpenChange={setEditOpen} 
                onSave={() => onUpdate && onUpdate()} 
            />
        </>
    );
}

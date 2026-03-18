import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Cpu,
    Layers,
    ArrowRight,
    Box,
    Zap,
    ShieldCheck,
    ArrowRightCircle,
    MapPin,
    Package,
    BookmarkCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ComponentCard({ item = {} }) {
    const { id, name, category, image_url, description, quantity_available, owner } = item;
    const isOutOfStock = quantity_available === 0;

    return (
        <Link to={`/components/${id}`} className="group block h-full">
            <Card className="h-full border border-border bg-card hover:border-primary/40 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-3xl md:rounded-[2.5rem] overflow-hidden group/card relative flex flex-col">

                {/* Visual Header / Image */}
                <div className="relative h-40 md:h-56 overflow-hidden">
                    {image_url ? (
                        <img
                            src={image_url}
                            alt={name}
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover/card:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted/20 to-muted/5 flex items-center justify-center relative overflow-hidden">
                            <Box size={60} className="text-muted-foreground/10 absolute -bottom-4 -right-4 rotate-12 group-hover/card:scale-125 transition-transform duration-700" />
                            <Cpu size={32} className="text-primary/20 group-hover/card:text-primary/40 transition-colors" />
                        </div>
                    )}

                    {/* Overlay Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5 md:gap-2">
                        <Badge variant="secondary" className="bg-background/80 backdrop-blur-md text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-border/40 py-1 px-2 md:py-1.5 md:px-3 shadow-sm group-hover/card:bg-primary group-hover/card:text-primary-foreground group-hover/card:border-primary transition-all">
                            {category}
                        </Badge>
                        {item.is_active === false && (
                            <Badge variant="destructive" className="bg-amber-500 hover:bg-amber-600 text-[8px] md:text-[10px] font-black uppercase tracking-widest py-1 px-2 md:py-1.5 md:px-3 text-white border-0">
                                Deactivated
                            </Badge>
                        )}
                        {isOutOfStock && (
                            <>
                                <Badge variant="destructive" className="text-[8px] md:text-[10px] font-black uppercase tracking-widest py-1 px-2 md:py-1.5 md:px-3">
                                    Out of Stock
                                </Badge>
                                <Badge className="bg-amber-500/90 text-white border-0 text-[8px] md:text-[10px] font-black uppercase tracking-widest py-1 px-2 md:py-1.5 md:px-3 flex items-center gap-1">
                                    <BookmarkCheck size={10} />
                                    Pre-Book Available
                                </Badge>
                            </>
                        )}
                    </div>

                    {/* Lab Branding Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 translate-y-full group-hover/card:translate-y-0 transition-transform duration-500 bg-gradient-to-t from-black/60 to-transparent">
                        <div className="flex items-center gap-2 text-white/90">
                            <MapPin size={10} className="text-primary" />
                            <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest">
                                Hosted by {owner?.lab_name || owner?.name || 'Lab'}
                            </span>
                        </div>
                    </div>
                </div>

                <CardContent className="p-5 md:p-8 pb-3 md:pb-4 flex-1 flex flex-col relative">
                    {/* Header Info */}
                    <div className="mb-3 md:mb-4">
                        <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight line-clamp-1 group-hover/card:text-primary transition-colors">
                            {name}
                        </h3>
                        <div className="flex items-center gap-3 md:gap-4 mt-1.5 md:mt-2">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Package size={12} className="text-primary/60" />
                                <span className="text-[10px] md:text-xs font-bold">{quantity_available} Units</span>
                            </div>
                            <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <ShieldCheck size={12} className="text-emerald-500/60" />
                                <span className="text-[10px] md:text-xs font-bold">Verified</span>
                            </div>
                        </div>
                    </div>

                    {/* Description excerpt */}
                    <p className="text-xs md:text-sm text-muted-foreground/80 font-medium leading-relaxed line-clamp-2 border-l-2 border-border/60 pl-3 md:pl-4 my-1.5 md:my-2 group-hover/card:border-primary/40 transition-all">
                        {description || "High-performance lab equipment reserved for experimental and research development."}
                    </p>
                </CardContent>

                <CardFooter className="p-5 md:p-8 pt-0 mt-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-10 md:h-12 rounded-xl md:rounded-2xl bg-primary/5 border border-primary/10 hover:bg-primary hover:text-primary-foreground text-[10px] md:text-xs font-black uppercase tracking-widest transition-all duration-300"
                    >
                        Explore Details
                        <ArrowRightCircle size={14} className="ml-2 group-hover/card:translate-x-2 transition-transform" />
                    </Button>
                </CardFooter>

                {/* Micro-glow effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none" />
            </Card>
        </Link>
    );
}

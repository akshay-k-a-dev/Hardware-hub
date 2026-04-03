import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Box, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AddComponentModal from '@/components/AddComponentModal';

export default function AddComponent() {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <header className="flex items-center gap-4 max-w-[1400px] mx-auto w-full px-4 md:p-6 lg:px-0 pt-8 md:pt-12">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-2xl bg-card border border-border/40 hover:bg-muted/50 hover:border-border transition-all shrink-0 shadow-sm group"
                    onClick={() => navigate('/components')}
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                </Button>
                <div className="flex flex-col gap-1.5">
                    <h1 className="text-xl md:text-2xl font-black tracking-tighter text-foreground uppercase tracking-widest leading-none font-inter-tight">Add to Lab</h1>
                    <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-[0.15em] opacity-40">Register new components or boards for the community.</p>
                </div>
            </header>

            <div className="pb-24 max-w-[1400px] mx-auto w-full px-4 md:px-6 lg:px-0 flex flex-col pt-12">
                <div className="p-4 sm:p-5 border border-border/50 bg-card/60 backdrop-blur-xl rounded-[var(--card-radius)] max-w-[280px] w-full group hover:bg-card/80 hover:border-foreground/20 hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col items-center text-center">
                    <div className="h-16 w-16 rounded-2xl bg-foreground text-background mb-6 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                        <Plus size={24} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-2">Add New Hardware</h3>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-8 leading-relaxed opacity-60">Fill in the details to add new hardware</p>
                    
                    <Button 
                        size="sm" 
                        onClick={() => setIsModalOpen(true)}
                        className="w-full h-10 bg-foreground text-background hover:bg-foreground/90 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-foreground/5"
                    >
                        Add Component
                    </Button>
                </div>
            </div>

            <AddComponentModal 
                open={isModalOpen} 
                onOpenChange={setIsModalOpen} 
            />
        </div>
    );
}

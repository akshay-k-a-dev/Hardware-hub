import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AddComponentForm from '@/components/AddComponentForm';

export default function AddComponent() {
    const navigate = useNavigate();

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 p-2 md:p-0">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="group h-12 px-6 rounded-2xl bg-card border border-border hover:bg-primary/5 hover:border-primary/20 hover:text-primary font-black text-xs uppercase tracking-widest transition-all shadow-sm"
                    onClick={() => navigate('/components')}
                >
                    <ArrowLeft className="h-4 w-4 mr-3 transition-transform group-hover:-translate-x-2" />
                    Back to Lab
                </Button>
            </header>

            <div className="flex items-center gap-5 px-1">
                <div className="h-16 w-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Box size={32} />
                </div>
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-1">Add to Lab</h1>
                    <p className="text-muted-foreground text-lg font-medium">Register new components or boards for students to use.</p>
                </div>
            </div>

            <AddComponentForm />
        </div>
    );
}

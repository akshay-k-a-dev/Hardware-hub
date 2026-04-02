import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { User, ShieldCheck, MapPin, CheckCircle2, History, AlertTriangle, Save, Loader2 } from 'lucide-react';

export default function Profile() {
    const { profile: authProfile, user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        full_name: '',
        bio: '',
        city: '',
        avatar_url: '',
        community_association: 'No',
        community_name: '',
        tinkerhub_id: '',
        academic_role: 'Student',
        college_name: ''
    });

    useEffect(() => {
        if (user?.id) {
            fetchProfileData();
        } else {
            setLoading(false);
        }
    }, [user?.id]);

    const fetchProfileData = async () => {
        try {
            setLoading(true);
            const { data: profileData, error } = await supabase.rpc('get_user_profile', {
                p_user_id: user.id
            });

            if (error) throw error;
            
            setData(profileData);
            setEditForm({
                full_name: profileData.full_name || profileData.name || '',
                bio: profileData.bio || '',
                city: profileData.city || '',
                avatar_url: profileData.avatar_url || '',
                community_association: profileData.community_association || 'No',
                community_name: profileData.community_name || '',
                tinkerhub_id: profileData.tinkerhub_id || '',
                academic_role: profileData.academic_role || 'Student',
                college_name: profileData.college_name || ''
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
            toast({
                title: "Error loading profile",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editForm.full_name.trim()) {
            toast({ title: "Validation Error", description: "Full name is required.", variant: "destructive" });
            return;
        }

        if (editForm.bio && editForm.bio.length > 160) {
            toast({ title: "Validation Error", description: "Bio must be 160 characters or less.", variant: "destructive" });
            return;
        }

        if ((editForm.academic_role === 'Student' || editForm.academic_role === 'Teacher') && !editForm.college_name?.trim()) {
            toast({ title: "Validation Error", description: "College Name is required.", variant: "destructive" });
            return;
        }

        try {
            setSaving(true);
            const { error } = await supabase.rpc('update_user_profile', {
                p_full_name: editForm.full_name,
                p_bio: editForm.bio,
                p_city: editForm.city,
                p_avatar_url: editForm.avatar_url,
                p_skills: [],
                p_community_association: editForm.community_association,
                p_community_name: editForm.community_name,
                p_tinkerhub_id: editForm.tinkerhub_id,
                p_academic_role: editForm.academic_role,
                p_college_name: editForm.college_name
            });

            if (error) throw error;

            toast({
                title: "Profile Saved",
                description: "Your profile has been updated successfully."
            });
            setIsEditing(false);
            await fetchProfileData();
        } catch (error) {
            console.error('Error saving profile:', error);
            toast({
                title: "Error saving profile",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    if (!data) return null;

    const { trust, profile_completed } = data;
    const bandColors = {
        trusted: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20',
        caution: 'bg-amber-500/10 text-amber-600 ring-amber-500/20',
        blocked: 'bg-rose-500/10 text-rose-600 ring-rose-500/20'
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            <h1 className="text-3xl font-black tracking-tight text-foreground">User Profile</h1>

            {!profile_completed && !isEditing && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-4 ring-1 ring-primary/10">
                    <AlertTriangle className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-primary">Profile Incomplete</h3>
                        <p className="text-sm text-muted-foreground mt-1">Complete your full name, bio, and city to finish setting up your account.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Complete Now</Button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Left Column: Identity */}
                <Card className="md:col-span-2 shadow-sm border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {data.is_verified_email ? (
                                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Email Verified</Badge>
                            ) : (
                                <Badge variant="outline" className="text-xs border-dashed gap-1">Unverified Email</Badge>
                            )}
                        </div>
                        {!isEditing && (
                            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>Edit Profile</Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col sm:flex-row items-start gap-6">
                            <div className="relative">
                                <div className="h-24 w-24 rounded-2xl bg-muted/50 border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                                    {data.avatar_url ? (
                                        <img src={data.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="h-10 w-10 text-muted-foreground/50" />
                                    )}
                                </div>
                                {isEditing && (
                                    <div className="absolute -bottom-2 -right-2 bg-background p-1 rounded-lg border shadow-sm">
                                        <div className="bg-primary/10 p-1.5 rounded-md text-primary">
                                            <Save className="w-3 h-3" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 w-full space-y-4">
                                {isEditing ? (
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name</label>
                                            <Input 
                                                value={editForm.full_name} 
                                                onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                                                placeholder="e.g. Ada Lovelace"
                                                className="font-medium h-10 bg-background"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">City</label>
                                                <Input 
                                                    value={editForm.city} 
                                                    onChange={e => setEditForm({...editForm, city: e.target.value})}
                                                    placeholder="San Francisco, CA"
                                                    className="bg-background"
                                                    icon={<MapPin className="w-4 h-4" />}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avatar URL</label>
                                                <Input 
                                                    value={editForm.avatar_url} 
                                                    onChange={e => setEditForm({...editForm, avatar_url: e.target.value})}
                                                    placeholder="https://..."
                                                    className="bg-background"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                                            {data.full_name || data.name}
                                            <Badge variant="secondary" className={`capitalize ring-1 ${bandColors[trust?.band || 'trusted']}`}>
                                                {trust?.band || 'Trusted'}
                                            </Badge>
                                        </h2>
                                        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                                            <MapPin className="h-4 w-4 opacity-70" />
                                            {data.city || 'No city specified'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-border/40">
                            {isEditing ? (
                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bio</label>
                                            <span className={`text-xs ${editForm.bio.length > 160 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                                {editForm.bio.length}/160
                                            </span>
                                        </div>
                                        <Textarea 
                                            value={editForm.bio} 
                                            onChange={e => setEditForm({...editForm, bio: e.target.value})}
                                            placeholder="Engineering student focusing on embedded systems..."
                                            className="resize-none h-24 bg-background"
                                        />
                                    </div>
                                    <div className="pt-4 border-t border-border/40 mt-4">
                                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">Community Details</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Associated with community?</label>
                                                <select 
                                                    value={editForm.community_association}
                                                    onChange={e => setEditForm({...editForm, community_association: e.target.value})}
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                >
                                                    <option value="No">No</option>
                                                    <option value="Yes">Yes</option>
                                                </select>
                                            </div>
                                            
                                            {editForm.community_association === 'Yes' && (
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Community Name</label>
                                                    <select 
                                                        value={editForm.community_name}
                                                        onChange={e => setEditForm({...editForm, community_name: e.target.value})}
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                    >
                                                        <option value="">Select Community</option>
                                                        <option value="TinkerHub">TinkerHub</option>
                                                        <option value="IEEE">IEEE</option>
                                                        <option value="IEDC">IEDC</option>
                                                        <option value="GDSC">GDSC</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        {editForm.community_association === 'Yes' && editForm.community_name === 'TinkerHub' && (
                                            <div className="mt-4 space-y-1.5">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">TinkerHub ID</label>
                                                <Input 
                                                    value={editForm.tinkerhub_id}
                                                    onChange={e => setEditForm({...editForm, tinkerhub_id: e.target.value})}
                                                    placeholder="TinkerHub ID"
                                                    className="bg-background"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-border/40 mt-4">
                                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">Academic Details</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</label>
                                                <select 
                                                    value={editForm.academic_role}
                                                    onChange={e => setEditForm({...editForm, academic_role: e.target.value})}
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                >
                                                    <option value="Student">Student</option>
                                                    <option value="Teacher">Teacher</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            
                                            {(editForm.academic_role === 'Student' || editForm.academic_role === 'Teacher') && (
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                                                        <span>College Name</span>
                                                        <span className="text-destructive">*</span>
                                                    </label>
                                                    <Input 
                                                        value={editForm.college_name}
                                                        onChange={e => setEditForm({...editForm, college_name: e.target.value})}
                                                        placeholder="e.g. Model Engineering College"
                                                        className="bg-background"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">About</h4>
                                    <p className="text-sm leading-relaxed text-foreground/80">
                                        {data.bio || <span className="italic text-muted-foreground">No bio provided.</span>}
                                    </p>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 mt-6 pt-4 border-t border-border/40">
                                        <div>
                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Academic Role</h4>
                                            <p className="text-sm font-medium">{data.academic_role || 'Not specified'}</p>
                                        </div>
                                        {data.college_name && (
                                            <div>
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">College</h4>
                                                <p className="text-sm font-medium">{data.college_name}</p>
                                            </div>
                                        )}
                                        {data.community_association === 'Yes' && (
                                            <div>
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Community</h4>
                                                <p className="text-sm font-medium">{data.community_name || 'Associated'} {data.community_name === 'TinkerHub' && data.tinkerhub_id && `(ID: ${data.tinkerhub_id})`}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {isEditing && (
                            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Profile
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right Column: Trust & Integrity */}
                <div className="space-y-6">
                    <Card className="shadow-sm border-border/50 bg-gradient-to-b from-card/80 to-card/30 backdrop-blur-sm overflow-hidden relative">
                        {/* Decorative background glow based on band */}
                        <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none
                            ${trust?.band === 'trusted' ? 'bg-emerald-500' : trust?.band === 'caution' ? 'bg-amber-500' : 'bg-rose-500'}`} 
                        />
                        
                        <CardHeader className="pb-3 relative">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <ShieldCheck className="w-5 h-5 text-primary" />
                                Trust Score
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 relative">
                            <div className="flex flex-col items-center justify-center py-4 text-center border-b border-border">
                                <span className="text-5xl font-black tracking-tighter tabular-nums drop-shadow-sm">
                                    {trust?.score || 100}
                                </span>
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">out of 100</span>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground flex items-center gap-2"><History className="w-4 h-4" /> Total Borrows</span>
                                    <span className="font-bold">{trust?.total_borrows || 0}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">On-Time Returns</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{trust?.on_time_returns || 0}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Late Returns</span>
                                    <span className="font-bold text-amber-600 dark:text-amber-400">{trust?.late_returns || 0}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import { Cpu } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Components from './pages/Components';
import ComponentDetail from './pages/ComponentDetail';
import MyRequests from './pages/MyRequests';
import MyPreBooks from './pages/MyPreBooks';
import ManageRequests from './pages/ManageRequests';
import AddComponent from './pages/AddComponent';
import ResetPassword from './pages/ResetPassword';
import Debug from './pages/Debug';
import Profile from './pages/Profile';

export default function App() {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 font-sans p-6 overflow-hidden relative">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[150px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[120px]" />
                </div>

                <div className="relative z-10 space-y-8 flex flex-col items-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-[2.5rem] blur-2xl animate-pulse scale-150" />
                        <div className="relative bg-card border border-border/60 p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-1000 ring-1 ring-border/20">
                            <div className="p-4 rounded-3xl bg-primary/10 text-primary ring-1 ring-primary/30">
                                <Cpu className="h-16 w-16" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 text-center">
                        <h1 className="text-4xl font-black tracking-tight text-foreground animate-in slide-in-from-bottom-4 duration-1000">HardwareHub</h1>
                        <div className="flex flex-col items-center gap-4">
                            <p className="text-muted-foreground font-semibold text-lg tracking-tight">Initializing Laboratory Systems</p>
                            <div className="flex items-center gap-2.5">
                                <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                                <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                                <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/debug" element={<Debug />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/components" element={<Components />} />
                    <Route path="/components/:id" element={<ComponentDetail />} />
                    <Route path="/my-requests" element={<MyRequests />} />
                    <Route path="/my-prebooks" element={<MyPreBooks />} />
                    <Route path="/manage-requests" element={<ManageRequests />} />
                    <Route path="/add-component" element={<AddComponent />} />
                    <Route path="/profile" element={<Profile />} />
                </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

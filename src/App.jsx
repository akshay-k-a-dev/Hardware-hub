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
import Settings from './pages/Settings';

export default function App() {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background font-sans">
                <div className="flex flex-col items-center gap-4">
                    <div className="p-3 border border-border bg-foreground text-background">
                        <Cpu className="h-8 w-8" />
                    </div>
                    <h1 className="text-base font-bold tracking-tight text-foreground">HardwareHub</h1>
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                        <div className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                        <div className="h-1.5 w-1.5 rounded-full bg-foreground animate-bounce" />
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
                    {/* Hardware Lab is now the default landing page */}
                    <Route path="/" element={<Components />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/components" element={<Components />} />
                    <Route path="/components/:id" element={<ComponentDetail />} />
                    <Route path="/my-requests" element={<MyRequests />} />
                    <Route path="/my-prebooks" element={<MyPreBooks />} />
                    <Route path="/manage-requests" element={<ManageRequests />} />
                    <Route path="/add-component" element={<AddComponent />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

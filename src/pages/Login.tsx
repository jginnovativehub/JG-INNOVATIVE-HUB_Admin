import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import Loader from '@/components/admin/Loader';
import { ADMIN_LOGO } from '@/constants/media';

const Login: React.FC = () => {
  const { login, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (authLoading) {
    return <Loader fullScreen text="Checking authentication..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (email.trim().toLowerCase() !== 'admin@inovative-hub.com') {
      setError('Invalid email or password');
      return;
    }

    setIsLoading(true);

    try {
      const response = await login({ email, password });
      
      if (response.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setError(response.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-12"
        style={{ background: 'var(--gradient-sidebar)' }}
      >
        <div className="max-w-md text-center">
          <div className="flex items-center justify-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-white p-2 shadow-md ring-1 ring-black/10 flex items-center justify-center overflow-hidden">
              <img src={ADMIN_LOGO} alt="Innovative Hub" className="max-h-full max-w-full w-auto object-contain" width={455} height={538} />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-sidebar-foreground mb-4">
            Innovative Hub
          </h1>
          <p className="text-lg text-sidebar-muted">
            Admin Panel for managing your e-commerce and innovation platform
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">150+</p>
              <p className="text-sm text-sidebar-muted">Products</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">2.5K+</p>
              <p className="text-sm text-sidebar-muted">Users</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">₹5L+</p>
              <p className="text-sm text-sidebar-muted">Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/10 flex items-center justify-center overflow-hidden shrink-0">
                <img src={ADMIN_LOGO} alt="" className="max-h-full max-w-full object-contain" width={455} height={538} />
              </div>
              <span className="text-xl font-bold text-foreground">Innovative Hub</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground">Welcome to Innovative Hub Admin Panel</h2>
            <p className="text-muted-foreground mt-2">Sign in to access your admin dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-field pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader size="sm" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            © 2025 Innovative Hub. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

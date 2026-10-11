import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { authApi, LoginCredentials, LoginResponse } from '@/services/adminApi';

interface Admin {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AdminAuthContextType {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

interface AdminAuthProviderProps {
  children: ReactNode;
}

export const AdminAuthProvider: React.FC<AdminAuthProviderProps> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const isValid = await authApi.verifyToken();
        if (isValid) {
          const storedAdmin = localStorage.getItem('adminData');
          if (storedAdmin) {
            const parsed = JSON.parse(storedAdmin);
            if (parsed?.email?.toLowerCase() === 'admin@inovative-hub.com') {
              setAdmin(parsed);
            } else {
              await authApi.logout();
              setAdmin(null);
            }
          } else {
            const res = await authApi.getAdminProfile();
            const adminProfile = res?.admin || res?.data?.admin || res?.data || null;
            if (adminProfile && adminProfile.email?.toLowerCase() === 'admin@inovative-hub.com') {
              setAdmin(adminProfile);
              localStorage.setItem('adminData', JSON.stringify(adminProfile));
            } else {
              await authApi.logout();
              setAdmin(null);
            }
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<LoginResponse> => {
    if (credentials.email?.trim().toLowerCase() !== 'admin@inovative-hub.com') {
      return {
        success: false,
        message: 'Invalid email or password',
      };
    }

    const response = await authApi.login(credentials);

    let adminUser = response.admin ?? null;
    if (response.success && response.token && !adminUser) {
      try {
        const res = await authApi.getAdminProfile();
        const raw = (res as { admin?: unknown; data?: { admin?: unknown } })?.admin
          ?? (res as { data?: { admin?: unknown } })?.data?.admin
          ?? (res as { data?: unknown })?.data;
        if (raw && typeof raw === 'object' && raw !== null) {
          const r = raw as Record<string, unknown>;
          const id = r.id ?? r._id;
          if (id != null) {
            adminUser = {
              id: String(id),
              name: typeof r.name === 'string' ? r.name : '',
              email: typeof r.email === 'string' ? r.email : '',
              role: typeof r.role === 'string' ? r.role : 'admin',
            };
          }
        }
      } catch {
        /* profile fetch failed; stay logged out below */
      }
    }

    const resolved = adminUser ?? null;
    if (response.success && resolved) {
      if (resolved.email?.toLowerCase() !== 'admin@inovative-hub.com') {
        await authApi.logout();
        return {
          success: false,
          message: 'Invalid email or password',
        };
      }

      flushSync(() => {
        setAdmin(resolved);
        localStorage.setItem('adminData', JSON.stringify(resolved));
      });
      return { ...response, success: true, admin: resolved };
    }

    if (response.success && !resolved) {
      await authApi.logout();
      return {
        success: false,
        message: 'Could not complete sign-in. Please try again.',
      };
    }

    return response;
  };

  const logout = async () => {
    await authApi.logout();
    setAdmin(null);
    localStorage.removeItem('adminData');
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export default AdminAuthContext;

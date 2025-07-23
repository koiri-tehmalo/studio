'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  userName: string | null;
  userRole: 'admin' | 'user' | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      let finalUser: User | null = null;
      let finalUserName: string | null = null;
      let finalUserRole: 'admin' | 'user' | null = null;
      
      if (firebaseUser) {
        finalUser = firebaseUser;
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          finalUserRole = userData.role;
          finalUserName = userData.name;
        }
      }
      
      setUser(finalUser);
      setUserName(finalUserName);
      setUserRole(finalUserRole);
      setIsLoading(false);

      // --- Routing logic is now here ---
      const isAuthPage = pathname === '/' || pathname === '/register';
      if (finalUser && isAuthPage) {
        router.push('/dashboard');
      }
      if (!finalUser && !isAuthPage) {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  const logout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const value = {
    user,
    userName,
    userRole,
    isLoading,
    logout,
  };

  // While the initial user state is loading, show a loader for protected pages
  if (isLoading && pathname !== '/' && pathname !== '/register') {
     return (
        <div className="flex justify-center items-center h-screen bg-background">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

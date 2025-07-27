'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cpu, Loader2, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect (() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);
  
  if (isAuthLoading) {
     return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  const handleLogin = async () => {
    if (!email || !password) {
      toast({
        variant: 'destructive',
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'กรุณากรอกอีเมลและรหัสผ่าน',
      });
      return;
    }
    
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: 'เข้าสู่ระบบสำเร็จ',
      });
      router.push('/dashboard');

    } catch (error: any) {
      console.error("Failed to sign in:", error);
       let description = 'เกิดข้อผิดพลาดที่ไม่คาดคิด โปรดลองอีกครั้ง';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      }
      toast({
        variant: 'destructive',
        title: 'เข้าสู่ระบบล้มเหลว',
        description: description,
      });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md mx-auto shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center items-center mb-4">
             <Cpu size={48} className="text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">ระบบตรวจจับอารมณ์จากใบหน้า</CardTitle>
          <CardDescription>กรุณาเข้าสู่ระบบเพื่อเริ่มการใช้งาน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">อีเมล</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input
              id="password"
              type="password"
              placeholder="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button
            type="button"
            className="w-full font-bold text-lg mt-2"
            size="lg"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <><LogIn className="mr-2"/> เข้าสู่ระบบ</>}
          </Button>
           <p className="text-center text-sm text-muted-foreground">
              ยังไม่มีบัญชี?{' '}
              <Link href="/register" className="underline hover:text-primary">
                ลงทะเบียนที่นี่
              </Link>
            </p>
        </CardContent>
      </Card>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useRouter, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cpu, Loader2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/providers/auth-provider';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: isAuthLoading } = useAuth();
  
  if (isAuthLoading) {
     return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  if (user) {
    redirect('/dashboard');
  }

  const handleRegister = async () => {
    if (!name || !email || !password || !role) {
      toast({
        variant: 'destructive',
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'กรุณากรอกข้อมูลให้ครบทุกช่อง',
      });
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Add user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        role: role,
      });

      toast({
        title: 'ลงทะเบียนสำเร็จ',
        description: 'กำลังนำคุณไปยังหน้าเข้าสู่ระบบ',
      });

      router.push('/');

    } catch (error: any) {
      console.error("Failed to register:", error);
      let description = 'เกิดข้อผิดพลาดที่ไม่คาดคิด โปรดลองอีกครั้ง';
      if (error.code === 'auth/email-already-in-use') {
        description = 'อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น';
      } else if (error.code === 'auth/weak-password') {
        description = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
      }
      toast({
        variant: 'destructive',
        title: 'ลงทะเบียนล้มเหลว',
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
             <UserPlus size={48} className="text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">ลงทะเบียนผู้ใช้งาน</CardTitle>
          <CardDescription>สร้างบัญชีใหม่เพื่อเข้าใช้งานระบบ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อ-นามสกุล</Label>
            <Input
              id="name"
              type="text"
              placeholder="ชื่อของคุณ"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
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
              placeholder="ความยาวอย่างน้อย 6 ตัวอักษร"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
           <div className="space-y-2">
            <Label htmlFor="role">ระดับผู้ใช้งาน</Label>
            <Select onValueChange={setRole} defaultValue={role} disabled={isLoading}>
                <SelectTrigger id="role">
                    <SelectValue placeholder="เลือกระดับผู้ใช้งาน" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="user">ผู้ใช้ (User)</SelectItem>
                    <SelectItem value="admin">ผู้ดูแลระบบ (Admin)</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            className="w-full font-bold text-lg mt-2"
            size="lg"
            onClick={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : 'ลงทะเบียน'}
          </Button>
           <p className="text-center text-sm text-muted-foreground">
              มีบัญชีอยู่แล้ว?{' '}
              <Link href="/" className="underline hover:text-primary">
                เข้าสู่ระบบที่นี่
              </Link>
            </p>
        </CardContent>
      </Card>
    </main>
  );
}

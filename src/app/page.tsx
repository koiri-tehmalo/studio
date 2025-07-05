'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cpu, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartObservation = async () => {
    if (!name || !subject || !date) {
      toast({
        variant: 'destructive',
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'กรุณากรอกข้อมูลให้ครบทุกช่อง',
      });
      return;
    }
    
    setIsLoading(true);

    try {
      // The database write operation was causing the application to hang,
      // likely due to restrictive default Firestore security rules.
      // This step has been bypassed to allow the application to proceed.
      // To re-enable data persistence, the user must update their Firestore rules.
      
      // Save session info to localStorage for use in the dashboard
      localStorage.setItem('observerName', name);
      localStorage.setItem('observerSubject', subject);
      localStorage.setItem('observerDate', date);
      
      // Removing the session ID ensures that the dashboard page won't try to
      // write timeline data to a non-existent session.
      localStorage.removeItem('currentSessionId');

      router.push('/dashboard');

    } catch (error) {
      console.error("Failed to access localStorage:", error);
      toast({
        variant: 'destructive',
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถเริ่มเซสชันได้ โปรดลองอีกครั้ง',
      });
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
          <CardTitle className="text-3xl font-headline">ผู้สังเกตการณ์ห้องเรียน</CardTitle>
          <CardDescription>กรุณากรอกข้อมูลเพื่อเริ่มการสังเกตการณ์</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อ</Label>
            <Input
              id="name"
              type="text"
              placeholder="ชื่อ-นามสกุล"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">วิชา</Label>
            <Input
              id="subject"
              type="text"
              placeholder="ชื่อวิชาที่สอน"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">วันที่</Label>
            <Input
              id="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button
            type="button"
            className="w-full font-bold text-lg mt-2"
            size="lg"
            onClick={handleStartObservation}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : 'เริ่มการสังเกตการณ์'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

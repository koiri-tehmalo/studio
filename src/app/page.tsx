'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cpu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');

  const handleStartObservation = () => {
    if (!name || !subject || !date) {
      toast({
        variant: 'destructive',
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'กรุณากรอกข้อมูลให้ครบทุกช่อง',
      });
      return;
    }

    try {
        localStorage.setItem('observerName', name);
        localStorage.setItem('observerSubject', subject);
        localStorage.setItem('observerDate', date);
        router.push('/dashboard');
    } catch (error) {
        console.error("Failed to access localStorage:", error);
        toast({
            variant: 'destructive',
            title: 'เกิดข้อผิดพลาด',
            description: 'ไม่สามารถบันทึกข้อมูลได้ โปรดลองอีกครั้ง',
        });
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
            />
          </div>
          <Button
            type="button"
            className="w-full font-bold text-lg mt-2"
            size="lg"
            onClick={handleStartObservation}
          >
            เริ่มการสังเกตการณ์
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cpu } from 'lucide-react';

export default function LoginPage() {
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
            <Input id="name" type="text" placeholder="ชื่อ-นามสกุล" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">วิชา</Label>
            <Input id="subject" type="text" placeholder="ชื่อวิชาที่สอน" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">วันที่</Label>
            <Input id="date" type="date" required />
          </div>
           <Link href="/dashboard" passHref>
              <Button type="submit" className="w-full font-bold text-lg" size="lg">
                เริ่มการสังเกตการณ์
              </Button>
            </Link>
        </CardContent>
      </Card>
    </main>
  );
}

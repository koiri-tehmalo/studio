'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from '@/providers/auth-provider';
import type { SessionInfo } from '@/app/dashboard/types';

// =================================================================
// Component for the "start session" form
// =================================================================
export default function StartSessionForm({ onSessionStart }: { onSessionStart: (info: SessionInfo) => void; }) {
    const { toast } = useToast();
    const { user, userName } = useAuth();

    const [observerName, setObserverName] = useState('');
    const [observerSubject, setObserverSubject] = useState('');
    const [observerDate, setObserverDate] = useState('');
    const [isStartingSession, setIsStartingSession] = useState(false);

    useEffect(() => {
        if (userName) {
            const storedName = localStorage.getItem('observerName');
            const storedSubject = localStorage.getItem('observerSubject');
            
            setObserverName(storedName || userName);
            if (storedSubject) {
                setObserverSubject(storedSubject);
            }
        }
    }, [userName]);

    const handleStartSession = async () => {
        if (!observerName || !observerSubject || !observerDate) {
            toast({
                variant: 'destructive',
                title: 'ข้อมูลไม่ครบถ้วน',
                description: 'กรุณากรอกข้อมูลการสังเกตการณ์ให้ครบถ้วน',
            });
            return;
        }
        if (!user) {
             toast({
                variant: 'destructive',
                title: 'ไม่พบผู้ใช้งาน',
                description: 'กรุณาเข้าสู่ระบบอีกครั้ง',
            });
            return;
        }
        
        setIsStartingSession(true);
        try {
          localStorage.setItem('observerName', observerName);
          localStorage.setItem('observerSubject', observerSubject);
          
          const sessionRef = await addDoc(collection(db, "sessions"), {
            observerName: observerName,
            subject: observerSubject,
            date: observerDate,
            createdAt: serverTimestamp(),
            userId: user.uid,
          });
          
          toast({
            title: 'เริ่มเซสชันสำเร็จ',
            description: `เริ่มการสังเกตการณ์วิชา ${observerSubject}`,
          });
          
          onSessionStart({
              name: observerName,
              subject: observerSubject,
              date: observerDate,
              id: sessionRef.id
          });

        } catch (error) {
           console.error("Error starting session:", error);
           toast({
                variant: 'destructive',
                title: 'เกิดข้อผิดพลาด',
                description: 'ไม่สามารถเริ่มเซสชันได้ โปรดลองอีกครั้ง',
           });
        } finally {
            setIsStartingSession(false);
        }
      };

    return (
         <div className="flex items-center justify-center h-full">
              <Card className="w-full max-w-lg">
                  <CardHeader>
                      <CardTitle className="text-2xl font-headline">เริ่มการสังเกตการณ์ใหม่</CardTitle>
                      <CardDescription>กรอกข้อมูลเพื่อเริ่มบันทึกและวิเคราะห์เซสชันใหม่</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                       <div className="space-y-2">
                          <Label htmlFor="name">ชื่อผู้สังเกตการณ์</Label>
                          <Input
                          id="name"
                          type="text"
                          value={observerName}
                          onChange={(e) => setObserverName(e.target.value)}
                          />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="subject">วิชา</Label>
                          <Input
                          id="subject"
                          type="text"
                          placeholder="เช่น คณิตศาสตร์, วิทยาศาสตร์"
                          required
                          value={observerSubject}
                          onChange={(e) => setObserverSubject(e.target.value)}
                          disabled={isStartingSession}
                          />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="date">วันที่สังเกตการณ์</Label>
                          <Input
                          id="date"
                          type="date"
                          required
                          value={observerDate}
                          onChange={(e) => setObserverDate(e.target.value)}
                          disabled={isStartingSession}
                          />
                      </div>
                      <Button
                          type="button"
                          className="w-full font-bold text-lg"
                          size="lg"
                          onClick={handleStartSession}
                          disabled={isStartingSession}
                      >
                          {isStartingSession ? <Loader2 className="animate-spin" /> : 'เริ่มการสังเกตการณ์'}
                      </Button>
                  </CardContent>
              </Card>
         </div>
      );
}

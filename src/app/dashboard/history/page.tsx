'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { format } from 'date-fns';

interface Session {
  id: string;
  observerName: string;
  subject: string;
  date: string;
  createdAt: any;
  userId: string;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      };

      try {
        const sessionsCollection = collection(db, 'sessions');
        const q = query(
          sessionsCollection,
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const sessionSnapshot = await getDocs(q);
        const sessionsList = sessionSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().date),
        })) as Session[];
        setSessions(sessionsList);
      } catch (error) {
        console.error("Error fetching user sessions: ", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <div className="grid gap-1">
            <div className="flex items-center gap-2">
              <History className="h-8 w-8 text-primary"/>
              <h1 className="text-3xl font-bold tracking-tight font-headline">ประวัติการสังเกตการณ์</h1>
            </div>
            <p className="text-muted-foreground">ภาพรวมการสังเกตการณ์ทั้งหมดของคุณ</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>เซสชันของคุณ</CardTitle>
          <CardDescription>แสดงเซสชันทั้งหมดที่คุณได้สร้างไว้ เรียงจากล่าสุดไปเก่าสุด</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่สังเกตการณ์</TableHead>
                <TableHead>วิชา</TableHead>
                <TableHead>ผู้สังเกตการณ์</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length > 0 ? (
                sessions.map(session => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.date}</TableCell>
                    <TableCell>{session.subject}</TableCell>
                    <TableCell>{session.observerName}</TableCell>
                    <TableCell>
                      {session.createdAt ? format(session.createdAt, 'PPpp') : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    ยังไม่มีข้อมูลการสังเกตการณ์
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

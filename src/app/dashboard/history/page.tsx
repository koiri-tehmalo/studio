'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History, FileDown } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Session {
  id: string;
  observerName: string;
  subject: string;
  date: string;
  createdAt: any;
  userId: string;
}

interface TimelineData {
  timestamp: any;
  personCount: number;
  interestedCount: number;
  uninterestedCount: number;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

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
  
  const handleExport = async (session: Session) => {
    setExportingId(session.id);
    try {
        const timelineCollection = collection(db, 'sessions', session.id, 'timeline');
        const q = query(timelineCollection, orderBy('timestamp', 'asc'));
        const timelineSnapshot = await getDocs(q);

        if (timelineSnapshot.empty) {
            toast({
                variant: 'destructive',
                title: 'ไม่มีข้อมูล',
                description: 'ไม่พบข้อมูลย้อนหลังสำหรับเซสชันนี้',
            });
            return;
        }

        const timelineList = timelineSnapshot.docs.map(doc => doc.data() as TimelineData);

        const sessionInfoRows = [
            `ผู้สังเกตการณ์:,${session.observerName}`,
            `วิชา:,${session.subject}`,
            `วันที่:,${session.date}`,
            ""
        ];

        const headers = ["เวลา", "จำนวนคน", "สนใจ", "ไม่สนใจ"];
        let dataRows = [headers.join(",")];

        timelineList.forEach(entry => {
            const timestamp = entry.timestamp?.toDate ? format(entry.timestamp.toDate(), 'HH:mm:ss') : 'N/A';
            const row = [
                timestamp,
                entry.personCount,
                entry.interestedCount,
                entry.uninterestedCount,
            ].join(",");
            dataRows.push(row);
        });

        const csvContent = "\uFEFF" + [...sessionInfoRows, ...dataRows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `ข้อมูลย้อนหลัง_${session.subject}_${session.date}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error exporting timeline data:", error);
        toast({
            variant: 'destructive',
            title: 'ส่งออกล้มเหลว',
            description: 'เกิดข้อผิดพลาดในการดึงข้อมูลเพื่อส่งออก',
        });
    } finally {
        setExportingId(null);
    }
  };

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
                <TableHead /*className="text-right"*/>ดำเนินการ</TableHead>
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
                    <TableCell /*className="text-right"*/>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport(session)}
                          disabled={exportingId === session.id}
                        >
                          {exportingId === session.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileDown className="mr-2 h-4 w-4" />
                          )}
                          ส่งออก
                        </Button>
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

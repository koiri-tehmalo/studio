'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileDown, Smile, Meh, Users } from 'lucide-react';

const historicalData = [
  { timestamp: '10:15 AM', interested: '85%', uninterested: '15%', total: 20 },
  { timestamp: '10:14 AM', interested: '80%', uninterested: '20%', total: 20 },
  { timestamp: '10:13 AM', interested: '90%', uninterested: '10%', total: 20 },
  { timestamp: '10:12 AM', interested: '75%', uninterested: '25%', total: 20 },
  { timestamp: '10:11 AM', interested: '88%', uninterested: '12%', total: 20 },
];

const BoundingBox = ({ x, y, width, height, isInterested }: { x: string, y: string, width: string, height: string, isInterested: boolean }) => {
  const borderColor = isInterested ? 'border-green-500' : 'border-red-500';
  const shadowColor = isInterested ? 'shadow-[0_0_15px_rgba(74,222,128,0.8)]' : 'shadow-[0_0_15px_rgba(239,68,68,0.8)]';
  return (
    <div
      className={`absolute ${borderColor} ${shadowColor} border-2 rounded-md transition-all duration-300`}
      style={{ top: y, left: x, width: width, height: height }}
    ></div>
  );
};


export default function DashboardPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'การเข้าถึงกล้องถูกปฏิเสธ',
          description: 'โปรดเปิดใช้งานการเข้าถึงกล้องในการตั้งค่าเบราว์เซอร์ของคุณ',
        });
      }
    };

    getCameraPermission();
  }, [toast]);


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="grid gap-1">
            <h1 className="text-3xl font-bold tracking-tight font-headline">แดชบอร์ด</h1>
            <p className="text-muted-foreground">การวิเคราะห์การมีส่วนร่วมในห้องเรียนแบบเรียลไทม์</p>
        </div>
        <Button variant="outline">
          <FileDown className="mr-2 h-4 w-4" />
          ส่งออกเป็น Excel
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Video */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>การวิเคราะห์วิดีโอสด</CardTitle>
              <CardDescription>วิเคราะห์การแสดงออกทางสีหน้าแบบเรียลไทม์</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center items-center gap-4">
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                 <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                { hasCameraPermission && (
                  <>
                    <BoundingBox x="15%" y="30%" width="15%" height="25%" isInterested={true} />
                    <BoundingBox x="40%" y="45%" width="18%" height="30%" isInterested={true} />
                    <BoundingBox x="70%" y="35%" width="16%" height="28%" isInterested={false} />
                    <BoundingBox x="5%" y="60%" width="15%" height="25%" isInterested={true} />
                    <BoundingBox x="80%" y="65%" width="14%" height="22%" isInterested={true} />
                  </>
                )}
              </div>
               {hasCameraPermission === false && (
                <Alert variant="destructive" className="w-full">
                  <AlertTitle>จำเป็นต้องเข้าถึงกล้อง</AlertTitle>
                  <AlertDescription>
                    โปรดอนุญาตให้เข้าถึงกล้องเพื่อใช้คุณสมบัตินี้
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary Cards */}
        <div className="lg:col-span-1 flex flex-col gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">นักเรียนทั้งหมด</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">20</div>
                <p className="text-xs text-muted-foreground">ที่อยู่ในห้องเรียนตอนนี้</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">สนใจ</CardTitle>
                <Smile className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">85%</div>
                <p className="text-xs text-muted-foreground">+5% จากนาทีที่แล้ว</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ไม่สนใจ</CardTitle>
                <Meh className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">15%</div>
                <p className="text-xs text-muted-foreground">-5% จากนาทีที่แล้ว</p>
              </CardContent>
            </Card>
        </div>
        
        {/* Bottom Row: History */}
        <div className="lg:col-span-3">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>ข้อมูลย้อนหลัง</CardTitle>
              <CardDescription>ภาพรวมการมีส่วนร่วม 5 นาทีล่าสุด</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">เวลา</TableHead>
                    <TableHead className="text-center text-green-600">สนใจ</TableHead>
                    <TableHead className="text-center text-red-600 pr-6">ไม่สนใจ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalData.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium pl-6">{entry.timestamp}</TableCell>
                      <TableCell className="text-center">{entry.interested}</TableCell>
                      <TableCell className="text-center pr-6">{entry.uninterested}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

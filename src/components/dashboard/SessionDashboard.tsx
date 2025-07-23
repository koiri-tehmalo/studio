'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, BookOpen, Clock } from 'lucide-react';
import { useCamera } from '@/providers/camera-provider';
import type { SessionInfo } from '@/app/dashboard/types';

// =================================================================
// Component for the main dashboard view after a session has started
// =================================================================
export default function SessionDashboard({ sessionInfo }: { sessionInfo: SessionInfo }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { stream, hasCameraPermission, isLoading: isCameraLoading } = useCamera();

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Video play failed:", e));
    }
  }, [stream]);

  const showLoadingOverlay = isCameraLoading;
  const loadingText = "กำลังเปิดกล้อง...";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="grid gap-1">
            <h1 className="text-3xl font-bold tracking-tight font-headline">แดชบอร์ด</h1>
            <p className="text-muted-foreground">การสังเกตการณ์ในห้องเรียนแบบเรียลไทม์</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>วิดีโอสด</CardTitle>
              <CardDescription>ภาพสดจากกล้องที่ใช้ในการสังเกตการณ์</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center items-center gap-4">
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted flex justify-center items-center">
                 <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                { showLoadingOverlay && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <p>{loadingText}</p>
                   </div>
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

        <div className="lg:col-span-1 flex flex-col gap-6">
            <Card>
              <CardHeader>
                  <CardTitle className="text-sm font-medium">ข้อมูลการสังเกตการณ์</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">ผู้สังเกตการณ์</span>
                          <span className="font-semibold">{sessionInfo.name}</span>
                      </div>
                  </div>
                   <div className="flex items-center gap-4">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                      <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">วิชา</span>
                          <span className="font-semibold">{sessionInfo.subject}</span>
                      </div>
                  </div>
                   <div className="flex items-center gap-4">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">วันที่</span>
                          <span className="font-semibold">{sessionInfo.date}</span>
                      </div>
                  </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

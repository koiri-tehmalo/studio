'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { FileDown, Smile, Meh, Users, Loader2, User, BookOpen, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useCamera } from '@/providers/camera-provider';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { SessionInfo } from '@/app/dashboard/types';
import EngagementChart from './EngagementChart';
import { useEmotionAnalyzer, AnalysisResult, FaceData } from '@/hooks/use-emotion-analyzer';

const EMOTION_CLASSES = ['ไม่สนใจ', 'สนใจ'];

interface PerMinuteData {
  timestamp: string;
  personCount: number;
  interested: string;
  uninterested: string;
  interestedCount: number;
  uninterestedCount: number;
}


export default function SessionDashboard({ sessionInfo, onSessionEnd }: { sessionInfo: SessionInfo, onSessionEnd: () => void; }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  
  const [perMinuteData, setPerMinuteData] = useState<PerMinuteData[]>([]);
  const { toast } = useToast();

  const [realtimeStudentCount, setRealtimeStudentCount] = useState(0);
  const [interestedCount, setInterestedCount] = useState(0);
  
  const minuteFrameCountRef = useRef(0);
  const minuteTotalStudentCountRef = useRef(0);
  const minuteTotalInterestedCountRef = useRef(0);

  const liveCroppedFaces = useRef<FaceData[]>([]);
  const [facesForDisplay, setFacesForDisplay] = useState<FaceData[]>([]);

  const { stream, hasCameraPermission, isLoading: isCameraLoading } = useCamera();
  const { modelsLoaded, analyzeFrame } = useEmotionAnalyzer();

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [stream]);
  
  const predictWebcam = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !modelsLoaded) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }
    
    const analysisResults = await analyzeFrame(video);
    
    const ctx = canvas.getContext('2d');
    if (ctx && analysisResults) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let currentInterested = analysisResults.filter(r => r.isInterested).length;

      for (const result of analysisResults) {
        const { box, isInterested } = result;

        const canvasX = box.x * (canvas.width / video.videoWidth);
        const canvasY = box.y * (canvas.height / video.videoHeight);
        const canvasWidth = box.width * (canvas.width / video.videoWidth);
        const canvasHeight = box.height * (canvas.height / video.videoHeight);
        
        const thaiText = isInterested ? EMOTION_CLASSES[1] : EMOTION_CLASSES[0];
        const color = isInterested ? '#4ade80' : '#f87171';

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);
        
        ctx.fillStyle = color;
        const textBackgroundHeight = 24;
        ctx.font = `bold 16px 'Poppins'`;
        const textWidth = ctx.measureText(thaiText).width;
        
        ctx.fillRect(canvasX - 1, canvasY - textBackgroundHeight, textWidth + 12, textBackgroundHeight);
        
        ctx.fillStyle = '#fff';
        ctx.fillText(thaiText, canvasX + 5, canvasY - 6);
      }
      liveCroppedFaces.current = analysisResults.map(r => ({ image: r.imageDataUrl, interested: r.isInterested }));
      setRealtimeStudentCount(analysisResults.length);
      setInterestedCount(currentInterested);
      
      minuteFrameCountRef.current++;
      minuteTotalStudentCountRef.current += analysisResults.length;
      minuteTotalInterestedCountRef.current += currentInterested;
    }
    
    animationFrameId.current = requestAnimationFrame(predictWebcam);
    
  }, [modelsLoaded, analyzeFrame]);

  const handleVideoPlay = useCallback(() => {
    if (modelsLoaded) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
    }
  }, [modelsLoaded, predictWebcam]);
  
  useEffect(() => {
    // This effect will trigger the analysis loop once models are loaded and video is playing
    const video = videoRef.current;
    if (modelsLoaded && video && !video.paused) {
        handleVideoPlay();
    }
    // Also re-trigger if models load after video is already playing
    if (modelsLoaded && video && !video.paused && !animationFrameId.current) {
        handleVideoPlay();
    }
    
    return () => {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
    }
  }, [modelsLoaded, handleVideoPlay]);

  // New effect to update the displayed faces every 30 seconds
  useEffect(() => {
    const faceUpdateInterval = setInterval(() => {
      setFacesForDisplay([...liveCroppedFaces.current]);
    }, 30000); // Update every 30 seconds

    return () => clearInterval(faceUpdateInterval);
  }, []);

  useEffect(() => {
    const dataCaptureInterval = setInterval(async () => {
      const frameCount = minuteFrameCountRef.current;
      const totalStudents = minuteTotalStudentCountRef.current;
      const totalInterested = minuteTotalInterestedCountRef.current;

      minuteFrameCountRef.current = 0;
      minuteTotalStudentCountRef.current = 0;
      minuteTotalInterestedCountRef.current = 0;

      if (frameCount > 0) {
        const avgPersonCount = Math.round(totalStudents / frameCount);
        const avgInterested = Math.round(totalInterested / frameCount);
        const avgUninterested = avgPersonCount - avgInterested;

        const interestedPercent = avgPersonCount > 0 ? `${Math.round((avgInterested / avgPersonCount) * 100)}%` : '0%';
        const uninterestedPercent = avgPersonCount > 0 ? `${Math.round((avgUninterested / avgPersonCount) * 100)}%` : '0%';
        
        const now = new Date();
        const newDisplayEntry: PerMinuteData = {
          timestamp: format(now, 'HH:mm น.'),
          personCount: avgPersonCount,
          interested: interestedPercent,
          uninterested: uninterestedPercent,
          interestedCount: avgInterested,
          uninterestedCount: avgUninterested,
        };

        setPerMinuteData(prevData => [newDisplayEntry, ...prevData.slice(0, 9)]); 

        try {
          const timelineRef = collection(db, "sessions", sessionInfo.id, "timeline");
          await addDoc(timelineRef, {
            timestamp: serverTimestamp(),
            personCount: avgPersonCount,
            interestedCount: avgInterested,
            uninterestedCount: avgUninterested
          });
        } catch (error) {
          console.error("Failed to save timeline data:", error);
          toast({
              variant: 'destructive',
              title: 'เกิดข้อผิดพลาดในการบันทึก',
              description: 'ไม่สามารถบันทึกข้อมูลย้อนหลังลงฐานข้อมูลได้',
          });
        }
      }
    }, 60000); // Save every minute

    return () => clearInterval(dataCaptureInterval);
  }, [toast, sessionInfo.id]);

  const handleExport = () => {
    const loginInfoRows = [
      `ชื่อผู้สังเกตการณ์:,${sessionInfo.name}`,
      `วิชา:,${sessionInfo.subject}`,
      `วันที่:,${sessionInfo.date}`,
      ""
    ];
    
    const headers = ["เวลา", "จำนวนคน (เฉลี่ย)", "สนใจ", "ไม่สนใจ"];
    let dataRows = [headers.join(",")];

    perMinuteData.forEach(entry => {
        const row = [
            entry.timestamp,
            entry.personCount,
            `"${entry.interested}"`,
            `"${entry.uninterested}"`
        ].join(",");
        dataRows.push(row);
    });

    const csvContent = "\uFEFF" + [...loginInfoRows, ...dataRows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `ข้อมูลการมีส่วนร่วม_${sessionInfo.subject}_${sessionInfo.date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uninterestedCount = realtimeStudentCount - interestedCount;
  const interestedPercentage = realtimeStudentCount > 0 ? Math.round((interestedCount / realtimeStudentCount) * 100) : 0;
  const uninterestedPercentage = realtimeStudentCount > 0 ? Math.round((uninterestedCount / realtimeStudentCount) * 100) : 0;

  const showLoadingOverlay = isCameraLoading || !modelsLoaded;
  const loadingText = isCameraLoading ? "กำลังเปิดกล้อง..." : !modelsLoaded ? "กำลังโหลดโมเดลวิเคราะห์ใบหน้า..." : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="grid gap-1">
            <h1 className="text-3xl font-bold tracking-tight font-headline">แดชบอร์ดการวิเคราะห์</h1>
            <p className="text-muted-foreground">การวิเคราะห์การมีส่วนร่วมในห้องเรียนแบบเรียลไทม์</p>
        </div>
        <div className="flex gap-2">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="secondary">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      เริ่มเซสชันใหม่
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>คุณแน่ใจหรือไม่?</AlertDialogTitle>
                    <AlertDialogDescription>
                        การดำเนินการนี้จะสิ้นสุดเซสชันปัจจุบันและกลับไปยังหน้าเริ่มต้น คุณต้องการดำเนินการต่อหรือไม่?
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction onClick={onSessionEnd}>ดำเนินการต่อ</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" onClick={handleExport} disabled={perMinuteData.length === 0}>
                <FileDown className="mr-2 h-4 w-4" />
                ส่งออกเป็น Excel
            </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>การวิเคราะห์วิดีโอสด</CardTitle>
              <CardDescription>ตรวจจับใบหน้าและวิเคราะห์อารมณ์แบบเรียลไทม์</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center items-center gap-4">
               <div className="w-full bg-muted rounded-lg p-2 h-24 overflow-x-auto whitespace-nowrap">
                {facesForDisplay.length > 0 ? (
                  facesForDisplay.map((faceData, index) => (
                    <img
                      key={index}
                      src={faceData.image}
                      alt={`Cropped face ${index + 1}`}
                      className={`inline-block h-full w-auto rounded-md mr-2 border-4 ${
                        faceData.interested ? 'border-green-400' : 'border-red-400'
                      }`}
                    />
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    รอการตรวจจับใบหน้า...
                  </div>
                )}
              </div>
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted flex justify-center items-center">
                 <video ref={videoRef} onPlay={handleVideoPlay} className="w-full h-full object-cover" autoPlay muted playsInline />
                 <canvas ref={canvasRef} className="absolute top-0 left-0" />
                { showLoadingOverlay && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <p>{loadingText}</p>
                   </div>
                )}
              </div>
               <div className="flex items-center justify-end w-full text-sm text-muted-foreground">
                <span className={`h-2.5 w-2.5 rounded-full mr-2 ${modelsLoaded ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                MediaPipe & CNN
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
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">นักเรียนทั้งหมด</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realtimeStudentCount}</div>
                <p className="text-xs text-muted-foreground">ที่ตรวจพบในกล้องขณะนี้</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">สนใจ</CardTitle>
                <Smile className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{interestedPercentage}%</div>
                <p className="text-xs text-muted-foreground">{interestedCount} จาก {realtimeStudentCount} คน</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ไม่สนใจ</CardTitle>
                <Meh className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{uninterestedPercentage}%</div>
                <p className="text-xs text-muted-foreground">{uninterestedCount} จาก {realtimeStudentCount} คน</p>
              </CardContent>
            </Card>
        </div>
        
        <div className="lg:col-span-3">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>ข้อมูลย้อนหลัง (10 นาทีล่าสุด)</CardTitle>
              <CardDescription>ภาพรวมการมีส่วนร่วมที่บันทึกไว้ทุก 1 นาที</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
                {perMinuteData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">เวลา</TableHead>
                        <TableHead className="text-center">จำนวนคน (เฉลี่ย)</TableHead>
                        <TableHead className="text-center text-green-600">สนใจ</TableHead>
                        <TableHead className="text-center text-red-600 pr-6">ไม่สนใจ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perMinuteData.map((entry, index) => (
                        <TableRow key={`minute-${index}`}>
                          <TableCell className="font-medium pl-6">{entry.timestamp}</TableCell>
                          <TableCell className="text-center">{entry.personCount}</TableCell>
                          <TableCell className="text-center">{entry.interested}</TableCell>
                          <TableCell className="text-center pr-6">{entry.uninterested}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4"/>
                        <p className="text-muted-foreground">กำลังรอข้อมูลแรก...</p>
                        <p className="text-xs text-muted-foreground/80">(ข้อมูลจะถูกบันทึกทุก 1 นาที)</p>
                    </div>
                )}
            </CardContent>
          </Card>
        </div>

        {perMinuteData.length > 0 && (
          <div className="lg:col-span-3">
            <EngagementChart data={perMinuteData} />
          </div>
        )}
      </div>
    </div>
  );
}

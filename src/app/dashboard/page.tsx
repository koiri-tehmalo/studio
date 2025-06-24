
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileDown, Smile, Meh, Users, Loader2 } from 'lucide-react';
import { format, subMinutes, subHours } from 'date-fns';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function DashboardPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | undefined>(undefined);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [perMinuteData, setPerMinuteData] = useState<any[]>([]);
  const [per10MinuteData, setPer10MinuteData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const { toast } = useToast();
  
  useEffect(() => {
    const createFaceLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 5,
        });
        setFaceLandmarker(landmarker);
        setModelsLoaded(true);
      } catch (error) {
        console.error("Failed to load MediaPipe models:", error);
        toast({
          variant: 'destructive',
          title: 'ไม่สามารถโหลดโมเดล AI',
          description: 'โปรดรีเฟรชหน้าหรือลองอีกครั้งในภายหลัง',
        });
      }
    };
    createFaceLandmarker();
    
    return () => {
      faceLandmarker?.close();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [toast]);

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

  useEffect(() => {
    const now = new Date();
    
    const minuteData = Array.from({ length: 10 }, (_, i) => ({
      timestamp: format(subMinutes(now, i), 'HH:mm น.'),
      interested: `${Math.floor(Math.random() * 10) + 85}%`,
      uninterested: `${Math.floor(Math.random() * 10) + 5}%`,
    }));
    setPerMinuteData(minuteData);

    const tenMinuteData = Array.from({ length: 6 }, (_, i) => ({
      timestamp: format(subMinutes(now, (i + 1) * 10), 'HH:mm น.'),
      interested: `${Math.floor(Math.random() * 20) + 70}%`,
      uninterested: `${Math.floor(Math.random() * 20) + 10}%`,
    }));
    setPer10MinuteData(tenMinuteData);

    const hourlyD = Array.from({ length: 4 }, (_, i) => ({
      timestamp: format(subHours(now, i + 2), 'HH:mm น.'),
      interested: `${Math.floor(Math.random() * 25) + 60}%`,
      uninterested: `${Math.floor(Math.random() * 25) + 15}%`,
    }));
    setHourlyData(hourlyD);
  }, []);

  const predictWebcam = () => {
    if (!videoRef.current || !canvasRef.current || !faceLandmarker || videoRef.current.paused || videoRef.current.readyState < 2) {
      if(videoRef.current && !videoRef.current.paused) {
        animationFrameId.current = requestAnimationFrame(predictWebcam);
      }
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const results = faceLandmarker.detectForVideo(video, performance.now());

    const ctx = canvas.getContext('2d');
    if (ctx && results.faceLandmarks) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < results.faceLandmarks.length; i++) {
        const landmarks = results.faceLandmarks[i];
        
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
        for (const landmark of landmarks) {
            const x = landmark.x * canvas.width;
            const y = landmark.y * canvas.height;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
        const padding = 10;
        const box = {
            x: minX - padding,
            y: minY - padding,
            width: (maxX - minX) + (padding * 2),
            height: (maxY - minY) + (padding * 2)
        };
        
        const blendshapes = results.faceBlendshapes[i]?.categories;
        if (!blendshapes) continue;

        const smileScore = (blendshapes.find(c => c.categoryName === 'mouthSmileLeft')?.score ?? 0) + 
                         (blendshapes.find(c => c.categoryName === 'mouthSmileRight')?.score ?? 0);

        const neutralScore = blendshapes.find(c => c.categoryName === '_neutral')?.score ?? 0;

        const isInterested = smileScore > 0.4 || neutralScore > 0.2;
        const thaiText = isInterested ? 'สนใจ' : 'ไม่สนใจ';
        const color = isInterested ? '#4ade80' : '#f87171';

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        ctx.fillStyle = color;
        const textBackgroundHeight = 24;
        ctx.font = `bold 16px 'Poppins'`;
        const textWidth = ctx.measureText(thaiText).width;
        
        ctx.fillRect(box.x - 1, box.y - textBackgroundHeight, textWidth + 12, textBackgroundHeight);
        
        ctx.fillStyle = '#fff';
        ctx.fillText(thaiText, box.x + 5, box.y - 6);
      }
    }
    
    animationFrameId.current = requestAnimationFrame(predictWebcam);
  };

  const handleVideoPlay = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    predictWebcam();
  };

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
        
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>การวิเคราะห์วิดีโอสด</CardTitle>
              <CardDescription>ตรวจจับใบหน้าและวิเคราะห์อารมณ์แบบเรียลไทม์</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center items-center gap-4">
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted flex justify-center items-center">
                 <video ref={videoRef} onPlay={handleVideoPlay} className="w-full h-full object-cover" autoPlay muted playsInline />
                 <canvas ref={canvasRef} className="absolute top-0 left-0" />
                { hasCameraPermission && !modelsLoaded && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <p>กำลังโหลดโมเดลวิเคราะห์ใบหน้า...</p>
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
        
        <div className="lg:col-span-3">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>ข้อมูลย้อนหลัง</CardTitle>
              <CardDescription>ภาพรวมการมีส่วนร่วมตามช่วงเวลา</CardDescription>
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
                  <TableRow>
                      <TableCell colSpan={3} className="pl-6 pt-4 pb-2 text-sm font-semibold text-muted-foreground">
                          10 นาทีล่าสุด
                      </TableCell>
                  </TableRow>
                  {perMinuteData.map((entry, index) => (
                    <TableRow key={`minute-${index}`}>
                      <TableCell className="font-medium pl-6">{entry.timestamp}</TableCell>
                      <TableCell className="text-center">{entry.interested}</TableCell>
                      <TableCell className="text-center pr-6">{entry.uninterested}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                      <TableCell colSpan={3} className="pl-6 pt-4 pb-2 text-sm font-semibold text-muted-foreground">
                          ราย 10 นาที
                      </TableCell>
                  </TableRow>
                  {per10MinuteData.map((entry, index) => (
                    <TableRow key={`10min-${index}`}>
                      <TableCell className="font-medium pl-6">{entry.timestamp}</TableCell>
                      <TableCell className="text-center">{entry.interested}</TableCell>
                      <TableCell className="text-center pr-6">{entry.uninterested}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                      <TableCell colSpan={3} className="pl-6 pt-4 pb-2 text-sm font-semibold text-muted-foreground">
                          รายชั่วโมง
                      </TableCell>
                  </TableRow>
                  {hourlyData.map((entry, index) => (
                    <TableRow key={`hour-${index}`}>
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

    
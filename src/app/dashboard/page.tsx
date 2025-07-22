'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileDown, Smile, Meh, Users, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import * as tf from '@tensorflow/tfjs';
import { useCamera } from '@/providers/camera-provider';
import { db } from '@/lib/firebase';
import { collection, addDoc } from "firebase/firestore";

const EMOTION_CLASSES = ['ไม่สนใจ', 'สนใจ'];

export default function DashboardPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | undefined>(undefined);
  const [cnnModel, setCnnModel] = useState<tf.LayersModel | undefined>(undefined);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [perMinuteData, setPerMinuteData] = useState<any[]>([]);
  const [per10MinuteData, setPer10MinuteData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const { toast } = useToast();

  const [realtimeStudentCount, setRealtimeStudentCount] = useState(0);
  const [interestedCount, setInterestedCount] = useState(0);

  const minuteFrameCountRef = useRef(0);
  const minuteTotalStudentCountRef = useRef(0);
  const minuteTotalInterestedCountRef = useRef(0);

  const { stream, hasCameraPermission, isLoading: isCameraLoading } = useCamera();

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  
  useEffect(() => {
    const loadModels = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU",
          },
          outputFaceBlendshapes: true, // Keep for bounding box, even if not for logic
          runningMode: "VIDEO",
          numFaces: 20,
        });
        setFaceLandmarker(landmarker);

        await tf.setBackend('webgl');
        const model = await tf.loadLayersModel('/model/model.json');
        setCnnModel(model);

        setModelsLoaded(true);
      } catch (error) {
        console.error("Failed to load AI models:", error);
        toast({
          variant: 'destructive',
          title: 'ไม่สามารถโหลดโมเดล AI',
          description: 'โปรดตรวจสอบว่าคุณได้ย้ายโฟลเดอร์ model ไปไว้ใน public แล้ว และรีเฟรชหน้าเว็บ',
        });
      }
    };
    loadModels();
    
    return () => {
      faceLandmarker?.close();
      cnnModel?.dispose();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [toast]);

  useEffect(() => {
    const dataCaptureInterval = setInterval(async () => {
      const now = new Date();
      
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

        const newDisplayEntry = {
          timestamp: format(now, 'HH:mm น.'),
          personCount: avgPersonCount,
          interested: interestedPercent,
          uninterested: uninterestedPercent,
        };

        setPerMinuteData(prevData => [newDisplayEntry, ...prevData.slice(0, 59)]);
        if (now.getMinutes() % 10 === 0) {
          const new10MinEntry = { ...newDisplayEntry, timestamp: format(now, 'HH:mm น.') };
          setPer10MinuteData(prevData => [new10MinEntry, ...prevData.slice(0, 5)]);
        }
        if (now.getMinutes() === 0) {
          const newHourlyEntry = { ...newDisplayEntry, timestamp: format(now, 'HH:00 น.') };
          setHourlyData(prevData => [newHourlyEntry, ...prevData.slice(0, 3)]);
        }

        const sessionId = localStorage.getItem('currentSessionId');
        if (sessionId) {
          try {
            const timelineRef = collection(db, "sessions", sessionId, "timeline");
            await addDoc(timelineRef, {
              timestamp: new Date(),
              personCount: avgPersonCount,
              interestedCount: avgInterested,
              uninterestedCount: avgUninterested
            });
            console.log(`Data saved to Firestore for session ${sessionId} at ${new Date().toISOString()}`);
          } catch (error) {
            console.error("Failed to save timeline data:", error);
            toast({
                variant: 'destructive',
                title: 'เกิดข้อผิดพลาดในการบันทึก',
                description: 'ไม่สามารถบันทึกข้อมูลย้อนหลังลงฐานข้อมูลได้',
            });
          }
        }
      }
    }, 10000); // Save every 10 seconds for easier testing

    return () => {
      clearInterval(dataCaptureInterval);
    };
  }, [toast]);

  const handleExport = () => {
    const observerName = localStorage.getItem('observerName') || 'ไม่มีข้อมูล';
    const observerSubject = localStorage.getItem('observerSubject') || 'ไม่มีข้อมูล';
    const observerDate = localStorage.getItem('observerDate') || 'ไม่มีข้อมูล';

    const loginInfoRows = [
      `ชื่อผู้สังเกตการณ์:,${observerName}`,
      `วิชา:,${observerSubject}`,
      `วันที่:,${observerDate}`,
      ""
    ];
    
    const headers = ["หมวดหมู่", "เวลา", "จำนวนคน (เฉลี่ย)", "สนใจ", "ไม่สนใจ"];
    let dataRows = [headers.join(",")];

    const addDataToCsv = (data: any[], category: string) => {
        data.forEach(entry => {
            const row = [
                category,
                entry.timestamp,
                entry.personCount,
                `"${entry.interested}"`,
                `"${entry.uninterested}"`
            ].join(",");
            dataRows.push(row);
        });
    };

    addDataToCsv(perMinuteData, "60 นาทีล่าสุด");
    addDataToCsv(per10MinuteData, "ราย 10 นาที");
    addDataToCsv(hourlyData, "รายชั่วโมง");

    const csvContent = "\uFEFF" + [...loginInfoRows, ...dataRows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "ข้อมูลการมีส่วนร่วม.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const predictWebcam = async () => {
    if (!faceLandmarker || !cnnModel || !videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.readyState < 2) {
      if (videoRef.current && !videoRef.current.paused) {
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
      
      let currentInterested = 0;

      for (let i = 0; i < results.faceLandmarks.length; i++) {
        const landmarks = results.faceLandmarks[i];
        
        let minX = video.videoWidth, minY = video.videoHeight, maxX = 0, maxY = 0;
        for (const landmark of landmarks) {
            minX = Math.min(minX, landmark.x * video.videoWidth);
            maxX = Math.max(maxX, landmark.x * video.videoWidth);
            minY = Math.min(minY, landmark.y * video.videoHeight);
            maxY = Math.max(maxY, landmark.y * video.videoHeight);
        }
        const padding = 20;
        const box = {
            x: minX - padding,
            y: minY - padding,
            width: (maxX - minX) + (padding * 2),
            height: (maxY - minY) + (padding * 2)
        };
        
        const isInterested = await tf.tidy(() => {
          const faceImage = tf.browser.fromPixels(video, 3)
            .slice([Math.round(box.y), Math.round(box.x)], [Math.round(box.height), Math.round(box.width)])
            .resizeBilinear([48, 48])
            .mean(2) // Grayscale
            .toFloat()
            .div(tf.scalar(255.0))
            .expandDims(0)
            .expandDims(-1);
          
          const prediction = cnnModel.predict(faceImage) as tf.Tensor;
          const [uninterestedScore, interestedScore] = prediction.dataSync();

          return interestedScore > uninterestedScore;
        });

        if (isInterested) {
          currentInterested++;
        }

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
      setRealtimeStudentCount(results.faceLandmarks.length);
      setInterestedCount(currentInterested);
      
      minuteFrameCountRef.current++;
      minuteTotalStudentCountRef.current += results.faceLandmarks.length;
      minuteTotalInterestedCountRef.current += currentInterested;
    }
    
    animationFrameId.current = requestAnimationFrame(predictWebcam);
  };

  const handleVideoPlay = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    predictWebcam();
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
            <h1 className="text-3xl font-bold tracking-tight font-headline">แดชบอร์ด</h1>
            <p className="text-muted-foreground">การวิเคราะห์การมีส่วนร่วมในห้องเรียนแบบเรียลไทม์</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
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
              <CardTitle>ข้อมูลย้อนหลัง</CardTitle>
              <CardDescription>ภาพรวมการมีส่วนร่วมตามช่วงเวลา (เฉลี่ยต่อนาที)</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
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
                  {perMinuteData.length > 0 && (
                  <TableRow>
                      <TableCell colSpan={4} className="pl-6 pt-4 pb-2 text-sm font-semibold text-muted-foreground">
                          60 นาทีล่าสุด
                      </TableCell>
                  </TableRow>
                  )}
                  {perMinuteData.map((entry, index) => (
                    <TableRow key={`minute-${index}`}>
                      <TableCell className="font-medium pl-6">{entry.timestamp}</TableCell>
                      <TableCell className="text-center">{entry.personCount}</TableCell>
                      <TableCell className="text-center">{entry.interested}</TableCell>
                      <TableCell className="text-center pr-6">{entry.uninterested}</TableCell>
                    </TableRow>
                  ))}
                  {per10MinuteData.length > 0 && (
                  <TableRow>
                      <TableCell colSpan={4} className="pl-6 pt-4 pb-2 text-sm font-semibold text-muted-foreground">
                          ราย 10 นาที
                      </TableCell>
                  </TableRow>
                  )}
                  {per10MinuteData.map((entry, index) => (
                    <TableRow key={`10min-${index}`}>
                      <TableCell className="font-medium pl-6">{entry.timestamp}</TableCell>
                      <TableCell className="text-center">{entry.personCount}</TableCell>
                      <TableCell className="text-center">{entry.interested}</TableCell>
                      <TableCell className="text-center pr-6">{entry.uninterested}</TableCell>
                    </TableRow>
                  ))}
                  {hourlyData.length > 0 && (
                  <TableRow>
                      <TableCell colSpan={4} className="pl-6 pt-4 pb-2 text-sm font-semibold text-muted-foreground">
                          รายชั่วโมง
                      </TableCell>
                  </TableRow>
                  )}
                  {hourlyData.map((entry, index) => (
                    <TableRow key={`hour-${index}`}>
                      <TableCell className="font-medium pl-6">{entry.timestamp}</TableCell>
                      <TableCell className="text-center">{entry.personCount}</TableCell>
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

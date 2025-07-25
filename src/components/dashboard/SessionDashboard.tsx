'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileDown, Smile, Meh, Users, Loader2, User, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import * as tf from '@tensorflow/tfjs';
import { useCamera } from '@/providers/camera-provider';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from "firebase/firestore"; 
import { SessionInfo } from '@/app/dashboard/types';

const EMOTION_CLASSES = ['ไม่สนใจ', 'สนใจ'];

interface FaceData {
  image: string;
  interested: boolean;
}

export default function SessionDashboard({ sessionInfo }: { sessionInfo: SessionInfo }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const cnnModelRef = useRef<tf.LayersModel | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [perMinuteData, setPerMinuteData] = useState<any[]>([]);
  const { toast } = useToast();

  const [realtimeStudentCount, setRealtimeStudentCount] = useState(0);
  const [interestedCount, setInterestedCount] = useState(0);
  
  const minuteFrameCountRef = useRef(0);
  const minuteTotalStudentCountRef = useRef(0);
  const minuteTotalInterestedCountRef = useRef(0);

  const liveCroppedFaces = useRef<FaceData[]>([]);
  const [facesForDisplay, setFacesForDisplay] = useState<FaceData[]>([]);

  const { stream, hasCameraPermission, isLoading: isCameraLoading } = useCamera();

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [stream]);
  
  const predictWebcam = useCallback(async () => {
    const faceLandmarker = faceLandmarkerRef.current;
    const cnnModel = cnnModelRef.current;
    
    if (!faceLandmarker || !cnnModel || !videoRef.current || !canvasRef.current || videoRef.current.paused) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }

    if (videoRef.current.readyState < 2) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
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
      const faceImages: FaceData[] = [];

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

        let x = minX - padding;
        let y = minY - padding;
        let width = (maxX - minX) + (padding * 2);
        let height = (maxY - minY) + (padding * 2);

        const clampedX = Math.max(0, x);
        const clampedY = Math.max(0, y);
        const clampedWidth = Math.min(width, video.videoWidth - clampedX);
        const clampedHeight = Math.min(height, video.videoHeight - clampedY);

        const box = {
            x: clampedX,
            y: clampedY,
            width: clampedWidth,
            height: clampedHeight
        };
        
        const isInterested = await tf.tidy(() => {
          if (box.width <= 0 || box.height <= 0) return false;
          const faceImage = tf.browser.fromPixels(video)
            .slice([Math.round(box.y), Math.round(box.x)], [Math.round(box.height), Math.round(box.width)])
            .resizeBilinear([48, 48])
            .mean(2)
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
        
        if (tempCanvasRef.current && box.width > 0 && box.height > 0) {
            const tempCtx = tempCanvasRef.current.getContext('2d');
            if (tempCtx) {
                tempCanvasRef.current.width = box.width;
                tempCanvasRef.current.height = box.height;
                tempCtx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
                faceImages.push({
                  image: tempCanvasRef.current.toDataURL(),
                  interested: isInterested,
                });
            }
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
      liveCroppedFaces.current = faceImages;
      setRealtimeStudentCount(results.faceLandmarks.length);
      setInterestedCount(currentInterested);
      
      minuteFrameCountRef.current++;
      minuteTotalStudentCountRef.current += results.faceLandmarks.length;
      minuteTotalInterestedCountRef.current += currentInterested;
    }
    
    animationFrameId.current = requestAnimationFrame(predictWebcam);
    
  }, [modelsLoaded]);

  const handleVideoPlay = useCallback(() => {
    if (modelsLoaded) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
    }
  }, [modelsLoaded, predictWebcam]);
  
  useEffect(() => {
    tempCanvasRef.current = document.createElement('canvas');

    const loadModels = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
        );
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 20,
        });

        await tf.setBackend('webgl');
        cnnModelRef.current = await tf.loadLayersModel('/model/model.json');

        setModelsLoaded(true);
      } catch (error) {
        console.error("Failed to load AI models:", error);
        toast({
          variant: 'destructive',
          title: 'ไม่สามารถโหลดโมเดล AI',
          description: 'โปรดรีเฟรชหน้าเว็บ หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
        });
      }
    };
    loadModels();
    
    return () => {
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
      }
      if (cnnModelRef.current) {
        cnnModelRef.current.dispose();
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [toast]);

  // This effect will trigger the analysis loop once models are loaded and video is playing
  useEffect(() => {
      if (modelsLoaded && videoRef.current && !videoRef.current.paused) {
          handleVideoPlay();
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
        const newDisplayEntry = {
          timestamp: format(now, 'HH:mm น.'),
          personCount: avgPersonCount,
          interested: interestedPercent,
          uninterested: uninterestedPercent,
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
        <Button variant="outline" onClick={handleExport} disabled={perMinuteData.length === 0}>
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
      </div>
    </div>
  );
}

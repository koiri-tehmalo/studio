'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileDown, Smile, Meh, Users, Loader2, User, BookOpen, Clock, History } from 'lucide-react';
import { format } from 'date-fns';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import * as tf from '@tensorflow/tfjs';
import { useCamera } from '@/providers/camera-provider';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from '@/providers/auth-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMOTION_CLASSES = ['ไม่สนใจ', 'สนใจ'];

interface FaceData {
  image: string;
  interested: boolean;
}

interface HistoricalData {
    timestamp: string;
    personCount: number;
    interested: string;
    uninterested: string;
}

interface SessionInfo {
    name: string;
    subject: string;
    date: string;
    id: string;
}

// =================================================================
// Component for the main dashboard view after a session has started
// =================================================================
function SessionDashboard({ sessionInfo }: { sessionInfo: SessionInfo }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | undefined>(undefined);
  const [cnnModel, setCnnModel] = useState<tf.LayersModel | undefined>(undefined);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);

  const { toast } = useToast();

  const [realtimeStudentCount, setRealtimeStudentCount] = useState(0);
  const [interestedCount, setInterestedCount] = useState(0);
  
  const minuteFrameCountRef = useRef(0);
  const minuteTotalStudentCountRef = useRef(0);
  const minuteTotalInterestedCountRef = useRef(0);

  const [liveCroppedFaces, setLiveCroppedFaces] = useState<FaceData[]>([]);
  const [facesForDisplay, setFacesForDisplay] = useState<FaceData[]>([]);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const { stream, hasCameraPermission, isLoading: isCameraLoading } = useCamera();
  
  useEffect(() => {
    tempCanvasRef.current = document.createElement('canvas');
    let loadedFaceLandmarker: FaceLandmarker | undefined;
    let loadedCnnModel: tf.LayersModel | undefined;

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
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 20,
        });
        loadedFaceLandmarker = landmarker;
        setFaceLandmarker(landmarker);

        await tf.setBackend('webgl');
        const model = await tf.loadLayersModel('/model/model.json');
        loadedCnnModel = model;
        setCnnModel(model);

        setModelsLoaded(true);
      } catch (error) {
        console.error("Failed to load AI models:", error);
        toast({
          variant: 'destructive',
          title: 'ไม่สามารถโหลดโมเดล AI',
          description: 'โปรดตรวจสอบ Console เพื่อดูรายละเอียดและรีเฟรชหน้าเว็บ',
        });
      }
    };
    loadModels();
    
    return () => {
      loadedFaceLandmarker?.close();
      loadedCnnModel?.dispose();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [toast]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Video play failed:", e));
    }
  }, [stream]);

  useEffect(() => {
    const dataCaptureInterval = setInterval(async () => {
      setFacesForDisplay([...liveCroppedFaces]);
      
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
          timestamp: format(new Date(), 'HH:mm:ss น.'),
          personCount: avgPersonCount,
          interested: interestedPercent,
          uninterested: uninterestedPercent,
        };
        
        setHistoricalData(prevData => [newDisplayEntry, ...prevData]);

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
    }, 60000); // Save every 1 minute

    return () => {
      clearInterval(dataCaptureInterval);
    };
  }, [sessionInfo.id, toast, liveCroppedFaces]);

  const predictWebcam = useCallback(async () => {
    if (!faceLandmarker || !cnnModel || !videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState < 3) { // Check if video has enough data to play
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }
    
    const results = faceLandmarker.detectForVideo(video, performance.now());

    const ctx = canvas.getContext('2d');
    if (ctx && results.faceLandmarks) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let currentInterested = 0;
      const faceImages: FaceData[] = [];

      for (const landmarks of results.faceLandmarks) {
        let minX = video.videoWidth, minY = video.videoHeight, maxX = 0, maxY = 0;
        for (const landmark of landmarks) {
            minX = Math.min(minX, landmark.x * video.videoWidth);
            maxX = Math.max(maxX, landmark.x * video.videoWidth);
            minY = Math.min(minY, landmark.y * video.videoHeight);
            maxY = Math.max(maxY, landmark.y * video.videoHeight);
        }
        const padding = 20;

        const x = minX - padding;
        const y = minY - padding;
        const width = (maxX - minX) + (padding * 2);
        const height = (maxY - minY) + (padding * 2);

        const clampedX = Math.max(0, Math.round(x));
        const clampedY = Math.max(0, Math.round(y));
        const clampedWidth = Math.min(Math.round(width), video.videoWidth - clampedX);
        const clampedHeight = Math.min(Math.round(height), video.videoHeight - clampedY);

        if (clampedWidth <= 0 || clampedHeight <= 0) continue;

        const box = { x: clampedX, y: clampedY, width: clampedWidth, height: clampedHeight };
        
        const isInterested = await tf.tidy(() => {
          const faceImage = tf.browser.fromPixels(video)
            .slice([box.y, box.x, 0], [box.height, box.width, 3])
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

        if (isInterested) currentInterested++;
        
        if (tempCanvasRef.current) {
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
      setLiveCroppedFaces(faceImages);
      setRealtimeStudentCount(results.faceLandmarks.length);
      setInterestedCount(currentInterested);
      
      minuteFrameCountRef.current++;
      minuteTotalStudentCountRef.current += results.faceLandmarks.length;
      minuteTotalInterestedCountRef.current += currentInterested;
    }
    
    animationFrameId.current = requestAnimationFrame(predictWebcam);
  }, [faceLandmarker, cnnModel]);

  const handleVideoPlay = useCallback(() => {
    if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
    }
    animationFrameId.current = requestAnimationFrame(predictWebcam);
  }, [predictWebcam]);

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
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>การวิเคราะห์วิดีโอสด</CardTitle>
              <CardDescription>ตรวจจับและวิเคราะห์การมีส่วนร่วมจากวิดีโอแบบเรียลไทม์</CardDescription>
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
                   <div className="flex items-center gap-4">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">วันที่</span>
                          <span className="font-semibold">{sessionInfo.date}</span>
                      </div>
                  </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">นักเรียนทั้งหมด (เรียลไทม์)</CardTitle>
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
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <CardTitle>ข้อมูลย้อนหลัง (สรุปทุก 1 นาที)</CardTitle>
              </div>
              <CardDescription>ภาพรวมการมีส่วนร่วมสำหรับเซสชันปัจจุบัน</CardDescription>
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
                  {historicalData.length > 0 ? (
                    historicalData.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium pl-6">{entry.timestamp}</TableCell>
                        <TableCell className="text-center">{entry.personCount}</TableCell>
                        <TableCell className="text-center">{entry.interested}</TableCell>
                        <TableCell className="text-center pr-6">{entry.uninterested}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        ยังไม่มีข้อมูล... ข้อมูลจะแสดงที่นี่หลังจากผ่านไป 1 นาที
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// Component for the "start session" form
// =================================================================
function StartSessionForm({ onSessionStart }: { onSessionStart: (info: SessionInfo) => void; }) {
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


// =================================================================
// Main Page Component - Renders either the form or the dashboard
// =================================================================
export default function DashboardPage() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  if (!sessionInfo) {
    return <StartSessionForm onSessionStart={setSessionInfo} />;
  }
  
  return <SessionDashboard sessionInfo={sessionInfo} />;
}

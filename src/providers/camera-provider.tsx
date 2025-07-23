'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CameraContextType {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | undefined;
  setSelectedDeviceId: (deviceId: string) => void;
  stream: MediaStream | null;
  hasCameraPermission: boolean | null;
  isLoading: boolean;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export function CameraProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getDevicesAndPermissions = useCallback(async () => {
    setIsLoading(true);
    if (!navigator.mediaDevices?.getUserMedia) {
        console.error("Camera API not supported in this browser.");
        setHasCameraPermission(false);
        setIsLoading(false);
        toast({
            variant: 'destructive',
            title: 'ไม่รองรับกล้อง',
            description: 'เบราว์เซอร์ของคุณไม่รองรับการใช้งานกล้อง',
        });
        return;
    }
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);

      const savedDeviceId = localStorage.getItem('selectedCameraId');
      
      let finalDeviceId;
      if (savedDeviceId && videoDevices.some(d => d.deviceId === savedDeviceId)) {
        finalDeviceId = savedDeviceId;
      } else if (videoDevices.length > 0) {
        finalDeviceId = videoDevices[0].deviceId;
      }
       
       if (finalDeviceId) {
          setSelectedDeviceId(finalDeviceId);
          localStorage.setItem('selectedCameraId', finalDeviceId);
       }
      
      tempStream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'การเข้าถึงกล้องถูกปฏิเสธ',
        description: 'โปรดเปิดใช้งานการเข้าถึงกล้องในการตั้งค่าเบราว์เซอร์ของคุณ',
      });
    } finally {
        setIsLoading(false); 
    }
  }, [toast]);

  useEffect(() => {
    getDevicesAndPermissions();
  }, [getDevicesAndPermissions]);

  const updateSelectedDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('selectedCameraId', deviceId);
  }

  useEffect(() => {
    if (!selectedDeviceId || !hasCameraPermission) {
      // Stop any existing stream if permissions are lost or device is deselected
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      return;
    };

    let isCancelled = false;
    setIsLoading(true);
    
    // Stop previous stream before getting a new one
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: selectedDeviceId } }
    }).then(newStream => {
      if (!isCancelled) {
        setStream(newStream);
      } else {
        // Cleanup if component unmounted while we were getting the stream
        newStream.getTracks().forEach(track => track.stop());
      }
    }).catch(error => {
      console.error('Failed to get new stream:', error);
       if (!isCancelled) {
          toast({
            variant: 'destructive',
            title: 'ไม่สามารถเปิดกล้องได้',
            description: 'ไม่สามารถเปิดใช้งานกล้องที่เลือกได้ โปรดลองอีกครั้ง',
          });
          setStream(null);
       }
    }).finally(() => {
        if (!isCancelled) {
            setIsLoading(false);
        }
    });

    return () => {
      isCancelled = true;
      // This cleanup runs when the component unmounts or dependencies change.
      // The stream is now stopped at the beginning of the effect, so this might be redundant,
      // but it's good practice for safety.
      if (stream) {
          stream.getTracks().forEach(track => track.stop());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId, hasCameraPermission]);


  const value = {
    devices,
    selectedDeviceId,
    setSelectedDeviceId: updateSelectedDevice,
    stream,
    hasCameraPermission,
    isLoading
  };

  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>;
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (context === undefined) {
    throw new Error('useCamera must be used within a CameraProvider');
  }
  return context;
}

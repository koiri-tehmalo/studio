'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CameraContextType {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | undefined;
  setSelectedDeviceId: (deviceId: string) => void;
  stream: MediaStream | null;
  hasCameraPermission: boolean | null;
  isLoading: boolean;
  startStream: () => Promise<void>;
  stopStream: () => void;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export function CameraProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Function to stop the current stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  // Effect to stop stream on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const getDevices = useCallback(async () => {
    try {
      // A quick check for permissions without keeping the stream open
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      tempStream.getTracks().forEach(track => track.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);

      const savedDeviceId = localStorage.getItem('selectedCameraId');
      if (savedDeviceId && videoDevices.some(d => d.deviceId === savedDeviceId)) {
        setSelectedDeviceId(savedDeviceId);
      } else if (videoDevices.length > 0) {
        const firstDeviceId = videoDevices[0].deviceId;
        setSelectedDeviceId(firstDeviceId);
        localStorage.setItem('selectedCameraId', firstDeviceId);
      }
    } catch (error) {
      console.error('Error getting devices:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'การเข้าถึงกล้องถูกปฏิเสธ',
        description: 'โปรดเปิดใช้งานการเข้าถึงกล้องในการตั้งค่าเบราว์เซอร์ของคุณ',
      });
    }
  }, [toast]);

  // Initial load of devices
  useEffect(() => {
    getDevices();
  }, [getDevices]);


  const startStream = useCallback(async () => {
    stopStream(); // Stop any existing stream
    
    if (!selectedDeviceId) {
        toast({
            variant: 'destructive',
            title: 'ไม่พบกล้อง',
            description: 'ไม่สามารถค้นหาอุปกรณ์กล้องได้ โปรดลองอีกครั้ง',
        });
        return;
    }

    setIsLoading(true);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedDeviceId } }
      });
      streamRef.current = newStream;
      setStream(newStream);
      setHasCameraPermission(true);
    } catch (error) {
      console.error('Failed to start new stream:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'ไม่สามารถเปิดกล้องได้',
        description: 'ไม่สามารถเปิดใช้งานกล้องที่เลือกได้ โปรดลองอีกครั้ง',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeviceId, stopStream, toast]);

  const updateSelectedDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('selectedCameraId', deviceId);
  };
  
  const value = {
    devices,
    selectedDeviceId,
    setSelectedDeviceId: updateSelectedDevice,
    stream,
    hasCameraPermission,
    isLoading,
    startStream,
    stopStream,
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

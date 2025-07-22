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
      // We need to get permission first to enumerate all devices
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
        localStorage.setItem('selectedCameraId', finalDeviceId);
      }
      setSelectedDeviceId(finalDeviceId);
      
      // Stop the temporary stream used for getting permissions
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
    // Only run this effect if we have permission and a device is selected
    if (selectedDeviceId && hasCameraPermission) {
      let active = true;
      
      // Stop any previous stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const getNewStream = async () => {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: selectedDeviceId } }
          });
          if (active) {
            setStream(newStream);
          } else {
             newStream.getTracks().forEach(track => track.stop());
          }
        } catch (error) {
          console.error('Failed to get new stream:', error);
          toast({
            variant: 'destructive',
            title: 'ไม่สามารถเปิดกล้องได้',
            description: 'ไม่สามารถเปิดใช้งานกล้องที่เลือกได้ โปรดลองอีกครั้ง',
          });
        }
      };
      
      getNewStream();

      return () => {
        active = false;
        // Cleanup function to stop the stream when the component unmounts or dependencies change
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  // We want this effect to re-run ONLY when selectedDeviceId or hasCameraPermission changes.
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

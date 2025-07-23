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
      // We need to get permission first to be able to enumerate devices with labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      
      // Now we can get the list of all devices
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);

      const savedDeviceId = localStorage.getItem('selectedCameraId');
      
      let finalDeviceId;
      // Check if the saved device is still available
      if (savedDeviceId && videoDevices.some(d => d.deviceId === savedDeviceId)) {
        finalDeviceId = savedDeviceId;
      } else if (videoDevices.length > 0) {
        // Otherwise, use the first available video device
        finalDeviceId = videoDevices[0].deviceId;
      }
       
       if (finalDeviceId) {
          setSelectedDeviceId(finalDeviceId);
          localStorage.setItem('selectedCameraId', finalDeviceId);
       }
      
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
        // We set loading to false here after everything is done.
        // The stream will be set in the next effect.
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
    let isCancelled = false;

    if (selectedDeviceId && hasCameraPermission) {
      setIsLoading(true);
      
      const getNewStream = async () => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: selectedDeviceId } }
          });
          if (!isCancelled) {
            setStream(newStream);
          }
        } catch (error) {
          console.error('Failed to get new stream:', error);
           if (!isCancelled) {
              toast({
                variant: 'destructive',
                title: 'ไม่สามารถเปิดกล้องได้',
                description: 'ไม่สามารถเปิดใช้งานกล้องที่เลือกได้ โปรดลองอีกครั้ง',
              });
              setStream(null);
           }
        } finally {
            if (!isCancelled) {
                setIsLoading(false);
            }
        }
      };
      
      getNewStream();
    } else if (hasCameraPermission === false) {
        setIsLoading(false);
    }

    return () => {
      isCancelled = true;
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

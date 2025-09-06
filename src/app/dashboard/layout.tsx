'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Cpu, LogOut, PanelLeft, ShieldCheck, User, Settings, LifeBuoy, History, Loader2, TestTube } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CameraProvider, useCamera } from '@/providers/camera-provider';
import { useAuth } from '@/providers/auth-provider';
import { useRouter, redirect } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

function CameraSettingsDialog() {
  const { devices, selectedDeviceId, setSelectedDeviceId } = useCamera();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Settings className="mr-2 h-4 w-4" />
          <span>การตั้งค่า</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>การตั้งค่ากล้อง</DialogTitle>
          <DialogDescription>
            เลือกอุปกรณ์กล้องที่คุณต้องการใช้สำหรับการสังเกตการณ์
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid items-center gap-2">
            <Label htmlFor="camera-select">
              เลือกกล้อง
            </Label>
            <Select
              value={selectedDeviceId}
              onValueChange={(value) => {
                if (value) setSelectedDeviceId(value);
              }}
            >
              <SelectTrigger id="camera-select" className="w-full">
                <SelectValue placeholder="เลือกอุปกรณ์" />
              </SelectTrigger>
              <SelectContent>
                {devices.length > 0 ? devices.map((device, index) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </SelectItem>
                )) : <SelectItem value="no-camera" disabled>ไม่พบกล้อง</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SupportDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
           <LifeBuoy className="mr-2 h-4 w-4" />
           <span>สนับสนุน</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>วิธีการใช้งานระบบ</DialogTitle>
          <DialogDescription>
            คำแนะนำสำหรับระบบผู้สังเกตการณ์ห้องเรียน
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4 text-sm text-foreground">
          <p>
            ระบบนี้จะวิเคราะห์การมีส่วนร่วมของนักเรียนแบบเรียลไทม์ โดยมีส่วนประกอบหลักดังนี้:
          </p>
          <ul className="list-none space-y-3">
            <li>
              <h4 className="font-semibold">การวิเคราะห์วิดีโอสด</h4>
              <p className="text-muted-foreground">แสดงภาพจากกล้องพร้อมกรอบสีเขียว (สนใจ) และสีแดง (ไม่สนใจ) รอบใบหน้าที่ตรวจจับได้</p>
            </li>
            <li>
              <h4 className="font-semibold">ข้อมูลเรียลไทม์</h4>
              <p className="text-muted-foreground">การ์ดด้านข้างสรุปจำนวนนักเรียนทั้งหมด และเปอร์เซ็นต์ความสนใจ/ไม่สนใจ ณ ปัจจุบัน</p>
            </li>
            <li>
              <h4 className="font-semibold">ข้อมูลย้อนหลัง</h4>
              <p className="text-muted-foreground">ตารางด้านล่างบันทึกค่าเฉลี่ยการมีส่วนร่วมทุกๆ 1 นาที เพื่อให้สามารถดูแนวโน้มย้อนหลังได้</p>
            </li>
            <li>
              <h4 className="font-semibold">ส่งออกข้อมูล</h4>
              <p className="text-muted-foreground">ปุ่ม "ส่งออกเป็น Excel" จะสร้างไฟล์ CSV ที่มีข้อมูลสรุปและข้อมูลย้อนหลังทั้งหมด</p>
            </li>
             <li>
              <h4 className="font-semibold">การตั้งค่า</h4>
              <p className="text-muted-foreground">คุณสามารถเลือกเปลี่ยนกล้องได้จากเมนู "การตั้งค่า" ที่มุมขวาบน</p>
            </li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// A component to trigger camera initialization
function CameraInitializer() {
    // This hook will trigger the camera provider to ask for permissions and get devices.
    useCamera();
    return null;
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, userName, userRole, userAvatar, logout, setUserAvatar: setAuthAvatar } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (typeof e.target?.result === 'string') {
          const dataUrl = e.target.result;
          try {
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
              avatarUrl: dataUrl
            });
            setAuthAvatar(dataUrl); // Update avatar in auth context
            toast({
              title: 'อัปเดตสำเร็จ',
              description: 'รูปโปรไฟล์ของคุณถูกเปลี่ยนแล้ว'
            });
          } catch (error) {
            console.error("Error updating avatar:", error);
            toast({
              variant: 'destructive',
              title: 'เกิดข้อผิดพลาด',
              description: 'ไม่สามารถอัปเดตโปรไฟล์ได้'
            });
          } finally {
            setIsUploading(false);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleTriggerClick = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <CameraProvider>
      <CameraInitializer />
       <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarChange}
        className="hidden"
        accept="image/*"
        disabled={isUploading}
      />
      <div className="flex flex-col h-screen bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
                <Cpu className="w-8 h-8 text-primary" />
                <span className="font-headline text-xl font-semibold text-foreground">
                ระบบตรวจจับอารมณ์จากใบหน้า
                </span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="overflow-hidden rounded-full"
                >
                  <Avatar>
                    <AvatarImage src={userAvatar || undefined} alt={userName || 'User'} data-ai-hint="user avatar" />
                    <AvatarFallback>{userName ? userName.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{userName || 'My Account'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                 {userRole === 'admin' && (
                  <>
                    <Link href="/admin" passHref>
                      <DropdownMenuItem>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          <span>Admin Panel</span>
                      </DropdownMenuItem>
                    </Link>
                     <Link href="/admin/test-detection" passHref>
                      <DropdownMenuItem>
                          <TestTube className="mr-2 h-4 w-4" />
                          <span>Test Detection</span>
                      </DropdownMenuItem>
                    </Link>
                  </>
                )}
                <Link href="/dashboard/history" passHref>
                  <DropdownMenuItem>
                    <History className="mr-2 h-4 w-4" />
                    <span>ประวัติการสังเกตการณ์</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem onSelect={(e) => {
                  e.preventDefault();
                  handleTriggerClick();
                }} disabled={isUploading}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4" />}
                  <span>เปลี่ยนรูปโปรไฟล์</span>
                </DropdownMenuItem>
                <CameraSettingsDialog />
                <SupportDialog />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                   <LogOut className="mr-2 h-4 w-4" />
                  <span>ออกจากระบบ</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </CameraProvider>
  );
}

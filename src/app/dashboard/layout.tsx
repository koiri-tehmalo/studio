'use client';

import React from 'react';
import Link from 'next/link';
import { Cpu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CameraProvider, useCamera } from '@/providers/camera-provider';

function CameraSettingsDialog() {
  const { devices, selectedDeviceId, setSelectedDeviceId } = useCamera();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          การตั้งค่า
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
          สนับสนุน
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


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CameraProvider>
      <div className="flex flex-col h-screen bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
                <Cpu className="w-8 h-8 text-primary" />
                <span className="font-headline text-xl font-semibold text-foreground">
                  ผู้สังเกตการณ์
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
                    <AvatarImage src="https://placehold.co/40x40.png" alt="User" data-ai-hint="user avatar" />
                    <AvatarFallback>ผ</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>บัญชีของฉัน</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <CameraSettingsDialog />
                <SupportDialog />
                <DropdownMenuSeparator />
                <Link href="/" passHref>
                  <DropdownMenuItem>ออกจากระบบ</DropdownMenuItem>
                </Link>
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

'use client';

import React from 'react';
import Link from 'next/link';
import { Cpu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
            <Cpu className="w-8 h-8 text-primary" />
            <span className="font-headline text-xl font-semibold text-foreground">
              ผู้สังเกตการณ์
            </span>
        </Link>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="overflow-hidden rounded-full"
              >
                <Avatar>
                  <AvatarImage src="https://placehold.co/40x40.png" alt="User" />
                  <AvatarFallback>ผ</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>บัญชีของฉัน</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>การตั้งค่า</DropdownMenuItem>
              <DropdownMenuItem>สนับสนุน</DropdownMenuItem>
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
  );
}

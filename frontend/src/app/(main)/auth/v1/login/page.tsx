import Image from "next/image";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { APP_CONFIG } from "@/config/app-config";

import { LoginForm } from "../../_components/login-form";

export default function LoginV1() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      <Image
        src="/dien-bien-bg.png?v=2"
        alt="Ruộng bậc thang Điện Biên"
        fill
        priority
        unoptimized
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/45" />

      <Card className="relative z-10 w-full max-w-md border-none bg-background/95 shadow-2xl backdrop-blur-sm">
        <CardHeader className="items-center space-y-3 pb-2 text-center">
          <Image src="/logo.png" alt={APP_CONFIG.name} width={64} height={64} className="mx-auto size-16" />
          <div className="space-y-1">
            <h1 className="font-bold text-2xl text-emerald-800 dark:text-emerald-400">{APP_CONFIG.name}</h1>
            <p className="text-muted-foreground text-sm">Đăng nhập để quản lý thửa đất và cây trồng</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm />
          <p className="text-center text-muted-foreground text-xs">
            Chưa có tài khoản?{" "}
            <Link prefetch={false} href="register" className="text-primary">
              Đăng ký
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

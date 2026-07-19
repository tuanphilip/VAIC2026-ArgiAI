"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthApiError, backendUserToAuthUser, login, register } from "@/lib/auth-api";
import { useAuthStore } from "@/stores/auth-store";

const formSchema = z.object({
  username: z.string().min(1, { message: "Vui lòng nhập tên đăng nhập." }),
  password: z.string().min(1, { message: "Vui lòng nhập mật khẩu." }),
});

/**
 * 2 tài khoản demo (1 nông dân, 1 cán bộ) để test nhanh tính năng phân quyền mà không cần
 * đăng ký thủ công. Tự đăng ký nếu chưa tồn tại (409 khi đã có là bình thường, bỏ qua).
 */
const DEMO_ACCOUNTS = {
  farmer: { username: "nongdan_demo", password: "Nongdan123!", full_name: "Nguyễn Văn A", role: "farmer" as const },
  official: { username: "canbo_demo", password: "Canbo123!", full_name: "Cán bộ Demo", role: "official" as const },
};

export function LoginForm() {
  const router = useRouter();
  const authLogin = useAuthStore((s) => s.login);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickLoginRole, setQuickLoginRole] = useState<"farmer" | "official" | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", password: "" },
  });

  const finishLogin = (accessToken: string, backendUser: Parameters<typeof backendUserToAuthUser>[0]) => {
    authLogin(accessToken, backendUserToAuthUser(backendUser));
    router.push("/dashboard/lands");
  };

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const result = await login(data.username, data.password);
      finishLogin(result.access_token, result.user);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đăng nhập thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleQuickLogin(role: "farmer" | "official") {
    setQuickLoginRole(role);
    const account = DEMO_ACCOUNTS[role];
    try {
      try {
        const result = await login(account.username, account.password);
        finishLogin(result.access_token, result.user);
        return;
      } catch (error) {
        // Chỉ tự đăng ký khi backend xác nhận tài khoản chưa đăng nhập được.
        if (!(error instanceof AuthApiError) || error.status !== 401) throw error;
      }
      try {
        await register(account);
      } catch (error) {
        // Một lượt click khác có thể vừa tạo tài khoản. 409 không phải lỗi chết.
        if (!(error instanceof AuthApiError) || error.status !== 409) throw error;
      }
      const result = await login(account.username, account.password);
      finishLogin(result.access_token, result.user);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đăng nhập tài khoản demo.");
    } finally {
      setQuickLoginRole(null);
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="username"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-username">Tên đăng nhập</FieldLabel>
              <Input
                {...field}
                id="login-username"
                type="text"
                placeholder="VD: nongdan_dienbien"
                autoComplete="username"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">Mật khẩu</FieldLabel>
              <Input
                {...field}
                id="login-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>

      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <div className="h-px flex-1 bg-border" />
        Đăng nhập nhanh để test tính năng
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={quickLoginRole !== null}
          onClick={() => handleQuickLogin("farmer")}
        >
          {quickLoginRole === "farmer" ? "Đang vào..." : "Vào với vai Nông dân"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={quickLoginRole !== null}
          onClick={() => handleQuickLogin("official")}
        >
          {quickLoginRole === "official" ? "Đang vào..." : "Vào với vai Cán bộ"}
        </Button>
      </div>
    </form>
  );
}

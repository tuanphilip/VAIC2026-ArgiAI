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
import { NativeSelect } from "@/components/ui/native-select";
import { backendUserToAuthUser, login, register } from "@/lib/auth-api";
import { useAuthStore } from "@/stores/auth-store";

const formSchema = z
  .object({
    username: z.string().min(3, { message: "Tên đăng nhập cần tối thiểu 3 ký tự." }).max(50),
    fullName: z.string().min(2, { message: "Vui lòng nhập họ tên." }).max(100),
    role: z.enum(["farmer", "official"]),
    password: z.string().min(8, { message: "Mật khẩu cần tối thiểu 8 ký tự." }),
    confirmPassword: z.string().min(8, { message: "Vui lòng xác nhận mật khẩu." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp.",
    path: ["confirmPassword"],
  });

export function RegisterForm() {
  const router = useRouter();
  const authLogin = useAuthStore((s) => s.login);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", fullName: "", role: "farmer", password: "", confirmPassword: "" },
  });

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await register({
        username: data.username,
        password: data.password,
        full_name: data.fullName,
        role: data.role,
      });
      const result = await login(data.username, data.password);
      authLogin(result.access_token, backendUserToAuthUser(result.user));
      router.push("/dashboard/lands");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đăng ký thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="fullName"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-full-name">Họ và tên</FieldLabel>
              <Input
                {...field}
                id="register-full-name"
                type="text"
                placeholder="VD: Nguyễn Văn A"
                autoComplete="name"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="username"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-username">Tên đăng nhập</FieldLabel>
              <Input
                {...field}
                id="register-username"
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
          name="role"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-role">Vai trò</FieldLabel>
              <NativeSelect
                id="register-role"
                className="w-full"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              >
                <option value="farmer">Nông dân</option>
                <option value="official">Cán bộ</option>
              </NativeSelect>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-password">Mật khẩu</FieldLabel>
              <Input
                {...field}
                id="register-password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-confirm-password">Xác nhận mật khẩu</FieldLabel>
              <Input
                {...field}
                id="register-confirm-password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Đang đăng ký..." : "Đăng ký"}
      </Button>
    </form>
  );
}

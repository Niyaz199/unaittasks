import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorParam = typeof params.error === "string" ? params.error : "";
  const initialError =
    errorParam === "profile_missing"
      ? "Профиль пользователя не найден или удалён. Войдите снова или обратитесь к администратору."
      : null;

  const user = await getSessionUser();
  if (user) redirect("/my");
  return <LoginForm initialError={initialError} />;
}

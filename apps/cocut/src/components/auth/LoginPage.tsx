import { useState, type FormEvent } from "react";
import { ProductLoginShell } from "@contentco-op/ui";
import { supabase } from "../../lib/supabase";

export function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;

    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  return (
    <ProductLoginShell
      productLabel="Co-Cut"
      description="Drop an interview. Review the timed transcript. Save the strongest quotes before you cut a single frame."
      error={error}
      loading={loading}
      onSubmit={handleSubmit}
      onGoogleLogin={handleGoogleLogin}
      signupHref="/signup"
    />
  );
}

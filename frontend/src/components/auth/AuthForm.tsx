"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OracleView } from "@/components/oracle-object/OracleView";
import { Eyebrow, PrimaryButton, Serif } from "@/components/ui/primitives";

const SESSION_KEY = "oracle-demo-session";
type Mode = "login" | "signup";
type Values = { name: string; email: string; password: string; confirm: string };

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [visible, setVisible] = useState({ password: false, confirm: false });
  const signup = mode === "signup";
  useEffect(() => { if (window.localStorage.getItem(SESSION_KEY)) router.replace("/control"); }, [router]);
  const update = (key: keyof Values, value: string) => { setValues((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); };
  const validate = () => {
    const next: Partial<Record<keyof Values, string>> = {};
    if (signup && !values.name.trim()) next.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = "Enter a valid email address.";
    if (values.password.length < 8) next.password = "Use at least 8 characters.";
    if (signup && values.confirm !== values.password) next.confirm = "Passwords do not match.";
    setErrors(next); return Object.keys(next).length === 0;
  };
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!validate()) return; window.localStorage.setItem(SESSION_KEY, JSON.stringify({ name: values.name || values.email.split("@")[0], email: values.email })); router.push("/control"); };
  return <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-10 pt-12 pb-20 lg:grid-cols-[minmax(0,470px)_1fr] lg:items-center lg:gap-20 lg:pt-20"><section><Eyebrow>{signup ? "Create account" : "Sign in"} · ORACLE</Eyebrow><h1 className="mt-5 font-medium tracking-[-0.05em] text-[clamp(42px,5vw,64px)] leading-none">{signup ? "Enter your ORACLE" : "Welcome"} <Serif className="text-[1.095em] tracking-[-0.01em]">{signup ? "workspace." : "back."}</Serif></h1><p className="mt-5 max-w-[430px] text-[16px] leading-[1.5] text-ink2">{signup ? "Create a local demo session to enter the decision system." : "Enter the ORACLE decision system with a local demo session."}</p><form noValidate onSubmit={submit} className="mt-10 flex flex-col gap-6" aria-describedby="auth-note">{signup && <Field label="Name" name="name" autoComplete="name" value={values.name} error={errors.name} onChange={(value) => update("name", value)} />}<Field label="Email" name="email" type="email" autoComplete="email" value={values.email} error={errors.email} onChange={(value) => update("email", value)} /><PasswordField label="Password" name="password" autoComplete={signup ? "new-password" : "current-password"} value={values.password} visible={visible.password} error={errors.password} onToggle={() => setVisible((current) => ({ ...current, password: !current.password }))} onChange={(value) => update("password", value)} />{signup && <PasswordField label="Confirm password" name="confirm" autoComplete="new-password" value={values.confirm} visible={visible.confirm} error={errors.confirm} onToggle={() => setVisible((current) => ({ ...current, confirm: !current.confirm }))} onChange={(value) => update("confirm", value)} />}<div className="mt-3 flex flex-wrap items-center gap-x-7 gap-y-4"><PrimaryButton type="submit">{signup ? "CREATE ACCOUNT" : "SIGN IN"}</PrimaryButton>{!signup && <Link href="/signup" className="text-[13px] text-ink2 hover:text-gold-deep">Create an account →</Link>}</div></form><p className="mt-12 text-[14px] text-ink2">{signup ? "Already have an account?" : "New to ORACLE?"} <Link href={signup ? "/login" : "/signup"} className="text-ink hover:text-gold-deep">{signup ? "Sign in" : "Create one"} →</Link></p><p id="auth-note" className="mt-5 text-[12px] text-muted">Frontend demo only. No credentials are sent, stored remotely, or verified.</p></section><aside className="relative order-first flex min-h-[280px] items-center justify-center lg:order-none lg:min-h-[520px]"><OracleView variant="hero" label="The ORACLE entry object: a quiet ivory and ink decision instrument marked by a gold line" fallback="/renders/heroSolo.webp" className="h-[300px] w-full max-w-[420px] motion-reduce:transform-none lg:h-[500px] lg:max-w-[580px]" float /><span className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tracking-[0.16em] text-muted uppercase">ORACLE · ENTRY STATE</span></aside></div>;
}

function Field({ label, name, type = "text", autoComplete, value, error, onChange }: { label: string; name: string; type?: string; autoComplete: string; value: string; error?: string; onChange: (value: string) => void }) { return <label className="flex flex-col gap-2"><Eyebrow>{label}</Eyebrow><input name={name} type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} className="border-b border-ink bg-transparent pb-3 text-[18px] outline-none transition-colors focus:border-gold-deep" />{error && <span id={`${name}-error`} role="alert" className="text-[12px] text-oxblood">{error}</span>}</label>; }
function PasswordField({ label, name, autoComplete, value, visible, error, onToggle, onChange }: { label: string; name: "password" | "confirm"; autoComplete: string; value: string; visible: boolean; error?: string; onToggle: () => void; onChange: (value: string) => void }) { return <div className="flex flex-col gap-2"><div className="flex items-center justify-between"><Eyebrow>{label}</Eyebrow><button type="button" onClick={onToggle} className="text-[12px] text-ink2 hover:text-gold-deep" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}>{visible ? "Hide" : "Show"}</button></div><input name={name} aria-label={label} type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} className="border-b border-ink bg-transparent pb-3 text-[18px] outline-none transition-colors focus:border-gold-deep" />{error && <span id={`${name}-error`} role="alert" className="text-[12px] text-oxblood">{error}</span>}</div>; }

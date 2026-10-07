import { AuthForm } from "@/components/auth/AuthForm";
import { LandingHeader } from "@/components/landing/LandingHeader";
export const metadata = { title: "Create account" };
export default function SignupPage() { return <><LandingHeader /><main className="mx-auto w-full max-w-[1440px] px-6 md:px-12 lg:px-16 xl:px-24"><AuthForm mode="signup" /></main></>; }

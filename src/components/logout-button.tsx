"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
export default function LogoutButton(){const router=useRouter();async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.replace("/login");router.refresh()}return <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-[#e2ebe5] bg-white px-4 py-2.5 text-xs font-bold text-[#52645a]"><LogOut size={15}/> Sign out</button>}

import { Link, useLocation } from "wouter";
import { LayoutDashboard, Building2, Briefcase, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Firms", href: "/firms", icon: Building2 },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Digest", href: "/digest", icon: Mail },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border gap-2">
          <span className="font-extrabold text-lg tracking-tight">CPAList</span>
          <span className="text-xs text-muted-foreground font-medium mt-0.5">admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Scraping 21 firms/hour · Email at midnight EST
          </p>
        </div>
      </div>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center px-6 md:hidden">
          <span className="font-extrabold text-lg tracking-tight">CPAList</span>
        </header>
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

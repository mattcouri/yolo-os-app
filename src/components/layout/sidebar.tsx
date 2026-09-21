import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Package,
  ClipboardList,
  Calendar,
  Truck,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onSignOut?: () => void;
  userEmail?: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const navItems = [
  { icon: Home, label: "Início", path: "/" },
  { icon: Package, label: "Inventário - SKUs", path: "/inventory" },
  { icon: ClipboardList, label: "Pedidos", path: "/orders" },
  { icon: Calendar, label: "Calendário", path: "/calendar" },
  { icon: Truck, label: "Entregas", path: "/deliveries" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

export function Sidebar({
  collapsed,
  onToggle,
  onSignOut,
  userEmail,
  darkMode,
  onToggleDarkMode,
}: SidebarProps) {
  const location = useLocation();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold">
              Y
            </div>
            {!collapsed && (
              <span className="font-semibold text-lg">YOLO OS</span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            const linkContent = (
              <Link
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.path}>{linkContent}</div>;
          })}
        </nav>

        <Separator />

        {/* Footer */}
        <div className="p-2 space-y-2">
          {/* Theme toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                onClick={onToggleDarkMode}
                className={cn("w-full", !collapsed && "justify-start gap-3")}
              >
                {darkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
                {!collapsed && <span>{darkMode ? "Modo claro" : "Modo escuro"}</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                {darkMode ? "Modo claro" : "Modo escuro"}
              </TooltipContent>
            )}
          </Tooltip>

          {/* User */}
          {userEmail && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2",
                collapsed && "justify-center px-0"
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  {userEmail.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userEmail}</p>
                </div>
              )}
            </div>
          )}

          {/* Sign out */}
          {onSignOut && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size={collapsed ? "icon" : "default"}
                  onClick={onSignOut}
                  className={cn("w-full", !collapsed && "justify-start gap-3")}
                >
                  <LogOut className="h-5 w-5" />
                  {!collapsed && <span>Sair</span>}
                </Button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">Sair</TooltipContent>
              )}
            </Tooltip>
          )}

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="w-full"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

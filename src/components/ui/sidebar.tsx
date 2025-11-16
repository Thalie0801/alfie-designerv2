import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type SidebarState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  isMobile: boolean;
};

const SidebarContext = React.createContext<SidebarState | undefined>(undefined);

export interface SidebarProviderProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function SidebarProvider({ children, defaultOpen = true }: SidebarProviderProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  // Ici on pourrait détecter le mobile avec matchMedia, mais on garde simple
  const value = React.useMemo(() => ({ open, setOpen, isMobile: false }), [open]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return ctx;
}

/* Trigger pour ouvrir/fermer la sidebar */

export interface SidebarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const SidebarTrigger = React.forwardRef<HTMLButtonElement, SidebarTriggerProps>(
  ({ className, ...props }, ref) => {
    const { open, setOpen } = useSidebar();
    return (
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
          className,
        )}
        {...props}
      >
        {/* Icône hamburger très simple */}
        <span className="sr-only">Basculer la navigation</span>
        <span className="flex flex-col gap-1">
          <span className="block h-0.5 w-4 bg-current" />
          <span className="block h-0.5 w-4 bg-current" />
          <span className="block h-0.5 w-4 bg-current" />
        </span>
      </button>
    );
  },
);
SidebarTrigger.displayName = "SidebarTrigger";

/* Conteneur principal de la sidebar */

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {}

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(({ className, ...props }, ref) => {
  const { open, isMobile } = useSidebar();
  // Ici tu peux adapter le comportement mobile si besoin
  const hiddenOnMobile = isMobile && !open;

  return (
    <aside
      ref={ref}
      data-sidebar-open={open ? "true" : "false"}
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground w-64 shrink-0 transition-transform duration-200",
        hiddenOnMobile && "-translate-x-full",
        className,
      )}
      {...props}
    />
  );
});
Sidebar.displayName = "Sidebar";

/* Contenu et groupes */

export const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex flex-1 flex-col", className)} {...props} />,
);
SidebarContent.displayName = "SidebarContent";

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("px-4 py-3", className)} {...props} />,
);
SidebarHeader.displayName = "SidebarHeader";

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("mt-auto", className)} {...props} />,
);
SidebarFooter.displayName = "SidebarFooter";

export const SidebarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("px-2 py-3", className)} {...props} />,
);
SidebarGroup.displayName = "SidebarGroup";

export const SidebarGroupLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}
      {...props}
    />
  ),
);
SidebarGroupLabel.displayName = "SidebarGroupLabel";

export const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("w-full text-sm", className)} {...props} />,
);
SidebarGroupContent.displayName = "SidebarGroupContent";

/* Menu */

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />
  ),
);
SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn("group/menu-item relative", className)} {...props} />,
);
SidebarMenuItem.displayName = "SidebarMenuItem";

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-2xl border border-transparent bg-transparent p-2 text-left text-sm font-medium text-muted-foreground outline-none ring-sidebar-ring transition-[width,height,padding,color,background-color,border-color] hover:bg-muted/80 hover:text-foreground focus-visible:ring-2 active:bg-muted active:text-foreground disabled:pointer-events-none disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
        outline:
          "bg-card shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-muted hover:text-foreground hover:shadow-[0_0_0_1px_hsl(var(--ring))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sidebarMenuButtonVariants> {
  asChild?: boolean;
  isActive?: boolean;
}

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ asChild = false, isActive = false, variant, size, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        data-active={isActive ? "true" : "false"}
        className={cn(
          sidebarMenuButtonVariants({ variant, size }),
          isActive && "bg-muted text-foreground border-alfie-pink/60",
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarMenuButton.displayName = "SidebarMenuButton";

/* Petit composant "inset" si d'autres fichiers l'utilisent */

export const SidebarInset = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex-1 min-w-0", className)} {...props} />,
);
SidebarInset.displayName = "SidebarInset";

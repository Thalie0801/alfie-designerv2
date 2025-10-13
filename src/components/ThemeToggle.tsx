import { useEffect } from "react";
import { Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.setAttribute("data-theme", "light");
    try {
      localStorage.removeItem("theme");
    } catch (error) {
      // ignore storage errors in restricted environments
    }
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled
      aria-disabled="true"
      className="hover:bg-primary/10 cursor-not-allowed opacity-70"
    >
      <Sun className="h-5 w-5" />
      <span className="sr-only">Thème clair forcé</span>
    </Button>
  );
}

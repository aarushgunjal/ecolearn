import { NavLink } from "react-router-dom";
import { Home, BookOpen, Target, Trophy, Scan } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/lessons", icon: BookOpen, label: "Lessons" },
  { to: "/skill-tree", icon: Target, label: "Skills" },
  { to: "/achievements", icon: Trophy, label: "Badges" },
  { to: "/scanner", icon: Scan, label: "Scan" },
];

export default function MobileNavigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50">
      <div className="flex justify-around items-center px-2 py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
                isActive
                  ? "text-primary bg-secondary/50 scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`
            }
          >
            <Icon size={20} className="mb-1" />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

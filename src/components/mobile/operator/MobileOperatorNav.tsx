import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Route, Truck, Users, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const MobileOperatorNav = () => {
  const location = useLocation();

  const navigationItems = [
    { icon: MapPin, label: 'Mapa', to: '/' },
    { icon: Route, label: 'Rotas', to: '/routes' },
    { icon: Truck, label: 'Caminhões', to: '/trucks' },
    { icon: Users, label: 'Motoristas', to: '/drivers' },
    { icon: Menu, label: 'Menu', to: '/menu' },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-16">
        {navigationItems.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full px-2 transition-colors",
                active 
                  ? "text-blue-600 bg-blue-50" 
                  : "text-gray-500 hover:text-blue-600 hover:bg-gray-50"
              )}
            >
              <item.icon className={cn("h-5 w-5 mb-1", active && "text-blue-600")} />
              <span className={cn("text-xs font-medium", active && "text-blue-600")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileOperatorNav;

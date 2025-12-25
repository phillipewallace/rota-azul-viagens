import React from 'react';
import { Menu, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import MobileOperatorMenu from './MobileOperatorMenu';

interface MobileOperatorHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

const MobileOperatorHeader = ({ title, showBack, onBack }: MobileOperatorHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-40 flex items-center px-4 safe-area-top">
      <div className="flex items-center gap-3 flex-1">
        {showBack ? (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9"
            onClick={handleBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <MobileOperatorMenu />
            </SheetContent>
          </Sheet>
        )}
        
        {title ? (
          <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-blue-600">AlchemyRotas</span>
          </div>
        )}
      </div>
    </header>
  );
};

export default MobileOperatorHeader;

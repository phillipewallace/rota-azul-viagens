
import React from 'react';
import { Loader2 } from 'lucide-react';

interface SplashScreenProps {
  isLoading?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ isLoading = true }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center z-50">
      <div className="text-center space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
            <svg 
              viewBox="0 0 2000 2000" 
              className="w-14 h-14 text-white" 
              fill="currentColor"
            >
              <path d="m1108 636h27l22 1 11 3 11 6 9 9 8 16 2 13-2 12-5 12-8 10-8 6-9 4-16 3h-17v299l8 16 19 37 10 19 12 23 10 19 17 33 24 46 10 18 8 16 15 29 12 22 12 24 11 20 8 16 12 23 10 19 15 29 10 19 14 27 12 22 19 37 12 22 10 19 9 20 3 11v19l-5 16-7 12-12 13-12 9-14 6-15 4-14 1h-715l-17-2-15-5-11-6-10-8-8-8-9-14-4-10-2-12v-11l2-12 6-15 24-46 8-16 12-23 17-33 10-19 18-35 10-19 17-33 10-19 15-29 9-17 8-16 22-43 10-19 15-29 35-68 10-19 15-29 20-39 9-17 1-294h-18l-13-2-10-4-9-7-8-10-5-12-1-4v-16l4-13 7-11 8-7 12-6 8-2z"/>
            </svg>
          </div>
        </div>

        {/* App Name */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            AlchemyRotas
          </h1>
          <p className="text-muted-foreground text-lg">Sistema Mobile</p>
        </div>

        {/* Loading Animation */}
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Carregando...</span>
        </div>

        {/* Progress Bar */}
        <div className="w-64 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary/50 to-primary bg-[length:200%_100%] animate-pulse" />
        </div>
      </div>
    </div>
  );
};

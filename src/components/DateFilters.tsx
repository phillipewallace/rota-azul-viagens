
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface DateFiltersProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  className?: string;
}

// Function to generate months from July 2025 onwards
const generateMonthOptions = () => {
  const options = [{ value: 'all', label: 'Todos os meses' }];
  const currentDate = new Date();
  const startDate = new Date(2025, 6, 1); // July 2025 (month index 6)
  
  // Add months from July 2025 to current month + 12 months ahead
  const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 12, 1);
  
  let iterDate = new Date(startDate);
  while (iterDate <= endDate) {
    const year = iterDate.getFullYear();
    const month = String(iterDate.getMonth() + 1).padStart(2, '0');
    const monthName = iterDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    options.push({
      value: `${year}-${month}`,
      label: monthName.charAt(0).toUpperCase() + monthName.slice(1)
    });
    
    iterDate.setMonth(iterDate.getMonth() + 1);
  }
  
  return options;
};

export const DateFilters = ({ selectedMonth, onMonthChange, className = "" }: DateFiltersProps) => {
  const monthOptions = generateMonthOptions();
  
  return (
    <div className={className}>
      <Label>Período</Label>
      <Select value={selectedMonth} onValueChange={onMonthChange}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

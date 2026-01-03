import { LucideIcon } from 'lucide-react';

export interface DashboardItem {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string; // Tailwind text color class, e.g., 'text-blue-500'
  bgColor: string; // Tailwind bg color class for icon container
}
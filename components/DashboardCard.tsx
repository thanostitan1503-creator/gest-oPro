
import React from 'react';
import { DashboardItem } from '../types';

interface DashboardCardProps {
  item: DashboardItem;
  onClick: (id: string) => void;
  highlight?: boolean;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ item, onClick, highlight }) => {
  const Icon = item.icon;

  const highlightClasses = highlight
    ? 'ring-4 ring-red-500/90 shadow-[0_0_30px_rgba(239,68,68,0.45)] border-red-400 animate-pulse'
    : '';

  return (
    <button
      onClick={() => onClick(item.id)}
      className={`group flex flex-col items-center justify-center p-6 bg-surface rounded-2xl shadow-sm border border-bdr hover:shadow-xl hover:border-slate-400 transition-all duration-300 ease-out transform hover:-translate-y-2 h-36 w-full relative overflow-hidden ${highlightClasses}`}
    >
      {/* Decorative gradient blob that appears on hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br ${item.bgColor.replace('bg-', 'from-')} to-transparent`} />

      <div className={`p-3 rounded-full mb-3 ${item.bgColor} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 z-10`}>
        <Icon className={`w-8 h-8 ${item.color}`} strokeWidth={2} />
      </div>
      <span className="text-txt-muted font-bold text-sm tracking-wide group-hover:text-txt-main z-10 transition-colors">
        {item.label}
      </span>
    </button>
  );
};

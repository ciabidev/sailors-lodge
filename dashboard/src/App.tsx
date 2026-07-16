import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Landing } from '@/pages/Landing';

const Dashboard = lazy(() => import('@/pages/Dashboard').then((module) => ({ default: module.Dashboard })));

export function App() {
  return <Routes><Route path="/" element={<Landing />} /><Route path="/dashboard/:guildId?/:section?" element={<Suspense fallback={<div className="min-h-screen bg-[#303446]" />}><Dashboard /></Suspense>} /><Route path="*" element={<Landing />} /></Routes>;
}

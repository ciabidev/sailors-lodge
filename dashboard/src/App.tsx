import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Landing } from '@/pages/Landing';

const Dashboard = lazy(() => import('@/pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Status = lazy(() => import('@/pages/Status').then((module) => ({ default: module.Status })));

export function App() {
  return <Routes><Route path="/" element={<Landing />} /><Route path="/status" element={<Suspense fallback={<div className="min-h-screen bg-[#303446]" />}><Status /></Suspense>} /><Route path="/dashboard/:guildId?/:section?" element={<Suspense fallback={<div className="min-h-screen bg-[#303446]" />}><Dashboard /></Suspense>} /><Route path="*" element={<Landing />} /></Routes>;
}

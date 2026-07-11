import { Landing } from '@/pages/Landing';
import { Dashboard } from '@/pages/Dashboard';
import { usePath } from '@/lib/router';

export function App() {
  const path = usePath();
  return path.startsWith('/dashboard') ? <Dashboard /> : <Landing />;
}

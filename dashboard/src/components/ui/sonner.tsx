import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return <Sonner theme="dark" richColors position="bottom-right" toastOptions={{ classNames: { toast: 'border-[#626880] bg-[#303446] text-[#c6d0f5]' } }} {...props} />;
}

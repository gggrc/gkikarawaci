// src/components/AuthLayout.tsx
type Props = {
  children: React.ReactNode;
  title: string;
  quote?: string;
  verse?: string;
};

export default function AuthLayout({ children, title, quote, verse }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/backgroundLogin.jpg')] bg-cover bg-center p-4">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative mx-auto flex flex-col md:flex-row w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-sm">
        <div className="flex-1 p-8 text-white hidden md:flex flex-col justify-center items-start"> 
          <h1 className="mb-6 text-4xl font-bold">{title}</h1>
          {quote && <p className="text-lg italic">{quote}</p>}
          {verse && <h4 className="mt-3 text-xl font-bold italic">{verse}</h4>}
        </div>
        <div className="flex-1 w-full bg-white p-6 sm:p-10 flex justify-center items-center">
          {children}
        </div>
      </div>
    </div>
  );
}
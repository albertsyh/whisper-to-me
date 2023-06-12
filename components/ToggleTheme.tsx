'use client';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { MoonIcon, SunIcon } from '@heroicons/react/24/solid';

const ToggleTheme = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  if (!mounted) {
    return null;
  }

  return (
    <button
      className="bg-slate-900 hover:text-slate-100 hover:bg-slate-500 dark:bg-slate-100 dark:hover:bg-slate-500 text-slate-100 dark:text-slate-900 dark:hover:text-slate-100 py-2 px-4 rounded-full w-12"
      onClick={handleToggle}
    >
      {theme === 'dark' ? (
        <SunIcon className="h-4 inline" />
      ) : (
        <MoonIcon className="h-4 inline" />
      )}
    </button>
  );
};

export default ToggleTheme;

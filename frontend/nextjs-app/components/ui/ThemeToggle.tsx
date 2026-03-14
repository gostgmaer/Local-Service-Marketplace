'use client';

import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';

/**
 * Dark Mode Toggle Component
 * Allows users to switch between light, dark, and system themes
 * Persists preference in localStorage via zustand
 */
export function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
      aria-label="Toggle dark mode"
      title={`Current theme: ${theme} (Click to switch to ${theme === 'light' ? 'dark' : 'light'} mode)`}
    >
      {isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}

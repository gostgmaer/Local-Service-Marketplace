"use client";

import React, { ReactNode } from "react";
import { Layout } from "./Layout";

interface SettingsLayoutProps {
  children: ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <Layout>
      <div className="container-custom py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {children}
        </div>
      </div>
    </Layout>
  );
}

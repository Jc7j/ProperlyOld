"use client";

import { useTheme } from "next-themes";
import { type ReactNode } from "react";
import {
  Toaster as Sonner,
  type ToasterProps as SonnerToasterProps,
  toast,
} from "sonner";
import { cn } from "~/lib/utils/cn";

// Extend the base toast options
interface ExtendedToastOptions {
  classNames?: {
    toast?: string;
    description?: string;
    actionButton?: string;
    cancelButton?: string;
  };
  duration?: number;
  icon?: ReactNode;
}

// Define our custom props
interface ToasterProps extends Omit<SonnerToasterProps, "toastOptions"> {
  toastOptions?: ExtendedToastOptions;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      closeButton
      expand={true}
      position="top-right"
      toastOptions={{
        classNames: {
          toast: cn(
            "group toast rounded-xl p-4 shadow-lg flex gap-3",
            "dark:bg-opacity-20 dark:border-opacity-20",
          ),
          title: "text-base font-semibold",
          description: "text-sm",
          actionButton: "rounded-full px-4 py-2 text-sm font-medium border",
        },
        duration: 5000,
      }}
      {...props}
    />
  );
};

// Custom toast functions with proper icons
const SuccessToast = (message: string, options?: ExtendedToastOptions) => {
  return toast.success(message, options);
};

const ErrorToast = (message: string, options?: ExtendedToastOptions) => {
  return toast.error(message, options);
};

const WarningToast = (message: string, options?: ExtendedToastOptions) => {
  return toast.warning(message, options);
};

const InfoToast = (message: string, options?: ExtendedToastOptions) => {
  return toast.info(message, options);
};

export { Toaster, SuccessToast, ErrorToast, WarningToast, InfoToast };

// Usage:
/*
import { SuccessToast, ErrorToast, WarningToast, InfoToast } from '@/components/ui/sonner'

// Success toast
SuccessToast('Facility created successfully!')

// Error toast
ErrorToast('Failed to create Facility')

// Warning toast
WarningToast('Your session is about to expire')

// Info toast
InfoToast('New booking available')

// With options
SuccessToast('Success message', {
  duration: 3000,
  classNames: {
    toast: 'custom-class'
  }
})
*/

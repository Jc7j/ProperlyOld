"use client";

import { useOrganizationList } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

const groupSchema = z.object({
  name: z.string().min(2, "Group name must be at least 2 characters"),
  slug: z.string().min(2, "URL must be at least 2 characters"),
});

type GroupValues = z.infer<typeof groupSchema>;

export function CreateGroupStep({ onNext, onBack }: StepProps) {
  const { createOrganization, isLoaded } = useOrganizationList();
  const [isCreating, setIsCreating] = useState(false);
  const form = useForm<GroupValues>({
    resolver: zodResolver(groupSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  // Watch form fields for slug generation
  const name = useWatch({
    control: form.control,
    name: "name",
  });

  const slug = useWatch({
    control: form.control,
    name: "slug",
  });

  // Auto-generate slug from name
  useEffect(() => {
    if (name && !slug) {
      const newSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      form.setValue("slug", newSlug, { shouldValidate: true });
    }
  }, [name, slug, form]);

  async function onSubmit(data: GroupValues) {
    if (!isLoaded || !createOrganization) {
      console.error("Organization creation is not available");
      return;
    }

    try {
      setIsCreating(true);
      await createOrganization({
        name: data.name,
        slug: data.slug,
      });
      onNext();
    } catch (error) {
      console.error("Failed to create group:", error);
      form.setError("root", {
        message: "Failed to create group. Please try again.",
      });
    } finally {
      setIsCreating(false);
    }
  }

  const isFormValid = form.formState.isValid && name && slug;

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Create Your Management Group
        </h2>
        <p className="text-muted-foreground text-lg">
          This will be your organization&apos;s workspace
        </p>
      </div>
      <div className="mx-auto max-w-md space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Group Name</label>
            <input
              {...form.register("name")}
              className="bg-background focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm transition-all outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter your group name"
              disabled={isCreating}
            />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Group URL</label>
            <div className="bg-background focus-within:ring-primary/20 flex rounded-lg border transition-all focus-within:ring-4">
              <span className="text-muted-foreground flex items-center pl-3 text-sm">
                properly.com/
              </span>
              <input
                {...form.register("slug")}
                className="bg-background w-full rounded-r-lg px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="your-group"
                disabled={isCreating}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase();
                  form.setValue("slug", value, { shouldValidate: true });
                }}
              />
            </div>
            {form.formState.errors.slug && (
              <p className="text-destructive text-sm">
                {form.formState.errors.slug.message}
              </p>
            )}
          </div>

          {form.formState.errors.root && (
            <p className="text-destructive bg-destructive/10 rounded-lg p-3 text-sm">
              {form.formState.errors.root.message}
            </p>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={onBack}
              className="text-muted-foreground hover:bg-muted inline-flex h-10 items-center justify-center rounded-lg border px-8 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isCreating}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isCreating}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-8 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreating ? "Creating..." : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

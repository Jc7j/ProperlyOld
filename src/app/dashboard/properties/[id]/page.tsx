"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import dayjs from "~/lib/utils/day";

export default function PropertyIdPage() {
  const params = useParams();
  const propertyId = params.id as string;

  const { data: property, isLoading } = api.property.getOne.useQuery({
    propertyId,
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="bg-muted h-8 w-[200px] animate-pulse rounded-md" />
        <div className="mt-4 space-y-4">
          <div className="bg-muted/50 h-4 w-1/3 animate-pulse rounded-sm" />
          <div className="bg-muted/50 h-4 w-1/2 animate-pulse rounded-sm" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-semibold text-red-600">
          Property not found
        </h1>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{property.name}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-medium">Location Information</h2>
          <div className="text-muted-foreground mt-2">
            {property.locationInfo ? (
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(
                  JSON.parse(property.locationInfo as string),
                  null,
                  2,
                )}
              </pre>
            ) : (
              "No location information available"
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-medium">Owner Details</h2>
          <div className="text-muted-foreground mt-2">
            {property.owner ? (
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(JSON.parse(property.owner as string), null, 2)}
              </pre>
            ) : (
              "No owner information available"
            )}
          </div>
        </div>
      </div>

      <div className="text-muted-foreground text-sm">
        Last updated: {dayjs(property.updatedAt).fromNow()}
      </div>
    </div>
  );
}

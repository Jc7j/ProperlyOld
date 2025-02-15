"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "~/components/ui";
import { api } from "~/trpc/react";
import dayjs from "~/lib/utils/day";

export default function PropertiesPage() {
  const { data: properties, isLoading } = api.property.getMany.useQuery();

  if (isLoading) {
    return <PropertiesTableSkeleton />;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Properties</h1>
        {/* Add property button can go here */}
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Name</TableHeader>
            <TableHeader>Location</TableHeader>
            <TableHeader>Owner</TableHeader>
            <TableHeader>Last Updated</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {properties?.map((property) => (
            <TableRow
              key={property.id}
              className="hover:bg-muted/50 cursor-pointer"
              onClick={() =>
                (window.location.href = `/dashboard/properties/${property.id}`)
              }
            >
              <TableCell className="font-medium">{property.name}</TableCell>
              <TableCell>
                {property.locationInfo
                  ? JSON.parse(property.locationInfo as string).address
                  : "No location set"}
              </TableCell>
              <TableCell>
                {property.owner
                  ? JSON.parse(property.owner as string).name
                  : "No owner set"}
              </TableCell>
              <TableCell>
                {property.updatedAt
                  ? dayjs(property.updatedAt).fromNow()
                  : "Never"}
              </TableCell>
            </TableRow>
          ))}
          {properties?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground h-24 text-center"
              >
                No properties found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function PropertiesTableSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-8 w-[200px] animate-pulse rounded-md" />
      </div>

      <div className="rounded-md border">
        <div className="bg-muted/50 border-b px-4 py-3">
          <div className="flex">
            <div className="bg-muted h-4 w-1/4 animate-pulse rounded" />
            <div className="bg-muted ml-4 h-4 w-1/4 animate-pulse rounded" />
            <div className="bg-muted ml-4 h-4 w-1/4 animate-pulse rounded" />
            <div className="bg-muted ml-4 h-4 w-1/4 animate-pulse rounded" />
          </div>
        </div>
        <div className="divide-y">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center">
                <div className="bg-muted/50 h-4 w-1/4 animate-pulse rounded" />
                <div className="bg-muted/50 ml-4 h-4 w-1/4 animate-pulse rounded" />
                <div className="bg-muted/50 ml-4 h-4 w-1/4 animate-pulse rounded" />
                <div className="bg-muted/50 ml-4 h-4 w-1/4 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

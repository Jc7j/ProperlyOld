'use client'

import { CreateOrganization } from '@clerk/nextjs'
import React from 'react'

export function CreateGroupStep() {
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
      <div className="mx-auto max-w-md">
        <CreateOrganization
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'w-full shadow-none p-0',
              form: 'w-full',
              formButtonPrimary: 'bg-primary hover:bg-primary/90',
              formFieldInput: 'bg-white dark:bg-zinc-900',
              organizationSwitcherTrigger: 'hidden',
            },
          }}
          skipInvitationScreen
          routing="path"
          path="/dashboard"
          afterCreateOrganizationUrl="/dashboard"
        />
      </div>
    </div>
  )
}

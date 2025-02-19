'use server'

import { type WebhookEvent, clerkClient } from '@clerk/nextjs/server'
import { type Prisma } from '@prisma/client'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { env } from '~/env'
import { stripe } from '~/lib/stripe/stripe'
import { db } from '~/server/db'

export async function POST(req: Request) {
  const SIGNING_SECRET = env.SIGNING_SECRET

  if (!SIGNING_SECRET) {
    throw new Error(
      'Error: Please add SIGNING_SECRET from Clerk Dashboard to .env or .env.local'
    )
  }

  // Create new Svix instance with secret
  const wh = new Webhook(SIGNING_SECRET)

  // Get headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing Svix headers', {
      status: 400,
    })
  }

  // Get body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  let evt: WebhookEvent

  // Verify payload with headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error: Could not verify webhook:', err)
    return new Response('Error: Verification error', {
      status: 400,
    })
  }

  if (evt.type === 'user.created') {
    try {
      const { id: clerkId, email_addresses } = evt.data
      const email = email_addresses[0]?.email_address

      if (!email) {
        throw new Error('No email found for user')
      }

      // Check if user exists and has groups
      const existingUser = await db.user.findUnique({
        where: { id: clerkId },
      })

      // If user exists and has groups, they're already set up
      if (existingUser?.groups) {
        return new Response('User already exists with groups', { status: 200 })
      }

      // If user exists but no groups, just return
      if (existingUser) {
        return new Response('User exists', { status: 200 })
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        description: 'User',
        metadata: {
          userId: clerkId,
        },
      })

      // Create new user in our database
      await db.user.create({
        data: {
          id: clerkId,
          email,
          stripe: {
            customerId: customer.id,
            plan: 'free',
          } as Prisma.JsonObject,
          groups: [] as Prisma.JsonArray,
        },
      })

      return new Response('User created successfully', { status: 200 })
    } catch (error) {
      console.error('Error in user.created webhook:', error)
      return new Response('Error processing user creation', { status: 500 })
    }
  }

  if (evt.type === 'organization.created') {
    try {
      const { id: clerkOrgId, name, slug, created_by } = evt.data

      if (!created_by) {
        throw new Error('Organization creator not found')
      }

      // Check if group already exists
      const existingGroup = await db.managementGroup.findUnique({
        where: { id: clerkOrgId },
      })

      if (existingGroup) {
        return new Response('Organization already exists', { status: 200 })
      }

      // Get user to ensure they exist
      const user = await db.user.findUnique({
        where: { id: created_by },
      })

      if (!user) {
        throw new Error('User not found in database')
      }

      // Create Stripe customer for organization
      const customer = await stripe.customers.create({
        name,
        description: 'Organization',
        metadata: {
          organizationId: clerkOrgId,
        },
      })

      // Create organization in our database
      await db.managementGroup.create({
        data: {
          id: clerkOrgId,
          name,
          slug,
          ownerId: created_by,
          stripe: {
            customerId: customer.id,
            plan: 'free',
          },
        },
      })

      // Update user's groups
      const currentGroups = (user.groups as { groupId: string }[]) || []
      await db.user.update({
        where: { id: created_by },
        data: {
          groups: [
            ...currentGroups,
            { groupId: clerkOrgId },
          ] as Prisma.JsonArray,
        },
      })

      // Mark onboarding as complete
      await clerkClient.users.updateUser(created_by, {
        publicMetadata: {
          onboardingComplete: true,
        },
      })

      return new Response('Organization created successfully', { status: 200 })
    } catch (error) {
      console.error('Error in organization.created webhook:', error)
      return new Response('Error processing organization creation', {
        status: 500,
      })
    }
  }

  if (evt.type === 'organizationInvitation.accepted') {
    try {
      const { organization_id, email_address } = evt.data

      if (!organization_id || !email_address) {
        throw new Error('Missing organization ID or email address')
      }

      // Get user from Clerk
      const clerkUsers = await clerkClient.users.getUserList({
        emailAddress: [email_address],
      })

      const clerkUser = clerkUsers.data[0]
      if (!clerkUser) {
        throw new Error('No Clerk user found with this email')
      }

      // Get or create user in our database
      let user = await db.user.findUnique({
        where: { id: clerkUser.id },
      })

      if (!user) {
        // Create Stripe customer
        const customer = await stripe.customers.create({
          email: email_address,
          description: 'User',
          metadata: {
            userId: clerkUser.id,
          },
        })

        // Create user with initial group
        user = await db.user.create({
          data: {
            id: clerkUser.id,
            email: email_address,
            stripe: {
              customerId: customer.id,
              plan: 'free',
            } as Prisma.JsonObject,
            groups: [{ groupId: organization_id }] as Prisma.JsonArray,
          },
        })
      } else {
        // Add organization to existing user's groups
        const currentGroups = (user.groups as { groupId: string }[]) || []
        if (!currentGroups.some((group) => group.groupId === organization_id)) {
          await db.user.update({
            where: { id: clerkUser.id },
            data: {
              groups: [
                ...currentGroups,
                { groupId: organization_id },
              ] as Prisma.JsonArray,
            },
          })
        }
      }

      return new Response('Organization invitation processed', { status: 200 })
    } catch (error) {
      console.error('Error in organizationInvitation.accepted webhook:', error)
      return new Response('Error processing invitation acceptance', {
        status: 500,
      })
    }
  }

  return new Response('Webhook processed', { status: 200 })
}

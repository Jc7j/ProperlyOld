"use server";

import { type WebhookEvent, clerkClient } from "@clerk/nextjs/server";
import { type Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { env } from "~/env";
import { stripe } from "~/lib/stripe/stripe";
import { type StripeUser } from "~/server/api/types";
import { db } from "~/server/db";

export async function POST(req: Request) {
  const SIGNING_SECRET = env.SIGNING_SECRET;

  if (!SIGNING_SECRET) {
    throw new Error(
      "Error: Please add SIGNING_SECRET from Clerk Dashboard to .env or .env.local",
    );
  }

  // Create new Svix instance with secret
  const wh = new Webhook(SIGNING_SECRET);

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing Svix headers", {
      status: 400,
    });
  }

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  let evt: WebhookEvent;

  // Verify payload with headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error: Could not verify webhook:", err);
    return new Response("Error: Verification error", {
      status: 400,
    });
  }

  if (evt.type === "user.created") {
    try {
      const { id: clerkId, email_addresses } = evt.data;
      const email = email_addresses[0]?.email_address;

      if (!email) {
        throw new Error("No email found for user");
      }

      const existingUser = await db.user.findFirst({
        where: {
          id: clerkId,
        },
      });

      if (existingUser) {
        throw new Error("User already exists");
      }

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email,
        description: "User",
        metadata: {
          userId: clerkId,
        },
      });

      if (!customer) {
        throw new Error("Failed to create Stripe customer");
      }

      // Prepare stripe data
      const stripeData: StripeUser = {
        customerId: customer.id,
        plan: "free",
      };

      // Create user with Clerk ID as primary key
      const user = await db.user.create({
        data: {
          id: clerkId, // Use Clerk ID as our primary key
          email,
          stripe: stripeData as Prisma.JsonObject,
          groups: [], // Initialize empty facilities array
        },
      });

      if (!user) {
        throw new Error("Failed to create user");
      }

      return new Response("User created successfully", { status: 200 });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return new Response("Error processing webhook", { status: 500 });
    }
  }

  if (evt.type === "organization.created") {
    try {
      const { id: clerkOrgId, name, slug, created_by } = evt.data;
      const client = await clerkClient();

      if (!created_by) {
        throw new Error("Organization creator not found");
      }

      const existingGroup = await db.managementGroup.findFirst({
        where: {
          id: clerkOrgId,
        },
      });

      if (existingGroup) {
        throw new Error("Group already exists");
      }

      const customer = await stripe.customers.create({
        name,
        description: "Facility",
        metadata: {
          facilityId: clerkOrgId,
        },
      });

      if (!customer) {
        throw new Error("Failed to create Stripe customer");
      }

      const group = await db.managementGroup.create({
        data: {
          id: clerkOrgId,
          name,
          slug,
          ownerId: created_by,
          stripe: {
            customerId: customer.id,
            plan: "free",
          },
        },
      });

      if (!group) {
        throw new Error("Failed to create group");
      }

      const user = await db.user.update({
        where: {
          id: created_by,
        },
        data: {
          groups: {
            push: {
              groupId: clerkOrgId,
            },
          },
        },
      });

      await client.users.updateUser(created_by, {
        publicMetadata: {
          onboardingComplete: true,
        },
      });

      if (!user) {
        throw new Error("Failed to update user");
      }

      return new Response("Organization created successfully", { status: 200 });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return new Response("Error processing webhook", { status: 500 });
    }
  }

  return new Response("Webhook processed", { status: 200 });
}

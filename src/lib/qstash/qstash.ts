import { env } from "~/env";
import { Client, Receiver } from "@upstash/qstash"

export const qstashClientPublish = new Client({
  token: env.QSTASH_TOKEN,
})

export const qstashClientReceive = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
})

/**
 * Verify the QStash signature from webhook requests
 * @param headers The request headers containing the Upstash-Signature
 * @param body The raw request body as a string
 * @returns Promise<boolean> indicating if the signature is valid
 */
export async function verifyQStashSignature(
  headers: Headers,
  body: string,
): Promise<boolean> {
  try {
    return await qstashClientReceive.verify({
      signature: headers.get("Upstash-Signature") ?? "",
      body,
    });
  } catch (error) {
    console.error("[QSTASH_VERIFY_ERROR]", error);
    return false;
  }
}


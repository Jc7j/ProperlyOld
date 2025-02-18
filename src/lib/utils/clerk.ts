import { clerkClient } from '@clerk/nextjs/server'

export interface UserDisplayInfo {
  name: string
  imageUrl: string
}

export async function getUserDisplayInfo(
  userId: string
): Promise<UserDisplayInfo> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  return {
    name:
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : (user.firstName ?? user.lastName ?? 'Unknown User'),
    imageUrl:
      user.imageUrl ??
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user.firstName ?? ''
      )}+${encodeURIComponent(user.lastName ?? '')}&background=random`,
  }
}

export async function getUsersDisplayInfo(
  userIds: string[]
): Promise<Map<string, UserDisplayInfo>> {
  const client = await clerkClient()
  const users = await Promise.all(userIds.map((id) => client.users.getUser(id)))

  return new Map(
    users.map((user) => [
      user.id,
      {
        name:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : (user.firstName ?? user.lastName ?? 'Unknown User'),
        imageUrl:
          user.imageUrl ??
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            user.firstName ?? ''
          )}+${encodeURIComponent(user.lastName ?? '')}&background=random`,
      },
    ])
  )
}

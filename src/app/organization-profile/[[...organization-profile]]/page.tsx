import { OrganizationProfile } from '@clerk/nextjs'

export default function OrganizationProfilePage() {
  return (
    <div className="h-full min-h-screen w-full bg-white dark:bg-zinc-950">
      <OrganizationProfile />
    </div>
  )
}

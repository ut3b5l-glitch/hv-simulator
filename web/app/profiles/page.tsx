import { getProfiles } from "@/lib/data";
import ProfilesBrowser from "@/components/ProfilesBrowser";
import PageHeader from "@/components/PageHeader";

export default async function ProfilesPage() {
  const profiles = await getProfiles();
  if (!profiles) {
    return <div className="pt-10 text-center text-ink-60">No profile data.</div>;
  }
  return (
    <div className="space-y-5 pb-8">
      <PageHeader eyebrow={`As of ${profiles.as_of}`} title="Profiles" />
      <ProfilesBrowser profiles={profiles} />
    </div>
  );
}

import { getProfiles } from "@/lib/data";
import ProfilesBrowser from "@/components/ProfilesBrowser";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export default async function ProfilesPage() {
  const profiles = await getProfiles();
  if (!profiles) {
    return (
      <EmptyState
        title="No profiles yet"
        hint="Run python export_data.py to publish jockey, trainer & horse stats."
      />
    );
  }
  return (
    <div className="space-y-5 pb-8">
      <PageHeader eyebrow={`As of ${profiles.as_of}`} title="Profiles" />
      <ProfilesBrowser profiles={profiles} />
    </div>
  );
}

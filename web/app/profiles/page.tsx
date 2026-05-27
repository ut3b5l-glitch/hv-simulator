import { getProfiles } from "@/lib/data";
import ProfilesBrowser from "@/components/ProfilesBrowser";

export default async function ProfilesPage() {
  const profiles = await getProfiles();
  if (!profiles) {
    return <div className="pt-10 text-center text-white/60">No profile data.</div>;
  }
  return (
    <div className="space-y-5 pb-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">
          As of {profiles.as_of}
        </div>
        <h1 className="mt-0.5 text-[28px] font-semibold leading-tight">Profiles</h1>
      </header>
      <ProfilesBrowser profiles={profiles} />
    </div>
  );
}

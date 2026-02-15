import { notFound } from 'next/navigation';
import { fetchPublicApi, ApiError } from '@/lib/api';

interface Certification {
  title: string;
  issuer: string | null;
  issuedAt: string | null;
}

interface InstructorProfile {
  id: string;
  slug: string;
  isPublic: boolean;
  displayName: string;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  bio: string | null;
  certifications: Certification[];
  provider: { id: string; name: string } | null;
}

interface ApiResponse {
  success: boolean;
  data: InstructorProfile;
}

async function getInstructorProfile(slug: string): Promise<InstructorProfile | null> {
  try {
    const res = await fetchPublicApi<ApiResponse>(`/public/instructors/${encodeURIComponent(slug)}`);
    return res.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export default async function InstructorProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const profile = await getInstructorProfile(params.slug);

  if (!profile) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Cover */}
      <section className="relative h-48 bg-green-700">
        {profile.coverImageUrl && (
          <img
            src={profile.coverImageUrl}
            alt="커버 이미지"
            className="h-full w-full object-cover"
          />
        )}
      </section>

      {/* Header */}
      <section className="mx-auto max-w-2xl px-4">
        <div className="relative -mt-12 flex items-end gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-gray-200">
            {profile.profileImageUrl ? (
              <img
                src={profile.profileImageUrl}
                alt={profile.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-gray-400">
                {profile.displayName.charAt(0)}
              </div>
            )}
          </div>
          <div className="pb-2">
            <h1 className="text-2xl font-bold text-gray-900">{profile.displayName}</h1>
            {profile.provider && (
              <p className="text-sm text-gray-500">{profile.provider.name}</p>
            )}
          </div>
        </div>
      </section>

      {/* Bio */}
      {profile.bio && (
        <section className="mx-auto mt-6 max-w-2xl px-4">
          <h2 className="text-lg font-semibold text-gray-800">소개</h2>
          <p className="mt-2 text-gray-600">{profile.bio}</p>
        </section>
      )}

      {/* Certifications */}
      {profile.certifications.length > 0 && (
        <section className="mx-auto mt-6 max-w-2xl px-4">
          <h2 className="text-lg font-semibold text-gray-800">자격/인증</h2>
          <ul className="mt-2 space-y-2">
            {profile.certifications.map((cert, idx) => (
              <li
                key={idx}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <p className="font-medium text-gray-800">{cert.title}</p>
                {cert.issuer && (
                  <p className="text-sm text-gray-500">{cert.issuer}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Footer */}
      <footer className="mx-auto mt-12 max-w-2xl px-4 pb-8 text-center text-xs text-gray-400">
        Powered by SoopTalk
      </footer>
    </main>
  );
}

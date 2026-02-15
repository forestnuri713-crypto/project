import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Metadata } from 'next';
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

const getInstructorProfile = cache(async (slug: string): Promise<InstructorProfile | null> => {
  try {
    const res = await fetchPublicApi<ApiResponse>(`/public/instructors/${encodeURIComponent(slug)}`);
    return res.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';
const BRAND = '숲똑';
const FALLBACK_DESCRIPTION = '숲체험 강사 소개 페이지입니다.';

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const profile = await getInstructorProfile(params.slug);

  if (!profile) {
    return { title: `강사 소개 | ${BRAND}` };
  }

  const title = `${profile.displayName} | ${BRAND}`;
  const description = truncate(
    profile.bio || FALLBACK_DESCRIPTION,
    160,
  );
  const canonicalPath = `/instructors/${profile.slug}`;
  const canonicalUrl = SITE_URL ? `${SITE_URL}${canonicalPath}` : canonicalPath;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'profile',
      ...(profile.profileImageUrl
        ? { images: [{ url: profile.profileImageUrl }] }
        : {}),
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
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

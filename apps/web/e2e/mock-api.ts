import * as http from 'node:http';

const MOCK_PROFILE = {
  success: true,
  data: {
    id: 'e2e-0000-0000-0000-000000000001',
    slug: 'kim-forest-e2e',
    isPublic: true,
    displayName: '김숲E2E',
    profileImageUrl: null,
    coverImageUrl: null,
    bio: 'E2E 테스트용 강사 프로필입니다.',
    certifications: [{ title: '숲해설사', issuer: '산림청', issuedAt: '2025-01-01' }],
    provider: null,
  },
};

const NOT_FOUND = { error: { message: 'Not Found', code: 'NOT_FOUND' } };

export function startMockApi(port: number): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');

      if (req.url === '/public/instructors/kim-forest-e2e') {
        res.writeHead(200);
        res.end(JSON.stringify(MOCK_PROFILE));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify(NOT_FOUND));
      }
    });

    server.listen(port, () => {
      console.log(`Mock API listening on port ${port}`);
      resolve(server);
    });
  });
}

// Auto-start when run directly
startMockApi(Number(process.env.MOCK_API_PORT) || 3099);

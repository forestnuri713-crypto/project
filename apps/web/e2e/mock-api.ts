import * as http from 'node:http';

const MOCK_PROFILE = {
  success: true,
  data: {
    id: 'e2e-id-1',
    slug: 'kim-forest-e2e',
    isPublic: true,
    displayName: '김숲E2E',
    profileImageUrl: null,
    coverImageUrl: null,
    bio: 'E2E용 소개입니다.',
    certifications: [],
    provider: null,
  },
};

const NOT_FOUND = {
  success: false,
  error: { code: 'NOT_FOUND', message: 'Not Found' },
};

export function startMockApi(port: number): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

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

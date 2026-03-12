# Local Service Marketplace - Frontend

Production-ready Next.js frontend application for the Local Service Marketplace platform.

## 🚀 Features

- **Modern Tech Stack**: Next.js 14 (App Router), TypeScript, React 18
- **State Management**: React Query for server state, Zustand for client state
- **Styling**: TailwindCSS with custom design system
- **Authentication**: JWT-based auth with protected routes
- **Real-time Updates**: Optimistic updates and cache invalidation
- **Responsive Design**: Mobile-first, responsive UI components
- **Type Safety**: Full TypeScript coverage

## 📋 Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Backend API Gateway running on http://localhost:3000

## 🛠️ Installation

1. **Clone or navigate to the project directory**

```bash
cd frontend/nextjs-app
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

4. **Run the development server**

```bash
npm run dev
```

The application will be available at [http://localhost:3001](http://localhost:3001)

## 📦 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

## 🏗️ Project Structure

```
frontend/nextjs-app/
├── app/                      # Next.js App Router pages
│   ├── (auth)/              # Authentication routes
│   │   ├── login/
│   │   └── signup/
│   ├── admin/               # Admin dashboard
│   ├── dashboard/           # User dashboard
│   ├── jobs/                # Job management
│   ├── messages/            # Messaging system
│   ├── notifications/       # Notifications
│   ├── requests/            # Service requests
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Homepage
│   └── providers.tsx        # React Query provider
├── components/
│   ├── layout/              # Layout components
│   │   ├── Layout.tsx
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   └── ui/                  # Reusable UI components
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Card.tsx
│       ├── Modal.tsx
│       ├── Badge.tsx
│       ├── Loading.tsx
│       ├── Alert.tsx
│       ├── Pagination.tsx
│       ├── Select.tsx
│       └── Textarea.tsx
├── hooks/                   # Custom React hooks
│   ├── useAuth.ts
│   ├── useModal.ts
│   └── usePagination.ts
├── services/                # API service layer
│   ├── api-client.ts
│   ├── auth-service.ts
│   ├── request-service.ts
│   ├── proposal-service.ts
│   ├── job-service.ts
│   ├── payment-service.ts
│   ├── message-service.ts
│   ├── notification-service.ts
│   └── admin-service.ts
├── store/                   # Zustand stores
│   ├── authStore.ts
│   └── notificationStore.ts
├── types/                   # TypeScript types
│   └── index.ts
├── utils/                   # Utility functions
│   └── helpers.ts
├── styles/                  # Global styles
│   └── globals.css
├── __tests__/              # Test files
├── public/                  # Static assets
├── Dockerfile              # Docker configuration
├── jest.config.js          # Jest configuration
├── next.config.js          # Next.js configuration
├── tailwind.config.js      # Tailwind configuration
└── tsconfig.json           # TypeScript configuration
```

## 🎨 UI Components

### Button
```tsx
<Button variant="primary" size="md" isLoading={false}>
  Click me
</Button>
```

**Variants**: `primary`, `secondary`, `outline`, `danger`, `ghost`  
**Sizes**: `sm`, `md`, `lg`

### Card
```tsx
<Card>
  <CardHeader>Title</CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

### Input
```tsx
<Input
  label="Email"
  type="email"
  error="Invalid email"
  required
/>
```

### Modal
```tsx
const { isOpen, open, close } = useModal();

<Modal isOpen={isOpen} onClose={close} title="Modal Title">
  Content
</Modal>
```

## 🔐 Authentication

The app uses JWT tokens stored in localStorage. Protected routes automatically redirect to login if not authenticated.

```tsx
'use client';
import { useAuth } from '@/hooks/useAuth';

export default function ProtectedPage() {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    // Auto-redirects to /login
    return null;
  }
  
  return <div>Welcome {user.name}</div>;
}
```

### Role-Based Access
```tsx
const { requireRole } = useAuth();

useEffect(() => {
  if (!requireRole(['admin'])) {
    router.push('/dashboard');
  }
}, []);
```

## 📡 API Integration

All API calls go through the centralized API client:

```tsx
import { requestService } from '@/services/request-service';

// Create a request
const request = await requestService.createRequest({
  categoryId: 'uuid',
  title: 'Need a plumber',
  description: 'Fix bathroom sink',
  budget: 150,
});

// Get requests with filters
const requests = await requestService.getRequests({
  status: 'open',
  page: 1,
  limit: 20,
});
```

### React Query Integration
```tsx
import { useQuery, useMutation } from '@tanstack/react-query';

// Fetch data
const { data, isLoading, error } = useQuery({
  queryKey: ['requests', page],
  queryFn: () => requestService.getRequests({ page }),
});

// Mutate data
const mutation = useMutation({
  mutationFn: requestService.createRequest,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['requests'] });
  },
});
```

## 🎯 State Management

### Server State (React Query)
- Data fetching
- Caching
- Background refetching
- Optimistic updates

### Client State (Zustand)
```tsx
import { useAuthStore } from '@/store/authStore';

const { user, token, login, logout } = useAuthStore();
```

## 🧪 Testing

Run tests:
```bash
npm test
```

Example test:
```tsx
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

test('renders button', () => {
  render(<Button>Click</Button>);
  expect(screen.getByText('Click')).toBeInTheDocument();
});
```

## 🐳 Docker Deployment

Build the Docker image:
```bash
docker build -t marketplace-frontend .
```

Run the container:
```bash
docker run -p 3001:3001 \
  -e NEXT_PUBLIC_API_URL=http://localhost:3000 \
  marketplace-frontend
```

### Production Considerations

1. **Environment Variables**: Set `NEXT_PUBLIC_API_URL` to your production API Gateway URL
2. **Standalone Output**: The Dockerfile uses Next.js standalone output for smaller image size
3. **Non-root User**: Container runs as `nextjs` user (UID 1001) for security
4. **Port**: The app runs on port 3001 by default

## 🔧 Configuration

### Next.js Config
```js
// next.config.js
module.exports = {
  output: 'standalone', // For Docker
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};
```

### Tailwind Config
Custom colors defined in `tailwind.config.js`:
- Primary: Blue shades
- Secondary: Indigo shades

## 📚 API Endpoints

The frontend interacts with these backend services via API Gateway (port 3000):

- **Auth**: `/api/auth/*` - Authentication & user management
- **Requests**: `/api/requests/*` - Service request CRUD
- **Proposals**: `/api/proposals/*` - Proposal management
- **Jobs**: `/api/jobs/*` - Job lifecycle management
- **Payments**: `/api/payments/*` - Payment processing
- **Messages**: `/api/messages/*` - Messaging system
- **Notifications**: `/api/notifications/*` - Notification delivery
- **Admin**: `/api/admin/*` - Admin operations

## 🚨 Error Handling

Global error handling via Axios interceptors:
- 401 errors: Auto-redirect to login
- Network errors: Toast notifications
- Validation errors: Display in forms

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 📄 License

This project is part of the Local Service Marketplace platform.

## 🤝 Contributing

1. Follow the established folder structure
2. Use TypeScript for all new files
3. Add tests for new components
4. Follow the component API conventions
5. Run `npm run lint` before committing

## 📞 Support

For issues or questions, contact the development team.

---

**Built with ❤️ using Next.js and modern web technologies**

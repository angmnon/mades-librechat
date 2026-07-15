import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import React from 'react';
import {
  Login,
  VerifyEmail,
  Registration,
  ResetPassword,
  ApiErrorWatcher,
  TwoFactorScreen,
  RequestPasswordReset,
} from '~/components/Auth';
import { MarketplaceProvider } from '~/components/Agents/MarketplaceContext';
import AgentMarketplace from '~/components/Agents/Marketplace';
import { OAuthSuccess, OAuthError } from '~/components/OAuth';
import { AuthContextProvider } from '~/hooks/AuthContext';
import WithRum from '~/lib/rum/WithRum';
import RouteErrorBoundary from './RouteErrorBoundary';
import StartupLayout from './Layouts/Startup';
import LoginLayout from './Layouts/Login';
import dashboardRoutes from './Dashboard';
import ShareRoute from './ShareRoute';
import ChatRoute from './ChatRoute';
import Search from './Search';
import Root from './Root';
import MadesApiProvider from '~/components/_shared/MadesApiProvider';

// MADES Page Lazy Imports
const WorkspaceDashboard = React.lazy(() => import('~/components/Workspace/Dashboard'));
const TaskCenter = React.lazy(() => import('~/components/TaskCenter/TaskCenter'));
const ArtifactPage = React.lazy(() => import('~/components/Artifacts/ArtifactPage'));
const HealthPanel = React.lazy(() => import('~/components/Health/HealthPanel'));
const ReplayStudio = React.lazy(() => import('~/components/ReplayStudio/ReplayStudio'));

const AuthLayout = () => (
  <AuthContextProvider>
    <WithRum>
      <MadesApiProvider>
        <Outlet />
      </MadesApiProvider>
    </WithRum>
    <ApiErrorWatcher />
  </AuthContextProvider>
);

const loadInlinePromptsView = () =>
  import('~/components/Prompts/layouts/InlinePromptsView').then((m) => ({
    Component: m.default,
  }));

const loadSkillsView = () =>
  import('~/components/Skills/layouts/SkillsView').then((m) => ({
    Component: m.default,
  }));

const loadProjectsView = () =>
  import('~/components/Projects').then((m) => ({
    Component: m.ProjectsView,
  }));

const loadProjectWorkspace = () =>
  import('~/components/Projects').then((m) => ({
    Component: m.ProjectWorkspace,
  }));

const baseEl = document.querySelector('base');
const baseHref = baseEl?.getAttribute('href') || '/';

export const router = createBrowserRouter(
  [
    {
      path: 'share/:shareId',
      element: <ShareRoute />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'oauth',
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'success',
          element: <OAuthSuccess />,
        },
        {
          path: 'error',
          element: <OAuthError />,
        },
      ],
    },
    {
      path: '/',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'register',
          element: <Registration />,
        },
        {
          path: 'forgot-password',
          element: <RequestPasswordReset />,
        },
        {
          path: 'reset-password',
          element: <ResetPassword />,
        },
      ],
    },
    {
      path: 'verify',
      element: <VerifyEmail />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: '/',
          element: <LoginLayout />,
          children: [
            {
              path: 'login',
              element: <Login />,
            },
            {
              path: 'login/2fa',
              element: <TwoFactorScreen />,
            },
          ],
        },
        dashboardRoutes,
        {
          path: '/',
          element: <Root />,
          children: [
            {
              index: true,
              element: <Navigate to="/c/new" replace={true} />,
            },
            {
              path: 'c/:conversationId?',
              element: <ChatRoute />,
            },
            {
              path: 'search',
              element: <Search />,
            },
            {
              path: 'prompts',
              element: <Navigate to="/prompts/new" replace={true} />,
            },
            {
              path: 'prompts/new',
              lazy: loadInlinePromptsView,
            },
            {
              path: 'prompts/:promptId',
              lazy: loadInlinePromptsView,
            },
            {
              path: 'skills',
              lazy: loadSkillsView,
            },
            {
              path: 'skills/new',
              lazy: loadSkillsView,
            },
            {
              path: 'skills/:skillId',
              lazy: loadSkillsView,
            },
            {
              path: 'skills/:skillId/edit',
              lazy: loadSkillsView,
            },
            {
              path: 'projects',
              lazy: loadProjectsView,
            },
            {
              path: 'projects/:projectId',
              lazy: loadProjectWorkspace,
            },
            {
              path: 'agents',
              element: (
                <MarketplaceProvider>
                  <AgentMarketplace />
                </MarketplaceProvider>
              ),
            },
            {
              path: 'agents/:category',
              element: (
                <MarketplaceProvider>
                  <AgentMarketplace />
                </MarketplaceProvider>
              ),
            },
            // MADES Pages
            {
              path: 'workspace',
              element: (
                <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading...</div>}>
                  <WorkspaceDashboard />
                </Suspense>
              ),
            },
            {
              path: 'workspace/:id',
              element: (
                <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading...</div>}>
                  <WorkspaceDashboard />
                </Suspense>
              ),
            },
            {
              path: 'tasks/:taskId',
              element: (
                <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading...</div>}>
                  <TaskCenter />
                </Suspense>
              ),
            },
            {
              path: 'artifacts/:id',
              element: (
                <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading...</div>}>
                  <ArtifactPage />
                </Suspense>
              ),
            },
            {
              path: 'health',
              element: (
                <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading...</div>}>
                  <HealthPanel />
                </Suspense>
              ),
            },
            {
              path: 'replay',
              element: (
                <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading...</div>}>
                  <ReplayStudio />
                </Suspense>
              ),
            },
          ],
        },
      ],
    },
  ],
  { basename: baseHref },
);

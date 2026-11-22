import type { ReactNode } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreateEventPage from './pages/CreateEventPage';
import EventManagePage from './pages/EventManagePage';
import PublicEventPage from './pages/PublicEventPage';
import TicketPage from './pages/TicketPage';
import ScannerPage from './pages/ScannerPage';
import NotFound from './pages/NotFound';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  {
    name: 'Home',
    path: '/',
    element: <LandingPage />,
    public: true,
  },
  {
    name: 'Host sign in',
    path: '/login',
    element: <LoginPage />,
    public: true,
  },
  {
    name: 'Dashboard',
    path: '/dashboard',
    element: <DashboardPage />,
  },
  {
    name: 'Create event',
    path: '/dashboard/events/new',
    element: <CreateEventPage />,
  },
  {
    name: 'Manage event',
    path: '/dashboard/events/:eventId',
    element: <EventManagePage />,
  },
  {
    name: 'Gate scanner',
    path: '/dashboard/events/:eventId/scanner',
    element: <ScannerPage />,
  },
  {
    name: 'Public event',
    path: '/e/:slug',
    element: <PublicEventPage />,
    public: true,
  },
  {
    name: 'Digital ticket',
    path: '/t/:reference',
    element: <TicketPage />,
    public: true,
  },
  {
    name: 'Ticket by code',
    path: '/ticket/:code',
    element: <TicketPage />,
    public: true,
  },
  {
    name: 'Not found',
    path: '/404',
    element: <NotFound />,
    public: true,
  },
];

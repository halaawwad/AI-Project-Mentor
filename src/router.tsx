import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { LocalStorageNotice } from "@/components/LocalStorageNotice";
import { BomPage } from "@/routes/BomPage";
import { CatalogPage } from "@/routes/CatalogPage";
import { DescribePage } from "@/routes/DescribePage";
import { ChooseProjectPage } from "@/routes/journey/ChooseProjectPage";
import { JourneyPage } from "@/routes/journey/JourneyPage";
import { LevelPage } from "@/routes/journey/LevelPage";
import { NewComponentPage } from "@/routes/journey/NewComponentPage";
import { ReadyPage } from "@/routes/journey/ReadyPage";
import { StagePage } from "@/routes/journey/StagePage";
import { HomePage } from "@/routes/HomePage";
import { LabPage } from "@/routes/LabPage";

// Code-based routes: the LabAssist student app used TanStack Start file routes with SSR;
// AiPM is a client-only Vite app, so the same router package is configured directly.

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. You can try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              void router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <LocalStorageNotice />
      <Outlet />
    </>
  ),
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/catalog",
  validateSearch: (search: Record<string, unknown>): { part?: string } =>
    typeof search["part"] === "string" ? { part: search["part"] } : {},
  component: CatalogPage,
});

const bomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bom",
  component: BomPage,
});

const labRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lab",
  // Same search contract as LabAssist: `add` is a lab model id, `request` makes repeats distinct.
  validateSearch: (search: Record<string, unknown>): { add?: string; request?: string } => ({
    ...(typeof search["add"] === "string" ? { add: search["add"] } : {}),
    ...(typeof search["request"] === "string" ? { request: search["request"] } : {}),
  }),
  component: LabPage,
});

const describeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/describe",
  component: DescribePage,
});

const journeyRoutes = [
  createRoute({ getParentRoute: () => rootRoute, path: "/journey", component: JourneyPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/journey/choose", component: ChooseProjectPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/journey/level", component: LevelPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/journey/stage",
    validateSearch: (search: Record<string, unknown>): { id: string } => ({
      id: typeof search["id"] === "string" ? search["id"] : "",
    }),
    component: StagePage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: "/journey/ready", component: ReadyPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/journey/new-component", component: NewComponentPage }),
] as const;

const routeTree = rootRoute.addChildren([
  homeRoute,
  describeRoute,
  ...journeyRoutes,
  catalogRoute,
  bomRoute,
  labRoute,
]);

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
